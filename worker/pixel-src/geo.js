/**
 * geo.js — Resolução de geolocalização via IP (Advanced Matching).
 * Prefers CF headers injected by serve-pixel.ts (zero latency).
 * Falls back to HTTP endpoints only when CF data is absent (local dev, etc.).
 */
import { CFG }     from './config.js';
import { NxUtils } from './utils.js';

const GEO_LS_KEY     = 'nx_geo_v1';
const GEO_COOKIE     = 'nx_geo';
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60;
const LS_TTL_MS      = 30 * 24 * 60 * 60 * 1000;

const ENDPOINTS = [
  { url: 'https://ipapi.co/json/',              type: 'json' },
  { url: 'https://ipinfo.io/json',              type: 'json' },
  { url: 'https://ipwhois.app/json/',           type: 'json' },
  { url: 'https://www.cloudflare.com/cdn-cgi/trace', type: 'text' },
];

function setCookie(name, value) {
  if (!value) return;
  document.cookie =
    `${name}=${encodeURIComponent(value)}; max-age=${COOKIE_MAX_AGE}; path=/; SameSite=Lax; Secure`;
}

function sanitize(v) {
  if (!v || typeof v !== 'string') return null;
  return v.toLowerCase().trim();
}

function parseCloudflare(text) {
  const out = {};
  text.split('\n').forEach(line => {
    const p = line.split('=');
    if (p.length === 2) out[p[0]] = p[1];
  });
  return { ip: out.ip || null, country: out.loc ? out.loc.toLowerCase() : null };
}

function fetchEndpoint(ep) {
  return Promise.race([
    fetch(ep.url).then(r => {
      if (!r.ok) throw new Error('bad');
      return ep.type === 'text' ? r.text() : r.json();
    }),
    new Promise((_, rej) => setTimeout(() => rej('timeout'), 2500)),
  ]);
}

export const NxGeo = {
  _data:     { ip: null, city: null, region: null, country: null, postal: null, currency: null },
  _resolved: false,

  _saveToCache() {
    try {
      localStorage.setItem(GEO_LS_KEY, JSON.stringify({ ts: Date.now(), d: NxGeo._data }));
    } catch (_) {}
    setCookie('nx_ip',  NxGeo._data.ip);
    setCookie('nx_ct',  NxGeo._data.city);
    setCookie('nx_st',  NxGeo._data.region);
    setCookie('nx_co',  NxGeo._data.country);
    setCookie('nx_zp',  NxGeo._data.postal);
    setCookie('nx_cur', NxGeo._data.currency);
    setCookie(GEO_COOKIE, JSON.stringify(NxGeo._data));
  },

  _loadFromLS() {
    try {
      const raw    = localStorage.getItem(GEO_LS_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed?.d || !parsed?.ts) return null;
      if (Date.now() - parsed.ts > LS_TTL_MS) return null;
      return parsed.d;
    } catch (_) { return null; }
  },

  _loadFromCookies() {
    const combined = NxUtils.getCookie(GEO_COOKIE);
    if (combined) { try { return JSON.parse(combined); } catch (_) {} }
    const ip = NxUtils.getCookie('nx_ip');
    if (!ip) return null;
    return {
      ip,
      city:     NxUtils.getCookie('nx_ct')  || null,
      region:   NxUtils.getCookie('nx_st')  || null,
      country:  NxUtils.getCookie('nx_co')  || null,
      postal:   NxUtils.getCookie('nx_zp')  || null,
      currency: NxUtils.getCookie('nx_cur') || null,
    };
  },

  _resolve(idx) {
    if (idx >= ENDPOINTS.length) {
      NxGeo._resolved = true;
      if (NxGeo._data.ip) NxGeo._saveToCache();
      return;
    }
    fetchEndpoint(ENDPOINTS[idx])
      .then(data => {
        if (typeof data === 'string') {
          const cf = parseCloudflare(data);
          if (!NxGeo._data.ip && cf.ip)       NxGeo._data.ip      = cf.ip;
          if (!NxGeo._data.country && cf.country) NxGeo._data.country = cf.country;
        } else {
          if (!NxGeo._data.ip      && data.ip)                    NxGeo._data.ip       = data.ip;
          if (!NxGeo._data.city    && data.city)                  NxGeo._data.city     = sanitize(data.city);
          if (!NxGeo._data.region  && (data.region || data.region_name))
            NxGeo._data.region = sanitize(data.region || data.region_name);
          if (!NxGeo._data.country && (data.country_code || data.country))
            NxGeo._data.country = sanitize(data.country_code || data.country);
          if (!NxGeo._data.postal  && (data.postal || data.zip)) NxGeo._data.postal   = sanitize(data.postal || data.zip);
          if (!NxGeo._data.currency && data.currency)            NxGeo._data.currency = sanitize(data.currency);
        }
        if (NxGeo._data.ip && NxGeo._data.country) {
          NxGeo._resolved = true;
          NxGeo._saveToCache();
        } else {
          NxGeo._resolve(idx + 1);
        }
      })
      .catch(() => NxGeo._resolve(idx + 1));
  },

  init() {
    // CF headers from serve-pixel.ts — most accurate, zero HTTP cost
    const cfGeo = CFG?.geo;
    if (cfGeo?.country) {
      NxGeo._data = {
        ip:       cfGeo.ip                                      || null,
        city:     cfGeo.city    ? cfGeo.city.toLowerCase()    : null,
        region:   cfGeo.region  ? cfGeo.region.toLowerCase()  : null,
        country:  cfGeo.country ? cfGeo.country.toLowerCase() : null,
        postal:   cfGeo.postal                                  || null,
        currency: null,
      };
      NxGeo._resolved = true;
      NxGeo._saveToCache();
      return;
    }
    // Cache fallback (avoids HTTP on repeat visits)
    let cached = NxGeo._loadFromLS();
    if (cached?.ip) { NxGeo._data = cached; NxGeo._resolved = true; return; }
    cached = NxGeo._loadFromCookies();
    if (cached?.ip) { NxGeo._data = cached; NxGeo._resolved = true; return; }
    // Last resort: sequential HTTP probing
    NxGeo._resolve(0);
  },
};
