import {
  GatewayParser, ParsedGatewayEvent, ParsedCustomer, ParsedItem,
  s, n, normalizePhone, hmacSha256Verify, ts,
} from './types'

const PAID_EVENTS = new Set(['order.paid', 'order_paid', 'paid', 'approved', 'order.approved', 'purchase'])

const CURRENCY_MAP: Record<string, string> = {
  'R$': 'BRL', '$': 'USD', '€': 'EUR', '£': 'GBP',
}
function normalizeCurrency(raw: unknown): string {
  const t = s(raw).trim()
  return CURRENCY_MAP[t] ?? (t.length === 3 ? t.toUpperCase() : 'BRL')
}

export const cartpandaParser: GatewayParser = {
  parse(body: unknown): ParsedGatewayEvent | null {
    const b = body as Record<string, unknown>
    if (!b.event || !b.order) return null
    if (!PAID_EVENTS.has(s(b.event))) return null

    const order = b.order as Record<string, unknown>
    const trackingParams = Array.isArray(b.tracking_parameters)
      ? b.tracking_parameters as Array<Record<string, unknown>>
      : Array.isArray(order.tracking_parameters)
        ? order.tracking_parameters as Array<Record<string, unknown>>
        : []

    const checkoutParams = ((b.checkout_params ?? order.checkout_params ?? {}) as Record<string, unknown>)

    const trackingMap: Record<string, string> = {}
    for (const p of trackingParams) {
      if (p.parameter_name && p.parameter_value != null) {
        trackingMap[s(p.parameter_name)] = s(p.parameter_value)
      }
    }

    const tm  = (k: string) => trackingMap[k] || ''
    const cp  = (k: string) => s(checkoutParams[k])
    const utm = (k: string) => tm(k) || cp(k)

    const address = (order.address ?? {}) as Record<string, unknown>
    const customerData = (order.customer ?? {}) as Record<string, unknown>

    const customer: ParsedCustomer = {
      email:      s(order.email || customerData.email).toLowerCase() || undefined,
      phone:      normalizePhone(order.phone ?? customerData.phone ?? address.phone),
      first_name: s(customerData.first_name || address.first_name) || undefined,
      last_name:  s(customerData.last_name  || address.last_name)  || undefined,
      city:       s(address.city     || '').toLowerCase() || undefined,
      state:      s(address.province || address.province_code || '').toLowerCase() || undefined,
      country:    s(address.country_code || '').toLowerCase().substring(0, 2) || undefined,
      zip:        s(address.zip) || undefined,
      ip:         s(order.browser_ip) || undefined,
    }

    const lineItems = Array.isArray(order.line_items)
      ? (order.line_items as Array<Record<string, unknown>>)
      : []
    const items: ParsedItem[] = lineItems.map(li => ({
      id:       s(li.product_id || li.id || ''),
      name:     s(li.title || li.name) || undefined,
      price:    n(li.price),
      quantity: n(li.quantity || 1),
    }))

    const orderId = s(order.id || '')

    return {
      gateway:   'cartpanda',
      order_id:  orderId,
      value:     typeof order.total_price_in_decimal === 'number'
        ? n(order.total_price_in_decimal)
        : n(order.total_price),
      currency:  normalizeCurrency(order.currency),
      customer,
      items,
      cart_token: s(order.cart_token || b.cart_token) || undefined,

      nx_user: s(
        checkoutParams.nx_user    ||
        checkoutParams.nx_lead_id ||
        checkoutParams.src        ||
        checkoutParams.sck        ||
        tm('src') || tm('sck') || tm('xcod') || tm('utm_content') || '',
      ) || undefined,

      fbclid:  tm('fbclid') || cp('fbclid') || undefined,
      fbc:     tm('_fbc') || tm('fbc') || cp('fbc') || undefined,
      fbp:     tm('_fbp') || tm('fbp') || cp('fbp') || undefined,
      gclid:   tm('gclid')  || cp('gclid')  || undefined,
      ttclid:  tm('ttclid') || cp('ttclid') || undefined,
      ttp:     tm('_ttp') || tm('ttp') || cp('ttp') || undefined,
      msclkid: tm('msclkid') || cp('msclkid') || undefined,

      utm_source:      utm('utm_source')      || undefined,
      utm_medium:      utm('utm_medium')      || undefined,
      utm_campaign:    utm('utm_campaign')    || undefined,
      utm_content:     utm('utm_content')     || undefined,
      utm_term:        utm('utm_term')        || undefined,
      utm_id:          utm('utm_id')          || undefined,
      utm_platform:    utm('utm_platform')    || undefined,
      utm_network:     utm('utm_network')     || undefined,
      ad_id:           utm('ad_id')           || undefined,
      adset_id:        utm('adset_id')        || undefined,
      campaign_id:     utm('campaign_id')     || undefined,
      placement:       utm('placement')       || undefined,
      creative_format: utm('creative_format') || undefined,
      conversion_type: utm('conversion_type') || undefined,

      event_id:   `purchase_${orderId}`,
      event_time: ts(),
      raw:        body,
    }
  },

  async validateHmac(payload: string, signature: string, secret: string): Promise<boolean> {
    return hmacSha256Verify(payload, signature, secret)
  },
}
