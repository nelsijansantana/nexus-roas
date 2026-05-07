import { WebhookData } from '../types';

export function parsePayt(body: any): WebhookData | null {
  // Payt paid status: 'paid', 'approved', 'complete'
  const status = body?.status || body?.payment_status || '';
  if (status && !['paid', 'approved', 'complete', 'confirmed'].includes(status.toLowerCase())) return null;

  const orderId = body?.transaction_id || body?.order_id || body?.id || '';
  const rawValue = body?.amount || body?.total || body?.value || 0;
  const value = typeof rawValue === 'number' ? String(rawValue) : rawValue;

  const customer = body?.customer || body?.buyer || body || {};
  const email = (customer.email || '').toLowerCase();
  const phone = String(customer.phone || customer.mobile || customer.celular || '').replace(/^\+/, '');
  const name  = customer.name || customer.full_name || customer.nome || '';

  const nxUser =
    body?.src || body?.xcod || body?.nx_user ||
    body?.utm_content || body?.sck || '';

  return {
    nx_user:      nxUser,
    email,
    phone,
    name,
    order_id:     String(orderId),
    value,
    currency:     body?.currency || 'BRL',
    product_name: body?.product_name || body?.product?.name || '',
    product_id:   String(body?.product_id || body?.product?.id || ''),
    city:    '',
    state:   '',
    country: '',
    zip:     '',
    ip:      '',
    user_agent: '',
    gateway:  'payt',
    utm_source:   body?.utm_source   || '',
    utm_medium:   body?.utm_medium   || '',
    utm_campaign: body?.utm_campaign || '',
    utm_content:  body?.utm_content  || body?.xcod || '',
    utm_term:     body?.utm_term     || '',
  };
}
