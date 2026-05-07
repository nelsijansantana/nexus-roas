import { Injectable, Logger, NotFoundException, UnauthorizedException, BadGatewayException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

const GOOGLE_ADS_API_BASE = 'https://googleads.googleapis.com/v18';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const OAUTH_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';

const SESSION_TTL = 15 * 60; // 15 min

export interface GoogleAdsSessionData {
  accessToken: string;
  refreshToken: string;
  projectId: string;
  userId: string;
}

export interface GoogleAdsAccount {
  customerId: string;
  name: string;
  resourceName: string;
}

export interface GoogleAdsConversionAction {
  id: string;
  name: string;
  resourceName: string;
  label: string; // last segment of resourceName
}

export interface GoogleAdsEventMapping {
  label?: string;
  actionResource?: string;
}

@Injectable()
export class GoogleAdsService {
  private readonly logger = new Logger(GoogleAdsService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  // ─── OAuth helpers ─────────────────────────────────────────────────────────

  private get clientId(): string {
    return this.config.get<string>('GOOGLE_ADS_CLIENT_ID') ?? '';
  }

  private get clientSecret(): string {
    return this.config.get<string>('GOOGLE_ADS_CLIENT_SECRET') ?? '';
  }

  private get developerToken(): string {
    return this.config.get<string>('GOOGLE_ADS_DEVELOPER_TOKEN') ?? '';
  }

  private get redirectUri(): string {
    const api = this.config.get<string>('API_URL', 'http://localhost:3000');
    return `${api}/api/v1/integrations/google-ads/callback`;
  }

  private get frontendUrl(): string {
    return this.config.get<string>('FRONTEND_URL', 'http://localhost:5173');
  }

  // ─── Auth URL ──────────────────────────────────────────────────────────────

  getAuthUrl(projectId: string, userId: string): string {
    if (!this.clientId) {
      throw new Error('GOOGLE_ADS_CLIENT_ID not configured');
    }
    const state = Buffer.from(JSON.stringify({ projectId, userId })).toString('base64url');
    const params = new URLSearchParams({
      client_id:     this.clientId,
      redirect_uri:  this.redirectUri,
      response_type: 'code',
      scope:         'https://www.googleapis.com/auth/adwords',
      access_type:   'offline',
      prompt:        'consent',   // force consent screen to get refresh_token every time
      state,
    });
    return `${OAUTH_AUTH_ENDPOINT}?${params.toString()}`;
  }

  // ─── Callback ─────────────────────────────────────────────────────────────

  async handleCallback(code: string, state: string): Promise<{ redirectUrl: string }> {
    // Parse state
    let projectId: string;
    let userId: string;
    try {
      const parsed = JSON.parse(Buffer.from(state, 'base64url').toString());
      projectId = parsed.projectId;
      userId    = parsed.userId;
    } catch {
      throw new UnauthorizedException('Invalid state parameter');
    }

    // Exchange code for tokens
    const tokenRes = await fetch(TOKEN_ENDPOINT, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id:     this.clientId,
        client_secret: this.clientSecret,
        redirect_uri:  this.redirectUri,
        grant_type:    'authorization_code',
      }).toString(),
    });

    if (!tokenRes.ok) {
      const text = await tokenRes.text();
      this.logger.warn(`[GoogleAds] Token exchange failed ${tokenRes.status}: ${text}`);
      throw new UnauthorizedException('Google token exchange failed');
    }

    const tokens = await tokenRes.json() as { access_token: string; refresh_token: string };

    if (!tokens.refresh_token) {
      // Should not happen because prompt=consent, but guard anyway
      throw new UnauthorizedException('Google did not return refresh_token. Try revoking access at myaccount.google.com/permissions and reconnecting.');
    }

    // Store session in Redis
    const sessionId = randomUUID();
    const session: GoogleAdsSessionData = {
      accessToken:  tokens.access_token,
      refreshToken: tokens.refresh_token,
      projectId,
      userId,
    };
    await this.redis.setJSON(`google_ads_session:${sessionId}`, session, SESSION_TTL);

    const redirectUrl = `${this.frontendUrl}/integrations/google-ads?session=${sessionId}&projectId=${projectId}`;
    return { redirectUrl };
  }

  // ─── Session helpers ───────────────────────────────────────────────────────

  async getSession(sessionId: string): Promise<GoogleAdsSessionData> {
    const session = await this.redis.getJSON<GoogleAdsSessionData>(`google_ads_session:${sessionId}`);
    if (!session) {
      throw new UnauthorizedException('Session expired or invalid. Please reconnect Google Ads.');
    }
    return session;
  }

  // ─── List accessible accounts ─────────────────────────────────────────────

  async listAccounts(sessionId: string): Promise<GoogleAdsAccount[]> {
    const session = await this.getSession(sessionId);

    if (!this.developerToken) {
      throw new BadRequestException('GOOGLE_ADS_DEVELOPER_TOKEN não configurado no servidor.');
    }

    const url = `${GOOGLE_ADS_API_BASE}/customers:listAccessibleCustomers`;
    this.logger.log(`[GoogleAds] GET ${url}`);

    const res = await fetch(url, {
      headers: {
        'Authorization':   `Bearer ${session.accessToken}`,
        'developer-token': this.developerToken,
      },
    });

    if (!res.ok) {
      const text = await res.text();
      this.logger.error(`[GoogleAds] listAccessibleCustomers ${res.status}: ${text}`);

      // Parse Google error for a friendlier message
      let reason = `status ${res.status}`;
      try {
        const parsed = JSON.parse(text);
        reason = parsed?.error?.message || parsed?.error?.status || reason;
      } catch { /* keep default */ }

      throw new BadGatewayException(`Erro ao listar contas Google Ads: ${reason}`);
    }

    const data = await res.json() as { resourceNames?: string[] };
    const resourceNames: string[] = data.resourceNames ?? [];

    if (resourceNames.length === 0) return [];

    // Fetch display name for each customer (best-effort — fallback to ID on any error)
    const accounts = await Promise.all(
      resourceNames.map(async (rn): Promise<GoogleAdsAccount> => {
        const customerId = rn.replace('customers/', '');
        try {
          const infoRes = await fetch(
            `${GOOGLE_ADS_API_BASE}/customers/${customerId}/googleAds:search`,
            {
              method:  'POST',
              headers: {
                'Authorization':     `Bearer ${session.accessToken}`,
                'developer-token':   this.developerToken,
                'login-customer-id': customerId,
                'Content-Type':      'application/json',
              },
              body: JSON.stringify({
                query: 'SELECT customer.id, customer.descriptive_name FROM customer LIMIT 1',
              }),
            },
          );
          if (!infoRes.ok) return { customerId, name: customerId, resourceName: rn };
          const infoData = await infoRes.json() as { results?: Array<{ customer: { id: string; descriptiveName?: string } }> };
          const name = infoData.results?.[0]?.customer?.descriptiveName ?? customerId;
          return { customerId, name, resourceName: rn };
        } catch {
          return { customerId, name: customerId, resourceName: rn };
        }
      }),
    );

    return accounts;
  }

  // ─── List conversion actions ───────────────────────────────────────────────

  async listConversionActions(sessionId: string, customerId: string): Promise<GoogleAdsConversionAction[]> {
    const session = await this.getSession(sessionId);

    const res = await fetch(
      `${GOOGLE_ADS_API_BASE}/customers/${customerId}/googleAds:search`,
      {
        method:  'POST',
        headers: {
          'Authorization':     `Bearer ${session.accessToken}`,
          'developer-token':   this.developerToken,
          'login-customer-id': customerId,
          'Content-Type':      'application/json',
        },
        body: JSON.stringify({
          query: `SELECT conversion_action.id, conversion_action.name, conversion_action.resource_name
                  FROM conversion_action
                  WHERE conversion_action.status != 'REMOVED'
                  ORDER BY conversion_action.name ASC`,
        }),
      },
    );

    if (!res.ok) {
      const text = await res.text();
      this.logger.error(`[GoogleAds] listConversionActions ${res.status}: ${text}`);
      let reason = `status ${res.status}`;
      try {
        const parsed = JSON.parse(text);
        reason = parsed?.error?.message || parsed?.error?.status || reason;
      } catch { /* keep default */ }
      throw new BadGatewayException(`Erro ao listar conversões Google Ads: ${reason}`);
    }

    const data = await res.json() as {
      results?: Array<{
        conversionAction: { id: string; name: string; resourceName: string };
      }>
    };

    return (data.results ?? []).map((r) => {
      const parts = r.conversionAction.resourceName.split('/');
      const label = parts[parts.length - 1] ?? r.conversionAction.id;
      return {
        id:           r.conversionAction.id,
        name:         r.conversionAction.name,
        resourceName: r.conversionAction.resourceName,
        label,
      };
    });
  }

  // ─── Connect (save integration + sync KV) ─────────────────────────────────

  async connect(params: {
    sessionId: string;
    projectId: string;
    customerId: string;
    conversionId: string;
    events: Record<string, { label?: string; actionResource?: string }>;
  }): Promise<void> {
    const { sessionId, projectId, customerId, conversionId, events } = params;
    const session = await this.getSession(sessionId);

    // Verify project exists
    const project = await (this.prisma.projects as any).findFirst({
      where: { id: projectId, deletedAt: null },
    });
    if (!project) throw new NotFoundException('Project not found');

    // Map frontend actionResource keys to snake_case for KV/Worker compatibility
    const eventsForKV: Record<string, { label?: string; action_resource?: string }> = {};
    for (const [eventName, mapping] of Object.entries(events)) {
      eventsForKV[eventName] = {
        ...(mapping.label        ? { label: mapping.label }                       : {}),
        ...(mapping.actionResource ? { action_resource: mapping.actionResource }  : {}),
      };
    }

    // Upsert integration record
    const existing = await (this.prisma.integrations as any).findFirst({
      where: { projectId, type: 'google_ads' },
    });

    const configData = {
      conversionId,
      customerId,
      refreshToken: session.refreshToken,
      events: eventsForKV,
    };

    if (existing) {
      await (this.prisma.integrations as any).update({
        where: { id: existing.id },
        data: { config: configData as any, isActive: true, updatedAt: new Date() },
      });
    } else {
      await (this.prisma.integrations as any).create({
        data: {
          id:        randomUUID(),
          projectId,
          type:      'google_ads',
          config:    configData as any,
          isActive:  true,
        },
      });
    }

    // Sync KV so the Worker picks up the new config immediately
    await this._syncProjectKV(project);

    // Invalidate Redis session after successful connect
    await this.redis.del(`google_ads_session:${sessionId}`);
  }

  // ─── Disconnect ────────────────────────────────────────────────────────────

  async disconnect(projectId: string): Promise<void> {
    const project = await (this.prisma.projects as any).findFirst({
      where: { id: projectId, deletedAt: null },
    });
    if (!project) throw new NotFoundException('Project not found');

    await (this.prisma.integrations as any).deleteMany({
      where: { projectId, type: 'google_ads' },
    });

    await this._syncProjectKV(project);
  }

  // ─── Get integration status ────────────────────────────────────────────────

  async getIntegration(projectId: string): Promise<{ connected: boolean; customerId?: string; conversionId?: string; events?: Record<string, any> }> {
    const integration = await (this.prisma.integrations as any).findFirst({
      where: { projectId, type: 'google_ads', isActive: true },
    });

    if (!integration) return { connected: false };

    const cfg = integration.config as any;
    return {
      connected:    true,
      customerId:   cfg.customerId,
      conversionId: cfg.conversionId,
      events:       cfg.events,
    };
  }

  // ─── KV sync (subset of projects.service _syncKV logic) ───────────────────
  // We do a targeted KV update by reading the full project + integration and
  // re-writing the site_config key. Avoids circular dependency on ProjectsService.

  async _syncProjectKV(project: any): Promise<void> {
    const accountId   = this.config.get<string>('CF_ACCOUNT_ID');
    const namespaceId = this.config.get<string>('CF_KV_NAMESPACE_ID');
    const apiToken    = this.config.get<string>('CF_API_TOKEN');
    if (!accountId || !namespaceId || !apiToken) return;

    const apiUrl = this.config.get<string>('API_URL', 'http://localhost:3000');

    // Fetch triggers
    let triggers: any[] = [];
    try {
      triggers = await (this.prisma as any).pixel_events.findMany({
        where:   { projectId: project.id, isActive: true },
        orderBy: { createdAt: 'asc' },
        select:  { id: true, eventName: true, triggerType: true, selector: true, buttonText: true, scrollDepth: true, timeSeconds: true, customData: true },
      }) ?? [];
    } catch { /* non-fatal */ }

    // Fetch google_ads integration
    const gadsIntegration = await (this.prisma.integrations as any).findFirst({
      where: { projectId: project.id, type: 'google_ads', isActive: true },
    });
    const gadsCfg = gadsIntegration?.config as any ?? null;

    const siteConfig: Record<string, any> = {
      pixel_id: project.pixelId,
      nexus: {
        pixel_id:   project.pixelId,
        ingest_url: `${apiUrl}/api/ingest/event`,
        ingest_key: project.ingestApiKey,
      },
      platforms: {
        ...(project.pixelFacebookId ? {
          meta: {
            pixel_id:        project.pixelFacebookId,
            access_token:    project.tokenFacebookApi ?? undefined,
            test_event_code: project.testEventCode   ?? undefined,
          },
        } : {}),
        ...(project.tikTokPixelId ? {
          tiktok: {
            pixel_id:        project.tikTokPixelId,
            access_token:    project.tokenTikTokApi     ?? undefined,
            test_event_code: project.testEventCodeTikTok ?? undefined,
          },
        } : {}),
        ...(project.ga4MeasurementId ? {
          ga4: {
            measurement_id: project.ga4MeasurementId,
            api_secret:     project.ga4ApiSecret ?? undefined,
          },
        } : {}),
        ...(gadsCfg ? {
          google_ads: {
            conversion_id:  gadsCfg.conversionId,
            customer_id:    gadsCfg.customerId,
            refresh_token:  gadsCfg.refreshToken,
            events:         gadsCfg.events ?? {},
          },
        } : {}),
      },
      debug: false,
    };

    if (triggers.length > 0) siteConfig.triggers = triggers;

    const key = `site_config:${project.pixelId}`;
    const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/values/${encodeURIComponent(key)}`;
    try {
      const res = await fetch(url, {
        method:  'PUT',
        headers: { 'Authorization': `Bearer ${apiToken}`, 'Content-Type': 'text/plain' },
        body:    JSON.stringify(siteConfig),
      });
      if (!res.ok) {
        const text = await res.text();
        this.logger.warn(`[GoogleAds] KV sync failed ${res.status}: ${text}`);
      }
    } catch (e: any) {
      this.logger.warn(`[GoogleAds] KV sync error: ${e?.message}`);
    }
  }
}
