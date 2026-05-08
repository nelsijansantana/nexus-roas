import { Env } from '../../types'
import { getConfig } from '../../shared/config'
import { hmacSha256Verify } from '../../lib/gateways/types'

export interface GatewayQueueMessage {
  type:        'gateway_webhook'
  gateway:     string
  pixel_id:    string
  order_id:    string
  raw_payload: string
  received_at: number
  /** Gateway-specific headers/metadata for the queue consumer (e.g. Shopify topic). */
  metadata?:   Record<string, string>
}

// AC10: resolve pixel_id from path param, query string, or custom header
export function resolvePixelId(request: Request, pathParam?: string): string | null {
  if (pathParam) return pathParam
  const qp = new URL(request.url).searchParams.get('pixel_id')
  if (qp) return qp
  const hdr = request.headers.get('X-Pixel-Id')
  if (hdr) return hdr
  return null
}

async function insertWebhookRaw(
  db: D1Database,
  siteId: string,
  gateway: string,
  orderId: string,
  payload: string,
): Promise<void> {
  try {
    await db.prepare(`
      INSERT OR IGNORE INTO webhook_raw (site_id, gateway, order_id, payload, processed)
      VALUES (?, ?, ?, ?, 0)
    `).bind(siteId, gateway, orderId, payload).run()
  } catch {
    // Non-fatal — dedup key in KV prevents double processing
  }
}

/**
 * Shared gateway webhook handler.
 *
 * @param hmacHeader      - Request header name carrying the HMAC signature (null = skip validation)
 * @param extractOrderId  - Extracts order ID from the parsed body
 * @param pixelIdFromPath - Pixel ID already parsed from path segment (optional)
 * @param extractMetadata - Optional: builds gateway-specific metadata from request headers
 */
export async function handleGatewayWebhook(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  gateway: string,
  hmacHeader: string | null,
  extractOrderId: (body: unknown) => string,
  pixelIdFromPath?: string,
  extractMetadata?: (req: Request) => Record<string, string>,
): Promise<Response> {
  // AC10: resolve pixel_id
  const pixelId = resolvePixelId(request, pixelIdFromPath)
  if (!pixelId) return err400('missing_pixel_id')

  // Read body as text first — HMAC validation requires the raw bytes
  let rawPayload: string
  try {
    rawPayload = await request.text()
  } catch {
    return err400('unreadable_body')
  }

  // AC1–AC3, AC9: HMAC validation when header is expected
  if (hmacHeader) {
    const signature = request.headers.get(hmacHeader)
    if (signature) {
      try {
        const config = await getConfig(pixelId, env)
        const gwCfg  = config.gateways_config?.[gateway] as Record<string, unknown> | undefined
        const secret = gwCfg?.webhook_secret as string | undefined
        if (secret) {
          const valid = await hmacSha256Verify(rawPayload, signature, secret)
          if (!valid) {
            return new Response(JSON.stringify({ error: 'invalid_hmac' }), {
              status: 401,
              headers: { 'Content-Type': 'application/json' },
            })
          }
        }
      } catch {
        // Config unavailable — allow through (fail-open to prevent dropped webhooks on cold start)
      }
    }
  }

  // Parse JSON
  let body: unknown
  try {
    body = JSON.parse(rawPayload)
  } catch {
    return err400('invalid_json')
  }

  const orderId = extractOrderId(body) || 'unknown'

  // AC5: KV deduplication — early exit before any writes
  const dedupKey = `wh:${pixelId}:${gateway}:${orderId}`
  const isDup    = await env.KV_DEDUP.get(dedupKey)
  if (isDup) {
    return new Response(JSON.stringify({ ok: true, duplicate: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  ctx.waitUntil(env.KV_DEDUP.put(dedupKey, '1', { expirationTtl: 86400 }))

  // AC6: persist raw payload to D1 (INSERT OR IGNORE — D1 UNIQUE constraint is a second guard)
  ctx.waitUntil(insertWebhookRaw(env.DB, pixelId, gateway, orderId, rawPayload))

  // AC7: enqueue for async CAPI processing (story 8.5 consumer)
  if (env.CAPI_QUEUE) {
    const msg: GatewayQueueMessage = {
      type:        'gateway_webhook',
      gateway,
      pixel_id:    pixelId,
      order_id:    orderId,
      raw_payload: rawPayload,
      received_at: Date.now(),
      metadata:    extractMetadata ? extractMetadata(request) : undefined,
    }
    ctx.waitUntil(env.CAPI_QUEUE.send(msg as unknown as Record<string, unknown>))
  }

  // AC8: respond immediately — webhook source must not wait for processing
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

/**
 * AC4: Generic handler for the remaining 11 gateways (no dedicated HMAC header).
 * Gateway name comes from the route path segment.
 */
export async function handleGenericGateway(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  gateway: string,
  pixelId?: string,
): Promise<Response> {
  return handleGatewayWebhook(
    request, env, ctx,
    gateway,
    null, // no HMAC header for generic gateways
    extractGenericOrderId,
    pixelId,
  )
}

function extractGenericOrderId(body: unknown): string {
  const b = body as Record<string, unknown>
  return String(
    b.order_id || b.id || b.code || b.transaction_id ||
    (b.order as Record<string, unknown>)?.id ||
    (b.order as Record<string, unknown>)?.code ||
    '',
  )
}

function err400(error: string): Response {
  return new Response(JSON.stringify({ error }), {
    status: 400,
    headers: { 'Content-Type': 'application/json' },
  })
}
