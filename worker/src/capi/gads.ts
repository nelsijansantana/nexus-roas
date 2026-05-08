import { ParsedGatewayEvent } from '../lib/gateways/types'
import { sha256 } from './utils'

const GADS_GTAG_URL = 'https://www.google.com/pagead/conversion/app/version/1'

export interface GAdsProject {
  /** AW-XXXXXXXXXX — Google Ads conversion ID */
  google_ads_conversion_id: string
  /** Conversion action mapping: event name → action resource or gtag label */
  google_ads_events?: Record<string, { label?: string; action_resource?: string }>
}

export interface GAdsResult {
  success:  boolean
  skipped?: boolean
  error?:   string
}

/**
 * AC1: Dispatches a Google Ads offline conversion.
 * AC2/AC3: Skips gracefully when no Google click IDs present.
 * AC8: Never throws.
 */
export async function dispatchGoogleAds(
  event:   ParsedGatewayEvent,
  project: GAdsProject,
): Promise<GAdsResult> {
  try {
    // AC2: only dispatch when a Google click ID is present
    if (!event.gclid && !event.gbraid && !event.wbraid) {
      return { success: true, skipped: true } // AC3
    }

    // AC5: require conversion action configured for purchase
    const conversionAction = project.google_ads_events?.['Purchase']
      || project.google_ads_events?.['purchase']
    if (!project.google_ads_conversion_id || !conversionAction) {
      return { success: true, skipped: true }
    }

    const sendTo = conversionAction.label
      ? `${project.google_ads_conversion_id}/${conversionAction.label}`
      : project.google_ads_conversion_id

    // Hash external_id for enhanced conversions
    const externalId = await sha256(event.nx_user || '')

    const payload: Record<string, unknown> = {
      event_name:       'conversion',
      send_to:          sendTo,       // AC5
      transaction_id:   event.order_id, // AC7
      currency_code:    event.currency || 'BRL',
      value:            event.value,   // AC6
      user_data: {
        sha256_email_address: externalId ? [externalId] : undefined,
      },
    }

    if (event.gclid)  payload.gclid  = event.gclid
    if (event.gbraid) payload.gbraid = event.gbraid
    if (event.wbraid) payload.wbraid = event.wbraid

    const res = await fetch(GADS_GTAG_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    })

    if (res.ok) return { success: true }
    const text = await res.text()
    return { success: false, error: `${res.status}: ${text.slice(0, 300)}` }
  } catch (err: unknown) {
    // AC8: never throw
    return { success: false, error: String(err) }
  }
}

