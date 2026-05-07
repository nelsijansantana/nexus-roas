import { getNestedValue } from '../shared/helpers';
import { WebhookData } from '../types';

export function parseKirvano(body: any): WebhookData {
  // Kirvano sends value as "BRL 129.90" — split currency prefix from value
  const totalPrice = String(getNestedValue(body, 'data.total_price') || '');
  const currency   = totalPrice.match(/^([A-Z]+)/)?.[1] || 'BRL';
  const value      = totalPrice.replace(/^[A-Z]+\s*/, '');

  const utm = (k: string) => String(getNestedValue(body, `data.utm.${k}`) || '');

  // nx_user priority: nx_user > src > xcod > utm_content
  const nxUser = utm('nx_user') || utm('src') || utm('xcod') || utm('utm_content') || '';

  return {
    nx_user:      nxUser,
    email:        (getNestedValue(body, 'data.customer.email') || '').toLowerCase(),
    phone:        String(getNestedValue(body, 'data.customer.phone_number') || ''),
    name:         (getNestedValue(body, 'data.customer.name') || '').toLowerCase(),
    order_id:     getNestedValue(body, 'data.sale_id') || '',
    value,
    currency,
    product_name: getNestedValue(body, 'data.products.0.name') || '',
    product_id:   String(getNestedValue(body, 'data.products.0.id') || ''),
    city:    '',
    state:   '',
    country: '',
    zip:     '',
    gateway: 'kirvano',
    // Full UTM suite from data.utm
    utm_source:   utm('utm_source'),
    utm_medium:   utm('utm_medium'),
    utm_campaign: utm('utm_campaign'),
    utm_content:  utm('utm_content'),
    utm_term:     utm('utm_term'),
    utm_id:       utm('utm_id'),
    // Click IDs from data.utm (pixel link-decorator forwards these to Kirvano checkout)
    fbclid:  utm('fbclid'),
    fbc:     utm('fbc') || utm('_fbc'),
    fbp:     utm('fbp') || utm('_fbp'),
    gclid:   utm('gclid'),
    ttclid:  utm('ttclid'),
    ttp:     utm('ttp') || utm('_ttp'),
    msclkid: utm('msclkid'),
  };
}
