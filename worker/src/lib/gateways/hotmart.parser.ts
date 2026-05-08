import {
  GatewayParser, ParsedGatewayEvent, ParsedCustomer, ParsedItem,
  s, n, get, normalizePhone, ts,
} from './types'

function parseHotmartBody(body: unknown, gatewayName: string): ParsedGatewayEvent {
  const v2Origin = (get(body, 'data', 'purchase', 'origin') ?? {}) as Record<string, unknown>
  const v1Root   = (get(body, 'data') ?? {}) as Record<string, unknown>

  const src  = s(v2Origin.src  || v1Root.src  || '')
  const xcod = s(v2Origin.xcod || v1Root.xcod || '')

  const orderId = s(
    get(body, 'data', 'purchase', 'transaction') ??
    get(body, 'data', 'transaction') ?? '',
  )

  const value    = n(get(body, 'data', 'commissions', '1', 'value') ?? get(body, 'data', 'value') ?? 0)
  const currency = s(get(body, 'data', 'commissions', '1', 'currency_value') ?? get(body, 'data', 'currency') ?? 'BRL')

  const buyerAddress = (get(body, 'data', 'buyer', 'address') ?? {}) as Record<string, unknown>
  const customer: ParsedCustomer = {
    email:   s(get(body, 'data', 'buyer', 'email') ?? '').toLowerCase() || undefined,
    phone:   normalizePhone(get(body, 'data', 'buyer', 'checkout_phone')),
    first_name: undefined,
    last_name:  undefined,
    city:    s(buyerAddress.city).toLowerCase() || undefined,
    state:   s(buyerAddress.state).toLowerCase() || undefined,
    country: s(buyerAddress.country_iso) || undefined,
    zip:     s(buyerAddress.zipcode) || undefined,
  }

  const nameFull = s(get(body, 'data', 'buyer', 'name') ?? '')
  if (nameFull) {
    const parts = nameFull.trim().split(/\s+/)
    customer.first_name = parts[0]
    customer.last_name  = parts.length > 1 ? parts[parts.length - 1] : undefined
  }

  const productId   = s(get(body, 'data', 'product', 'id') ?? '')
  const productName = s(get(body, 'data', 'product', 'name') ?? '')
  const items: ParsedItem[] = productId || productName
    ? [{ id: productId || productName, name: productName || undefined, price: value, quantity: 1 }]
    : []

  return {
    gateway:    gatewayName,
    order_id:   orderId,
    value,
    currency,
    customer,
    items,
    nx_user:      xcod || src || undefined,
    utm_source:   src  || undefined,
    utm_content:  xcod || undefined,
    event_id:     `purchase_${orderId}`,
    event_time:   ts(),
    raw:          body,
  }
}

export const hotmartParser: GatewayParser = {
  parse(body: unknown): ParsedGatewayEvent | null {
    return parseHotmartBody(body, 'hotmart')
  },
}

export const pagtrustParser: GatewayParser = {
  parse(body: unknown): ParsedGatewayEvent | null {
    const result = parseHotmartBody(body, 'pagtrust')
    return result
  },
}
