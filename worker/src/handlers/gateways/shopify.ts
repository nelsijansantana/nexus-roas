import { Env } from '../../types'
import { handleGatewayWebhook } from './generic'

function extractOrderId(body: unknown): string {
  return String((body as Record<string, unknown>).id || '')
}

function extractMetadata(req: Request): Record<string, string> {
  return { topic: req.headers.get('x-shopify-topic') || '' }
}

export async function handleShopifyGateway(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  pixelId?: string,
): Promise<Response> {
  return handleGatewayWebhook(
    request, env, ctx,
    'shopify',
    'x-shopify-hmac-sha256',
    extractOrderId,
    pixelId,
    extractMetadata,
  )
}
