import type { EventName, CustomData } from '../core/types'
import { readCookie } from '../core/signals'

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
    dataLayer?: unknown[]
  }
}

const GA4_EVENT_MAP: Partial<Record<EventName, string>> = {
  PageView:         'page_view',
  ViewContent:      'view_item',
  ViewCategory:     'view_item_list',
  ViewCart:         'view_cart',
  AddToCart:        'add_to_cart',
  RemoveFromCart:   'remove_from_cart',
  AddToWishlist:    'add_to_wishlist',
  InitiateCheckout: 'begin_checkout',
  AddShippingInfo:  'add_shipping_info',
  AddPaymentInfo:   'add_payment_info',
  Purchase:         'purchase',
  Lead:             'generate_lead',
  Search:           'search',
}

function loadGtag(measurementId: string): void {
  if (typeof window.gtag !== 'undefined') return

  window.dataLayer = window.dataLayer || []
  window.gtag = function(...args: unknown[]) {
    window.dataLayer!.push(args)
  }
  window.gtag('js', new Date())
  window.gtag('config', measurementId, { send_page_view: false })

  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`
  script.onload = () => {
    window.gtag?.('event', 'page_view', {
      page_location: window.location.href,
      page_title: document.title,
      page_referrer: document.referrer || undefined,
    })
  }
  const first = document.getElementsByTagName('script')[0]
  first.parentNode?.insertBefore(script, first)
}

export function getClientId(measurementId?: string): string {
  // Try _ga cookie first
  const gaCookie = readCookie('_ga')
  if (gaCookie) {
    const parts = gaCookie.split('.')
    if (parts.length >= 4) return `${parts[2]}.${parts[3]}`
  }
  // Fallback to localStorage
  try {
    const stored = localStorage.getItem('nx_ga4_cid')
    if (stored) return stored
  } catch { /* Safari ITP */ }
  // Generate new client ID
  const generated = `${Math.random().toString(36).substring(2)}.${Date.now()}`
  try { localStorage.setItem('nx_ga4_cid', generated) } catch { /* Safari ITP */ }
  return generated
}

export function getSessionData(measurementId: string): { session_id: string; session_count: string } {
  const key = measurementId.replace('G-', '')
  const cookie = readCookie(`_ga_${key}`)
  if (cookie) {
    const parts = cookie.split('.')
    if (parts.length >= 4) return { session_id: parts[2], session_count: parts[3] }
  }
  return { session_id: '', session_count: '' }
}

export interface GA4Module {
  init(measurementId: string, nxUser?: string): void
  fire(eventName: EventName, params?: Record<string, unknown>): void
  getClientId(): string
}

export function createGA4Module(): GA4Module {
  let activeMeasurementId = ''

  return {
    init(measurementId: string, nxUser?: string): void {
      activeMeasurementId = measurementId
      loadGtag(measurementId)
      if (!window.gtag) return

      const config: Record<string, unknown> = { send_page_view: false }
      if (nxUser) config.user_id = nxUser

      window.gtag('config', measurementId, config)
    },

    fire(eventName: EventName, params?: Record<string, unknown>): void {
      if (!window.gtag) return

      const ga4Event = GA4_EVENT_MAP[eventName]
      if (!ga4Event) return

      const eventParams: Record<string, unknown> = { ...(params ?? {}) }

      if (activeMeasurementId) {
        const session = getSessionData(activeMeasurementId)
        if (session.session_id) eventParams.session_id = session.session_id
        if (session.session_count) eventParams.engagement_time_msec = session.session_count
      }

      window.gtag('event', ga4Event, eventParams)
    },

    getClientId(): string {
      return getClientId(activeMeasurementId)
    },
  }
}
