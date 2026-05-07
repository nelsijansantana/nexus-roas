import { WebhookData } from '../types';

export function parsePerfectPay(body: any): WebhookData | null {
  // PerfectPay status: 'approved', 'paid', 'complete', 'ORDER_APPROVED'
  const status = body?.status || body?.sale_status || body?.order_status || '';
  if (status && !['approved', 'paid', 'complete', 'order_approved', 'confirmed'].includes(status.toLowerCase())) return null;

  const orderId = body?.code || body?.sale_id || body?.transaction_id || body?.order_id || body?.id || '';
  const rawValue = body?.sale_amount || body?.amount || body?.total || body?.value || 0;
  const value = typeof rawValue === 'number' ? String(rawValue) : rawValue;

  const customer = body?.customer || body?.buyer || body?.client || {};
  const email = (customer.email || body?.email || '').toLowerCase();
  const phone = String(customer.phone || customer.mobile || body?.phone || '').replace(/^\+/, '');
  const name  = customer.name || customer.full_name || body?.name || '';

  // Metadata can be a nested object or in root
  const meta = body?.metadata || body?.tracking || body || {};

  const nxUser =
    meta?.utm_perfect || meta?.src || meta?.xcod || meta?.nx_user ||
    meta?.utm_content || body?.src || '';

  return {
    nx_user:      nxUser,
    email,
    phone,
    name,
    order_id:     String(orderId),
    value,
    currency:     body?.currency || meta?.currency || 'BRL',
    product_name: body?.product_name || body?.product?.name || meta?.product_name || '',
    product_id:   String(body?.product_id || body?.product?.id || meta?.product_id || ''),
    city:    '',
    state:   '',
    country: '',
    zip:     '',
    ip:      '',
    user_agent: '',
    gateway:  'perfectpay',
    utm_source:   meta?.utm_source   || body?.utm_source   || '',
    utm_medium:   meta?.utm_medium   || body?.utm_medium   || '',
    utm_campaign: meta?.utm_campaign || body?.utm_campaign || '',
    utm_content:  meta?.utm_content  || meta?.xcod         || body?.utm_content || '',
    utm_term:     meta?.utm_term     || body?.utm_term     || '',
  };
}
