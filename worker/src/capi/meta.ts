import { ParsedGatewayEvent, ParsedCustomer } from '../lib/gateways/types'
import { sha256 } from './utils'

const META_API_VERSION = 'v21.0'

// AC3: Nexus event name → Meta standard event
const EVENT_MAP: Record<string, string> = {
  purchase:          'Purchase',
  Purchase:          'Purchase',
  InitiateCheckout:  'InitiateCheckout',
  AddPaymentInfo:    'AddPaymentInfo',
  AddShippingInfo:   'AddPaymentInfo',
  AddContactInfo:    'Lead',
  AddToCart:         'AddToCart',
  ViewContent:       'ViewContent',
  PageView:          'PageView',
  Lead:              'Lead',
  Contact:           'Lead',
}

export interface MetaProject {
  pixel_id:          string
  access_token:      string
  pixel_ids_mirror?: string[]
  test_event_code?:  string
}

export interface MetaCapiResult {
  success:  boolean
  error?:   string
}

async function buildUserData(
  customer: ParsedCustomer,
  event:    ParsedGatewayEvent,
): Promise<Record<string, unknown>> {
  const [em, ph, fn, ln, ct, st, zp, country, externalId] = await Promise.all([
    sha256(customer.email        || ''),
    sha256(customer.phone        || ''), // E.164 already normalized by parser
    sha256(customer.first_name   || ''),
    sha256(customer.last_name    || ''),
    sha256(customer.city         || ''),
    sha256(customer.state        || ''),
    sha256((customer.zip || '').replace(/\D/g, '')), // digits only
    sha256(customer.country      || ''),
    sha256(event.nx_user         || ''),
  ])

  const ud: Record<string, unknown> = {}

  if (em)         ud.em          = [em]
  if (ph)         ud.ph          = [ph]
  if (fn)         ud.fn          = [fn]
  if (ln)         ud.ln          = [ln]
  if (ct)         ud.ct          = [ct]
  if (st)         ud.st          = [st]
  if (zp)         ud.zp          = [zp]
  if (country)    ud.country     = [country]
  if (externalId) ud.external_id = [externalId]

  // AC5: fbc, fbp, fbclid — NOT hashed, included as-is
  if (event.fbc)    ud.fbc    = event.fbc
  if (event.fbp)    ud.fbp    = event.fbp
  if (event.fbclid) ud.fbclid = event.fbclid

  if (customer.ip)         ud.client_ip_address = customer.ip
  if (customer.user_agent) ud.client_user_agent = customer.user_agent

  return ud
}

function buildCustomData(event: ParsedGatewayEvent): Record<string, unknown> {
  const cd: Record<string, unknown> = {
    currency: event.currency || 'BRL',
    value:    event.value,
    order_id: event.order_id,
  }

  if (event.items.length > 0) {
    cd.contents = event.items.map(item => ({
      id:         item.id,
      quantity:   item.quantity,
      item_price: item.price,
    }))
    cd.num_items    = event.items.length
    cd.content_type = 'product'
    cd.content_ids  = event.items.map(i => i.id)
  }

  return cd
}

function resolveEventTime(event: ParsedGatewayEvent): number {
  const now  = Math.floor(Date.now() / 1000)
  const raw  = event.event_time
  // Detect ms timestamps; clamp to 7-day window (Meta requirement)
  const secs = raw > 1_000_000_000_000 ? Math.floor(raw / 1000) : raw
  return Math.max(now - 604800, Math.min(secs, now))
}

function resolveEventName(event: ParsedGatewayEvent): string {
  // event_id format from parsers: "purchase_{orderId}" → prefix is event type
  const prefix = event.event_id.split('_')[0]
  return EVENT_MAP[prefix] || EVENT_MAP[event.gateway] || 'Purchase'
}

async function postToPixel(
  pixelId:         string,
  accessToken:     string,
  payload:         Record<string, unknown>,
): Promise<{ success: boolean; error?: string }> {
  const url = `https://graph.facebook.com/${META_API_VERSION}/${pixelId}/events?access_token=${accessToken}`
  try {
    const res = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    })
    if (res.ok) return { success: true }
    const text = await res.text()
    return { success: false, error: `${res.status}: ${text.slice(0, 300)}` }
  } catch (err: unknown) {
    return { success: false, error: String(err) }
  }
}

/**
 * AC1: Dispatches a ParsedGatewayEvent to Meta Conversions API.
 * AC8: Fires for principal pixel + all mirrors.
 * AC9: Never throws — always returns MetaCapiResult.
 */
export async function dispatchMetaCapi(
  event:   ParsedGatewayEvent,
  project: MetaProject,
): Promise<MetaCapiResult> {
  try {
    const eventName  = resolveEventName(event)
    const userData   = await buildUserData(event.customer, event)
    const customData = buildCustomData(event)

    // AC4: deterministic event_id — matches browser pixel format for deduplication
    const eventId = event.pixel_id
      ? `purchase_${event.pixel_id}_${event.order_id}`
      : event.event_id

    const payload: Record<string, unknown> = {
      data: [{
        event_name:    eventName,
        event_time:    resolveEventTime(event),
        event_id:      eventId,
        action_source: 'website', // AC6
        user_data:     userData,
        custom_data:   customData,
      }],
    }

    if (project.test_event_code) {
      payload.test_event_code = project.test_event_code
    }

    // AC8: principal pixel + mirrors
    const pixels  = [project.pixel_id, ...(project.pixel_ids_mirror || [])]
    const results = await Promise.all(
      pixels.map(pid => postToPixel(pid, project.access_token, payload)),
    )

    const failed = results.filter(r => !r.success)
    if (failed.length === 0) return { success: true }

    return {
      success: false,
      error:   failed.map(f => f.error).join('; '),
    }
  } catch (err: unknown) {
    // AC9: never throw
    return { success: false, error: String(err) }
  }
}
