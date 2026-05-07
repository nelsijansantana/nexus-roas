import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { register as apiRegister } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Zap, Check, BarChart3, ShieldCheck } from "lucide-react";
import { PLANS } from "@/lib/plans";

export default function Register() {
  const [searchParams] = useSearchParams();
  const planId = searchParams.get("plan") ?? "free";
  const plan = PLANS[planId] ?? PLANS.free;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 6) { setError("A senha deve ter pelo menos 6 caracteres"); return; }
    setLoading(true);
    try {
      const data = await apiRegister(email, password, name);
      login(data.token, data.user);
      // If non-free plan selected, send to upgrade after registration
      if (planId !== "free") {
        navigate(`/upgrade?plan=${planId}`);
      } else {
        navigate("/dashboard");
      }
    } catch (err: any) {
      setError(err.message || "Erro ao criar conta");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-background overflow-hidden">
      {/* Left panel */}
      <div className="hidden lg:flex lg:flex-1 relative flex-col items-center justify-center p-12 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-primary/10 blur-[128px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-accent/8 blur-[100px] pointer-events-none" />

        <div className="relative z-10 max-w-sm text-center space-y-8 animate-fade-in">
          <div className="flex items-center justify-center">
            <div className="relative h-20 w-20">
              <div className="absolute inset-0 rounded-2xl bg-gradient-primary opacity-20 blur-xl animate-pulse-glow" />
              <div className="relative h-20 w-20 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-glow">
                <Zap className="h-9 w-9 text-white" strokeWidth={2.5} />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h1 className="font-display text-5xl font-bold text-gradient-primary tracking-tight">Nexus ROAS</h1>
            <p className="text-muted-foreground text-base leading-relaxed">
              Rastreamento server-side para Meta e TikTok. Configure em minutos, escale sem limites.
            </p>
          </div>

          {/* Selected plan highlight */}
          {planId !== "free" && (
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 text-left">
              <p className="text-xs font-semibold uppercase tracking-widest text-primary/70 mb-2">Plano selecionado</p>
              <p className="font-bold text-lg text-foreground">{plan.name}</p>
              <p className="text-sm text-muted-foreground">R${plan.priceMonthly}/mês</p>
              <ul className="mt-3 space-y-1.5">
                {plan.features.slice(0, 4).map((f) => (
                  <li key={f} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {planId === "free" && (
            <div className="flex flex-col gap-3">
              {[
                { icon: BarChart3, label: "Analytics em tempo real" },
                { icon: ShieldCheck, label: "Rastreamento server-side" },
                { icon: Zap, label: "Meta & TikTok CAPI" },
              ].map((f, i) => (
                <div key={f.label} className="flex items-center gap-3 px-4 py-3 rounded-xl glass border border-border/60 animate-fade-in" style={{ animationDelay: `${(i + 1) * 120}ms` }}>
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <f.icon className="h-4 w-4 text-primary" />
                  </div>
                  <span className="text-sm font-medium text-foreground/80">{f.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="hidden lg:block w-px bg-gradient-to-b from-transparent via-border to-transparent my-16" />

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 lg:px-16">
        <div className="w-full max-w-md space-y-8 animate-scale-in">
          <div className="lg:hidden flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow-sm">
              <Zap className="h-5 w-5 text-white" strokeWidth={2.5} />
            </div>
            <span className="font-display text-2xl font-bold text-gradient-primary">Nexus ROAS</span>
          </div>

          <div className="space-y-2">
            <h2 className="font-display text-3xl font-bold text-foreground tracking-tight">Criar conta grátis</h2>
            <p className="text-muted-foreground text-sm">
              {planId !== "free" ? `Crie sua conta para iniciar o trial do plano ${plan.name}` : "Comece a rastrear suas vendas hoje"}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="flex items-center gap-3 rounded-xl border border-destructive/20 bg-destructive/8 px-4 py-3 text-sm text-destructive animate-fade-in">
                <div className="h-1.5 w-1.5 rounded-full bg-destructive shrink-0" />
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium text-foreground/80">Nome completo</Label>
              <Input id="name" type="text" placeholder="Seu nome" value={name} onChange={(e) => setName(e.target.value)} required
                className="h-11 bg-muted/50 border-border/60 focus:border-primary/60 transition-all placeholder:text-muted-foreground/50" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-foreground/80">E-mail</Label>
              <Input id="email" type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required
                className="h-11 bg-muted/50 border-border/60 focus:border-primary/60 transition-all placeholder:text-muted-foreground/50" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-foreground/80">Senha</Label>
              <Input id="password" type="password" placeholder="Mínimo 6 caracteres" value={password} onChange={(e) => setPassword(e.target.value)} required
                className="h-11 bg-muted/50 border-border/60 focus:border-primary/60 transition-all placeholder:text-muted-foreground/50" />
            </div>

            <button
              type="submit" disabled={loading}
              className="relative w-full h-11 rounded-xl font-semibold text-sm text-white bg-gradient-primary shadow-glow-sm hover:shadow-glow hover:opacity-95 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 overflow-hidden"
            >
              {!loading && <span className="absolute inset-0 animate-shine" />}
              <span className="relative flex items-center justify-center gap-2">
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {loading ? "Criando conta..." : "Criar conta grátis"}
              </span>
            </button>

            <p className="text-center text-xs text-muted-foreground">
              Ao criar sua conta você concorda com os nossos termos de uso.
            </p>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            Já tem uma conta?{" "}
            <Link to="/login" className="text-primary hover:text-primary/80 font-medium transition-colors">
              Entrar
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
