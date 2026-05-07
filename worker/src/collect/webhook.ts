import { Env, SiteConfig } from '../types';
import { getConfig, getWebhookConfig, detectRouteParams } from '../shared/config';
import { hashPII } from '../shared/hash';
import {
  getUserStore,
  getUserStoreByCartToken,
  getUserStoreByAccount,
  getUserStoreByCartTokenAndAccount,
} from '../store/user-store';
import { fdvMerge } from '../store/fdv';
import { getLastClickIds } from '../store/attribution';
import { GATEWAY_PARSERS, APPROVAL_EVENTS } from '../gateways/index';
import { sendMetaCAPIWebhook } from '../platforms/meta';
import { sendTikTokWebhook } from '../platforms/tiktok';
import { sendGA4MP } from '../platforms/ga4';
import { sendGoogleAdsConversion } from '../platforms/google-ads';
import { forwardToNexus } from '../nexus';
import { getNestedValue, splitFirstName, splitLastName } from '../shared/helpers';

// ─── Entry point ──────────────────────────────────────────────────────────────

export async function handleWebhook(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  gateway: string
): Promise<Response> {
  const { wid, siteId } = detectRouteParams(request);

  // Rota por endpoint configurável: ?wid=<webhook_id>
  // Dispatch explícito para um ou mais projetos associados ao endpoint.
  if (wid) {
    return handleWebhookByEndpoint(request, env, ctx, gateway, wid);
  }

  // Rota legada por projeto: ?pid=<site_id> — backward compat, inalterada
  return handleWebhookByProject(request, env, ctx, gateway, siteId || '');
}

// ─── Rota por endpoint (?wid=) ────────────────────────────────────────────────

async function handleWebhookByEndpoint(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  gateway: string,
  wid: string
): Promise<Response> {
  const body: any = await request.json();

  if (gateway === 'shopify') {
    body.__topic = request.headers.get('x-shopify-topic') || '';
  }

  // 1. Pre-filter por evento de aprovação
  const approval = APPROVAL_EVENTS[gateway];
  if (approval) {
    if (getNestedValue(body, approval.field) !== approval.value) {
      return jsonResponse({ status: 'ignored', reason: 'not_approved' });
    }
  }

  // 2. Parse do payload do gateway
  const parser = GATEWAY_PARSERS[gateway];
  if (!parser) return jsonResponse({ error: 'unknown_gateway' }, 400);

  const webhookData = parser(body);
  if (webhookData === null) {
    return jsonResponse({ status: 'ignored', reason: 'not_purchase_status' });
  }

  // 3. Carregar config do endpoint no KV
  const endpointConfig = await getWebhookConfig(wid, env);
  if (!endpointConfig || endpointConfig.site_ids.length === 0) {
    return jsonResponse({ error: 'webhook_not_found' }, 404);
  }

  // 4. Deduplicação por endpoint: UNIQUE(webhook_id, order_id) no D1
  const rawPayload = JSON.stringify(body);
  if (webhookData.order_id) {
    try {
      await env.DB.prepare(
        `INSERT OR IGNORE INTO webhook_raw
           (site_id, webhook_id, gateway, order_id, payload)
         VALUES (?, ?, ?, ?, ?)`
      ).bind(
        endpointConfig.site_ids[0], wid, gateway,
        String(webhookData.order_id), rawPayload
      ).run();

      // Query by the same key as the UNIQUE constraint — fixes cross-endpoint dedup bug
      // where a second endpoint with different wid but same site_id would bypass dedup.
      const existing = await env.DB.prepare(
        'SELECT processed FROM webhook_raw WHERE site_id = ? AND gateway = ? AND order_id = ?'
      ).bind(endpointConfig.site_ids[0], gateway, String(webhookData.order_id)).first<{ processed: number }>();

      if (existing?.processed === 1) {
        return jsonResponse({ status: 'duplicate', order_id: webhookData.order_id, skipped: true });
      }
    } catch (e) {
      console.error('[webhook/wid] dedup error:', e);
    }
  } else {
    try {
      await env.DB.prepare(
        `INSERT INTO webhook_raw (site_id, webhook_id, gateway, order_id, payload)
         VALUES (?, ?, ?, NULL, ?)`
      ).bind(endpointConfig.site_ids[0], wid, gateway, rawPayload).run();
    } catch (_) { /* non-fatal */ }
  }

  // 5. Resolver identidade: nx_user → D1 lookup filtrado por account_id do endpoint
  const accountId = endpointConfig.account_id;
  let storeData = webhookData.nx_user
    ? await getUserStoreByAccount(env.DB, accountId, webhookData.nx_user)
    : null;

  // Tier-3: fallback por cart_token (account-scoped)
  if (!storeData && webhookData.cart_token) {
    storeData = await getUserStoreByCartTokenAndAccount(env.DB, accountId, webhookData.cart_token);
    if (storeData) webhookData.nx_user = storeData.nx_user;
  }

  // Tier-4: fallback sem filtro de account_id — cobre registros gravados antes do
  // account_id ser configurado no KV ou quando o beacon não carregou a config a tempo.
  if (!storeData && webhookData.nx_user) {
    storeData = await getUserStore(env.DB, webhookData.nx_user);
  }
  if (!storeData && webhookData.cart_token) {
    storeData = await getUserStoreByCartToken(env.DB, webhookData.cart_token);
    if (storeData) webhookData.nx_user = storeData.nx_user;
  }

  // 5b. Attribution recovery — fill click ID gaps from last browser beacon.
  // Runs once using the first site_id as the pixel scope.
  if (webhookData.nx_user) {
    try {
      const attr = await getLastClickIds(env.DB, webhookData.nx_user, endpointConfig.site_ids[0]);
      if (attr) {
        if (!webhookData.fbclid  && attr.fbclid)  webhookData.fbclid  = attr.fbclid;
        if (!webhookData.fbc     && attr.fbc)     webhookData.fbc     = attr.fbc;
        if (!webhookData.gclid   && attr.gclid)   webhookData.gclid   = attr.gclid;
        if (!webhookData.gbraid  && attr.gbraid)  webhookData.gbraid  = attr.gbraid;
        if (!webhookData.wbraid  && attr.wbraid)  webhookData.wbraid  = attr.wbraid;
        if (!webhookData.ttclid  && attr.ttclid)  webhookData.ttclid  = attr.ttclid;
        if (!webhookData.msclkid && attr.msclkid) webhookData.msclkid = attr.msclkid;
        if (!webhookData.twclid  && attr.twclid)  webhookData.twclid  = attr.twclid;
      }
    } catch (_) { /* non-fatal — attribution is best-effort */ }
  }

  const merged = fdvMerge(storeData, webhookData);

  // 6. Hash PII (uma vez, reutilizado para todos os projetos do endpoint)
  const hashed = await hashPII({
    email:       merged.email,
    phone:       merged.phone,
    first_name:  splitFirstName(merged.fullname),
    last_name:   splitLastName(merged.fullname),
    city:        merged.city,
    state:       merged.state,
    country:     merged.country,
    zip:         merged.zip,
    external_id: merged.nx_user,
  });

  // 7. Dispatch para TODOS os projetos associados ao endpoint (fire-and-forget)
  ctx.waitUntil((async () => {
    // Carregar configs de todos os projetos em paralelo com cache de requisição
    const configCache = new Map<string, SiteConfig>();
    const configs = await Promise.all(
      endpointConfig.site_ids.map(siteId => getConfig(siteId, env, configCache).then(cfg => ({ siteId, cfg })))
    );

    // Disparar CAPI para cada projeto com dedup cross-endpoint por orders_dispatched
    const allPromises: Promise<any>[] = [];
    for (const { siteId, cfg } of configs) {
      if (webhookData.order_id) {
        try {
          const result = await env.DB.prepare(
            'INSERT OR IGNORE INTO orders_dispatched (site_id, gateway, order_id) VALUES (?, ?, ?)'
          ).bind(siteId, gateway, String(webhookData.order_id)).run();
          // meta.changes === 0 means the row already existed — already dispatched for this project
          if (result.meta.changes === 0) continue;
        } catch (_) { /* non-fatal — proceed with dispatch */ }
      }
      allPromises.push(...buildCAPIPromises(cfg, siteId, merged, hashed, webhookData, gateway, env));
    }

    await Promise.allSettled(allPromises);

    // Marcar como processado
    if (webhookData.order_id) {
      try {
        await env.DB.prepare(
          'UPDATE webhook_raw SET processed = 1 WHERE site_id = ? AND gateway = ? AND order_id = ?'
        ).bind(endpointConfig.site_ids[0], gateway, String(webhookData.order_id)).run();
      } catch (_) { /* non-fatal */ }
    }
  })());

  return jsonResponse({ status: 'processed', targets: endpointConfig.site_ids.length });
}

// ─── Rota legada por projeto (?pid=) — inalterada ─────────────────────────────

async function handleWebhookByProject(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  gateway: string,
  siteId: string
): Promise<Response> {
  const body: any = await request.json();

  if (gateway === 'shopify') {
    body.__topic = request.headers.get('x-shopify-topic') || '';
  }

  const config = await getConfig(siteId, env);

  // 1. Pre-filter
  const approval = APPROVAL_EVENTS[gateway];
  if (approval) {
    if (getNestedValue(body, approval.field) !== approval.value) {
      return jsonResponse({ status: 'ignored', reason: 'not_approved' });
    }
  }

  // 2. Parse
  const parser = GATEWAY_PARSERS[gateway];
  if (!parser) return jsonResponse({ error: 'unknown_gateway' }, 400);

  const webhookData = parser(body);
  if (webhookData === null) {
    return jsonResponse({ status: 'ignored', reason: 'not_purchase_status' });
  }

  // 3. Dedup por projeto
  const rawPayload = JSON.stringify(body);
  if (webhookData.order_id) {
    try {
      await env.DB.prepare(
        'INSERT OR IGNORE INTO webhook_raw (site_id, gateway, order_id, payload) VALUES (?, ?, ?, ?)'
      ).bind(siteId, gateway, String(webhookData.order_id), rawPayload).run();

      const existing = await env.DB.prepare(
        'SELECT processed FROM webhook_raw WHERE site_id = ? AND gateway = ? AND order_id = ?'
      ).bind(siteId, gateway, String(webhookData.order_id)).first<{ processed: number }>();

      if (existing?.processed === 1) {
        return jsonResponse({ status: 'duplicate', order_id: webhookData.order_id, skipped: true });
      }
    } catch (e) {
      console.error('[webhook] dedup error:', e);
    }
  } else {
    try {
      await env.DB.prepare(
        'INSERT INTO webhook_raw (site_id, gateway, order_id, payload) VALUES (?, ?, NULL, ?)'
      ).bind(siteId, gateway, rawPayload).run();
    } catch (_) { /* non-fatal */ }
  }

  // 4. Identidade
  let storeData = webhookData.nx_user
    ? await getUserStore(env.DB, webhookData.nx_user)
    : null;

  if (!storeData && webhookData.cart_token) {
    storeData = await getUserStoreByCartToken(env.DB, webhookData.cart_token);
    if (storeData) webhookData.nx_user = storeData.nx_user;
  }

  // 4b. Attribution recovery — fill click ID gaps using last browser beacon.
  if (webhookData.nx_user) {
    try {
      const attr = await getLastClickIds(env.DB, webhookData.nx_user, siteId);
      if (attr) {
        if (!webhookData.fbclid  && attr.fbclid)  webhookData.fbclid  = attr.fbclid;
        if (!webhookData.fbc     && attr.fbc)     webhookData.fbc     = attr.fbc;
        if (!webhookData.gclid   && attr.gclid)   webhookData.gclid   = attr.gclid;
        if (!webhookData.gbraid  && attr.gbraid)  webhookData.gbraid  = attr.gbraid;
        if (!webhookData.wbraid  && attr.wbraid)  webhookData.wbraid  = attr.wbraid;
        if (!webhookData.ttclid  && attr.ttclid)  webhookData.ttclid  = attr.ttclid;
        if (!webhookData.msclkid && attr.msclkid) webhookData.msclkid = attr.msclkid;
        if (!webhookData.twclid  && attr.twclid)  webhookData.twclid  = attr.twclid;
      }
    } catch (_) { /* non-fatal */ }
  }

  const merged = fdvMerge(storeData, webhookData);

  // 5. Hash PII
  const hashed = await hashPII({
    email:       merged.email,
    phone:       merged.phone,
    first_name:  splitFirstName(merged.fullname),
    last_name:   splitLastName(merged.fullname),
    city:        merged.city,
    state:       merged.state,
    country:     merged.country,
    zip:         merged.zip,
    external_id: merged.nx_user,
  });

  // 6. Dispatch (com dedup cross-endpoint via orders_dispatched)
  ctx.waitUntil((async () => {
    if (webhookData.order_id) {
      try {
        const result = await env.DB.prepare(
          'INSERT OR IGNORE INTO orders_dispatched (site_id, gateway, order_id) VALUES (?, ?, ?)'
        ).bind(siteId, gateway, String(webhookData.order_id)).run();
        if (result.meta.changes === 0) return; // already dispatched
      } catch (_) { /* non-fatal */ }
    }

    const promises = buildCAPIPromises(config, siteId, merged, hashed, webhookData, gateway, env);
    await Promise.allSettled(promises);

    if (webhookData.order_id) {
      try {
        await env.DB.prepare(
          'UPDATE webhook_raw SET processed = 1 WHERE site_id = ? AND gateway = ? AND order_id = ?'
        ).bind(siteId, gateway, String(webhookData.order_id)).run();
      } catch (_) { /* non-fatal */ }
    }
  })());

  return jsonResponse({ status: 'processed' });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Constrói a lista de promises de CAPI para um único projeto */
function buildCAPIPromises(
  config: SiteConfig,
  siteId: string,
  merged: any,
  hashed: any,
  webhookData: any,
  gateway: string,
  env: Env
): Promise<any>[] {
  const promises: Promise<any>[] = [];
  // event_name defaults to 'Purchase' — parsers can set it to 'Lead', 'Contact', etc.
  const eventName = webhookData.event_name || 'Purchase';

  // Meta CAPI — pixel principal + mirrors (suporta qualquer event_name)
  if (config.platforms?.meta?.pixel_id) {
    const meta  = config.platforms.meta;
    const token = meta.access_token || env.META_ACCESS_TOKEN;
    if (token) {
      const mergedWithMeta = { ...merged, meta_test_event_code: (meta as any).test_event_code || '' };
      const pixels = [meta.pixel_id, ...(meta.pixel_ids_mirror || [])];
      for (const pid of pixels) {
        promises.push(sendMetaCAPIWebhook(pid, token, eventName, hashed, mergedWithMeta, env, siteId));
      }
    }
  }

  // TikTok Events API (suporta qualquer event_name)
  if (config.platforms?.tiktok?.pixel_id) {
    promises.push(sendTikTokWebhook(config.platforms.tiktok, eventName, hashed, merged, env, siteId));
  }

  // GA4 Measurement Protocol — sendGA4MP é específico para Purchase
  if (eventName === 'Purchase' && config.platforms?.ga4?.measurement_id) {
    const ga4Cfg = config.debug ? { ...config.platforms.ga4, debug: true } : config.platforms.ga4;
    promises.push(sendGA4MP(ga4Cfg, merged, env, siteId));
  }

  // Google Ads Conversions API — dispara se o evento estiver configurado
  if (config.platforms?.google_ads?.events?.[eventName]) {
    promises.push(sendGoogleAdsConversion(
      config.platforms.google_ads as any,
      eventName,
      hashed,
      {
        value:      typeof merged.value === 'string' ? parseFloat(merged.value) : merged.value,
        currency:   merged.currency,
        order_id:   merged.order_id,
        nx_user:    merged.nx_user,
        ip:         merged.ip,
        user_agent: merged.user_agent,
        gateway,
        gclid:      merged.gclid  || undefined,
        gbraid:     merged.gbraid || undefined,
        wbraid:     merged.wbraid || undefined,
      },
      env,
      siteId,
    ));
  }

  // Nexus ROAS dashboard — envia para todos os eventos configurados
  promises.push(forwardToNexus(env, config, {
    event_type:      eventName,
    nx_user:         merged.nx_user,
    value:           typeof merged.value === 'string' ? parseFloat(merged.value) : merged.value,
    currency:        merged.currency,
    payment_gateway: gateway,
    order_id:        merged.order_id,
    // UTMs (recuperados do D1 user_store via fdvMerge)
    utm_source:      merged.utm_source,
    utm_medium:      merged.utm_medium,
    utm_campaign:    merged.utm_campaign,
    utm_content:     merged.utm_content,
    utm_term:        merged.utm_term,
    utm_id:          merged.utm_id,
    utm_platform:    merged.utm_platform,
    utm_network:     merged.utm_network,
    ad_id:           merged.ad_id,
    adset_id:        merged.adset_id,
    campaign_id:     merged.campaign_id,
    placement:       merged.placement,
    creative_format: merged.creative_format,
    conversion_type: merged.conversion_type,
    // Click IDs (recuperados via attribution recovery)
    fbclid:  merged.fbclid,
    fbc:     merged.fbc,
    fbp:     merged.fbp,
    gclid:   merged.gclid,
    gbraid:  merged.gbraid,
    wbraid:  merged.wbraid,
    ttclid:  merged.ttclid,
    ttp:     merged.ttp,
    msclkid: merged.msclkid,
    twclid:  merged.twclid,
    // Geo + Device
    ip:          merged.ip,
    user_agent:  merged.user_agent,
    city:        merged.city,
    state:       merged.state,
    country:     merged.country,
    match_type:  merged.nx_user ? 'token' : 'no_match',
  }));

  return promises;
}

function jsonResponse(body: object, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
