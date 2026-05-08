import { Env } from '../types'
import { getParser, ParsedGatewayEvent } from '../lib/gateways'
import { getConfig } from '../shared/config'
import { GatewayQueueMessage } from '../handlers/gateways/generic'
import { dispatchMetaCapi } from '../capi/meta'
import { dispatchTikTokCapi } from '../capi/tiktok'
import { dispatchGA4 } from '../capi/ga4'
import { dispatchGoogleAds } from '../capi/gads'

type MatchType = 'nx_user' | 'cart_token' | 'email_phone' | 'no_match'

interface AttributionData {
  fbclid?:       string
  fbc?:          string
  gclid?:        string
  gbraid?:       string
  wbraid?:       string
  ttclid?:       string
  msclkid?:      string
  twclid?:       string
  fbp?:          string
  ttp?:          string
  ga_client_id?: string
}

interface CheckoutSignals {
  nx_user:  string
  fbp?:     string
  fbc?:     string
  fbclid?:  string
  gclid?:   string
  ttclid?:  string
  ttp?:     string
}

interface IdentityResult {
  nx_user:     string | null
  match_type:  MatchType
  attribution: AttributionData | null
  signals?:    CheckoutSignals | null
}

async function recoverAttribution(
  nxUser:  string,
  pixelId: string,
  env:     Env,
): Promise<AttributionData | null> {
  try {
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000

    const [attrRow, userRow] = await Promise.all([
      env.DB.prepare(`
        SELECT fbclid, fbc, gclid, gbraid, wbraid, ttclid, msclkid, twclid
        FROM user_attribution
        WHERE nx_user = ? AND pixel_id = ? AND updated_at >= ?
        ORDER BY updated_at DESC
        LIMIT 1
      `).bind(nxUser, pixelId, thirtyDaysAgo).first<Record<string, string>>(),

      env.DB.prepare(`
        SELECT fbp, ttp, ga_client_id
        FROM user_store
        WHERE nx_user = ?
        LIMIT 1
      `).bind(nxUser).first<{ fbp?: string; ttp?: string; ga_client_id?: string }>(),
    ])

    if (!attrRow && !userRow) return null

    return {
      fbclid:       attrRow?.fbclid  || undefined,
      fbc:          attrRow?.fbc     || undefined,
      gclid:        attrRow?.gclid   || undefined,
      gbraid:       attrRow?.gbraid  || undefined,
      wbraid:       attrRow?.wbraid  || undefined,
      ttclid:       attrRow?.ttclid  || undefined,
      msclkid:      attrRow?.msclkid || undefined,
      twclid:       attrRow?.twclid  || undefined,
      fbp:          userRow?.fbp          || undefined,
      ttp:          userRow?.ttp          || undefined,
      ga_client_id: userRow?.ga_client_id || undefined,
    }
  } catch {
    return null
  }
}

async function resolveIdentity(
  event: ParsedGatewayEvent,
  env:   Env,
): Promise<IdentityResult> {
  // AC4: nx_user already extracted by gateway parser from metadata/note_attributes
  // (Yampi _nx_user and Shopify cart.attributes are parsed before this point)
  if (event.nx_user) {
    const attribution = await recoverAttribution(event.nx_user, event.pixel_id!, env)
    return { nx_user: event.nx_user, match_type: 'nx_user', attribution }
  }

  // Level 2: cart_token → checkout_sessions
  if (event.cart_token) {
    try {
      const session = await env.DB.prepare(`
        SELECT nx_user, fbp, fbc, fbclid, gclid, ttclid, ttp
        FROM checkout_sessions
        WHERE token = ? AND pixel_id = ?
      `).bind(event.cart_token, event.pixel_id!).first<CheckoutSignals>()

      if (session?.nx_user) {
        const attribution = await recoverAttribution(session.nx_user, event.pixel_id!, env)
        return {
          nx_user:    session.nx_user,
          match_type: 'cart_token',
          attribution,
          signals:    session,
        }
      }
    } catch {
      // Fall through to next level
    }
  }

  // Level 3: email + phone → user_store (no pixel_id column)
  if (event.customer.email || event.customer.phone) {
    try {
      const user = await env.DB.prepare(`
        SELECT nx_user FROM user_store
        WHERE (email = ? AND email != '') OR (phone = ? AND phone != '')
        LIMIT 1
      `).bind(
        event.customer.email || '',
        event.customer.phone || '',
      ).first<{ nx_user: string }>()

      if (user?.nx_user) {
        const attribution = await recoverAttribution(user.nx_user, event.pixel_id!, env)
        return { nx_user: user.nx_user, match_type: 'email_phone', attribution }
      }
    } catch {
      // Fall through to no_match
    }
  }

  return { nx_user: null, match_type: 'no_match', attribution: null }
}

function mergeAttribution(
  event:    ParsedGatewayEvent,
  identity: IdentityResult,
): ParsedGatewayEvent {
  const a = identity.attribution
  const s = identity.signals

  return {
    ...event,
    nx_user:      identity.nx_user || event.nx_user,
    fbclid:       event.fbclid  || s?.fbclid  || a?.fbclid  || undefined,
    fbc:          event.fbc     || s?.fbc     || a?.fbc     || undefined,
    fbp:          event.fbp     || s?.fbp     || a?.fbp     || undefined,
    gclid:        event.gclid   || s?.gclid   || a?.gclid   || undefined,
    gbraid:       event.gbraid  || a?.gbraid  || undefined,
    wbraid:       event.wbraid  || a?.wbraid  || undefined,
    ttclid:       event.ttclid  || s?.ttclid  || a?.ttclid  || undefined,
    ttp:          event.ttp     || s?.ttp     || a?.ttp     || undefined,
    msclkid:      event.msclkid || a?.msclkid || undefined,
    twclid:       event.twclid  || a?.twclid  || undefined,
    ga_client_id: event.ga_client_id || a?.ga_client_id || undefined,
  }
}

function toCapiStatus(r: PromiseSettledResult<{ success: boolean; skipped?: boolean }>): number {
  if (r.status === 'rejected') return 0
  if (r.value.skipped)         return -1
  return r.value.success ? 1 : 0
}

async function markProcessed(
  db:      D1Database,
  siteId:  string,
  gateway: string,
  orderId: string,
  error?:  string,
): Promise<void> {
  try {
    if (error) {
      await db.prepare(
        `UPDATE webhook_raw SET processed = 1, error = ? WHERE site_id = ? AND gateway = ? AND order_id = ?`
      ).bind(error, siteId, gateway, orderId).run()
    } else {
      await db.prepare(
        `UPDATE webhook_raw SET processed = 1 WHERE site_id = ? AND gateway = ? AND order_id = ?`
      ).bind(siteId, gateway, orderId).run()
    }
  } catch {
    // Non-fatal — record may not exist yet if INSERT OR IGNORE raced
  }
}

/**
 * AC1: Processes a GatewayQueueMessage — identity resolution + CAPI dispatch.
 * AC8: CAPI failures are isolated via Promise.allSettled (no throws).
 */
export async function processGatewayEvent(
  msg: GatewayQueueMessage,
  env: Env,
): Promise<void> {
  let body: unknown
  try {
    body = JSON.parse(msg.raw_payload)
  } catch {
    await markProcessed(env.DB, msg.pixel_id, msg.gateway, msg.order_id, 'invalid_json')
    return
  }

  // Inject Shopify topic so the parser can filter non-purchase webhooks
  if (msg.gateway === 'shopify' && msg.metadata?.topic) {
    ;(body as Record<string, unknown>).__topic = msg.metadata.topic
  }

  let event: ParsedGatewayEvent | null
  try {
    event = getParser(msg.gateway).parse(body)
  } catch (err) {
    await markProcessed(env.DB, msg.pixel_id, msg.gateway, msg.order_id, String(err))
    return
  }

  if (!event) {
    // Parser returned null — not a dispatchable event (e.g. Shopify order.created without payment)
    await markProcessed(env.DB, msg.pixel_id, msg.gateway, msg.order_id)
    return
  }

  event = { ...event, pixel_id: msg.pixel_id }

  // AC2: 4-level identity resolution
  const identity = await resolveIdentity(event, env)

  // AC7: log match_type for observability
  console.log(`[processor] ${msg.gateway} order=${msg.order_id} match=${identity.match_type} nx_user=${identity.nx_user ?? 'none'}`)

  // AC3: merge recovered attribution signals into event
  const enrichedEvent = mergeAttribution(event, identity)

  const config = await getConfig(msg.pixel_id, env)
  const { meta, tiktok, ga4, google_ads: gads } = config.platforms ?? {}

  // AC5: build dispatch tasks
  const dispatches = [
    meta?.pixel_id && meta?.access_token
      ? dispatchMetaCapi(enrichedEvent, {
          pixel_id:         meta.pixel_id,
          access_token:     meta.access_token,
          pixel_ids_mirror: meta.pixel_ids_mirror,
        })
      : Promise.resolve({ success: true, skipped: true }),

    tiktok?.pixel_id && tiktok?.access_token
      ? dispatchTikTokCapi(enrichedEvent, {
          pixel_id:     tiktok.pixel_id,
          access_token: tiktok.access_token,
        })
      : Promise.resolve({ success: true, skipped: true }),

    ga4?.measurement_id && ga4?.api_secret
      ? dispatchGA4(enrichedEvent, {
          measurement_id: ga4.measurement_id,
          api_secret:     ga4.api_secret,
        })
      : Promise.resolve({ success: true, skipped: true }),

    gads?.conversion_id
      ? dispatchGoogleAds(enrichedEvent, {
          google_ads_conversion_id: gads.conversion_id,
          google_ads_events:        gads.events,
        })
      : Promise.resolve({ success: true, skipped: true }),
  ] as const

  // AC5/AC8: parallel dispatch — one CAPI failure does not cancel others
  const [metaR, tiktokR, ga4R, gadsR] = await Promise.allSettled(dispatches)

  // AC6: persist CAPI dispatch results to capi_log
  try {
    await env.DB.prepare(`
      INSERT OR REPLACE INTO capi_log
        (pixel_id, event_id, event_name, nx_user, capi_meta, capi_tiktok, capi_ga4, capi_gads, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      msg.pixel_id,
      enrichedEvent.event_id,
      'Purchase',
      identity.nx_user ?? '',
      toCapiStatus(metaR),
      toCapiStatus(tiktokR),
      toCapiStatus(ga4R),
      toCapiStatus(gadsR),
      Date.now(),
    ).run()
  } catch {
    // Non-fatal
  }

  await markProcessed(env.DB, msg.pixel_id, msg.gateway, msg.order_id)
}
