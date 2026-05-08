import {
  GatewayParser, ParsedGatewayEvent, ParsedCustomer, ParsedItem,
  s, n, get, normalizePhone, ts,
} from './types'

export const kirvanoParser: GatewayParser = {
  parse(body: unknown): ParsedGatewayEvent | null {
    // Kirvano value: "BRL 129.90" — split currency prefix
    const totalPrice = s(get(body, 'data', 'total_price') ?? '')
    const currency   = totalPrice.match(/^([A-Z]+)/)?.[1] || 'BRL'
    const value      = n(totalPrice.replace(/^[A-Z]+\s*/, ''))

    const utm = (k: string) => s(get(body, 'data', 'utm', k) ?? '')

    const customer: ParsedCustomer = {
      email: s(get(body, 'data', 'customer', 'email') ?? '').toLowerCase() || undefined,
      phone: normalizePhone(get(body, 'data', 'customer', 'phone_number')),
    }

    const nameFull = s(get(body, 'data', 'customer', 'name') ?? '')
    if (nameFull) {
      const parts = nameFull.trim().split(/\s+/)
      customer.first_name = parts[0]
      customer.last_name  = parts.length > 1 ? parts[parts.length - 1] : undefined
    }

    // Kirvano may have multiple products
    const rawProducts = get(body, 'data', 'products')
    const items: ParsedItem[] = Array.isArray(rawProducts) && rawProducts.length > 0
      ? (rawProducts as Array<Record<string, unknown>>).map(p => ({
          id:       s(p.id || ''),
          name:     s(p.name) || undefined,
          price:    n(p.price || value),
          quantity: n(p.quantity || 1),
        }))
      : (() => {
          const pid  = s(get(body, 'data', 'products', '0', 'id') ?? '')
          const pname = s(get(body, 'data', 'products', '0', 'name') ?? '')
          return pid || pname ? [{ id: pid || pname, name: pname || undefined, price: value, quantity: 1 }] : []
        })()

    const orderId = s(get(body, 'data', 'sale_id') ?? '')

    return {
      gateway:    'kirvano',
      order_id:   orderId,
      value,
      currency,
      customer,
      items,
      nx_user:    utm('nx_user') || utm('src') || utm('xcod') || utm('utm_content') || undefined,
      fbclid:     utm('fbclid') || undefined,
      fbc:        utm('fbc') || utm('_fbc') || undefined,
      fbp:        utm('fbp') || utm('_fbp') || undefined,
      gclid:      utm('gclid')  || undefined,
      ttclid:     utm('ttclid') || undefined,
      ttp:        utm('ttp') || utm('_ttp') || undefined,
      msclkid:    utm('msclkid') || undefined,
      utm_source:   utm('utm_source')   || undefined,
      utm_medium:   utm('utm_medium')   || undefined,
      utm_campaign: utm('utm_campaign') || undefined,
      utm_content:  utm('utm_content')  || undefined,
      utm_term:     utm('utm_term')     || undefined,
      utm_id:       utm('utm_id')       || undefined,
      event_id:   `purchase_${orderId}`,
      event_time: ts(),
      raw:        body,
    }
  },
}
