import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Redis wrapper with graceful degradation.
 *
 * Every public method is wrapped in try/catch — if Redis is unavailable the
 * caller receives null/false and the application continues without caching.
 * Redis is an accelerator, never a hard dependency.
 */

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private _available = false;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const url =
      this.config.get<string>('REDIS_URL') || 'redis://localhost:6379';
    try {
      this.client = new Redis(url, {
        lazyConnect: true,
        connectTimeout: 3000,
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
        retryStrategy: (times) => {
          // Retry with capped backoff; log only on first failure to avoid spam
          if (times === 1)
            this.logger.warn(
              'Redis connection lost — falling back to in-memory',
            );
          return Math.min(times * 500, 10_000);
        },
      });

      this.client.on('connect', () => {
        this._available = true;
        this.logger.log('Redis connected');
      });
      this.client.on('close', () => {
        this._available = false;
      });
      this.client.on('error', () => {
        this._available = false;
      });

      void this.client.connect().catch(() => {
        this._available = false;
      });
    } catch {
      this.logger.warn('Redis init failed — running without Redis');
    }
  }

  async onModuleDestroy() {
    await this.client?.quit().catch(() => {});
  }

  get available(): boolean {
    return this._available;
  }

  // ── Core ops ────────────────────────────────────────────────────────────────

  async get(key: string): Promise<string | null> {
    try {
      return (await this.client?.get(key)) ?? null;
    } catch {
      return null;
    }
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    try {
      if (ttlSeconds) {
        await this.client?.set(key, value, 'EX', ttlSeconds);
      } else {
        await this.client?.set(key, value);
      }
    } catch {
      /* noop */
    }
  }

  /** SET key value NX EX ttl — returns true if the key was set (acquired lock). */
  async setNX(
    key: string,
    value: string,
    ttlSeconds: number,
  ): Promise<boolean> {
    try {
      const result = await this.client?.set(key, value, 'EX', ttlSeconds, 'NX');
      return result === 'OK';
    } catch {
      return false;
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.client?.del(key);
    } catch {
      /* noop */
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const n = await this.client?.exists(key);
      return (n ?? 0) > 0;
    } catch {
      return false;
    }
  }

  // ── Convenience: JSON ───────────────────────────────────────────────────────

  async getJSON<T>(key: string): Promise<T | null> {
    const raw = await this.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async setJSON(
    key: string,
    value: unknown,
    ttlSeconds?: number,
  ): Promise<void> {
    await this.set(key, JSON.stringify(value), ttlSeconds);
  }
}
