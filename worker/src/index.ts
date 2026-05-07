import { Env } from './types';
import { handleCollectEvent } from './collect/event';
import { handleWebhook } from './collect/webhook';
import { handleServePixelJs } from './routes/serve-pixel';
import { handleServeGA4Script, handleGA4CollectProxy } from './routes/ga4-proxy';
import { handleShopifyCheckoutPixel } from './routes/shopify-checkout';
import { handleCartPandaCheckoutPixel } from './routes/serve-cartpanda-checkout';
import { handleYampiCheckoutPixel } from './routes/serve-yampi-checkout';
import { handleDebug } from './routes/debug';
import { handleLogs } from './routes/logs';
import { handleLicenseValidate, handleLicensePing, handleAdminLicenseCreate, handleAdminLicenseList, handleAdminLicenseRevoke, handleWebhookTicto } from './routes/license';

// ── CORS ─────────────────────────────────────────────────────────────────────
// Reflect the exact origin — required when credentials (cookies) are involved.
// Accept any http/https origin since the pixel is embedded in arbitrary client sites.
// Reject browser-extension origins and null origins from data: URIs.
function getCorsHeaders(origin: string | null): Record<string, string> {
  const safe = origin && /^https?:\/\//.test(origin) ? origin : 'null';
  return {
    'Access-Control-Allow-Origin':      safe,
    'Access-Control-Allow-Methods':     'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers':     'Content-Type, X-Ingest-Key, X-Pixel-Id',
    'Access-Control-Allow-Credentials': 'true',
  };
}

// ── Rate limiter (in-memory, per-isolate) ────────────────────────────────────
// Protects /collect/event against burst abuse within a single Worker instance.
// Not a hard security boundary — complements WAF-level rate limiting.
const RL_WINDOW_MS   = 10_000;
const RL_MAX         = 60;    // max requests per IP per window
const rl = new Map<string, { n: number; reset: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  let e = rl.get(ip);
  if (!e || now > e.reset) {
    if (rl.size > 20_000) {
      // Lazy cleanup — remove expired entries to prevent unbounded growth
      for (const [k, v] of rl) if (now > v.reset) rl.delete(k);
    }
    rl.set(ip, { n: 1, reset: now + RL_WINDOW_MS });
    return false;
  }
  return ++e.n > RL_MAX;
}

// ── Request handler ───────────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url    = new URL(request.url);
    const path   = url.pathname;
    const method = request.method;
    const origin = request.headers.get('Origin');

    // CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: getCorsHeaders(origin) });
    }

    try {
      // ── Client scripts ───────────────────────────────────────────────────────
      if (path === '/tracking/pixel.js' && method === 'GET') {
        return await handleServePixelJs(request, env);
      }

      if (path === '/tracking/shopify-checkout.js' && method === 'GET') {
        return await handleShopifyCheckoutPixel(request, env);
      }

      if (path === '/tracking/cartpanda-checkout.js' && method === 'GET') {
        return await handleCartPandaCheckoutPixel(request, env);
      }

      if (path === '/tracking/yampi-checkout.js' && method === 'GET') {
        return await handleYampiCheckoutPixel(request, env);
      }

      // ── GA4 proxy (bypasses ad-blockers) ────────────────────────────────────
      if (path === '/scripts/ga.js' && method === 'GET') {
        return await handleServeGA4Script(request, env);
      }
      if (path === '/g/collect') {
        return await handleGA4CollectProxy(request, env);
      }

      // ── Real-time beacon ─────────────────────────────────────────────────────
      if ((path === '/collect/event' || path === '/event') && method === 'POST') {
        const ip = request.headers.get('CF-Connecting-IP') || '';
        if (ip && isRateLimited(ip)) {
          return new Response(JSON.stringify({ error: 'rate_limited' }), {
            status: 429,
            headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) },
          });
        }
        const response = await handleCollectEvent(request, env, ctx);
        const cors = getCorsHeaders(origin);
        Object.entries(cors).forEach(([k, v]) => response.headers.set(k, v));
        return response;
      }

      // ── Gateway webhooks ─────────────────────────────────────────────────────
      if (path.startsWith('/collect/webhook/') && method === 'POST') {
        const gateway = path.split('/collect/webhook/')[1];
        if (gateway) return await handleWebhook(request, env, ctx, gateway);
      }

      // ── Diagnostics ──────────────────────────────────────────────────────────
      if ((path === '/debug' || path === '/logs') && method === 'GET') {
        const ip = request.headers.get('CF-Connecting-IP') || '';
        if (ip && isRateLimited(ip)) {
          return new Response(JSON.stringify({ error: 'rate_limited' }), {
            status: 429,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        if (path === '/debug') return await handleDebug(request, env);
        return await handleLogs(request, env);
      }

      // ── Health-check ─────────────────────────────────────────────────────────
      if (path === '/ping') {
        return new Response(JSON.stringify({ ok: true, ts: Date.now() }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // ── License ──────────────────────────────────────────────────────────────
      if (path === '/license/validate' && method === 'POST')
        return await handleLicenseValidate(request, env);
      if (path === '/license/ping' && method === 'POST')
        return await handleLicensePing(request, env);
      if (path === '/admin/license/create' && method === 'POST')
        return await handleAdminLicenseCreate(request, env);
      if (path === '/admin/licenses' && method === 'GET')
        return await handleAdminLicenseList(request, env);
      if (path === '/admin/license/revoke' && method === 'PATCH')
        return await handleAdminLicenseRevoke(request, env);
      if (path === '/webhook/ticto' && method === 'POST')
        return await handleWebhookTicto(request, env);

      return new Response('Not Found', { status: 404 });

    } catch (err: any) {
      console.error('[nexus-worker] unhandled error:', err);
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (path.startsWith('/collect/')) Object.assign(headers, getCorsHeaders(origin));
      return new Response(
        JSON.stringify({ error: 'internal_error', message: err.message }),
        { status: 500, headers }
      );
    }
  },

  // ── Queue consumer — processa D1 writes assíncronos em batch ────────────────
  // Desacopla a gravação D1 da resposta da edge: o isolate responde ao usuário
  // imediatamente e a queue garante a persistência sem bloquear a latência.
  async queue(batch: MessageBatch<import('./types').PersistenceMessage>, env: Env): Promise<void> {
    // Dedup por nx_user: colapsa múltiplos eventos do mesmo usuário em um único write
    const userMap   = new Map<string, import('./types').PersistenceMessage>();
    const attrBatch: import('./types').PersistenceMessage[] = [];

    for (const msg of batch.messages) {
      const { type, nx_user } = msg.body;
      if (type === 'user_store') {
        const existing = userMap.get(nx_user);
        // Mescla: preserva campos preenchidos do primeiro registro (first-touch)
        if (existing?.user && msg.body.user) {
          for (const [k, v] of Object.entries(msg.body.user)) {
            if (v && !existing.user[k]) existing.user[k] = v;
          }
        } else {
          userMap.set(nx_user, msg.body);
        }
      } else if (type === 'user_attribution') {
        attrBatch.push(msg.body);
      }
      msg.ack();
    }

    const stmts: D1PreparedStatement[] = [];

    // user_store upserts
    for (const item of userMap.values()) {
      if (!item.user) continue;
      const u = item.user;
      const stmt = item.account_id
        ? env.DB.prepare(`
            INSERT INTO user_store (account_id, nx_user, ip, user_agent, fbp, fbc, ttp, ttclid,
              ga_client_id, ga_session_id, ga_session_count, ga_timestamp,
              page_url, email, phone, fullname, city, state, country, zip, cart_token,
              utm_source, utm_medium, utm_campaign, utm_content, utm_term, utm_id,
              utm_platform, utm_network, ad_id, adset_id, campaign_id,
              placement, creative_format, conversion_type)
            VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19,?20,?21,
                    ?22,?23,?24,?25,?26,?27,?28,?29,?30,?31,?32,?33,?34,?35)
            ON CONFLICT(nx_user) DO UPDATE SET
              updated_at      = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
              account_id      = CASE WHEN excluded.account_id != '' THEN excluded.account_id ELSE user_store.account_id END,
              ip              = COALESCE(NULLIF(user_store.ip,''),          excluded.ip),
              user_agent      = COALESCE(NULLIF(user_store.user_agent,''),  excluded.user_agent),
              fbp             = COALESCE(NULLIF(user_store.fbp,''),         excluded.fbp),
              fbc             = COALESCE(NULLIF(user_store.fbc,''),         excluded.fbc),
              ttp             = COALESCE(NULLIF(user_store.ttp,''),         excluded.ttp),
              ttclid          = COALESCE(NULLIF(user_store.ttclid,''),      excluded.ttclid),
              ga_client_id    = COALESCE(NULLIF(user_store.ga_client_id,''),excluded.ga_client_id),
              email           = COALESCE(NULLIF(user_store.email,''),       excluded.email),
              phone           = COALESCE(NULLIF(user_store.phone,''),       excluded.phone),
              fullname        = COALESCE(NULLIF(user_store.fullname,''),    excluded.fullname),
              city            = COALESCE(NULLIF(user_store.city,''),        excluded.city),
              state           = COALESCE(NULLIF(user_store.state,''),       excluded.state),
              country         = COALESCE(NULLIF(user_store.country,''),     excluded.country),
              zip             = COALESCE(NULLIF(user_store.zip,''),         excluded.zip),
              utm_source      = COALESCE(NULLIF(user_store.utm_source,''),  excluded.utm_source),
              utm_medium      = COALESCE(NULLIF(user_store.utm_medium,''),  excluded.utm_medium),
              utm_campaign    = COALESCE(NULLIF(user_store.utm_campaign,''),excluded.utm_campaign),
              utm_content     = COALESCE(NULLIF(user_store.utm_content,''), excluded.utm_content),
              utm_term        = COALESCE(NULLIF(user_store.utm_term,''),    excluded.utm_term),
              utm_id          = COALESCE(NULLIF(user_store.utm_id,''),      excluded.utm_id),
              utm_platform    = COALESCE(NULLIF(user_store.utm_platform,''),excluded.utm_platform),
              utm_network     = COALESCE(NULLIF(user_store.utm_network,''), excluded.utm_network),
              ad_id           = COALESCE(NULLIF(user_store.ad_id,''),       excluded.ad_id),
              adset_id        = COALESCE(NULLIF(user_store.adset_id,''),    excluded.adset_id),
              campaign_id     = COALESCE(NULLIF(user_store.campaign_id,''), excluded.campaign_id),
              placement       = COALESCE(NULLIF(user_store.placement,''),   excluded.placement),
              creative_format = COALESCE(NULLIF(user_store.creative_format,''), excluded.creative_format),
              conversion_type = COALESCE(NULLIF(user_store.conversion_type,''), excluded.conversion_type),
              ga_session_id    = CASE WHEN excluded.ga_session_id    != '' THEN excluded.ga_session_id    ELSE user_store.ga_session_id    END,
              ga_session_count = CASE WHEN excluded.ga_session_count != '' THEN excluded.ga_session_count ELSE user_store.ga_session_count END,
              ga_timestamp     = CASE WHEN excluded.ga_timestamp     != '' THEN excluded.ga_timestamp     ELSE user_store.ga_timestamp     END,
              page_url         = CASE WHEN excluded.page_url         != '' THEN excluded.page_url         ELSE user_store.page_url         END,
              cart_token       = CASE WHEN excluded.cart_token       != '' THEN excluded.cart_token       ELSE user_store.cart_token       END
          `).bind(
              item.account_id, u.nx_user, u.ip??'', u.user_agent??'', u.fbp??'', u.fbc??'',
              u.ttp??'', u.ttclid??'', u.ga_client_id??'', u.ga_session_id??'',
              u.ga_session_count??'', u.ga_timestamp??'', u.page_url??'',
              u.email??'', u.phone??'', u.fullname??'', u.city??'', u.state??'',
              u.country??'', u.zip??'', u.cart_token??'',
              u.utm_source??'', u.utm_medium??'', u.utm_campaign??'', u.utm_content??'',
              u.utm_term??'', u.utm_id??'', u.utm_platform??'', u.utm_network??'',
              u.ad_id??'', u.adset_id??'', u.campaign_id??'', u.placement??'',
              u.creative_format??'', u.conversion_type??'',
            )
        : env.DB.prepare(`
            INSERT INTO user_store (nx_user, ip, user_agent, fbp, fbc, ttp, ttclid,
              ga_client_id, ga_session_id, ga_session_count, ga_timestamp,
              page_url, email, phone, fullname, city, state, country, zip, cart_token,
              utm_source, utm_medium, utm_campaign, utm_content, utm_term, utm_id,
              utm_platform, utm_network, ad_id, adset_id, campaign_id,
              placement, creative_format, conversion_type)
            VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19,?20,
                    ?21,?22,?23,?24,?25,?26,?27,?28,?29,?30,?31,?32,?33,?34)
            ON CONFLICT(nx_user) DO UPDATE SET
              updated_at      = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
              ip              = COALESCE(NULLIF(user_store.ip,''),          excluded.ip),
              user_agent      = COALESCE(NULLIF(user_store.user_agent,''),  excluded.user_agent),
              fbp             = COALESCE(NULLIF(user_store.fbp,''),         excluded.fbp),
              fbc             = COALESCE(NULLIF(user_store.fbc,''),         excluded.fbc),
              ttp             = COALESCE(NULLIF(user_store.ttp,''),         excluded.ttp),
              ttclid          = COALESCE(NULLIF(user_store.ttclid,''),      excluded.ttclid),
              ga_client_id    = COALESCE(NULLIF(user_store.ga_client_id,''),excluded.ga_client_id),
              email           = COALESCE(NULLIF(user_store.email,''),       excluded.email),
              phone           = COALESCE(NULLIF(user_store.phone,''),       excluded.phone),
              fullname        = COALESCE(NULLIF(user_store.fullname,''),    excluded.fullname),
              city            = COALESCE(NULLIF(user_store.city,''),        excluded.city),
              state           = COALESCE(NULLIF(user_store.state,''),       excluded.state),
              country         = COALESCE(NULLIF(user_store.country,''),     excluded.country),
              zip             = COALESCE(NULLIF(user_store.zip,''),         excluded.zip),
              utm_source      = COALESCE(NULLIF(user_store.utm_source,''),  excluded.utm_source),
              utm_medium      = COALESCE(NULLIF(user_store.utm_medium,''),  excluded.utm_medium),
              utm_campaign    = COALESCE(NULLIF(user_store.utm_campaign,''),excluded.utm_campaign),
              utm_content     = COALESCE(NULLIF(user_store.utm_content,''), excluded.utm_content),
              utm_term        = COALESCE(NULLIF(user_store.utm_term,''),    excluded.utm_term),
              utm_id          = COALESCE(NULLIF(user_store.utm_id,''),      excluded.utm_id),
              utm_platform    = COALESCE(NULLIF(user_store.utm_platform,''),excluded.utm_platform),
              utm_network     = COALESCE(NULLIF(user_store.utm_network,''), excluded.utm_network),
              ad_id           = COALESCE(NULLIF(user_store.ad_id,''),       excluded.ad_id),
              adset_id        = COALESCE(NULLIF(user_store.adset_id,''),    excluded.adset_id),
              campaign_id     = COALESCE(NULLIF(user_store.campaign_id,''), excluded.campaign_id),
              placement       = COALESCE(NULLIF(user_store.placement,''),   excluded.placement),
              creative_format = COALESCE(NULLIF(user_store.creative_format,''), excluded.creative_format),
              conversion_type = COALESCE(NULLIF(user_store.conversion_type,''), excluded.conversion_type),
              ga_session_id    = CASE WHEN excluded.ga_session_id    != '' THEN excluded.ga_session_id    ELSE user_store.ga_session_id    END,
              ga_session_count = CASE WHEN excluded.ga_session_count != '' THEN excluded.ga_session_count ELSE user_store.ga_session_count END,
              ga_timestamp     = CASE WHEN excluded.ga_timestamp     != '' THEN excluded.ga_timestamp     ELSE user_store.ga_timestamp     END,
              page_url         = CASE WHEN excluded.page_url         != '' THEN excluded.page_url         ELSE user_store.page_url         END,
              cart_token       = CASE WHEN excluded.cart_token       != '' THEN excluded.cart_token       ELSE user_store.cart_token       END
          `).bind(
              u.nx_user, u.ip??'', u.user_agent??'', u.fbp??'', u.fbc??'',
              u.ttp??'', u.ttclid??'', u.ga_client_id??'', u.ga_session_id??'',
              u.ga_session_count??'', u.ga_timestamp??'', u.page_url??'',
              u.email??'', u.phone??'', u.fullname??'', u.city??'', u.state??'',
              u.country??'', u.zip??'', u.cart_token??'',
              u.utm_source??'', u.utm_medium??'', u.utm_campaign??'', u.utm_content??'',
              u.utm_term??'', u.utm_id??'', u.utm_platform??'', u.utm_network??'',
              u.ad_id??'', u.adset_id??'', u.campaign_id??'', u.placement??'',
              u.creative_format??'', u.conversion_type??'',
            );
      stmts.push(stmt);
    }

    // user_attribution upserts
    for (const item of attrBatch) {
      const a = item.attribution;
      if (!a) continue;
      stmts.push(env.DB.prepare(`
        INSERT INTO user_attribution (nx_user, pixel_id, fbclid, fbc, gclid, gbraid, wbraid, ttclid, msclkid, twclid, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(nx_user, pixel_id) DO UPDATE SET
          fbclid   = CASE WHEN excluded.fbclid   != '' THEN excluded.fbclid   ELSE user_attribution.fbclid   END,
          fbc      = CASE WHEN excluded.fbc      != '' THEN excluded.fbc      ELSE user_attribution.fbc      END,
          gclid    = CASE WHEN excluded.gclid    != '' THEN excluded.gclid    ELSE user_attribution.gclid    END,
          gbraid   = CASE WHEN excluded.gbraid   != '' THEN excluded.gbraid   ELSE user_attribution.gbraid   END,
          wbraid   = CASE WHEN excluded.wbraid   != '' THEN excluded.wbraid   ELSE user_attribution.wbraid   END,
          ttclid   = CASE WHEN excluded.ttclid   != '' THEN excluded.ttclid   ELSE user_attribution.ttclid   END,
          msclkid  = CASE WHEN excluded.msclkid  != '' THEN excluded.msclkid  ELSE user_attribution.msclkid  END,
          twclid   = CASE WHEN excluded.twclid   != '' THEN excluded.twclid   ELSE user_attribution.twclid   END,
          updated_at = excluded.updated_at
      `).bind(
        item.nx_user, item.pixel_id,
        a.fbclid??'', a.fbc??'', a.gclid??'', a.gbraid??'', a.wbraid??'',
        a.ttclid??'', a.msclkid??'', a.twclid??'', a.updated_at ?? Date.now(),
      ));
    }

    if (stmts.length > 0) {
      try {
        await env.DB.batch(stmts);
      } catch (e) {
        console.error('[queue] D1 batch error:', e);
      }
    }
  },

  // Daily retention cleanup — runs at 03:00 UTC via wrangler cron trigger
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil((async () => {
      const cutoff90d  = `datetime('now', '-90 days')`;
      const cutoff30d  = `datetime('now', '-30 days')`;
      const attrCutoff = Date.now() - 90 * 86_400_000;
      await env.DB.batch([
        env.DB.prepare(`DELETE FROM events              WHERE timestamp  < ${cutoff30d}`),
        env.DB.prepare(`DELETE FROM webhook_raw         WHERE timestamp  < ${cutoff30d}`),
        env.DB.prepare(`DELETE FROM orders_dispatched   WHERE timestamp  < ${cutoff30d}`),
        env.DB.prepare(`DELETE FROM checkout_sessions   WHERE expires_at < ?`).bind(Math.floor(Date.now() / 1000)),
        env.DB.prepare(`DELETE FROM user_store          WHERE updated_at < ${cutoff90d}`),
        env.DB.prepare(`DELETE FROM user_attribution    WHERE updated_at < ?`).bind(attrCutoff),
        env.DB.prepare(`DELETE FROM capi_log            WHERE created_at < ?`).bind(Date.now() - 30 * 86_400_000),
      ]);
    })());
  },
};
