import { Env, SiteConfig } from '../types'
import { getConfig } from '../shared/config'

// Compiled pixel scripts imported as text via Wrangler [[rules]] type = "Text"
import shopifyStorefront from '../../dist/shopify-storefront.js'
import shopifyCheckout from '../../dist/shopify-checkout.js'
import cartpandaCheckout from '../../dist/cartpanda-checkout.js'
import yampiCheckout from '../../dist/yampi-checkout.js'
import directTraffic from '../../dist/direct-traffic.js'

const VALID_SCRIPTS = new Set([
  'shopify-storefront',
  'shopify-checkout',
  'cartpanda-checkout',
  'yampi-checkout',
  'direct-traffic',
])

const SCRIPT_CONTENT: Record<string, string> = {
  'shopify-storefront': shopifyStorefront,
  'shopify-checkout': shopifyCheckout,
  'cartpanda-checkout': cartpandaCheckout,
  'yampi-checkout': yampiCheckout,
  'direct-traffic': directTraffic,
}

function injectConfig(js: string, config: SiteConfig, collectUrl: string): string {
  const metaPixelId = config.platforms?.meta?.pixel_id || ''
  const metaPixelIds = [metaPixelId, ...(config.platforms?.meta?.pixel_ids_mirror || [])].filter(Boolean)

  const clientConfig = {
    collect_url: collectUrl,
    meta_pixel_id: metaPixelId,
    meta_pixel_ids_mirror: config.platforms?.meta?.pixel_ids_mirror || [],
    tiktok_pixel_id: config.platforms?.tiktok?.pixel_id || null,
    ga4_measurement_id: config.platforms?.ga4?.measurement_id || null,
    google_ads_conversion_id: config.platforms?.google_ads?.conversion_id || null,
    meta_test_event_code: (config.platforms?.meta as any)?.test_event_code || '',
    tiktok_test_event_code: (config.platforms?.tiktok as any)?.test_event_code || '',
    triggers: config.triggers || [],
    debug: config.debug || false,
  }

  return js
    .replace('/*__CONFIG__*/', `const __CONFIG__ = ${JSON.stringify(clientConfig)};`)
    .replace('/*__NX_USER__*/', `const __NX_USER__ = "";`)
    .replace('/*__NX_COLLECT__*/', JSON.stringify(collectUrl))
    .replace('/*__META_PIXEL_IDS__*/', JSON.stringify(metaPixelIds))
    .replace('/*__TIKTOK_PIXEL__*/', JSON.stringify(config.platforms?.tiktok?.pixel_id || null))
    .replace('/*__GA4_ID__*/', JSON.stringify(config.platforms?.ga4?.measurement_id || null))
    .replace('/*__META_TEST__*/', JSON.stringify((config.platforms?.meta as any)?.test_event_code || ''))
    .replace('/*__TIKTOK_TEST__*/', JSON.stringify((config.platforms?.tiktok as any)?.test_event_code || ''))
}

/** GET /scripts/:name.js?pixel_id=XXXX — serves a compiled pixel script with runtime config injected. */
export async function handleServeScript(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  const path = url.pathname

  // Extract script name from path: /scripts/:name.js
  const nameMatch = path.match(/^\/scripts\/([^/]+)\.js$/)
  const scriptName = nameMatch?.[1] ?? ''

  if (!scriptName || !VALID_SCRIPTS.has(scriptName)) {
    return new Response('Not Found', { status: 404 })
  }

  // Validate pixel_id (accept both ?pixel_id= and legacy ?pid=)
  const pixelId = url.searchParams.get('pixel_id') || url.searchParams.get('pid') || ''
  if (!pixelId) {
    return new Response(JSON.stringify({ error: 'missing_pixel_id', message: 'pixel_id query param is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const config = await getConfig(pixelId, env)
  const collectUrl = `${url.origin}/collect/event?pid=${encodeURIComponent(pixelId)}`
  const script = injectConfig(SCRIPT_CONTENT[scriptName], config, collectUrl)

  return new Response(script, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  })
}
