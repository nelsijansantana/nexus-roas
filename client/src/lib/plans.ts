// Frontend mirror of backend/src/common/plans.config.ts
// Keep in sync with the backend when plan definitions change.

export interface PlanConfig {
  id: string;
  name: string;
  priceMonthly: number;
  priceAnnual: number;   // per month when billed annually (20% off)
  projects: number;      // -1 = unlimited
  salesPerMonth: number; // -1 = unlimited
  dataRetentionDays: number;
  seats: number;         // -1 = unlimited
  popular?: boolean;
  features: string[];
}

export const PLANS: Record<string, PlanConfig> = {
  free: {
    id: "free",
    name: "Free",
    priceMonthly: 0,
    priceAnnual: 0,
    projects: 1,
    salesPerMonth: 30,
    dataRetentionDays: 30,
    seats: 1,
    features: [
      "1 projeto",
      "Até 30 vendas aprovadas/mês",
      "Todas as integrações incluídas",
      "Dashboard básico",
      "30 dias de retenção de dados",
      "Suporte por e-mail (72h)",
    ],
  },
  starter: {
    id: "starter",
    name: "Starter",
    priceMonthly: 97,
    priceAnnual: 77.6,
    projects: 1,
    salesPerMonth: 500,
    dataRetentionDays: 60,
    seats: 1,
    features: [
      "1 projeto",
      "Até 500 vendas aprovadas/mês",
      "Todas as integrações incluídas",
      "Dashboard completo (UTMs, campanhas, métodos)",
      "60 dias de retenção de dados",
      "Suporte por chat (48h)",
      "Trial de 14 dias grátis",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceMonthly: 197,
    priceAnnual: 157.6,
    projects: 3,
    salesPerMonth: 2000,
    dataRetentionDays: 90,
    seats: 1,
    popular: true,
    features: [
      "3 projetos",
      "Até 2.000 vendas aprovadas/mês",
      "Todas as integrações incluídas",
      "Dashboard completo com exportação CSV",
      "90 dias de retenção de dados",
      "Suporte prioritário (24h)",
      "Trial de 14 dias grátis",
    ],
  },
  business: {
    id: "business",
    name: "Business",
    priceMonthly: 397,
    priceAnnual: 317.6,
    projects: 10,
    salesPerMonth: 6000,
    dataRetentionDays: 180,
    seats: 3,
    features: [
      "10 projetos",
      "Até 6.000 vendas aprovadas/mês",
      "Todas as integrações incluídas",
      "180 dias de retenção de dados",
      "3 usuários no time",
      "Acesso à API",
      "Suporte prioritário (12h)",
      "Trial de 14 dias grátis",
    ],
  },
  agency: {
    id: "agency",
    name: "Agency",
    priceMonthly: 797,
    priceAnnual: 637.6,
    projects: -1,
    salesPerMonth: 20000,
    dataRetentionDays: 365,
    seats: -1,
    features: [
      "Projetos ilimitados",
      "Até 20.000 vendas aprovadas/mês",
      "Todas as integrações incluídas",
      "1 ano de retenção de dados",
      "Usuários ilimitados",
      "White label (domínio próprio)",
      "Onboarding dedicado",
      "SLA 99,9% — Suporte dedicado (4h)",
    ],
  },
};

export const PAID_PLANS = Object.values(PLANS).filter(p => p.id !== "free");

export function getPlan(planId: string): PlanConfig {
  return PLANS[planId] ?? PLANS.free;
}

export function formatPrice(value: number): string {
  if (value === 0) return "Grátis";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value);
}
