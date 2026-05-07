import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ClickHouseService } from '../clickhouse/clickhouse.service';
import { RedisService } from '../redis/redis.service';
import { JwtPayload } from '../auth/auth.service';

// ─── Cache ────────────────────────────────────────────────────────────────────
// L1: Map em processo (zero latência, por réplica)
// L2: Redis compartilhado (evita thundering herd entre as 3 réplicas)

const CACHE_TTL_S    = 30 * 60;
const CACHE_STALE_S  = 60 * 60;
const CACHE_TTL_MS   = CACHE_TTL_S   * 1000;
const CACHE_STALE_MS = CACHE_STALE_S * 1000;
const LOCK_TTL_S     = 10;

interface CacheEntry { data: unknown; createdAt: number; refreshing: boolean; }

class LocalCache {
  private store = new Map<string, CacheEntry>();
  get<T>(key: string): { data: T; stale: boolean } | null {
    const e = this.store.get(key);
    if (!e) return null;
    const age = Date.now() - e.createdAt;
    if (age > CACHE_STALE_MS) { this.store.delete(key); return null; }
    return { data: e.data as T, stale: age > CACHE_TTL_MS };
  }
  set(key: string, data: unknown)      { this.store.set(key, { data, createdAt: Date.now(), refreshing: false }); }
  markRefreshing(key: string)          { const e = this.store.get(key); if (e) e.refreshing = true; }
  isRefreshing(key: string): boolean   { return this.store.get(key)?.refreshing ?? false; }
}

// ─── Query Limiter ────────────────────────────────────────────────────────────
// Máximo 4 queries analíticas simultâneas. Com cache de 30min, a grande
// maioria das requisições nunca chega ao ClickHouse.

const MAX_CONCURRENT = 4;
class QueryLimiter {
  private active = 0;
  private readonly queue: Array<() => void> = [];
  constructor(private readonly max: number) {}
  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active >= this.max) await new Promise<void>(r => this.queue.push(r));
    this.active++;
    try { return await fn(); }
    finally { this.active--; this.queue.shift()?.(); }
  }
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class AnalyticsService {
  private readonly logger  = new Logger(AnalyticsService.name);
  private readonly local   = new LocalCache();
  private readonly limiter = new QueryLimiter(MAX_CONCURRENT);

  constructor(
    private readonly prisma:     PrismaService,
    private readonly clickhouse: ClickHouseService,
    private readonly redis:      RedisService,
  ) {}

  // ── Cache helpers ─────────────────────────────────────────────────────────

  private async _cacheGet<T>(key: string): Promise<{ data: T; stale: boolean } | null> {
    const l1 = this.local.get<T>(key);
    if (l1) return l1;
    if (this.redis.available) {
      const raw = await this.redis.get(`analytics:${key}`);
      if (raw) {
        try {
          const p = JSON.parse(raw) as { data: T; createdAt: number };
          const age = Date.now() - p.createdAt;
          if (age <= CACHE_STALE_MS) {
            this.local.set(key, p.data);
            return { data: p.data, stale: age > CACHE_TTL_MS };
          }
        } catch { /* entrada corrompida */ }
      }
    }
    return null;
  }

  private async _cacheSet(key: string, data: unknown): Promise<void> {
    this.local.set(key, data);
    if (this.redis.available)
      await this.redis.setJSON(`analytics:${key}`, { data, createdAt: Date.now() }, CACHE_STALE_S);
  }

  private async _acquireLock(key: string): Promise<boolean> {
    if (!this.redis.available) return !this.local.isRefreshing(key);
    return this.redis.setNX(`lock:analytics:${key}`, '1', LOCK_TTL_S);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private async _resolvePixelIds(caller: JwtPayload, projectId?: string): Promise<string[]> {
    const accountId = caller.ownerId ?? caller.userId;
    const projects  = await this.prisma.projects.findMany({
      where:  { userId: accountId },
      select: { pixelId: true, id: true },
    });
    if (!projects.length) return [];

    let allowedIds: Set<string> | null = null;
    if (caller.ownerId && caller.memberRole !== 'admin') {
      const access = await (this.prisma as any).project_access.findMany({
        where:  { membership: { userId: caller.userId, ownerId: caller.ownerId } },
        select: { projectId: true },
      });
      allowedIds = new Set(access.map((a: any) => a.projectId));
    }

    if (projectId) {
      const p = projects.find(p => p.id === projectId);
      if (!p || (allowedIds && !allowedIds.has(p.id)))
        throw new UnauthorizedException('Project not found or access denied');
      return [p.pixelId];
    }
    return projects.filter(p => !allowedIds || allowedIds.has(p.id)).map(p => p.pixelId);
  }

  // Filtro de data para colunas DateTime (Unix timestamp)
  private _timeFilter(start?: string, end?: string, col = 'event_time') {
    const params: Record<string, unknown> = {};
    let sql = '';
    if (start) { const v = Math.floor(new Date(start).getTime() / 1000); if (!isNaN(v)) { sql += ` AND ${col} >= {startTime:UInt32}`; params.startTime = v; } }
    if (end)   { const v = Math.floor(new Date(end).getTime()   / 1000); if (!isNaN(v)) { sql += ` AND ${col} <= {endTime:UInt32}`;   params.endTime   = v; } }
    return { sql, params };
  }

  // Filtro de data para colunas Date
  private _dateFilter(start?: string, end?: string, col = 'event_date') {
    const params: Record<string, unknown> = {};
    let sql = '';
    if (start) { const d = new Date(start).toISOString().slice(0,10); if (d) { sql += ` AND ${col} >= {startDate:Date}`; params.startDate = d; } }
    if (end)   { const d = new Date(end).toISOString().slice(0,10);   if (d) { sql += ` AND ${col} <= {endDate:Date}`;   params.endDate   = d; } }
    return { sql, params };
  }

  // ── Dashboard principal ───────────────────────────────────────────────────
  // Usa nx_events (sem JOIN) — 3-10x mais rápido que events+leads.

  async getDashboardMetrics(
    caller: JwtPayload,
    filters: { projectId?: string; startDate?: string; endDate?: string; timezone?: string },
  ) {
    const pixelIds = await this._resolvePixelIds(caller, filters.projectId);
    if (!pixelIds.length) return this._emptyMetrics();

    const tz  = filters.timezone || 'America/Sao_Paulo';
    const key = `dash:${pixelIds.sort().join(',')}:${filters.startDate}:${filters.endDate}:${tz}`;

    const cached = await this._cacheGet<ReturnType<typeof this._emptyMetrics>>(key);
    if (cached) {
      if (cached.stale) {
        void this._acquireLock(key).then(ok => {
          if (!ok) return;
          this.local.markRefreshing(key);
          void this.limiter.run(() => this._fetchDashboard(pixelIds, filters))
            .then(r => this._cacheSet(key, r));
        });
      }
      return cached.data;
    }

    const result = await this.limiter.run(() => this._fetchDashboard(pixelIds, filters));
    await this._cacheSet(key, result);
    return result;
  }

  private async _fetchDashboard(pixelIds: string[], filters: { startDate?: string; endDate?: string; timezone?: string }) {
    const { sql: tf, params: tp } = this._timeFilter(filters.startDate, filters.endDate);
    const base = { pixelIds, ...tp };

    // Totais — scan direto em nx_events, sem JOIN
    const totalsQ = `
      SELECT
        round(sumIf(revenue, event_name = 'Purchase'), 2)  AS grossRevenue,
        countIf(event_name = 'Purchase')                   AS purchaseCount,
        uniqIf(nx_user,  event_name = 'Purchase')          AS uniqueBuyers,
        count()                                            AS totalEvents
      FROM nx_events
      WHERE pixel_id IN {pixelIds:Array(String)} ${tf}
    `;

    // Gateway de pagamento — direto de nx_events.gateway (sem JSONExtract)
    const gatewayQ = `
      SELECT
        gateway                                   AS bucket,
        round(SUM(revenue), 2)                    AS grossRevenue,
        COUNT()                                   AS purchaseCount
      FROM nx_events
      WHERE pixel_id IN {pixelIds:Array(String)}
        AND event_name = 'Purchase'
        AND gateway != ''
        ${tf}
      GROUP BY bucket
      ORDER BY grossRevenue DESC
    `;

    // Canal — usa nx_daily_channel (O(dias) em vez de O(eventos))
    const { sql: df, params: dp } = this._dateFilter(filters.startDate, filters.endDate);
    const channelQ = `
      SELECT
        channel,
        round(SUM(revenue), 2)  AS totalRevenue,
        SUM(sales)              AS count
      FROM nx_daily_channel
      WHERE pixel_id IN {pixelIds:Array(String)} ${df}
      GROUP BY channel
      ORDER BY totalRevenue DESC
      LIMIT 20
    `;

    // UTM Campaign — usa nx_daily_campaign (O(dias))
    const campaignQ = `
      SELECT
        utm_campaign               AS campaign,
        channel,
        round(SUM(revenue), 2)    AS totalRevenue,
        SUM(sales)                AS count
      FROM nx_daily_campaign
      WHERE pixel_id IN {pixelIds:Array(String)} ${df}
      GROUP BY campaign, channel
      ORDER BY totalRevenue DESC
      LIMIT 20
    `;

    const [totals, gateways, channels, campaigns] = await Promise.all([
      this.clickhouse.query<{ grossRevenue: number; purchaseCount: number; uniqueBuyers: number; totalEvents: number }>(totalsQ, base),
      this.clickhouse.query<{ bucket: string; grossRevenue: number; purchaseCount: number }>(gatewayQ, base),
      this.clickhouse.query<{ channel: string; totalRevenue: number; count: number }>(channelQ, { pixelIds, ...dp }),
      this.clickhouse.query<{ campaign: string; channel: string; totalRevenue: number; count: number }>(campaignQ, { pixelIds, ...dp }),
    ]);

    const t = totals[0];
    return {
      grossRevenue:   t?.grossRevenue  ? Number(t.grossRevenue)  : 0,
      purchaseCount:  t?.purchaseCount ? Number(t.purchaseCount) : 0,
      uniqueBuyers:   t?.uniqueBuyers  ? Number(t.uniqueBuyers)  : 0,
      totalEvents:    t?.totalEvents   ? Number(t.totalEvents)   : 0,
      paymentMethods: gateways.map(r => ({
        method:       r.bucket || 'Desconhecido',
        totalRevenue: Number(r.grossRevenue),
        count:        Number(r.purchaseCount),
      })),
      // alias para retrocompatibilidade com o frontend
      utmSources: channels.map(r => ({
        source:       r.channel || 'direct',
        totalRevenue: Number(r.totalRevenue),
        count:        Number(r.count),
      })),
      utmCampaigns: campaigns.map(r => ({
        campaign:     r.campaign || '(none)',
        channel:      r.channel,
        totalRevenue: Number(r.totalRevenue),
        count:        Number(r.count),
      })),
    };
  }

  // ── Receita ao longo do tempo ─────────────────────────────────────────────

  async getRevenueOverTime(
    caller: JwtPayload,
    filters: { projectId?: string; startDate?: string; endDate?: string; timezone?: string },
  ): Promise<{ date: string; revenue: number; sales: number }[]> {
    const pixelIds = await this._resolvePixelIds(caller, filters.projectId);
    if (!pixelIds.length) return [];

    const tz  = filters.timezone || 'America/Sao_Paulo';
    const key = `rev-time:${pixelIds.sort().join(',')}:${filters.startDate}:${filters.endDate}:${tz}`;

    const cached = await this._cacheGet<{ date: string; revenue: number; sales: number }[]>(key);
    if (cached) {
      if (cached.stale) {
        void this._acquireLock(key).then(ok => {
          if (!ok) return;
          this.local.markRefreshing(key);
          void this.limiter.run(() => this._fetchRevenueOverTime(pixelIds, filters))
            .then(r => this._cacheSet(key, r));
        });
      }
      return cached.data;
    }

    const result = await this.limiter.run(() => this._fetchRevenueOverTime(pixelIds, filters));
    await this._cacheSet(key, result);
    return result;
  }

  private async _fetchRevenueOverTime(pixelIds: string[], filters: { startDate?: string; endDate?: string; timezone?: string }) {
    const tz = filters.timezone || 'America/Sao_Paulo';
    const { sql: tf, params: tp } = this._timeFilter(filters.startDate, filters.endDate);

    const rows = await this.clickhouse.query<{ date: string; revenue: string; sales: string }>(
      `SELECT
         toDate(event_time, {tz:String}) AS date,
         round(SUM(revenue), 2)          AS revenue,
         COUNT()                         AS sales
       FROM nx_events
       WHERE pixel_id IN {pixelIds:Array(String)}
         AND event_name = 'Purchase'
         ${tf}
       GROUP BY date
       ORDER BY date ASC`,
      { pixelIds, tz, ...tp },
    );
    return rows.map(r => ({ date: String(r.date), revenue: Number(r.revenue), sales: Number(r.sales) }));
  }

  // ── Atribuição por canal ──────────────────────────────────────────────────
  // Usa nx_daily_channel (SummingMergeTree) — O(dias), não O(eventos).

  async getChannelAttribution(
    caller: JwtPayload,
    filters: { projectId?: string; startDate?: string; endDate?: string },
  ): Promise<{ channel: string; revenue: number; sales: number; eventsCount: number }[]> {
    const pixelIds = await this._resolvePixelIds(caller, filters.projectId);
    if (!pixelIds.length) return [];

    const { sql: df, params: dp } = this._dateFilter(filters.startDate, filters.endDate);
    const rows = await this.limiter.run(() =>
      this.clickhouse.query<{ channel: string; revenue: string; sales: string; eventsCount: string }>(
        `SELECT
           channel,
           round(SUM(revenue), 2) AS revenue,
           SUM(sales)             AS sales,
           SUM(events_count)      AS eventsCount
         FROM nx_daily_channel
         WHERE pixel_id IN {pixelIds:Array(String)} ${df}
         GROUP BY channel
         ORDER BY revenue DESC`,
        { pixelIds, ...dp },
      )
    );
    return rows.map(r => ({
      channel:     r.channel || 'direct',
      revenue:     Number(r.revenue),
      sales:       Number(r.sales),
      eventsCount: Number(r.eventsCount),
    }));
  }

  // ── Top campanhas ─────────────────────────────────────────────────────────

  async getTopCampaigns(
    caller: JwtPayload,
    filters: { projectId?: string; startDate?: string; endDate?: string; limit?: number },
  ): Promise<{ campaign: string; channel: string; utm_source: string; revenue: number; sales: number }[]> {
    const pixelIds = await this._resolvePixelIds(caller, filters.projectId);
    if (!pixelIds.length) return [];

    const limit = Math.min(filters.limit ?? 30, 100);
    const { sql: df, params: dp } = this._dateFilter(filters.startDate, filters.endDate);

    const rows = await this.limiter.run(() =>
      this.clickhouse.query<{ campaign: string; channel: string; utm_source: string; revenue: string; sales: string }>(
        `SELECT
           utm_campaign AS campaign,
           channel,
           utm_source,
           round(SUM(revenue), 2) AS revenue,
           SUM(sales)             AS sales
         FROM nx_daily_campaign
         WHERE pixel_id IN {pixelIds:Array(String)} ${df}
         GROUP BY campaign, channel, utm_source
         ORDER BY revenue DESC
         LIMIT {limit:UInt32}`,
        { pixelIds, limit, ...dp },
      )
    );
    return rows.map(r => ({
      campaign:   r.campaign   || '(none)',
      channel:    r.channel    || 'direct',
      utm_source: r.utm_source || '',
      revenue:    Number(r.revenue),
      sales:      Number(r.sales),
    }));
  }

  // ── Funil de conversão ────────────────────────────────────────────────────

  async getFunnel(
    caller: JwtPayload,
    filters: { projectId?: string; startDate?: string; endDate?: string },
  ): Promise<{ event_name: string; count: number; unique_users: number }[]> {
    const pixelIds = await this._resolvePixelIds(caller, filters.projectId);
    if (!pixelIds.length) return [];

    const { sql: tf, params: tp } = this._timeFilter(filters.startDate, filters.endDate);

    const rows = await this.limiter.run(() =>
      this.clickhouse.query<{ event_name: string; count: string; unique_users: string }>(
        `SELECT
           event_name,
           count()       AS count,
           uniq(nx_user) AS unique_users
         FROM nx_events
         WHERE pixel_id IN {pixelIds:Array(String)}
           AND event_name IN ('PageView','ViewContent','AddToCart','InitiateCheckout','Purchase')
           ${tf}
         GROUP BY event_name
         ORDER BY count DESC`,
        { pixelIds, ...tp },
      )
    );
    // Ordenar pela sequência do funil
    const order = ['PageView','ViewContent','AddToCart','InitiateCheckout','Purchase'];
    return rows
      .sort((a, b) => order.indexOf(a.event_name) - order.indexOf(b.event_name))
      .map(r => ({
        event_name:   r.event_name,
        count:        Number(r.count),
        unique_users: Number(r.unique_users),
      }));
  }

  // ── Cobertura de sinais e CAPI ────────────────────────────────────────────

  async getSignalCoverage(
    caller: JwtPayload,
    filters: { projectId?: string; startDate?: string; endDate?: string },
  ): Promise<{
    total_purchases: number;
    pct_fbp: number; pct_ttp: number; pct_gclid: number;
    capi_meta_rate: number; capi_tiktok_rate: number; capi_ga4_rate: number;
  }> {
    const pixelIds = await this._resolvePixelIds(caller, filters.projectId);
    if (!pixelIds.length) return this._emptySignals();

    const { sql: tf, params: tp } = this._timeFilter(filters.startDate, filters.endDate);

    const rows = await this.limiter.run(() =>
      this.clickhouse.query<Record<string, string>>(
        `SELECT
           countIf(event_name = 'Purchase')                                                              AS total_purchases,
           round(100 * countIf(fbp   != '') / greatest(count(), 1), 1)                                  AS pct_fbp,
           round(100 * countIf(ttp   != '') / greatest(count(), 1), 1)                                  AS pct_ttp,
           round(100 * countIf(gclid != '') / greatest(count(), 1), 1)                                  AS pct_gclid,
           round(100 * countIf(capi_meta   = 1) / greatest(countIf(capi_meta   != -1), 1), 1)           AS capi_meta_rate,
           round(100 * countIf(capi_tiktok = 1) / greatest(countIf(capi_tiktok != -1), 1), 1)           AS capi_tiktok_rate,
           round(100 * countIf(capi_ga4    = 1) / greatest(countIf(capi_ga4    != -1), 1), 1)           AS capi_ga4_rate
         FROM nx_events
         WHERE pixel_id IN {pixelIds:Array(String)} ${tf}`,
        { pixelIds, ...tp },
      )
    );

    const r = rows[0] ?? {};
    return {
      total_purchases:  Number(r.total_purchases  ?? 0),
      pct_fbp:          Number(r.pct_fbp          ?? 0),
      pct_ttp:          Number(r.pct_ttp          ?? 0),
      pct_gclid:        Number(r.pct_gclid        ?? 0),
      capi_meta_rate:   Number(r.capi_meta_rate   ?? 0),
      capi_tiktok_rate: Number(r.capi_tiktok_rate ?? 0),
      capi_ga4_rate:    Number(r.capi_ga4_rate    ?? 0),
    };
  }

  // ── Empty states ──────────────────────────────────────────────────────────

  private _emptyMetrics() {
    return {
      grossRevenue: 0, purchaseCount: 0, uniqueBuyers: 0, totalEvents: 0,
      paymentMethods: [], utmSources: [], utmCampaigns: [],
    };
  }

  private _emptySignals() {
    return {
      total_purchases: 0, pct_fbp: 0, pct_ttp: 0, pct_gclid: 0,
      capi_meta_rate: 0, capi_tiktok_rate: 0, capi_ga4_rate: 0,
    };
  }
}
