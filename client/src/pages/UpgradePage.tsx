import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { getBillingConfig, createCheckout, type PublicBillingConfig } from "@/lib/api";
import { PLANS, formatPrice } from "@/lib/plans";
import { Check, Loader2, Zap, Star, ArrowLeft, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const PLAN_ORDER = ["free", "starter", "pro", "business", "agency"];

export default function UpgradePage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [billingCfg, setBillingCfg] = useState<PublicBillingConfig | null>(null);
  const [annual, setAnnual] = useState(searchParams.get("interval") === "annual");
  const [selectedPlan, setSelectedPlan] = useState<string>(searchParams.get("plan") ?? "pro");
  const [loadingCheckout, setLoadingCheckout] = useState<string | null>(null);
  const [configLoading, setConfigLoading] = useState(true);

  useEffect(() => {
    getBillingConfig()
      .then(setBillingCfg)
      .catch(() => setBillingCfg({ active: "none", trialDays: 14 }))
      .finally(() => setConfigLoading(false));
  }, []);

  const currentPlan = (user as any)?.plan ?? "free";

  const handleCheckout = async (planId: string) => {
    if (planId === "free") return;
    if (!billingCfg || billingCfg.active === "none") {
      toast.error("Sistema de pagamento não configurado. Contate o suporte.");
      return;
    }

    setLoadingCheckout(planId);
    try {
      const result = await createCheckout(planId, annual ? "annual" : "monthly");

      if (result.type === "redirect" && result.url) {
        window.location.href = result.url;
      } else if (result.type === "stripe_embedded") {
        // Stripe embedded — navigate to embedded checkout page
        navigate(`/upgrade/checkout?clientSecret=${result.clientSecret}&publishableKey=${result.publishableKey}`);
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao iniciar checkout");
      setLoadingCheckout(null);
    }
  };

  if (configLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar
        </button>
        <p className="text-xs font-semibold uppercase tracking-widest text-primary/70 mb-1">Planos</p>
        <h1 className="font-display text-3xl font-bold text-foreground tracking-tight">Escolha seu plano</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Você está no plano <span className="text-foreground font-medium capitalize">{currentPlan}</span>.
          {" "}Faça upgrade a qualquer momento.
        </p>
      </div>

      {/* Billing notice */}
      {billingCfg?.active === "none" && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-amber-500/20 bg-amber-500/5 text-amber-400 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          O sistema de pagamento ainda não está configurado. Entre em contato com o suporte para fazer upgrade.
        </div>
      )}

      {/* Toggle */}
      <div className="flex items-center gap-4">
        <div className="inline-flex items-center gap-2 p-1 rounded-xl bg-muted/30 border border-border/40">
          <button
            onClick={() => setAnnual(false)}
            className={cn("px-4 py-1.5 rounded-lg text-sm font-medium transition-all", !annual ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
          >
            Mensal
          </button>
          <button
            onClick={() => setAnnual(true)}
            className={cn("flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all", annual ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
          >
            Anual
            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded-full">-20%</span>
          </button>
        </div>
        {billingCfg && billingCfg.trialDays > 0 && (
          <span className="text-xs text-muted-foreground">
            <Zap className="h-3 w-3 inline mr-1 text-amber-400" />
            {billingCfg.trialDays} dias de trial grátis nos planos pagos
          </span>
        )}
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {PLAN_ORDER.map((planId) => {
          const plan = PLANS[planId];
          if (!plan) return null;
          const price = annual ? plan.priceAnnual : plan.priceMonthly;
          const isCurrent = planId === currentPlan;
          const isLoading = loadingCheckout === planId;

          return (
            <div
              key={planId}
              onClick={() => setSelectedPlan(planId)}
              className={cn(
                "relative flex flex-col rounded-2xl border p-5 cursor-pointer transition-all",
                plan.popular
                  ? "border-primary/50 bg-primary/5 shadow-glow-sm"
                  : selectedPlan === planId
                  ? "border-primary/30 bg-primary/3"
                  : "border-border/50 bg-card/30 hover:border-border"
              )}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex items-center gap-1 px-3 py-1 rounded-full bg-gradient-primary text-white text-[10px] font-bold">
                  <Star className="h-2.5 w-2.5 fill-current" />
                  Mais popular
                </div>
              )}

              {isCurrent && (
                <div className="absolute -top-3 right-3 px-2.5 py-1 rounded-full bg-muted text-muted-foreground text-[10px] font-semibold border border-border/50">
                  Plano atual
                </div>
              )}

              <div className="mb-4">
                <p className="text-sm font-semibold text-foreground/80 mb-1">{plan.name}</p>
                <div className="flex items-end gap-1">
                  <span className="text-2xl font-bold font-display">
                    {price === 0 ? "Grátis" : `R$${Math.round(price)}`}
                  </span>
                  {price > 0 && <span className="text-muted-foreground text-xs mb-1">/mês</span>}
                </div>
                {annual && price > 0 && (
                  <p className="text-[11px] text-emerald-400 mt-0.5">R${Math.round(price * 12)}/ano</p>
                )}
              </div>

              <ul className="space-y-2 flex-1 mb-5 pb-5 border-b border-border/40">
                {plan.features.slice(0, 4).map((f) => (
                  <li key={f} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
                {plan.features.length > 4 && (
                  <li className="text-xs text-muted-foreground/60">+{plan.features.length - 4} benefícios</li>
                )}
              </ul>

              {planId === "free" ? (
                <div className="text-center text-xs text-muted-foreground py-1.5">
                  {isCurrent ? "✓ Plano atual" : "Sem checkout necessário"}
                </div>
              ) : (
                <button
                  onClick={(e) => { e.stopPropagation(); handleCheckout(planId); }}
                  disabled={isCurrent || isLoading || billingCfg?.active === "none"}
                  className={cn(
                    "w-full py-2 rounded-xl text-xs font-semibold transition-all",
                    isCurrent
                      ? "bg-muted/40 text-muted-foreground cursor-default"
                      : plan.popular
                      ? "bg-gradient-primary text-white hover:opacity-90 shadow-glow-sm"
                      : "border border-border/50 text-foreground hover:bg-muted/20",
                    "disabled:opacity-50"
                  )}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                  ) : isCurrent ? (
                    "Plano atual"
                  ) : billingCfg?.trialDays ? (
                    `Trial ${billingCfg.trialDays} dias`
                  ) : (
                    "Assinar"
                  )}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-center text-xs text-muted-foreground/50">
        Todas as integrações incluídas em qualquer plano • Cancele quando quiser
      </p>
    </div>
  );
}
