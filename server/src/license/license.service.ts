import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';

export interface LicenseInfo {
  valid: boolean;
  tier: string;
  status: string;
  expires_at: string | null;
  limits: {
    max_projects: number;
    max_sales_month: number;
    max_seats: number;
    data_retention_days: number;
  };
}

const FALLBACK_LICENSE: LicenseInfo = {
  valid: true,
  tier: 'agency',
  status: 'active',
  expires_at: null,
  limits: { max_projects: -1, max_sales_month: -1, max_seats: -1, data_retention_days: 365 },
};

const REDIS_KEY = 'license:current';
const REDIS_TTL = 86400; // 24h

@Injectable()
export class LicenseService implements OnModuleInit {
  private readonly logger = new Logger(LicenseService.name);
  private license: LicenseInfo = FALLBACK_LICENSE;

  constructor(
    private config: ConfigService,
    private redis: RedisService,
  ) {}

  async onModuleInit() {
    await this.refreshLicense();
    // Re-validate every 24h
    setInterval(() => this.refreshLicense(), REDIS_TTL * 1000);
  }

  async refreshLicense(): Promise<void> {
    const key = this.config.get<string>('LICENSE_KEY') || 'NEXUS-INTERNAL-OWNER';
    const workerUrl = this.config.get<string>('WORKER_URL');
    const domain = this.config.get<string>('APP_DOMAIN') || '';

    try {
      const res = await fetch(`${workerUrl}/license/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, domain }),
        signal: AbortSignal.timeout(10_000),
      });

      if (res.ok) {
        const data = await res.json() as LicenseInfo;
        this.license = data;
        await this.redis.set(REDIS_KEY, JSON.stringify(data), REDIS_TTL);
        this.logger.log(`License OK — tier: ${data.tier}, status: ${data.status}`);
        return;
      }
    } catch (err) {
      this.logger.warn(`License server unreachable: ${(err as Error).message}. Using cached/fallback.`);
    }

    // Try Redis cache
    try {
      const cached = await this.redis.get(REDIS_KEY);
      if (cached) {
        this.license = JSON.parse(cached);
        this.logger.log(`License loaded from cache — tier: ${this.license.tier}`);
        return;
      }
    } catch {}

    // Final fallback: if LICENSE_KEY is the internal owner key, grant full access
    if (key === 'NEXUS-INTERNAL-OWNER') {
      this.license = FALLBACK_LICENSE;
      this.logger.warn('Using internal owner fallback license.');
    } else {
      this.logger.warn('License validation failed and no cache available. Allowing with warning.');
      // Don't block the server — just warn
    }
  }

  getLicense(): LicenseInfo {
    return this.license;
  }

  isValid(): boolean {
    return this.license.valid !== false;
  }

  getTier(): string {
    return this.license.tier || 'starter';
  }

  canCreateProject(currentCount: number): boolean {
    const max = this.license.limits?.max_projects ?? 1;
    if (max === -1) return true;
    return currentCount < max;
  }

  canAddSeat(currentCount: number): boolean {
    const max = this.license.limits?.max_seats ?? 1;
    if (max === -1) return true;
    return currentCount < max;
  }

  // Proxy admin operations to the Worker
  async adminListLicenses(): Promise<any> {
    return this.adminRequest('GET', '/admin/licenses');
  }

  async adminCreateLicense(body: { email: string; name?: string; tier: string; expires_at?: string }): Promise<any> {
    return this.adminRequest('POST', '/admin/license/create', body);
  }

  async adminRevokeLicense(key: string): Promise<any> {
    return this.adminRequest('PATCH', '/admin/license/revoke', { key });
  }

  private async adminRequest(method: string, path: string, body?: unknown): Promise<any> {
    const workerUrl = this.config.get<string>('WORKER_URL');
    const secret = this.config.get<string>('NEXUS_ADMIN_SECRET');

    const res = await fetch(`${workerUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Secret': secret || '',
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Worker admin request failed (${res.status}): ${text}`);
    }

    return res.json();
  }
}
