import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ClickHouseService } from '../clickhouse/clickhouse.service';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { AdminCreateUserDto, AdminUpdateUserDto } from '../users/dto/admin-user.dto';
import { PLANS, getPlan } from '../common/plans.config';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clickhouse: ClickHouseService,
  ) {}

  async listUsers() {
    const users = await (this.prisma.users as any).findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { projects: { where: { deletedAt: null } } },
        },
      },
    });

    return (users as any[]).map(u => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      plan: u.plan ?? 'free',
      planStartDate: u.planStartDate ?? null,
      createdAt: u.createdAt,
      projectsCount: u._count.projects,
    }));
  }

  async createUser(dto: AdminCreateUserDto) {
    const existing = await (this.prisma.users as any).findUnique({
      where: { email: dto.email.toLowerCase().trim() },
    });

    if (existing) {
      throw new ConflictException('Este e-mail já está cadastrado');
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(dto.password, salt);
    const now = new Date();

    const user = await (this.prisma.users as any).create({
      data: {
        id: randomUUID(),
        email: dto.email.toLowerCase().trim(),
        name: dto.name.trim(),
        password: hashedPassword,
        role: dto.role || 'USER',
        plan: (dto as any).plan || 'free',
        planStartDate: (dto as any).plan && (dto as any).plan !== 'free' ? now : null,
        updatedAt: now,
      },
    });

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      plan: user.plan,
    };
  }

  async updateUser(id: string, dto: AdminUpdateUserDto) {
    const user = await (this.prisma.users as any).findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Usuário não encontrado');

    const data: any = { ...dto, updatedAt: new Date() };

    if (dto.password) {
      const salt = await bcrypt.genSalt(10);
      data.password = await bcrypt.hash(dto.password, salt);
    }

    if (dto.email) {
      data.email = dto.email.toLowerCase().trim();
    }

    // When upgrading plan, set planStartDate to today
    if ((dto as any).plan && (dto as any).plan !== user.plan) {
      data.plan = (dto as any).plan;
      data.planStartDate = new Date();
    }

    const updated = await (this.prisma.users as any).update({
      where: { id },
      data,
    });

    return {
      id: updated.id,
      email: updated.email,
      name: updated.name,
      role: updated.role,
      plan: updated.plan,
      planStartDate: updated.planStartDate,
    };
  }

  async deleteUser(id: string) {
    const user = await (this.prisma.users as any).findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Usuário não encontrado');

    if (user.role === 'SUPER_ADMIN') {
      throw new ConflictException('Não é possível deletar um Super Admin');
    }

    await this.prisma.users.delete({ where: { id } });
    return { success: true };
  }

  // ─── Business metrics ──────────────────────────────────────────────────────

  async getMetrics() {
    const now = new Date();

    // ── Users ──────────────────────────────────────────────────────────────
    const allUsers = await (this.prisma.users as any).findMany({
      select: { id: true, plan: true, role: true, createdAt: true },
    });

    const usersByPlan: Record<string, number> = {};
    for (const planId of Object.keys(PLANS)) {
      usersByPlan[planId] = 0;
    }
    for (const u of allUsers) {
      const planId = u.plan ?? 'free';
      if (u.role === 'SUPER_ADMIN') continue; // exclude internal admins from metrics
      usersByPlan[planId] = (usersByPlan[planId] ?? 0) + 1;
    }

    const totalCustomers = allUsers.filter((u: any) => u.role !== 'SUPER_ADMIN').length;

    // New customers this month
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const newThisMonth = allUsers.filter(
      (u: any) => u.role !== 'SUPER_ADMIN' && new Date(u.createdAt) >= monthStart,
    ).length;

    // New customers last month (for comparison)
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 1);
    const newLastMonth = allUsers.filter(
      (u: any) =>
        u.role !== 'SUPER_ADMIN' &&
        new Date(u.createdAt) >= lastMonthStart &&
        new Date(u.createdAt) < lastMonthEnd,
    ).length;

    // ── Revenue (MRR / ARR) ────────────────────────────────────────────────
    // MRR = sum of monthly price for each paying user
    let mrr = 0;
    for (const u of allUsers) {
      if (u.role === 'SUPER_ADMIN') continue;
      const plan = getPlan(u.plan ?? 'free');
      mrr += plan.priceMonthly;
    }
    const arr = mrr * 12;

    // MRR last month snapshot (approximate: same calculation but for users created before this month)
    let mrrLastMonth = 0;
    for (const u of allUsers) {
      if (u.role === 'SUPER_ADMIN') continue;
      if (new Date(u.createdAt) >= monthStart) continue; // exclude new this month
      const plan = getPlan(u.plan ?? 'free');
      mrrLastMonth += plan.priceMonthly;
    }

    // ── Sales processed (ClickHouse) ──────────────────────────────────────
    const thirtyDaysAgo = Math.floor(now.getTime() / 1000) - 30 * 86400;
    const thisMonthUnix = Math.floor(monthStart.getTime() / 1000);

    const [salesAllTime, salesThisMonth, revenueAllTime, revenueThisMonth] = await Promise.all([
      this.clickhouse
        .query<{ total: string }>(
          `SELECT count() AS total FROM events WHERE event_type = 'Purchase'`,
          {},
        )
        .then(r => parseInt(r[0]?.total ?? '0', 10))
        .catch(() => 0),

      this.clickhouse
        .query<{ total: string }>(
          `SELECT count() AS total FROM events WHERE event_type = 'Purchase' AND event_time >= {since:UInt32}`,
          { since: thisMonthUnix },
        )
        .then(r => parseInt(r[0]?.total ?? '0', 10))
        .catch(() => 0),

      this.clickhouse
        .query<{ total: string }>(
          `SELECT round(sum(value), 2) AS total FROM events WHERE event_type = 'Purchase'`,
          {},
        )
        .then(r => parseFloat(r[0]?.total ?? '0'))
        .catch(() => 0),

      this.clickhouse
        .query<{ total: string }>(
          `SELECT round(sum(value), 2) AS total FROM events WHERE event_type = 'Purchase' AND event_time >= {since:UInt32}`,
          { since: thisMonthUnix },
        )
        .then(r => parseFloat(r[0]?.total ?? '0'))
        .catch(() => 0),
    ]);

    // ── Active users (had at least 1 event in last 30 days) ───────────────
    const activePixelIds = await this.clickhouse
      .query<{ pixel_id: string }>(
        `SELECT DISTINCT pixel_id FROM events WHERE event_time >= {since:UInt32}`,
        { since: thirtyDaysAgo },
      )
      .then(r => r.map(x => x.pixel_id))
      .catch(() => [] as string[]);

    const activeUserIds = await this.prisma.projects
      .findMany({
        where: { pixelId: { in: activePixelIds }, deletedAt: null },
        select: { userId: true },
        distinct: ['userId'],
      })
      .then(r => r.length);

    // ── Plan distribution for charts ──────────────────────────────────────
    const planDistribution = Object.entries(usersByPlan).map(([planId, count]) => ({
      plan: planId,
      name: PLANS[planId]?.name ?? planId,
      count,
      monthlyRevenue: count * (PLANS[planId]?.priceMonthly ?? 0),
    }));

    return {
      customers: {
        total: totalCustomers,
        newThisMonth,
        newLastMonth,
        activeUsers: activeUserIds,
        byPlan: usersByPlan,
      },
      revenue: {
        mrr,
        arr,
        mrrLastMonth,
        mrrGrowth: mrrLastMonth > 0 ? ((mrr - mrrLastMonth) / mrrLastMonth) * 100 : 0,
      },
      salesProcessed: {
        allTime: salesAllTime,
        thisMonth: salesThisMonth,
        revenueAllTime,
        revenueThisMonth,
        currency: 'BRL',
      },
      planDistribution,
    };
  }

  async getUserConsumption(userId: string) {
    const user = await (this.prisma.users as any).findUnique({
      where: { id: userId },
      include: {
        _count: { select: { projects: { where: { deletedAt: null } } } },
      },
    });
    if (!user) throw new NotFoundException('Usuário não encontrado');

    const plan = getPlan(user.plan ?? 'free');
    const planStart = user.planStartDate ? new Date(user.planStartDate) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    const billingDay = planStart.getDate();
    const now = new Date();
    const billingMonthStart = new Date(now.getFullYear(), now.getMonth(), billingDay);
    if (billingMonthStart > now) billingMonthStart.setMonth(billingMonthStart.getMonth() - 1);
    const billingStartUnix = Math.floor(billingMonthStart.getTime() / 1000);

    const userProjects = await this.prisma.projects.findMany({
      where: { userId, deletedAt: null },
      select: { pixelId: true, name: true, domain: true },
    });
    const pixelIds = userProjects.map(p => p.pixelId);

    const salesThisMonth = pixelIds.length > 0
      ? await this.clickhouse
          .query<{ total: string }>(
            `SELECT count() AS total FROM events
             WHERE pixel_id IN {pixelIds:Array(String)}
               AND event_type = 'Purchase'
               AND event_time >= {since:UInt32}`,
            { pixelIds, since: billingStartUnix },
          )
          .then(r => parseInt(r[0]?.total ?? '0', 10))
          .catch(() => 0)
      : 0;

    const isOverLimit = plan.salesPerMonth > 0 && salesThisMonth > plan.salesPerMonth;
    const overageCount = isOverLimit ? salesThisMonth - plan.salesPerMonth : 0;
    const overageAmount = overageCount * plan.overagePricePer;

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        plan: user.plan ?? 'free',
        planName: plan.name,
        planStartDate: user.planStartDate,
      },
      usage: {
        projectsUsed: user._count.projects,
        projectsLimit: plan.projects,
        salesThisMonth,
        salesLimit: plan.salesPerMonth,
        percentUsed: plan.salesPerMonth > 0 ? Math.round((salesThisMonth / plan.salesPerMonth) * 100) : 0,
        isOverLimit,
        overageCount,
        overageAmount,
      },
      billingCycle: {
        start: billingMonthStart,
        end: new Date(billingMonthStart.getFullYear(), billingMonthStart.getMonth() + 1, billingDay),
      },
    };
  }
}
