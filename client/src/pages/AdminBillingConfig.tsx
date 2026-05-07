import { useEffect, useState } from "react";
import { getAdminBillingConfig, saveAdminBillingConfig, type BillingConfig } from "@/lib/api";
import { PAID_PLANS } from "@/lib/plans";
import {
  CreditCard, Save, Loader2, Check, ChevronDown, ChevronRight,
  ExternalLink, AlertCircle, Zap,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// ─── Platform definitions ─────────────────────────────────────────────────────

const PLATFORMS = [
  {
    id: "none" as const,
    label: "Desativado",
    desc: "Sem plataforma de pagamento ativa. Usuários permanecem no plano Free.",
    icon: "🚫",
  },
  {
    id: "stripe" as const,
    label: "Stripe",
    desc: "Integração via API. Checkout gerenciado, assinaturas automáticas, trials configuráveis.",
    icon: "💳",
  },
  {
    id: "hotmart" as const,
    label: "Hotmart",
    desc: "Checkout externo da Hotmart. Configure uma URL de checkout por plano.",
    icon: "🔥",
  },
  {
    id: "external" as const,
    label: "Plataforma externa",
    desc: "CartPanda billing, Kirvano, Eduzz, Perfectpay, Monetizze — qualquer checkout com link.",
    icon: "🔗",
  },
  {
    id: "own" as const,
    label: "Checkout próprio",
    desc: "Formulário de pagamento embutido na plataforma usando Stripe como processador.",
    icon: "🏪",
  },
];

// ─── Generic input ────────────────────────────────────────────────────────────

function Field({
  label, value, onChange, type = "text", placeholder, helper,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; helper?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 text-sm bg-muted/20 border-border/40"
      />
      {helper && <p className="text-[11px] text-muted-foreground/60">{helper}</p>}
    </div>
  );
}

// ─── Plan URL/ID table ────────────────────────────────────────────────────────

function PlanTable({
  title, monthlyLabel, annualLabel, getValue, onChange,
}: {
  title: string;
  monthlyLabel: string;
  annualLabel?: string;
  getValue: (planId: string, field: "monthly" | "annual") => string;
  onChange: (planId: string, field: "monthly" | "annual", value: string) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">{title}</p>
      <div className="rounded-xl border border-border/40 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/40 bg-muted/20">
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Plano</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">{monthlyLabel}</th>
              {annualLabel && <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">{annualLabel}</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {PAID_PLANS.map((plan) => (
              <tr key={plan.id} className="hover:bg-muted/10 transition-colors">
                <td className="px-4 py-2.5">
                  <span className="font-medium">{plan.name}</span>
                  <span className="ml-2 text-xs text-muted-foreground">R${plan.priceMonthly}/mês</span>
                </td>
                <td className="px-4 py-2.5">
                  <Input
                    value={getValue(plan.id, "monthly")}
                    onChange={(e) => onChange(plan.id, "monthly", e.target.value)}
                    className="h-7 text-xs bg-muted/20 border-border/30 max-w-xs"
                    placeholder="—"
                  />
                </td>
                {annualLabel && (
                  <td className="px-4 py-2.5">
                    <Input
                      value={getValue(plan.id, "annual")}
                      onChange={(e) => onChange(plan.id, "annual", e.target.value)}
                      className="h-7 text-xs bg-muted/20 border-border/30 max-w-xs"
                      placeholder="—"
                    />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Platform config panels ───────────────────────────────────────────────────

function StripePanel({ cfg, onChange }: { cfg: BillingConfig; onChange: (c: BillingConfig) => void }) {
  const s = cfg.stripe ?? {};
  const set = (key: string, value: string) =>
    onChange({ ...cfg, stripe: { ...s, [key]: value } });

  const setPlan = (planId: string, field: "monthly" | "annual", value: string) =>
    onChange({
      ...cfg,
      stripe: {
        ...s,
        plans: { ...(s.plans ?? {}), [planId]: { ...(s.plans?.[planId] ?? {}), [field]: value } },
      },
    });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Publishable Key" value={s.publishableKey ?? ""} onChange={(v) => set("publishableKey", v)} placeholder="pk_live_..." />
        <Field label="Secret Key" value={s.secretKey ?? ""} onChange={(v) => set("secretKey", v)} placeholder="sk_live_..." type="password" />
        <Field label="Webhook Secret" value={s.webhookSecret ?? ""} onChange={(v) => set("webhookSecret", v)} placeholder="whsec_..." type="password"
          helper="Cadastre o endpoint no Stripe Dashboard: POST /webhooks/stripe/billing" />
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Modo do Checkout</Label>
          <div className="flex gap-3 pt-1">
            {(["hosted", "embedded"] as const).map((m) => (
              <label key={m} className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="stripeMode" value={m} checked={(s.mode ?? "hosted") === m}
                  onChange={() => set("mode", m)} className="accent-primary" />
                <span className="text-sm capitalize">{m === "hosted" ? "Hosted (Stripe)" : "Embedded (próprio)"}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      <PlanTable
        title="Price IDs por plano"
        monthlyLabel="Price ID Mensal"
        annualLabel="Price ID Anual"
        getValue={(planId, field) => s.plans?.[planId]?.[field] ?? ""}
        onChange={setPlan}
      />

      <div className="flex items-start gap-2 text-xs text-amber-400/80 bg-amber-400/5 border border-amber-400/15 rounded-xl px-4 py-3">
        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
        <span>Crie os produtos e preços no Stripe Dashboard e cole os Price IDs acima. Certifique-se de usar preços do tipo <strong>Recorrente</strong>.</span>
      </div>
    </div>
  );
}

function HotmartPanel({ cfg, onChange }: { cfg: BillingConfig; onChange: (c: BillingConfig) => void }) {
  const h = cfg.hotmart ?? {};
  const set = (key: string, value: string) =>
    onChange({ ...cfg, hotmart: { ...h, [key]: value } });

  const setPlan = (planId: string, field: "monthly" | "annual", value: string) =>
    onChange({
      ...cfg,
      hotmart: {
        ...h,
        plans: { ...(h.plans ?? {}), [planId]: { ...(h.plans?.[planId] ?? {}), [field]: value } },
      },
    });

  return (
    <div className="space-y-6">
      <Field label="HOTTOK Secret (webhook)" value={h.hottokSecret ?? ""} onChange={(v) => set("hottokSecret", v)}
        type="password" placeholder="Seu token de validação do webhook Hotmart"
        helper="Cadastre o endpoint POST /webhooks/hotmart/billing no painel da Hotmart." />

      <PlanTable
        title="Links de checkout por plano"
        monthlyLabel="URL Mensal"
        annualLabel="URL Anual"
        getValue={(planId, field) => h.plans?.[planId]?.[field] ?? ""}
        onChange={setPlan}
      />
    </div>
  );
}

function ExternalPanel({ cfg, onChange }: { cfg: BillingConfig; onChange: (c: BillingConfig) => void }) {
  const e = cfg.external ?? {};
  const set = (key: string, value: string) =>
    onChange({ ...cfg, external: { ...e, [key]: value } });

  const setPlan = (planId: string, field: "monthly" | "annual", value: string) =>
    onChange({
      ...cfg,
      external: {
        ...e,
        plans: { ...(e.plans ?? {}), [planId]: { ...(e.plans?.[planId] ?? {}), [field]: value } },
      },
    });

  return (
    <div className="space-y-6">
      <Field
        label="Nome da plataforma"
        value={e.platformName ?? ""}
        onChange={(v) => set("platformName", v)}
        placeholder="ex: CartPanda, Kirvano, Eduzz, Perfectpay..."
      />
      <PlanTable
        title="Links de checkout por plano"
        monthlyLabel="URL Mensal"
        annualLabel="URL Anual"
        getValue={(planId, field) => e.plans?.[planId]?.[field] ?? ""}
        onChange={setPlan}
      />
      <p className="text-xs text-muted-foreground/60">
        O e-mail do usuário será adicionado automaticamente como parâmetro <code>?email=</code> em cada URL.
      </p>
    </div>
  );
}

function OwnCheckoutPanel({ cfg, onChange }: { cfg: BillingConfig; onChange: (c: BillingConfig) => void }) {
  const o = cfg.own ?? {};
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Gateway de pagamento</Label>
        <div className="flex gap-4 pt-1">
          {(["stripe"] as const).map((g) => (
            <label key={g} className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="ownGateway" value={g} checked={(o.gateway ?? "stripe") === g}
                onChange={() => onChange({ ...cfg, own: { ...o, gateway: g } })} className="accent-primary" />
              <span className="text-sm capitalize">{g}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="text-xs text-muted-foreground/60 bg-muted/20 rounded-xl border border-border/30 px-4 py-3">
        O checkout próprio usa as credenciais Stripe configuradas na aba Stripe. Configure-as primeiro.
        O cliente vê o formulário de pagamento integrado na sua plataforma.
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminBillingConfig() {
  const [cfg, setCfg] = useState<BillingConfig>({ active: "none", trialDays: 14 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getAdminBillingConfig()
      .then(setCfg)
      .catch(() => setCfg({ active: "none", trialDays: 14 }))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const saved = await saveAdminBillingConfig(cfg);
      setCfg(saved);
      toast.success("Configuração salva com sucesso");
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const activePlatform = PLATFORMS.find(p => p.id === cfg.active) ?? PLATFORMS[0];

  return (
    <div className="space-y-8 animate-fade-in max-w-4xl">
      {/* Header */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-primary/70 mb-1">Super Admin</p>
        <h1 className="font-display text-3xl font-bold text-foreground tracking-tight">Plataforma de Pagamento</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure como usuários assinam e pagam pelos planos. Escolha a plataforma e configure por plano.
        </p>
      </div>

      {/* Trial days global setting */}
      <div className="rounded-2xl border border-border/50 bg-card/30 backdrop-blur-xl shadow-glass p-6">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Configurações gerais</h2>
        </div>
        <div className="max-w-xs">
          <Field
            label="Dias de trial"
            value={String(cfg.trialDays ?? 14)}
            onChange={(v) => setCfg({ ...cfg, trialDays: parseInt(v) || 14 })}
            type="number"
            placeholder="14"
            helper="Número de dias de trial gratuito nos planos pagos."
          />
        </div>
      </div>

      {/* Platform selector */}
      <div className="rounded-2xl border border-border/50 bg-card/30 backdrop-blur-xl shadow-glass p-6">
        <div className="flex items-center gap-2 mb-5">
          <CreditCard className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Plataforma ativa</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {PLATFORMS.map((p) => (
            <button
              key={p.id}
              onClick={() => setCfg({ ...cfg, active: p.id })}
              className={cn(
                "flex items-start gap-3 p-4 rounded-xl border text-left transition-all",
                cfg.active === p.id
                  ? "border-primary/50 bg-primary/8 shadow-glow-sm"
                  : "border-border/40 hover:border-border/60 hover:bg-muted/20"
              )}
            >
              <span className="text-xl mt-0.5">{p.icon}</span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold">{p.label}</p>
                  {cfg.active === p.id && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                </div>
                <p className="text-xs text-muted-foreground/70 mt-0.5 leading-relaxed">{p.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Platform-specific config */}
      {cfg.active !== "none" && (
        <div className="rounded-2xl border border-border/50 bg-card/30 backdrop-blur-xl shadow-glass p-6">
          <div className="flex items-center gap-2 mb-6">
            <span className="text-lg">{activePlatform.icon}</span>
            <h2 className="text-sm font-semibold">Configuração — {activePlatform.label}</h2>
          </div>

          {cfg.active === "stripe" && <StripePanel cfg={cfg} onChange={setCfg} />}
          {cfg.active === "hotmart" && <HotmartPanel cfg={cfg} onChange={setCfg} />}
          {cfg.active === "external" && <ExternalPanel cfg={cfg} onChange={setCfg} />}
          {cfg.active === "own" && <OwnCheckoutPanel cfg={cfg} onChange={setCfg} />}
        </div>
      )}

      {/* Save button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-primary text-white text-sm font-bold shadow-glow-sm hover:opacity-90 transition-all disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar configuração
        </button>
      </div>
    </div>
  );
}
