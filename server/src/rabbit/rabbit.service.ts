import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqplib from 'amqplib';

/**
 * RabbitMQ publisher + consumer with graceful degradation.
 *
 * If RabbitMQ is unavailable, `publish()` returns false and the caller should
 * fall back to its in-process queue. Consumers are only registered once a
 * connection is established.
 *
 * Queues:
 *   capi.meta    — Meta CAPI jobs
 *   capi.tiktok  — TikTok CAPI jobs
 *
 * Each queue has a Dead Letter Exchange (capi.dlx) so failed messages are not
 * silently dropped. DLQ: capi.dead
 */

export interface CapiMessage {
  platform: 'meta' | 'tiktok';
  eventType: string;
  eventId: string;
  sourceUrl?: string;
  lead: Record<string, unknown>;
  pixelId: string;
  token: string;
  customData?: Record<string, unknown>;
  testCode?: string;
  attempt: number;
}

const DLX = 'capi.dlx';
const DLQ = 'capi.dead';
const QUEUE_META = 'capi.meta';
const QUEUE_TIKTOK = 'capi.tiktok';
const PREFETCH = 4; // messages in-flight per consumer

@Injectable()
export class RabbitService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitService.name);

  private connection: amqplib.ChannelModel | null = null;
  private channel: amqplib.Channel | null = null;
  private _available = false;
  private _warnedOnce = false; // suppress repeated "unavailable" log spam

  // Consumer callbacks registered via onMessage()
  private readonly handlers = new Map<
    string,
    (msg: CapiMessage) => Promise<void>
  >();

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    await this._connect();
  }

  async onModuleDestroy() {
    try {
      await this.channel?.close();
      await this.connection?.close();
    } catch {
      /* noop */
    }
  }

  get available(): boolean {
    return this._available;
  }

  // ── Connection ──────────────────────────────────────────────────────────────

  private async _connect(): Promise<void> {
    const url =
      this.config.get<string>('RABBITMQ_URL') ||
      'amqp://guest:guest@localhost:5672';
    try {
      this.connection = await amqplib.connect(url);
      this.connection.on('error', () => this._onDisconnect());
      this.connection.on('close', () => this._onDisconnect());

      this.channel = await this.connection.createChannel();
      await this._setupTopology();

      this._available = true;
      this.logger.log('RabbitMQ connected');

      // Re-register any consumer handlers that were registered before connection
      for (const [queue, handler] of this.handlers.entries()) {
        await this._startConsumer(queue, handler);
      }
    } catch (err: any) {
      this._available = false;
      if (!this._warnedOnce) {
        this._warnedOnce = true;
        this.logger.warn(
          `RabbitMQ unavailable — CAPI will use in-process queue (${err?.message}). Retrying silently.`,
        );
      } else {
        this.logger.debug(`RabbitMQ retry failed: ${err?.message}`);
      }
      // Retry after 15s
      setTimeout(() => void this._connect(), 15_000);
    }
  }

  private _onDisconnect(): void {
    this._available = false;
    this._warnedOnce = false; // reset so reconnect logs at WARN level again
    this.channel = null;
    this.connection = null;
    this.logger.warn('RabbitMQ disconnected — retrying in 15s');
    setTimeout(() => void this._connect(), 15_000);
  }

  private async _setupTopology(): Promise<void> {
    const ch = this.channel!;

    // Dead Letter Exchange + Queue
    await ch.assertExchange(DLX, 'fanout', { durable: true });
    await ch.assertQueue(DLQ, { durable: true });
    await ch.bindQueue(DLQ, DLX, '');

    const queueArgs = {
      durable: true,
      arguments: { 'x-dead-letter-exchange': DLX },
    };
    await ch.assertQueue(QUEUE_META, queueArgs);
    await ch.assertQueue(QUEUE_TIKTOK, queueArgs);

    await ch.prefetch(PREFETCH);
  }

  // ── Publish ─────────────────────────────────────────────────────────────────

  /** Returns true if the message was published, false if RabbitMQ is unavailable. */
  publish(queue: string, msg: CapiMessage): boolean {
    if (!this._available || !this.channel) return false;
    try {
      const content = Buffer.from(JSON.stringify(msg));
      return this.channel.sendToQueue(queue, content, {
        persistent: true,
        contentType: 'application/json',
      });
    } catch {
      this._available = false;
      return false;
    }
  }

  // ── Consume ─────────────────────────────────────────────────────────────────

  /** Register a handler for a queue. Safe to call before connection is ready. */
  async onMessage(
    queue: string,
    handler: (msg: CapiMessage) => Promise<void>,
  ): Promise<void> {
    this.handlers.set(queue, handler);
    if (this._available) {
      await this._startConsumer(queue, handler);
    }
  }

  private async _startConsumer(
    queue: string,
    handler: (msg: CapiMessage) => Promise<void>,
  ): Promise<void> {
    const ch = this.channel!;
    await ch.consume(queue, (raw) => {
      if (!raw) return;
      void (async () => {
        try {
          const msg: CapiMessage = JSON.parse(raw.content.toString());
          await handler(msg);
          ch.ack(raw);
        } catch {
          // nack without requeue — goes to DLQ after x-dead-letter-exchange routing
          ch.nack(raw, false, false);
        }
      })();
    });
    this.logger.log(`Consumer registered on queue: ${queue}`);
  }

  // ── Queue names (exported constants for callers) ─────────────────────────────

  static readonly QUEUE_META = QUEUE_META;
  static readonly QUEUE_TIKTOK = QUEUE_TIKTOK;
}
