import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import * as path from 'path';
import * as fs from 'fs';
import AdmZip from 'adm-zip';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto, UpdateProjectDto } from './dto/create-project.dto';
import { JwtPayload } from '../auth/auth.service';
import { canCreateProject } from '../common/plans.config';

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  // ─── Cloudflare KV sync ───────────────────────────────────────────────────
  // Writes site config to KV after every project create/update so the Worker
  // serves the correct per-client config without redeployment.
  // Silently no-ops when CF env vars are not set (dev / test environments).

  private async _kvPut(key: string, value: string): Promise<void> {
    const accountId   = this.config.get<string>('CF_ACCOUNT_ID');
    const namespaceId = this.config.get<string>('CF_KV_NAMESPACE_ID');
    const apiToken    = this.config.get<string>('CF_API_TOKEN');
    if (!accountId || !namespaceId || !apiToken) return; // not configured

    const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/values/${encodeURIComponent(key)}`;
    try {
      const res = await fetch(url, {
        method:  'PUT',
        headers: { 'Authorization': `Bearer ${apiToken}`, 'Content-Type': 'text/plain' },
        body:    value,
      });
      if (!res.ok) {
        const text = await res.text();
        this.logger.warn(`[KV] PUT ${key} failed ${res.status}: ${text}`);
      }
    } catch (e: any) {
      this.logger.warn(`[KV] PUT ${key} error: ${e?.message}`);
    }
  }

  private async _kvDelete(key: string): Promise<void> {
    const accountId   = this.config.get<string>('CF_ACCOUNT_ID');
    const namespaceId = this.config.get<string>('CF_KV_NAMESPACE_ID');
    const apiToken    = this.config.get<string>('CF_API_TOKEN');
    if (!accountId || !namespaceId || !apiToken) return;

    const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/values/${encodeURIComponent(key)}`;
    try {
      await fetch(url, { method: 'DELETE', headers: { 'Authorization': `Bearer ${apiToken}` } });
    } catch (e: any) {
      this.logger.warn(`[KV] DELETE ${key} error: ${e?.message}`);
    }
  }

  // ─── Checkout → gateway map ───────────────────────────────────────────────

  private _checkoutToGateway(checkoutType: string): string {
    const map: Record<string, string> = {
      shopify:           'shopify',
      shopify_yampi:     'shopify',
      shopify_cartpanda: 'cartpanda',
      cartpanda:         'cartpanda',
      ticto:             'ticto',
    };
    return map[checkoutType] ?? checkoutType;
  }

  // ─── Account webhook auto-sync ────────────────────────────────────────────

  /** Cria/busca o account_webhook associado a este projeto e retorna o seu id. */
  private async _ensureProjectWebhook(userId: string, project: any): Promise<string | null> {
    const pixelId      = project.pixelId as string;
    const checkoutType = (project.checkoutType ?? 'shopify') as string;
    const gateway      = this._checkoutToGateway(checkoutType);
    try {
      // Já existe?
      const existing = await (this.prisma as any).account_webhooks.findFirst({
        where: { userId, projectIds: { has: pixelId }, isActive: true },
        select: { id: true },
      });
      if (existing) return existing.id as string;

      // Criar
      const webhook = await (this.prisma as any).account_webhooks.create({
        data: { userId, gateway, name: project.name, projectIds: [pixelId], type: 'system', updatedAt: new Date() },
      });
      void this._syncProjectWebhookKV(webhook, userId);
      return webhook.id as string;
    } catch (e: any) {
      this.logger.warn(`[KV] _ensureProjectWebhook failed: ${e?.message}`);
      return null;
    }
  }

  /** Retorna o wid do account_webhook associado ao projeto, se existir. */
  private async _findProjectWid(userId: string, pixelId: string): Promise<string | null> {
    try {
      const webhook = await (this.prisma as any).account_webhooks.findFirst({
        where: { userId, projectIds: { has: pixelId }, isActive: true },
        select: { id: true },
      });
      return webhook?.id ?? null;
    } catch {
      return null;
    }
  }

  /** Sincroniza o account_webhook de um projeto no KV (webhook:<wid>). */
  private async _syncProjectWebhookKV(webhook: any, userId: string): Promise<void> {
    try {
      const user = await (this.prisma.users as any).findUnique({
        where: { id: userId },
        select: { webhookAccountId: true },
      });
      if (!user?.webhookAccountId) return;

      const workerUrl = this.config.get<string>('WORKER_URL', '').replace(/\/$/, '');
      const kvPayload = {
        wid:        webhook.id,
        account_id: user.webhookAccountId,
        gateway:    webhook.gateway,
        name:       webhook.name,
        site_ids:   webhook.projectIds ?? [],
      };
      await this._kvPut(`webhook:${webhook.id}`, JSON.stringify(kvPayload));
    } catch (e: any) {
      this.logger.warn(`[KV] _syncProjectWebhookKV failed: ${e?.message}`);
    }
  }

  /** Syncs project config to KV. Call after every create/update/pixel-events change. */
  private async _syncKV(project: any, prevCustomDomain?: string | null): Promise<void> {
    const apiUrl = this.config.get<string>('API_URL', 'http://localhost:3000');

    // Fetch active pixel-event rules so the Worker can fire them client-side
    let triggers: any[] = [];
    try {
      const rows = await (this.prisma as any).pixel_events.findMany({
        where:   { projectId: project.id, isActive: true },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true, eventName: true, triggerType: true,
          selector: true, buttonText: true,
          scrollDepth: true, timeSeconds: true, customData: true,
        },
      });
      triggers = rows ?? [];
    } catch (_) { /* non-fatal — project may not have rules yet */ }

    // Fetch Google Ads integration from the integrations table (new format)
    let gadsIntegration: any = null;
    try {
      gadsIntegration = await (this.prisma.integrations as any).findFirst({
        where: { projectId: project.id, type: 'google_ads', isActive: true },
      });
    } catch (_) { /* non-fatal */ }
    const gadsCfg = gadsIntegration?.config ?? null;

    // Build SiteConfig matching the Worker's SiteConfig interface
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
            pixel_id:     project.pixelFacebookId,
            access_token: project.tokenFacebookApi ?? undefined,
            test_event_code: project.testEventCode ?? undefined,
          },
        } : {}),
        ...(project.tikTokPixelId ? {
          tiktok: {
            pixel_id:     project.tikTokPixelId,
            access_token: project.tokenTikTokApi ?? undefined,
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
            conversion_id: gadsCfg.conversionId,
            customer_id:   gadsCfg.customerId,
            refresh_token: gadsCfg.refreshToken,
            events:        gadsCfg.events ?? {},
          },
        } : {}),
      },
      debug: false,
    };

    if (triggers.length > 0) siteConfig.triggers = triggers;

    // Write the main config
    await this._kvPut(`site_config:${project.pixelId}`, JSON.stringify(siteConfig));

    // Handle domain_map changes
    const newDomain = project.customDomain as string | null | undefined;
    if (prevCustomDomain && prevCustomDomain !== newDomain) {
      await this._kvDelete(`domain_map:${prevCustomDomain}`);
    }
    if (newDomain) {
      await this._kvPut(`domain_map:${newDomain}`, project.pixelId);
    }
  }

  /**
   * Public re-sync entrypoint — called by PixelEventsService after any rule CRUD
   * so the KV config is always up to date without requiring a project save.
   */
  async resyncKV(projectId: string): Promise<void> {
    try {
      const project = await (this.prisma.projects as any).findFirst({
        where: { id: projectId, deletedAt: null },
      });
      if (!project) return;
      await this._syncKV(project, project.customDomain);
    } catch (e: any) {
      this.logger.warn(`[KV] resyncKV failed for project ${projectId}: ${e?.message}`);
    }
  }

  // ─── Permission helpers ───────────────────────────────────────────────────

  /** Returns the account owner's userId regardless of who is calling */
  private accountId(caller: JwtPayload): string {
    return caller.ownerId ?? caller.userId;
  }

  /** Throws if a member with restricted role tries a write action */
  private assertCanWrite(caller: JwtPayload) {
    if (caller.ownerId && caller.memberRole !== 'admin') {
      throw new ForbiddenException('Seu perfil no time não permite criar ou editar projetos');
    }
  }

  /** Returns project IDs this member can see, or null = unrestricted */
  private async allowedProjectIds(caller: JwtPayload): Promise<Set<string> | null> {
    if (!caller.ownerId) return null;           // owner — no restriction
    if (caller.memberRole === 'admin') return null; // admin — sees all

    // analyst / viewer — only explicitly granted projects
    const access = await (this.prisma.project_access as any).findMany({
      where: {
        membership: { userId: caller.userId, ownerId: caller.ownerId },
      },
      select: { projectId: true },
    });
    return new Set(access.map((a: any) => a.projectId));
  }

  // ─── CRUD ─────────────────────────────────────────────────────────────────

  async create(createProjectDto: CreateProjectDto, caller: JwtPayload) {
    this.assertCanWrite(caller);

    const ownerId = this.accountId(caller);
    const user = await (this.prisma.users as any).findUnique({
      where: { id: ownerId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Enforce plan project limit
    const currentCount = await (this.prisma.projects as any).count({
      where: { userId: ownerId, deletedAt: null },
    });
    if (!canCreateProject(user.plan ?? 'free', currentCount)) {
      const planName = user.plan ?? 'free';
      throw new ForbiddenException(
        `Seu plano não permite criar mais projetos. Faça upgrade para continuar.`,
      );
    }

    const projectId = randomUUID();
    const pixelId = randomUUID();
    const now = new Date();

    const project = await this.prisma.projects.create({
      data: {
        id: projectId,
        pixelId: pixelId,
        name: createProjectDto.name,
        domain: createProjectDto.domain,
        userId: ownerId,
        checkoutType: createProjectDto.checkoutType ?? 'shopify',
        projectType: createProjectDto.projectType ?? 'ecommerce',
        pixelFacebookId: createProjectDto.pixelFacebookId,
        tokenFacebookApi: createProjectDto.tokenFacebookApi,
        tikTokPixelId: createProjectDto.tikTokPixelId,
        tokenTikTokApi: createProjectDto.tokenTikTokApi,
        testEventCodeTikTok: createProjectDto.testEventCodeTikTok,
        testEventCode: createProjectDto.testEventCode,
        cartpandaStoreId: createProjectDto.cartpandaStoreId,
        customDomain: createProjectDto.customDomain ?? null,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      } as any,
    });

    // Sync config to Cloudflare KV (fire-and-forget, non-fatal)
    void this._syncKV(project).catch((e) =>
      this.logger.warn('[KV] sync failed on create:', e?.message),
    );

    const wid = await this._ensureProjectWebhook(ownerId, project);
    return this._buildResponse(project, wid);
  }

  async findAllByUser(caller: JwtPayload) {
    const ownerId = this.accountId(caller);
    const allowed = await this.allowedProjectIds(caller);

    let projects = await (this.prisma.projects as any).findMany({
      where: {
        userId: ownerId,
        deletedAt: null,
        ...(allowed ? { id: { in: [...allowed] } } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });

    // Auto-claim only for the actual owner (not members)
    if (!caller.ownerId && projects.length === 0) {
      const orphans = await (this.prisma.projects as any).findMany({
        where: { userId: ownerId, deletedAt: null },
      });
      for (const p of orphans) {
        const ownerExists = await this.prisma.users.findUnique({ where: { id: p.userId } });
        if (!ownerExists) {
          await this.prisma.projects.update({
            where: { id: p.id },
            data: { userId: ownerId, updatedAt: new Date() },
          });
        }
      }
      projects = await (this.prisma.projects as any).findMany({
        where: { userId: ownerId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
      });
    }

    return projects.map((p: any) => ({
      id: p.id,
      pixelId: p.pixelId,
      name: p.name,
      domain: p.domain,
      isActive: p.isActive,
      pixelFacebookId: p.pixelFacebookId,
      tikTokPixelId: p.tikTokPixelId,
      testEventCodeTikTok: p.testEventCodeTikTok,
      testEventCode: p.testEventCode,
      cartpandaStoreId: p.cartpandaStoreId,
      sendPurchaseFromWeb: p.sendPurchaseFromWeb,
      hasFacebookToken: !!p.tokenFacebookApi,
      hasTikTokToken: !!p.tokenTikTokApi,
      tokenFacebookApi: this._maskToken(p.tokenFacebookApi),
      tokenTikTokApi: this._maskToken(p.tokenTikTokApi),
      createdAt: p.createdAt,
    }));
  }

  async findOne(id: string, caller: JwtPayload) {
    const ownerId = this.accountId(caller);
    const project = await (this.prisma.projects as any).findFirst({
      where: { id, userId: ownerId, deletedAt: null },
    });

    if (!project) throw new NotFoundException('Project not found');

    // Restricted member — check explicit access
    const allowed = await this.allowedProjectIds(caller);
    if (allowed && !allowed.has(id)) {
      throw new ForbiddenException('Acesso a este projeto não foi concedido');
    }

    const wid = await this._findProjectWid(ownerId, project.pixelId);
    return this._buildResponse(project, wid);
  }

  async update(id: string, updateDto: UpdateProjectDto, caller: JwtPayload) {
    this.assertCanWrite(caller);
    const ownerId = this.accountId(caller);

    const existing = await (this.prisma.projects as any).findFirst({
      where: { id, userId: ownerId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Project not found');

    // Convert empty strings to null for optional config fields so that saving
    // a section without changing a field doesn't wipe the stored value.
    const sanitized: Record<string, unknown> = { ...updateDto };
    const nullableFields = [
      'pixelFacebookId', 'tikTokPixelId', 'tokenFacebookApi', 'tokenTikTokApi',
      'testEventCode', 'testEventCodeTikTok', 'cartpandaStoreId', 'domain', 'customDomain',
      'ga4MeasurementId', 'ga4ApiSecret',
      'googleAdsConversionId', 'googleAdsLabelContact', 'googleAdsLabelLead',
    ];
    for (const field of nullableFields) {
      if (sanitized[field] === '') sanitized[field] = null;
    }

    const prevCustomDomain = existing.customDomain as string | null;

    const project = await this.prisma.projects.update({
      where: { id },
      data: { ...sanitized, updatedAt: new Date() } as any,
    });

    // Sync to KV — pass old domain so stale domain_map entries are cleaned up
    void this._syncKV(project, prevCustomDomain).catch((e) =>
      this.logger.warn('[KV] sync failed on update:', e?.message),
    );

    // Ensure auto-webhook exists; update gateway if checkoutType changed
    let wid = await this._findProjectWid(ownerId, project.pixelId);
    if (!wid) {
      wid = await this._ensureProjectWebhook(ownerId, project);
    } else if (updateDto.checkoutType && updateDto.checkoutType !== existing.checkoutType) {
      const newGateway = this._checkoutToGateway(updateDto.checkoutType as string);
      const updated = await (this.prisma as any).account_webhooks.update({
        where: { id: wid },
        data: { gateway: newGateway, updatedAt: new Date() },
      });
      void this._syncProjectWebhookKV(updated, ownerId);
    }

    return this._buildResponse(project, wid);
  }

  async remove(id: string, caller: JwtPayload) {
    this.assertCanWrite(caller);
    const ownerId = this.accountId(caller);

    const existing = await (this.prisma.projects as any).findFirst({
      where: { id, userId: ownerId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Project not found');

    await (this.prisma.projects as any).update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });

    return { deleted: true, id };
  }

  // ─── Private helpers ────────────────────────────────────────────────────

  private _buildResponse(project: any, wid?: string | null) {
    const apiUrl       = this.config.get<string>('API_URL',    'http://localhost:3000');
    const workerUrl    = this.config.get<string>('WORKER_URL', '').replace(/\/$/, '');
    const checkoutType = (project.checkoutType  ?? 'shopify')  as string;
    const customDomain = (project.customDomain  ?? null)       as string | null;
    const ingestApiKey = (project.ingestApiKey  ?? '')         as string;
    const pixelId      = project.pixelId                       as string;

    // ── Helpers de URL ────────────────────────────────────────────────────────
    // workerPath: usado para pixel.js, shopify-checkout.js — sempre com ?pid=
    const workerPath = (path: string) => {
      if (customDomain) return `https://${customDomain}${path}`;
      if (workerUrl)    return `${workerUrl}${path}?pid=${pixelId}`;
      return null;
    };

    // webhookPath: usa ?wid= quando disponível, cai para ?pid= como legado
    const webhookPath = (gateway: string) => {
      if (customDomain) return `https://${customDomain}/collect/webhook/${gateway}`;
      if (workerUrl && wid) return `${workerUrl}/collect/webhook/${gateway}?wid=${wid}`;
      if (workerUrl)        return `${workerUrl}/collect/webhook/${gateway}?pid=${pixelId}`;
      return null;
    };

    // ── Install snippet ────────────────────────────────────────────────────────
    const pixelSrc = workerPath('/tracking/pixel.js');
    const installScript = pixelSrc
      ? `<!-- Nexus Pixel — cole no <head> de todas as páginas -->\n<script async defer src="${pixelSrc}"></script>`
      : `<!-- Nexus Pixel — configure WORKER_URL no ambiente do backend -->`;

    // ── Shopify Customer Events Remote pixel URL ───────────────────────────────
    const shopifyCheckoutPixelUrl = customDomain
      ? `https://${customDomain}/tracking/shopify-checkout.js`
      : workerUrl
        ? `${workerUrl}/tracking/shopify-checkout.js?pid=${pixelId}`
        : '';

    // ── CartPanda checkout script tag ─────────────────────────────────────────
    // Install in CartPanda Admin → Configurações → Checkout → Scripts Adicionais
    const cartpandaCheckoutScriptTag = workerPath('/tracking/cartpanda-checkout.js')
      ? `<script async src="${workerPath('/tracking/cartpanda-checkout.js')}"></script>`
      : '';

    // ── Yampi checkout script tag ─────────────────────────────────────────────
    // Install in Yampi Admin → Configurações → Checkout → Scripts Adicionais
    const yampiCheckoutScriptTag = workerPath('/tracking/yampi-checkout.js')
      ? `<script async src="${workerPath('/tracking/yampi-checkout.js')}"></script>`
      : '';

    // ── Webhook URLs ──────────────────────────────────────────────────────────
    const gateway         = this._checkoutToGateway(checkoutType);
    const webhookUrl      = webhookPath(gateway);
    const tictoWebhookUrl = webhookPath('ticto');

    return {
      project: {
        id:                  project.id,
        pixelId,
        name:                project.name,
        domain:              project.domain,
        customDomain,
        checkoutType,
        projectType:         project.projectType         ?? 'ecommerce',
        isActive:            project.isActive,
        cartpandaStoreId:    project.cartpandaStoreId,
        // Meta
        pixelFacebookId:     project.pixelFacebookId,
        testEventCode:       project.testEventCode,
        hasFacebookToken:    !!project.tokenFacebookApi,
        // TikTok
        tikTokPixelId:       project.tikTokPixelId,
        testEventCodeTikTok: project.testEventCodeTikTok,
        hasTikTokToken:      !!project.tokenTikTokApi,
        // GA4
        ga4MeasurementId:    project.ga4MeasurementId    ?? null,
        hasGa4Secret:        !!project.ga4ApiSecret,
        // Google Ads
        googleAdsConversionId:  project.googleAdsConversionId  ?? null,
        googleAdsLabelContact:  project.googleAdsLabelContact  ?? null,
        googleAdsLabelLead:     project.googleAdsLabelLead     ?? null,
        sendPurchaseFromWeb: project.sendPurchaseFromWeb ?? true,
        createdAt:           project.createdAt,
        updatedAt:           project.updatedAt,
      },
      // Scripts & URLs — all derived from Worker
      installScript,
      shopifyCheckoutPixelUrl,
      cartpandaCheckoutScriptTag,
      yampiCheckoutScriptTag,
      webhookUrl:      webhookUrl      ?? '',
      tictoWebhookUrl: tictoWebhookUrl ?? '',
      workerBaseUrl:   workerUrl       || null,
      ingestApiKey,
      ingestUrl:       `${apiUrl}/api/ingest/event`,
      customDomain,
    };
  }

  async getWorkerBundle(id: string, caller: JwtPayload): Promise<Buffer> {
    const ownerId = this.accountId(caller);
    const project = await (this.prisma.projects as any).findFirst({
      where: { id, userId: ownerId, deletedAt: null },
    });
    if (!project) throw new NotFoundException('Project not found');

    const apiUrl = this.config.get<string>('API_URL', 'http://localhost:3000');
    const ingestUrl = `${apiUrl}/api/ingest/event`;
    const ingestApiKey = (project as any).ingestApiKey;

    // nexus-worker lives at the repo root — one level above the backend directory.
    // In dev: process.cwd() = nexus-roas/backend → .. = nexus-roas → nexus-worker/
    // In prod: set NEXUS_WORKER_PATH env var to override.
    const workerRoot = this.config.get<string>('NEXUS_WORKER_PATH')
      || path.resolve(process.cwd(), '..', 'nexus-worker');

    if (!fs.existsSync(workerRoot)) {
      throw new Error(`nexus-worker directory not found at: ${workerRoot}. Set NEXUS_WORKER_PATH env var.`);
    }

    // Directories/files to exclude from the bundle
    const EXCLUDE = new Set(['node_modules', '.wrangler', 'dist', '.git', 'pixel-template.txt']);

    const zip = new AdmZip();

    const addDirToZip = (dirPath: string, zipPath: string) => {
      for (const file of fs.readdirSync(dirPath)) {
        if (EXCLUDE.has(file)) continue;
        const fullPath = path.join(dirPath, file);
        const relPath  = path.join(zipPath, file);
        if (fs.statSync(fullPath).isDirectory()) {
          addDirToZip(fullPath, relPath);
        } else {
          let content = fs.readFileSync(fullPath, 'utf8');
          if (file === 'wrangler.toml') {
            // Inject SITE_CONFIG with nexus ingest credentials
            const siteConfig = JSON.stringify({
              nexus: {
                ingest_url: ingestUrl,
                ingest_key: ingestApiKey,
                pixel_id:   project.pixelId,
              },
            });
            // wrangler.toml has SITE_CONFIG = "{}" — replace the empty object
            content = content.replace('SITE_CONFIG = "{}"', `SITE_CONFIG = ${JSON.stringify(siteConfig)}`);
          }
          zip.addFile(relPath.replace(/\\/g, '/'), Buffer.from(content, 'utf8'));
        }
      }
    };

    addDirToZip(workerRoot, 'nexus-worker');

    return zip.toBuffer();
  }

  private _maskToken(token?: string | null): string | null {
    if (!token) return null;
    if (token.length <= 8) return '********';
    return `${token.substring(0, 6)}...${token.substring(token.length - 4)}`;
  }
}
