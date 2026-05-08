import { ParsedGatewayEvent, ParsedCustomer } from '../lib/gateways/types'

const GA4_MP_URL = 'https://www.google-analytics.com/mp/collect'

// AC5: Nexus event name → GA4 event name
const EVENT_MAP: Record<string, string> = {
  purchase:          'purchase',
  Purchase:          'purchase',
  InitiateCheckout:  'begin_checkout',
  AddPaymentInfo:    'add_payment_info',
  AddShippingInfo:   'add_shipping_info',
  AddToCart:         'add_to_cart',
  ViewContent:       'view_item',
  PageView:          'page_view',
  Lead:              'generate_lead',
  AddContactInfo:    'sign_up',
}

export interface GA4Project {
  measurement_id: string
  api_secret:     string
}

export interface GA4Result {
  success: boolean
  error?:  string
}

// AC2: PII in plain text — GA4 hashes internally (do NOT sha256 here)
function buildUserData(customer: ParsedCustomer): Record<string, unknown> {
  const ud: Record<string, unknown> = {}

  if (customer.email)      ud.email        = customer.email
  if (customer.phone)      ud.phone_number = customer.phone // E.164
  if (customer.first_name) ud.first_name   = customer.first_name
  if (customer.last_name)  ud.last_name    = customer.last_name

  const address: Record<string, string> = {}
  if (customer.city)    address.city        = customer.city
  if (customer.state)   address.region      = customer.state
  if (customer.zip)     address.postal_code = customer.zip
  if (customer.country) address.country     = customer.country
  if (Object.keys(address).length > 0) ud.address = address

  return ud
}

function buildEventParams(event: ParsedGatewayEvent): Record<string, unknown> {
  const params: Record<string, unknown> = {
    value:    event.value,
    currency: event.currency || 'BRL',
  }

  // AC8: transaction_id for purchase events
  if (event.order_id) params.transaction_id = event.order_id

  // AC7: items in GA4 format
  if (event.items.length > 0) {
    params.items = event.items.map(item => ({
      item_id:   item.id,
      item_name: item.name || item.id,
      price:     item.price,
      quantity:  item.quantity,
    }))
  }

  return params
}

function resolveEventName(event: ParsedGatewayEvent): string {
  const prefix = event.event_id.split('_')[0]
  return EVENT_MAP[prefix] || EVENT_MAP[event.gateway] || 'purchase'
}

/**
 * AC1: Dispatches a ParsedGatewayEvent to GA4 Measurement Protocol.
 * AC9: Never throws.
 */
export async function dispatchGA4(
  event:   ParsedGatewayEvent,
  project: GA4Project,
): Promise<GA4Result> {
  try {
    // AC3: client_id from ga_client_id or nx_user fallback
    const clientId = event.ga_client_id || event.nx_user || crypto.randomUUID()

    const payload: Record<string, unknown> = {
      client_id:        clientId,
      user_id:          event.nx_user || undefined, // AC4
      timestamp_micros: Date.now() * 1000,
      user_data:        buildUserData(event.customer),
      events: [{
        name:   resolveEventName(event),
        params: buildEventParams(event),
      }],
    }

    const url = `${GA4_MP_URL}?measurement_id=${project.measurement_id}&api_secret=${project.api_secret}`

    const res = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    })

    if (res.ok) return { success: true }
    const text = await res.text()
    return { success: false, error: `${res.status}: ${text.slice(0, 300)}` }
  } catch (err: unknown) {
    // AC9: never throw
    return { success: false, error: String(err) }
  }
}
