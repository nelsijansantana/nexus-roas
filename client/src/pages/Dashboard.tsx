import { useEffect, useState } from "react";
import { getDashboardMetrics, getProjects, type DashboardMetrics, type Project } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateRangePicker, type DateRangeValue } from "@/components/DateRangePicker";
import { startOfDay, subDays, endOfDay } from "date-fns";
import {
  DollarSign, ShoppingCart, TrendingUp, CreditCard,
  Loader2, ArrowUpRight,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";

// ── Palette ──────────────────────────────────────────────────────────────────
const PIE_COLORS = [
  "hsl(243, 85%, 67%)",
  "hsl(196, 95%, 62%)",
  "hsl(38, 95%, 58%)",
  "hsl(260, 84%, 74%)",
  "hsl(142, 68%, 45%)",
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

// ── Metric Card ───────────────────────────────────────────────────────────────
interface MetricCardProps {
  title: string;
  value: string;
  icon: React.ElementType;
  gradient: string;
  iconColor: string;
  delay?: number;
  trend?: string;
}

function MetricCard({ title, value, icon: Icon, gradient, iconColor, delay = 0, trend }: MetricCardProps) {
  return (
    <div
      className="relative rounded-2xl border border-border/60 bg-card overflow-hidden shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-300 animate-fade-in"
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Subtle gradient top bar */}
      <div className={`absolute inset-x-0 top-0 h-px ${gradient} opacity-60`} />

      {/* Content */}
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className={`h-10 w-10 rounded-xl ${gradient} flex items-center justify-center shadow-glow-sm`}>
            <Icon className="h-5 w-5 text-white" />
          </div>
          {trend && (
            <div className="flex items-center gap-1 text-success text-xs font-medium">
              <ArrowUpRight className="h-3 w-3" />
              {trend}
            </div>
          )}
        </div>
        <p className="text-sm text-muted-foreground font-medium mb-1">{title}</p>
        <p className="font-display text-2xl font-bold text-foreground tracking-tight animate-number-pop">
          {value}
        </p>
      </div>

      {/* Ambient glow */}
      <div className={`pointer-events-none absolute -bottom-6 -right-6 h-20 w-20 rounded-full ${gradient} opacity-8 blur-2xl`} />
    </div>
  );
}

// ── Custom Tooltip ─────────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-strong rounded-xl px-4 py-3 shadow-card border border-border/60">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="font-display text-base font-semibold text-foreground">
        {formatCurrency(payload[0].value)}
      </p>
    </div>
  );
}

function PieTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-strong rounded-xl px-4 py-3 shadow-card border border-border/60">
      <p className="text-xs text-muted-foreground mb-1">{payload[0].name}</p>
      <p className="font-display text-base font-semibold text-foreground">
        {payload[0].value} vendas
      </p>
    </div>
  );
}

// ── Empty State ────────────────────────────────────────────────────────────────
function EmptyChart() {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-center">
      <div className="h-12 w-12 rounded-full bg-muted/40 flex items-center justify-center mb-3">
        <BarChart2Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium text-muted-foreground">Nenhum dado disponível</p>
      <p className="text-xs text-muted-foreground/60 mt-0.5">Aguardando vendas no período</p>
    </div>
  );
}

function BarChart2Icon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} {...props}>
      <rect x="3" y="12" width="4" height="9" rx="1" />
      <rect x="10" y="7" width="4" height="14" rx="1" />
      <rect x="17" y="4" width="4" height="17" rx="1" />
    </svg>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("all");
  const [dateRange, setDateRange] = useState<DateRangeValue>({
    from: startOfDay(subDays(new Date(), 29)),
    to: endOfDay(new Date()),
  });
  const [loading, setLoading] = useState(true);

  const timezone = user?.timezone || "America/Sao_Paulo";

  useEffect(() => {
    getProjects().then(setProjects).catch(console.error);
  }, []);

  useEffect(() => {
    setLoading(true);
    getDashboardMetrics({
      projectId: selectedProject === "all" ? undefined : selectedProject,
      startDate: dateRange.from.toISOString(),
      endDate: dateRange.to.toISOString(),
      timezone,
    })
      .then(setMetrics)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedProject, dateRange, timezone]);

  const avgTicket =
    metrics && metrics.purchaseCount > 0 ? metrics.grossRevenue / metrics.purchaseCount : 0;

  return (
    <div className="space-y-8">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 animate-fade-in">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary/70 mb-1">
            Visão Geral
          </p>
          <h1 className="font-display text-3xl font-bold text-foreground tracking-tight">
            Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Receitas e conversões consolidadas
          </p>
        </div>

        <div className="flex gap-2">
          <Select value={selectedProject} onValueChange={setSelectedProject}>
            <SelectTrigger className="w-[180px] h-9 bg-muted/50 border-border/60 text-sm">
              <SelectValue placeholder="Projeto" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="all">Todos os projetos</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <DateRangePicker value={dateRange} onChange={setDateRange} />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-32">
          <div className="flex flex-col items-center gap-4">
            <div className="relative h-12 w-12">
              <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
              <div className="relative h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">Carregando métricas...</p>
          </div>
        </div>
      ) : (
        <>
          {/* ── Metric Cards ──────────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Receita Bruta"
              value={formatCurrency(metrics?.grossRevenue ?? 0)}
              icon={DollarSign}
              gradient="bg-gradient-primary"
              iconColor="text-primary"
              delay={0}
            />
            <MetricCard
              title="Total de Vendas"
              value={String(metrics?.purchaseCount ?? 0)}
              icon={ShoppingCart}
              gradient="bg-gradient-accent"
              iconColor="text-accent"
              delay={80}
            />
            <MetricCard
              title="Ticket Médio"
              value={formatCurrency(avgTicket)}
              icon={TrendingUp}
              gradient="bg-gradient-warm"
              iconColor="text-warning"
              delay={160}
            />
            <MetricCard
              title="Métodos de Pagamento"
              value={String(metrics?.paymentMethods?.length ?? 0)}
              icon={CreditCard}
              gradient="bg-gradient-emerald"
              iconColor="text-success"
              delay={240}
            />
          </div>

          {/* ── Charts ───────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Bar Chart — takes 3/5 columns */}
            <div
              className="lg:col-span-3 rounded-2xl border border-border/60 bg-card shadow-card overflow-hidden animate-fade-in"
              style={{ animationDelay: "320ms" }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border/40">
                <div>
                  <h3 className="font-display font-semibold text-foreground">
                    Receita por Método de Pagamento
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Valor total por gateway
                  </p>
                </div>
              </div>

              <div className="px-4 py-4">
                {metrics?.paymentMethods && metrics.paymentMethods.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={metrics.paymentMethods} barCategoryGap="30%">
                      <defs>
                        <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(243, 85%, 67%)" />
                          <stop offset="100%" stopColor="hsl(260, 84%, 74%)" stopOpacity={0.6} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="hsl(223, 39%, 14%)"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="method"
                        tick={{ fill: "hsl(215, 20%, 50%)", fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fill: "hsl(215, 20%, 50%)", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                      />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(243, 85%, 67%, 0.05)" }} />
                      <Bar
                        dataKey="totalRevenue"
                        fill="url(#barGradient)"
                        radius={[6, 6, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChart />
                )}
              </div>
            </div>

            {/* Pie Chart — takes 2/5 columns */}
            <div
              className="lg:col-span-2 rounded-2xl border border-border/60 bg-card shadow-card overflow-hidden animate-fade-in"
              style={{ animationDelay: "400ms" }}
            >
              <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border/40">
                <div>
                  <h3 className="font-display font-semibold text-foreground">
                    Distribuição de Vendas
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Por quantidade de pedidos
                  </p>
                </div>
              </div>

              <div className="px-4 py-4">
                {metrics?.paymentMethods && metrics.paymentMethods.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={metrics.paymentMethods}
                        dataKey="count"
                        nameKey="method"
                        cx="50%"
                        cy="45%"
                        outerRadius={88}
                        innerRadius={52}
                        strokeWidth={2}
                        stroke="hsl(224, 71%, 4%)"
                      >
                        {metrics.paymentMethods.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<PieTooltip />} />
                      <Legend
                        iconType="circle"
                        iconSize={8}
                        formatter={(value) => (
                          <span className="text-xs text-muted-foreground">{value}</span>
                        )}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChart />
                )}
              </div>
            </div>
          </div>

          {/* ── Payment breakdown table ──────────────────────────────── */}
          {metrics?.paymentMethods && metrics.paymentMethods.length > 0 && (
            <div
              className="rounded-2xl border border-border/60 bg-card shadow-card overflow-hidden animate-fade-in"
              style={{ animationDelay: "480ms" }}
            >
              <div className="px-6 pt-6 pb-4 border-b border-border/40">
                <h3 className="font-display font-semibold text-foreground">
                  Breakdown por Gateway
                </h3>
              </div>
              <div className="divide-y divide-border/40">
                {metrics.paymentMethods.map((pm, i) => {
                  const share = metrics.purchaseCount > 0 ? pm.count / metrics.purchaseCount : 0;
                  return (
                    <div key={pm.method} className="flex items-center gap-4 px-6 py-4 hover:bg-muted/20 transition-colors">
                      <div
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground capitalize">{pm.method}</p>
                        <div className="mt-1.5 h-1 w-full rounded-full bg-muted/40 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{
                              width: `${(share * 100).toFixed(0)}%`,
                              background: PIE_COLORS[i % PIE_COLORS.length],
                            }}
                          />
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold text-foreground">{formatCurrency(pm.totalRevenue)}</p>
                        <p className="text-xs text-muted-foreground">{pm.count} vendas</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
