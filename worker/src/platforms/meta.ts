import { Env, LeadRecord } from '../types';
import { logEvent } from '../shared/logger';

const META_EVENT_NAMES: Record<string, string> = {
  page_view: 'PageView', contact: 'Contact', lead: 'Lead',
  initiate_checkout: 'InitiateCheckout', purchase: 'Purchase',
  PageView: 'PageView', ViewContent: 'ViewContent', ViewCategory: 'ViewCategory',
  ViewCart: 'ViewCart', AddToCart: 'AddToCart', RemoveFromCart: 'RemoveFromCart',
  AddToWishlist: 'AddToWishlist', InitiateCheckout: 'InitiateCheckout',
  AddShippingInfo: 'AddShippingInfo', AddPaymentInfo: 'AddPaymentInfo',
  Purchase: 'Purchase', Lead: 'Lead', CompleteRegistration: 'CompleteRegistration',
  Search: 'Search', Contact: 'Contact',
};

/** Returns event_time in Unix seconds with clock-drift protection. */
function safeEventTime(raw?: number): number {
  const now = Math.floor(Date.now() / 1000);
  if (!raw) return now;
  // Detect millisecond timestamps (>1e12) and convert
  const secs = raw > 1_000_000_000_000 ? Math.floor(raw / 1000) : raw;
  // Clamp: Meta rejects events more than 7 days old or in the future
  return Math.min(secs, now);
}

function cleanUserData(ud: any): any {
  for (const k of Object.keys(ud)) {
    const v = ud[k];
    if (Array.isArray(v) && v.length === 0) delete ud[k];
    if (v === '') delete ud[k];
    if (v == null) delete ud[k];
  }
  return ud;
}

export async function sendMetaCAPI(
  pixelId: string,
  accessToken: string,
  eventName: string,
  eventId: string,
  hashed: Record<string, string>,
  body: any,
  clientIp: string,
  userAgent: string,
  env: Env,
  siteId: string
): Promise<void> {
  if (eventName === '_update') return;

  const metaEventName = META_EVENT_NAMES[eventName] || eventName;
  if (!pixelId || !accessToken) {
    await logEvent(env.DB, { site_id: siteId, event_name: metaEventName, event_id: eventId, platform: 'meta_ads', channel: 'web', source: 'collect', status_code: 0, error_message: !pixelId ? 'missing_pixel_id' : 'missing_access_token', nx_user: body.nx_user || '', source_ip: clientIp, user_agent: userAgent });
    return;
  }

  const cd = body.custom_data || {};
  const customData: any = {};

  if (cd.value != null) customData.value = parseFloat(cd.value) || 0;
  if (cd.content_ids?.length) {
    customData.content_ids  = cd.content_ids;
    customData.content_type = cd.content_type || 'product';
  }
  if (cd.contents?.length) {
    customData.contents = cd.contents.map((c: any) => ({
      id:         String(c.id || c.content_id || ''),
      quantity:   c.quantity   ?? 1,
      item_price: c.item_price ?? undefined,
    }));
  }
  if (customData.value != null || customData.contents?.length || customData.content_ids?.length) {
    customData.currency = cd.currency || 'BRL';
  }
  if (cd.content_name) customData.content_name = cd.content_name;
  if (cd.num_items)    customData.num_items    = cd.num_items;
  if (cd.order_id)     customData.order_id     = String(cd.order_id);
  // UTMs in custom_data — unlocks campaign-level attribution in Meta Ads Manager
  if (body.utm_data?.utm_source)   customData.utm_source   = body.utm_data.utm_source;
  if (body.utm_data?.utm_medium)   customData.utm_medium   = body.utm_data.utm_medium;
  if (body.utm_data?.utm_campaign) customData.utm_campaign = body.utm_data.utm_campaign;
  if (body.utm_data?.utm_content)  customData.utm_content  = body.utm_data.utm_content;
  if (body.utm_data?.utm_term)     customData.utm_term     = body.utm_data.utm_term;

  const payload = {
    data: [{
      event_name:       metaEventName,
      event_time:       safeEventTime(body.timestamp),
      event_id:         eventId,
      event_source_url: body.page_url || '',
      action_source:    'website',
      user_data: cleanUserData({
        em:               hashed.email      ? [hashed.email]      : [],
        ph:               hashed.phone      ? [hashed.phone]      : [],
        fn:               hashed.first_name ? [hashed.first_name] : [],
        ln:               hashed.last_name  ? [hashed.last_name]  : [],
        ct:               hashed.city       ? [hashed.city]       : [],
        st:               hashed.state      ? [hashed.state]      : [],
        country:          hashed.country    ? [hashed.country]    : [],
        zp:               hashed.zip        ? [hashed.zip]        : [],
        external_id:      hashed.external_id ? [hashed.external_id] : [],
        client_ip_address: clientIp,
        client_user_agent: userAgent,
        fbp: body.browser_data?.fbp || '',
        fbc: body.browser_data?.fbc || '',
      }),
      ...(Object.keys(customData).length ? { custom_data: customData } : {})
    }],
    ...(body.test_event_code ? { test_event_code: body.test_event_code } : {})
  };

  const start = Date.now();
  try {
    const res = await fetch(`https://graph.facebook.com/v25.0/${pixelId}/events`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const responseText = await res.text();
    await logEvent(env.DB, { site_id: siteId, event_name: metaEventName, event_id: eventId, platform: 'meta_ads', channel: 'web', source: 'collect', status_code: res.status, request_ms: Date.now() - start, sent_payload: JSON.stringify(payload), response_payload: responseText.substring(0, 1000), error_message: res.ok ? '' : responseText.substring(0, 500), nx_user: body.nx_user || '', source_ip: clientIp, user_agent: userAgent });
  } catch (e: any) {
    await logEvent(env.DB, { site_id: siteId, event_name: metaEventName, event_id: eventId, platform: 'meta_ads', channel: 'web', source: 'collect', status_code: 0, request_ms: Date.now() - start, error_message: e?.message || String(e), nx_user: body.nx_user || '', source_ip: clientIp, user_agent: userAgent });
  }
}

export async function sendMetaCAPIWebhook(
  pixelId: string,
  accessToken: string,
  eventName: string,
  hashed: Record<string, string>,
  merged: any,
  env: Env,
  siteId: string
): Promise<void> {
  const customData: any = {};
  if (eventName === 'Purchase') {
    if (merged.value)        customData.value        = parseFloat(merged.value) || 0;
    if (merged.currency)     customData.currency     = merged.currency;
    if (merged.product_name) customData.content_name = merged.product_name;
    if (merged.product_id)   customData.content_ids  = [String(merged.product_id)];
    if (merged.product_id)   customData.content_type = 'product';
    if (merged.product_id && merged.value) {
      customData.contents = [{ id: String(merged.product_id), quantity: 1, item_price: parseFloat(merged.value) || 0 }];
    }
    if (merged.order_id)     customData.order_id     = String(merged.order_id);
    if (merged.num_items)    customData.num_items     = merged.num_items;
  }
  // UTMs in custom_data for all event types
  if (merged.utm_source)   customData.utm_source   = merged.utm_source;
  if (merged.utm_medium)   customData.utm_medium   = merged.utm_medium;
  if (merged.utm_campaign) customData.utm_campaign = merged.utm_campaign;
  if (merged.utm_content)  customData.utm_content  = merged.utm_content;
  if (merged.utm_term)     customData.utm_term     = merged.utm_term;

  const payload = {
    data: [{
      event_name:       eventName,
      event_time:       safeEventTime(),
      // order_id as event_id for Meta deduplication (alongside D1 dedup)
      ...(merged.order_id ? { event_id: String(merged.order_id) } : {}),
      event_source_url: merged.page_url || '',
      action_source:    'website',
      user_data: cleanUserData({
        em:               hashed.email      ? [hashed.email]      : [],
        ph:               hashed.phone      ? [hashed.phone]      : [],
        fn:               hashed.first_name ? [hashed.first_name] : [],
        ln:               hashed.last_name  ? [hashed.last_name]  : [],
        ct:               hashed.city       ? [hashed.city]       : [],
        st:               hashed.state      ? [hashed.state]      : [],
        country:          hashed.country    ? [hashed.country]    : [],
        zp:               hashed.zip        ? [hashed.zip]        : [],
        external_id:      hashed.external_id ? [hashed.external_id] : [],
        client_ip_address: merged.ip || '',
        client_user_agent: merged.user_agent || '',
        fbp: merged.fbp || '',
        fbc: merged.fbc || '',
      }),
      ...(Object.keys(customData).length ? { custom_data: customData } : {})
    }],
    ...(merged.meta_test_event_code ? { test_event_code: merged.meta_test_event_code } : {})
  };

  const start = Date.now();
  try {
    const res = await fetch(`https://graph.facebook.com/v25.0/${pixelId}/events`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const responseText = await res.text();
    await logEvent(env.DB, { site_id: siteId, event_name: eventName, platform: 'meta_ads', channel: 'webhook', source: merged.gateway || 'unknown', status_code: res.status, request_ms: Date.now() - start, sent_payload: JSON.stringify(payload), response_payload: responseText.substring(0, 1000), error_message: res.ok ? '' : responseText.substring(0, 500), nx_user: merged.nx_user || '', source_ip: merged.ip || '', user_agent: merged.user_agent || '' });
  } catch (e: any) {
    await logEvent(env.DB, { site_id: siteId, event_name: eventName, platform: 'meta_ads', channel: 'webhook', source: merged.gateway || 'unknown', status_code: 0, request_ms: Date.now() - start, error_message: e?.message || String(e), nx_user: merged.nx_user || '', source_ip: merged.ip || '', user_agent: merged.user_agent || '' });
  }
}
