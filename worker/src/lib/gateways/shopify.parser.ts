import {
  GatewayParser, ParsedGatewayEvent, ParsedCustomer, ParsedItem,
  s, n, get, normalizePhone, hmacSha256Verify, ts,
} from './types'

const PURCHASE_TOPICS = new Set(['orders/paid'])

export const shopifyParser: GatewayParser = {
  parse(body: unknown): ParsedGatewayEvent | null {
    const order = body as Record<string, unknown>
    const topic = s(order.__topic)
    if (topic && !PURCHASE_TOPICS.has(topic)) return null
    if (!order.id) return null

    // note_attributes array → map
    const noteAttrs: Record<string, string> = {}
    if (Array.isArray(order.note_attributes)) {
      for (const attr of order.note_attributes as Array<Record<string, unknown>>) {
        if (attr.name && attr.value != null) noteAttrs[s(attr.name)] = s(attr.value)
      }
    }
    const note = (k: string) => noteAttrs[k] || ''

    // UTM from note_attributes or landing_site
    let landingUtm: Record<string, string> = {}
    if (s(order.landing_site).includes('?')) {
      try {
        const sp = new URLSearchParams(s(order.landing_site).split('?').slice(1).join('?'))
        ;['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach(k => {
          const v = sp.get(k)
          if (v) landingUtm[k] = v
        })
      } catch { /* ignore malformed URL */ }
    }
    const utm = (k: string) => note(k) || landingUtm[k] || ''

    const billing  = (order.billing_address  ?? {}) as Record<string, unknown>
    const shipping = (order.shipping_address ?? {}) as Record<string, unknown>
    const clientDetails = (order.client_details ?? {}) as Record<string, unknown>

    const customer: ParsedCustomer = {
      email:      s(order.email || order.contact_email).toLowerCase() || undefined,
      phone:      normalizePhone(billing.phone ?? shipping.phone),
      first_name: s(billing.first_name ?? get(order, 'customer', 'first_name')) || undefined,
      last_name:  s(billing.last_name  ?? get(order, 'customer', 'last_name'))  || undefined,
      city:       s(billing.city    || shipping.city)           || undefined,
      state:      s(billing.province_code || shipping.province_code) || undefined,
      country:    s(billing.country_code  || shipping.country_code)  || undefined,
      zip:        s(billing.zip           || shipping.zip)           || undefined,
      ip:         s(order.browser_ip || clientDetails.browser_ip)   || undefined,
      user_agent: s(clientDetails.user_agent) || undefined,
    }

    const lineItems = Array.isArray(order.line_items)
      ? (order.line_items as Array<Record<string, unknown>>)
      : []
    const items: ParsedItem[] = lineItems.map(li => ({
      id:       s(li.product_id || li.variant_id || li.id || ''),
      name:     s(li.title || li.name) || undefined,
      price:    n(li.price),
      quantity: n(li.quantity || 1),
    }))

    const orderId = s(order.id)

    return {
      gateway:   'shopify',
      order_id:  orderId,
      value:     n(order.total_price || order.current_total_price),
      currency:  s(order.currency || 'BRL'),
      customer,
      items,
      cart_token: s(order.cart_token) || undefined,

      nx_user:    note('nx_user') || note('nx_lead_id') || note('_nx_user') || undefined,
      fbclid:     note('fbclid') || undefined,
      fbc:        note('fbc')    || note('_fbc') || undefined,
      fbp:        note('fbp')    || note('_fbp') || undefined,
      gclid:      note('gclid')  || undefined,
      gbraid:     note('gbraid') || undefined,
      wbraid:     note('wbraid') || undefined,
      ttclid:     note('ttclid') || undefined,
      ttp:        note('ttp')    || note('_ttp') || undefined,
      msclkid:    note('msclkid') || undefined,
      twclid:     note('twclid') || undefined,

      utm_source:   utm('utm_source')   || undefined,
      utm_medium:   utm('utm_medium')   || undefined,
      utm_campaign: utm('utm_campaign') || undefined,
      utm_content:  utm('utm_content')  || undefined,
      utm_term:     utm('utm_term')     || undefined,

      event_id:   `purchase_${orderId}`,
      event_time: ts(),
      raw:        body,
    }
  },

  async validateHmac(payload: string, signature: string, secret: string): Promise<boolean> {
    return hmacSha256Verify(payload, signature, secret)
  },
}
