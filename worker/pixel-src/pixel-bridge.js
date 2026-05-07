/**
 * pixel-bridge.js — Inicializa e dispara eventos nos pixels client-side:
 * Meta (fbq), TikTok (ttq) e Google Ads (gtag). Faz queue dos eventos até os SDKs carregarem.
 */
import { CFG, NX_USER, META_TEST_EVENT_CODE } from './config.js';
import { NxUtils }   from './utils.js';
import { NxGeo }     from './geo.js';
import { NxClickIds } from './click-ids.js';

const META_STANDARD_EVENTS = [
  'PageView', 'ViewContent', 'Search', 'AddToCart', 'AddToWishlist',
  'InitiateCheckout', 'AddPaymentInfo', 'Purchase', 'Lead',
  'CompleteRegistration', 'Contact', 'Subscribe',
];

// Purchase is intentionally excluded: browser/datalayer fires for PIX/boleto generated
// (not confirmed). Only approved purchases arrive via webhook → Worker CAPI.
const META_EVENT_MAP = {
  PageView: 'PageView', ViewContent: 'ViewContent', AddToCart: 'AddToCart',
  InitiateCheckout: 'InitiateCheckout', Lead: 'Lead',
  CompleteRegistration: 'CompleteRegistration', Subscribe: 'Subscribe',
  AddToWishlist: 'AddToWishlist', AddPaymentInfo: 'AddPaymentInfo',
  Search: 'Search', RemoveFromCart: 'RemoveFromCart',
  ViewCategory: 'ViewCategory', ViewCart: 'ViewCart',
};

// Purchase excluded: only fires via webhook (approved orders). See META_EVENT_MAP note.
const TIKTOK_EVENT_MAP = {
  PageView: 'Pageview', ViewContent: 'ViewContent', AddToCart: 'AddToCart',
  InitiateCheckout: 'InitiateCheckout', Lead: 'Subscribe',
  CompleteRegistration: 'CompleteRegistration', Subscribe: 'Subscribe',
  AddToWishlist: 'AddToWishlist', AddPaymentInfo: 'AddPaymentInfo',
  Search: 'Search', RemoveFromCart: null,
  ViewCategory: 'ViewContent', ViewCart: 'InitiateCheckout',
};

export const NxPixelBridge = {
  _metaInited:   [],
  _tiktokInited: [],
  _ready:        false,
  _queue:        [],

  init(metaIds, tiktokIds) {
    if (metaIds?.length)                NxPixelBridge._initMeta(metaIds);
    if (tiktokIds?.length)              NxPixelBridge._initTikTok(tiktokIds);
    if (CFG.google_ads_conversion_id)   NxPixelBridge._initGoogleAds(CFG.google_ads_conversion_id);
    NxPixelBridge._ready = true;

    const queue = NxPixelBridge._queue;
    NxPixelBridge._queue = [];
    queue.forEach(e => NxPixelBridge._fireNow(e.type, e.id, e.data));
  },

  fireEvent(eventType, eventId, customData) {
    if (!NxPixelBridge._ready) {
      NxPixelBridge._queue.push({ type: eventType, id: eventId, data: customData });
      return;
    }
    NxPixelBridge._fireNow(eventType, eventId, customData);
  },

  _initMeta(pixelIds) {
    if (typeof window.fbq === 'undefined') {
      (function (f, b, e, v) {
        const n = (f.fbq = function () {
          n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
        });
        if (!f._fbq) f._fbq = n;
        n.push = n; n.loaded = true; n.version = '2.0'; n.queue = [];
        const t = b.createElement(e); t.async = true; t.src = v;
        const s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
      })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    }
    pixelIds.forEach(id => {
      if (NxPixelBridge._metaInited.includes(id)) return;
      NxPixelBridge._metaInited.push(id);
      window.fbq('set', 'autoConfig', false, id);

      const geo = NxGeo._data || {};
      const adv = {};
      if (geo.city)    adv.ct       = geo.city.replace(/[^a-z]/g, '');
      if (geo.region)  adv.st       = geo.region.replace(/[^a-z0-9]/g, '').substring(0, 2);
      if (geo.postal)  adv.zp       = geo.postal.replace(/[\s-]/g, '');
      if (geo.country) adv.country  = geo.country.replace(/[^a-z]/g, '').substring(0, 2);
      if (NX_USER)     adv.external_id = NX_USER;

      NxUtils.log('fbq init advMatch:', JSON.stringify(adv));
      window.fbq('init', id, adv);
    });
  },

  _initTikTok(pixelIds) {
    if (typeof window.ttq === 'undefined') {
      (function (w, d, t) {
        w.TiktokAnalyticsObject = t;
        const ttq = (w[t] = w[t] || []);
        ttq.methods = ['page','track','identify','instances','debug','on','off','once','ready','alias','group','enableCookie','disableCookie'];
        ttq.setAndDefer = (t2, e) => { t2[e] = function () { t2.push([e].concat([].slice.call(arguments, 0))); }; };
        ttq.methods.forEach(m => ttq.setAndDefer(ttq, m));
        ttq.load = (e, n) => {
          const s = 'https://analytics.tiktok.com/i18n/pixel/events.js';
          ttq._i = ttq._i || {}; ttq._i[e] = []; ttq._i[e]._u = s;
          ttq._t = ttq._t || {}; ttq._t[e] = +new Date();
          ttq._o = ttq._o || {}; ttq._o[e] = n || {};
          const el = d.createElement('script'); el.type = 'text/javascript'; el.async = true;
          el.src = `${s}?sdkid=${e}&lib=${t}`;
          const sc = d.getElementsByTagName('script')[0]; sc.parentNode.insertBefore(el, sc);
        };
      })(window, document, 'ttq');
    }
    pixelIds.forEach(id => {
      if (NxPixelBridge._tiktokInited.includes(id)) return;
      NxPixelBridge._tiktokInited.push(id);
      const adv = {};
      if (NX_USER) adv.external_id = NX_USER;
      if (Object.keys(adv).length) {
        NxUtils.log('ttq identify:', JSON.stringify(adv));
        window.ttq.identify(adv);
      }
      window.ttq.load(id);
    });
  },

  _initGoogleAds(conversionId) {
    // Load gtag.js once
    if (!window._nxGadsLoaded) {
      window._nxGadsLoaded = true;
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () { window.dataLayer.push(arguments); };
      window.gtag('js', new Date());
      window.gtag('config', conversionId);
      const s  = document.createElement('script');
      s.async  = true;
      s.src    = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(conversionId)}`;
      document.head.appendChild(s);
      NxUtils.log('gtag init:', conversionId);
    }
  },

  _fireNow(eventType, eventId, customData) {
    const clickIds = NxClickIds.collect();
    const clientIp = NxGeo._data.ip;
    const fbqName  = META_EVENT_MAP[eventType] || null;

    // ── Google Ads ────────────────────────────────────────────────────────────
    // Fires for any event that has a label configured in google_ads_events.
    // Covers both automatic funnel events (Purchase, Lead, Contact) and custom
    // pixel events configured per project.
    if (CFG.google_ads_conversion_id && CFG.google_ads_events && typeof window.gtag === 'function') {
      const label = CFG.google_ads_events[eventType];
      if (label) {
        const gadsParams = {
          send_to:  `${CFG.google_ads_conversion_id}/${label}`,
          currency: customData?.currency || 'BRL',
        };
        if (customData?.value != null) gadsParams.value = parseFloat(customData.value) || 0;
        if (customData?.order_id)      gadsParams.transaction_id = String(customData.order_id);
        NxUtils.log('gtag conversion:', eventType, gadsParams.send_to);
        window.gtag('event', 'conversion', gadsParams);
      }
    }

    // ── Meta ──────────────────────────────────────────────────────────────────
    if (fbqName && typeof window.fbq !== 'undefined' && NxPixelBridge._metaInited.length) {
      const td = customData ? Object.assign({}, customData) : {};
      if (clickIds.fbc) td.fbc = clickIds.fbc;
      if (clickIds.fbp) td.fbp = clickIds.fbp;
      if (clientIp) td.client_ip_address = clientIp;
      td.client_user_agent = navigator.userAgent;
      const method = META_STANDARD_EVENTS.includes(fbqName) ? 'track' : 'trackCustom';
      const fbqOpts = { eventID: eventId };
      if (META_TEST_EVENT_CODE) fbqOpts.testEventCode = META_TEST_EVENT_CODE;
      window.fbq(method, fbqName, td, fbqOpts);
    }

    // ── TikTok ────────────────────────────────────────────────────────────────
    if (typeof window.ttq !== 'undefined' && NxPixelBridge._tiktokInited.length) {
      const ttName = TIKTOK_EVENT_MAP.hasOwnProperty(eventType)
        ? TIKTOK_EVENT_MAP[eventType]
        : eventType;
      if (ttName === null) {
        // Sem equivalente TikTok — CAPI ainda dispara server-side
      } else if (ttName === 'Pageview' || eventType === 'PageView') {
        window.ttq.page({}, { event_id: eventId });
      } else {
        const td = customData ? Object.assign({}, customData) : {};
        if (clickIds.ttclid) td.ttclid = clickIds.ttclid;
        if (clickIds.ttp)    td.ttp    = clickIds.ttp;
        if (clientIp)        td.client_ip_address = clientIp;
        td.client_user_agent = navigator.userAgent;
        td.content_type = td.content_type || 'product';
        window.ttq.track(ttName, td, { event_id: eventId });
      }
    }
  },
};
