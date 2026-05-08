import type { SignalMap } from './types'

const CLICK_ID_PARAMS = ['fbclid', 'gclid', 'gbraid', 'wbraid', 'ttclid', 'msclkid', 'twclid'] as const

const UTM_PARAMS = [
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'utm_id', 'utm_platform', 'utm_network', 'placement', 'creative_format',
  'ad_id', 'adset_id', 'campaign_id', 'conversion_type',
  'xcod', 'src', 'sck', 'cid',
] as const

const CLICK_COOKIE_MAX_AGE = 30 * 24 * 60 * 60
const NX_UTMS_KEY = 'nx_utms'

export const CHECKOUT_DOMAINS = [
  'cartpanda.com', 'hotmart.com', 'ticto.com.br', 'ticto.io',
  'kiwify.com.br', 'kiwify.com', 'kirvano.com', 'greenn.com.br',
  'pay.', 'checkout.', 'yampi.com.br', 'pagtrust.com',
] as const

export function readCookie(name: string): string | undefined {
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : undefined
}

function readLocalStorage(key: string): string | undefined {
  try {
    return localStorage.getItem(key) ?? undefined
  } catch {
    return undefined
  }
}

function writeLocalStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Safari ITP — silently degrade
  }
}

function setClickCookie(name: string, value: string): void {
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `_nx_${name}=${encodeURIComponent(value)}; max-age=${CLICK_COOKIE_MAX_AGE}; path=/${secure}; SameSite=Lax`
}

export function buildFbc(fbclid: string): string {
  return `fb.1.${Date.now()}.${fbclid}`
}

export function extractGa4ClientId(gaCookie: string): string | undefined {
  const parts = gaCookie.split('.')
  if (parts.length >= 4) return `${parts[2]}.${parts[3]}`
  return undefined
}

function persistUtms(params: URLSearchParams): void {
  const existing: Record<string, string> = {}
  const raw = readLocalStorage(NX_UTMS_KEY)
  if (raw) {
    try { Object.assign(existing, JSON.parse(raw)) } catch { /* ignore */ }
  }

  let updated = false
  for (const key of UTM_PARAMS) {
    const val = params.get(key)
    if (val) { existing[key] = val; updated = true }
  }
  if (updated) writeLocalStorage(NX_UTMS_KEY, JSON.stringify(existing))
}

export function collectUtms(): Record<string, string> {
  const raw = readLocalStorage(NX_UTMS_KEY)
  if (!raw) return {}
  try { return JSON.parse(raw) as Record<string, string> } catch { return {} }
}

export function collectSignals(): SignalMap {
  const params = new URLSearchParams(window.location.search)
  const signals: SignalMap = {}

  // Capture click IDs from URL and persist as cookies
  for (const param of CLICK_ID_PARAMS) {
    const val = params.get(param) || readCookie(`_nx_${param}`)
    if (val) {
      signals[param] = val
      setClickCookie(param, val)
    }
  }

  // Platform cookies
  const fbp = readCookie('_fbp')
  if (fbp) signals.fbp = fbp

  // Build or read _fbc
  const fbcCookie = readCookie('_fbc')
  if (fbcCookie) {
    signals.fbc = fbcCookie
  } else if (signals.fbclid) {
    signals.fbc = buildFbc(signals.fbclid)
  }

  const ttp = readCookie('_ttp')
  if (ttp) signals.ttp = ttp

  // GA4 client ID from _ga cookie
  const gaCookie = readCookie('_ga')
  if (gaCookie) {
    const clientId = extractGa4ClientId(gaCookie)
    if (clientId) signals.ga_client_id = clientId
  }

  // Persist UTMs to localStorage
  persistUtms(params)

  return signals
}
