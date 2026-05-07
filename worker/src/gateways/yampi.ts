import { WebhookData } from '../types';

/**
 * Yampi — Brazilian e-commerce platform.
 * Webhook payload uses nested resource structure: body.resource (or body.data).
 * Metadata stored as array of {key, value} objects.
 */
export function parseYampi(body: any): WebhookData | null {
  // Only process paid orders
  if (body?.event && body.event !== 'order.paid') return null;

  const r = body?.resource || body?.data || body;
  if (!r?.id) return null;

  // Metadata helper — searches the metadata array by key
  const metadata: any[] = r?.metadata?.data || r?.metadata || [];
  const metaVal = (key: string): string => {
    const found = metadata.find((m: any) => m?.key === key);
    return found?.value ? String(found.value) : '';
  };

  // Customer data (nested resource structure)
  const customer = r?.customer?.data || r?.customer || {};
  const email    = (customer.email || r?.email || '').toLowerCase();
  const phone    = String(customer?.phone?.full_number || customer.phone || r?.phone || '').replace(/^\+/, '');
  const firstName = customer.first_name || r?.first_name || '';
  const lastName  = customer.last_name  || r?.last_name  || '';
  const name      = [firstName, lastName].filter(Boolean).join(' ');

  // Shipping address
  const addr    = r?.shipping_address?.data || r?.shipping_address || r?.address || {};
  const city    = addr?.city    || r?.city    || '';
  const state   = addr?.uf      || addr?.state || r?.state || '';
  const country = (addr?.country || r?.country || 'BR').toUpperCase().substring(0, 2);
  const zip     = addr?.zip_code || addr?.zipcode || r?.zipcode || '';

  // Items
  const items = r?.items?.data || r?.items || [];

  // nx_user from metadata
  const nxUser = metaVal('_nx_user') || metaVal('nx_user') ||
    r?.utm_content || r?.xcod || r?.src || '';

  // UTMs: root-level fields first, then metadata fallback
  const utm_source   = r?.utm_source   || metaVal('utm_source')   || '';
  const utm_medium   = r?.utm_medium   || metaVal('utm_medium')   || '';
  const utm_campaign = r?.utm_campaign || metaVal('utm_campaign') || '';
  const utm_content  = r?.utm_content  || metaVal('utm_content')  || '';
  const utm_term     = r?.utm_term     || metaVal('utm_term')     || '';

  // Click IDs from metadata (pixel link-decorator appends to checkout URL)
  const fbclid  = metaVal('fbclid');
  const fbc     = metaVal('_fbc') || metaVal('fbc');
  const fbp     = metaVal('_fbp') || metaVal('fbp');
  const gclid   = metaVal('_gclid') || metaVal('gclid');
  const ttclid  = metaVal('_ttclid') || metaVal('ttclid');
  const ttp     = metaVal('_ttp') || metaVal('ttp');
  const msclkid = metaVal('msclkid');
  const twclid  = metaVal('twclid');

  // GA4 client ID from _ga metadata (format: "GA4_PROP.GA_CLIENT_ID")
  const gaRaw       = metaVal('_ga');
  const gaParts     = gaRaw.split('.');
  const ga_client_id = gaParts.length >= 4 ? `${gaParts[2]}.${gaParts[3]}` : gaRaw;

  // First product info
  const firstItem = items[0] || {};
  const productId  = String(firstItem.product_id || firstItem.sku_id || r?.product_id || '');
  const productName = firstItem.title || firstItem.name || r?.product_name || '';

  return {
    nx_user:      nxUser,
    email,
    phone,
    name,
    order_id:     String(r.id),
    value:        parseFloat(r.value_total || r.total || r.amount || 0) || 0,
    currency:     r.currency || 'BRL',
    product_name: productName,
    product_id:   productId,
    city:         city.toLowerCase(),
    state:        state.toLowerCase(),
    country:      country.toLowerCase(),
    zip,
    ip:           r.ip || customer.ip || '',
    user_agent:   r.user_agent || '',
    gateway:      'yampi',
    utm_source,
    utm_medium,
    utm_campaign,
    utm_content,
    utm_term,
    fbclid,
    fbc,
    fbp,
    gclid,
    ttclid,
    ttp,
    msclkid,
    twclid,
    ga_client_id: ga_client_id || undefined,
  };
}
