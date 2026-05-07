import { getNestedValue } from '../shared/helpers';
import { WebhookData } from '../types';

export function parseLastlink(body: any): WebhookData {
  // Lastlink uses PascalCase for Utm fields (Data.Utm.UtmSource, etc.)
  const utmSrc = (k: string) => String(getNestedValue(body, `Data.Utm.${k}`) || '');

  const phone = String(getNestedValue(body, 'Data.Buyer.PhoneNumber') || '').replace(/^\+?/, '');
  const zip   = String(getNestedValue(body, 'Data.Buyer.Address.ZipCode') || '').replace(/(\d{5}).*/, '$1');

  // nx_user priority: UtmId (legacy) > Src > Xcod > utm_content
  const nxUser = utmSrc('UtmId') || utmSrc('Src') || utmSrc('Xcod') || '';

  return {
    nx_user:      nxUser,
    email:        (getNestedValue(body, 'Data.Buyer.Email') || '').toLowerCase(),
    phone,
    name:         (getNestedValue(body, 'Data.Buyer.Name') || '').toLowerCase(),
    order_id:     getNestedValue(body, 'Data.Purchase.PaymentId') || '',
    value:        getNestedValue(body, 'Data.Purchase.OriginalPrice.Value'),
    currency:     'BRL',
    product_name: getNestedValue(body, 'Data.Products.0.Name') || '',
    product_id:   String(getNestedValue(body, 'Data.Products.0.Id') || ''),
    city:         (getNestedValue(body, 'Data.Buyer.Address.City') || '').toLowerCase(),
    state:        getNestedValue(body, 'Data.Buyer.Address.State') || '',
    country:      getNestedValue(body, 'Data.Buyer.Address.Country') || '',
    zip,
    ip:           getNestedValue(body, 'Data.DeviceInfo.ip') || getNestedValue(body, 'Data.Device.Ip') || '',
    user_agent:   getNestedValue(body, 'Data.DeviceInfo.UserAgent') || '',
    gateway:      'lastlink',
    // Full UTM suite from PascalCase Utm object
    utm_source:   utmSrc('UtmSource'),
    utm_medium:   utmSrc('UtmMedium'),
    utm_campaign: utmSrc('UtmCampaign'),
    utm_content:  utmSrc('UtmContent'),
    utm_term:     utmSrc('UtmTerm'),
  };
}
