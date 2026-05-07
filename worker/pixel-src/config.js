/**
 * config.js — Globals injected at serve time by serve-pixel.ts.
 *
 * serve-pixel.ts replaces the banner placeholders (/*__CONFIG__*\/ and
 * /*__NX_USER__*\/) with:
 *   var __CONFIG__  = { ... safe client config ... };
 *   var __NX_USER__ = "uuid";
 *
 * Those vars live in the outer scope (before the IIFE), so they are
 * accessible anywhere inside the bundle.
 */

/* global __CONFIG__, __NX_USER__ */

export const CFG = (typeof __CONFIG__ !== 'undefined') ? __CONFIG__ : {};

// nx_user persistence: localStorage is the primary store so the ID survives
// across page views. The server injects __NX_USER__ from the HttpOnly cookie
// (set cross-origin with SameSite=None), which always reflects the most recent
// identity issued by serve-pixel.ts — including the storefront session when the
// Shopify Customer Events sandbox loads pixel.js cross-origin.
//
// Problem: the checkout sandbox has its own isolated localStorage that may hold
// a stale nx_user from a previous checkout session, causing a different identity
// than the storefront. Fix: prefer whichever identity has the larger timestamp
// prefix (i.e. was generated more recently).
const _LS_KEY       = 'nx_user';
const _serverNxUser = (typeof __NX_USER__ !== 'undefined') ? __NX_USER__ : '';
let   _storedNxUser = '';
try { _storedNxUser = localStorage.getItem(_LS_KEY) || ''; } catch (_) {}

// Extract the numeric timestamp prefix from generateId() format: "{ms}-{uuid}".
// Plain crypto.randomUUID() values have no prefix → timestamp = 0 → never win.
function _nxTs(id) {
  const ts = parseInt((id || '').split('-')[0], 10);
  return isNaN(ts) ? 0 : ts;
}

// Use server value when it is strictly newer than what localStorage has stored.
// This overwrites a stale checkout-sandbox identity with the storefront session.
const _useServer = !!_serverNxUser && _nxTs(_serverNxUser) > _nxTs(_storedNxUser);
export const NX_USER = _useServer ? _serverNxUser : (_storedNxUser || _serverNxUser);

// Keep localStorage in sync with whichever identity won.
try {
  if (_useServer || !_storedNxUser) localStorage.setItem(_LS_KEY, NX_USER);
} catch (_) {}

export const COLLECT_URL             = CFG.collect_url || '/collect/event';
export const META_TEST_EVENT_CODE    = CFG.meta_test_event_code   || '';
export const TIKTOK_TEST_EVENT_CODE  = CFG.tiktok_test_event_code || '';
export const DEBUG                   = CFG.debug === true;
