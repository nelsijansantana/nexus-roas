import { Env } from '../types';
import { getConfig, detectSiteId } from '../shared/config';

/**
 * GET /tracking/shopify-checkout.js?pid=<project-id>
 *
 * Serves the Shopify Customer Events Web Pixel script.
 * Install by pasting the generated JS code in Shopify Admin → Settings → Customer Events → Add custom pixel.
 */
export async function handleShopifyCheckoutPixel(request: Request, env: Env): Promise<Response> {
  const url    = new URL(request.url);
  const origin = url.origin;
  const pid    = url.searchParams.get('pid');
  const collectUrl = pid
    ? `${origin}/collect/event?pid=${encodeURIComponent(pid)}`
    : `${origin}/collect/event`;

  let metaPixelIds:  string[] = [];
  let tiktokPixelId  = '';
  let ga4MeasurementId = '';
  let metaTestCode   = '';
  let tiktokTestCode = '';

  try {
    const siteId = detectSiteId(request, env);
    const config = await getConfig(siteId, env);
    const meta   = config.platforms?.meta;
    if (meta?.pixel_id) {
      metaPixelIds = [meta.pixel_id, ...(meta.pixel_ids_mirror || [])];
    }
    tiktokPixelId    = config.platforms?.tiktok?.pixel_id      || '';
    ga4MeasurementId = config.platforms?.ga4?.measurement_id   || '';
    metaTestCode     = (meta as any)?.test_event_code          || '';
    tiktokTestCode   = (config.platforms?.tiktok as any)?.test_event_code || '';
  } catch (_) {}

  const script = buildScript(collectUrl, metaPixelIds, tiktokPixelId, ga4MeasurementId, metaTestCode, tiktokTestCode);

  return new Response(script, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
      'Access-Control-Allow-Origin': '*',
    }
  });
}

function buildScript(
  collectUrl:      string,
  metaPixelIds:    string[],
  tiktokPixelId:   string,
  ga4MeasurementId: string,
  metaTestCode:    string,
  tiktokTestCode:  string,
): string {
  return `var __NX_COLLECT__    = ${JSON.stringify(collectUrl)};
var __NX_META_IDS__     = ${JSON.stringify(metaPixelIds)};
var __NX_TT_PIXEL__     = ${JSON.stringify(tiktokPixelId)};
var __NX_GA4_MID__      = ${JSON.stringify(ga4MeasurementId)};
var __NX_META_TEST__    = ${JSON.stringify(metaTestCode)};
var __NX_TIKTOK_TEST__  = ${JSON.stringify(tiktokTestCode)};
var __NX_FIRED__        = {};

console.log('>>> NEXUS CHECKOUT PIXEL LOADED <<<');

function nxUuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function nxGetCookie(name) {
  try {
    var parts = ('; ' + document.cookie).split('; ' + name + '=');
    if (parts.length === 2) return decodeURIComponent(parts.pop().split(';').shift() || '');
  } catch (_) {}
  return null;
}

function nxGetGaClientId() {
  try {
    var ga = nxGetCookie('_ga');
    if (!ga) return undefined;
    var parts = ga.split('.');
    if (parts.length >= 4) return parts[2] + '.' + parts[3];
  } catch (_) {}
  return undefined;
}

function nxGetGaSession() {
  try {
    var suffix = __NX_GA4_MID__ ? __NX_GA4_MID__.replace('G-', '') : '';
    if (!suffix) return {};
    var val = nxGetCookie('_ga_' + suffix);
    if (!val) return {};
    var parts = val.split('.');
    if (parts.length >= 4) return { session_id: parts[2], session_count: parts[3] };
  } catch (_) {}
  return {};
}

function nxAttrs(checkout) {
  return (checkout && checkout.attributes) ? checkout.attributes : {};
}

function nxGetNxUser(checkout) {
  var a = nxAttrs(checkout);
  return a.nx_user || a._nx_user || a.nx_lead_id || nxGetCookie('nx_user') || nxGetCookie('nx_lid') || '';
}

function nxGetUtms(checkout) {
  var a = nxAttrs(checkout);
  var u = {};
  var UTM_KEYS = ['utm_source','utm_medium','utm_campaign','utm_content','utm_term',
                  'utm_id','utm_platform','utm_network','ad_id','adset_id','campaign_id',
                  'placement','creative_format','src','sck','xcod'];
  UTM_KEYS.forEach(function(k) { if (a[k]) u[k] = a[k]; });
  return Object.keys(u).length ? u : undefined;
}

function nxGetClickIds(checkout) {
  var a   = nxAttrs(checkout);
  var ids = {};

  var gclid  = a.gclid  || a._gclid  || nxGetCookie('_gcl_aw') || '';
  var gbraid = a.gbraid || a._gbraid || '';
  var wbraid = a.wbraid || a._wbraid || '';
  if (gclid)  ids.gclid  = gclid;
  if (gbraid) ids.gbraid = gbraid;
  if (wbraid) ids.wbraid = wbraid;

  var fbclid = a.fbclid || a._fbclid || '';
  var fbc    = a._fbc   || nxGetCookie('_fbc') || '';
  var fbp    = a._fbp   || nxGetCookie('_fbp') || '';
  if (fbclid) ids.fbclid = fbclid;
  if (fbc)    ids.fbc    = fbc;
  if (fbp)    ids.fbp    = fbp;

  var ttclid = a.ttclid || a._ttclid || nxGetCookie('_tt_lacv') || '';
  var ttp    = a._ttp   || nxGetCookie('_ttp') || '';
  if (ttclid) ids.ttclid = ttclid;
  if (ttp)    ids.ttp    = ttp;

  var msclkid = a.msclkid || a._msclkid || '';
  var twclid  = a.twclid  || a._twclid  || '';
  if (msclkid) ids.msclkid = msclkid;
  if (twclid)  ids.twclid  = twclid;

  return Object.keys(ids).length ? ids : undefined;
}

function nxParseGid(gid) {
  if (!gid) return '';
  var s = String(gid);
  var slash = s.lastIndexOf('/');
  return slash >= 0 ? s.slice(slash + 1) : s;
}

function nxExtractItems(lineItems) {
  var contentIds = [], contents = [], ga4Items = [], names = [], numItems = 0;
  if (!lineItems) return { contentIds: contentIds, contents: contents, ga4Items: ga4Items, names: names, numItems: numItems };
  for (var i = 0; i < lineItems.length; i++) {
    var item    = lineItems[i];
    var variant = item.variant    || {};
    var product = variant.product || {};
    var prodId  = nxParseGid(product.id || '');
    var varId   = nxParseGid(variant.id || '');
    var id      = prodId || varId;
    var name    = item.title || product.title || variant.title || '';
    var qty     = parseInt(item.quantity, 10) || 1;
    var price   = (variant.price && variant.price.amount) ? parseFloat(variant.price.amount) : 0;
    if (id) {
      contentIds.push(id);
      contents.push({ id: id, variant_id: varId || undefined, quantity: qty, item_price: price });
      ga4Items.push({ item_id: id, item_name: name, price: price, quantity: qty });
    }
    if (name) names.push(name);
    numItems += qty;
  }
  return { contentIds: contentIds, contents: contents, ga4Items: ga4Items, names: names, numItems: numItems };
}

// ── Browser-side pixel init (wrapped in try-catch — Shopify sandbox may restrict DOM APIs) ──

try {
  if (__NX_META_IDS__.length) {
    !function(f,b,e,v,n,t,s){n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};
    if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}
    (window,document,'script','https://connect.facebook.net/en_US/fbevents.js');

    __NX_META_IDS__.forEach(function(pid) {
      window.fbq('set', 'autoConfig', false, pid);
      window.fbq('init', pid);
    });
    var pvOpts = {};
    if (__NX_META_TEST__) pvOpts.testEventCode = __NX_META_TEST__;
    window.fbq('track', 'PageView', {}, pvOpts);
  }
} catch (_) {}

try {
  if (__NX_TT_PIXEL__) {
    !function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];
    ttq.methods=['page','track','identify','instances','debug','on','off','once','ready','alias','group','enableCookie','disableCookie'];
    ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};
    ttq.methods.forEach(function(m){ttq.setAndDefer(ttq,m)});
    ttq.load=function(e,n){var s='https://analytics.tiktok.com/i18n/pixel/events.js';
    ttq._i=ttq._i||{};ttq._i[e]=[];ttq._i[e]._u=s;ttq._t=ttq._t||{};ttq._t[e]=+new Date();
    ttq._o=ttq._o||{};ttq._o[e]=n||{};var el=d.createElement('script');el.type='text/javascript';
    el.async=!0;el.src=s+'?sdkid='+e+'&lib='+t;var sc=d.getElementsByTagName('script')[0];
    sc.parentNode.insertBefore(el,sc)};}(window,document,'ttq');

    var ttOpts = {};
    if (__NX_TIKTOK_TEST__) ttOpts.test_event_code = __NX_TIKTOK_TEST__;
    window.ttq.load(__NX_TT_PIXEL__, ttOpts);
    window.ttq.page({}, { event_id: nxUuid() });
  }
} catch (_) {}

// ── CAPI + browser pixel fire ─────────────────────────────────────────────────

function nxSend(eventType, eventId, checkout, customer) {
  var token = (checkout && checkout.token) || '';
  var sig   = eventType + ':' + token;
  if (__NX_FIRED__[sig]) return;
  __NX_FIRED__[sig] = true;

  var nxUser    = nxGetNxUser(checkout);
  var items     = nxExtractItems(checkout && checkout.lineItems);
  var total     = checkout && checkout.totalPrice;
  var value     = total ? parseFloat(total.amount || '0') : undefined;
  var currency  = total ? (total.currencyCode || 'BRL') : 'BRL';
  var clickIds  = nxGetClickIds(checkout);

  var addr      = (checkout && (checkout.shippingAddress || checkout.billingAddress)) || {};
  var email     = (customer && customer.email)     || (checkout && checkout.email) || undefined;
  var phone     = (customer && customer.phone)     || addr.phone     || undefined;
  var firstName = (customer && customer.firstName) || addr.firstName || undefined;
  var lastName  = (customer && customer.lastName)  || addr.lastName  || undefined;

  var pageUrl = '';
  try { pageUrl = document.location.href.split('?')[0]; } catch (_) {}

  var gaSession = nxGetGaSession();

  var browserData = {
    fbc:              (clickIds && clickIds.fbc)    || nxGetCookie('_fbc')  || undefined,
    fbp:              (clickIds && clickIds.fbp)    || nxGetCookie('_fbp')  || undefined,
    fbclid:           (clickIds && clickIds.fbclid) || undefined,
    gclid:            (clickIds && clickIds.gclid)  || undefined,
    gbraid:           (clickIds && clickIds.gbraid) || undefined,
    wbraid:           (clickIds && clickIds.wbraid) || undefined,
    ttclid:           (clickIds && clickIds.ttclid) || undefined,
    ttp:              (clickIds && clickIds.ttp)    || nxGetCookie('_ttp')  || undefined,
    msclkid:          (clickIds && clickIds.msclkid)|| undefined,
    twclid:           (clickIds && clickIds.twclid) || undefined,
    ga_client_id:     nxGetGaClientId()             || undefined,
    ga_session_id:    gaSession.session_id          || undefined,
    ga_session_count: gaSession.session_count       || undefined,
    ga_timestamp:     String(Math.floor(Date.now() / 1000)),
    cart_token:       token                         || undefined,
  };

  // CAPI (server-side)
  fetch(__NX_COLLECT__, {
    method:    'POST',
    headers:   { 'Content-Type': 'application/json' },
    keepalive: true,
    body: JSON.stringify({
      event:    eventType,
      event_id: eventId,
      nx_user:  nxUser,
      page_url: pageUrl,
      user_data: {
        email:      email,
        phone:      phone,
        first_name: firstName,
        last_name:  lastName,
        city:    addr.city         || undefined,
        state:   addr.provinceCode || undefined,
        zip:     addr.zip          || undefined,
        country: addr.countryCode  || undefined,
      },
      browser_data: browserData,
      utm_data:     nxGetUtms(checkout),
      custom_data: {
        value:        value,
        currency:     currency,
        content_ids:  items.contentIds.length ? items.contentIds : undefined,
        contents:     items.contents.length   ? items.contents   : undefined,
        content_name: items.names.join(', ')  || undefined,
        content_type: items.contentIds.length ? 'product'        : undefined,
        num_items:    items.numItems           || undefined,
      },
      test_event_code:        __NX_META_TEST__   || undefined,
      tiktok_test_event_code: __NX_TIKTOK_TEST__ || undefined,
    }),
  }).catch(function() {});

  // Meta browser pixel (same event_id for deduplication)
  var META_MAP = { InitiateCheckout: 'InitiateCheckout', AddShippingInfo: 'AddShippingInfo',
                   AddPaymentInfo: 'AddPaymentInfo', Lead: 'Lead', Purchase: 'Purchase' };
  var metaName = META_MAP[eventType];
  if (metaName && __NX_META_IDS__.length && typeof window.fbq !== 'undefined') {
    var fbData = {};
    if (value)    fbData.value    = value;
    if (currency) fbData.currency = currency;
    if (items.contentIds.length) {
      fbData.content_ids  = items.contentIds;
      fbData.contents     = items.contents;
      fbData.content_type = 'product';
      fbData.num_items    = items.numItems;
    }
    if (email) fbData.em = email;
    if (phone) fbData.ph = phone;
    var fbOpts = { eventID: eventId };
    if (__NX_META_TEST__) fbOpts.testEventCode = __NX_META_TEST__;
    window.fbq('track', metaName, fbData, fbOpts);
  }

  // TikTok browser pixel (same event_id for deduplication)
  var TT_MAP = { InitiateCheckout: 'InitiateCheckout', AddPaymentInfo: 'AddPaymentInfo',
                 Lead: 'SubmitForm', Purchase: 'CompletePayment' };
  var ttName = TT_MAP[eventType];
  if (ttName && __NX_TT_PIXEL__ && typeof window.ttq !== 'undefined') {
    var ttData = {};
    if (value)    ttData.value    = value;
    if (currency) ttData.currency = currency;
    if (items.contents.length) {
      ttData.contents = items.contents.map(function(c) {
        return { content_id: c.id, quantity: c.quantity, price: c.item_price };
      });
    }
    if (email) ttData.email        = email;
    if (phone) ttData.phone_number = phone;
    window.ttq.track(ttName, ttData, { event_id: eventId });
  }
}

// ── Shopify Customer Events subscriptions ─────────────────────────────────────

analytics.subscribe('checkout_started', function(event) {
  var checkout = event.data && event.data.checkout;
  var customer = checkout && checkout.buyerIdentity && checkout.buyerIdentity.customer;
  var token    = (checkout && checkout.token) || '';
  var eventId  = token ? ('sh_cart_' + token) : nxUuid();
  nxSend('InitiateCheckout', eventId, checkout, customer);
});

analytics.subscribe('checkout_contact_info_submitted', function(event) {
  var checkout = event.data && event.data.checkout;
  var customer = checkout && checkout.buyerIdentity && checkout.buyerIdentity.customer;
  nxSend('Lead', nxUuid(), checkout, customer);
});

analytics.subscribe('checkout_shipping_info_submitted', function(event) {
  var checkout = event.data && event.data.checkout;
  var customer = checkout && checkout.buyerIdentity && checkout.buyerIdentity.customer;
  nxSend('AddShippingInfo', nxUuid(), checkout, customer);
});

analytics.subscribe('payment_info_submitted', function(event) {
  var checkout = event.data && event.data.checkout;
  var customer = checkout && checkout.buyerIdentity && checkout.buyerIdentity.customer;
  nxSend('AddPaymentInfo', nxUuid(), checkout, customer);
});

analytics.subscribe('checkout_completed', function(event) {
  var checkout = event.data && event.data.checkout;
  var customer = checkout && checkout.buyerIdentity && checkout.buyerIdentity.customer;
  var token    = (checkout && checkout.token) || '';
  var eventId  = token ? ('sh_purchase_' + token) : nxUuid();
  nxSend('Purchase', eventId, checkout, customer);
});
`;
}
