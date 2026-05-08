import { Env } from '../types';
import { getConfig, detectSiteId } from '../shared/config';
// Wrangler injects as plain string via [[rules]] type = "Text" globs = ["dist/*.js"]
import YAMPI_JS from '../../dist/yampi-checkout.js';

/**
 * GET /tracking/yampi-checkout.js?pid=<project-id>
 *
 * Install in Yampi Admin → Configurações → Checkout → Scripts Adicionais:
 *   <script src="https://<worker>/tracking/yampi-checkout.js?pid=<id>" async></script>
 *
 * DataLayer events fired by Yampi (real names observed in production):
 *   begin_checkout      → InitiateCheckout
 *   add_shipping_info   → AddShippingInfo
 *   add_payment_info    → AddPaymentInfo
 *
 * Product data uses Yampi-specific fields:
 *   item.shopify_variant_id || item.shopify_product_id || item.id
 *
 * Customer data lives at eventModel.customer (not top-level):
 *   { email, phone_number, first_name, last_name }
 *
 * Each event fires both browser pixels (fbq, ttq, gtag) and server-side CAPI with
 * the same event_id for proper Meta/TikTok deduplication.
 */
export async function handleYampiCheckoutPixel(request: Request, env: Env): Promise<Response> {
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

  const script = (YAMPI_JS as string)
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
