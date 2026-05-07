import { Env } from '../types';
import { logEvent } from '../shared/logger';

const TIKTOK_EVENT_NAMES: Record<string, string> = {
  page_view: 'Pageview', contact: 'Contact', lead: 'SubmitForm',
  initiate_checkout: 'InitiateCheckout', purchase: 'Purchase',
  PageView:             'Pageview',
  Lead:                 'SubmitForm',
  Purchase:             'Purchase',
  InitiateCheckout:     'InitiateCheckout',
  AddToCart:            'AddToCart',
  AddPaymentInfo:       'AddPaymentInfo',
  AddToWishlist:        'AddToWishlist',
  Search:               'Search',
  ViewContent:          'ViewContent',
  ViewCategory:         'ViewContent',
  CompleteRegistration: 'CompleteRegistration',
  Contact:              'Contact',
};

// Locale mapping: country ISO → BCP-47 locale
const LOCALE_MAP: Record<string, string> = {
  BR: 'pt-BR', PT: 'pt-PT', US: 'en-US', GB: 'en-GB',
  ES: 'es-ES', MX: 'es-MX', AR: 'es-AR', CO: 'es-CO',
  FR: 'fr-FR', DE: 'de-DE', IT: 'it-IT', JP: 'ja-JP',
};

/** Converts ms timestamp to seconds with clock-drift protection. */
function safeEventTime(raw?: number): number {
  const now = Math.floor(Date.now() / 1000);
  if (!raw) return now;
  const secs = raw > 1_000_000_000_000 ? Math.floor(raw / 1000) : raw;
  return Math.min(secs, now);
}

export async function sendTikTokEvent(
  tiktokConfig: any,
  eventName: string,
  eventId: string,
  hashed: Record<string, string>,
  body: any,
  clientIp: string,
  userAgent: string,
  env: Env,
  siteId: string
): Promise<void> {
  const accessToken = tiktokConfig?.access_token || env.TIKTOK_ACCESS_TOKEN;
  if (!tiktokConfig?.pixel_id || !accessToken) return;
  if (eventName === '_update') return;

  const tiktokEventName = TIKTOK_EVENT_NAMES[eventName] || eventName;

  const cd = body.custom_data || {};
  const properties: any = {};
  if (cd.value != null) {
    properties.value    = parseFloat(cd.value) || 0;
    properties.currency = cd.currency || 'BRL';
    if (cd.order_id) properties.order_id = String(cd.order_id);
    if (cd.content_ids?.length || cd.contents?.length) {
      const ids      = cd.content_ids || [];
      const contents = cd.contents    || [];
      properties.contents = ids.map((id: string, i: number) => ({
        content_id:   id,
        content_name: (cd.content_name || '').split(', ')[i] || '',
        content_type: 'product',
        price:        contents[i]?.item_price ?? (properties.value / (ids.length || 1)),
        quantity:     contents[i]?.quantity   ?? 1,
      }));
    }
    if (cd.num_items) properties.num_items = cd.num_items;
  }
  // UTMs in properties for campaign reporting in TikTok Ads
  if (body.utm_data?.utm_source)   properties.utm_source   = body.utm_data.utm_source;
  if (body.utm_data?.utm_medium)   properties.utm_medium   = body.utm_data.utm_medium;
  if (body.utm_data?.utm_campaign) properties.utm_campaign = body.utm_data.utm_campaign;

  const country = (body.user_data?.country || '').toUpperCase().substring(0, 2);
  const locale  = LOCALE_MAP[country] || '';

  const testEventCode = tiktokConfig?.test_event_code || body.tiktok_test_event_code;
  const payload = {
    event_source:    'web',
    event_source_id: tiktokConfig.pixel_id,
    data: [{
      event:      tiktokEventName,
      event_time: safeEventTime(body.timestamp),
      event_id:   eventId,
      page:       { url: body.page_url || '' },
      user: {
        ...(hashed.email        ? { email:        hashed.email }       : {}),
        ...(hashed.phone        ? { phone_number: hashed.phone }       : {}),
        ...(hashed.external_id  ? { external_id:  hashed.external_id } : {}),
        ip:         clientIp,
        user_agent: userAgent,
        ...(locale ? { locale } : {}),
        ...(country ? { country } : {}),
        ...(body.user_data?.city  ? { city:   body.user_data.city.toLowerCase() }  : {}),
        ...(body.user_data?.state ? { region: body.user_data.state.toLowerCase() } : {}),
        ...(body.browser_data?.ttp    ? { ttp:    body.browser_data.ttp }    : {}),
        ...(body.browser_data?.ttclid ? { ttclid: body.browser_data.ttclid } : {}),
      },
      ...(Object.keys(properties).length ? { properties } : {})
    }],
    ...(testEventCode ? { test_event_code: testEventCode } : {})
  };

  const start = Date.now();
  try {
    const res = await fetch('https://business-api.tiktok.com/open_api/v1.3/event/track/', {
      method: 'POST',
      headers: { 'Access-Token': accessToken, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const responseText = await res.text();
    await logEvent(env.DB, { site_id: siteId, event_name: tiktokEventName, event_id: eventId, platform: 'tiktok_ads', channel: 'web', source: 'collect', status_code: res.status, request_ms: Date.now() - start, sent_payload: JSON.stringify(payload), response_payload: responseText.substring(0, 1000), error_message: res.ok ? '' : responseText.substring(0, 500), nx_user: body.nx_user || '', source_ip: clientIp, user_agent: userAgent });
  } catch (e: any) {
    await logEvent(env.DB, { site_id: siteId, event_name: tiktokEventName, event_id: eventId, platform: 'tiktok_ads', channel: 'web', source: 'collect', status_code: 0, request_ms: Date.now() - start, error_message: e?.message || String(e), nx_user: body.nx_user || '', source_ip: clientIp, user_agent: userAgent });
  }
}

export async function sendTikTokWebhook(
  tiktokConfig: any,
  eventName: string,
  hashed: Record<string, string>,
  merged: any,
  env: Env,
  siteId: string
): Promise<void> {
  const accessToken = tiktokConfig?.access_token || env.TIKTOK_ACCESS_TOKEN;
  if (!tiktokConfig?.pixel_id || !accessToken) return;

  const properties: any = {};
  if (merged.value) {
    properties.value    = parseFloat(merged.value) || 0;
    properties.currency = merged.currency || 'BRL';
    // order_id for TikTok deduplication (alongside D1 dedup)
    if (merged.order_id) properties.order_id = String(merged.order_id);
    if (merged.product_id || merged.product_name) {
      properties.contents = [{
        content_id:   String(merged.product_id || ''),
        content_name: merged.product_name || '',
        content_type: 'product',
        price:        parseFloat(merged.value) || 0,
        quantity:     1,
      }];
    }
  }
  // UTMs for TikTok campaign reporting
  if (merged.utm_source)   properties.utm_source   = merged.utm_source;
  if (merged.utm_medium)   properties.utm_medium   = merged.utm_medium;
  if (merged.utm_campaign) properties.utm_campaign = merged.utm_campaign;

  const country = (merged.country || '').toUpperCase().substring(0, 2);
  const locale  = LOCALE_MAP[country] || '';

  const testEventCode = tiktokConfig?.test_event_code;
  const payload = {
    event_source:    'web',
    event_source_id: tiktokConfig.pixel_id,
    data: [{
      event:      eventName,
      event_time: safeEventTime(),
      // order_id as event_id for deduplication
      ...(merged.order_id ? { event_id: String(merged.order_id) } : {}),
      page: { url: merged.page_url || '' },
      user: {
        ...(hashed.email        ? { email:        hashed.email }       : {}),
        ...(hashed.phone        ? { phone_number: hashed.phone }       : {}),
        ...(hashed.external_id  ? { external_id:  hashed.external_id } : {}),
        ip:         merged.ip || '',
        user_agent: merged.user_agent || '',
        ...(locale  ? { locale }  : {}),
        ...(country ? { country } : {}),
        ...(merged.city  ? { city:   merged.city.toLowerCase() }  : {}),
        ...(merged.state ? { region: merged.state.toLowerCase() } : {}),
        ...(merged.ttp    ? { ttp:    merged.ttp }    : {}),
        ...(merged.ttclid ? { ttclid: merged.ttclid } : {}),
      },
      ...(Object.keys(properties).length ? { properties } : {})
    }],
    ...(testEventCode ? { test_event_code: testEventCode } : {})
  };

  const start = Date.now();
  try {
    const res = await fetch('https://business-api.tiktok.com/open_api/v1.3/event/track/', {
      method: 'POST',
      headers: { 'Access-Token': accessToken, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const responseText = await res.text();
    await logEvent(env.DB, { site_id: siteId, event_name: eventName, platform: 'tiktok_ads', channel: 'webhook', source: merged.gateway || 'unknown', status_code: res.status, request_ms: Date.now() - start, sent_payload: JSON.stringify(payload), response_payload: responseText.substring(0, 1000), error_message: res.ok ? '' : responseText.substring(0, 500), nx_user: merged.nx_user || '', source_ip: merged.ip || '', user_agent: merged.user_agent || '' });
  } catch (e: any) {
    await logEvent(env.DB, { site_id: siteId, event_name: eventName, platform: 'tiktok_ads', channel: 'webhook', source: merged.gateway || 'unknown', status_code: 0, request_ms: Date.now() - start, error_message: e?.message || String(e), nx_user: merged.nx_user || '', source_ip: merged.ip || '', user_agent: merged.user_agent || '' });
  }
}
