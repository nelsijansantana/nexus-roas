import { ParsedGatewayEvent, ParsedCustomer } from '../lib/gateways/types'
import { sha256 } from './utils'

const TIKTOK_API_URL = 'https://business-api.tiktok.com/open_api/v1.3/event/track/'

// AC3: Nexus event name → TikTok standard event
const EVENT_MAP: Record<string, string> = {
  purchase:          'Purchase',
  Purchase:          'Purchase',
  InitiateCheckout:  'InitiateCheckout',
  AddPaymentInfo:    'AddPaymentInfo',
  AddToCart:         'AddToCart',
  ViewContent:       'ViewContent',
  Lead:              'SubmitForm',
  AddContactInfo:    'CompleteRegistration',
}

export interface TikTokProject {
  pixel_id:     string
  access_token: string
  test_event?:  string
}

export interface TikTokCapiResult {
  success: boolean
  error?:  string
}

async function buildUser(
  customer: ParsedCustomer,
  event:    ParsedGatewayEvent,
): Promise<Record<string, unknown>> {
  const [email, phone, externalId] = await Promise.all([
    sha256(customer.email || ''),
    sha256(customer.phone || ''), // E.164 normalized by parser
    sha256(event.nx_user  || ''),
  ])

  const user: Record<string, unknown> = {}

  // AC2: hashed fields
  if (email)      user.email       = email
  if (phone)      user.phone_number = phone
  if (externalId) user.external_id = externalId

  // AC5: ttclid and ttp — NOT hashed, included as-is
  if (event.ttclid) user.ttclid = event.ttclid
  if (event.ttp)    user.ttp    = event.ttp

  if (customer.ip)         user.ip         = customer.ip
  if (customer.user_agent) user.user_agent = customer.user_agent

  return user
}

function buildProperties(event: ParsedGatewayEvent): Record<string, unknown> {
  const props: Record<string, unknown> = {
    currency: event.currency || 'BRL',
    value:    event.value,
    order_id: event.order_id,
  }

  if (event.items.length > 0) {
    props.contents = event.items.map(item => ({
      content_id:   item.id,
      content_name: item.name || item.id,
      price:        item.price,
      quantity:     item.quantity,
    }))
  }

  return props
}

function resolveEventTime(event: ParsedGatewayEvent): number {
  const now  = Math.floor(Date.now() / 1000)
  const raw  = event.event_time
  const secs = raw > 1_000_000_000_000 ? Math.floor(raw / 1000) : raw
  return Math.max(now - 604800, Math.min(secs, now))
}

function resolveEventName(event: ParsedGatewayEvent): string {
  const prefix = event.event_id.split('_')[0]
  return EVENT_MAP[prefix] || EVENT_MAP[event.gateway] || 'Purchase'
}

/**
 * AC1: Dispatches a ParsedGatewayEvent to TikTok Events API 2.0.
 * AC9: Never throws.
 */
export async function dispatchTikTokCapi(
  event:   ParsedGatewayEvent,
  project: TikTokProject,
): Promise<TikTokCapiResult> {
  try {
    const eventName = resolveEventName(event)
    const user      = await buildUser(event.customer, event)
    const properties = buildProperties(event)

    // AC4: deterministic event_id
    const eventId = event.pixel_id
      ? `purchase_${event.pixel_id}_${event.order_id}`
      : event.event_id

    const payload: Record<string, unknown> = {
      event_source:    'web',         // AC7
      event_source_id: project.pixel_id, // AC7
      data: [{
        event:      eventName,
        event_time: resolveEventTime(event),
        event_id:   eventId,
        user,
        properties,
      }],
    }

    if (project.test_event) {
      payload.test_event_code = project.test_event
    }

    const res = await fetch(TIKTOK_API_URL, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        'Access-Token': project.access_token, // AC6
      },
      body: JSON.stringify(payload),
    })

    if (res.ok) return { success: true }
    const text = await res.text()
    return { success: false, error: `${res.status}: ${text.slice(0, 300)}` }
  } catch (err: unknown) {
    // AC9: never throw
    return { success: false, error: String(err) }
  }
}
