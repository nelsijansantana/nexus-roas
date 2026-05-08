import type { EventName, CustomData, SignalMap, GeoData } from '../core/types'

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void
    _fbq?: unknown
  }
}

const META_EVENT_MAP: Partial<Record<EventName, string>> = {
  PageView:             'PageView',
  ViewContent:          'ViewContent',
  ViewCategory:         'ViewContent',
  ViewCart:             'ViewCart',
  AddToCart:            'AddToCart',
  RemoveFromCart:       'RemoveFromCart',
  AddToWishlist:        'AddToWishlist',
  InitiateCheckout:     'InitiateCheckout',
  AddContactInfo:       'Lead',
  AddShippingInfo:      'AddPaymentInfo',
  AddPaymentInfo:       'AddPaymentInfo',
  Purchase:             'Purchase',
  Lead:                 'Lead',
  CompleteRegistration: 'CompleteRegistration',
  Subscribe:            'Subscribe',
  Search:               'Search',
}

const STANDARD_EVENTS = new Set([
  'PageView', 'ViewContent', 'AddToCart', 'AddToWishlist', 'InitiateCheckout',
  'AddPaymentInfo', 'Purchase', 'Lead', 'CompleteRegistration', 'Contact',
  'CustomizeProduct', 'Donate', 'FindLocation', 'Schedule', 'Search',
  'StartTrial', 'Subscribe', 'SubmitApplication', 'ViewCart', 'RemoveFromCart',
])

function buildAdvancedMatching(nxUser: string, geo?: GeoData): Record<string, string> {
  const am: Record<string, string> = {}
  if (nxUser) am.external_id = nxUser
  if (geo?.city)    am.ct = geo.city.toLowerCase().replace(/[^a-z]/g, '')
  if (geo?.region)  am.st = geo.region.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 2)
  if (geo?.postal)  am.zp = geo.postal.replace(/[\s-]/g, '')
  if (geo?.country) am.country = geo.country.toLowerCase().replace(/[^a-z]/g, '').substring(0, 2)
  return am
}

function loadFbevents(): void {
  if (typeof window.fbq !== 'undefined') return
  // Official Meta Pixel base code
  ;(function(f: Window, b: Document, e: string, v: string) {
    const n = (f.fbq = function(...args: unknown[]) {
      if ((n as unknown as { callMethod?: (...a: unknown[]) => void }).callMethod) {
        (n as unknown as { callMethod: (...a: unknown[]) => void }).callMethod(...args)
      } else {
        (n as unknown as { queue: unknown[] }).queue.push(args)
      }
    }) as (...args: unknown[]) => void
    if (!f._fbq) f._fbq = n
    ;(n as unknown as { push: typeof n }).push = n
    ;(n as unknown as { loaded: boolean }).loaded = true
    ;(n as unknown as { version: string }).version = '2.0'
    ;(n as unknown as { queue: unknown[] }).queue = []
    const t = b.createElement(e) as HTMLScriptElement
    t.async = true
    t.src = v
    const s = b.getElementsByTagName(e)[0]
    s.parentNode?.insertBefore(t, s)
  })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js')
}

export interface MetaModule {
  init(pixelIds: string[], nxUser: string, geo?: GeoData, testEventCode?: string): void
  fire(eventName: EventName, eventId: string, customData?: CustomData, signals?: SignalMap): void
}

export function createMetaModule(): MetaModule {
  let initializedIds: string[] = []
  let activeTestCode: string | undefined

  return {
    init(pixelIds: string[], nxUser: string, geo?: GeoData, testEventCode?: string): void {
      loadFbevents()
      if (!window.fbq) return

      activeTestCode = testEventCode
      const am = buildAdvancedMatching(nxUser, geo)

      for (const id of pixelIds) {
        window.fbq('set', 'autoConfig', false, id)
        window.fbq('init', id, am)
      }
      initializedIds = pixelIds
    },

    fire(eventName: EventName, eventId: string, customData?: CustomData, signals?: SignalMap): void {
      if (!window.fbq || initializedIds.length === 0) return

      const metaEvent = META_EVENT_MAP[eventName]
      if (!metaEvent) return

      const data: Record<string, unknown> = {}
      if (customData?.value !== undefined)    data.value = customData.value
      if (customData?.currency)               data.currency = customData.currency
      if (customData?.order_id)               data.order_id = customData.order_id
      if (customData?.contents?.length)       data.contents = customData.contents.map(c => ({
        id: c.id, quantity: c.quantity, item_price: c.price,
      }))
      if (customData?.num_items !== undefined) data.num_items = customData.num_items
      if (signals?.fbc)                       data.fbc = signals.fbc
      if (signals?.fbp)                       data.fbp = signals.fbp

      const options: Record<string, unknown> = { eventID: eventId }
      if (activeTestCode) options.test_event_code = activeTestCode

      const method = STANDARD_EVENTS.has(metaEvent) ? 'track' : 'trackCustom'
      window.fbq(method, metaEvent, data, options)
    },
  }
}
