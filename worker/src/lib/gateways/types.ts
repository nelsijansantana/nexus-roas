export interface ParsedCustomer {
  email?: string
  phone?: string       // E.164 (+55DDD...)
  first_name?: string
  last_name?: string
  city?: string
  state?: string
  zip?: string
  country?: string     // ISO 2-letter
  ip?: string
  user_agent?: string
}

export interface ParsedItem {
  id: string
  name?: string
  price: number
  quantity: number
}

export interface ParsedGatewayEvent {
  gateway: string
  order_id: string
  pixel_id?: string    // set by webhook handler from SiteConfig

  value: number
  currency: string

  customer: ParsedCustomer
  items: ParsedItem[]

  // Tracking signals extracted from payload
  nx_user?: string
  fbclid?: string
  fbc?: string
  fbp?: string
  gclid?: string
  gbraid?: string
  wbraid?: string
  ttclid?: string
  ttp?: string
  msclkid?: string
  twclid?: string
  ga_client_id?: string
  cart_token?: string

  // UTMs
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_content?: string
  utm_term?: string
  utm_id?: string
  utm_platform?: string
  utm_network?: string
  ad_id?: string
  adset_id?: string
  campaign_id?: string
  placement?: string
  creative_format?: string
  conversion_type?: string

  // Metadata
  event_id: string       // deterministic: purchase_{orderId}
  event_time: number     // unix timestamp (seconds)
  raw?: unknown          // original payload for debug
}

export interface GatewayParser {
  parse(body: unknown): ParsedGatewayEvent | null
  validateHmac?(payload: string, signature: string, secret: string): Promise<boolean>
}

// ── Shared helpers ─────────────────────────────────────────────────────────

export function s(v: unknown): string {
  if (typeof v === 'string') return v
  return v != null ? String(v) : ''
}

export function n(v: unknown): number {
  if (typeof v === 'number') return v
  const parsed = parseFloat(s(v))
  return isNaN(parsed) ? 0 : parsed
}

export function get(obj: unknown, ...keys: string[]): unknown {
  let cur = obj
  for (const k of keys) {
    if (cur == null || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[k]
  }
  return cur
}

export function normalizePhone(phone: unknown, countryCode = '55'): string | undefined {
  const digits = s(phone).replace(/\D/g, '')
  if (!digits) return undefined
  // already has a known country code prefix
  if (digits.length >= 12 && (digits.startsWith('55') || digits.startsWith('1'))) {
    return `+${digits}`
  }
  // BR mobile: 11 digits (DDD + 9-digit), landline: 10 digits
  if (countryCode === '55' && (digits.length === 10 || digits.length === 11)) {
    return `+55${digits}`
  }
  return digits.length >= 7 ? `+${countryCode}${digits}` : undefined
}

export async function hmacSha256Verify(
  payload: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
    )
    const computed = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
    const computedB64 = btoa(String.fromCharCode(...new Uint8Array(computed)))
    // Use constant-time comparison
    if (computedB64.length !== signature.length) return false
    let diff = 0
    for (let i = 0; i < computedB64.length; i++) {
      diff |= computedB64.charCodeAt(i) ^ signature.charCodeAt(i)
    }
    return diff === 0
  } catch {
    return false
  }
}

export function ts(): number {
  return Math.floor(Date.now() / 1000)
}
