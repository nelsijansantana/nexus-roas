import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  getDashboardMetrics, getProject, getRevenueOverTime,
  type DashboardMetrics, type ProjectDetail, type RevenueOverTimePoint,
} from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { DateRangePicker, type DateRangeValue } from "@/components/DateRangePicker";
import { startOfDay, subDays, endOfDay, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  DollarSign, ShoppingCart, TrendingUp, ArrowLeft,
  Globe, Loader2, BarChart2 as BarChart2Icon,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
  AreaChart, Area,
} from "recharts";

const PIE_COLORS = [
  "hsl(243, 85%, 67%)",
  "hsl(196, 95%, 62%)",
  "hsl(38, 95%, 58%)",
  "hsl(260, 84%, 74%)",
  "hsl(142, 68%, 45%)",
  "hsl(0, 85%, 65%)",
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-strong rounded-xl px-4 py-3 shadow-card border border-border/60">
      <p className="text-xs text-muted-foreground mb-1 max-w-[200px] truncate">{label}</p>
      <p className="font-display text-base font-semibold">{formatCurrency(payload[0].value)}</p>
      {payload[1] && (
        <p className="text-xs text-muted-foreground">{payload[1].value} vendas</p>
      )}
    </div>
  );
}

function EmptyChart({ message = "Nenhum dado no período" }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-52 text-center gap-2">
      <BarChart2Icon className="h-8 w-8 text-muted-foreground/30" />
      <p className="text-sm text-muted-foreground/60">{message}</p>
    </div>
  );
}

function StatCard({ title, value, sub, icon: Icon, color = "text-primary" }: {
  title: string; value: string; sub?: string;
  icon: React.ElementType; color?: string;
}) {
  return (
    <div className="rounded-2xl border border-border/50 bg-card/30 backdrop-blur-xl shadow-glass p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/70 mb-1">{title}</p>
          <p className={`text-2xl font-bold font-display tracking-tight ${color}`}>{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
        </div>
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className={`h-5 w-5 ${color}`} />
        </div>
      </div>
    </div>
  );
}

function RevenueTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  let displayLabel = label;
  try { displayLabel = format(parseISO(label), "dd/MM", { locale: ptBR }); } catch (_) {}
  return (
    <div className="glass-strong rounded-xl px-4 py-3 shadow-card border border-border/60">
      <p className="text-xs text-muted-foreground mb-1">{displayLabel}</p>
      <p className="font-display text-base font-semibold">{formatCurrency(payload[0].value)}</p>
      {payload[1] && (
        <p className="text-xs text-muted-foreground">{payload[1].value} vendas</p>
      )}
    </div>
  );
}

export default function ProjectDashboard() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const timezone = user?.timezone || "America/Sao_Paulo";

  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [timeSeries, setTimeSeries] = useState<RevenueOverTimePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRangeValue>({
    from: startOfDay(subDays(new Date(), 29)),
    to: endOfDay(new Date()),
  });

  // Load project detail
  useEffect(() => {
    if (!id) return;
    getProject(id).then(setDetail).catch(() => navigate("/projects"));
  }, [id]);

  // Load metrics + time series
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    const params = {
      projectId: id,
      startDate: dateRange.from.toISOString(),
      endDate: dateRange.to.toISOString(),
      timezone,
    };
    Promise.all([
      getDashboardMetrics(params),
      getRevenueOverTime(params),
    ])
      .then(([m, ts]) => {
        setMetrics(m);
        setTimeSeries(ts);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id, dateRange, timezone]);

  const avgTicket = metrics && metrics.purchaseCount > 0
    ? metrics.grossRevenue / metrics.purchaseCount
    : 0;

  const project = detail?.project;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <button
            onClick={() => navigate(`/projects/${id}`)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-3"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Voltar ao projeto
          </button>

          <p className="text-xs font-semibold uppercase tracking-widest text-primary/70 mb-1">Analytics</p>
          <h1 className="font-display text-3xl font-bold text-foreground tracking-tight">
            {project?.name ?? "Carregando..."}
          </h1>
          {project?.domain && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
              <Globe className="h-3.5 w-3.5" />
              {project.domain}
            </div>
          )}
        </div>

        <DateRangePicker value={dateRange} onChange={setDateRange} />
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
          {/* KPI cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              title="Receita Bruta"
              value={formatCurrency(metrics?.grossRevenue ?? 0)}
              icon={DollarSign}
              color="text-emerald-400"
            />
            <StatCard
              title="Total de Vendas"
              value={String(metrics?.purchaseCount ?? 0)}
              sub={`Ticket médio ${formatCurrency(avgTicket)}`}
              icon={ShoppingCart}
              color="text-primary"
            />
            <StatCard
              title="Fontes de Tráfego"
              value={String(metrics?.utmSources?.filter(s => s.source !== "(direct)").length ?? 0)}
              sub="Origens distintas com vendas"
              icon={TrendingUp}
              color="text-amber-400"
            />
          </div>

          {/* Revenue over time */}
          <div className="rounded-2xl border border-border/60 bg-card shadow-card overflow-hidden">
            <div className="px-6 pt-5 pb-4 border-b border-border/40">
              <h3 className="font-display font-semibold text-foreground">Receita por Dia</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Evolução da receita no período selecionado</p>
            </div>
            <div className="p-4">
              {timeSeries.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={timeSeries} margin={{ left: 8, right: 8 }}>
                    <defs>
                      <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(243,85%,67%)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(243,85%,67%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(223,39%,14%)" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: "hsl(215,20%,50%)", fontSize: 11 }}
                      axisLine={false} tickLine={false}
                      tickFormatter={(v) => {
                        try { return format(parseISO(v), "dd/MM", { locale: ptBR }); } catch { return v; }
                      }}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fill: "hsl(215,20%,50%)", fontSize: 11 }}
                      axisLine={false} tickLine={false}
                      tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                      width={52}
                    />
                    <Tooltip content={<RevenueTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="hsl(243,85%,67%)"
                      strokeWidth={2}
                      fill="url(#revenueGrad)"
                      dot={false}
                      activeDot={{ r: 4, fill: "hsl(243,85%,67%)" }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart message="Nenhuma venda no período" />
              )}
            </div>
          </div>

          {/* UTM Source + Campaign charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* UTM Sources */}
            <div className="rounded-2xl border border-border/60 bg-card shadow-card overflow-hidden">
              <div className="px-6 pt-5 pb-4 border-b border-border/40">
                <h3 className="font-display font-semibold text-foreground">Receita por Fonte (utm_source)</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Top fontes de tráfego</p>
              </div>
              <div className="p-4">
                {metrics?.utmSources && metrics.utmSources.length > 0 ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={metrics.utmSources.slice(0, 8)} layout="vertical" margin={{ left: 8 }}>
                      <defs>
                        <linearGradient id="srcGrad" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="hsl(243,85%,67%)" />
                          <stop offset="100%" stopColor="hsl(196,95%,62%)" stopOpacity={0.7} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(223,39%,14%)" horizontal={false} />
                      <XAxis
                        type="number"
                        tick={{ fill: "hsl(215,20%,50%)", fontSize: 11 }}
                        axisLine={false} tickLine={false}
                        tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                      />
                      <YAxis
                        type="category" dataKey="source" width={90}
                        tick={{ fill: "hsl(215,20%,60%)", fontSize: 11 }}
                        axisLine={false} tickLine={false}
                      />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(243,85%,67%,0.04)" }} />
                      <Bar dataKey="totalRevenue" fill="url(#srcGrad)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChart message="Nenhuma fonte com vendas no período" />
                )}
              </div>
            </div>

            {/* UTM Campaigns */}
            <div className="rounded-2xl border border-border/60 bg-card shadow-card overflow-hidden">
              <div className="px-6 pt-5 pb-4 border-b border-border/40">
                <h3 className="font-display font-semibold text-foreground">Receita por Campanha (utm_campaign)</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Top campanhas</p>
              </div>
              <div className="p-4">
                {metrics?.utmCampaigns && metrics.utmCampaigns.filter(c => c.campaign !== "(none)").length > 0 ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart
                      data={metrics.utmCampaigns.filter(c => c.campaign !== "(none)").slice(0, 8)}
                      layout="vertical"
                      margin={{ left: 8 }}
                    >
                      <defs>
                        <linearGradient id="campGrad" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="hsl(38,95%,58%)" />
                          <stop offset="100%" stopColor="hsl(260,84%,74%)" stopOpacity={0.7} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(223,39%,14%)" horizontal={false} />
                      <XAxis
                        type="number"
                        tick={{ fill: "hsl(215,20%,50%)", fontSize: 11 }}
                        axisLine={false} tickLine={false}
                        tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                      />
                      <YAxis
                        type="category" dataKey="campaign" width={100}
                        tick={{ fill: "hsl(215,20%,60%)", fontSize: 11 }}
                        axisLine={false} tickLine={false}
                      />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(38,95%,58%,0.04)" }} />
                      <Bar dataKey="totalRevenue" fill="url(#campGrad)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChart message="Nenhuma campanha com vendas no período" />
                )}
              </div>
            </div>
          </div>

          {/* Payment methods + UTM source table side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Payment methods */}
            {metrics?.paymentMethods && metrics.paymentMethods.length > 0 && (
              <div className="rounded-2xl border border-border/60 bg-card shadow-card overflow-hidden">
                <div className="px-6 pt-5 pb-4 border-b border-border/40 flex items-center justify-between">
                  <h3 className="font-display font-semibold text-foreground">Métodos de Pagamento</h3>
                  <div className="h-5 w-5">
                    <PieChart width={20} height={20}>
                      <Pie data={[{ v: 1 }]} dataKey="v" cx="50%" cy="50%" outerRadius={10}>
                        <Cell fill="hsl(243,85%,67%)" />
                      </Pie>
                    </PieChart>
                  </div>
                </div>
                <div className="divide-y divide-border/40">
                  {metrics.paymentMethods.map((pm, i) => {
                    const share = metrics.purchaseCount > 0 ? pm.count / metrics.purchaseCount : 0;
                    return (
                      <div key={pm.method} className="flex items-center gap-4 px-6 py-3.5 hover:bg-muted/20 transition-colors">
                        <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium capitalize">{pm.method}</p>
                          <div className="mt-1 h-1 w-full rounded-full bg-muted/30 overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${(share * 100).toFixed(0)}%`, background: PIE_COLORS[i % PIE_COLORS.length] }} />
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-semibold">{formatCurrency(pm.totalRevenue)}</p>
                          <p className="text-xs text-muted-foreground">{pm.count} vendas</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* UTM source table */}
            {metrics?.utmSources && metrics.utmSources.length > 0 && (
              <div className="rounded-2xl border border-border/60 bg-card shadow-card overflow-hidden">
                <div className="px-6 pt-5 pb-4 border-b border-border/40">
                  <h3 className="font-display font-semibold text-foreground">Fontes de Tráfego</h3>
                </div>
                <div className="divide-y divide-border/40">
                  {metrics.utmSources.slice(0, 8).map((s, i) => {
                    const maxRevenue = metrics.utmSources[0].totalRevenue;
                    const share = maxRevenue > 0 ? s.totalRevenue / maxRevenue : 0;
                    return (
                      <div key={s.source} className="flex items-center gap-4 px-6 py-3.5 hover:bg-muted/20 transition-colors">
                        <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{s.source}</p>
                          <div className="mt-1 h-1 w-full rounded-full bg-muted/30 overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${(share * 100).toFixed(0)}%`, background: PIE_COLORS[i % PIE_COLORS.length] }} />
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-semibold">{formatCurrency(s.totalRevenue)}</p>
                          <p className="text-xs text-muted-foreground">{s.count} vendas</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
