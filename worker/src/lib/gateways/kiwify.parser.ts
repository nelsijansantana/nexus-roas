import {
  GatewayParser, ParsedGatewayEvent, ParsedCustomer, ParsedItem,
  s, n, get, normalizePhone, hmacSha256Verify, ts,
} from './types'

export const kiwifyParser: GatewayParser = {
  parse(body: unknown): ParsedGatewayEvent | null {
    // Kiwify value format: "12990" (last 2 digits = cents)
    const rawValue = s(get(body, 'Commissions', 'my_commission') ?? '')
    const value    = parseFloat(rawValue.replace(/(.+)(\d{2})$/, '$1.$2')) || 0
    const zipRaw   = s(get(body, 'Customer', 'zipcode') ?? '').replace(/^(\d{5}).*/, '$1')

    const tp = (k: string) => s(get(body, 'TrackingParameters', k) ?? '')

    const nxUser = tp('sck') || tp('src') || undefined

    const productId   = s(get(body, 'Product', 'product_id') ?? '')
    const productName = s(get(body, 'Product', 'product_name') ?? '')

    // Kiwify may have multiple products in some plans — use Products array if available
    const rawProducts = get(body, 'Products')
    const items: ParsedItem[] = Array.isArray(rawProducts) && rawProducts.length > 0
      ? (rawProducts as Array<Record<string, unknown>>).map(p => ({
          id:       s(p.product_id || p.id || ''),
          name:     s(p.product_name || p.name) || undefined,
          price:    value,
          quantity: 1,
        }))
      : (productId || productName
          ? [{ id: productId || productName, name: productName || undefined, price: value, quantity: 1 }]
          : [])

    const orderId = s(get(body, 'order_id') ?? '')

    const customer: ParsedCustomer = {
      email:   s(get(body, 'Customer', 'email') ?? '').toLowerCase() || undefined,
      phone:   normalizePhone(get(body, 'Customer', 'mobile')),
      city:    s(get(body, 'Customer', 'city')  ?? '') || undefined,
      state:   s(get(body, 'Customer', 'state') ?? '') || undefined,
      zip:     zipRaw || undefined,
      ip:      s(get(body, 'Customer', 'ip') ?? '') || undefined,
    }

    const nameFull = s(get(body, 'Customer', 'full_name') ?? '')
    if (nameFull) {
      const parts = nameFull.trim().split(/\s+/)
      customer.first_name = parts[0]
      customer.last_name  = parts.length > 1 ? parts[parts.length - 1] : undefined
    }

    return {
      gateway:    'kiwify',
      order_id:   orderId,
      value:      n(value),
      currency:   s(get(body, 'Commissions', 'currency') ?? 'BRL') || 'BRL',
      customer,
      items,
      nx_user:    nxUser,
      utm_source:   tp('utm_source') || tp('src') || undefined,
      utm_medium:   tp('utm_medium')   || undefined,
      utm_campaign: tp('utm_campaign') || undefined,
      utm_content:  tp('utm_content') || tp('sck') || undefined,
      utm_term:     tp('utm_term')     || undefined,
      event_id:   `purchase_${orderId}`,
      event_time: ts(),
      raw:        body,
    }
  },

  async validateHmac(payload: string, signature: string, secret: string): Promise<boolean> {
    return hmacSha256Verify(payload, signature, secret)
  },
}
