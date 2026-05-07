import { Env } from '../types';
import { logEvent } from '../shared/logger';
import { sha256, normalizePhone } from '../shared/hash';

// Maps both CamelCase (pixel beacon) and snake_case (webhooks) to GA4 event names.
const GA4_EVENT_NAMES: Record<string, string> = {
  PageView:             'page_view',
  ViewContent:          'view_item',
  ViewCategory:         'view_item_list',
  ViewCart:             'view_cart',
  AddToCart:            'add_to_cart',
  RemoveFromCart:       'remove_from_cart',
  AddToWishlist:        'add_to_wishlist',
  InitiateCheckout:     'begin_checkout',
  AddShippingInfo:      'add_shipping_info',
  AddPaymentInfo:       'add_payment_info',
  Purchase:             'purchase',
  Lead:                 'generate_lead',
  CompleteRegistration: 'sign_up',
  Search:               'search',
  Contact:              'contact',
  page_view:            'page_view',
  initiate_checkout:    'begin_checkout',
  purchase:             'purchase',
  lead:                 'generate_lead',
  contact:              'contact',
};

const GA4_SKIP = new Set(['_update', 'RemoveFromCart', 'PageView', 'Purchase']);

export async function sendGA4Event(
  ga4Config: any,
  eventName: string,
  eventId: string,
  body: any,
  clientIp: string,
  userAgent: string,
  env: Env,
  siteId: string
): Promise<void> {
  const apiSecret = ga4Config?.api_secret || env.GA4_API_SECRET;
  if (!ga4Config?.measurement_id || !apiSecret) {
    await logEvent(env.DB, { site_id: siteId, event_name: eventName, event_id: eventId, platform: 'google_analytics_4', channel: 'web', source: 'collect', status_code: 0, error_message: !ga4Config?.measurement_id ? 'missing_measurement_id' : 'missing_api_secret', nx_user: body?.nx_user || '', source_ip: clientIp, user_agent: userAgent });
    return;
  }
  if (GA4_SKIP.has(eventName)) return;

  const ga4EventName = GA4_EVENT_NAMES[eventName];
  if (!ga4EventName) return;

  const gaClientId = body.browser_data?.ga_client_id
    || (body.nx_user ? `nx_${body.nx_user}` : null)
    || crypto.randomUUID(); // never drop an event for missing client_id
  if (!gaClientId) return;

  const params: any = {
    engagement_time_msec: 100,
    page_location: body.page_url      || '',
    page_title:    body.page_title    || '',
    page_referrer: body.page_referrer || '',
    event_id:      eventId,
  };

  if (ga4Config?.debug) params.debug_mode = true;

  if (body.browser_data?.ga_session_id)
    params.session_id = String(body.browser_data.ga_session_id);
  if (body.browser_data?.ga_session_count)
    params.session_number = parseInt(String(body.browser_data.ga_session_count), 10);

  // Official GA4 MP UTM parameter names (campaign_* prefix)
  if (body.utm_data?.utm_source)   params.campaign_source   = body.utm_data.utm_source;
  if (body.utm_data?.utm_medium)   params.campaign_medium   = body.utm_data.utm_medium;
  if (body.utm_data?.utm_campaign) params.campaign_name     = body.utm_data.utm_campaign;
  if (body.utm_data?.utm_content)  params.campaign_content  = body.utm_data.utm_content;
  if (body.utm_data?.utm_term)     params.campaign_term     = body.utm_data.utm_term;

  // Google click IDs — sent to GA4 for better attribution
  if (body.browser_data?.gclid)  params.gclid  = body.browser_data.gclid;
  if (body.browser_data?.gbraid) params.gbraid = body.browser_data.gbraid;
  if (body.browser_data?.wbraid) params.wbraid = body.browser_data.wbraid;

  // Value + items for ecommerce events
  const cd = body.custom_data || {};
  if (cd.value != null) {
    params.value    = parseFloat(cd.value) || 0;
    params.currency = cd.currency || 'BRL';
    const ids      = cd.content_ids || [];
    const contents = cd.contents    || [];
    const names    = (cd.content_name || '').split(', ');
    if (ids.length) {
      params.items = ids.map((id: string, i: number) => {
        const c = contents[i] as any;
        return { item_id: String(id), item_name: names[i] || c?.item_name || '', price: parseFloat(c?.item_price) || (params.value / ids.length), quantity: parseInt(String(c?.quantity ?? 1), 10) || 1 };
      });
    } else if (contents.length) {
      params.items = contents.map((c: any) => ({ item_id: String(c.id || c.content_id || ''), item_name: c.item_name || '', price: parseFloat(c.item_price) || 0, quantity: parseInt(String(c.quantity ?? 1), 10) || 1 }));
    }
  }

  const payload: any = {
    client_id:            gaClientId,
    non_personalized_ads: false,
    // Explicit consent signals for GA4 Enhanced Conversions
    consent: { ad_user_data: 'GRANTED', ad_personalization: 'GRANTED' },
    events: [{ name: ga4EventName, params }]
  };

  if (body.nx_user) payload.user_id = body.nx_user;
  if (clientIp)     payload.ip_override = clientIp;
  if (userAgent)    payload.user_agent  = userAgent;

  // User data for GA4 Enhanced Conversions
  const userData = await buildUserData({
    email:      body.user_data?.email,
    phone:      body.user_data?.phone,
    first_name: body.user_data?.first_name,
    last_name:  body.user_data?.last_name,
    city:       body.user_data?.city,
    state:      body.user_data?.state,
    country:    body.user_data?.country,
    zip:        body.user_data?.zip,
  });
  if (userData) payload.user_data = userData;

  if (body.browser_data?.ga_timestamp) {
    payload.timestamp_micros = String(parseInt(body.browser_data.ga_timestamp, 10) * 1000);
  }

  const start = Date.now();
  const mpPath   = ga4Config?.debug ? 'debug/mp/collect' : 'mp/collect';
  const endpoint = `https://www.google-analytics.com/${mpPath}?measurement_id=${ga4Config.measurement_id}&api_secret=${apiSecret}`;
  try {
    const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const responseText = (await res.text()).substring(0, 1000);
    const isOk = ga4Config?.debug ? res.status === 200 : res.status === 204;
    await logEvent(env.DB, { site_id: siteId, event_name: ga4EventName, event_id: eventId, platform: 'google_analytics_4', channel: 'web', source: 'collect', status_code: res.status, request_ms: Date.now() - start, sent_payload: JSON.stringify(payload), response_payload: responseText, error_message: !isOk ? `unexpected_status_${res.status}` : ga4Config?.debug ? 'debug_mode' : '', nx_user: body.nx_user || '', source_ip: clientIp, user_agent: userAgent });
  } catch (e: any) {
    await logEvent(env.DB, { site_id: siteId, event_name: ga4EventName, event_id: eventId, platform: 'google_analytics_4', channel: 'web', source: 'collect', status_code: 0, request_ms: Date.now() - start, error_message: e?.message || String(e), nx_user: body.nx_user || '', source_ip: clientIp, user_agent: userAgent });
  }
}

export async function sendGA4MP(
  ga4Config: any,
  merged: any,
  env: Env,
  siteId: string
): Promise<void> {
  const apiSecret = ga4Config?.api_secret || env.GA4_API_SECRET;
  if (!ga4Config?.measurement_id || !apiSecret) {
    await logEvent(env.DB, { site_id: siteId, event_name: 'purchase', platform: 'google_analytics_4', channel: 'webhook', source: merged?.gateway || 'unknown', status_code: 0, error_message: !ga4Config?.measurement_id ? 'missing_measurement_id' : 'missing_api_secret', nx_user: merged?.nx_user || '', source_ip: merged?.ip || '', user_agent: merged?.user_agent || '' });
    return;
  }

  // Priority: real ga_client_id → order synthetic → nx_user synthetic → UUID (never drop)
  const gaClientId = merged.ga_client_id
    || (merged.order_id ? `order_${merged.order_id}` : null)
    || (merged.nx_user  ? `nx_${merged.nx_user}`     : null)
    || crypto.randomUUID();
  if (!gaClientId) return;

  const purchaseParams: any = {
    engagement_time_msec: 100,
    page_location:  merged.page_url || '',
    transaction_id: String(merged.order_id || ''),
    value:          parseFloat(merged.value) || 0,
    currency:       merged.currency || 'BRL',
    items: [{
      item_id:   String(merged.product_id   || ''),
      item_name: merged.product_name        || '',
      price:     parseFloat(merged.value)   || 0,
      quantity:  1,
    }],
  };

  if (ga4Config?.debug) purchaseParams.debug_mode = true;
  if (merged.ga_session_id)    purchaseParams.session_id     = String(merged.ga_session_id);
  if (merged.ga_session_count) purchaseParams.session_number = parseInt(String(merged.ga_session_count), 10);

  // Official GA4 MP UTM parameter names
  if (merged.utm_source)   purchaseParams.campaign_source   = merged.utm_source;
  if (merged.utm_medium)   purchaseParams.campaign_medium   = merged.utm_medium;
  if (merged.utm_campaign) purchaseParams.campaign_name     = merged.utm_campaign;
  if (merged.utm_term)     purchaseParams.campaign_term     = merged.utm_term;
  if (merged.utm_content)  purchaseParams.campaign_content  = merged.utm_content;

  // Google click IDs — enables Google Ads to attribute the conversion
  if (merged.gclid)  purchaseParams.gclid  = merged.gclid;
  if (merged.gbraid) purchaseParams.gbraid = merged.gbraid;
  if (merged.wbraid) purchaseParams.wbraid = merged.wbraid;

  const payload: any = {
    client_id:            gaClientId,
    non_personalized_ads: false,
    consent: { ad_user_data: 'GRANTED', ad_personalization: 'GRANTED' },
    events: [{ name: 'purchase', params: purchaseParams }],
  };

  if (merged.nx_user)    payload.user_id    = merged.nx_user;
  if (merged.ip)         payload.ip_override = merged.ip;
  if (merged.user_agent) payload.user_agent  = merged.user_agent;

  // Parse fullname into first/last for Enhanced Conversions
  let firstName = '', lastName = '';
  if (merged.fullname) {
    const parts = merged.fullname.trim().split(/\s+/);
    firstName = parts[0]                         || '';
    lastName  = parts.length > 1 ? parts[parts.length - 1] : '';
  }

  const userData = await buildUserData({
    email:      merged.email,
    phone:      merged.phone,
    first_name: firstName,
    last_name:  lastName,
    city:       merged.city,
    state:      merged.state,
    country:    merged.country,
    zip:        merged.zip,
  });
  if (userData) payload.user_data = userData;

  if (merged.ga_timestamp) {
    payload.timestamp_micros = String(parseInt(merged.ga_timestamp, 10) * 1000);
  }

  const start = Date.now();
  const mpPath2  = ga4Config?.debug ? 'debug/mp/collect' : 'mp/collect';
  const endpoint = `https://www.google-analytics.com/${mpPath2}?measurement_id=${ga4Config.measurement_id}&api_secret=${apiSecret}`;
  try {
    const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const responseText2 = (await res.text()).substring(0, 1000);
    const isOk2 = ga4Config?.debug ? res.status === 200 : res.status === 204;
    await logEvent(env.DB, { site_id: siteId, event_name: 'purchase', platform: 'google_analytics_4', channel: 'webhook', source: merged.gateway || 'unknown', status_code: res.status, request_ms: Date.now() - start, sent_payload: JSON.stringify(payload), response_payload: responseText2, error_message: !isOk2 ? `unexpected_status_${res.status}` : ga4Config?.debug ? 'debug_mode' : '', nx_user: merged.nx_user || '', source_ip: merged.ip || '', user_agent: merged.user_agent || '' });
  } catch (e: any) {
    await logEvent(env.DB, { site_id: siteId, event_name: 'purchase', platform: 'google_analytics_4', channel: 'webhook', source: merged.gateway || 'unknown', status_code: 0, request_ms: Date.now() - start, error_message: e?.message || String(e), nx_user: merged.nx_user || '', source_ip: merged.ip || '', user_agent: merged.user_agent || '' });
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function buildUserData(fields: {
  email?: string; phone?: string; first_name?: string; last_name?: string;
  city?: string; state?: string; country?: string; zip?: string;
}): Promise<Record<string, any> | null> {
  const ud: Record<string, any> = {};

  if (fields.email) {
    const h = await sha256(fields.email);
    if (h) ud.sha256_email_address = [h];
  }
  if (fields.phone) {
    const h = await sha256(normalizePhone(fields.phone));
    if (h) ud.sha256_phone_number = [h];
  }

  const addr: Record<string, any> = {};
  if (fields.first_name) { const h = await sha256(fields.first_name); if (h) addr.sha256_first_name = h; }
  if (fields.last_name)  { const h = await sha256(fields.last_name);  if (h) addr.sha256_last_name  = h; }
  if (fields.city)    addr.city        = fields.city;
  if (fields.state)   addr.region      = fields.state;
  if (fields.country) addr.country     = fields.country;
  if (fields.zip)     addr.postal_code = fields.zip;
  if (Object.keys(addr).length) ud.address = [addr];

  return Object.keys(ud).length ? ud : null;
}
