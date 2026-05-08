import type { EventName, CustomData, SignalMap } from '../core/types'

interface TikTokQ {
  (...args: unknown[]): void
  push: (...args: unknown[]) => void
  loaded: boolean
  version: string
  queue: unknown[]
  methods: string[]
  identify: (data: Record<string, string>) => void
  load: (pixelId: string, options?: Record<string, unknown>) => void
  page: (data?: Record<string, unknown>, options?: Record<string, unknown>) => void
  track: (event: string, data?: Record<string, unknown>, options?: Record<string, unknown>) => void
}

declare global {
  interface Window {
    TiktokAnalyticsObject?: string
    ttq?: TikTokQ
  }
}

const TIKTOK_EVENT_MAP: Partial<Record<EventName, string | null>> = {
  PageView:             'Pageview',
  ViewContent:          'ViewContent',
  ViewCategory:         'ViewContent',
  AddToCart:            'AddToCart',
  AddToWishlist:        'AddToWishlist',
  InitiateCheckout:     'InitiateCheckout',
  AddContactInfo:       'CompleteRegistration',
  AddShippingInfo:      'AddShippingInfo',
  AddPaymentInfo:       'AddPaymentInfo',
  Purchase:             'Purchase',
  Lead:                 'Subscribe',
  RemoveFromCart:       null,  // not supported — skip silently
}

function loadTikTokScript(): void {
  if (typeof window.ttq !== 'undefined') return

  window.TiktokAnalyticsObject = 'ttq'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any
  const queue: unknown[] = []
  const o: Record<string, unknown> = {}
  o.push = (...args: unknown[]) => { queue.push(args) }
  o.loaded = false
  o.version = '2.0'
  o.queue = queue
  const methods = ['page', 'track', 'identify', 'instances', 'debug', 'on', 'off',
    'once', 'ready', 'alias', 'group', 'enableCookie', 'disableCookie',
    'holdConsent', 'revokeConsent', 'grantConsent', 'load']
  o.methods = methods
  for (const method of methods) {
    o[method] = (function(m: string) {
      return function(...args: unknown[]) { queue.push([m, ...args]) }
    })(method)
  }
  w.ttq = o

  const s = document.createElement('script')
  s.type = 'text/javascript'
  s.async = true
  s.src = 'https://analytics.tiktok.com/i18n/pixel/events.js?sdkid=ttq&lib=ttq'
  const el = document.getElementsByTagName('script')[0]
  el.parentNode?.insertBefore(s, el)
}

export interface TikTokModule {
  init(pixelId: string, nxUser: string, testEventCode?: string): void
  fire(eventName: EventName, eventId: string, customData?: CustomData, signals?: SignalMap): void
}

export function createTikTokModule(): TikTokModule {
  let initialized = false

  return {
    init(pixelId: string, nxUser: string, testEventCode?: string): void {
      loadTikTokScript()
      if (!window.ttq) return

      const loadOptions: Record<string, unknown> = {}
      if (testEventCode) loadOptions.test_event_code = testEventCode

      window.ttq.load(pixelId, loadOptions)
      if (nxUser) window.ttq.identify({ external_id: nxUser })
      initialized = true
    },

    fire(eventName: EventName, eventId: string, customData?: CustomData, signals?: SignalMap): void {
      if (!window.ttq || !initialized) return

      const tiktokEvent = TIKTOK_EVENT_MAP[eventName]
      if (tiktokEvent === null || tiktokEvent === undefined) return

      const data: Record<string, unknown> = {}
      if (customData?.value !== undefined)    data.value = customData.value
      if (customData?.currency)               data.currency = customData.currency
      if (customData?.order_id)               data.order_id = customData.order_id
      if (customData?.contents?.length)       data.contents = customData.contents.map(c => ({
        content_id: c.id, content_name: c.name, price: c.price, quantity: c.quantity,
      }))
      if (signals?.ttclid) data.ttclid = signals.ttclid
      if (signals?.ttp)    data.ttp = signals.ttp

      const options = { event_id: eventId }

      if (tiktokEvent === 'Pageview') {
        window.ttq.page(data, options)
      } else {
        window.ttq.track(tiktokEvent, data, options)
      }
    },
  }
}
