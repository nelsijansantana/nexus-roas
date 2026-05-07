import { Env } from '../types';
import { getConfig, detectSiteId } from '../shared/config';
import { hashPII } from '../shared/hash';
import { upsertUserStore, upsertUserStoreWithAccount, getUserStore, getUserStoreByCartToken, hasIdentityData } from '../store/user-store';
import { upsertAttribution } from '../store/attribution';
import { sendMetaCAPI } from '../platforms/meta';
import { sendTikTokEvent } from '../platforms/tiktok';
import { sendGA4Event } from '../platforms/ga4';
import { sendGoogleAdsConversion } from '../platforms/google-ads';
import { forwardToNexus } from '../nexus';
import { parseCookies } from '../shared/helpers';

export async function handleCollectEvent(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  const body: any = await request.json();
  const siteId    = detectSiteId(request, env);
  const config    = await getConfig(siteId, env);

  const clientIp  = request.headers.get('CF-Connecting-IP') || '';
  const userAgent = request.headers.get('User-Agent') || '';
  const cf: any   = (request as any).cf || {};

  // Resolve nx_user: body > HttpOnly cookie set by serve-pixel.ts
  const cookies = parseCookies(request.headers.get('Cookie'));
  let nxUser = body.nx_user || cookies['nx_user'] || '';

  // Recovery via shopify_cart_token — bridges the gap when nx_lid didn't transfer
  // to the CartPanda checkout subdomain. The shopify_cart_token cookie is set by
  // CartPanda and carries the same value as the Shopify "cart" cookie on the
  // storefront, which pixel.js already stored in user_store.cart_token.
  // Looking it up here recovers the original nx_user (with UTMs), then the
  // CartPanda UUID (browser_data.cart_token) gets written as the new cart_token
  // so webhook Tier-3 can find this user when the order arrives.
  if (!nxUser && body.shopify_cart_token) {
    try {
      const stored = await getUserStoreByCartToken(env.DB, body.shopify_cart_token);
      if (stored?.nx_user) nxUser = stored.nx_user;
    } catch (_) {}
  }

  nxUser = nxUser || crypto.randomUUID();
  // Propagate resolved identity back to body so all platform dispatches
  // (GA4, Meta, TikTok) use the same nx_user even when the beacon arrived empty.
  body.nx_user = nxUser;
  const eventName = body.event as string;
  const eventId   = body.event_id || crypto.randomUUID();

  // Cloudflare geo enrichment (prefer user-supplied, fall back to CF headers)
  const city    = body.user_data?.city    || (cf.city    as string) || '';
  const state   = body.user_data?.state   || (cf.region  as string) || '';
  const country = body.user_data?.country || (cf.country as string) || '';
  const zip     = body.user_data?.zip     || (cf.postalCode as string) || '';

  // 1. Persist identidade via Queue (async — não bloqueia a resposta)
  // A Queue processa os writes D1 em batch, reduzindo latência e conexões simultâneas.
  const bd = body.browser_data || {};
  const storeRecord = {
    nx_user:          nxUser,
    ip:               clientIp,
    user_agent:       userAgent,
    fbp:              bd.fbp              || '',
    fbc:              bd.fbc              || '',
    ttp:              bd.ttp              || '',
    ttclid:           bd.ttclid           || '',
    ga_client_id:     bd.ga_client_id     || '',
    ga_session_id:    bd.ga_session_id    || '',
    ga_session_count: bd.ga_session_count || '',
    ga_timestamp:     bd.ga_timestamp     || '',
    page_url:         body.page_url       || '',
    cart_token:       bd.cart_token       || '',
    email:            body.user_data?.email   || '',
    phone:            body.user_data?.phone   || '',
    fullname:         [body.user_data?.first_name, body.user_data?.last_name].filter(Boolean).join(' '),
    city, state, country, zip,
    utm_source:      body.utm_data?.utm_source      || '',
    utm_medium:      body.utm_data?.utm_medium      || '',
    utm_campaign:    body.utm_data?.utm_campaign    || '',
    utm_content:     body.utm_data?.utm_content     || '',
    utm_term:        body.utm_data?.utm_term        || '',
    utm_id:          body.utm_data?.utm_id          || '',
    utm_platform:    body.utm_data?.utm_platform    || '',
    utm_network:     body.utm_data?.utm_network     || '',
    ad_id:           body.utm_data?.ad_id           || '',
    adset_id:        body.utm_data?.adset_id        || '',
    campaign_id:     body.utm_data?.campaign_id     || '',
    placement:       body.utm_data?.placement       || '',
    creative_format: body.utm_data?.creative_format || '',
    conversion_type: body.utm_data?.conversion_type || '',
  };

  if (hasIdentityData(storeRecord)) {
    ctx.waitUntil(env.PERSISTENCE_QUEUE.send({
      type:       'user_store',
      pixel_id:   siteId,
      nx_user:    nxUser,
      account_id: config.account_id,
      user:       storeRecord,
    }));
  }

  // Click IDs via Queue (last-touch para recuperação em webhooks)
  if (bd.fbclid || bd.gclid || bd.gbraid || bd.wbraid || bd.ttclid || bd.msclkid || bd.twclid || bd.fbc) {
    ctx.waitUntil(env.PERSISTENCE_QUEUE.send({
      type:      'user_attribution',
      pixel_id:  siteId,
      nx_user:   nxUser,
      attribution: {
        nx_user:    nxUser,
        pixel_id:   siteId,
        fbclid:     bd.fbclid  || '',
        fbc:        bd.fbc     || '',
        gclid:      bd.gclid   || '',
        gbraid:     bd.gbraid  || '',
        wbraid:     bd.wbraid  || '',
        ttclid:     bd.ttclid  || '',
        msclkid:    bd.msclkid || '',
        twclid:     bd.twclid  || '',
        updated_at: Date.now(),
      },
    }));
  }

  // 2. Hash PII (normalizes phone/state/country before SHA-256)
  const hashed = await hashPII({
    email:       body.user_data?.email,
    phone:       body.user_data?.phone,
    first_name:  body.user_data?.first_name,
    last_name:   body.user_data?.last_name,
    city, state, country, zip,
    external_id: nxUser
  });

  // 3. Dispatch to CAPI platforms + Nexus (all fire-and-forget)
  ctx.waitUntil((async () => {
    const promises: Promise<any>[] = [];

    // Enrich body with config-level test codes (so CAPI panels show test events
    // regardless of whether the client script sent these fields)
    if (config.platforms?.meta && !(body.test_event_code)) {
      const metaTestCode = (config.platforms.meta as any).test_event_code;
      if (metaTestCode) body.test_event_code = metaTestCode;
    }

    // TikTok uses its own test code field — isolated from body.test_event_code (Meta) to
    // prevent Meta's test code from leaking into TikTok payloads.
    if (config.platforms?.tiktok && !body.tiktok_test_event_code) {
      const tiktokTestCode = (config.platforms.tiktok as any).test_event_code;
      if (tiktokTestCode) body.tiktok_test_event_code = tiktokTestCode;
    }

    // Enrich ga_client_id from user_store when checkout/server-side scripts don't have it.
    // Checkout sandbox may not send the cookie, so fallback to cart_token lookup.
    if (!body.browser_data?.ga_client_id) {
      try {
        const cartToken = body.browser_data?.cart_token || body.cart_token;
        const stored = (nxUser ? await getUserStore(env.DB, nxUser) : null)
          ?? (cartToken ? await getUserStoreByCartToken(env.DB, cartToken) : null);
        if (stored?.ga_client_id) {
          body.browser_data = body.browser_data || {};
          body.browser_data.ga_client_id     = stored.ga_client_id;
          body.browser_data.ga_session_id    = body.browser_data.ga_session_id    || stored.ga_session_id    || '';
          body.browser_data.ga_session_count = body.browser_data.ga_session_count || stored.ga_session_count || '';
          body.browser_data.ga_timestamp     = body.browser_data.ga_timestamp     || stored.ga_timestamp     || '';
        }
      } catch (_) {}
    }

    // Purchase events must only reach CAPI/MP via webhook (approved orders).
    // Browser/datalayer can fire for PIX generated, boleto generated, etc. — not confirmed.
    const isBeaconPurchase = eventName === 'Purchase';

    // Meta CAPI — primary pixel + mirrors
    if (!isBeaconPurchase && config.platforms?.meta?.pixel_id) {
      const meta  = config.platforms.meta;
      const token = meta.access_token || env.META_ACCESS_TOKEN;
      if (token) {
        const pixels = [meta.pixel_id, ...(meta.pixel_ids_mirror || [])];
        for (const pid of pixels) {
          promises.push(sendMetaCAPI(pid, token, eventName, eventId, hashed, body, clientIp, userAgent, env, siteId));
        }
      }
    }

    // TikTok Events API
    if (!isBeaconPurchase && config.platforms?.tiktok?.pixel_id) {
      promises.push(sendTikTokEvent(config.platforms.tiktok, eventName, eventId, hashed, body, clientIp, userAgent, env, siteId));
    }

    // GA4 Measurement Protocol
    if (!isBeaconPurchase && config.platforms?.ga4?.measurement_id) {
      const ga4Cfg = config.debug ? { ...config.platforms.ga4, debug: true } : config.platforms.ga4;
      promises.push(sendGA4Event(ga4Cfg, eventName, eventId, body, clientIp, userAgent, env, siteId));
    }

    // Google Ads Conversions API — fires for any event configured in google_ads.events
    if (!isBeaconPurchase && config.platforms?.google_ads?.events?.[eventName]) {
      promises.push(sendGoogleAdsConversion(
        config.platforms.google_ads as any,
        eventName,
        hashed,
        {
          value:      body.custom_data?.value,
          currency:   body.custom_data?.currency,
          order_id:   body.custom_data?.order_id,
          event_time: body.timestamp ? Number(body.timestamp) : undefined,
          nx_user:    nxUser,
          ip:         clientIp,
          user_agent: userAgent,
          gclid:      body.browser_data?.gclid   || undefined,
          gbraid:     body.browser_data?.gbraid  || undefined,
          wbraid:     body.browser_data?.wbraid  || undefined,
        },
        env,
        siteId,
      ));
    }

    // Forward to Nexus ROAS dashboard (analytics ingest — inclui click IDs e cookies de plataforma)
    promises.push(forwardToNexus(env, config, {
      event_type:   eventName,
      event_id:     eventId,
      nx_user:      nxUser,
      session_id:   body.session_id,
      value:        body.custom_data?.value,
      currency:     body.custom_data?.currency,
      order_id:     body.custom_data?.order_id,
      // UTMs
      utm_source:      body.utm_data?.utm_source,
      utm_medium:      body.utm_data?.utm_medium,
      utm_campaign:    body.utm_data?.utm_campaign,
      utm_content:     body.utm_data?.utm_content,
      utm_term:        body.utm_data?.utm_term,
      utm_id:          body.utm_data?.utm_id,
      utm_platform:    body.utm_data?.utm_platform,
      utm_network:     body.utm_data?.utm_network,
      ad_id:           body.utm_data?.ad_id,
      adset_id:        body.utm_data?.adset_id,
      campaign_id:     body.utm_data?.campaign_id,
      placement:       body.utm_data?.placement,
      creative_format: body.utm_data?.creative_format,
      conversion_type: body.utm_data?.conversion_type,
      // Click IDs (browser é a fonte mais confiável)
      fbclid:  body.browser_data?.fbclid,
      fbc:     body.browser_data?.fbc,
      fbp:     body.browser_data?.fbp,
      gclid:   body.browser_data?.gclid,
      gbraid:  body.browser_data?.gbraid,
      wbraid:  body.browser_data?.wbraid,
      ttclid:  body.browser_data?.ttclid,
      ttp:     body.browser_data?.ttp,
      msclkid: body.browser_data?.msclkid,
      twclid:  body.browser_data?.twclid,
      // GA4
      ga_session_id:     body.browser_data?.ga_session_id,
      ga_session_number: body.browser_data?.ga_session_count,
      // Geo + Device
      ip:           clientIp,
      user_agent:   userAgent,
      city, state, country,
      // Página
      page_url:  body.page_url,
      referrer:  body.referrer,
      match_type: nxUser === body.nx_user ? 'token' : (cookies['nx_user'] ? 'cookie' : 'new'),
    }));

    await Promise.allSettled(promises);
  })());

  // Determine root domain for cookie.
  // For ccTLDs like .com.br, .co.uk, slice(-2) gives the public suffix — use slice(-3).
  // Heuristic: if the second-to-last label is <= 3 chars (e.g. "com", "net", "org", "co")
  // treat it as a ccTLD compound and take 3 labels.
  let cookieDomain = '';
  try {
    if (body.page_url) {
      const parts = new URL(body.page_url).hostname.split('.');
      if (parts.length >= 2) {
        const sld = parts[parts.length - 2];
        const take = (parts.length >= 3 && sld.length <= 3) ? 3 : 2;
        cookieDomain = '; Domain=.' + parts.slice(-take).join('.');
      }
    }
  } catch (_) {}

  return new Response(JSON.stringify({ status: 'ok', event_id: eventId }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      // SameSite=None so the cookie is sent on cross-origin requests from
      // checkout sandboxes (Shopify Customer Events, CartPanda iframe, etc.).
      'Set-Cookie': `nx_user=${nxUser}; Path=/; Max-Age=63072000; HttpOnly; SameSite=None; Secure${cookieDomain}`
    }
  });
}
