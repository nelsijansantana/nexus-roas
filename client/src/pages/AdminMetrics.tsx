import { useEffect, useState } from "react";
import { adminGetMetrics, type AdminMetrics } from "@/lib/api";
import {
  TrendingUp,
  TrendingDown,
  Users,
  DollarSign,
  ShoppingCart,
  Activity,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const PLAN_COLORS: Record<string, { bar: string; text: string; bg: string }> = {
  free:     { bar: "bg-slate-500",   text: "text-slate-400",   bg: "bg-slate-500/10" },
  starter:  { bar: "bg-blue-500",    text: "text-blue-400",    bg: "bg-blue-500/10" },
  pro:      { bar: "bg-violet-500",  text: "text-violet-400",  bg: "bg-violet-500/10" },
  business: { bar: "bg-amber-500",   text: "text-amber-400",   bg: "bg-amber-500/10" },
  agency:   { bar: "bg-emerald-500", text: "text-emerald-400", bg: "bg-emerald-500/10" },
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: { value: number; label: string };
  accent?: string;
}

function StatCard({ title, value, subtitle, icon, trend, accent = "text-primary" }: StatCardProps) {
  return (
    <div className="relative rounded-2xl border border-border/50 bg-card/30 backdrop-blur-xl shadow-glass p-5 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/3 to-transparent pointer-events-none" />
      <div className="flex items-start justify-between gap-4 relative">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/70 mb-1">{title}</p>
          <p className={cn("text-2xl font-bold font-display tracking-tight", accent)}>{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          {trend !== undefined && (
            <div className={cn(
              "inline-flex items-center gap-1 mt-2 text-xs font-semibold",
              trend.value >= 0 ? "text-emerald-400" : "text-red-400"
            )}>
              {trend.value >= 0
                ? <TrendingUp className="h-3 w-3" />
                : <TrendingDown className="h-3 w-3" />}
              {trend.value >= 0 ? "+" : ""}{trend.value.toFixed(1)}% {trend.label}
            </div>
          )}
        </div>
        <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center shrink-0", "bg-primary/10")}>
          <span className={accent}>{icon}</span>
        </div>
      </div>
    </div>
  );
}

export default function AdminMetrics() {
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await adminGetMetrics();
      setMetrics(data);
    } catch (err: any) {
      toast.error("Erro ao carregar métricas: " + err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  const maxPlanCount = metrics
    ? Math.max(...metrics.planDistribution.map((p) => p.count), 1)
    : 1;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary/70 mb-1">Super Admin</p>
          <h1 className="font-display text-3xl font-bold text-foreground tracking-tight">Métricas do Negócio</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Visão geral de crescimento, receita e uso da plataforma.
          </p>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 h-10 rounded-xl text-sm font-medium border border-border/50 bg-card/30 hover:bg-card/60 transition-all disabled:opacity-50"
        >
          <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
          Atualizar
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      ) : metrics ? (
        <>
          {/* KPI Cards — linha 1: receita */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="MRR"
              value={formatCurrency(metrics.revenue.mrr)}
              subtitle="Receita recorrente mensal"
              icon={<DollarSign className="h-5 w-5" />}
              trend={{ value: metrics.revenue.mrrGrowth, label: "vs. mês anterior" }}
              accent="text-emerald-400"
            />
            <StatCard
              title="ARR"
              value={formatCurrency(metrics.revenue.arr)}
              subtitle="Receita anual recorrente"
              icon={<TrendingUp className="h-5 w-5" />}
              accent="text-primary"
            />
            <StatCard
              title="Vendas este mês"
              value={formatNumber(metrics.salesProcessed.thisMonth)}
              subtitle={formatCurrency(metrics.salesProcessed.revenueThisMonth) + " processados"}
              icon={<ShoppingCart className="h-5 w-5" />}
              accent="text-amber-400"
            />
            <StatCard
              title="Vendas totais"
              value={formatNumber(metrics.salesProcessed.allTime)}
              subtitle={formatCurrency(metrics.salesProcessed.revenueAllTime) + " histórico"}
              icon={<ShoppingCart className="h-5 w-5" />}
            />
          </div>

          {/* KPI Cards — linha 2: clientes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <StatCard
              title="Total de clientes"
              value={formatNumber(metrics.customers.total)}
              subtitle={`+${metrics.customers.newThisMonth} este mês`}
              icon={<Users className="h-5 w-5" />}
              trend={{
                value: metrics.customers.newLastMonth > 0
                  ? ((metrics.customers.newThisMonth - metrics.customers.newLastMonth) / metrics.customers.newLastMonth) * 100
                  : 0,
                label: "novos vs. mês anterior"
              }}
            />
            <StatCard
              title="Novos este mês"
              value={formatNumber(metrics.customers.newThisMonth)}
              subtitle={`${metrics.customers.newLastMonth} no mês anterior`}
              icon={<Users className="h-5 w-5" />}
              accent="text-blue-400"
            />
            <StatCard
              title="Usuários ativos"
              value={formatNumber(metrics.customers.activeUsers)}
              subtitle="Com evento nos últimos 30 dias"
              icon={<Activity className="h-5 w-5" />}
              accent="text-violet-400"
            />
          </div>

          {/* Plan Distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Bar chart */}
            <div className="rounded-2xl border border-border/50 bg-card/30 backdrop-blur-xl shadow-glass p-6">
              <h2 className="text-sm font-semibold text-foreground mb-5">Distribuição por Plano</h2>
              <div className="space-y-4">
                {metrics.planDistribution.map((p) => {
                  const colors = PLAN_COLORS[p.plan] ?? PLAN_COLORS.free;
                  const pct = Math.round((p.count / maxPlanCount) * 100);
                  return (
                    <div key={p.plan} className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className={cn("h-2.5 w-2.5 rounded-full", colors.bar)} />
                          <span className="font-medium capitalize">{p.name}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>{p.count} usuários</span>
                          <span className={cn("font-semibold", colors.text)}>
                            {formatCurrency(p.monthlyRevenue)}/mês
                          </span>
                        </div>
                      </div>
                      <div className="h-2 rounded-full bg-muted/30 overflow-hidden">
                        <div
                          className={cn("h-full rounded-full transition-all duration-700", colors.bar)}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Revenue breakdown */}
            <div className="rounded-2xl border border-border/50 bg-card/30 backdrop-blur-xl shadow-glass p-6">
              <h2 className="text-sm font-semibold text-foreground mb-5">Receita por Plano</h2>
              <div className="space-y-3">
                {metrics.planDistribution
                  .filter((p) => p.monthlyRevenue > 0)
                  .sort((a, b) => b.monthlyRevenue - a.monthlyRevenue)
                  .map((p) => {
                    const colors = PLAN_COLORS[p.plan] ?? PLAN_COLORS.free;
                    const pct = metrics.revenue.mrr > 0
                      ? Math.round((p.monthlyRevenue / metrics.revenue.mrr) * 100)
                      : 0;
                    return (
                      <div key={p.plan} className={cn("flex items-center justify-between p-3 rounded-xl border", colors.bg, "border-border/20")}>
                        <div className="flex items-center gap-2">
                          <span className={cn("text-xs font-bold uppercase", colors.text)}>{p.name}</span>
                          <span className="text-xs text-muted-foreground">{p.count}×</span>
                        </div>
                        <div className="text-right">
                          <p className={cn("text-sm font-bold", colors.text)}>{formatCurrency(p.monthlyRevenue)}</p>
                          <p className="text-[10px] text-muted-foreground">{pct}% do MRR</p>
                        </div>
                      </div>
                    );
                  })}
                {metrics.planDistribution.every((p) => p.monthlyRevenue === 0) && (
                  <p className="text-sm text-muted-foreground text-center py-6 italic">
                    Nenhuma receita gerada ainda.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* MRR summary */}
          <div className="rounded-2xl border border-border/50 bg-card/30 backdrop-blur-xl shadow-glass p-6">
            <h2 className="text-sm font-semibold text-foreground mb-4">Resumo Financeiro</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "MRR atual",        value: formatCurrency(metrics.revenue.mrr),         sub: "Receita mensal recorrente" },
                { label: "MRR mês anterior", value: formatCurrency(metrics.revenue.mrrLastMonth), sub: "Aproximado" },
                { label: "Crescimento MRR",  value: (metrics.revenue.mrrGrowth >= 0 ? "+" : "") + metrics.revenue.mrrGrowth.toFixed(1) + "%", sub: "Variação mensal" },
                { label: "ARR projetado",    value: formatCurrency(metrics.revenue.arr),          sub: "12× MRR atual" },
              ].map((item) => (
                <div key={item.label} className="text-center space-y-1">
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className="text-xl font-bold font-display text-foreground">{item.value}</p>
                  <p className="text-[10px] text-muted-foreground/60">{item.sub}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
