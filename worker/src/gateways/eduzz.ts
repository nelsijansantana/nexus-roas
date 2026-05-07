import { WebhookData } from '../types';

export function parseEduzz(body: any): WebhookData | null {
  // Eduzz sends paid status in trans_status (A = approved) or status field
  const status = body?.trans_status || body?.status || body?.data?.trans_status || '';
  if (status && status !== 'A' && status !== 'approved' && status !== 'paid') return null;

  const d = body?.data || body || {};

  // Value and order ID have multiple possible field names across Eduzz API versions
  const orderId = d.trans_cod || d.transaction_id || d.order_id || d.id || '';
  const rawValue = d.trans_value ?? d.value ?? d.amount ?? d.total ?? 0;
  const value = typeof rawValue === 'string' ? rawValue : String(rawValue);

  const email = (d.client_email || d.buyer_email || d.email || '').toLowerCase();
  const phone = String(d.client_phone || d.phone || d.mobile || '').replace(/^\+/, '');
  const name  = d.client_name || d.buyer_name || d.name || '';

  // UTMs from data.utm object (various key naming conventions)
  const utm = d.utm || d.tracking || {};
  const utmSrc = (k: string, alt?: string) => utm[k] || utm[alt || ''] || d[k] || '';

  const nxUser = utmSrc('content') || utmSrc('utm_content') || utmSrc('src') || utmSrc('xcod') || '';

  return {
    nx_user:      nxUser,
    email,
    phone,
    name,
    order_id:     String(orderId),
    value,
    currency:     d.currency || d.trans_currency || 'BRL',
    product_name: d.prod_name || d.product_name || d.name_product || '',
    product_id:   String(d.prod_cod || d.product_id || d.prod_id || ''),
    city:         (d.client_city   || d.city   || '').toLowerCase(),
    state:        (d.client_state  || d.state  || '').toLowerCase(),
    country:      (d.client_country || d.country || '').toLowerCase().substring(0, 2),
    zip:          d.client_zip || d.zip || d.zipcode || '',
    ip:           '',
    user_agent:   '',
    gateway:      'eduzz',
    utm_source:   utmSrc('utm_source', 'source'),
    utm_medium:   utmSrc('utm_medium', 'medium'),
    utm_campaign: utmSrc('utm_campaign', 'campaign'),
    utm_content:  utmSrc('utm_content', 'content'),
    utm_term:     utmSrc('utm_term', 'term'),
  };
}
