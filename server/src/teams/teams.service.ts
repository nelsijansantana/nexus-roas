import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { CreateMemberDto, UpdateMemberDto } from './dto/team.dto';
import { getPlan } from '../common/plans.config';

@Injectable()
export class TeamsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── List members ─────────────────────────────────────────────────────────

  async listMembers(ownerId: string) {
    const memberships = await (this.prisma.team_memberships as any).findMany({
      where: { ownerId },
      include: { member: { select: { id: true, email: true, name: true } } },
      orderBy: { createdAt: 'asc' },
    });

    return memberships.map((m: any) => ({
      membershipId: m.id,
      userId: m.userId,
      email: m.member.email,
      name: m.member.name,
      role: m.role,
      createdAt: m.createdAt,
    }));
  }

  // ─── Create member ────────────────────────────────────────────────────────

  async createMember(ownerId: string, dto: CreateMemberDto) {
    // Check seat limit for this owner's plan
    const owner = await (this.prisma.users as any).findUnique({ where: { id: ownerId } });
    if (!owner) throw new NotFoundException('Conta não encontrada');

    const plan = getPlan(owner.plan ?? 'free');
    if (plan.seats !== -1) {
      const currentCount = await (this.prisma.team_memberships as any).count({ where: { ownerId } });
      if (currentCount >= plan.seats) {
        throw new ForbiddenException(
          `Seu plano ${plan.name} permite no máximo ${plan.seats} membro(s) no time. Faça upgrade para adicionar mais.`,
        );
      }
    }

    // Check if email already exists as a user
    const existing = await (this.prisma.users as any).findUnique({
      where: { email: dto.email.toLowerCase().trim() },
    });

    if (existing) {
      // Check if already member of this account
      const alreadyMember = await (this.prisma.team_memberships as any).findUnique({
        where: { ownerId_userId: { ownerId, userId: existing.id } },
      });
      if (alreadyMember) {
        throw new ConflictException('Este usuário já é membro da sua conta');
      }

      // Add existing user as member
      const membership = await (this.prisma.team_memberships as any).create({
        data: {
          id: randomUUID(),
          ownerId,
          userId: existing.id,
          role: dto.role,
          updatedAt: new Date(),
        },
      });

      return {
        membershipId: membership.id,
        userId: existing.id,
        email: existing.email,
        name: existing.name,
        role: membership.role,
        createdAt: membership.createdAt,
      };
    }

    // Create new user account for the member
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(dto.password, salt);
    const now = new Date();

    const newUser = await (this.prisma.users as any).create({
      data: {
        id: randomUUID(),
        email: dto.email.toLowerCase().trim(),
        name: dto.name.trim(),
        password: hashedPassword,
        role: 'USER',
        plan: 'free',
        updatedAt: now,
      },
    });

    const membership = await (this.prisma.team_memberships as any).create({
      data: {
        id: randomUUID(),
        ownerId,
        userId: newUser.id,
        role: dto.role,
        updatedAt: now,
      },
    });

    return {
      membershipId: membership.id,
      userId: newUser.id,
      email: newUser.email,
      name: newUser.name,
      role: membership.role,
      createdAt: membership.createdAt,
    };
  }

  // ─── Update member role ───────────────────────────────────────────────────

  async updateMember(ownerId: string, membershipId: string, dto: UpdateMemberDto) {
    const membership = await (this.prisma.team_memberships as any).findFirst({
      where: { id: membershipId, ownerId },
      include: { member: true },
    });
    if (!membership) throw new NotFoundException('Membro não encontrado');

    const updateData: any = { updatedAt: new Date() };
    if (dto.role) updateData.role = dto.role;

    await (this.prisma.team_memberships as any).update({
      where: { id: membershipId },
      data: updateData,
    });

    // Update member's name/password if provided
    if (dto.name || dto.password) {
      const userUpdate: any = { updatedAt: new Date() };
      if (dto.name) userUpdate.name = dto.name.trim();
      if (dto.password) {
        const salt = await bcrypt.genSalt(10);
        userUpdate.password = await bcrypt.hash(dto.password, salt);
      }
      await (this.prisma.users as any).update({
        where: { id: membership.userId },
        data: userUpdate,
      });
    }

    return { success: true };
  }

  // ─── Remove member ────────────────────────────────────────────────────────

  async removeMember(ownerId: string, membershipId: string) {
    const membership = await (this.prisma.team_memberships as any).findFirst({
      where: { id: membershipId, ownerId },
    });
    if (!membership) throw new NotFoundException('Membro não encontrado');

    await (this.prisma.team_memberships as any).delete({ where: { id: membershipId } });
    return { success: true };
  }

  // ─── Project access ───────────────────────────────────────────────────────

  async getMemberProjects(ownerId: string, membershipId: string) {
    const membership = await (this.prisma.team_memberships as any).findFirst({
      where: { id: membershipId, ownerId },
    });
    if (!membership) throw new NotFoundException('Membro não encontrado');

    // All owner's projects
    const allProjects = await (this.prisma.projects as any).findMany({
      where: { userId: ownerId, deletedAt: null },
      select: { id: true, name: true, domain: true, pixelId: true },
    });

    // Granted project IDs
    const granted = await (this.prisma.project_access as any).findMany({
      where: { membershipId },
      select: { projectId: true, id: true },
    });
    const grantedIds = new Set(granted.map((g: any) => g.projectId));

    return allProjects.map((p: any) => ({
      ...p,
      hasAccess: membership.role === 'admin' || grantedIds.has(p.id),
      accessId: granted.find((g: any) => g.projectId === p.id)?.id ?? null,
    }));
  }

  async grantProjectAccess(ownerId: string, membershipId: string, projectId: string) {
    const membership = await (this.prisma.team_memberships as any).findFirst({
      where: { id: membershipId, ownerId },
    });
    if (!membership) throw new NotFoundException('Membro não encontrado');

    const project = await (this.prisma.projects as any).findFirst({
      where: { id: projectId, userId: ownerId, deletedAt: null },
    });
    if (!project) throw new NotFoundException('Projeto não encontrado');

    // Idempotent
    const existing = await (this.prisma.project_access as any).findUnique({
      where: { membershipId_projectId: { membershipId, projectId } },
    });
    if (existing) return { success: true };

    await (this.prisma.project_access as any).create({
      data: { id: randomUUID(), membershipId, projectId },
    });
    return { success: true };
  }

  async revokeProjectAccess(ownerId: string, membershipId: string, projectId: string) {
    const membership = await (this.prisma.team_memberships as any).findFirst({
      where: { id: membershipId, ownerId },
    });
    if (!membership) throw new NotFoundException('Membro não encontrado');

    await (this.prisma.project_access as any).deleteMany({
      where: { membershipId, projectId },
    });
    return { success: true };
  }

  // ─── Used by AuthService: resolve membership for a user ──────────────────

  async getMembershipForUser(userId: string) {
    return (this.prisma.team_memberships as any).findFirst({
      where: { userId },
      select: { id: true, ownerId: true, role: true },
    });
  }

  // ─── Used by ProjectsService: get allowed project IDs for a member ────────

  async getAllowedProjectIds(membershipId: string, memberRole: string): Promise<string[] | null> {
    // 'admin' gets all projects — return null to indicate "no restriction"
    if (memberRole === 'admin') return null;

    const access = await (this.prisma.project_access as any).findMany({
      where: { membershipId },
      select: { projectId: true },
    });
    return access.map((a: any) => a.projectId);
  }
}
