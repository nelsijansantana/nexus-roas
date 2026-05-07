import { getNestedValue } from '../shared/helpers';
import { WebhookData } from '../types';

export function parseKiwify(body: any): WebhookData {
  // Kiwify value format: "12990" (last 2 digits = cents) → "129.90"
  const rawValue = String(getNestedValue(body, 'Commissions.my_commission') || '');
  const value    = rawValue.replace(/(.+)(\d{2})$/, '$1.$2');

  const zip = String(getNestedValue(body, 'Customer.zipcode') || '').replace(/^(\d{5}).*/, '$1');

  // nx_user: sck (CartPanda-style) → src (standard)
  const nxUser = getNestedValue(body, 'TrackingParameters.sck') || getNestedValue(body, 'TrackingParameters.src') || '';

  const tp = (k: string) => String(getNestedValue(body, `TrackingParameters.${k}`) || '');

  return {
    nx_user:      nxUser,
    email:        getNestedValue(body, 'Customer.email') || '',
    phone:        String(getNestedValue(body, 'Customer.mobile') || '').replace(/^\+?/, ''),
    name:         getNestedValue(body, 'Customer.full_name') || '',
    order_id:     getNestedValue(body, 'order_id') || '',
    value,
    currency:     getNestedValue(body, 'Commissions.currency') || 'BRL',
    product_name: getNestedValue(body, 'Product.product_name') || '',
    product_id:   String(getNestedValue(body, 'Product.product_id') || ''),
    city:         getNestedValue(body, 'Customer.city')  || '',
    state:        getNestedValue(body, 'Customer.state') || '',
    country:      '',
    zip,
    ip:           getNestedValue(body, 'Customer.ip') || '',
    gateway:      'kiwify',
    // Kiwify TrackingParameters
    utm_source:   tp('utm_source') || tp('src'),
    utm_medium:   tp('utm_medium'),
    utm_campaign: tp('utm_campaign'),
    utm_content:  tp('utm_content') || tp('sck'),
    utm_term:     tp('utm_term'),
  };
}
