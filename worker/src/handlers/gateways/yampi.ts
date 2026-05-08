import { Env } from '../../types'
import { handleGatewayWebhook } from './generic'

function extractOrderId(body: unknown): string {
  const resource = ((body as Record<string, unknown>).resource ?? {}) as Record<string, unknown>
  return String(resource.number || resource.id || '')
}

export async function handleYampiGateway(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  pixelId?: string,
): Promise<Response> {
  return handleGatewayWebhook(
    request, env, ctx,
    'yampi',
    'x-yampi-hmac-sha256',
    extractOrderId,
    pixelId,
  )
}
