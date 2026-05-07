import { Env, SiteConfig } from '../types';
import { getConfig, detectSiteId } from '../shared/config';
import { parseCookies, generateId } from '../shared/helpers';
// pixel-template.txt is copied from pixel.js by `npm run prebuild`.
// Wrangler injects it as a plain string via [[rules]] type = "Text".
import PIXEL_JS from '../../pixel-template.txt';

// Returns the registrable domain for cookie scope, or empty string when the
// host is on a public-suffix-like TLD (*.workers.dev, *.pages.dev, etc.) where
// setting a wildcard domain would be rejected or too broad.
// Returning '' means no Domain attribute → cookie scoped to exact host.
function getRootDomain(request: Request): string {
  const host  = request.headers.get('host')?.replace(/:\d+$/, '') || '';
  const parts = host.split('.');
  if (parts.length < 2) return '';
  const tld2 = parts.slice(-2).join('.');
  // workers.dev / pages.dev are Cloudflare-managed PSL entries — never use them
  // as cookie domain because browsers reject cookies set at PSL boundaries.
  const PSL_BLOCKED = ['workers.dev', 'pages.dev'];
  if (PSL_BLOCKED.includes(tld2)) return '';
  return '.' + tld2;
}

/** GET /tracking/pixel.js — serves the client tracking script with config injected. */
export async function handleServePixelJs(request: Request, env: Env): Promise<Response> {
  const siteId = detectSiteId(request, env);
  const config: SiteConfig = await getConfig(siteId, env);

  // Resolve or generate nx_user from HttpOnly cookie
  const cookies = parseCookies(request.headers.get('Cookie'));
  const nxUser  = cookies['nx_user'] || generateId();

  // Worker's own origin — needed to build an absolute collect_url so the
  // browser beacon goes to the worker, not to the client's own domain.
  const workerOrigin = new URL(request.url).origin;

  // Inject geo from Cloudflare headers — eliminates third-party geo HTTP requests in pixel.js
  const cf: any = (request as any).cf || {};
  const geoFromCF = {
    ip:     request.headers.get('CF-Connecting-IP') || undefined,
    city:   (cf.city        as string | undefined) || undefined,
    region: (cf.region      as string | undefined) || undefined,
    country:(cf.country     as string | undefined) || undefined,
    postal: (cf.postalCode  as string | undefined) || undefined,
  };

  // Build safe client config (no tokens, no secrets)
  const clientConfig = {
    site_id:                    config.pixel_id || siteId,
    meta_pixel_id:              config.platforms?.meta?.pixel_id,
    meta_pixel_ids_mirror:      config.platforms?.meta?.pixel_ids_mirror,
    tiktok_pixel_id:            config.platforms?.tiktok?.pixel_id,
    ga4_measurement_id:         config.platforms?.ga4?.measurement_id,
    google_ads_conversion_id:   config.platforms?.google_ads?.conversion_id,
    // Browser-side gtag labels — read from the new events map (or legacy flat fields for compat)
    google_ads_label_contact:   config.platforms?.google_ads?.events?.['Contact']?.label,
    google_ads_label_lead:      config.platforms?.google_ads?.events?.['Lead']?.label,
    // Pass all event labels so pixel.js can fire gtag for any configured event
    google_ads_events:          config.platforms?.google_ads?.events
      ? Object.fromEntries(
          Object.entries(config.platforms.google_ads.events)
            .filter(([, v]) => v.label)
            .map(([k, v]) => [k, v.label])
        )
      : undefined,
    triggers:      config.triggers,
    cookies:       config.cookies,
    gateways_config: config.gateways_config,
    custom_data:   config.custom_data,
    meta_test_event_code:   (config.platforms?.meta as any)?.test_event_code   || undefined,
    tiktok_test_event_code: (config.platforms?.tiktok as any)?.test_event_code || undefined,
    debug:         config.debug || false,
    geo:           geoFromCF,
    collect_url:   siteId
      ? `${workerOrigin}/collect/event?pid=${encodeURIComponent(siteId)}`
      : `${workerOrigin}/collect/event`
  };

  const script = PIXEL_JS
    .replace('/*__CONFIG__*/', `var __CONFIG__=${JSON.stringify(clientConfig)};`)
    .replace('/*__NX_USER__*/', `var __NX_USER__="${nxUser}";`);

  return new Response(script, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-cache',
      'Set-Cookie': (() => {
        const domain = getRootDomain(request);
        // SameSite=None so the cookie is sent even on cross-origin <script> loads.
        // Requires Secure (already set). Without None, SameSite=Lax silently drops
        // the cookie on cross-site subresource requests (pixel.js from a store domain).
        const base = `nx_user=${nxUser}; Path=/; Max-Age=63072000; HttpOnly; SameSite=None; Secure`;
        return domain ? `${base}; Domain=${domain}` : base;
      })()
    }
  });
}
