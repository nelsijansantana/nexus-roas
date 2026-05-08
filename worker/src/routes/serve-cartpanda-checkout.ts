import { Env } from '../types';
import { getConfig, detectSiteId } from '../shared/config';
// Wrangler injects as plain string via [[rules]] type = "Text" globs = ["dist/*.js"]
import CARTPANDA_JS from '../../dist/cartpanda-checkout.js';

/**
 * GET /tracking/cartpanda-checkout.js?pid=<project-id>
 *
 * Install in CartPanda Admin → Configurações → Checkout → Scripts Adicionais:
 *   <script src="https://<worker>/tracking/cartpanda-checkout.js?pid=<id>" async></script>
 *
 * DataLayer events fired by CartPanda (real names observed in production):
 *   begin_checkout      → InitiateCheckout  (pushed synchronously by CartPanda GTM)
 *   begin_checkout_info → AddShippingInfo   (CartPanda-specific name)
 *   add_payment_info    → AddPaymentInfo    (standard GA4)
 *
 * Product data lives in eventModel.items + eventModel.value (not ecommerce.items).
 *
 * Each event fires both browser pixels (fbq, ttq, gtag) and server-side CAPI with
 * the same event_id for proper Meta/TikTok deduplication.
 */
export async function handleCartPandaCheckoutPixel(request: Request, env: Env): Promise<Response> {
  const url    = new URL(request.url);
  const origin = url.origin;
  const pid    = url.searchParams.get('pid');
  const collectUrl = pid
    ? `${origin}/collect/event?pid=${encodeURIComponent(pid)}`
    : `${origin}/collect/event`;

  let metaPixelIds:  string[] = [];
  let tiktokPixelId  = '';
  let ga4Id          = '';
  let metaTestCode   = '';
  let tiktokTestCode = '';

  try {
    const siteId = detectSiteId(request, env);
    const config = await getConfig(siteId, env);
    const meta   = config.platforms?.meta;
    if (meta?.pixel_id) {
      metaPixelIds = [meta.pixel_id, ...(meta.pixel_ids_mirror || [])];
    }
    tiktokPixelId  = config.platforms?.tiktok?.pixel_id               || '';
    ga4Id          = config.platforms?.ga4?.measurement_id             || '';
    metaTestCode   = (meta as any)?.test_event_code                    || '';
    tiktokTestCode = (config.platforms?.tiktok as any)?.test_event_code || '';
  } catch (_) {}

  const script = (CARTPANDA_JS as string)
    .replace('/*__NX_COLLECT__*/',     `var __NX_COLLECT__ = ${JSON.stringify(collectUrl)};`)
    .replace('/*__META_PIXEL_IDS__*/', `var __META_PIXEL_IDS__ = ${JSON.stringify(metaPixelIds)};`)
    .replace('/*__TIKTOK_PIXEL__*/',   `var __TIKTOK_PIXEL__ = ${JSON.stringify(tiktokPixelId)};`)
    .replace('/*__GA4_ID__*/',         `var __GA4_ID__ = ${JSON.stringify(ga4Id)};`)
    .replace('/*__META_TEST__*/',      `var __META_TEST__ = ${JSON.stringify(metaTestCode)};`)
    .replace('/*__TIKTOK_TEST__*/',    `var __TIKTOK_TEST__ = ${JSON.stringify(tiktokTestCode)};`);

  return new Response(script, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
      'Access-Control-Allow-Origin': '*',
    }
  });
}
