import {
  GatewayParser, ParsedGatewayEvent, ParsedCustomer, ParsedItem,
  s, n, ts,
} from './types'

const PAID_STATUSES = new Set(['authorized'])

function notInformed(v: unknown): boolean {
  const str = s(v).trim()
  return !str || str === 'Não Informado'
}

export const tictoParser: GatewayParser = {
  parse(body: unknown): ParsedGatewayEvent | null {
    const b = body as Record<string, unknown>
    const status   = s(b.status || '')
    const order    = (b.order    ?? {}) as Record<string, unknown>
    const customer = (b.customer ?? {}) as Record<string, unknown>
    const tracking = (b.tracking ?? {}) as Record<string, unknown>
    const item     = (b.item     ?? {}) as Record<string, unknown>

    if (!status || !order.id) return null
    if (!PAID_STATUSES.has(status)) return null

    const urlParams = (b.url_params as Record<string, unknown>)?.query_params
      ?? (b.url_params as Record<string, unknown>)
      ?? {}

    let nxUser = ''
    if (!notInformed(tracking.src))       nxUser = s(tracking.src)
    else if (!notInformed(tracking.sck))  nxUser = s(tracking.sck)
    else if (!notInformed((urlParams as Record<string, unknown>).src)) nxUser = s((urlParams as Record<string, unknown>).src)
    else if (!notInformed((urlParams as Record<string, unknown>).sck)) nxUser = s((urlParams as Record<string, unknown>).sck)

    function t(key: string): string {
      const v = (tracking as Record<string, unknown>)[key] ?? (urlParams as Record<string, unknown>)[key] ?? ''
      return notInformed(v) ? '' : s(v)
    }

    // Phone from Ticto split fields: ddi + ddd + number
    let phone: string | undefined
    const ddi    = s(customer.phone && (customer.phone as Record<string, unknown>).ddi    || '55')
    const ddd    = s(customer.phone && (customer.phone as Record<string, unknown>).ddd    || b.phone_local_code_customer || '')
    const number = s(customer.phone && (customer.phone as Record<string, unknown>).number || b.phone_number_customer || b.telefone || '')
    if (ddd && number) {
      const digits = `${ddi}${ddd}${number}`.replace(/\D/g, '')
      phone = `+${digits}`
    }

    // Ticto sends amount in cents
    const rawAmount = order.amount ?? order.total ?? 0
    const value = (typeof rawAmount === 'number' ? rawAmount : parseFloat(s(rawAmount))) / 100

    const parsedCustomer: ParsedCustomer = {
      email: s(customer.email || '').toLowerCase() || undefined,
      phone,
      city:    s((customer.address as Record<string, unknown>)?.city    || '').toLowerCase() || undefined,
      state:   s((customer.address as Record<string, unknown>)?.state   || '').toLowerCase() || undefined,
      country: s((customer.address as Record<string, unknown>)?.country || '').toLowerCase() || undefined,
      zip:     s((customer.address as Record<string, unknown>)?.zip_code || '') || undefined,
    }

    const nameFull = s(customer.name || '')
    if (nameFull) {
      const parts = nameFull.trim().split(/\s+/)
      parsedCustomer.first_name = parts[0]
      parsedCustomer.last_name  = parts.length > 1 ? parts[parts.length - 1] : undefined
    }

    const productId   = s(item.id || '')
    const productName = s(item.name || '')
    const items: ParsedItem[] = productId || productName
      ? [{ id: productId || productName, name: productName || undefined, price: value, quantity: 1 }]
      : []

    const orderId = s(order.id || '')

    return {
      gateway:    'ticto',
      order_id:   orderId,
      value:      n(value),
      currency:   'BRL',
      customer:   parsedCustomer,
      items,
      nx_user:      nxUser || undefined,
      fbclid:       t('fbclid') || undefined,
      gclid:        t('gclid')  || undefined,
      ttclid:       t('ttclid') || undefined,
      utm_source:   t('utm_source')   || undefined,
      utm_medium:   t('utm_medium')   || undefined,
      utm_campaign: t('utm_campaign') || undefined,
      utm_content:  t('utm_content')  || undefined,
      utm_term:     t('utm_term')     || undefined,
      utm_id:       t('utm_id')       || undefined,
      event_id:   `purchase_${orderId}`,
      event_time: ts(),
      raw:        body,
    }
  },
}
