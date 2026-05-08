import { collectSignals, collectUtms, readCookie } from '../core/signals'
import { createMetaModule } from '../platforms/meta'
import { createTikTokModule } from '../platforms/tiktok'
import { createGA4Module } from '../platforms/ga4'
import type { EventName, CustomData, NexusEvent, SignalMap } from '../core/types'

// Globals injected via banner placeholders
declare const __NX_COLLECT__: string
declare const __META_PIXEL_IDS__: string[]
declare const __TIKTOK_PIXEL__: string
declare const __GA4_ID__: string
declare const __META_TEST__: string
declare const __TIKTOK_TEST__: string

declare global {
  interface Window {
    dataLayer?: unknown[]
  }
}

const CARTPANDA_EVENT_MAP: Record<string, EventName> = {
  'begin_checkout': 'InitiateCheckout',
  'begin_checkout_info': 'AddShippingInfo',
  'add_payment_info': 'AddPaymentInfo',
}

const collectUrl = typeof __NX_COLLECT__ !== 'undefined' ? __NX_COLLECT__ : ''
const metaPixelIds: string[] = typeof __META_PIXEL_IDS__ !== 'undefined' ? __META_PIXEL_IDS__ : []
const tiktokPixel = typeof __TIKTOK_PIXEL__ !== 'undefined' ? __TIKTOK_PIXEL__ : ''
const ga4Id = typeof __GA4_ID__ !== 'undefined' ? __GA4_ID__ : ''
const metaTest = typeof __META_TEST__ !== 'undefined' ? __META_TEST__ : ''
const tiktokTest = typeof __TIKTOK_TEST__ !== 'undefined' ? __TIKTOK_TEST__ : ''

// nx_user: URL params first (cross-domain), then cookies/localStorage
function resolveNxUser(): string {
  const params = new URLSearchParams(window.location.search)
  const fromUrl = params.get('src') || params.get('sck')
  if (fromUrl) return fromUrl
  return readCookie('nx_user') || readCookie('nx_lid')
    || (() => { try { return localStorage.getItem('nx_user') ?? '' } catch { return '' } })()
}

function genId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return Math.random().toString(36).substring(2) + Date.now().toString(36)
}

const nxUser = resolveNxUser()
const signals = collectSignals()

// Initialize platform pixels
const meta = createMetaModule()
const tiktok = createTikTokModule()
const ga4 = createGA4Module()

if (metaPixelIds.length) meta.init(metaPixelIds, nxUser)
if (tiktokPixel) tiktok.init(tiktokPixel, nxUser, tiktokTest || undefined)
if (ga4Id) ga4.init(ga4Id, nxUser)

const firedEvents = new Set<EventName>()

function sendEvent(eventName: EventName, customData?: CustomData, userData?: Record<string, string>): void {
  if (!collectUrl) return
  if (firedEvents.has(eventName)) return
  firedEvents.add(eventName)

  const eventId = genId()
  const utms = collectUtms()
  const shopifyCartToken = readCookie('shopify_cart_token') || readCookie('cart_token')

  const payload: NexusEvent = {
    event: eventName,
    event_id: eventId,
    nx_user: nxUser,
    page_url: window.location.href.split('?')[0],
    page_title: document.title || undefined,
    browser_data: {
      user_agent: navigator.userAgent,
      language: navigator.language,
      screen_width: screen.width,
      screen_height: screen.height,
      cart_token: shopifyCartToken ?? undefined,
      fbp: signals.fbp,
      fbc: signals.fbc,
      fbclid: signals.fbclid,
      gclid: signals.gclid,
      gbraid: signals.gbraid,
      wbraid: signals.wbraid,
      ttclid: signals.ttclid,
      ttp: signals.ttp,
      msclkid: signals.msclkid,
    },
    utm_data: Object.keys(utms).length ? utms as NexusEvent['utm_data'] : undefined,
    custom_data: customData,
    user_data: userData as NexusEvent['user_data'],
    test_event_code: metaTest || undefined,
    tiktok_test_event_code: tiktokTest || undefined,
  }

  fetch(collectUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {})

  const signalMap: SignalMap = {
    fbclid: signals.fbclid,
    fbc: signals.fbc,
    fbp: signals.fbp,
    gclid: signals.gclid,
    gbraid: signals.gbraid,
    wbraid: signals.wbraid,
    ttclid: signals.ttclid,
    ttp: signals.ttp,
    msclkid: signals.msclkid,
  }
  if (metaPixelIds.length) meta.fire(eventName, eventId, customData, signalMap)
  if (tiktokPixel) tiktok.fire(eventName, eventId, customData, signalMap)
  if (ga4Id) ga4.fire(eventName, customData ? { value: customData.value, currency: customData.currency } : undefined)
}

function handleDataLayerItem(item: unknown): void {
  if (!item || typeof item !== 'object') return
  const e = item as Record<string, unknown>
  const eventName = CARTPANDA_EVENT_MAP[e.event as string]
  if (!eventName) return

  const ecomm = e.ecommerce as Record<string, unknown> | undefined
  const items = Array.isArray(ecomm?.items) ? (ecomm!.items as Record<string, unknown>[]) : []
  const first = items[0]

  sendEvent(eventName, {
    value: first?.price !== undefined ? parseFloat(String(first.price)) : undefined,
    currency: (ecomm?.currency as string | undefined) ?? 'BRL',
    contents: items.map(i => ({
      id: String(i.item_id ?? i.id ?? ''),
      name: i.item_name !== undefined ? String(i.item_name) : undefined,
      price: i.price !== undefined ? parseFloat(String(i.price)) : undefined,
      quantity: i.quantity !== undefined ? parseInt(String(i.quantity), 10) : undefined,
    })),
  })
}

// Observe dataLayer for CartPanda events
window.dataLayer = window.dataLayer ?? []
;([...window.dataLayer]).forEach(handleDataLayerItem)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const dl = window.dataLayer as any
const _push = dl.push as (...args: unknown[]) => number
dl.push = function (...args: unknown[]): number {
  const result = _push.apply(this as object, args)
  args.forEach(handleDataLayerItem)
  return result
}

// Lead capture via DOM
let leadFired = false
function captureLeadFromDom(): void {
  if (leadFired) return
  const emailEl = document.querySelector<HTMLInputElement>('input[type="email"], input[name*="email"]')
  const phoneEl = document.querySelector<HTMLInputElement>('input[type="tel"], input[name*="phone"], input[name*="cellphone"]')
  const email = emailEl?.value?.includes('@') ? emailEl.value : null
  const phone = phoneEl?.value && phoneEl.value.length > 8 ? phoneEl.value : null
  if (email || phone) {
    leadFired = true
    sendEvent('Lead', undefined, {
      ...(email ? { email } : {}),
      ...(phone ? { phone } : {}),
    })
  }
}

document.addEventListener('focusout', (e) => {
  const el = e.target as HTMLElement
  if (el instanceof HTMLInputElement &&
      (el.type === 'email' || el.type === 'tel' || el.name?.includes('email') || el.name?.includes('phone'))) {
    captureLeadFromDom()
  }
}, true)

// Fallback: fire InitiateCheckout after 2s if dataLayer was silent
setTimeout(() => {
  if (!firedEvents.has('InitiateCheckout')) {
    sendEvent('InitiateCheckout')
  }
}, 2000)
