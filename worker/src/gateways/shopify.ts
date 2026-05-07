import { WebhookData } from '../types';

const PURCHASE_TOPICS = new Set(['orders/paid']);

export function parseShopify(body: any): WebhookData | null {
  const topic: string = body.__topic || '';
  if (topic && !PURCHASE_TOPICS.has(topic)) return null;
  if (!body?.id) return null;

  const order = body;

  // ── note_attributes: array → map ─────────────────────────────────────────
  const noteAttrs: Record<string, string> = {};
  if (Array.isArray(order.note_attributes)) {
    for (const attr of order.note_attributes) {
      if (attr.name && attr.value != null) {
        noteAttrs[attr.name] = String(attr.value);
      }
    }
  }

  const note = (key: string) => noteAttrs[key] || '';

  // ── nx_user: from note_attributes (set by pixel.js link-decorator / checkout-pixel)
  const nxUser    = note('nx_user') || note('nx_lead_id') || note('_nx_user') || '';
  const cartToken = order.cart_token || undefined;

  // ── UTMs: note_attributes (priority) → landing_site query string (fallback)
  let landingUtm: Record<string, string> = {};
  if (order.landing_site?.includes('?')) {
    try {
      const sp = new URLSearchParams(order.landing_site.split('?').slice(1).join('?'));
      ['utm_source','utm_medium','utm_campaign','utm_content','utm_term'].forEach(k => {
        const v = sp.get(k);
        if (v) landingUtm[k] = v;
      });
    } catch (_) {}
  }
  const utm = (key: string) => note(key) || landingUtm[key] || '';

  // ── Click IDs: pixel link-decorator appends these to checkout URL.
  // Shopify checkout pixel reads them and stores as note_attributes.
  // Keys stored by the pixel: fbclid, gclid, ttclid, _fbc, _fbp, _ttp
  const fbclid = note('fbclid');
  const fbc    = note('fbc')  || note('_fbc');
  const fbp    = note('fbp')  || note('_fbp');
  const gclid  = note('gclid');
  const gbraid = note('gbraid');
  const wbraid = note('wbraid');
  const ttclid = note('ttclid');
  const ttp    = note('ttp')  || note('_ttp');
  const msclkid = note('msclkid');
  const twclid  = note('twclid');

  // ── Products ──────────────────────────────────────────────────────────────
  const lineItems: any[] = Array.isArray(order.line_items) ? order.line_items : [];
  const productId   = lineItems[0]?.product_id ? String(lineItems[0].product_id) : '';
  const productName = lineItems[0]?.title || lineItems[0]?.name || '';

  // ── Payment gateway ───────────────────────────────────────────────────────
  const gateway = order.payment_gateway_names?.[0]
    || note('payment_additional_method_title')
    || 'shopify';

  return {
    nx_user:      nxUser,
    cart_token:   cartToken,
    email:        order.email || order.contact_email || '',
    phone:        order.billing_address?.phone || order.shipping_address?.phone || '',
    name: [
      order.billing_address?.first_name || order.customer?.first_name,
      order.billing_address?.last_name  || order.customer?.last_name,
    ].filter(Boolean).join(' '),
    order_id:     String(order.id),
    value:        parseFloat(order.total_price || order.current_total_price || '0'),
    currency:     order.currency || 'BRL',
    product_name: productName,
    product_id:   productId,
    city:         order.billing_address?.city          || order.shipping_address?.city          || '',
    state:        order.billing_address?.province_code || order.shipping_address?.province_code || '',
    country:      order.billing_address?.country_code  || order.shipping_address?.country_code  || '',
    zip:          order.billing_address?.zip           || order.shipping_address?.zip           || '',
    ip:           order.browser_ip || order.client_details?.browser_ip || '',
    user_agent:   order.client_details?.user_agent || '',
    gateway,
    // UTMs
    utm_source:   utm('utm_source'),
    utm_medium:   utm('utm_medium'),
    utm_campaign: utm('utm_campaign'),
    utm_content:  utm('utm_content'),
    utm_term:     utm('utm_term'),
    // Click IDs from note_attributes (link-decorator captures at checkout entry)
    fbclid,
    fbc,
    fbp,
    gclid,
    gbraid,
    wbraid,
    ttclid,
    ttp,
    msclkid,
    twclid,
  };
}
