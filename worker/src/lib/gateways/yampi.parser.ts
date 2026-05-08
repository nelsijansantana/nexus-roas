import {
  GatewayParser, ParsedGatewayEvent, ParsedCustomer, ParsedItem,
  s, n, get, normalizePhone, hmacSha256Verify, ts,
} from './types'

interface YampiMetadataItem {
  key: string
  value: string
}

function parseMetadata(data: YampiMetadataItem[]): Record<string, string> {
  return Object.fromEntries(data.map(({ key, value }) => [key, value]))
}

function extractItems(resource: Record<string, unknown>): ParsedItem[] {
  const rawItems = get(resource, 'items', 'data') as unknown[]
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    const productId = s(resource.product_id || resource.sku_id || '')
    const name = s(resource.product_name || '')
    const price = n(resource.value_total || resource.total || 0)
    return productId || name ? [{ id: productId || name, name, price, quantity: 1 }] : []
  }
  return rawItems.map((item) => {
    const it = item as Record<string, unknown>
    return {
      id: s(it.product_id || it.sku_id || it.id || ''),
      name: s(it.title || it.name || ''),
      price: n(it.price || it.unit_price || 0),
      quantity: n(it.quantity || 1),
    }
  })
}

export const yampiParser: GatewayParser = {
  parse(body: unknown): ParsedGatewayEvent | null {
    const b = body as Record<string, unknown>

    if (b.event && b.event !== 'order.paid') return null

    const resource = (b.resource ?? b.data ?? b) as Record<string, unknown>
    if (!resource.id) return null

    // metadata.data → key/value map
    const rawMeta = get(resource, 'metadata', 'data')
    const meta = Array.isArray(rawMeta) ? parseMetadata(rawMeta as YampiMetadataItem[]) : {}
    const m = (key: string) => meta[key] || ''

    // GA4 client ID from _ga (format: "GA4_PROP.1.client.session")
    const gaRaw = m('_ga')
    const gaParts = gaRaw.split('.')
    const ga_client_id = gaParts.length >= 4 ? `${gaParts[2]}.${gaParts[3]}` : (gaRaw || undefined)

    // Customer
    const customerRaw = (get(resource, 'customer', 'data') ?? get(resource, 'customer') ?? {}) as Record<string, unknown>
    const phoneRaw = get(customerRaw, 'phone', 'full_number') ?? customerRaw.phone ?? resource.phone
    const addrRaw  = (get(resource, 'shipping_address', 'data') ?? get(resource, 'shipping_address') ?? resource.address ?? {}) as Record<string, unknown>

    const customer: ParsedCustomer = {
      email:      s(customerRaw.email || resource.email).toLowerCase() || undefined,
      phone:      normalizePhone(phoneRaw, '55'),
      first_name: s(customerRaw.first_name || resource.first_name) || undefined,
      last_name:  s(customerRaw.last_name  || resource.last_name)  || undefined,
      city:       s(addrRaw.city    || resource.city).toLowerCase()    || undefined,
      state:      s(addrRaw.uf || addrRaw.state || resource.state).toLowerCase() || undefined,
      country:    s(addrRaw.country || resource.country || 'BR').toUpperCase().substring(0, 2),
      zip:        s(addrRaw.zip_code || addrRaw.zipcode || resource.zipcode) || undefined,
      ip:         s(resource.ip || customerRaw.ip) || undefined,
    }

    // Shopify external integration
    const shopifyOrderId = s(get(resource, 'services', 'data', '0', 'shopifyapp', 'external_id') ?? '')

    const orderId = s(resource.id)

    return {
      gateway:    'yampi',
      order_id:   orderId,
      value:      n(resource.value_total || resource.total || resource.amount),
      currency:   s(resource.currency || 'BRL'),
      customer,
      items:      extractItems(resource),

      nx_user:    m('_nx_user') || m('nx_user') || s(resource.utm_content || resource.xcod || resource.src) || undefined,
      fbclid:     m('fbclid') || undefined,
      fbc:        m('_fbc') || m('fbc') || undefined,
      fbp:        m('_fbp') || m('fbp') || undefined,
      gclid:      m('_gclid') || m('gclid') || undefined,
      ttclid:     m('_ttclid') || m('ttclid') || undefined,
      ttp:        m('_ttp') || m('ttp') || undefined,
      msclkid:    m('msclkid') || undefined,
      twclid:     m('twclid') || undefined,
      ga_client_id,
      cart_token: m('cart_id') || s(get(resource, 'cart', 'id') ?? '') || undefined,

      utm_source:   s(resource.utm_source)   || m('utm_source')   || undefined,
      utm_medium:   s(resource.utm_medium)   || m('utm_medium')   || undefined,
      utm_campaign: s(resource.utm_campaign) || m('utm_campaign') || undefined,
      utm_content:  s(resource.utm_content)  || m('utm_content')  || undefined,
      utm_term:     s(resource.utm_term)     || m('utm_term')     || undefined,

      // Shopify integration metadata (carried for event routing)
      ...(shopifyOrderId ? { shopify_order_id: shopifyOrderId } as Record<string, string> : {}),

      event_id:   `purchase_${orderId}`,
      event_time: ts(),
      raw:        body,
    }
  },

  async validateHmac(payload: string, signature: string, secret: string): Promise<boolean> {
    return hmacSha256Verify(payload, signature, secret)
  },
}
