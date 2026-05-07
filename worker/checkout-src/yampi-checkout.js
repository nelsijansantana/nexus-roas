/* global __NX_COLLECT__, __META_PIXEL_IDS__, __TIKTOK_PIXEL__, __GA4_ID__, __META_TEST__, __TIKTOK_TEST__ */

// ── Helpers ───────────────────────────────────────────────────────────────────

function getCookie(name) {
  try {
    var parts = ('; ' + document.cookie).split('; ' + name + '=');
    if (parts.length === 2) return decodeURIComponent(parts.pop().split(';').shift() || '');
  } catch (_) {}
  return '';
}

function uuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// ── Identity ──────────────────────────────────────────────────────────────────
var nxUser = (function () {
  var c = getCookie('nx_user') || getCookie('nx_lid') || '';
  if (c) return c;
  try { return localStorage.getItem('nx_user') || localStorage.getItem('nx_lid') || ''; } catch (_) {}
  return '';
}());
var cartToken = getCookie('cart_token') || getCookie('_cart_token') || '';

// ── UTMs from URL ─────────────────────────────────────────────────────────────
var params  = new URLSearchParams(window.location.search);
var utmData = {};
['utm_source','utm_medium','utm_campaign','utm_content','utm_term',
 'utm_id','utm_platform','utm_network','src','sck','xcod',
 'ad_id','adset_id','campaign_id','placement','creative_format','conversion_type'
].forEach(function (k) { var v = params.get(k); if (v) utmData[k] = v; });

if (!nxUser && (utmData['src'] || utmData['sck'])) nxUser = utmData['src'] || utmData['sck'];

function getOrPersistClickId(paramName, cookieName) {
  var fromUrl = params.get(paramName) || '';
  if (fromUrl) {
    try { document.cookie = cookieName + '=' + encodeURIComponent(fromUrl) + '; Path=/; SameSite=Lax; Max-Age=2592000'; } catch (_) {}
    return fromUrl;
  }
  return getCookie(cookieName) || '';
}

var clickIds = {
  fbclid:  getOrPersistClickId('fbclid',  '_nx_fbclid'),
  gclid:   getOrPersistClickId('gclid',   '_nx_gclid'),
  gbraid:  getOrPersistClickId('gbraid',  '_nx_gbraid'),
  wbraid:  getOrPersistClickId('wbraid',  '_nx_wbraid'),
  ttclid:  getOrPersistClickId('ttclid',  '_nx_ttclid'),
  msclkid: getOrPersistClickId('msclkid', '_nx_msclkid'),
  twclid:  getOrPersistClickId('twclid',  '_nx_twclid'),
};

// ── Browser data ──────────────────────────────────────────────────────────────
function getBrowserData() {
  var ga = getCookie('_ga'); var gaClientId;
  if (ga) { var p = ga.split('.'); if (p.length >= 4) gaClientId = p[2] + '.' + p[3]; }
  var d = {
    cart_token:   cartToken   || undefined,
    fbp:          getCookie('_fbp') || getCookie('fbp') || undefined,
    fbc:          getCookie('_fbc') || undefined,
    fbclid:       clickIds.fbclid   || undefined,
    gclid:        clickIds.gclid    || undefined,
    gbraid:       clickIds.gbraid   || undefined,
    wbraid:       clickIds.wbraid   || undefined,
    ttclid:       clickIds.ttclid   || undefined,
    ttp:          getCookie('_ttp') || undefined,
    msclkid:      clickIds.msclkid  || undefined,
    twclid:       clickIds.twclid   || undefined,
    ga_client_id: gaClientId        || undefined,
    ga_timestamp: String(Math.floor(Date.now() / 1000)),
  };
  Object.keys(d).forEach(function (k) { if (!d[k]) delete d[k]; });
  return d;
}

// ── Extract ecommerce data from a Yampi DataLayer entry ───────────────────────
// Yampi stores items in eventModel.items with shopify_variant_id/shopify_product_id.
// Value is in eventModel.value or eventModel.prices.total.
// Customer is in eventModel.customer { email, phone_number, first_name, last_name }.
function extractYampiData(entry) {
  var src      = entry.eventModel || entry.ecommerce || {};
  var items    = src.items || entry.items || [];
  var value    = parseFloat(src.value || (src.prices && src.prices.total) || entry.value || 0) || 0;
  var currency = 'BRL';
  var numItems = 0;
  var contentIds = [], contents = [], ga4Items = [];

  items.forEach(function (it) {
    var id    = String(it.shopify_variant_id || it.shopify_product_id || it.id || '');
    var qty   = parseInt(it.quantity, 10) || 1;
    var price = parseFloat(it.price) || 0;
    numItems += qty;
    if (id) {
      contentIds.push(id);
      contents.push({ id: id, quantity: qty, item_price: price });
      ga4Items.push({ item_id: id, item_name: it.name || it.title || '', price: price, quantity: qty });
    }
  });

  var cust = src.customer || entry.customer || {};
  var userData = (cust.email || cust.phone_number) ? {
    email:      cust.email        || undefined,
    phone:      cust.phone_number || undefined,
    first_name: cust.first_name   || undefined,
    last_name:  cust.last_name    || undefined,
  } : undefined;
  if (userData) Object.keys(userData).forEach(function (k) { if (!userData[k]) delete userData[k]; });

  return { value: value, currency: currency, numItems: numItems,
           contentIds: contentIds, contents: contents, ga4Items: ga4Items,
           userData: userData };
}

// ── Pixel initialisation ──────────────────────────────────────────────────────

if (__META_PIXEL_IDS__.length) {
  !function(f,b,e,v,n,t,s){n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};
  if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
  t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}
  (window,document,'script','https://connect.facebook.net/en_US/fbevents.js');

  __META_PIXEL_IDS__.forEach(function (pid) {
    window.fbq('set', 'autoConfig', false, pid);
    window.fbq('init', pid, nxUser ? { external_id: nxUser } : {});
  });
  var pvOpts = {};
  if (__META_TEST__) pvOpts.testEventCode = __META_TEST__;
  window.fbq('track', 'PageView', {}, pvOpts);
}

if (__TIKTOK_PIXEL__) {
  !function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];
  ttq.methods=['page','track','identify','instances','debug','on','off','once','ready','alias','group','enableCookie','disableCookie'];
  ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};
  ttq.methods.forEach(function(m){ttq.setAndDefer(ttq,m)});
  ttq.load=function(e,n){var s='https://analytics.tiktok.com/i18n/pixel/events.js';
  ttq._i=ttq._i||{};ttq._i[e]=[];ttq._i[e]._u=s;ttq._t=ttq._t||{};ttq._t[e]=+new Date();
  ttq._o=ttq._o||{};ttq._o[e]=n||{};var el=d.createElement('script');el.type='text/javascript';
  el.async=!0;el.src=s+'?sdkid='+e+'&lib='+t;var sc=d.getElementsByTagName('script')[0];
  sc.parentNode.insertBefore(el,sc)};}(window,document,'ttq');

  if (nxUser) window.ttq.identify({ external_id: nxUser });
  var ttOpts = {};
  if (__TIKTOK_TEST__) ttOpts.test_event_code = __TIKTOK_TEST__;
  window.ttq.load(__TIKTOK_PIXEL__, ttOpts);
  window.ttq.page({}, { event_id: uuid() });
}

if (__GA4_ID__) {
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', __GA4_ID__, { send_page_view: true, user_id: nxUser || undefined });
  var gs = document.createElement('script'); gs.async = true;
  gs.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(__GA4_ID__);
  document.head.appendChild(gs);
}

// ── Fire: CAPI + browser pixels with shared event_id ─────────────────────────
function fire(nexusEvent, ecomm, userData) {
  var eid = uuid();
  ecomm = ecomm || {};

  var customData;
  if (ecomm.value || (ecomm.contentIds && ecomm.contentIds.length)) {
    customData = {
      value:        ecomm.value    || undefined,
      currency:     ecomm.currency || 'BRL',
      content_ids:  ecomm.contentIds && ecomm.contentIds.length ? ecomm.contentIds : undefined,
      contents:     ecomm.contents   && ecomm.contents.length   ? ecomm.contents   : undefined,
      content_type: 'product',
      num_items:    ecomm.numItems   || undefined,
    };
    Object.keys(customData).forEach(function (k) { if (customData[k] === undefined) delete customData[k]; });
  }

  var payload = {
    event:              nexusEvent,
    event_id:           eid,
    nx_user:            nxUser,
    page_url:           window.location.href.split('?')[0],
    browser_data:       getBrowserData(),
    utm_data:           Object.keys(utmData).length ? utmData : undefined,
    custom_data:        customData  || undefined,
    user_data:          userData    || undefined,
    test_event_code:        __META_TEST__   || undefined,
    tiktok_test_event_code: __TIKTOK_TEST__ || undefined,
  };
  Object.keys(payload).forEach(function (k) { if (payload[k] === undefined) delete payload[k]; });

  fetch(__NX_COLLECT__, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    keepalive: true, body: JSON.stringify(payload),
  }).catch(function () {});

  var META_MAP = { InitiateCheckout: 'InitiateCheckout', AddShippingInfo: 'AddShippingInfo',
                   AddPaymentInfo: 'AddPaymentInfo', Lead: 'Lead' };
  var metaName = META_MAP[nexusEvent];
  if (metaName && __META_PIXEL_IDS__.length && typeof window.fbq !== 'undefined') {
    var fbData = {};
    if (ecomm.value)    fbData.value    = ecomm.value;
    if (ecomm.currency) fbData.currency = ecomm.currency;
    if (ecomm.contentIds && ecomm.contentIds.length) {
      fbData.content_ids  = ecomm.contentIds;
      fbData.contents     = ecomm.contents;
      fbData.content_type = 'product';
      fbData.num_items    = ecomm.numItems;
    }
    if (userData && userData.email) fbData.em = userData.email;
    if (userData && userData.phone) fbData.ph = userData.phone;
    var fbOpts = { eventID: eid };
    if (__META_TEST__) fbOpts.testEventCode = __META_TEST__;
    window.fbq('track', metaName, fbData, fbOpts);
  }

  var TT_MAP = { InitiateCheckout: 'InitiateCheckout', AddPaymentInfo: 'AddPaymentInfo', Lead: 'SubmitForm' };
  var ttName = TT_MAP[nexusEvent];
  if (ttName && __TIKTOK_PIXEL__ && typeof window.ttq !== 'undefined') {
    var ttData = {};
    if (ecomm.value)    ttData.value    = ecomm.value;
    if (ecomm.currency) ttData.currency = ecomm.currency;
    if (ecomm.contents && ecomm.contents.length) {
      ttData.contents = ecomm.contents.map(function (c) {
        return { content_id: c.id, quantity: c.quantity, price: c.item_price };
      });
    }
    if (userData && userData.email) ttData.email        = userData.email;
    if (userData && userData.phone) ttData.phone_number = userData.phone;
    window.ttq.track(ttName, ttData, { event_id: eid });
  }

  var GA4_MAP = { InitiateCheckout: 'begin_checkout', AddShippingInfo: 'add_shipping_info',
                  AddPaymentInfo: 'add_payment_info', Lead: 'generate_lead' };
  var ga4Name = GA4_MAP[nexusEvent];
  if (ga4Name && __GA4_ID__ && typeof window.gtag !== 'undefined') {
    var ga4Params = {};
    if (ecomm.value)    ga4Params.value    = ecomm.value;
    if (ecomm.currency) ga4Params.currency = ecomm.currency;
    if (ecomm.ga4Items && ecomm.ga4Items.length) ga4Params.items = ecomm.ga4Items;
    window.gtag('event', ga4Name, ga4Params);
  }
}

// ── DataLayer observer ────────────────────────────────────────────────────────
// Yampi event name mapping:
//   begin_checkout    → InitiateCheckout
//   add_shipping_info → AddShippingInfo
//   add_payment_info  → AddPaymentInfo
var firedEvents = new (typeof WeakSet !== 'undefined' ? WeakSet : function () {
  var items = [];
  this.has = function (o) { return items.indexOf(o) >= 0; };
  this.add = function (o) { if (!this.has(o)) items.push(o); };
})();
var firedNames = {};

function processEntry(entry) {
  if (!entry || typeof entry !== 'object') return;
  if (firedEvents.has(entry)) return;
  var ev = (entry.event || '');
  if (!ev) return;

  var nexusEvent = null;
  if (ev === 'begin_checkout')         nexusEvent = 'InitiateCheckout';
  else if (ev === 'add_shipping_info') nexusEvent = 'AddShippingInfo';
  else if (ev === 'add_payment_info')  nexusEvent = 'AddPaymentInfo';

  if (!nexusEvent || firedNames[nexusEvent]) return;
  firedEvents.add(entry);
  firedNames[nexusEvent] = true;

  var data = extractYampiData(entry);
  fire(nexusEvent, data, data.userData);
}

window.dataLayer = window.dataLayer || [];
window.dataLayer.forEach(function (e) { try { processEntry(e); } catch (_) {} });

var origPush = window.dataLayer.push.bind(window.dataLayer);
window.dataLayer.push = function () {
  var result = origPush.apply(this, arguments);
  for (var i = 0; i < arguments.length; i++) {
    try { processEntry(arguments[i]); } catch (_) {}
  }
  return result;
};

// Fallback: fire InitiateCheckout após 2s se begin_checkout não apareceu
setTimeout(function () {
  if (!firedNames['InitiateCheckout']) fire('InitiateCheckout');
}, 2000);

// ── Lead capture ─────────────────────────────────────────────────────────────
var leadFired = false;
function captureLead() {
  if (leadFired) return;
  var emailEl = document.querySelector('input[type="email"], input[name*="email"]');
  var phoneEl = document.querySelector('input[type="tel"], input[name*="phone"], input[name*="cellphone"]');
  var email = emailEl && emailEl.value && emailEl.value.indexOf('@') > 0 ? emailEl.value : null;
  var phone = phoneEl && phoneEl.value && phoneEl.value.length > 8 ? phoneEl.value : null;
  if (email || phone) {
    leadFired = true;
    fire('Lead', {}, { email: email || undefined, phone: phone || undefined });
  }
}

document.addEventListener('focusout', function (e) {
  var t = e.target;
  if (t && (t.type === 'email' || t.type === 'tel' || t.name === 'email' || t.name === 'phone')) {
    captureLead();
  }
}, true);

var leadTimer = setInterval(function () {
  if (leadFired) { clearInterval(leadTimer); return; }
  captureLead();
}, 5000);
