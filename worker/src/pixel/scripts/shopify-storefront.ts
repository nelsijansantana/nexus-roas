import { getOrCreateNxUser } from '../core/identity'
import { collectSignals, collectUtms, readCookie } from '../core/signals'
import { createPublisher } from '../core/publisher'
import { initLinkDecorator } from '../core/link-decorator'
import { createMetaModule } from '../platforms/meta'
import { createTikTokModule } from '../platforms/tiktok'
import { createGA4Module } from '../platforms/ga4'
import type { PixelConfig, SignalMap, EventName, CustomData, ContentItem } from '../core/types'

// Globals injected via banner placeholders at serve time
declare const __CONFIG__: PixelConfig
declare const __NX_USER__: string

declare global {
  interface Window {
    __NX_INITIALIZED__?: boolean
    Shopify?: Record<string, unknown>
    dataLayer?: unknown[]
  }
}

if (!window.__NX_INITIALIZED__) {
  window.__NX_INITIALIZED__ = true

  const config: PixelConfig = typeof __CONFIG__ !== 'undefined' ? __CONFIG__ : { collect_url: '' }
  const nxUser = getOrCreateNxUser(typeof __NX_USER__ !== 'undefined' ? __NX_USER__ : undefined)
  const signals = collectSignals()
  const publisher = createPublisher(config)

  const meta = createMetaModule()
  const tiktok = createTikTokModule()
  const ga4 = createGA4Module()

  if (config.meta_pixel_id) {
    meta.init([config.meta_pixel_id, ...(config.meta_pixel_ids_mirror ?? [])], nxUser, config.geo)
  }
  if (config.tiktok_pixel_id) {
    tiktok.init(config.tiktok_pixel_id, nxUser, config.tiktok_test_event_code)
  }
  if (config.ga4_measurement_id) {
    ga4.init(config.ga4_measurement_id, nxUser)
  }

  function buildGa4Ecomm(cd: CustomData): Record<string, unknown> {
    const p: Record<string, unknown> = {}
    if (cd.value !== undefined) p.value = cd.value
    if (cd.currency) p.currency = cd.currency
    if (cd.contents?.length) {
      p.items = cd.contents.map(c => ({
        item_id: c.id,
        item_name: c.name,
        price: c.price,
        quantity: c.quantity,
      }))
    }
    return p
  }

  function fireAll(eventName: EventName, customData?: CustomData): void {
    const eventId = publisher.track(eventName, customData)
    if (config.meta_pixel_id) meta.fire(eventName, eventId, customData, signals)
    if (config.tiktok_pixel_id) tiktok.fire(eventName, eventId, customData, signals)
    if (config.ga4_measurement_id) {
      ga4.fire(eventName, customData ? buildGa4Ecomm(customData) : undefined)
    }
  }

  fireAll('PageView')

  // Sync all tracking signals into cart.attributes for cross-domain transfer
  async function syncCartAttributes(): Promise<void> {
    const utms = collectUtms()
    const attrs: Record<string, string> = { nx_user: nxUser }
    ;['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'utm_id', 'src', 'sck']
      .forEach(k => { if (utms[k]) attrs[k] = utms[k] })
    ;(['fbclid', 'fbc', 'fbp', 'gclid', 'gbraid', 'wbraid', 'ttclid', 'ttp', 'msclkid'] as const)
      .forEach(k => { const v = signals[k]; if (v) attrs[k] = v })
    const ga = readCookie('_ga')
    if (ga) attrs['_ga'] = ga

    await fetch('/cart/update.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attributes: attrs }),
    }).catch(() => {})
  }

  if (window.Shopify) {
    void syncCartAttributes()
    document.addEventListener('cart:updated', () => void syncCartAttributes())
  }

  // Observer for Shopify GA4 ecommerce dataLayer events
  function parseItems(raw: unknown[]): ContentItem[] {
    return raw.map(r => {
      const item = r as Record<string, unknown>
      return {
        id: String(item.item_id ?? item.id ?? ''),
        name: item.item_name !== undefined ? String(item.item_name) : undefined,
        price: item.price !== undefined ? parseFloat(String(item.price)) : undefined,
        quantity: item.quantity !== undefined ? parseInt(String(item.quantity), 10) : undefined,
      }
    })
  }

  function onDataLayerItem(item: unknown): void {
    if (!item || typeof item !== 'object') return
    const e = item as Record<string, unknown>
    const ecomm = e.ecommerce as Record<string, unknown> | undefined
    const items = Array.isArray(ecomm?.items) ? (ecomm!.items as unknown[]) : []
    const first = items[0] as Record<string, unknown> | undefined
    const currency = (ecomm?.currency as string | undefined) ?? 'BRL'

    if (e.event === 'view_item') {
      fireAll('ViewContent', {
        value: first?.price !== undefined ? parseFloat(String(first.price)) : undefined,
        currency,
        contents: parseItems(items),
      })
    } else if (e.event === 'add_to_cart') {
      fireAll('AddToCart', {
        value: first?.price !== undefined ? parseFloat(String(first.price)) : undefined,
        currency,
        contents: parseItems(items),
      })
    } else if (e.event === 'view_item_list') {
      fireAll('ViewCategory')
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

  initLinkDecorator(nxUser, signals)
}
