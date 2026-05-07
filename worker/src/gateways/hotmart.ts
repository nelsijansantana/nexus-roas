import { getNestedValue } from '../shared/helpers';
import { WebhookData } from '../types';

export function parseHotmart(body: any): WebhookData {
  // Hotmart v2 shape: data.purchase.origin.{src,xcod}
  // Hotmart v1 shape: data.{src,xcod}
  const v2Origin = getNestedValue(body, 'data.purchase.origin') || {};
  const v1Root   = getNestedValue(body, 'data') || {};

  const src  = v2Origin.src  || v1Root.src  || '';
  const xcod = v2Origin.xcod || v1Root.xcod || '';

  // nx_user priority: xcod (utm_content) > src (utm_source)
  const nxUser = xcod || src || '';

  // transaction ID: v2 vs v1 format
  const orderId = getNestedValue(body, 'data.purchase.transaction')
    || getNestedValue(body, 'data.transaction') || '';

  // Value: Hotmart commissions array (index 1 = producer's share), fallback to v1
  const value    = getNestedValue(body, 'data.commissions.1.value')    || getNestedValue(body, 'data.value')    || '';
  const currency = getNestedValue(body, 'data.commissions.1.currency_value') || getNestedValue(body, 'data.currency') || 'BRL';

  return {
    nx_user:      nxUser,
    email:        getNestedValue(body, 'data.buyer.email') || '',
    phone:        getNestedValue(body, 'data.buyer.checkout_phone') || '',
    name:         getNestedValue(body, 'data.buyer.name') || '',
    order_id:     String(orderId),
    value,
    currency,
    product_name: getNestedValue(body, 'data.product.name') || '',
    product_id:   String(getNestedValue(body, 'data.product.id') || ''),
    city:         (getNestedValue(body, 'data.buyer.address.city')    || '').toLowerCase(),
    state:        (getNestedValue(body, 'data.buyer.address.state')   || '').toLowerCase(),
    country:      getNestedValue(body, 'data.buyer.address.country_iso') || '',
    zip:          getNestedValue(body, 'data.buyer.address.zipcode')  || '',
    gateway:      'hotmart',
    // Map Hotmart-specific attribution params to standard UTMs
    utm_source:   src,
    utm_content:  xcod, // xcod is the utm_content / custom attribution token
  };
}
