import {
  GatewayParser, ParsedGatewayEvent, ParsedCustomer, ParsedItem,
  s, n, get, normalizePhone, ts,
} from './types'

export const lastlinkParser: GatewayParser = {
  parse(body: unknown): ParsedGatewayEvent | null {
    // Lastlink uses PascalCase fields
    const utmS = (k: string) => s(get(body, 'Data', 'Utm', k) ?? '')
    const phone = s(get(body, 'Data', 'Buyer', 'PhoneNumber') ?? '').replace(/^\+?/, '')
    const zipRaw = s(get(body, 'Data', 'Buyer', 'Address', 'ZipCode') ?? '').replace(/(\d{5}).*/, '$1')

    const customer: ParsedCustomer = {
      email:   s(get(body, 'Data', 'Buyer', 'Email') ?? '').toLowerCase() || undefined,
      phone:   normalizePhone(phone),
      city:    s(get(body, 'Data', 'Buyer', 'Address', 'City')    ?? '').toLowerCase() || undefined,
      state:   s(get(body, 'Data', 'Buyer', 'Address', 'State')   ?? '') || undefined,
      country: s(get(body, 'Data', 'Buyer', 'Address', 'Country') ?? '') || undefined,
      zip:     zipRaw || undefined,
      ip:      s(get(body, 'Data', 'DeviceInfo', 'ip') ?? get(body, 'Data', 'Device', 'Ip') ?? '') || undefined,
      user_agent: s(get(body, 'Data', 'DeviceInfo', 'UserAgent') ?? '') || undefined,
    }

    const nameFull = s(get(body, 'Data', 'Buyer', 'Name') ?? '')
    if (nameFull) {
      const parts = nameFull.trim().split(/\s+/)
      customer.first_name = parts[0]
      customer.last_name  = parts.length > 1 ? parts[parts.length - 1] : undefined
    }

    const productId   = s(get(body, 'Data', 'Products', '0', 'Id')   ?? '')
    const productName = s(get(body, 'Data', 'Products', '0', 'Name') ?? '')
    const value = n(get(body, 'Data', 'Purchase', 'OriginalPrice', 'Value') ?? 0)
    const items: ParsedItem[] = productId || productName
      ? [{ id: productId || productName, name: productName || undefined, price: value, quantity: 1 }]
      : []

    const orderId = s(get(body, 'Data', 'Purchase', 'PaymentId') ?? '')

    return {
      gateway:    'lastlink',
      order_id:   orderId,
      value,
      currency:   'BRL',
      customer,
      items,
      nx_user:    utmS('UtmId') || utmS('Src') || utmS('Xcod') || undefined,
      utm_source:   utmS('UtmSource')   || undefined,
      utm_medium:   utmS('UtmMedium')   || undefined,
      utm_campaign: utmS('UtmCampaign') || undefined,
      utm_content:  utmS('UtmContent')  || undefined,
      utm_term:     utmS('UtmTerm')     || undefined,
      event_id:   `purchase_${orderId}`,
      event_time: ts(),
      raw:        body,
    }
  },
}
