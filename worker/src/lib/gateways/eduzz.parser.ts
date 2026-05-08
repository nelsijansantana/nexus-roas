import {
  GatewayParser, ParsedGatewayEvent, ParsedCustomer, ParsedItem,
  s, n, normalizePhone, ts,
} from './types'

export const eduzzParser: GatewayParser = {
  parse(body: unknown): ParsedGatewayEvent | null {
    const b = body as Record<string, unknown>
    const status = s(b.trans_status || b.status || (b.data as Record<string, unknown>)?.trans_status || '')
    if (status && status !== 'A' && status !== 'approved' && status !== 'paid') return null

    const d = (b.data ?? b) as Record<string, unknown>
    const orderId   = s(d.trans_cod || d.transaction_id || d.order_id || d.id || '')
    const rawValue  = d.trans_value ?? d.value ?? d.amount ?? d.total ?? 0
    const value     = n(rawValue)

    const utm  = (d.utm ?? d.tracking ?? {}) as Record<string, unknown>
    const utmS = (k: string, alt?: string) => s(utm[k] || utm[alt ?? ''] || d[k] || '')

    const productId   = s(d.prod_cod || d.product_id || d.prod_id || '')
    const productName = s(d.prod_name || d.product_name || d.name_product || '')
    const items: ParsedItem[] = productId || productName
      ? [{ id: productId || productName, name: productName || undefined, price: value, quantity: 1 }]
      : []

    const customer: ParsedCustomer = {
      email:   s(d.client_email || d.buyer_email || d.email || '').toLowerCase() || undefined,
      phone:   normalizePhone(d.client_phone || d.phone || d.mobile),
      city:    s(d.client_city   || d.city   || '').toLowerCase() || undefined,
      state:   s(d.client_state  || d.state  || '').toLowerCase() || undefined,
      country: s(d.client_country || d.country || '').toLowerCase().substring(0, 2) || undefined,
      zip:     s(d.client_zip || d.zip || d.zipcode) || undefined,
    }

    const nameFull = s(d.client_name || d.buyer_name || d.name || '')
    if (nameFull) {
      const parts = nameFull.trim().split(/\s+/)
      customer.first_name = parts[0]
      customer.last_name  = parts.length > 1 ? parts[parts.length - 1] : undefined
    }

    return {
      gateway:    'eduzz',
      order_id:   orderId,
      value,
      currency:   s(d.currency || d.trans_currency || 'BRL'),
      customer,
      items,
      nx_user:    utmS('content') || utmS('utm_content') || utmS('src') || utmS('xcod') || undefined,
      utm_source:   utmS('utm_source', 'source')   || undefined,
      utm_medium:   utmS('utm_medium', 'medium')   || undefined,
      utm_campaign: utmS('utm_campaign', 'campaign') || undefined,
      utm_content:  utmS('utm_content', 'content') || undefined,
      utm_term:     utmS('utm_term', 'term')       || undefined,
      event_id:   `purchase_${orderId}`,
      event_time: ts(),
      raw:        body,
    }
  },
}
