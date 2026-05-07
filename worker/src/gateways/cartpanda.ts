import { WebhookData } from '../types';

const PAID_EVENTS = new Set([
  'order.paid', 'order_paid', 'paid', 'approved', 'order.approved', 'purchase',
]);

const CURRENCY_SYMBOL_TO_ISO: Record<string, string> = {
  'R$': 'BRL', '$': 'USD', '€': 'EUR', '£': 'GBP',
};

function normalizeCurrency(raw: string | undefined): string {
  if (!raw) return 'BRL';
  const trimmed = raw.trim();
  return CURRENCY_SYMBOL_TO_ISO[trimmed] ?? (trimmed.length === 3 ? trimmed.toUpperCase() : 'BRL');
}

export function parseCartPanda(body: any): WebhookData | null {
  if (!body?.event || !body?.order) return null;
  if (!PAID_EVENTS.has(body.event)) return null;

  const order = body.order;

  // tracking_parameters & checkout_params — search root + order for max robustness
  const trackingParams = Array.isArray(body.tracking_parameters)
    ? body.tracking_parameters
    : Array.isArray(order.tracking_parameters)
      ? order.tracking_parameters
      : [];

  const checkoutParams = body.checkout_params || order.checkout_params || {};

  const trackingMap: Record<string, string> = {};
  for (const p of trackingParams) {
    if (p?.parameter_name && p?.parameter_value != null) {
      trackingMap[p.parameter_name] = String(p.parameter_value);
    }
  }

  const tm  = (key: string) => trackingMap[key] || '';
  const cp  = (key: string) => String(checkoutParams[key] || '');
  const utm = (key: string) => tm(key) || cp(key);

  // nx_user priority: checkout_params identity fields → tracking attribution params
  const nxUser = String(
    checkoutParams.nx_user    ||
    checkoutParams.nx_lead_id ||
    checkoutParams.src        ||
    checkoutParams.sck        ||
    tm('src')  || tm('sck')  || tm('xcod') || tm('utm_content') ||
    ''
  );

  const cartToken: string | undefined = order.cart_token || body.cart_token || undefined;

  const firstName = order.customer?.first_name || order.address?.first_name || '';
  const lastName  = order.customer?.last_name  || order.address?.last_name  || '';
  const name      = [firstName, lastName].filter(Boolean).join(' ');

  const city    = (order.address?.city     || '').trim().toLowerCase();
  const state   = (order.address?.province || order.address?.province_code || '').trim().toLowerCase();
  const country = (order.address?.country_code || 'br').toLowerCase().substring(0, 2);
  const phone   = String(order.phone || order.customer?.phone || order.address?.phone || '').replace(/^\+/, '');

  let productName = '';
  let productId   = '';
  if (Array.isArray(order.line_items) && order.line_items.length > 0) {
    const first = order.line_items[0];
    productId   = String(first.product_id || first.id || '');
    productName = first.title || first.name || '';
  }

  let gatewayName = '';
  if (Array.isArray(order.transactions) && order.transactions.length > 0) {
    gatewayName = order.transactions[0].gateway || '';
  }

  return {
    nx_user:      nxUser,
    cart_token:   cartToken,
    email:        order.email || order.customer?.email || '',
    phone,
    name,
    order_id:     String(order.id || ''),
    value:        typeof order.total_price_in_decimal === 'number'
                    ? order.total_price_in_decimal
                    : typeof order.total_price === 'number'
                      ? order.total_price
                      : parseFloat(order.total_price) || 0,
    currency:     normalizeCurrency(order.currency),
    product_name: productName,
    product_id:   productId,
    city,
    state,
    country,
    zip:          order.address?.zip || '',
    ip:           order.browser_ip   || '',
    user_agent:   order.user_agent   || '',
    gateway:      gatewayName || 'cartpanda',
    // UTMs & Advanced Attribution
    utm_source:      utm('utm_source'),
    utm_medium:      utm('utm_medium'),
    utm_campaign:    utm('utm_campaign'),
    utm_content:     utm('utm_content'),
    utm_term:        utm('utm_term'),
    utm_id:          utm('utm_id'),
    utm_platform:    utm('utm_platform'),
    utm_network:     utm('utm_network'),
    ad_id:           utm('ad_id'),
    adset_id:        utm('adset_id'),
    campaign_id:     utm('campaign_id'),
    placement:       utm('placement'),
    creative_format: utm('creative_format'),
    conversion_type: utm('conversion_type'),
    // Click IDs forwarded via tracking_parameters
    ttclid:  tm('ttclid') || cp('ttclid'),
    ttp:     tm('_ttp')   || tm('ttp') || cp('ttp'),
    fbclid:  tm('fbclid') || cp('fbclid'),
    fbc:     tm('_fbc')   || tm('fbc') || cp('fbc'),
    fbp:     tm('_fbp')   || tm('fbp') || cp('fbp'),
    gclid:   tm('gclid')  || cp('gclid'),
    msclkid: tm('msclkid') || cp('msclkid'),
  };
}
