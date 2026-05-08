import type { NexusEvent, EventName, CustomData, PixelConfig, SignalMap } from './types'
import { getOrCreateNxUser } from './identity'
import { collectSignals, collectUtms, readCookie } from './signals'

const dedupBuffer = new Set<string>()

function generateEventId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  // Fallback for older browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

export function generatePurchaseEventId(pixelId: string, orderId: string): string {
  return `purchase_${pixelId}_${orderId}`
}

function buildBrowserData(signals: SignalMap) {
  return {
    user_agent: navigator.userAgent,
    language: navigator.language,
    screen_width: screen.width,
    screen_height: screen.height,
    viewport_width: window.innerWidth,
    viewport_height: window.innerHeight,
    pixel_ratio: window.devicePixelRatio,
    cart_token: readCookie('cart_token') ?? readCookie('cart') ?? undefined,
    fbp: signals.fbp,
    fbc: signals.fbc,
    fbclid: signals.fbclid,
    gclid: signals.gclid,
    gbraid: signals.gbraid,
    wbraid: signals.wbraid,
    ttclid: signals.ttclid,
    ttp: signals.ttp,
    msclkid: signals.msclkid,
    twclid: signals.twclid,
    ga_client_id: signals.ga_client_id,
  }
}

function buildPayload(
  nxUser: string,
  signals: SignalMap,
  utms: Record<string, string>,
  eventName: EventName,
  customData?: CustomData,
  eventId?: string,
  config?: PixelConfig,
): NexusEvent {
  const id = eventId ?? generateEventId()
  return {
    event: eventName,
    event_id: id,
    nx_user: nxUser,
    page_url: window.location.href.split('?')[0],
    page_title: document.title || undefined,
    page_referrer: document.referrer || undefined,
    browser_data: buildBrowserData(signals),
    utm_data: Object.keys(utms).length ? utms as Partial<import('./types').UtmData> : undefined,
    custom_data: customData,
    test_event_code: config?.meta_test_event_code,
    tiktok_test_event_code: config?.tiktok_test_event_code,
  }
}

function sendEvent(payload: NexusEvent, collectUrl: string): void {
  fetch(collectUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {})
}

export interface Publisher {
  track(eventName: EventName, customData?: CustomData, eventId?: string): string
}

export function createPublisher(config: PixelConfig): Publisher {
  const nxUser = getOrCreateNxUser()
  const signals = collectSignals()

  return {
    track(eventName: EventName, customData?: CustomData, eventId?: string): string {
      const utms = collectUtms()

      let id = eventId
      if (!id && eventName === 'Purchase' && customData?.order_id && config.pixel_id) {
        id = generatePurchaseEventId(config.pixel_id, customData.order_id)
      }

      const payload = buildPayload(nxUser, signals, utms, eventName, customData, id, config)

      if (dedupBuffer.has(payload.event_id)) return payload.event_id
      dedupBuffer.add(payload.event_id)

      sendEvent(payload, config.collect_url)
      return payload.event_id
    },
  }
}

export function track(
  collectUrl: string,
  pixelId: string,
  eventName: EventName,
  customData?: CustomData,
  eventId?: string,
): string {
  const config: PixelConfig = { collect_url: collectUrl, pixel_id: pixelId }
  return createPublisher(config).track(eventName, customData, eventId)
}
