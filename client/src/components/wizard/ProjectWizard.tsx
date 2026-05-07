import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { createProject, type ProjectDetail, type CheckoutType } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  X, ArrowLeft, ArrowRight, Check, Loader2, Copy,
  Globe, Zap, Code2, Webhook, CheckCircle2,
  Store, TrendingUp, ShoppingCart, Settings,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// ─── Types ────────────────────────────────────────────────────────────────────

type ProjectTypeValue = "ecommerce" | "direct";

interface WizardState {
  projectType: ProjectTypeValue | null;
  name: string;
  domain: string;
  checkoutType: CheckoutType | null;
}

const INITIAL: WizardState = {
  projectType: null,
  name: "",
  domain: "",
  checkoutType: null,
};

// ─── Platform definitions ─────────────────────────────────────────────────────

const ECOMMERCE_CHECKOUTS: { id: CheckoutType; name: string; icon: React.FC; available: boolean }[] = [
  { id: "cartpanda",     name: "CartPanda",       icon: CartPandaIcon, available: true  },
  { id: "shopify",       name: "Shopify",          icon: ShopifyIcon,   available: true  },
  { id: "shopify_yampi",     name: "Shopify + Yampi",      icon: YampiIcon,     available: true  },
  { id: "shopify_cartpanda", name: "Shopify + CartPanda",  icon: CartPandaIcon, available: true  },
  { id: "ticto",         name: "Ticto",            icon: TictoIcon,     available: true  },
  { id: "kiwify",        name: "Kiwify",           icon: KiwifyIcon,    available: true  },
  { id: "hotmart",       name: "Hotmart",          icon: HotmartIcon,   available: true  },
  { id: "kirvano",       name: "Kirvano",          icon: KirvanoIcon,   available: true  },
  { id: "greenn",        name: "Greenn",           icon: GreenIcon,     available: true  },
  { id: "woocommerce",   name: "WooCommerce",      icon: WooIcon,       available: false },
];

const DIRECT_CHECKOUTS: { id: string; name: string; icon: React.FC; available: boolean }[] = [
  { id: "cartpanda",  name: "CartPanda",  icon: CartPandaIcon,  available: true  },
  { id: "ticto",      name: "Ticto",      icon: TictoIcon,      available: true  },
  { id: "kiwify",     name: "Kiwify",     icon: KiwifyIcon,     available: true  },
  { id: "hotmart",    name: "Hotmart",    icon: HotmartIcon,    available: true  },
  { id: "kirvano",    name: "Kirvano",    icon: KirvanoIcon,    available: true  },
  { id: "greenn",     name: "Greenn",     icon: GreenIcon,      available: true  },
  { id: "lastlink",   name: "Lastlink",   icon: LastlinkIcon,   available: true  },
  { id: "pagtrust",   name: "PagTrust",   icon: PagTrustIcon,   available: true  },
  { id: "hubla",      name: "Hubla",      icon: HublaIcon,      available: true  },
  { id: "eduzz",      name: "Eduzz",      icon: EduzzIcon,      available: true  },
  { id: "perfectpay", name: "PerfectPay", icon: PerfectPayIcon, available: true  },
  { id: "payt",       name: "Payt",       icon: PaytIcon,       available: true  },
];

// ─── Steps ────────────────────────────────────────────────────────────────────

const STEPS = [
  { label: "Tipo",     description: "E-commerce ou tráfego direto" },
  { label: "Projeto",  description: "Nome e plataforma de checkout" },
  { label: "Instalar", description: "Scripts e webhook prontos" },
];

// ─── Main component ───────────────────────────────────────────────────────────

interface ProjectWizardProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function ProjectWizard({ open, onClose, onCreated }: ProjectWizardProps) {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [state, setState] = useState<WizardState>(INITIAL);
  const [createdProject, setCreatedProject] = useState<ProjectDetail | null>(null);
  const [creating, setCreating] = useState(false);

  const set = useCallback(<K extends keyof WizardState>(key: K, value: WizardState[K]) => {
    setState((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleClose = () => {
    setStep(0);
    setState(INITIAL);
    setCreatedProject(null);
    onClose();
  };

  const canNext = () => {
    if (step === 0) return state.projectType !== null;
    if (step === 1) {
      const nameOk = state.name.trim().length > 0;
      const checkoutOk = state.projectType === "direct" || state.checkoutType !== null;
      return nameOk && checkoutOk;
    }
    return false;
  };

  const handleNext = async () => {
    if (step === 1) {
      await handleCreate();
    } else {
      setStep((s) => s + 1);
    }
  };

  const handleCreate = async () => {
    setCreating(true);
    try {
      const payload: Record<string, string | boolean> = {
        name: state.name.trim(),
        projectType: state.projectType ?? "ecommerce",
        ...(state.domain.trim()   && { domain: state.domain.trim() }),
        ...(state.checkoutType    && { checkoutType: state.checkoutType }),
      };
      const result = await createProject(payload);
      setCreatedProject(result);
      setStep(2);
      onCreated();
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar projeto");
    } finally {
      setCreating(false);
    }
  };

  const handleGoToProject = () => {
    if (!createdProject) return;
    handleClose();
    navigate(`/projects/${createdProject.project.id}?configure=1`);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-2xl rounded-2xl border border-border/60 bg-card shadow-card overflow-hidden animate-scale-in">
        <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-48 w-64 rounded-full bg-primary/10 blur-[60px]" />

        {/* Header */}
        <div className="relative flex items-center justify-between px-8 pt-8 pb-6 border-b border-border/40">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-primary/70 mb-1">Novo projeto</p>
            <h2 className="font-display text-2xl font-bold text-foreground tracking-tight">{STEPS[step].label}</h2>
            <p className="text-sm text-muted-foreground mt-0.5">{STEPS[step].description}</p>
          </div>
          {step < 2 && (
            <button
              onClick={handleClose}
              className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Progress */}
        <div className="relative px-8 py-4 border-b border-border/30">
          <div className="flex items-center gap-2">
            {STEPS.map((s, i) => (
              <div key={i} className="flex items-center gap-2 flex-1">
                <div className={cn(
                  "h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all duration-300",
                  i < step  ? "bg-primary text-white" :
                  i === step ? "bg-primary/20 text-primary border border-primary/40" :
                               "bg-muted/40 text-muted-foreground"
                )}>
                  {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </div>
                <span className={cn(
                  "text-xs font-medium hidden sm:block truncate",
                  i === step ? "text-foreground" : i < step ? "text-primary/80" : "text-muted-foreground"
                )}>
                  {s.label}
                </span>
                {i < STEPS.length - 1 && (
                  <div className={cn("flex-1 h-px transition-colors duration-300", i < step ? "bg-primary/50" : "bg-border/50")} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="relative px-8 py-7 min-h-[320px] max-h-[60vh] overflow-y-auto">
          {step === 0 && <StepType state={state} set={set} />}
          {step === 1 && <StepBasics state={state} set={set} />}
          {step === 2 && createdProject && (
            <StepInstall
              project={createdProject}
              wizardState={state}
              onGoToProject={handleGoToProject}
              onClose={handleClose}
            />
          )}
        </div>

        {/* Footer */}
        {step < 2 && (
          <div className="flex items-center justify-between px-8 py-5 border-t border-border/40 bg-background/30">
            <button
              onClick={() => (step === 0 ? handleClose() : setStep((s) => s - 1))}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              {step === 0 ? "Cancelar" : "Voltar"}
            </button>

            <button
              onClick={handleNext}
              disabled={!canNext() || creating}
              className={cn(
                "relative flex items-center gap-2 px-6 h-10 rounded-xl text-sm font-semibold transition-all duration-200 overflow-hidden",
                canNext() && !creating
                  ? "bg-gradient-primary text-white shadow-glow-sm hover:shadow-glow hover:opacity-95 active:scale-[0.98]"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              )}
            >
              {canNext() && !creating && <span className="absolute inset-0 animate-shine" />}
              <span className="relative flex items-center gap-2">
                {creating && <Loader2 className="h-4 w-4 animate-spin" />}
                {step === 1
                  ? (creating ? "Criando..." : "Criar projeto")
                  : (<>Continuar <ArrowRight className="h-4 w-4" /></>)
                }
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Step 0: Type ─────────────────────────────────────────────────────────────

function StepType({ state, set }: { state: WizardState; set: any }) {
  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Define o modelo de rastreamento do projeto.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <TypeCard
          selected={state.projectType === "ecommerce"}
          onSelect={() => set("projectType", "ecommerce")}
          icon={<Store className="h-7 w-7" />}
          title="E-commerce"
          description="Loja virtual com checkout — Shopify, CartPanda, Yampi e outros."
          color="primary"
        />
        <TypeCard
          selected={state.projectType === "direct"}
          onSelect={() => set("projectType", "direct")}
          icon={<TrendingUp className="h-7 w-7" />}
          title="Tráfego Direto"
          description="Landing page ou funil com plataforma de pagamento — Hotmart, Kiwify e outros."
          color="accent"
        />
      </div>
    </div>
  );
}

function TypeCard({
  selected, onSelect, icon, title, description, color,
}: {
  selected: boolean; onSelect: () => void; icon: React.ReactNode;
  title: string; description: string; color: "primary" | "accent";
}) {
  const ring = color === "primary"
    ? "border-primary/60 bg-primary/8 shadow-glow-sm"
    : "border-accent/60 bg-accent/8";
  const iconBg = color === "primary"
    ? "bg-primary/10 text-primary"
    : "bg-accent/10 text-accent";
  const checkBg = color === "primary" ? "bg-primary" : "bg-accent";

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "relative flex flex-col gap-4 p-5 rounded-xl border text-left transition-all duration-200 cursor-pointer",
        selected ? ring : "border-border/60 bg-muted/20 hover:border-border hover:bg-muted/40"
      )}
    >
      {selected && (
        <div className={cn("absolute top-2 right-2 h-5 w-5 rounded-full flex items-center justify-center", checkBg)}>
          <Check className="h-3 w-3 text-white" />
        </div>
      )}
      <div className={cn("h-12 w-12 rounded-xl flex items-center justify-center", iconBg)}>
        {icon}
      </div>
      <div>
        <p className="font-semibold text-foreground text-sm">{title}</p>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{description}</p>
      </div>
    </button>
  );
}

// ─── Step 1: Basics ───────────────────────────────────────────────────────────

function StepBasics({ state, set }: { state: WizardState; set: any }) {
  const checkouts = state.projectType === "direct" ? DIRECT_CHECKOUTS : ECOMMERCE_CHECKOUTS;
  const isDirect  = state.projectType === "direct";

  return (
    <div className="space-y-6">
      {/* Name + domain */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">
            Nome do projeto <span className="text-destructive">*</span>
          </Label>
          <Input
            autoFocus
            placeholder="Ex: Rosa Selvagem"
            value={state.name}
            onChange={(e) => set("name", e.target.value)}
            className="h-11 bg-muted/40 border-border/60 focus:border-primary/60"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm font-medium flex items-center gap-2">
            Domínio
            <span className="text-[10px] font-normal text-muted-foreground">(opcional — só para referência)</span>
          </Label>
          <div className="relative">
            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="sualoja.com.br"
              value={state.domain}
              onChange={(e) => set("domain", e.target.value)}
              className="h-11 pl-9 bg-muted/40 border-border/60 focus:border-primary/60"
            />
          </div>
        </div>
      </div>

      {/* Checkout */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="h-5 w-5 rounded-md bg-accent/10 flex items-center justify-center">
            <ShoppingCart className="h-3 w-3 text-accent" />
          </div>
          <span className="text-sm font-semibold text-foreground">
            Plataforma de checkout
          </span>
          {isDirect && (
            <span className="text-xs text-muted-foreground">(opcional)</span>
          )}
        </div>

        {isDirect && (
          <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
            Selecione se usar uma plataforma de pagamento. Sem checkout, o pixel rastreia via regras de eventos personalizadas.
          </p>
        )}

        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          {checkouts.map((p) => (
            <CheckoutCard
              key={p.id}
              platform={p}
              selected={state.checkoutType === p.id}
              onToggle={() => {
                if (!p.available) return;
                set("checkoutType", state.checkoutType === p.id ? null : p.id as CheckoutType);
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function CheckoutCard({
  platform, selected, onToggle,
}: {
  platform: { id: string; name: string; icon: React.FC; available: boolean };
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={!platform.available}
      className={cn(
        "relative flex flex-col items-center gap-2 p-3.5 rounded-xl border text-center transition-all duration-200",
        !platform.available ? "cursor-not-allowed opacity-40 border-border/30 bg-muted/10" :
        selected
          ? "border-primary/60 bg-primary/8 shadow-glow-sm cursor-pointer"
          : "border-border/60 bg-muted/20 hover:border-border hover:bg-muted/40 cursor-pointer"
      )}
    >
      {!platform.available && (
        <span className="absolute top-1.5 right-1.5 text-[9px] font-semibold text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded-full">
          Em breve
        </span>
      )}
      {selected && (
        <div className="absolute top-1.5 right-1.5 h-4 w-4 rounded-full bg-primary flex items-center justify-center">
          <Check className="h-2.5 w-2.5 text-white" />
        </div>
      )}
      <platform.icon />
      <p className="text-xs font-semibold text-foreground leading-tight">{platform.name}</p>
    </button>
  );
}

// ─── Step 2: Install ──────────────────────────────────────────────────────────

function StepInstall({
  project, wizardState, onGoToProject, onClose,
}: {
  project: ProjectDetail;
  wizardState: WizardState;
  onGoToProject: () => void;
  onClose: () => void;
}) {
  const checkout = wizardState.checkoutType;
  const isDirect = wizardState.projectType === "direct";
  const webhookUrl = project.webhookUrl;

  return (
    <div className="space-y-5">
      {/* Success */}
      <div className="flex items-center gap-4 p-4 rounded-xl border border-success/20 bg-success/5">
        <div className="h-12 w-12 rounded-xl bg-success/15 flex items-center justify-center shrink-0">
          <CheckCircle2 className="h-6 w-6 text-success" />
        </div>
        <div className="min-w-0">
          <p className="font-display font-semibold text-foreground truncate">
            "{project.project.name}" criado!
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Siga os passos abaixo para concluir a instalação.
          </p>
        </div>
      </div>

      {/* Install steps */}
      <div className="space-y-3">
        {checkout === "shopify" ? (
          <>
            <InstallStep
              number={1}
              title="Script no theme.liquid (Shopify)"
              description="Cole no <head> do theme.liquid — captura UTMs e persiste via note_attributes."
              icon={Code2}
              code={project.installScript}
            />
            <InstallStep
              number={2}
              title="Pixel Remoto — Customer Events"
              description="Shopify → Configurações → Customer Events → Add custom pixel → Tipo: Remote → cole a URL."
              icon={Code2}
              code={project.shopifyCheckoutPixelUrl}
              single
            />
            <InstallStep
              number={3}
              title="Webhook de pedidos (Shopify)"
              description="Shopify → Configurações → Notificações → Webhooks → orders/paid (JSON)."
              icon={Webhook}
              code={webhookUrl}
              single
            />
          </>
        ) : checkout === "shopify_yampi" ? (
          <>
            <InstallStep
              number={1}
              title="Script no theme.liquid (Shopify)"
              description="Cole no <head> do theme.liquid — captura UTMs e identificação antes do checkout Yampi."
              icon={Code2}
              code={project.installScript}
            />
            <InstallStep
              number={2}
              title="Script de Checkout (Yampi)"
              description="Yampi → Configurações → Checkout → Scripts Adicionais → Geral → cole a tag."
              icon={Code2}
              code={project.yampiCheckoutScriptTag}
            />
            <InstallStep
              number={3}
              title="Webhook de pedidos (Shopify)"
              description="Shopify → Configurações → Notificações → Webhooks → orders/paid (JSON)."
              icon={Webhook}
              code={webhookUrl}
              single
            />
          </>
        ) : checkout === "shopify_cartpanda" ? (
          <>
            <InstallStep
              number={1}
              title="Script no theme.liquid (Shopify)"
              description="Cole no <head> do theme.liquid — captura UTMs e identificação antes do checkout CartPanda."
              icon={Code2}
              code={project.installScript}
            />
            <InstallStep
              number={2}
              title="Script de Checkout (CartPanda)"
              description="CartPanda → Configurações → Checkout → Scripts Adicionais → Geral → cole a tag."
              icon={Code2}
              code={project.cartpandaCheckoutScriptTag}
            />
            <InstallStep
              number={3}
              title="Webhook CartPanda"
              description="CartPanda → Configurações → Webhooks → Evento: order.paid"
              icon={Webhook}
              code={webhookUrl}
              single
            />
          </>
        ) : checkout === "cartpanda" ? (
          <>
            <InstallStep
              number={1}
              title="Script no storefront"
              description={isDirect
                ? "Cole no <head> de todas as páginas da landing page."
                : "Cole no <head> de todas as páginas da loja."}
              icon={Code2}
              code={project.installScript}
            />
            <InstallStep
              number={2}
              title="Script de Checkout (CartPanda)"
              description="CartPanda → Configurações → Checkout → Scripts Adicionais → Geral."
              icon={Code2}
              code={project.cartpandaCheckoutScriptTag}
            />
            <InstallStep
              number={3}
              title="Webhook CartPanda"
              description="CartPanda → Configurações → Webhooks → Evento: order.paid"
              icon={Webhook}
              code={webhookUrl}
              single
            />
          </>
        ) : checkout ? (
          <>
            <InstallStep
              number={1}
              title={isDirect ? "Script na landing page" : "Script no storefront"}
              description="Cole no <head> de todas as páginas."
              icon={Code2}
              code={project.installScript}
            />
            <InstallStep
              number={2}
              title={`Webhook de vendas (${CHECKOUT_LABELS[checkout] ?? checkout})`}
              description={CHECKOUT_WEBHOOK_INSTRUCTIONS[checkout] ?? "Configure o webhook na plataforma de checkout."}
              icon={Webhook}
              code={(checkout === "ticto" && project.tictoWebhookUrl) ? project.tictoWebhookUrl : webhookUrl}
              single
            />
          </>
        ) : (
          <>
            <InstallStep
              number={1}
              title="Script na landing page"
              description="Cole no <head> de todas as páginas."
              icon={Code2}
              code={project.installScript}
            />
            <div className="flex items-start gap-3 p-4 rounded-xl border border-primary/15 bg-primary/5">
              <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-[11px] font-bold text-primary">2</span>
              </div>
              <p className="text-xs text-primary/80 leading-relaxed">
                <strong className="font-semibold">Configure regras de eventos</strong> — acesse o projeto para definir quais ações (cliques, scroll, tempo) disparam eventos customizados.
              </p>
            </div>
          </>
        )}
      </div>

      {/* Pixel config CTA */}
      <div className="rounded-xl border border-border/50 bg-muted/10 p-4 flex items-start gap-3">
        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Settings className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">Configure os pixels de anúncio</p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            Meta Ads, TikTok, GA4 e Google Ads são configurados nas settings do projeto, não no wizard.
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-1">
        <button
          onClick={onClose}
          className="flex-1 h-10 rounded-xl border border-border/60 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-all"
        >
          Ver projetos
        </button>
        <button
          onClick={onGoToProject}
          className="flex-1 h-10 rounded-xl bg-gradient-primary text-white text-sm font-semibold shadow-glow-sm hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
        >
          <Settings className="h-4 w-4" />
          Configurar pixels
        </button>
      </div>
    </div>
  );
}

const CHECKOUT_LABELS: Record<string, string> = {
  ticto:      "Ticto",
  hotmart:    "Hotmart",
  kirvano:    "Kirvano",
  kiwify:     "Kiwify",
  greenn:     "Greenn",
  lastlink:   "Lastlink",
  pagtrust:   "PagTrust",
  hubla:      "Hubla",
  eduzz:      "Eduzz",
  perfectpay: "PerfectPay",
  payt:       "Payt",
};

const CHECKOUT_WEBHOOK_INSTRUCTIONS: Record<string, string> = {
  ticto:      "Ticto → Configurações → Integrações → Postback → versão 2.0 → status: authorized.",
  hotmart:    "Hotmart → Ferramentas → Webhooks → Adicionar webhook → evento: PURCHASE_COMPLETE.",
  kirvano:    "Kirvano → Configurações → Webhooks → Adicionar → evento: purchase_completed.",
  kiwify:     "Kiwify → Configurações → Webhooks → Novo webhook → evento: order_approved.",
  greenn:     "Greenn → Produtos → selecione o produto → Webhooks → Adicionar → evento: saleUpdated.",
  lastlink:   "Lastlink → Configurações → Webhooks → Criar webhook → evento: Purchase_Order_Confirmed.",
  pagtrust:   "PagTrust → Ferramentas → Webhooks → Adicionar → evento: PURCHASE_APPROVED.",
  hubla:      "Hubla → Configurações → Webhooks → Adicionar → evento: invoice.payment_succeeded.",
  eduzz:      "Eduzz → Configurações → Webhooks → Novo webhook → selecione o produto.",
  perfectpay: "PerfectPay → Configurações → Webhooks → Adicionar webhook.",
  payt:       "Payt → Configurações → Webhooks → Novo webhook.",
};

// ─── InstallStep ──────────────────────────────────────────────────────────────

function InstallStep({
  number, title, description, icon: Icon, code, single,
}: {
  number: number; title: string; description: string;
  icon: React.FC<any>; code: string; single?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success("Copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-xl border border-border/60 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/40 bg-muted/20">
        <div className="flex items-center gap-2.5">
          <div className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
            <span className="text-[10px] font-bold text-primary">{number}</span>
          </div>
          <Icon className="h-3.5 w-3.5 text-primary/70" />
          <span className="text-xs font-semibold text-foreground">{title}</span>
        </div>
        <button
          onClick={handleCopy}
          className={cn(
            "flex items-center gap-1.5 text-xs font-medium transition-colors",
            copied ? "text-success" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copiado!" : "Copiar"}
        </button>
      </div>
      <p className="px-4 py-2 text-[10px] text-muted-foreground border-b border-border/30 bg-muted/10">
        {description}
      </p>
      <pre className={cn(
        "px-4 py-3 text-[11px] font-mono text-muted-foreground overflow-auto",
        !single && "max-h-28"
      )}>
        {code}
      </pre>
    </div>
  );
}

// ─── Platform icons ───────────────────────────────────────────────────────────

function MetaIcon() {
  return <div className="h-9 w-9 rounded-xl bg-blue-600 flex items-center justify-center text-white font-black text-base shrink-0">f</div>;
}

function TikTokIcon() {
  return (
    <div className="h-9 w-9 rounded-xl bg-[#010101] flex items-center justify-center shrink-0">
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V9.02a8.19 8.19 0 0 0 4.79 1.53V7.12a4.85 4.85 0 0 1-1.02-.43z" fill="white"/>
      </svg>
    </div>
  );
}

function GA4Icon() {
  return (
    <div className="h-9 w-9 rounded-xl bg-orange-500/15 border border-orange-500/20 flex items-center justify-center shrink-0">
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" fill="#F9AB00"/>
      </svg>
    </div>
  );
}

function GoogleAdsIcon() {
  return (
    <div className="h-9 w-9 rounded-xl bg-white/5 border border-border/40 flex items-center justify-center shrink-0">
      <svg viewBox="0 0 24 24" className="h-5 w-5">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
      </svg>
    </div>
  );
}

function CartPandaIcon() {
  return <div className="h-9 w-9 rounded-xl bg-violet-600 flex items-center justify-center shrink-0"><ShoppingCart className="h-4 w-4 text-white" /></div>;
}

function ShopifyIcon() {
  return (
    <div className="h-9 w-9 rounded-xl bg-[#95BF47] flex items-center justify-center shrink-0">
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="white">
        <path d="M15.337 4.093c-.006-.044-.044-.069-.081-.075-.038 0-1.031-.019-1.031-.019s-.819-.8-.9-.881c-.081-.081-.244-.056-.306-.038l-.425.132c-.25-.719-.694-1.381-1.469-1.381h-.069c-.219-.281-.494-.406-.731-.406-1.806 0-2.675 2.256-2.95 3.4l-1.262.393c-.394.119-.406.131-.45.506L5 15.906l8.763 1.594 4.762-1.025L15.337 4.093z"/>
      </svg>
    </div>
  );
}

function YampiIcon() {
  return <div className="h-9 w-9 rounded-xl bg-emerald-500/20 border border-emerald-500/20 flex items-center justify-center shrink-0"><span className="text-emerald-400 font-black text-sm">Y</span></div>;
}

function WooIcon() {
  return <div className="h-9 w-9 rounded-xl bg-purple-600/20 border border-purple-500/20 flex items-center justify-center shrink-0"><span className="text-purple-400 font-black text-xs">WC</span></div>;
}

function HotmartIcon() {
  return <div className="h-9 w-9 rounded-xl bg-red-500/20 border border-red-500/20 flex items-center justify-center shrink-0"><span className="text-red-400 font-black text-sm">H</span></div>;
}

function GreenIcon() {
  return <div className="h-9 w-9 rounded-xl bg-green-500/20 border border-green-500/20 flex items-center justify-center shrink-0"><span className="text-green-400 font-black text-sm">G</span></div>;
}

function TictoIcon() {
  return <div className="h-9 w-9 rounded-xl bg-sky-500/20 border border-sky-500/20 flex items-center justify-center shrink-0"><span className="text-sky-400 font-black text-sm">T</span></div>;
}

function KiwifyIcon() {
  return <div className="h-9 w-9 rounded-xl bg-emerald-600/20 border border-emerald-500/20 flex items-center justify-center shrink-0"><span className="text-emerald-400 font-black text-sm">Ki</span></div>;
}

function KirvanoIcon() {
  return <div className="h-9 w-9 rounded-xl bg-indigo-500/20 border border-indigo-500/20 flex items-center justify-center shrink-0"><span className="text-indigo-400 font-black text-sm">Kv</span></div>;
}

function LastlinkIcon() {
  return <div className="h-9 w-9 rounded-xl bg-blue-500/20 border border-blue-500/20 flex items-center justify-center shrink-0"><span className="text-blue-400 font-black text-sm">Ll</span></div>;
}

function PagTrustIcon() {
  return <div className="h-9 w-9 rounded-xl bg-orange-500/20 border border-orange-500/20 flex items-center justify-center shrink-0"><span className="text-orange-400 font-black text-xs">PT</span></div>;
}

function HublaIcon() {
  return <div className="h-9 w-9 rounded-xl bg-violet-500/20 border border-violet-500/20 flex items-center justify-center shrink-0"><span className="text-violet-400 font-black text-sm">Hu</span></div>;
}

function EduzzIcon() {
  return <div className="h-9 w-9 rounded-xl bg-cyan-500/20 border border-cyan-500/20 flex items-center justify-center shrink-0"><span className="text-cyan-400 font-black text-sm">Ed</span></div>;
}

function PerfectPayIcon() {
  return <div className="h-9 w-9 rounded-xl bg-pink-500/20 border border-pink-500/20 flex items-center justify-center shrink-0"><span className="text-pink-400 font-black text-xs">PP</span></div>;
}

function PaytIcon() {
  return <div className="h-9 w-9 rounded-xl bg-teal-500/20 border border-teal-500/20 flex items-center justify-center shrink-0"><span className="text-teal-400 font-black text-sm">Pt</span></div>;
}

// ─── Unused exports kept for import compatibility ─────────────────────────────
export { MetaIcon, TikTokIcon, GA4Icon, GoogleAdsIcon };
