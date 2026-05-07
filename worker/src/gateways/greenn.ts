import { WebhookData } from '../types';

export function parseGreenn(body: any): WebhookData | null {
  const currentStatus = body?.currentStatus || body?.sale?.status;
  if (currentStatus !== 'paid') return null;

  const sale    = body?.sale;
  const client  = body?.client;
  const product = body?.product;
  if (!sale || !client) return null;

  // Greenn forwards any URL param passed to the checkout page via saleMetas.
  // This includes UTMs and click IDs set by the pixel link-decorator.
  const metas: Record<string, string> = {};
  if (Array.isArray(body?.saleMetas)) {
    for (const m of body.saleMetas) {
      if (m?.meta_key && m?.meta_value != null) {
        metas[String(m.meta_key)] = String(m.meta_value);
      }
    }
  }

  const meta = (k: string) => metas[k] || '';

  // nx_user priority: nx_user > src > sck > xcod > utm_content
  const nxUser = meta('nx_user') || meta('src') || meta('sck') || meta('xcod') || meta('utm_content') || '';

  const phone = String(client.cellphone || client.phone || '').replace(/^\+/, '');

  return {
    nx_user:      nxUser,
    email:        client.email      || '',
    phone,
    name:         client.name       || '',
    order_id:     String(sale.id    || ''),
    value:        parseFloat(sale.total ?? sale.amount ?? 0) || 0,
    currency:     'BRL',
    product_name: product?.name     || '',
    product_id:   String(product?.id || ''),
    city:         (client.city      || '').toLowerCase(),
    state:        (client.uf        || '').toLowerCase(),
    country:      'br',
    zip:          client.zipcode    || '',
    ip:           '',
    user_agent:   '',
    gateway:      'greenn',
    // Full UTM suite from saleMetas
    utm_source:   meta('utm_source'),
    utm_medium:   meta('utm_medium'),
    utm_campaign: meta('utm_campaign'),
    utm_content:  meta('utm_content'),
    utm_term:     meta('utm_term'),
    utm_id:       meta('utm_id'),
    // Click IDs captured by pixel link-decorator and forwarded via Greenn checkout params
    fbclid:  meta('fbclid'),
    fbc:     meta('fbc')  || meta('_fbc'),
    fbp:     meta('fbp')  || meta('_fbp'),
    gclid:   meta('gclid'),
    ttclid:  meta('ttclid'),
    ttp:     meta('ttp')  || meta('_ttp'),
    msclkid: meta('msclkid'),
    twclid:  meta('twclid'),
  };
}
