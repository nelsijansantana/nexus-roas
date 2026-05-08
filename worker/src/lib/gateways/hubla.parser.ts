import {
  GatewayParser, ParsedGatewayEvent, ParsedCustomer, ParsedItem,
  s, n, get, normalizePhone, ts,
} from './types'

export const hublaParser: GatewayParser = {
  parse(body: unknown): ParsedGatewayEvent | null {
    const urlString = s(get(body, 'event', 'invoice', 'paymentSession', 'url') ?? '')

    let nxUser = '', utm_source = '', utm_medium = '', utm_campaign = ''
    let utm_content = '', utm_term = ''
    let fbclid = '', gclid = '', ttclid = '', msclkid = ''

    if (urlString) {
      try {
        const sp = new URL(urlString).searchParams
        nxUser       = sp.get('xcod') || sp.get('src') || sp.get('nx_user') || ''
        utm_source   = sp.get('utm_source')   || ''
        utm_medium   = sp.get('utm_medium')   || ''
        utm_campaign = sp.get('utm_campaign') || ''
        utm_content  = sp.get('utm_content')  || sp.get('xcod') || ''
        utm_term     = sp.get('utm_term')     || ''
        fbclid       = sp.get('fbclid')  || ''
        gclid        = sp.get('gclid')   || ''
        ttclid       = sp.get('ttclid')  || ''
        msclkid      = sp.get('msclkid') || ''
      } catch { /* ignore malformed URL */ }
    }

    const firstName = s(get(body, 'event', 'invoice', 'payer', 'firstName') ?? '')
    const lastName  = s(get(body, 'event', 'invoice', 'payer', 'lastName')  ?? '')
    const totalCents = get(body, 'event', 'invoice', 'amount', 'totalCents')
    const value = totalCents ? n(totalCents) / 100 : 0

    const customer: ParsedCustomer = {
      email:      s(get(body, 'event', 'invoice', 'payer', 'email') ?? '').toLowerCase() || undefined,
      phone:      normalizePhone(get(body, 'event', 'invoice', 'payer', 'phone')),
      first_name: firstName || undefined,
      last_name:  lastName  || undefined,
      ip:         s(get(body, 'event', 'invoice', 'paymentSession', 'ip') ?? '')       || undefined,
      user_agent: s(get(body, 'event', 'invoice', 'paymentSession', 'userAgent') ?? '') || undefined,
    }

    const productId   = s(get(body, 'event', 'product', 'id') ?? get(body, 'event', 'products', '0', 'id') ?? '')
    const productName = s(get(body, 'event', 'product', 'name') ?? get(body, 'event', 'products', '0', 'name') ?? '')
    const items: ParsedItem[] = productId || productName
      ? [{ id: productId || productName, name: productName || undefined, price: value, quantity: 1 }]
      : []

    const orderId = s(get(body, 'event', 'invoice', 'id') ?? '')

    return {
      gateway:    'hubla',
      order_id:   orderId,
      value:      n(value),
      currency:   s(get(body, 'event', 'invoice', 'currency') ?? 'BRL') || 'BRL',
      customer,
      items,
      nx_user:      nxUser      || undefined,
      fbclid:       fbclid      || undefined,
      gclid:        gclid       || undefined,
      ttclid:       ttclid      || undefined,
      msclkid:      msclkid     || undefined,
      utm_source:   utm_source  || undefined,
      utm_medium:   utm_medium  || undefined,
      utm_campaign: utm_campaign || undefined,
      utm_content:  utm_content || undefined,
      utm_term:     utm_term    || undefined,
      event_id:   `purchase_${orderId}`,
      event_time: ts(),
      raw:        body,
    }
  },
}
