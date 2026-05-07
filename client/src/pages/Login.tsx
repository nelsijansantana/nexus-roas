import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { login as apiLogin } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Zap, ShieldCheck, BarChart3 } from "lucide-react";

const features = [
  { icon: BarChart3, label: "Analytics em tempo real" },
  { icon: ShieldCheck, label: "Rastreamento server-side" },
  { icon: Zap, label: "Meta & TikTok CAPI" },
];

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await apiLogin(email, password);
      login(data.token, data.user);
      navigate("/dashboard");
    } catch (err: any) {
      setError(err.message || "Credenciais inválidas");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-background overflow-hidden">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:flex-1 relative flex-col items-center justify-center p-12 overflow-hidden">
        {/* Ambient glows */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-primary/10 blur-[128px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-accent/8 blur-[100px] pointer-events-none" />

        <div className="relative z-10 max-w-sm text-center space-y-8 animate-fade-in">
          {/* Logo mark */}
          <div className="flex items-center justify-center">
            <div className="relative h-20 w-20">
              <div className="absolute inset-0 rounded-2xl bg-gradient-primary opacity-20 blur-xl animate-pulse-glow" />
              <div className="relative h-20 w-20 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-glow">
                <Zap className="h-9 w-9 text-white" strokeWidth={2.5} />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h1 className="font-display text-5xl font-bold text-gradient-primary tracking-tight">
              Nexus ROAS
            </h1>
            <p className="text-muted-foreground text-base leading-relaxed">
              Plataforma de rastreamento avançado com Conversions API para Meta e TikTok Ads.
            </p>
          </div>

          {/* Feature pills */}
          <div className="flex flex-col gap-3">
            {features.map((f, i) => (
              <div
                key={f.label}
                className="flex items-center gap-3 px-4 py-3 rounded-xl glass border border-border/60 animate-fade-in"
                style={{ animationDelay: `${(i + 1) * 120}ms` }}
              >
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <f.icon className="h-4 w-4 text-primary" />
                </div>
                <span className="text-sm font-medium text-foreground/80">{f.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="hidden lg:block w-px bg-gradient-to-b from-transparent via-border to-transparent my-16" />

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 lg:px-16">
        <div className="w-full max-w-md space-y-8 animate-scale-in">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow-sm">
              <Zap className="h-5 w-5 text-white" strokeWidth={2.5} />
            </div>
            <span className="font-display text-2xl font-bold text-gradient-primary">Nexus ROAS</span>
          </div>

          <div className="space-y-2">
            <h2 className="font-display text-3xl font-bold text-foreground tracking-tight">
              Bem-vindo de volta
            </h2>
            <p className="text-muted-foreground text-sm">
              Entre na sua conta para continuar
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
              <Label htmlFor="email" className="text-sm font-medium text-foreground/80">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-11 bg-muted/50 border-border/60 focus:border-primary/60 focus:ring-primary/20 transition-all placeholder:text-muted-foreground/50"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-foreground/80">
                Senha
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-11 bg-muted/50 border-border/60 focus:border-primary/60 focus:ring-primary/20 transition-all placeholder:text-muted-foreground/50"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="
                relative w-full h-11 rounded-xl font-semibold text-sm text-white
                bg-gradient-primary shadow-glow-sm
                hover:shadow-glow hover:opacity-95
                active:scale-[0.98]
                disabled:opacity-60 disabled:cursor-not-allowed
                transition-all duration-200
                overflow-hidden
              "
            >
              {/* Shine overlay */}
              {!loading && <span className="absolute inset-0 animate-shine" />}
              <span className="relative flex items-center justify-center gap-2">
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {loading ? "Entrando..." : "Entrar"}
              </span>
            </button>
          </form>

          <p className="text-center text-xs text-muted-foreground">
            Plataforma restrita. Entre em contato para acesso.
          </p>
        </div>
      </div>
    </div>
  );
}
