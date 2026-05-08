import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { JwtPayload } from '../auth/auth.service';
import {
  CreatePixelEventDto,
  UpdatePixelEventDto,
  PixelEventRule,
} from './dto/pixel-event.dto';

@Injectable()
export class PixelEventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectsService,
  ) {}

  // ─── Private helpers ─────────────────────────────────────────────────────

  /** Verify the caller owns (or has access to) the project */
  private async _assertAccess(
    projectId: string,
    caller: JwtPayload,
  ): Promise<void> {
    const ownerId = caller.ownerId ?? caller.userId;
    const project = await this.prisma.projects.findFirst({
      where: { id: projectId, userId: ownerId, deletedAt: null },
    });
    if (!project)
      throw new ForbiddenException('Project not found or access denied');
  }

  // ─── CRUD (authenticated) ─────────────────────────────────────────────────

  // ── Prisma accessor — cast needed until next `prisma generate` after migration ──
  private get db() {
    return (this.prisma as any).pixel_events;
  }

  async create(
    projectId: string,
    dto: CreatePixelEventDto,
    caller: JwtPayload,
  ) {
    await this._assertAccess(projectId, caller);

    const rule = await this.db.create({
      data: {
        id: randomUUID(),
        projectId,
        eventName: dto.eventName,
        triggerType: dto.triggerType,
        selector: dto.selector ?? null,
        buttonText: dto.buttonText ?? null,
        scrollDepth: dto.scrollDepth ?? null,
        timeSeconds: dto.timeSeconds ?? null,
        customData: dto.customData ?? {},
        isActive: true,
      },
    });
    await this.projects.resyncKV(projectId);
    return rule;
  }

  async findAll(projectId: string, caller: JwtPayload) {
    await this._assertAccess(projectId, caller);

    return this.db.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async update(
    projectId: string,
    id: string,
    dto: UpdatePixelEventDto,
    caller: JwtPayload,
  ) {
    await this._assertAccess(projectId, caller);

    const existing = await this.db.findFirst({ where: { id, projectId } });
    if (!existing) throw new NotFoundException('Pixel event not found');

    const updated = await this.db.update({
      where: { id },
      data: {
        ...(dto.eventName !== undefined && { eventName: dto.eventName }),
        ...(dto.triggerType !== undefined && { triggerType: dto.triggerType }),
        ...(dto.selector !== undefined && { selector: dto.selector }),
        ...(dto.buttonText !== undefined && { buttonText: dto.buttonText }),
        ...(dto.scrollDepth !== undefined && { scrollDepth: dto.scrollDepth }),
        ...(dto.timeSeconds !== undefined && { timeSeconds: dto.timeSeconds }),
        ...(dto.customData !== undefined && { customData: dto.customData }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
    await this.projects.resyncKV(projectId);
    return updated;
  }

  async remove(projectId: string, id: string, caller: JwtPayload) {
    await this._assertAccess(projectId, caller);

    const existing = await this.db.findFirst({ where: { id, projectId } });
    if (!existing) throw new NotFoundException('Pixel event not found');

    await this.db.delete({ where: { id } });
    await this.projects.resyncKV(projectId);
    return { deleted: true };
  }

  // ─── Internal — used by TrackerService (no auth) ──────────────────────────

  async findActiveRulesForProject(
    projectId: string,
  ): Promise<PixelEventRule[]> {
    const rows = await this.db.findMany({
      where: { projectId, isActive: true },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        eventName: true,
        triggerType: true,
        selector: true,
        buttonText: true,
        scrollDepth: true,
        timeSeconds: true,
        customData: true,
      },
    });

    return rows.map((r) => ({
      id: r.id,
      eventName: r.eventName,
      triggerType: r.triggerType as PixelEventRule['triggerType'],
      selector: r.selector,
      buttonText: r.buttonText,
      scrollDepth: r.scrollDepth,
      timeSeconds: r.timeSeconds,
      customData: (r.customData as Record<string, unknown>) ?? {},
    }));
  }
}
