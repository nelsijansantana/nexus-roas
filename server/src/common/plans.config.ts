/**
 * Central plan configuration for Nexus ROAS.
 *
 * This is the single source of truth for plan limits, prices, and names.
 * All billing checks, admin UI, and limit enforcement should reference this.
 *
 * Limits:
 *   projects:      max active projects (-1 = unlimited)
 *   salesPerMonth: max approved purchase events per billing month (-1 = unlimited)
 *   dataRetention: days of ClickHouse data retained
 *
 * Integrations (Meta CAPI, TikTok CAPI, CartPanda, Shopify, Yampi, etc.)
 * are UNLIMITED on all plans — never restricted.
 */

export interface PlanConfig {
  id: string;
  name: string;
  priceMonthly: number; // BRL
  priceAnnual: number; // BRL/month when billed annually (20% off)
  projects: number; // -1 = unlimited
  salesPerMonth: number; // -1 = unlimited
  dataRetentionDays: number;
  seats: number; // max team members (-1 = unlimited)
  overagePricePer: number; // BRL per sale over the limit (0 = blocked/no overage)
  features: string[]; // marketing bullet points
}

export const PLANS: Record<string, PlanConfig> = {
  free: {
    id: 'free',
    name: 'Free',
    priceMonthly: 0,
    priceAnnual: 0,
    projects: 1,
    salesPerMonth: 30,
    dataRetentionDays: 30,
    seats: 1,
    overagePricePer: 0,
    features: [
      '1 projeto',
      'Até 30 vendas aprovadas/mês',
      'Todas as integrações incluídas',
      'Dashboard básico',
      '30 dias de retenção de dados',
      'Suporte por e-mail (72h)',
    ],
  },

  starter: {
    id: 'starter',
    name: 'Starter',
    priceMonthly: 97,
    priceAnnual: 77.6,
    projects: 1,
    salesPerMonth: 500,
    dataRetentionDays: 60,
    seats: 1,
    overagePricePer: 0.15,
    features: [
      '1 projeto',
      'Até 500 vendas aprovadas/mês',
      'Todas as integrações incluídas',
      'Dashboard completo (UTMs, campanhas, métodos)',
      '60 dias de retenção de dados',
      'Suporte por chat (48h)',
      'Trial 14 dias grátis',
    ],
  },

  pro: {
    id: 'pro',
    name: 'Pro',
    priceMonthly: 197,
    priceAnnual: 157.6,
    projects: 3,
    salesPerMonth: 2000,
    dataRetentionDays: 90,
    seats: 1,
    overagePricePer: 0.1,
    features: [
      '3 projetos',
      'Até 2.000 vendas aprovadas/mês',
      'Todas as integrações incluídas',
      'Dashboard completo com exportação CSV',
      '90 dias de retenção de dados',
      'Suporte prioritário (24h)',
      'Trial 14 dias grátis',
    ],
  },

  business: {
    id: 'business',
    name: 'Business',
    priceMonthly: 397,
    priceAnnual: 317.6,
    projects: 10,
    salesPerMonth: 6000,
    dataRetentionDays: 180,
    seats: 3,
    overagePricePer: 0.07,
    features: [
      '10 projetos',
      'Até 6.000 vendas aprovadas/mês',
      'Todas as integrações incluídas',
      '180 dias de retenção de dados',
      '3 usuários (seats)',
      'Acesso à API',
      'Suporte prioritário (12h)',
      'Trial 14 dias grátis',
    ],
  },

  agency: {
    id: 'agency',
    name: 'Agency',
    priceMonthly: 797,
    priceAnnual: 637.6,
    projects: -1,
    salesPerMonth: 20000,
    dataRetentionDays: 365,
    seats: -1,
    overagePricePer: 0.04,
    features: [
      'Projetos ilimitados',
      'Até 20.000 vendas aprovadas/mês',
      'Todas as integrações incluídas',
      '1 ano de retenção de dados',
      'Usuários ilimitados',
      'White label (domínio próprio)',
      'Onboarding dedicado',
      'SLA 99,9%',
      'Suporte dedicado (4h)',
    ],
  },
};

export const PLAN_IDS = Object.keys(PLANS);

export function getPlan(planId: string): PlanConfig {
  return PLANS[planId] ?? PLANS.free;
}

/**
 * Check if a user on the given plan can create another project.
 * @param plan user's current plan id
 * @param currentProjectCount number of active (non-deleted) projects
 */
export function canCreateProject(
  plan: string,
  currentProjectCount: number,
): boolean {
  const config = getPlan(plan);
  if (config.projects === -1) return true;
  return currentProjectCount < config.projects;
}

/**
 * Check if a user on the given plan can process another sale this month.
 * Returns true (allow) even if over limit — overage is billed, not blocked,
 * EXCEPT on the free plan which has no overage pricing.
 */
export function isSaleAllowed(plan: string, salesThisMonth: number): boolean {
  const config = getPlan(plan);
  if (config.salesPerMonth === -1) return true;
  // Free plan: hard cap (no overage)
  if (plan === 'free' && salesThisMonth >= config.salesPerMonth) return false;
  // Paid plans: always allow, overage billed at next cycle
  return true;
}
