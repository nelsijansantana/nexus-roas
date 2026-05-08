import {
  GatewayParser, ParsedGatewayEvent, ParsedCustomer, ParsedItem,
  s, n, normalizePhone, ts,
} from './types'

const PAID = new Set(['approved', 'paid', 'complete', 'order_approved', 'confirmed'])

export const perfectpayParser: GatewayParser = {
  parse(body: unknown): ParsedGatewayEvent | null {
    const b = body as Record<string, unknown>
    const status = s(b.status || b.sale_status || b.order_status || '')
    if (status && !PAID.has(status.toLowerCase())) return null

    const meta     = (b.metadata ?? b.tracking ?? b) as Record<string, unknown>
    const customer = (b.customer ?? b.buyer ?? b.client ?? {}) as Record<string, unknown>
    const orderId  = s(b.code || b.sale_id || b.transaction_id || b.order_id || b.id || '')
    const value    = n(b.sale_amount || b.amount || b.total || b.value || 0)

    const parsedCustomer: ParsedCustomer = {
      email: s(customer.email || b.email || '').toLowerCase() || undefined,
      phone: normalizePhone(customer.phone ?? customer.mobile ?? b.phone),
    }

    const nameFull = s(customer.name || customer.full_name || b.name || '')
    if (nameFull) {
      const parts = nameFull.trim().split(/\s+/)
      parsedCustomer.first_name = parts[0]
      parsedCustomer.last_name  = parts.length > 1 ? parts[parts.length - 1] : undefined
    }

    const productId   = s(b.product_id || (b.product as Record<string, unknown>)?.id || meta.product_id || '')
    const productName = s(b.product_name || (b.product as Record<string, unknown>)?.name || meta.product_name || '')
    const items: ParsedItem[] = productId || productName
      ? [{ id: productId || productName, name: productName || undefined, price: value, quantity: 1 }]
      : []

    return {
      gateway:    'perfectpay',
      order_id:   orderId,
      value,
      currency:   s(b.currency || meta.currency || 'BRL'),
      customer:   parsedCustomer,
      items,
      nx_user: s(meta.utm_perfect || meta.src || meta.xcod || meta.nx_user || meta.utm_content || b.src || '') || undefined,
      utm_source:   s(meta.utm_source   || b.utm_source   || '') || undefined,
      utm_medium:   s(meta.utm_medium   || b.utm_medium   || '') || undefined,
      utm_campaign: s(meta.utm_campaign || b.utm_campaign || '') || undefined,
      utm_content:  s(meta.utm_content  || meta.xcod || b.utm_content || '') || undefined,
      utm_term:     s(meta.utm_term     || b.utm_term     || '') || undefined,
      event_id:   `purchase_${orderId}`,
      event_time: ts(),
      raw:        body,
    }
  },
}
