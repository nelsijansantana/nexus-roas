import { Env } from '../../types'
import { handleGatewayWebhook } from './generic'

function extractOrderId(body: unknown): string {
  const b = body as Record<string, unknown>
  const order = (b.order ?? {}) as Record<string, unknown>
  return String(order.code || order.id || b.order_id || '')
}

export async function handleCartPandaGateway(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  pixelId?: string,
): Promise<Response> {
  return handleGatewayWebhook(
    request, env, ctx,
    'cartpanda',
    'x-cartpanda-hmac-sha256',
    extractOrderId,
    pixelId,
  )
}
