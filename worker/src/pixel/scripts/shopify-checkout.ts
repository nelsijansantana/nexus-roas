// Shopify Customer Events sandbox: uses browser.* APIs, no document.cookie
import { createMetaModule } from '../platforms/meta'
import { createTikTokModule } from '../platforms/tiktok'
import { createGA4Module } from '../platforms/ga4'
import type { EventName, CustomData } from '../core/types'

// Globals injected via banner placeholders
declare const __NX_COLLECT__: string
declare const __META_PIXEL_IDS__: string[]
declare const __TIKTOK_PIXEL__: string
declare const __GA4_ID__: string
declare const __META_TEST__: string
declare const __TIKTOK_TEST__: string

// Shopify Customer Events sandbox API
declare const browser: {
  cookie: { get(name: string): { value: string } | null | undefined }
  localStorage: { getItem(key: string): string | null }
}

declare const analytics: {
  subscribe(event: string, handler: (event: { name: string; data: Record<string, unknown> }) => void): void
}

interface ShopifyCheckoutData {
  totalPrice?: { amount: string; currencyCode: string }
  lineItems?: Array<{
    variant?: { id?: string; price?: { amount: string } }
    quantity: number
  }>
  email?: string
  shippingAddress?: {
    city?: string
    provinceCode?: string
    countryCode?: string
    zip?: string
  }
}

function readSignal(name: string): string {
  return browser.cookie.get(name)?.value ?? ''
}

function genId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return Math.random().toString(36).substring(2) + Date.now().toString(36)
}

function parseAmt(amount?: string): number | undefined {
  if (!amount) return undefined
  const n = parseFloat(amount)
  return isNaN(n) ? undefined : n
}

const nxUser = readSignal('nx_user') || readSignal('nx_lid')
const collectUrl = typeof __NX_COLLECT__ !== 'undefined' ? __NX_COLLECT__ : ''
const metaPixelIds: string[] = typeof __META_PIXEL_IDS__ !== 'undefined' ? __META_PIXEL_IDS__ : []
const tiktokPixel = typeof __TIKTOK_PIXEL__ !== 'undefined' ? __TIKTOK_PIXEL__ : ''
const ga4Id = typeof __GA4_ID__ !== 'undefined' ? __GA4_ID__ : ''
const metaTest = typeof __META_TEST__ !== 'undefined' ? __META_TEST__ : ''
const tiktokTest = typeof __TIKTOK_TEST__ !== 'undefined' ? __TIKTOK_TEST__ : ''

// Read all available signals from sandbox cookie API
const signals = {
  fbp: readSignal('_fbp'),
  fbc: readSignal('_fbc') || (readSignal('_nx_fbclid') ? `fb.1.${Date.now()}.${readSignal('_nx_fbclid')}` : ''),
  fbclid: readSignal('_nx_fbclid'),
  gclid: readSignal('_nx_gclid'),
  ttclid: readSignal('_nx_ttclid'),
  ttp: readSignal('_ttp'),
}

// Initialize platform pixels
const meta = createMetaModule()
const tiktok = createTikTokModule()
const ga4 = createGA4Module()

if (metaPixelIds.length) meta.init(metaPixelIds, nxUser)
if (tiktokPixel) tiktok.init(tiktokPixel, nxUser, tiktokTest || undefined)
if (ga4Id) ga4.init(ga4Id, nxUser)

function sendEvent(eventName: EventName, customData?: CustomData, userData?: { email?: string; city?: string; state?: string; country?: string; zip?: string }): void {
  if (!collectUrl) return
  const eventId = genId()

  const payload = {
    event: eventName,
    event_id: eventId,
    nx_user: nxUser,
    page_url: window.location.href.split('?')[0],
    page_title: document.title || undefined,
    browser_data: {
      user_agent: navigator.userAgent,
      language: navigator.language,
      ...(signals.fbp && { fbp: signals.fbp }),
      ...(signals.fbc && { fbc: signals.fbc }),
      ...(signals.fbclid && { fbclid: signals.fbclid }),
      ...(signals.gclid && { gclid: signals.gclid }),
      ...(signals.ttclid && { ttclid: signals.ttclid }),
      ...(signals.ttp && { ttp: signals.ttp }),
    },
    ...(userData && Object.keys(userData).some(k => !!(userData as Record<string, unknown>)[k]) && { user_data: userData }),
    ...(customData && { custom_data: customData }),
    ...(metaTest && { test_event_code: metaTest }),
    ...(tiktokTest && { tiktok_test_event_code: tiktokTest }),
  }

  fetch(collectUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {})

  // Fire to platform pixels
  const signalMap = {
    fbclid: signals.fbclid || undefined,
    fbc: signals.fbc || undefined,
    fbp: signals.fbp || undefined,
    gclid: signals.gclid || undefined,
    ttclid: signals.ttclid || undefined,
    ttp: signals.ttp || undefined,
  }
  if (metaPixelIds.length) meta.fire(eventName, eventId, customData, signalMap)
  if (tiktokPixel) tiktok.fire(eventName, eventId, customData, signalMap)
  if (ga4Id) ga4.fire(eventName, customData ? { value: customData.value, currency: customData.currency } : undefined)
}

analytics.subscribe('checkout_started', (event) => {
  const checkout = (event.data as { checkout?: ShopifyCheckoutData }).checkout
  sendEvent('InitiateCheckout', {
    value: parseAmt(checkout?.totalPrice?.amount),
    currency: checkout?.totalPrice?.currencyCode,
    contents: checkout?.lineItems?.map(item => ({
      id: String(item.variant?.id ?? ''),
      quantity: item.quantity,
      price: parseAmt(item.variant?.price?.amount),
    })),
  })
})

analytics.subscribe('checkout_contact_info_submitted', (event) => {
  const checkout = (event.data as { checkout?: ShopifyCheckoutData }).checkout
  sendEvent('AddContactInfo', undefined, { email: checkout?.email })
})

analytics.subscribe('checkout_shipping_info_submitted', (event) => {
  const checkout = (event.data as { checkout?: ShopifyCheckoutData }).checkout
  const addr = checkout?.shippingAddress
  sendEvent('AddShippingInfo', undefined, {
    city: addr?.city,
    state: addr?.provinceCode,
    country: addr?.countryCode,
    zip: addr?.zip,
  })
})

analytics.subscribe('payment_info_submitted', () => {
  sendEvent('AddPaymentInfo')
})
// checkout_completed deliberately omitted — purchase handled via webhook (story 7.2)
