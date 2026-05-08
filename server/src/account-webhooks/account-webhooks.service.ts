import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from '../auth/auth.service';
import {
  CreateAccountWebhookDto,
  UpdateAccountWebhookDto,
} from './dto/account-webhook.dto';

type WebhookRecord = {
  id: string;
  gateway: string;
  name: string;
  projectIds?: string[];
};

@Injectable()
export class AccountWebhooksService {
  private readonly logger = new Logger(AccountWebhooksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  // ─── KV sync ──────────────────────────────────────────────────────────────

  private async _kvPut(key: string, value: string): Promise<void> {
    const accountId = this.config.get<string>('CF_ACCOUNT_ID');
    const namespaceId = this.config.get<string>('CF_KV_NAMESPACE_ID');
    const apiToken = this.config.get<string>('CF_API_TOKEN');
    if (!accountId || !namespaceId || !apiToken) return;

    const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/values/${encodeURIComponent(key)}`;
    try {
      const res = await fetch(url, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'text/plain',
        },
        body: value,
      });
      if (!res.ok) {
        const text = await res.text();
        this.logger.warn(`[KV] PUT ${key} failed ${res.status}: ${text}`);
      }
    } catch (e: unknown) {
      this.logger.warn(
        `[KV] PUT ${key} error: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  private async _kvDelete(key: string): Promise<void> {
    const accountId = this.config.get<string>('CF_ACCOUNT_ID');
    const namespaceId = this.config.get<string>('CF_KV_NAMESPACE_ID');
    const apiToken = this.config.get<string>('CF_API_TOKEN');
    if (!accountId || !namespaceId || !apiToken) return;

    const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/values/${encodeURIComponent(key)}`;
    try {
      await fetch(url, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${apiToken}` },
      });
    } catch (e: unknown) {
      this.logger.warn(
        `[KV] DELETE ${key} error: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  /**
   * Sincroniza o endpoint no KV como `webhook:<wid>`.
   * O worker lê esta chave para saber para quais projetos disparar o CAPI.
   */
  private async _syncWebhookKV(
    webhook: WebhookRecord,
    webhookAccountId: string,
  ): Promise<void> {
    const kvPayload = {
      wid: webhook.id,
      account_id: webhookAccountId,
      gateway: webhook.gateway,
      name: webhook.name,
      site_ids: webhook.projectIds ?? [],
    };

    await this._kvPut(`webhook:${webhook.id}`, JSON.stringify(kvPayload));
  }

  // ─── Helpers de permissão ─────────────────────────────────────────────────

  private ownerId(caller: JwtPayload): string {
    return caller.ownerId ?? caller.userId;
  }

  private assertCanWrite(caller: JwtPayload) {
    if (caller.ownerId && caller.memberRole !== 'admin') {
      throw new ForbiddenException(
        'Sem permissão para gerenciar webhooks da conta',
      );
    }
  }

  /**
   * Garante que todos os projectIds fornecidos são pixel_ids de projetos
   * que pertencem ao userId informado. Previne vazamento de dados entre clientes.
   */
  private async assertProjectsOwned(
    userId: string,
    projectIds: string[],
  ): Promise<void> {
    if (!projectIds || projectIds.length === 0) return;

    const owned = await (this.prisma.projects as any).findMany({
      where: { pixelId: { in: projectIds }, userId, deletedAt: null },
      select: { pixelId: true },
    });
    const ownedSet = new Set(owned.map((p: any) => p.pixelId));
    const invalid = projectIds.filter((id) => !ownedSet.has(id));

    if (invalid.length > 0) {
      throw new BadRequestException(
        `Projeto(s) não encontrado(s) ou sem permissão: ${invalid.join(', ')}`,
      );
    }
  }

  // ─── CRUD ─────────────────────────────────────────────────────────────────

  async findAll(caller: JwtPayload) {
    const userId = this.ownerId(caller);
    const webhooks = await (this.prisma as any).account_webhooks.findMany({
      where: { userId, isActive: true, type: 'manual' },
      orderBy: { createdAt: 'asc' },
    });

    const workerUrl = this.config
      .get<string>('WORKER_URL', '')
      .replace(/\/$/, '');

    return webhooks.map((w: any) => this._buildResponse(w, workerUrl));
  }

  async create(dto: CreateAccountWebhookDto, caller: JwtPayload) {
    this.assertCanWrite(caller);
    const userId = this.ownerId(caller);

    // Validate that all projectIds belong to this user — prevents cross-client data leakage
    await this.assertProjectsOwned(userId, dto.projectIds ?? []);

    const user = await (this.prisma.users as any).findUnique({
      where: { id: userId },
      select: { webhookAccountId: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const webhook = await (this.prisma as any).account_webhooks.create({
      data: {
        userId,
        gateway: dto.gateway,
        name: dto.name,
        projectIds: dto.projectIds ?? [],
        type: 'manual',
        updatedAt: new Date(),
      },
    });

    await this._syncWebhookKV(webhook, user.webhookAccountId).catch((e) =>
      this.logger.warn('[KV] webhook sync failed on create:', e?.message),
    );

    const workerUrl = this.config
      .get<string>('WORKER_URL', '')
      .replace(/\/$/, '');
    return this._buildResponse(webhook, workerUrl);
  }

  async update(id: string, dto: UpdateAccountWebhookDto, caller: JwtPayload) {
    this.assertCanWrite(caller);
    const userId = this.ownerId(caller);

    const existing = await (this.prisma as any).account_webhooks.findFirst({
      where: { id, userId },
    });
    if (!existing) throw new NotFoundException('Webhook não encontrado');

    // Validate projectIds belong to this user before updating
    if (dto.projectIds !== undefined) {
      await this.assertProjectsOwned(userId, dto.projectIds);
    }

    const user = await (this.prisma.users as any).findUnique({
      where: { id: userId },
      select: { webhookAccountId: true },
    });

    const webhook = await (this.prisma as any).account_webhooks.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.gateway !== undefined ? { gateway: dto.gateway } : {}),
        ...(dto.projectIds !== undefined ? { projectIds: dto.projectIds } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        updatedAt: new Date(),
      },
    });

    await this._syncWebhookKV(webhook, user.webhookAccountId).catch((e) =>
      this.logger.warn('[KV] webhook sync failed on update:', e?.message),
    );

    const workerUrl = this.config
      .get<string>('WORKER_URL', '')
      .replace(/\/$/, '');
    return this._buildResponse(webhook, workerUrl);
  }

  async remove(id: string, caller: JwtPayload) {
    this.assertCanWrite(caller);
    const userId = this.ownerId(caller);

    const existing = await (this.prisma as any).account_webhooks.findFirst({
      where: { id, userId },
    });
    if (!existing) throw new NotFoundException('Webhook não encontrado');

    // Soft delete: marca isActive = false e remove do KV
    await (this.prisma as any).account_webhooks.update({
      where: { id },
      data: { isActive: false, updatedAt: new Date() },
    });

    void this._kvDelete(`webhook:${id}`).catch((e) =>
      this.logger.warn('[KV] webhook KV delete failed:', e?.message),
    );

    return { deleted: true, id };
  }

  // ─── Build response ───────────────────────────────────────────────────────

  private _buildResponse(webhook: any, workerUrl: string) {
    const webhookUrl = workerUrl
      ? `${workerUrl}/collect/webhook/${webhook.gateway}?wid=${webhook.id}`
      : '';

    return {
      id: webhook.id,
      gateway: webhook.gateway,
      name: webhook.name,
      projectIds: webhook.projectIds ?? [],
      isActive: webhook.isActive,
      createdAt: webhook.createdAt,
      updatedAt: webhook.updatedAt,
      type: webhook.type,
      webhookUrl,
    };
  }
}
