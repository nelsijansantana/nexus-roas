import {
  GatewayParser, ParsedGatewayEvent, ParsedCustomer, ParsedItem,
  s, n, normalizePhone, ts,
} from './types'

export const greennParser: GatewayParser = {
  parse(body: unknown): ParsedGatewayEvent | null {
    const b = body as Record<string, unknown>
    const currentStatus = s(b.currentStatus || (b.sale as Record<string, unknown>)?.status || '')
    if (currentStatus !== 'paid') return null

    const sale    = (b.sale    ?? {}) as Record<string, unknown>
    const client  = (b.client  ?? {}) as Record<string, unknown>
    const product = (b.product ?? {}) as Record<string, unknown>
    if (!sale.id || !client.email) return null

    const metas: Record<string, string> = {}
    if (Array.isArray(b.saleMetas)) {
      for (const m of b.saleMetas as Array<Record<string, unknown>>) {
        if (m.meta_key && m.meta_value != null) {
          metas[s(m.meta_key)] = s(m.meta_value)
        }
      }
    }
    const meta = (k: string) => metas[k] || ''

    const customer: ParsedCustomer = {
      email:   s(client.email || '').toLowerCase() || undefined,
      phone:   normalizePhone(client.cellphone ?? client.phone),
      city:    s(client.city || '').toLowerCase() || undefined,
      state:   s(client.uf   || '').toLowerCase() || undefined,
      country: 'BR',
      zip:     s(client.zipcode) || undefined,
    }

    const nameFull = s(client.name || '')
    if (nameFull) {
      const parts = nameFull.trim().split(/\s+/)
      customer.first_name = parts[0]
      customer.last_name  = parts.length > 1 ? parts[parts.length - 1] : undefined
    }

    const productId   = s(product.id || '')
    const productName = s(product.name || '')
    const value       = n(sale.total ?? sale.amount ?? 0)
    const items: ParsedItem[] = productId || productName
      ? [{ id: productId || productName, name: productName || undefined, price: value, quantity: 1 }]
      : []

    const orderId = s(sale.id || '')

    return {
      gateway:    'greenn',
      order_id:   orderId,
      value,
      currency:   'BRL',
      customer,
      items,
      nx_user:    meta('nx_user') || meta('src') || meta('sck') || meta('xcod') || meta('utm_content') || undefined,
      fbclid:     meta('fbclid') || undefined,
      fbc:        meta('fbc')   || meta('_fbc') || undefined,
      fbp:        meta('fbp')   || meta('_fbp') || undefined,
      gclid:      meta('gclid') || undefined,
      ttclid:     meta('ttclid') || undefined,
      ttp:        meta('ttp')   || meta('_ttp') || undefined,
      msclkid:    meta('msclkid') || undefined,
      twclid:     meta('twclid')  || undefined,
      utm_source:   meta('utm_source')   || undefined,
      utm_medium:   meta('utm_medium')   || undefined,
      utm_campaign: meta('utm_campaign') || undefined,
      utm_content:  meta('utm_content')  || undefined,
      utm_term:     meta('utm_term')     || undefined,
      utm_id:       meta('utm_id')       || undefined,
      event_id:   `purchase_${orderId}`,
      event_time: ts(),
      raw:        body,
    }
  },
}
