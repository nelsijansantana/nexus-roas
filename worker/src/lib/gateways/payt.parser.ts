import {
  GatewayParser, ParsedGatewayEvent, ParsedCustomer, ParsedItem,
  s, n, normalizePhone, ts,
} from './types'

const PAID = new Set(['paid', 'approved', 'complete', 'confirmed'])

export const paytParser: GatewayParser = {
  parse(body: unknown): ParsedGatewayEvent | null {
    const b = body as Record<string, unknown>
    const status = s(b.status || b.payment_status || '')
    if (status && !PAID.has(status.toLowerCase())) return null

    const customer = (b.customer ?? b.buyer ?? b) as Record<string, unknown>
    const orderId  = s(b.transaction_id || b.order_id || b.id || '')
    const value    = n(b.amount || b.total || b.value || 0)

    const parsedCustomer: ParsedCustomer = {
      email: s(customer.email || '').toLowerCase() || undefined,
      phone: normalizePhone(customer.phone ?? customer.mobile ?? customer.celular),
    }

    const nameFull = s(customer.name || customer.full_name || customer.nome || '')
    if (nameFull) {
      const parts = nameFull.trim().split(/\s+/)
      parsedCustomer.first_name = parts[0]
      parsedCustomer.last_name  = parts.length > 1 ? parts[parts.length - 1] : undefined
    }

    const productId   = s(b.product_id || (b.product as Record<string, unknown>)?.id || '')
    const productName = s(b.product_name || (b.product as Record<string, unknown>)?.name || '')
    const items: ParsedItem[] = productId || productName
      ? [{ id: productId || productName, name: productName || undefined, price: value, quantity: 1 }]
      : []

    return {
      gateway:    'payt',
      order_id:   orderId,
      value,
      currency:   s(b.currency || 'BRL'),
      customer:   parsedCustomer,
      items,
      nx_user:      s(b.src || b.xcod || b.nx_user || b.utm_content || b.sck || '') || undefined,
      utm_source:   s(b.utm_source   || '') || undefined,
      utm_medium:   s(b.utm_medium   || '') || undefined,
      utm_campaign: s(b.utm_campaign || '') || undefined,
      utm_content:  s(b.utm_content  || b.xcod || '') || undefined,
      utm_term:     s(b.utm_term     || '') || undefined,
      event_id:   `purchase_${orderId}`,
      event_time: ts(),
      raw:        body,
    }
  },
}
