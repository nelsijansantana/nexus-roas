import { getNestedValue } from '../shared/helpers';
import { WebhookData } from '../types';

export function parseHubla(body: any): WebhookData {
  const urlString = getNestedValue(body, 'event.invoice.paymentSession.url') || '';

  let nxUser = '';
  let utm_source = '', utm_medium = '', utm_campaign = '', utm_content = '', utm_term = '';
  let fbclid = '', gclid = '', ttclid = '', msclkid = '';

  if (urlString) {
    try {
      const sp = new URL(urlString).searchParams;
      nxUser       = sp.get('xcod') || sp.get('src') || sp.get('nx_user') || '';
      utm_source   = sp.get('utm_source')   || '';
      utm_medium   = sp.get('utm_medium')   || '';
      utm_campaign = sp.get('utm_campaign') || '';
      utm_content  = sp.get('utm_content')  || sp.get('xcod') || '';
      utm_term     = sp.get('utm_term')     || '';
      fbclid       = sp.get('fbclid')  || '';
      gclid        = sp.get('gclid')   || '';
      ttclid       = sp.get('ttclid')  || '';
      msclkid      = sp.get('msclkid') || '';
    } catch (_) {}
  }

  const firstName = getNestedValue(body, 'event.invoice.payer.firstName') || '';
  const lastName  = getNestedValue(body, 'event.invoice.payer.lastName')  || '';
  const totalCents = getNestedValue(body, 'event.invoice.amount.totalCents');
  const value = totalCents ? (Number(totalCents) / 100).toFixed(2) : '';
  const phone = String(getNestedValue(body, 'event.invoice.payer.phone') || '').replace(/^\+/, '');

  return {
    nx_user:      nxUser,
    email:        getNestedValue(body, 'event.invoice.payer.email') || '',
    phone,
    name:         [firstName, lastName].filter(Boolean).join(' '),
    order_id:     getNestedValue(body, 'event.invoice.id') || '',
    value,
    currency:     getNestedValue(body, 'event.invoice.currency') || 'BRL',
    product_name: getNestedValue(body, 'event.product.name') || getNestedValue(body, 'event.products.0.name') || '',
    product_id:   String(getNestedValue(body, 'event.product.id') || getNestedValue(body, 'event.products.0.id') || ''),
    city:    '',
    state:   '',
    country: '',
    zip:     '',
    ip:         getNestedValue(body, 'event.invoice.paymentSession.ip') || '',
    user_agent: getNestedValue(body, 'event.invoice.paymentSession.userAgent') || '',
    gateway:    'hubla',
    utm_source,
    utm_medium,
    utm_campaign,
    utm_content,
    utm_term,
    fbclid,
    gclid,
    ttclid,
    msclkid,
  };
}
