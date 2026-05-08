import { getOrCreateNxUser } from '../core/identity'
import { collectSignals, collectUtms } from '../core/signals'
import { createPublisher } from '../core/publisher'
import { initLinkDecorator } from '../core/link-decorator'
import { createMetaModule } from '../platforms/meta'
import { createTikTokModule } from '../platforms/tiktok'
import { createGA4Module } from '../platforms/ga4'
import type { PixelConfig, SignalMap, EventName, CustomData, EventTrigger } from '../core/types'

// Globals injected via banner placeholders
declare const __CONFIG__: PixelConfig
declare const __NX_COLLECT__: string
declare const __META_PIXEL_IDS__: string[]
declare const __TIKTOK_PIXEL__: string
declare const __GA4_ID__: string
declare const __META_TEST__: string
declare const __TIKTOK_TEST__: string

declare global {
  interface Window {
    __NX_INITIALIZED__?: boolean
    dataLayer?: unknown[]
  }
}

if (!window.__NX_INITIALIZED__) {
  window.__NX_INITIALIZED__ = true

  const config: PixelConfig = typeof __CONFIG__ !== 'undefined' ? __CONFIG__ : {
    collect_url: typeof __NX_COLLECT__ !== 'undefined' ? __NX_COLLECT__ : '',
    meta_pixel_id: (typeof __META_PIXEL_IDS__ !== 'undefined' && __META_PIXEL_IDS__[0]) || undefined,
    tiktok_pixel_id: typeof __TIKTOK_PIXEL__ !== 'undefined' ? __TIKTOK_PIXEL__ : undefined,
    ga4_measurement_id: typeof __GA4_ID__ !== 'undefined' ? __GA4_ID__ : undefined,
    meta_test_event_code: typeof __META_TEST__ !== 'undefined' ? __META_TEST__ : undefined,
    tiktok_test_event_code: typeof __TIKTOK_TEST__ !== 'undefined' ? __TIKTOK_TEST__ : undefined,
  }

  const nxUser = getOrCreateNxUser()
  const signals = collectSignals()
  const publisher = createPublisher(config)

  const meta = createMetaModule()
  const tiktok = createTikTokModule()
  const ga4 = createGA4Module()

  const metaIds = (typeof __META_PIXEL_IDS__ !== 'undefined' && __META_PIXEL_IDS__.length)
    ? __META_PIXEL_IDS__
    : (config.meta_pixel_id ? [config.meta_pixel_id, ...(config.meta_pixel_ids_mirror ?? [])] : [])

  if (metaIds.length) meta.init(metaIds, nxUser, config.geo)
  if (config.tiktok_pixel_id) tiktok.init(config.tiktok_pixel_id, nxUser, config.tiktok_test_event_code)
  if (config.ga4_measurement_id) ga4.init(config.ga4_measurement_id, nxUser)

  function buildGa4Params(cd: CustomData): Record<string, unknown> {
    const p: Record<string, unknown> = {}
    if (cd.value !== undefined) p.value = cd.value
    if (cd.currency) p.currency = cd.currency
    if (cd.search_string) p.search_term = cd.search_string
    return p
  }

  function fireAll(eventName: EventName, customData?: CustomData): void {
    const eventId = publisher.track(eventName, customData)
    if (metaIds.length) meta.fire(eventName, eventId, customData, signals)
    if (config.tiktok_pixel_id) tiktok.fire(eventName, eventId, customData, signals)
    if (config.ga4_measurement_id) {
      ga4.fire(eventName, customData ? buildGa4Params(customData) : undefined)
    }
  }

  fireAll('PageView')

  // DataLayer observer for manual events from landing pages
  function onDataLayerItem(item: unknown): void {
    if (!item || typeof item !== 'object') return
    const e = item as Record<string, unknown>
    switch (e.event as string) {
      case 'lead':
        fireAll('Lead', { value: e.value as number | undefined })
        break
      case 'view_item':
        fireAll('ViewContent', {
          value: e.value as number | undefined,
          currency: e.currency as string | undefined,
        })
        break
      case 'search':
        fireAll('Search', { search_string: e.search_term as string | undefined })
        break
    }
  }

  window.dataLayer = window.dataLayer ?? []
  ;([...window.dataLayer]).forEach(onDataLayerItem)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dl = window.dataLayer as any
  const _push = dl.push as (...args: unknown[]) => number
  dl.push = function (...args: unknown[]): number {
    const result = _push.apply(this as object, args)
    args.forEach(onDataLayerItem)
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
      fireAll('Lead')
    }
  }

  document.addEventListener('focusout', (e) => {
    const el = e.target as HTMLElement
    if (el instanceof HTMLInputElement &&
        (el.type === 'email' || el.type === 'tel' || el.name?.includes('email') || el.name?.includes('phone'))) {
      captureLeadFromDom()
    }
  }, true)

  // Configurable trigger engine
  function initTriggerEngine(triggers: EventTrigger[]): void {
    for (const trigger of triggers) {
      const { type, event: eventName, selector, depth: scrollDepth, seconds: timeSeconds, custom_data: customData } = trigger

      switch (type) {
        case 'pageload':
          fireAll(eventName, customData)
          break

        case 'click':
          document.addEventListener('click', (e) => {
            const el = (e.target as Element).closest(selector || '*')
            if (!el) return
            fireAll(eventName, customData)
          }, true)
          break

        case 'scroll':
          if (!scrollDepth) break
          let scrollFired = false
          window.addEventListener('scroll', () => {
            if (scrollFired) return
            const total = document.documentElement.scrollHeight || 1
            const pct = (window.scrollY + window.innerHeight) / total * 100
            if (pct >= scrollDepth) {
              scrollFired = true
              fireAll(eventName, customData)
            }
          }, { passive: true })
          break

        case 'time_on_page':
          if (timeSeconds && timeSeconds > 0) {
            setTimeout(() => fireAll(eventName, customData), timeSeconds * 1000)
          }
          break

        case 'form_submit':
          document.addEventListener('submit', (e) => {
            const form = e.target as HTMLFormElement
            if (selector && !form.matches(selector)) return
            fireAll(eventName, customData)
          })
          break
      }
    }
  }

  if (config.triggers?.length) {
    initTriggerEngine(config.triggers)
  }

  // Decorate external checkout links
  initLinkDecorator(nxUser, signals)
}
