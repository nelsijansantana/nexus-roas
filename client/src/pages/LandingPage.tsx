import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { PLANS, PAID_PLANS, formatPrice } from "@/lib/plans";
import {
  Zap, Check, ChevronRight, BarChart2, Globe, ShieldCheck,
  Users, TrendingUp, Layers, Clock, ArrowRight, Menu, X,
  Star, Facebook, Smartphone, RefreshCw, Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function GradientText({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("bg-gradient-to-r from-indigo-400 via-violet-400 to-cyan-400 bg-clip-text text-transparent", className)}>
      {children}
    </span>
  );
}

// ─── Navbar ───────────────────────────────────────────────────────────────────

function Navbar() {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/5 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="relative h-8 w-8 shrink-0">
              <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 opacity-30 blur-md" />
              <div className="relative h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
                <Zap className="h-4 w-4 text-white" strokeWidth={2.5} />
              </div>
            </div>
            <span className="font-bold text-lg tracking-tight text-white">Nexus ROAS</span>
          </div>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-8 text-sm text-white/60">
            <a href="#features" className="hover:text-white transition-colors">Funcionalidades</a>
            <a href="#how" className="hover:text-white transition-colors">Como funciona</a>
            <a href="#pricing" className="hover:text-white transition-colors">Planos</a>
            <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
          </nav>

          {/* CTA */}
          <div className="hidden md:flex items-center gap-3">
            {token ? (
              <Link
                to="/dashboard"
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 text-white text-sm font-semibold hover:opacity-90 transition-all shadow-lg shadow-indigo-500/25"
              >
                Acessar painel
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            ) : (
              <>
                <Link to="/login" className="text-sm text-white/70 hover:text-white transition-colors px-3 py-2">
                  Entrar
                </Link>
                <Link
                  to="/register"
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 text-white text-sm font-semibold hover:opacity-90 transition-all shadow-lg shadow-indigo-500/25"
                >
                  Começar grátis
                </Link>
              </>
            )}
          </div>

          {/* Mobile toggle */}
          <button onClick={() => setOpen(!open)} className="md:hidden text-white/60 hover:text-white">
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Mobile menu */}
        {open && (
          <div className="md:hidden py-4 border-t border-white/5 space-y-3">
            {["#features", "#how", "#pricing", "#faq"].map((href, i) => (
              <a key={href} href={href} onClick={() => setOpen(false)}
                className="block text-sm text-white/60 hover:text-white py-1.5 transition-colors"
              >
                {["Funcionalidades", "Como funciona", "Planos", "FAQ"][i]}
              </a>
            ))}
            <div className="pt-2 flex flex-col gap-2">
              <Link to="/login" className="text-center text-sm text-white/70 hover:text-white py-2 border border-white/10 rounded-xl">Entrar</Link>
              <Link to="/register" className="text-center text-sm font-semibold text-white py-2 bg-gradient-to-r from-indigo-500 to-violet-600 rounded-xl">Começar grátis</Link>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="relative pt-32 pb-24 px-4 overflow-hidden">
      {/* Background glows */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-[600px] w-[600px] rounded-full bg-indigo-600/10 blur-[120px]" />
      <div className="pointer-events-none absolute top-20 right-0 h-80 w-80 rounded-full bg-violet-600/8 blur-[100px]" />

      <div className="mx-auto max-w-4xl text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-xs font-semibold uppercase tracking-widest mb-8">
          <Zap className="h-3 w-3" />
          Server-Side Tracking — Meta CAPI + TikTok
        </div>

        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-white leading-[1.05] mb-6">
          Rastreie cada venda.{" "}
          <br className="hidden sm:block" />
          <GradientText>Maximize seu ROAS.</GradientText>
        </h1>

        <p className="text-lg sm:text-xl text-white/50 max-w-2xl mx-auto mb-10 leading-relaxed">
          Nexus ROAS conecta seu checkout ao Meta e TikTok via server-side events, recuperando vendas perdidas pelo bloqueio de cookies e melhorando a atribuição das suas campanhas.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to="/register"
            className="group flex items-center gap-2 px-8 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-bold text-base hover:opacity-90 active:scale-[0.98] transition-all shadow-2xl shadow-indigo-500/30"
          >
            Criar conta grátis
            <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
          <a
            href="#pricing"
            className="flex items-center gap-2 px-8 py-3.5 rounded-2xl border border-white/10 bg-white/5 text-white/80 font-medium text-base hover:bg-white/10 transition-all"
          >
            Ver planos e preços
          </a>
        </div>

        <p className="text-xs text-white/30 mt-4">
          Sem cartão de crédito • Trial de 14 dias • Cancele quando quiser
        </p>
      </div>

      {/* Mock dashboard preview */}
      <div className="mx-auto max-w-5xl mt-16 relative">
        <div className="relative rounded-2xl border border-white/10 bg-gradient-to-b from-slate-800/80 to-slate-900/80 p-4 shadow-2xl shadow-black/50 backdrop-blur-sm overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-500/40 to-transparent" />
          {/* Mock header */}
          <div className="flex items-center gap-2 mb-4">
            <div className="h-3 w-3 rounded-full bg-red-500/60" />
            <div className="h-3 w-3 rounded-full bg-yellow-500/60" />
            <div className="h-3 w-3 rounded-full bg-green-500/60" />
            <div className="ml-4 flex-1 h-6 rounded-lg bg-white/5 max-w-xs" />
          </div>
          {/* Mock metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            {[
              { label: "Receita Bruta", value: "R$ 48.320", color: "text-emerald-400" },
              { label: "Total Vendas", value: "312", color: "text-indigo-400" },
              { label: "Ticket Médio", value: "R$ 154,87", color: "text-amber-400" },
              { label: "Fontes UTM", value: "7", color: "text-violet-400" },
            ].map((m) => (
              <div key={m.label} className="rounded-xl bg-white/5 border border-white/5 p-3">
                <p className="text-[10px] text-white/30 uppercase tracking-wider">{m.label}</p>
                <p className={`text-lg font-bold ${m.color} mt-0.5`}>{m.value}</p>
              </div>
            ))}
          </div>
          {/* Mock chart bars */}
          <div className="h-28 rounded-xl bg-white/5 border border-white/5 flex items-end gap-1 px-3 py-2 overflow-hidden">
            {[40, 65, 45, 80, 55, 90, 70, 85, 60, 95, 75, 88, 50, 72].map((h, i) => (
              <div
                key={i}
                className="flex-1 rounded-t-sm opacity-70"
                style={{
                  height: `${h}%`,
                  background: `hsl(${243 + i * 3}, 85%, ${50 + i}%)`,
                }}
              />
            ))}
          </div>
        </div>
        {/* Glow under mockup */}
        <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 h-20 w-3/4 bg-indigo-500/15 blur-2xl rounded-full" />
      </div>
    </section>
  );
}

// ─── Stats bar ────────────────────────────────────────────────────────────────

function StatsBar() {
  const stats = [
    { value: "98%", label: "Taxa de match de eventos" },
    { value: "+35%", label: "Melhoria média no ROAS" },
    { value: "<1s", label: "Latência de disparo CAPI" },
    { value: "99,9%", label: "Uptime garantido" },
  ];
  return (
    <section className="py-12 border-y border-white/5 bg-white/[0.02]">
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-3xl font-bold text-white">{s.value}</p>
              <p className="text-sm text-white/40 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Features ─────────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: Facebook,
    title: "Meta CAPI nativo",
    desc: "Disparo server-side de Purchase, Lead, ViewContent e mais. SHA-256 automático em todos os dados PII.",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
  },
  {
    icon: Smartphone,
    title: "TikTok Events API",
    desc: "Integração completa com a TikTok Events API. Mesmo lead, múltiplos pixels, nenhum evento perdido.",
    color: "text-pink-400",
    bg: "bg-pink-500/10",
  },
  {
    icon: BarChart2,
    title: "Analytics por UTM",
    desc: "Veja receita por fonte, campanha, adset e criativo. Descubra exatamente de onde vem cada real.",
    color: "text-indigo-400",
    bg: "bg-indigo-500/10",
  },
  {
    icon: Layers,
    title: "Multi-checkout",
    desc: "Shopify, CartPanda, Yampi, WooCommerce — um único pixel rastreia tudo com webhooks dedicados.",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
  },
  {
    icon: Users,
    title: "Times e permissões",
    desc: "Convide analistas e gestores com roles customizados. Cada um vê apenas o que precisa.",
    color: "text-violet-400",
    bg: "bg-violet-500/10",
  },
  {
    icon: ShieldCheck,
    title: "LGPD compliant",
    desc: "Hashing SHA-256 de PII antes de enviar para qualquer plataforma. Dados nunca saem em texto claro.",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
  },
  {
    icon: RefreshCw,
    title: "Deduplicação automática",
    desc: "Combinamos eventos de browser e server usando o mesmo event_id para evitar contagem dupla.",
    color: "text-cyan-400",
    bg: "bg-cyan-500/10",
  },
  {
    icon: Lock,
    title: "Sem dependência de cookies",
    desc: "Server-side puro. iOS, extensões de bloqueio de anúncios, navegação anônima — nada escapa.",
    color: "text-rose-400",
    bg: "bg-rose-500/10",
  },
];

function Features() {
  return (
    <section id="features" className="py-24 px-4">
      <div className="mx-auto max-w-7xl">
        <div className="text-center mb-16">
          <p className="text-xs font-semibold uppercase tracking-widest text-indigo-400 mb-3">Plataforma completa</p>
          <h2 className="text-4xl font-bold text-white mb-4">
            Tudo que você precisa para <GradientText>escalar com dados reais</GradientText>
          </h2>
          <p className="text-white/40 max-w-xl mx-auto">
            Do tracking ao analytics — uma única plataforma para maximizar o retorno das suas campanhas.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="group rounded-2xl border border-white/8 bg-white/[0.03] p-5 hover:border-white/15 hover:bg-white/[0.05] transition-all"
            >
              <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center mb-4", f.bg)}>
                <f.icon className={cn("h-5 w-5", f.color)} />
              </div>
              <h3 className="font-semibold text-white mb-2">{f.title}</h3>
              <p className="text-sm text-white/40 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── How it works ─────────────────────────────────────────────────────────────

function HowItWorks() {
  const steps = [
    {
      n: "01",
      title: "Crie seu projeto",
      desc: "Configure o nome, domínio e checkout da sua loja. Em 2 minutos o pixel está pronto para instalar.",
      icon: Layers,
    },
    {
      n: "02",
      title: "Instale o pixel",
      desc: "Cole o script no seu tema Shopify ou CartPanda. Configure o Custom Pixel com o código gerado.",
      icon: Globe,
    },
    {
      n: "03",
      title: "Conecte Meta & TikTok",
      desc: "Adicione o Pixel ID e o Access Token de cada plataforma. Ative o test event para validar.",
      icon: Zap,
    },
    {
      n: "04",
      title: "Veja seus dados",
      desc: "Receita por fonte, campanha e método de pagamento em tempo real. Tome decisões com dados reais.",
      icon: TrendingUp,
    },
  ];

  return (
    <section id="how" className="py-24 px-4 bg-white/[0.02] border-y border-white/5">
      <div className="mx-auto max-w-7xl">
        <div className="text-center mb-16">
          <p className="text-xs font-semibold uppercase tracking-widest text-indigo-400 mb-3">Simples de configurar</p>
          <h2 className="text-4xl font-bold text-white mb-4">
            Do zero ao tracking em <GradientText>menos de 10 minutos</GradientText>
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((s, i) => (
            <div key={s.n} className="relative">
              {i < steps.length - 1 && (
                <div className="hidden lg:block absolute top-5 left-[calc(100%_-_1rem)] w-8 h-px bg-gradient-to-r from-white/20 to-transparent" />
              )}
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                  <s.icon className="h-5 w-5 text-indigo-400" />
                </div>
                <span className="text-xs font-bold text-indigo-400/60 tracking-widest">{s.n}</span>
              </div>
              <h3 className="font-semibold text-white mb-2">{s.title}</h3>
              <p className="text-sm text-white/40 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Pricing ──────────────────────────────────────────────────────────────────

function Pricing() {
  const [annual, setAnnual] = useState(false);
  const navigate = useNavigate();
  const { token } = useAuth();

  const handleCta = (planId: string) => {
    if (planId === "free") {
      navigate("/register");
    } else if (token) {
      navigate(`/upgrade?plan=${planId}&interval=${annual ? "annual" : "monthly"}`);
    } else {
      navigate(`/register?plan=${planId}`);
    }
  };

  return (
    <section id="pricing" className="py-24 px-4">
      <div className="mx-auto max-w-7xl">
        <div className="text-center mb-12">
          <p className="text-xs font-semibold uppercase tracking-widest text-indigo-400 mb-3">Planos transparentes</p>
          <h2 className="text-4xl font-bold text-white mb-4">
            Comece grátis, <GradientText>escale quando precisar</GradientText>
          </h2>
          <p className="text-white/40 max-w-xl mx-auto mb-8">
            Todas as integrações em todos os planos. Você só paga pelo volume que precisar.
          </p>

          {/* Annual toggle */}
          <div className="inline-flex items-center gap-3 p-1 rounded-xl bg-white/5 border border-white/10">
            <button
              onClick={() => setAnnual(false)}
              className={cn("px-4 py-1.5 rounded-lg text-sm font-medium transition-all", !annual ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60")}
            >
              Mensal
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={cn("px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2", annual ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60")}
            >
              Anual
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded-full">-20%</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {Object.values(PLANS).map((plan) => {
            const price = annual ? plan.priceAnnual : plan.priceMonthly;
            return (
              <div
                key={plan.id}
                className={cn(
                  "relative flex flex-col rounded-2xl border p-6 transition-all",
                  plan.popular
                    ? "border-indigo-500/50 bg-gradient-to-b from-indigo-500/10 to-transparent shadow-xl shadow-indigo-500/10"
                    : "border-white/8 bg-white/[0.03] hover:border-white/15"
                )}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-indigo-500 to-violet-600 text-white text-xs font-bold shadow-lg">
                    <Star className="h-3 w-3 fill-current" />
                    Mais popular
                  </div>
                )}

                <div className="mb-4">
                  <p className="text-sm font-semibold text-white/70 mb-1">{plan.name}</p>
                  <div className="flex items-end gap-1">
                    <span className="text-3xl font-bold text-white">
                      {price === 0 ? "Grátis" : `R$${Math.round(price)}`}
                    </span>
                    {price > 0 && <span className="text-white/30 text-sm mb-1">/mês</span>}
                  </div>
                  {annual && price > 0 && (
                    <p className="text-xs text-emerald-400 mt-0.5">Cobrado R${Math.round(price * 12)}/ano</p>
                  )}
                </div>

                {/* Limits summary */}
                <div className="flex flex-col gap-1 mb-5 pb-5 border-b border-white/8">
                  <p className="text-xs text-white/40">
                    {plan.projects === -1 ? "∞ projetos" : `${plan.projects} ${plan.projects === 1 ? "projeto" : "projetos"}`}
                  </p>
                  <p className="text-xs text-white/40">
                    {plan.salesPerMonth === -1 ? "∞ vendas/mês" : `${plan.salesPerMonth.toLocaleString("pt-BR")} vendas/mês`}
                  </p>
                  <p className="text-xs text-white/40">
                    {plan.seats === -1 ? "∞ usuários" : `${plan.seats} ${plan.seats === 1 ? "usuário" : "usuários"}`}
                  </p>
                </div>

                {/* Features */}
                <ul className="space-y-2.5 flex-1 mb-6">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-xs text-white/55">
                      <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleCta(plan.id)}
                  className={cn(
                    "w-full py-2.5 rounded-xl text-sm font-semibold transition-all",
                    plan.popular
                      ? "bg-gradient-to-r from-indigo-500 to-violet-600 text-white hover:opacity-90 shadow-lg shadow-indigo-500/25"
                      : plan.id === "free"
                      ? "border border-white/15 text-white/70 hover:bg-white/5"
                      : "border border-white/15 text-white hover:bg-white/5"
                  )}
                >
                  {plan.id === "free" ? "Criar conta grátis" : `Iniciar trial de 14 dias`}
                </button>
              </div>
            );
          })}
        </div>

        <p className="text-center text-xs text-white/25 mt-6">
          Todos os planos incluem todas as integrações • Cancele quando quiser • Sem taxa de setup
        </p>
      </div>
    </section>
  );
}

// ─── FAQ ──────────────────────────────────────────────────────────────────────

const FAQ_ITEMS = [
  {
    q: "O que é rastreamento server-side (CAPI)?",
    a: "É o envio de eventos de conversão diretamente do servidor para Meta e TikTok, sem depender do navegador. Isso garante que vendas bloqueadas por iOS, adblockers ou falhas de cookie sejam registradas.",
  },
  {
    q: "Preciso de conhecimento técnico para instalar?",
    a: "Não. O assistente de configuração guia você em cada etapa. Para Shopify basta colar um script no tema. Para CartPanda o processo é igualmente simples com nosso script dedicado.",
  },
  {
    q: "Como funciona o trial de 14 dias?",
    a: "Você começa com acesso completo ao plano escolhido por 14 dias sem cobrança. Não é necessário cartão de crédito para alguns planos, e você cancela quando quiser antes do trial acabar.",
  },
  {
    q: "Posso usar vários checkouts no mesmo pixel?",
    a: "Sim. Cada projeto suporta Shopify, CartPanda, Yampi e WooCommerce simultaneamente. Você configura qual tipo de checkout usa e os scripts corretos são gerados automaticamente.",
  },
  {
    q: "O que acontece se eu passar do limite de vendas?",
    a: "Nos planos pagos, as vendas excedentes são cobradas por evento (R$0,04 a R$0,15 dependendo do plano). No plano Free, novos eventos não são processados até o próximo mês.",
  },
  {
    q: "Meus dados estão seguros?",
    a: "Todos os dados PII (e-mail, telefone, nome) são transformados com SHA-256 antes de qualquer envio para Meta ou TikTok. Nunca armazenamos dados em texto claro.",
  },
];

function FAQ() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <section id="faq" className="py-24 px-4 bg-white/[0.02] border-t border-white/5">
      <div className="mx-auto max-w-3xl">
        <div className="text-center mb-12">
          <p className="text-xs font-semibold uppercase tracking-widest text-indigo-400 mb-3">Perguntas frequentes</p>
          <h2 className="text-4xl font-bold text-white">Ficou com dúvidas?</h2>
        </div>
        <div className="space-y-3">
          {FAQ_ITEMS.map((item, i) => (
            <div
              key={i}
              className={cn(
                "rounded-2xl border transition-all",
                open === i ? "border-white/15 bg-white/5" : "border-white/8 hover:border-white/12"
              )}
            >
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
              >
                <span className="text-sm font-medium text-white">{item.q}</span>
                <ChevronRight className={cn("h-4 w-4 text-white/30 shrink-0 transition-transform", open === i && "rotate-90")} />
              </button>
              {open === i && (
                <div className="px-5 pb-4">
                  <p className="text-sm text-white/50 leading-relaxed">{item.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Final CTA ────────────────────────────────────────────────────────────────

function FinalCTA() {
  return (
    <section className="py-24 px-4">
      <div className="mx-auto max-w-3xl text-center">
        <div className="relative rounded-3xl border border-indigo-500/20 bg-gradient-to-b from-indigo-500/8 to-transparent p-12 overflow-hidden">
          <div className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-br from-indigo-600/5 via-transparent to-violet-600/5" />
          <div className="pointer-events-none absolute -top-16 left-1/2 -translate-x-1/2 h-48 w-48 rounded-full bg-indigo-500/20 blur-3xl" />

          <div className="relative">
            <p className="text-xs font-semibold uppercase tracking-widest text-indigo-400 mb-4">Comece hoje</p>
            <h2 className="text-4xl font-bold text-white mb-4">
              Pare de perder vendas <GradientText>por tracking falho</GradientText>
            </h2>
            <p className="text-white/40 mb-8">
              Crie sua conta grátis agora e veja em tempo real as vendas que estavam sendo perdidas.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to="/register"
                className="group flex items-center gap-2 px-8 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-bold hover:opacity-90 transition-all shadow-2xl shadow-indigo-500/30"
              >
                Criar conta grátis
                <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <Link to="/login" className="text-sm text-white/50 hover:text-white transition-colors">
                Já tem uma conta? Entrar →
              </Link>
            </div>
            <p className="text-xs text-white/25 mt-4">
              Sem cartão de crédito • Trial de 14 dias nos planos pagos
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="border-t border-white/5 py-12 px-4">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <div className="h-6 w-6 rounded-md bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
              <Zap className="h-3.5 w-3.5 text-white" strokeWidth={2.5} />
            </div>
            <span className="font-bold text-white/80">Nexus ROAS</span>
          </div>
          <div className="flex items-center gap-8 text-sm text-white/30">
            <Link to="/login" className="hover:text-white/60 transition-colors">Entrar</Link>
            <Link to="/register" className="hover:text-white/60 transition-colors">Cadastro</Link>
            <Link to="/license" className="hover:text-white/60 transition-colors">Licença</Link>
            <a href="#pricing" className="hover:text-white/60 transition-colors">Planos</a>
            <a href="#faq" className="hover:text-white/60 transition-colors">FAQ</a>
          </div>
          <p className="text-xs text-white/20">© 2025 Nexus ROAS. Todos os direitos reservados.</p>
        </div>
      </div>
    </footer>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-white">
      <Navbar />
      <Hero />
      <StatsBar />
      <Features />
      <HowItWorks />
      <Pricing />
      <FAQ />
      <FinalCTA />
      <Footer />
    </div>
  );
}
