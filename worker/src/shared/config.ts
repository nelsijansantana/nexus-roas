import { Env, SiteConfig, WebhookEndpointConfig } from '../types';

const configTTL = 60_000; // 60 seconds
const globalConfigCache = new Map<string, { config: SiteConfig; time: number }>();
const globalWebhookCache = new Map<string, { config: WebhookEndpointConfig | null; time: number }>();

export async function getConfig(siteId: string | null, env: Env, requestCache?: Map<string, SiteConfig>): Promise<SiteConfig> {
  if (!siteId) return {};

  // Check request cache
  if (requestCache?.has(siteId)) return requestCache.get(siteId)!;

  // Check global cache
  const cached = globalConfigCache.get(siteId);
  if (cached && Date.now() - cached.time < configTTL) {
    if (requestCache) requestCache.set(siteId, cached.config);
    return cached.config;
  }

  // ── 1. Cloudflare KV (multi-tenant — production path) ─────────────────────
  let resolvedId = siteId;
  if (env.SITE_CONFIG_KV && siteId.includes('.')) { // Heuristic: skip domain_map if siteId doesn't look like a domain
    try {
      // Domain-map lookup: custom host (tracker.lojadocliente.com) → pixel_id
      const mappedId = await env.SITE_CONFIG_KV.get(`domain_map:${siteId}`);
      if (mappedId) resolvedId = mappedId;
    } catch (e) {
      console.error('[config] domain map KV read error:', e);
    }
  }

  let config: SiteConfig = {};
  if (env.SITE_CONFIG_KV) {
    try {
      const raw = await env.SITE_CONFIG_KV.get(`site_config:${resolvedId}`);
      if (raw) config = JSON.parse(raw) as SiteConfig;
    } catch (e) {
      console.error('[config] site config KV read error:', e);
    }
  }

  // ── 2. SITE_CONFIG var fallback (single-tenant / local dev) ───────────────
  if (!config.platforms && env.SITE_CONFIG) {
    try {
      const fallbackConfig = typeof env.SITE_CONFIG === 'string'
        ? JSON.parse(env.SITE_CONFIG)
        : env.SITE_CONFIG;
      // Support both map format {"pixel_id": {...}} and direct flat object
      if (resolvedId && fallbackConfig[resolvedId]) config = fallbackConfig[resolvedId] as SiteConfig;
      else if (!resolvedId) config = fallbackConfig as SiteConfig;
    } catch (e) {
      console.error('[config] SITE_CONFIG parse error:', e);
    }
  }

  // Set caches — clear if oversized to prevent unbounded growth in long-lived isolates
  if (globalConfigCache.size >= 1000) globalConfigCache.clear();
  globalConfigCache.set(siteId, { config, time: Date.now() });
  if (requestCache) requestCache.set(siteId, config);

  return config;
}

/**
 * Lê WebhookEndpointConfig do KV.
 * Retorna null se o wid for inválido ou não cadastrado.
 */
export async function getWebhookConfig(wid: string, env: Env): Promise<WebhookEndpointConfig | null> {
  if (!wid) return null;

  const cached = globalWebhookCache.get(wid);
  if (cached && Date.now() - cached.time < configTTL) {
    return cached.config;
  }

  let config: WebhookEndpointConfig | null = null;
  if (env.SITE_CONFIG_KV) {
    try {
      const raw = await env.SITE_CONFIG_KV.get(`webhook:${wid}`);
      if (raw) config = JSON.parse(raw) as WebhookEndpointConfig;
    } catch (e) {
      console.error('[config] webhook KV read error:', e);
    }
  }

  if (globalWebhookCache.size >= 500) globalWebhookCache.clear();
  globalWebhookCache.set(wid, { config, time: Date.now() });
  return config;
}

/**
 * Extrai os parâmetros de rota da requisição.
 * - wid: webhook endpoint ID (?wid=) — rota nova, configurável por conta
 * - siteId: pixel_id para rotas legadas (?pid= / ?site_id= / host)
 */
export function detectRouteParams(request: Request): { siteId: string | null; wid: string | null } {
  const url = new URL(request.url);
  const wid = url.searchParams.get('wid') || null;
  const pid = url.searchParams.get('pid') || url.searchParams.get('site_id') || null;
  const host = request.headers.get('host') || '';
  const hostId = host.replace(/:\d+$/, '').replace(/^www\./, '') || null;
  return {
    wid,
    siteId: pid ?? (!wid ? hostId : null),
  };
}

/** Wrapper de compatibilidade — mantém a assinatura original para rotas legadas. */
export function detectSiteId(request: Request, _env?: Env): string {
  return detectRouteParams(request).siteId || '';
}
