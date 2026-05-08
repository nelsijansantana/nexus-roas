import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClickHouseClient, createClient } from '@clickhouse/client';

@Injectable()
export class ClickHouseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ClickHouseService.name);
  private client: ClickHouseClient;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    this.client = createClient({
      url: this.config.get<string>('CLICKHOUSE_HOST', 'http://localhost:8123'),
      username: this.config.get<string>('CLICKHOUSE_USER', 'default'),
      password: this.config.get<string>('CLICKHOUSE_PASSWORD', ''),
      database: this.config.get<string>('CLICKHOUSE_DB', 'nexus_roas'),
    });
    void this.ensureTables();
  }

  async onModuleDestroy() {
    await this.client.close();
  }

  async query<T>(sql: string, params?: Record<string, unknown>): Promise<T[]> {
    const result = await this.client.query({
      query: sql,
      query_params: params,
      format: 'JSONEachRow',
    });
    return result.json<T>();
  }

  async insert<T extends Record<string, any>>(
    table: string,
    rows: T[],
  ): Promise<void> {
    if (!rows.length) return;
    await this.client.insert({ table, values: rows, format: 'JSONEachRow' });
  }

  // ── Schema bootstrap ─────────────────────────────────────────────────────────

  private async ensureTables(): Promise<void> {
    const host = this.config.get<string>(
      'CLICKHOUSE_HOST',
      'http://localhost:8123',
    );
    const username = this.config.get<string>('CLICKHOUSE_USER', 'default');
    const password = this.config.get<string>('CLICKHOUSE_PASSWORD', '');
    const db = this.config.get<string>('CLICKHOUSE_DB', 'nexus_roas');

    try {
      // Wait for ClickHouse to be ready (Docker startup race)
      let retries = 5;
      while (retries > 0) {
        try {
          const adminClient = createClient({ url: host, username, password });
          await this.execAndConsume(
            adminClient,
            `CREATE DATABASE IF NOT EXISTS \`${db}\``,
          );
          await adminClient.close();
          break;
        } catch {
          retries--;
          this.logger.warn(
            `Aguardando ClickHouse... tentativas restantes: ${retries}`,
          );
          if (retries === 0)
            throw new Error('ClickHouse não respondeu após 5 tentativas');
          await new Promise((r) => setTimeout(r, 5000));
        }
      }

      await this._ensureLegacyTables();
      await this._ensureNxEvents();
      await this._ensureMLTables();
      await this._ensureAdSpendTables();
      await this._ensureAggregates();
      await this._ensureViews();
      await this._backfillAll();

      this.logger.log('ClickHouse schema verificado ✓');
    } catch (err) {
      this.logger.error('Falha ao verificar tabelas ClickHouse', err);
    }
  }

  // ── Tabelas legadas (mantidas para retrocompatibilidade) ──────────────────────

  private async _ensureLegacyTables(): Promise<void> {
    await this.execAndConsume(
      this.client,
      `
      CREATE TABLE IF NOT EXISTS leads (
        id                String,
        pixel_id          String,
        email             String DEFAULT '',
        phone             String DEFAULT '',
        first_name        String DEFAULT '',
        last_name         String DEFAULT '',
        ip                String DEFAULT '',
        ipv6              String DEFAULT '',
        user_agent        String DEFAULT '',
        fbc               String DEFAULT '',
        fbp               String DEFAULT '',
        gclid             String DEFAULT '',
        gbraid            String DEFAULT '',
        wbraid            String DEFAULT '',
        ttclid            String DEFAULT '',
        ttp               String DEFAULT '',
        country           String DEFAULT '',
        state             String DEFAULT '',
        city              String DEFAULT '',
        zipcode           String DEFAULT '',
        parameters        String DEFAULT '',
        meta_pixel_ids    Array(String),
        tiktok_pixel_ids  Array(String),
        external_id       String DEFAULT '',
        gender            String DEFAULT '',
        date_of_birth     String DEFAULT '',
        cart_token        String DEFAULT '',
        utm_source        String DEFAULT '',
        utm_medium        String DEFAULT '',
        utm_campaign      String DEFAULT '',
        utm_content       String DEFAULT '',
        utm_term          String DEFAULT '',
        utm_id            String DEFAULT '',
        utm_platform      String DEFAULT '',
        utm_network       String DEFAULT '',
        placement         String DEFAULT '',
        creative_format   String DEFAULT '',
        ad_id             String DEFAULT '',
        adset_id          String DEFAULT '',
        campaign_id       String DEFAULT '',
        conversion_type   String DEFAULT '',
        created_at        DateTime DEFAULT now(),
        updated_at        DateTime DEFAULT now()
      ) ENGINE = ReplacingMergeTree(updated_at)
      ORDER BY (pixel_id, id)
    `,
    );

    // Migrations idempotentes para colunas adicionadas depois da criação inicial
    for (const col of [
      `cart_token String DEFAULT ''`,
      `utm_source String DEFAULT ''`,
      `utm_medium String DEFAULT ''`,
      `utm_campaign String DEFAULT ''`,
      `utm_content String DEFAULT ''`,
      `utm_term String DEFAULT ''`,
      `utm_id String DEFAULT ''`,
      `utm_platform String DEFAULT ''`,
      `utm_network String DEFAULT ''`,
      `placement String DEFAULT ''`,
      `creative_format String DEFAULT ''`,
      `ad_id String DEFAULT ''`,
      `adset_id String DEFAULT ''`,
      `campaign_id String DEFAULT ''`,
      `conversion_type String DEFAULT ''`,
    ]) {
      const name = col.split(' ')[0];
      await this.execAndConsume(
        this.client,
        `ALTER TABLE leads ADD COLUMN IF NOT EXISTS ${col}`,
      ).catch(() => {});
      void name; // suppress unused-var lint
    }

    await this.execAndConsume(
      this.client,
      `
      CREATE TABLE IF NOT EXISTS events (
        id            String,
        lead_id       String DEFAULT '',
        pixel_id      String,
        event_type    String,
        source_url    String DEFAULT '',
        page_title    String DEFAULT '',
        referrer      String DEFAULT '',
        ip            String DEFAULT '',
        user_agent    String DEFAULT '',
        fbc           String DEFAULT '',
        fbp           String DEFAULT '',
        value         Float64 DEFAULT 0,
        currency      String DEFAULT 'BRL',
        content_type  String DEFAULT 'product',
        custom_data   String DEFAULT '',
        event_time    DateTime,
        created_at    DateTime DEFAULT now()
      ) ENGINE = MergeTree()
      ORDER BY (pixel_id, event_time, event_type)
      PARTITION BY toYYYYMM(event_time)
      TTL event_time + INTERVAL 1 YEAR
    `,
    );

    for (const col of [
      `value Float64 DEFAULT 0`,
      `currency String DEFAULT 'BRL'`,
      `content_type String DEFAULT 'product'`,
      `custom_data String DEFAULT ''`,
    ]) {
      await this.execAndConsume(
        this.client,
        `ALTER TABLE events ADD COLUMN IF NOT EXISTS ${col}`,
      ).catch(() => {});
    }

    // Rename camelCase key columns se ainda existirem (migração única)
    await this._migrateEventsTableIfNeeded();
    await this._migrateLeadsTableIfNeeded();
  }

  // ── nx_events — tabela principal desnormalizada (sem JOIN) ────────────────────
  //
  // Vantagens sobre events+leads:
  //   • Nenhum JOIN = 3-10x menos CPU por query analítica
  //   • ORDER BY com date materializado = partition pruning automático
  //   • LowCardinality em colunas de filtro = 4x menos memória
  //   • Todos os click IDs + CAPI status por linha = ready for ML

  private async _ensureNxEvents(): Promise<void> {
    await this.execAndConsume(
      this.client,
      `
      CREATE TABLE IF NOT EXISTS nx_events (
        -- Identidade
        pixel_id      String,
        event_id      String,
        nx_user       String    DEFAULT '',
        session_id    String    DEFAULT '',
        -- Evento
        event_name    LowCardinality(String),
        event_date    Date      MATERIALIZED toDate(event_time),
        event_time    DateTime,
        page_url      String    DEFAULT '',
        referrer      String    DEFAULT '',
        -- UTMs
        utm_source    String    DEFAULT '',
        utm_medium    String    DEFAULT '',
        utm_campaign  String    DEFAULT '',
        utm_content   String    DEFAULT '',
        utm_term      String    DEFAULT '',
        utm_id        String    DEFAULT '',
        utm_platform  String    DEFAULT '',
        utm_network   String    DEFAULT '',
        -- IDs de campanha
        ad_id         String    DEFAULT '',
        adset_id      String    DEFAULT '',
        campaign_id   String    DEFAULT '',
        placement     String    DEFAULT '',
        creative_format String  DEFAULT '',
        conversion_type String  DEFAULT '',
        -- Canal derivado (paid_social_meta | paid_search_google | organic | direct | email | ...)
        channel       LowCardinality(String) DEFAULT '',
        -- Click IDs (browser é a fonte mais confiável)
        fbclid        String    DEFAULT '',
        fbc           String    DEFAULT '',
        fbp           String    DEFAULT '',
        gclid         String    DEFAULT '',
        gbraid        String    DEFAULT '',
        wbraid        String    DEFAULT '',
        ttclid        String    DEFAULT '',
        ttp           String    DEFAULT '',
        msclkid       String    DEFAULT '',
        twclid        String    DEFAULT '',
        -- GA4
        ga_session_id     String DEFAULT '',
        ga_session_number String DEFAULT '',
        -- Compra
        order_id      String    DEFAULT '',
        revenue       Float64   DEFAULT 0,
        currency      LowCardinality(String) DEFAULT 'BRL',
        gateway       LowCardinality(String) DEFAULT '',
        items         String    DEFAULT '[]',
        -- Qualidade da identidade
        match_type    LowCardinality(String) DEFAULT '',
        -- Geo
        country       LowCardinality(String) DEFAULT '',
        region        String    DEFAULT '',
        city          String    DEFAULT '',
        -- Device (derivado do user_agent no backend)
        ip            String    DEFAULT '',
        user_agent    String    DEFAULT '',
        device_type   LowCardinality(String) DEFAULT '',
        os            LowCardinality(String) DEFAULT '',
        browser       LowCardinality(String) DEFAULT '',
        -- Resultado CAPI: -1=não configurado, 0=falhou, 1=ok
        capi_meta     Int8      DEFAULT -1,
        capi_tiktok   Int8      DEFAULT -1,
        capi_ga4      Int8      DEFAULT -1,
        capi_gads     Int8      DEFAULT -1
      ) ENGINE = MergeTree()
      PARTITION BY toYYYYMM(event_time)
      ORDER BY (pixel_id, event_date, channel, utm_campaign, event_time)
    `,
    );

    // nx_user_events — view materializada leve para ML (jornada por usuário)
    // ORDER BY (pixel_id, nx_user, event_time) → queries de atribuição multi-touch
    await this.execAndConsume(
      this.client,
      `
      CREATE TABLE IF NOT EXISTS nx_user_events (
        pixel_id     String,
        nx_user      String,
        event_id     String,
        event_time   DateTime,
        event_name   LowCardinality(String),
        channel      LowCardinality(String) DEFAULT '',
        utm_source   String DEFAULT '',
        utm_medium   String DEFAULT '',
        utm_campaign String DEFAULT '',
        utm_content  String DEFAULT '',
        order_id     String DEFAULT '',
        revenue      Float64 DEFAULT 0,
        match_type   LowCardinality(String) DEFAULT ''
      ) ENGINE = MergeTree()
      PARTITION BY toYYYYMM(event_time)
      ORDER BY (pixel_id, nx_user, event_time)
    `,
    );

    await this.execAndConsume(
      this.client,
      `
      CREATE MATERIALIZED VIEW IF NOT EXISTS nx_user_events_mv
      TO nx_user_events AS
      SELECT
        pixel_id, nx_user, event_id, event_time, event_name,
        channel, utm_source, utm_medium, utm_campaign, utm_content,
        order_id, revenue, match_type
      FROM nx_events
    `,
    );
  }

  // ── Tabelas de ML ─────────────────────────────────────────────────────────────

  private async _ensureMLTables(): Promise<void> {
    // Resultados de modelos de atribuição (Shapley, Markov, linear, last_click)
    // ReplacingMergeTree: dedup por (pixel_id, run_date, model, channel, utm_campaign)
    await this.execAndConsume(
      this.client,
      `
      CREATE TABLE IF NOT EXISTS attribution_results (
        pixel_id               String,
        run_date               Date,
        model                  LowCardinality(String),
        channel                LowCardinality(String),
        utm_campaign           String    DEFAULT '',
        attributed_revenue     Float64   DEFAULT 0,
        attributed_conversions UInt32    DEFAULT 0,
        touchpoints            UInt32    DEFAULT 0,
        computed_at            DateTime  DEFAULT now()
      ) ENGINE = ReplacingMergeTree(computed_at)
      ORDER BY (pixel_id, run_date, model, channel, utm_campaign)
      PARTITION BY toYYYYMM(run_date)
    `,
    );

    // Predições de LTV e churn por usuário (pipeline Python semanal)
    await this.execAndConsume(
      this.client,
      `
      CREATE TABLE IF NOT EXISTS user_predictions (
        pixel_id     String,
        nx_user      String,
        run_date     Date,
        ltv_90       Float64  DEFAULT 0,
        ltv_180      Float64  DEFAULT 0,
        ltv_365      Float64  DEFAULT 0,
        churn_prob   Float32  DEFAULT 0,
        frequency    UInt32   DEFAULT 0,
        recency      UInt32   DEFAULT 0,
        predicted_at DateTime DEFAULT now()
      ) ENGINE = ReplacingMergeTree(predicted_at)
      ORDER BY (pixel_id, nx_user, run_date)
      PARTITION BY toYYYYMM(run_date)
    `,
    );

    // Log de anomalias detectadas pelo pipeline de monitoramento
    await this.execAndConsume(
      this.client,
      `
      CREATE TABLE IF NOT EXISTS anomaly_log (
        pixel_id    String,
        metric      LowCardinality(String),
        value       Float64  DEFAULT 0,
        expected    Float64  DEFAULT 0,
        z_score     Float64  DEFAULT 0,
        severity    LowCardinality(String) DEFAULT 'warning',
        detected_at DateTime DEFAULT now()
      ) ENGINE = MergeTree()
      ORDER BY (pixel_id, detected_at, metric)
      PARTITION BY toYYYYMM(detected_at)
    `,
    );
  }

  // ── Tabelas de gasto em anúncios (sync diário via jobs service) ───────────────

  private async _ensureAdSpendTables(): Promise<void> {
    await this.execAndConsume(
      this.client,
      `
      CREATE TABLE IF NOT EXISTS nx_meta_ads (
        pixel_id      String,
        ad_date       Date,
        account_id    String    DEFAULT '',
        campaign_id   String    DEFAULT '',
        campaign_name String    DEFAULT '',
        adset_id      String    DEFAULT '',
        ad_id         String    DEFAULT '',
        spend         Float64   DEFAULT 0,
        impressions   UInt64    DEFAULT 0,
        clicks        UInt64    DEFAULT 0,
        conversions   UInt64    DEFAULT 0,
        synced_at     DateTime  DEFAULT now()
      ) ENGINE = ReplacingMergeTree(synced_at)
      ORDER BY (pixel_id, ad_date, campaign_id, adset_id, ad_id)
      PARTITION BY toYYYYMM(ad_date)
    `,
    );

    await this.execAndConsume(
      this.client,
      `
      CREATE TABLE IF NOT EXISTS nx_tiktok_ads (
        pixel_id      String,
        ad_date       Date,
        account_id    String    DEFAULT '',
        campaign_id   String    DEFAULT '',
        campaign_name String    DEFAULT '',
        adgroup_id    String    DEFAULT '',
        ad_id         String    DEFAULT '',
        spend         Float64   DEFAULT 0,
        impressions   UInt64    DEFAULT 0,
        clicks        UInt64    DEFAULT 0,
        conversions   UInt64    DEFAULT 0,
        plays         UInt64    DEFAULT 0,
        synced_at     DateTime  DEFAULT now()
      ) ENGINE = ReplacingMergeTree(synced_at)
      ORDER BY (pixel_id, ad_date, campaign_id, adgroup_id, ad_id)
      PARTITION BY toYYYYMM(ad_date)
    `,
    );

    await this.execAndConsume(
      this.client,
      `
      CREATE TABLE IF NOT EXISTS nx_google_ads (
        pixel_id      String,
        ad_date       Date,
        customer_id   String    DEFAULT '',
        campaign_id   String    DEFAULT '',
        campaign_name String    DEFAULT '',
        adgroup_id    String    DEFAULT '',
        spend         Float64   DEFAULT 0,
        impressions   UInt64    DEFAULT 0,
        clicks        UInt64    DEFAULT 0,
        conversions   UInt64    DEFAULT 0,
        synced_at     DateTime  DEFAULT now()
      ) ENGINE = ReplacingMergeTree(synced_at)
      ORDER BY (pixel_id, ad_date, campaign_id, adgroup_id)
      PARTITION BY toYYYYMM(ad_date)
    `,
    );
  }

  // ── Tabelas de agregação (SummingMergeTree) ───────────────────────────────────
  //
  // Cada SummingMergeTree reduz queries de dashboard de O(eventos) para O(dias).
  // Custo: ~0 — materialized views atualizam automaticamente em cada INSERT.

  private async _ensureAggregates(): Promise<void> {
    // Receita diária total (legado — mantido para compatibilidade)
    await this.execAndConsume(
      this.client,
      `
      CREATE TABLE IF NOT EXISTS events_daily_revenue (
        pixel_id   String,
        event_date Date,
        revenue    Float64,
        sales      UInt64
      ) ENGINE = SummingMergeTree((revenue, sales))
      ORDER BY (pixel_id, event_date)
      PARTITION BY toYYYYMM(event_date)
    `,
    );

    await this.execAndConsume(
      this.client,
      `
      CREATE MATERIALIZED VIEW IF NOT EXISTS events_daily_revenue_mv
      TO events_daily_revenue AS
      SELECT
        pixel_id,
        toDate(event_time) AS event_date,
        SUM(value)         AS revenue,
        COUNT()            AS sales
      FROM events
      WHERE event_type = 'Purchase'
      GROUP BY pixel_id, event_date
    `,
    );

    // Receita diária por gateway de pagamento (legado)
    await this.execAndConsume(
      this.client,
      `
      CREATE TABLE IF NOT EXISTS events_daily_payment (
        pixel_id         String,
        event_date       Date,
        payment_gateway  LowCardinality(String),
        revenue          Float64,
        sales            UInt64
      ) ENGINE = SummingMergeTree((revenue, sales))
      ORDER BY (pixel_id, event_date, payment_gateway)
      PARTITION BY toYYYYMM(event_date)
    `,
    );

    await this.execAndConsume(
      this.client,
      `
      CREATE MATERIALIZED VIEW IF NOT EXISTS events_daily_payment_mv
      TO events_daily_payment AS
      SELECT
        pixel_id,
        toDate(event_time)                                 AS event_date,
        JSONExtractString(custom_data, 'payment_gateway')  AS payment_gateway,
        SUM(value)                                         AS revenue,
        COUNT()                                            AS sales
      FROM events
      WHERE event_type = 'Purchase'
      GROUP BY pixel_id, event_date, payment_gateway
    `,
    );

    // ── Novos agregados para nx_events ────────────────────────────────────────

    // Receita diária por canal (substitui UTM JOIN para dashboard principal)
    await this.execAndConsume(
      this.client,
      `
      CREATE TABLE IF NOT EXISTS nx_daily_channel (
        pixel_id   String,
        event_date Date,
        channel    LowCardinality(String),
        revenue    Float64,
        sales      UInt64,
        events_count UInt64
      ) ENGINE = SummingMergeTree((revenue, sales, events_count))
      ORDER BY (pixel_id, event_date, channel)
      PARTITION BY toYYYYMM(event_date)
    `,
    );

    await this.execAndConsume(
      this.client,
      `
      CREATE MATERIALIZED VIEW IF NOT EXISTS nx_daily_channel_mv
      TO nx_daily_channel AS
      SELECT
        pixel_id,
        event_date,
        channel,
        sumIf(revenue, event_name = 'Purchase') AS revenue,
        countIf(event_name = 'Purchase')        AS sales,
        count()                                 AS events_count
      FROM nx_events
      GROUP BY pixel_id, event_date, channel
    `,
    );

    // Receita diária por campanha
    await this.execAndConsume(
      this.client,
      `
      CREATE TABLE IF NOT EXISTS nx_daily_campaign (
        pixel_id     String,
        event_date   Date,
        channel      LowCardinality(String),
        utm_campaign String,
        utm_source   String,
        revenue      Float64,
        sales        UInt64
      ) ENGINE = SummingMergeTree((revenue, sales))
      ORDER BY (pixel_id, event_date, channel, utm_campaign)
      PARTITION BY toYYYYMM(event_date)
    `,
    );

    await this.execAndConsume(
      this.client,
      `
      CREATE MATERIALIZED VIEW IF NOT EXISTS nx_daily_campaign_mv
      TO nx_daily_campaign AS
      SELECT
        pixel_id,
        event_date,
        channel,
        utm_campaign,
        utm_source,
        sumIf(revenue, event_name = 'Purchase')  AS revenue,
        countIf(event_name = 'Purchase')         AS sales
      FROM nx_events
      GROUP BY pixel_id, event_date, channel, utm_campaign, utm_source
    `,
    );
  }

  // ── Views analíticas ──────────────────────────────────────────────────────────

  private async _ensureViews(): Promise<void> {
    // Visão geral diária: receita, conversões, usuários únicos por canal
    await this.execAndConsume(
      this.client,
      `
      CREATE OR REPLACE VIEW v_nx_overview AS
      SELECT
        pixel_id,
        event_date,
        channel,
        round(sumIf(revenue, event_name = 'Purchase'), 2)   AS revenue,
        countIf(event_name = 'Purchase')                    AS conversions,
        uniqIf(nx_user, event_name = 'Purchase')            AS unique_buyers,
        count()                                             AS total_events
      FROM nx_events
      GROUP BY pixel_id, event_date, channel
      ORDER BY pixel_id, event_date DESC
    `,
    );

    // Funil de conversão
    await this.execAndConsume(
      this.client,
      `
      CREATE OR REPLACE VIEW v_nx_funnel AS
      SELECT
        pixel_id,
        event_date,
        countIf(event_name IN ('PageView', 'ViewContent')) AS pageviews,
        countIf(event_name = 'AddToCart')                  AS add_to_cart,
        countIf(event_name = 'InitiateCheckout')           AS checkout,
        countIf(event_name = 'Purchase')                   AS purchases,
        uniqIf(nx_user, event_name = 'Purchase')           AS unique_buyers
      FROM nx_events
      GROUP BY pixel_id, event_date
    `,
    );

    await this.execAndConsume(
      this.client,
      `
      CREATE OR REPLACE VIEW v_nx_top_campaigns AS
      SELECT
        pixel_id,
        channel,
        utm_campaign,
        utm_source,
        round(SUM(revenue), 2)  AS revenue,
        SUM(sales)              AS conversions
      FROM nx_daily_campaign
      WHERE event_date >= toDate(now() - INTERVAL 30 DAY)
      GROUP BY pixel_id, channel, utm_campaign, utm_source
      ORDER BY revenue DESC
      LIMIT 30
    `,
    );

    // Cobertura de sinais e CAPI
    await this.execAndConsume(
      this.client,
      `
      CREATE OR REPLACE VIEW v_nx_signal_coverage AS
      SELECT
        pixel_id,
        event_date,
        countIf(event_name = 'Purchase')                             AS total_purchases,
        round(100 * countIf(fbp != '')       / count(), 1)          AS pct_fbp,
        round(100 * countIf(ttp != '')       / count(), 1)          AS pct_ttp,
        round(100 * countIf(gclid != '')     / count(), 1)          AS pct_gclid,
        round(100 * countIf(capi_meta = 1)   / greatest(countIf(capi_meta != -1), 1), 1) AS capi_meta_rate,
        round(100 * countIf(capi_tiktok = 1) / greatest(countIf(capi_tiktok != -1), 1), 1) AS capi_tiktok_rate,
        round(100 * countIf(capi_ga4 = 1)    / greatest(countIf(capi_ga4 != -1), 1), 1) AS capi_ga4_rate
      FROM nx_events
      WHERE event_name = 'Purchase'
      GROUP BY pixel_id, event_date
    `,
    );

    // Qualidade da correspondência de identidade
    await this.execAndConsume(
      this.client,
      `
      CREATE OR REPLACE VIEW v_nx_match_quality AS
      SELECT
        pixel_id,
        event_date,
        match_type,
        count()                  AS conversions,
        round(SUM(revenue), 2)   AS revenue
      FROM nx_events
      WHERE event_name = 'Purchase'
      GROUP BY pixel_id, event_date, match_type
    `,
    );

    // Performance por dispositivo
    await this.execAndConsume(
      this.client,
      `
      CREATE OR REPLACE VIEW v_nx_device AS
      SELECT
        pixel_id,
        event_date,
        device_type,
        os,
        browser,
        countIf(event_name = 'Purchase')      AS conversions,
        round(sumIf(revenue, event_name = 'Purchase'), 2) AS revenue
      FROM nx_events
      GROUP BY pixel_id, event_date, device_type, os, browser
    `,
    );

    // Performance geográfica
    await this.execAndConsume(
      this.client,
      `
      CREATE OR REPLACE VIEW v_nx_geo AS
      SELECT
        pixel_id,
        event_date,
        country,
        region,
        city,
        countIf(event_name = 'Purchase')      AS conversions,
        round(sumIf(revenue, event_name = 'Purchase'), 2) AS revenue
      FROM nx_events
      GROUP BY pixel_id, event_date, country, region, city
    `,
    );
  }

  // ── Backfill ──────────────────────────────────────────────────────────────────

  private async _backfillAll(): Promise<void> {
    await this._backfillLegacyAggregates();
    await this._backfillNxEventsFromLegacy();
  }

  private async _backfillLegacyAggregates(): Promise<void> {
    const [revCount] = await this.query<{ c: string }>(
      `SELECT count() AS c FROM events_daily_revenue`,
    );
    if (parseInt(revCount?.c ?? '0', 10) > 0) return;

    const [evCount] = await this.query<{ c: string }>(
      `SELECT count() AS c FROM events WHERE event_type = 'Purchase'`,
    );
    if (parseInt(evCount?.c ?? '0', 10) === 0) return;

    this.logger.log('Backfill: preenchendo agregados legados...');

    await this.execAndConsume(
      this.client,
      `
      INSERT INTO events_daily_revenue
      SELECT pixel_id, toDate(event_time) AS event_date, SUM(value) AS revenue, COUNT() AS sales
      FROM events WHERE event_type = 'Purchase'
      GROUP BY pixel_id, event_date
    `,
    );

    await this.execAndConsume(
      this.client,
      `
      INSERT INTO events_daily_payment
      SELECT
        pixel_id,
        toDate(event_time) AS event_date,
        JSONExtractString(custom_data, 'payment_gateway') AS payment_gateway,
        SUM(value) AS revenue, COUNT() AS sales
      FROM events WHERE event_type = 'Purchase'
      GROUP BY pixel_id, event_date, payment_gateway
    `,
    );

    this.logger.log('Backfill: agregados legados prontos ✓');
  }

  // Migra dados históricos de events+leads para nx_events via JOIN.
  // Só roda uma vez (nx_events vazio + events tem dados).
  private async _backfillNxEventsFromLegacy(): Promise<void> {
    const [nxCount] = await this.query<{ c: string }>(
      `SELECT count() AS c FROM nx_events`,
    );
    if (parseInt(nxCount?.c ?? '0', 10) > 0) return;

    const [evCount] = await this.query<{ c: string }>(
      `SELECT count() AS c FROM events`,
    );
    if (parseInt(evCount?.c ?? '0', 10) === 0) return;

    this.logger.log(
      'Backfill: migrando events+leads → nx_events (pode demorar)...',
    );

    await this.execAndConsume(
      this.client,
      `
      INSERT INTO nx_events
      SELECT
        e.pixel_id                                                    AS pixel_id,
        e.id                                                          AS event_id,
        coalesce(nullIf(e.lead_id, ''), e.id)                        AS nx_user,
        ''                                                            AS session_id,
        e.event_type                                                  AS event_name,
        e.event_time                                                  AS event_time,
        coalesce(e.source_url, '')                                    AS page_url,
        coalesce(e.referrer,   '')                                    AS referrer,
        coalesce(l.utm_source,      '')                               AS utm_source,
        coalesce(l.utm_medium,      '')                               AS utm_medium,
        coalesce(l.utm_campaign,    '')                               AS utm_campaign,
        coalesce(l.utm_content,     '')                               AS utm_content,
        coalesce(l.utm_term,        '')                               AS utm_term,
        coalesce(l.utm_id,          '')                               AS utm_id,
        coalesce(l.utm_platform,    '')                               AS utm_platform,
        coalesce(l.utm_network,     '')                               AS utm_network,
        coalesce(l.ad_id,           '')                               AS ad_id,
        coalesce(l.adset_id,        '')                               AS adset_id,
        coalesce(l.campaign_id,     '')                               AS campaign_id,
        coalesce(l.placement,       '')                               AS placement,
        coalesce(l.creative_format, '')                               AS creative_format,
        coalesce(l.conversion_type, '')                               AS conversion_type,
        multiIf(
          l.utm_source LIKE '%facebook%' OR l.utm_source LIKE '%instagram%', 'paid_social_meta',
          l.utm_source LIKE '%tiktok%',                                       'paid_social_tiktok',
          l.utm_source LIKE '%google%' AND l.utm_medium = 'cpc',             'paid_search_google',
          l.utm_medium = 'email',                                             'email',
          l.utm_medium = 'organic',                                           'organic_search',
          l.utm_source = '' AND l.utm_medium = '',                           'direct',
          'other'
        )                                                             AS channel,
        ''  AS fbclid, coalesce(l.fbc,   '') AS fbc,
        coalesce(l.fbp,   '') AS fbp,
        coalesce(l.gclid,   '') AS gclid,
        coalesce(l.gbraid,  '') AS gbraid,
        coalesce(l.wbraid,  '') AS wbraid,
        coalesce(l.ttclid,  '') AS ttclid,
        coalesce(l.ttp,     '') AS ttp,
        '' AS msclkid, '' AS twclid,
        '' AS ga_session_id, '' AS ga_session_number,
        coalesce(nullIf(JSONExtractString(e.custom_data, 'order_id'), ''), '') AS order_id,
        e.value                                                       AS revenue,
        e.currency                                                    AS currency,
        coalesce(nullIf(JSONExtractString(e.custom_data, 'payment_gateway'), ''), '') AS gateway,
        '[]'                                                          AS items,
        ''                                                            AS match_type,
        coalesce(l.country, '') AS country,
        coalesce(l.state,   '') AS region,
        coalesce(l.city,    '') AS city,
        coalesce(e.ip,          '') AS ip,
        coalesce(e.user_agent,  '') AS user_agent,
        ''  AS device_type, '' AS os, '' AS browser,
        toInt8(-1) AS capi_meta, toInt8(-1) AS capi_tiktok,
        toInt8(-1) AS capi_ga4,  toInt8(-1) AS capi_gads
      FROM events e
      LEFT JOIN leads l ON l.id = e.lead_id AND l.pixel_id = e.pixel_id
    `,
    );

    this.logger.log('Backfill: nx_events populado ✓');
  }

  // ── Migrações legadas de schema (camelCase → snake_case) ──────────────────────

  private async _migrateEventsTableIfNeeded(): Promise<void> {
    const [row] = await this.query<{ count: string }>(
      `SELECT count() AS count FROM system.columns
       WHERE database = currentDatabase() AND table = 'events' AND name = 'pixelId'`,
    );
    if (parseInt(row?.count ?? '0', 10) === 0) return;

    this.logger.warn(
      'events: schema camelCase detectado — recriando com snake_case...',
    );

    const colRows = await this.query<{ name: string }>(
      `SELECT name FROM system.columns WHERE database = currentDatabase() AND table = 'events'`,
    );
    const cols = new Set(colRows.map((r) => r.name));
    const col = (snake: string, aliases: string[], fallback = `''`) => {
      if (cols.has(snake)) return snake;
      for (const a of aliases) if (cols.has(a)) return a;
      return fallback;
    };

    await this.execAndConsume(this.client, `DROP TABLE IF EXISTS events_v2`);
    await this.execAndConsume(
      this.client,
      `
      CREATE TABLE IF NOT EXISTS events_v2 (
        id String, lead_id String DEFAULT '', pixel_id String, event_type String,
        source_url String DEFAULT '', page_title String DEFAULT '',
        referrer String DEFAULT '', ip String DEFAULT '', user_agent String DEFAULT '',
        fbc String DEFAULT '', fbp String DEFAULT '',
        value Float64 DEFAULT 0, currency String DEFAULT 'BRL',
        content_type String DEFAULT 'product', custom_data String DEFAULT '',
        event_time DateTime, created_at DateTime DEFAULT now()
      ) ENGINE = MergeTree()
      ORDER BY (pixel_id, event_time, event_type)
      PARTITION BY toYYYYMM(event_time)
      TTL event_time + INTERVAL 1 YEAR
    `,
    );
    await this.execAndConsume(
      this.client,
      `
      INSERT INTO events_v2 SELECT
        id,
        ${col('lead_id', ['leadId', 'visitorId'])}   AS lead_id,
        ${col('pixel_id', ['pixelId'])}               AS pixel_id,
        ${col('event_type', ['eventType'])}             AS event_type,
        ${col('source_url', ['sourceUrl', 'url'])}      AS source_url,
        ${col('page_title', ['pageTitle'])}             AS page_title,
        ${cols.has('referrer') ? 'referrer' : "''"}      AS referrer,
        ${col('ip', ['ipAddress', 'ip'])}       AS ip,
        ${col('user_agent', ['userAgent'])}             AS user_agent,
        ${cols.has('fbc') ? 'fbc' : "''"}               AS fbc,
        ${cols.has('fbp') ? 'fbp' : "''"}               AS fbp,
        ${cols.has('value') ? 'value' : '0'}       AS value,
        ${cols.has('currency') ? 'currency' : "'BRL'"}   AS currency,
        ${col('content_type', ['contentType'], "'product'")} AS content_type,
        ${col('custom_data', ['customData'], "''")}     AS custom_data,
        ${col('event_time', ['eventTime', 'timestamp'], 'now()')} AS event_time,
        ${col('created_at', ['createdAt'], 'now()')}  AS created_at
      FROM events
    `,
    );
    await this.execAndConsume(this.client, `DROP TABLE events`);
    await this.execAndConsume(this.client, `RENAME TABLE events_v2 TO events`);
    this.logger.log('events migração camelCase → snake_case concluída ✓');
  }

  private async _migrateLeadsTableIfNeeded(): Promise<void> {
    const [row] = await this.query<{ count: string }>(
      `SELECT count() AS count FROM system.columns
       WHERE database = currentDatabase() AND table = 'leads' AND name = 'pixelId'`,
    );
    if (parseInt(row?.count ?? '0', 10) === 0) return;

    this.logger.warn('leads: schema camelCase detectado — recriando...');

    const colRows = await this.query<{ name: string }>(
      `SELECT name FROM system.columns WHERE database = currentDatabase() AND table = 'leads'`,
    );
    const cols = new Set(colRows.map((r) => r.name));
    const c = (snake: string, camel: string, fallback = `''`) =>
      cols.has(snake) ? snake : cols.has(camel) ? camel : fallback;

    const allCols = [
      'id',
      'email',
      'phone',
      'first_name',
      'last_name',
      'ip',
      'ipv6',
      'user_agent',
      'fbc',
      'fbp',
      'gclid',
      'gbraid',
      'wbraid',
      'ttclid',
      'ttp',
      'country',
      'state',
      'city',
      'zipcode',
      'parameters',
      'meta_pixel_ids',
      'tiktok_pixel_ids',
      'external_id',
      'gender',
      'date_of_birth',
      'cart_token',
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_content',
      'utm_term',
      'utm_id',
      'utm_platform',
      'utm_network',
      'placement',
      'creative_format',
      'ad_id',
      'adset_id',
      'campaign_id',
      'conversion_type',
      'created_at',
      'updated_at',
    ];
    const mapping = allCols.map((s) => {
      const camel = s.replace(/_([a-z])/g, (_, l) => l.toUpperCase());
      return `${c(s, camel)} AS ${s}`;
    });
    mapping.push(`${c('pixel_id', 'pixelId')} AS pixel_id`);

    await this.execAndConsume(this.client, `DROP TABLE IF EXISTS leads_v2`);
    await this.execAndConsume(
      this.client,
      `
      CREATE TABLE IF NOT EXISTS leads_v2 (
        id String, pixel_id String,
        email String DEFAULT '', phone String DEFAULT '',
        first_name String DEFAULT '', last_name String DEFAULT '',
        ip String DEFAULT '', ipv6 String DEFAULT '',
        user_agent String DEFAULT '', fbc String DEFAULT '', fbp String DEFAULT '',
        gclid String DEFAULT '', gbraid String DEFAULT '', wbraid String DEFAULT '',
        ttclid String DEFAULT '', ttp String DEFAULT '',
        country String DEFAULT '', state String DEFAULT '',
        city String DEFAULT '', zipcode String DEFAULT '',
        parameters String DEFAULT '',
        meta_pixel_ids Array(String), tiktok_pixel_ids Array(String),
        external_id String DEFAULT '', gender String DEFAULT '',
        date_of_birth String DEFAULT '', cart_token String DEFAULT '',
        utm_source String DEFAULT '', utm_medium String DEFAULT '',
        utm_campaign String DEFAULT '', utm_content String DEFAULT '',
        utm_term String DEFAULT '', utm_id String DEFAULT '',
        utm_platform String DEFAULT '', utm_network String DEFAULT '',
        placement String DEFAULT '', creative_format String DEFAULT '',
        ad_id String DEFAULT '', adset_id String DEFAULT '',
        campaign_id String DEFAULT '', conversion_type String DEFAULT '',
        created_at DateTime DEFAULT now(), updated_at DateTime DEFAULT now()
      ) ENGINE = ReplacingMergeTree(updated_at)
      ORDER BY (pixel_id, id)
    `,
    );
    await this.execAndConsume(
      this.client,
      `
      INSERT INTO leads_v2 SELECT ${mapping.join(', ')} FROM leads
    `,
    );
    await this.execAndConsume(this.client, `DROP TABLE leads`);
    await this.execAndConsume(this.client, `RENAME TABLE leads_v2 TO leads`);
    this.logger.log('leads migração camelCase → snake_case concluída ✓');
  }

  // ── Utilitário: consome o stream retornado por exec() para evitar vazamento ───

  private async execAndConsume(
    client: ClickHouseClient,
    query: string,
  ): Promise<void> {
    const { stream } = await client.exec({ query });
    return new Promise((resolve, reject) => {
      stream.on('data', () => {});
      stream.on('end', resolve);
      stream.on('error', reject);
    });
  }
}
