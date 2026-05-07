import { WebhookData } from '../types';

// Ticto v2 — only 'authorized' represents a confirmed paid purchase.
// Field paths confirmed from backend/src/webhooks/ticto/ticto.service.ts
const PAID_STATUSES = new Set(['authorized']);

function notInformed(v: any): boolean {
  return !v || String(v).trim() === '' || String(v).trim() === 'Não Informado';
}

/**
 * Returns null when the event is not a purchase (non-authorized status).
 * The webhook handler skips CAPI dispatch when null is returned.
 */
export function parseTicto(body: any): WebhookData | null {
  const status   = body?.status;
  const order    = body?.order;
  const customer = body?.customer;
  const tracking = body?.tracking;
  const item     = body?.item;

  if (!status || !order) return null;
  if (!PAID_STATUSES.has(status)) return null;

  const urlParams = body?.url_params?.query_params ?? body?.url_params ?? {};

  // Lead identity priority: tracking.src > tracking.sck > url_params.src/sck
  let nxUser = '';
  if (!notInformed(tracking?.src))       nxUser = tracking.src;
  else if (!notInformed(tracking?.sck))  nxUser = tracking.sck;
  else if (!notInformed(urlParams.src))  nxUser = urlParams.src;
  else if (!notInformed(urlParams.sck))  nxUser = urlParams.sck;

  // UTMs from tracking object or url_params fallback
  function t(key: string): string {
    const v = tracking?.[key] ?? urlParams[key] ?? '';
    return notInformed(v) ? '' : String(v);
  }

  // Phone reconstruction from Ticto split fields: ddi + ddd + number
  let phone = '';
  const ddi    = customer?.phone?.ddi    || '55';
  const ddd    = customer?.phone?.ddd    || body?.phone_local_code_customer || '';
  const number = customer?.phone?.number || body?.phone_number_customer     || body?.telefone || '';
  if (ddd && number) {
    phone = `${ddi}${ddd}${number}`.replace(/\D/g, '');
  }

  // Ticto sends amount in cents
  const rawAmount = order?.amount ?? order?.total ?? 0;
  const value = (
    typeof rawAmount === 'number' ? rawAmount / 100 : parseFloat(rawAmount) / 100
  ).toFixed(2);

  return {
    nx_user:      nxUser,
    email:        customer?.email || '',
    phone,
    name:         customer?.name  || '',
    order_id:     String(order?.id || ''),
    value,
    currency:     'BRL',
    product_name: item?.name || '',
    product_id:   String(item?.id  || ''),
    city:         (customer?.address?.city    || '').toLowerCase(),
    state:        (customer?.address?.state   || '').toLowerCase(),
    country:      (customer?.address?.country || '').toLowerCase(),
    zip:          customer?.address?.zip_code || '',
    ip:           '',
    user_agent:   '',
    gateway:      'ticto',
    utm_source:   t('utm_source'),
    utm_medium:   t('utm_medium'),
    utm_campaign: t('utm_campaign'),
    utm_content:  t('utm_content'),
    utm_term:     t('utm_term'),
    utm_id:       t('utm_id'),
    fbclid:       t('fbclid'),
    gclid:        t('gclid'),
    ttclid:       t('ttclid'),
  };
}
