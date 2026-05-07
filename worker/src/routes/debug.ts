import { Env } from '../types';
import { getConfig, detectSiteId } from '../shared/config';

/**
 * GET /debug?site_id=<id>&token=<debug_token>
 *
 * Returns the resolved config for a site and whether each platform is configured.
 * Protected by a simple token check — set DEBUG_TOKEN in wrangler.toml [vars] or secrets.
 */
export async function handleDebug(request: Request, env: Env): Promise<Response> {
  const url   = new URL(request.url);
  const token = url.searchParams.get('token') || request.headers.get('Authorization')?.replace('Bearer ', '');

  const debugToken = (env as any).DEBUG_TOKEN;
  if (debugToken && token !== debugToken) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const siteId = detectSiteId(request, env);
  const config = await getConfig(siteId, env);

  const kvAvailable = !!env.SITE_CONFIG_KV;
  const kvRaw = config && Object.keys(config).length > 0 ? JSON.stringify(config) : null;

  const result = {
    resolved_site_id: siteId,
    kv_available: kvAvailable,
    kv_has_config: kvRaw !== null,
    config_loaded: {
      has_meta:       !!(config.platforms?.meta?.pixel_id),
      has_tiktok:     !!(config.platforms?.tiktok?.pixel_id),
      has_ga4:        !!(config.platforms?.ga4?.measurement_id),
      has_google_ads: !!(config.platforms?.google_ads?.conversion_id),
      meta_pixel_id:       config.platforms?.meta?.pixel_id         || null,
      meta_has_token:      !!(config.platforms?.meta?.access_token  || (env as any).META_ACCESS_TOKEN),
      tiktok_pixel_id:     config.platforms?.tiktok?.pixel_id       || null,
      tiktok_has_token:    !!(config.platforms?.tiktok?.access_token || (env as any).TIKTOK_ACCESS_TOKEN),
      ga4_measurement_id:  config.platforms?.ga4?.measurement_id    || null,
      ga4_has_secret:      !!(config.platforms?.ga4?.api_secret     || (env as any).GA4_API_SECRET),
    },
    env_fallbacks: {
      META_ACCESS_TOKEN:    !!(env as any).META_ACCESS_TOKEN,
      TIKTOK_ACCESS_TOKEN:  !!(env as any).TIKTOK_ACCESS_TOKEN,
      GA4_API_SECRET:       !!(env as any).GA4_API_SECRET,
      SITE_CONFIG:          !!(env as any).SITE_CONFIG,
    },
    ts: new Date().toISOString()
  };

  return new Response(JSON.stringify(result, null, 2), {
    headers: { 'Content-Type': 'application/json' }
  });
}
