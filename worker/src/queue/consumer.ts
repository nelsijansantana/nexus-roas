import { Env } from '../types'
import { GatewayQueueMessage } from '../handlers/gateways/generic'
import { processGatewayEvent } from './processor'

/**
 * AC9: Cloudflare Queue batch handler for CAPI_QUEUE messages.
 *
 * Each message is processed independently so a single failure does not
 * prevent the remaining messages in the batch from being processed.
 * Failed messages are NOT re-queued here — Cloudflare Queue handles
 * retry/DLQ automatically based on the throw behaviour.
 */
export async function handleCapiQueue(
  batch: MessageBatch<Record<string, unknown>>,
  env:   Env,
): Promise<void> {
  for (const message of batch.messages) {
    const body = message.body

    if (body.type !== 'gateway_webhook') {
      message.ack()
      continue
    }

    try {
      await processGatewayEvent(body as unknown as GatewayQueueMessage, env)
      message.ack()
    } catch (err) {
      console.error('[consumer] unhandled error processing message', message.id, err)
      message.retry()
    }
  }
}
