import type { } from './types'

const NX_USER_KEY = 'nx_user'
const NX_LID_KEY = 'nx_lid'
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60
const NX_USER_REGEX = /^nxu_[a-z0-9]{13}$/i
const CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789'

function generateNxUser(): string {
  let result = 'nxu_'
  for (let i = 0; i < 13; i++) {
    result += CHARS.charAt(Math.floor(Math.random() * CHARS.length))
  }
  return result
}

export function isNxUser(value: string): boolean {
  return NX_USER_REGEX.test(value)
}

function readCookieValue(name: string): string | undefined {
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
    // Safari ITP / private mode — silently degrade to cookie-only
  }
}

function setNxCookie(name: string, value: string): void {
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${name}=${encodeURIComponent(value)}; max-age=${COOKIE_MAX_AGE}; path=/${secure}; SameSite=Lax`
}

function setNxLid(value: string): void {
  const parts = window.location.hostname.split('.')
  const baseDomain = parts.length >= 2 ? '.' + parts.slice(-2).join('.') : window.location.hostname
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${NX_LID_KEY}=${encodeURIComponent(value)}; max-age=${COOKIE_MAX_AGE}; path=/; domain=${baseDomain}${secure}; SameSite=Lax`
}

function readFromUrl(param: string): string | undefined {
  const val = new URLSearchParams(window.location.search).get(param)
  return val || undefined
}

function persist(value: string): void {
  setNxCookie(NX_USER_KEY, value)
  setNxLid(value)
  writeLocalStorage(NX_USER_KEY, value)
}

export function getOrCreateNxUser(serverValue?: string): string {
  // Priority 1: cookie nx_user
  const cookieUser = readCookieValue(NX_USER_KEY)
  if (cookieUser && isNxUser(cookieUser)) return cookieUser

  // Priority 2: cookie nx_lid (cross-subdomain)
  const lidCookie = readCookieValue(NX_LID_KEY)
  if (lidCookie && isNxUser(lidCookie)) { persist(lidCookie); return lidCookie }

  // Priority 3: localStorage nx_user
  const lsUser = readLocalStorage(NX_USER_KEY)
  if (lsUser && isNxUser(lsUser)) { persist(lsUser); return lsUser }

  // Priority 4: localStorage nx_lid
  const lsLid = readLocalStorage(NX_LID_KEY)
  if (lsLid && isNxUser(lsLid)) { persist(lsLid); return lsLid }

  // Priority 5: URL param src or sck (cross-domain signal transfer)
  const urlUser = readFromUrl('src') ?? readFromUrl('sck')
  if (urlUser && isNxUser(urlUser)) { persist(urlUser); return urlUser }

  // Priority 6: server-injected value (from __NX_USER__ placeholder)
  if (serverValue && isNxUser(serverValue)) { persist(serverValue); return serverValue }

  // Priority 7: generate new
  const newUser = generateNxUser()
  persist(newUser)
  return newUser
}
