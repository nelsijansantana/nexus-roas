import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, ArrowRight, Zap } from "lucide-react";
import { Link } from "react-router-dom";

export default function UpgradeSuccess() {
  const navigate = useNavigate();

  // Auto-redirect to dashboard after 6s
  useEffect(() => {
    const t = setTimeout(() => navigate("/dashboard"), 6000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="text-center max-w-md animate-fade-in">
        <div className="relative h-20 w-20 mx-auto mb-6">
          <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping" />
          <div className="relative h-20 w-20 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-400" />
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 mb-4">
          <div className="h-7 w-7 rounded-lg bg-gradient-primary flex items-center justify-center">
            <Zap className="h-4 w-4 text-white" strokeWidth={2.5} />
          </div>
          <span className="font-bold text-lg text-white">Nexus ROAS</span>
        </div>

        <h1 className="text-3xl font-bold text-white mb-3">Assinatura confirmada!</h1>
        <p className="text-white/50 mb-8">
          Seu plano foi ativado com sucesso. Agora você tem acesso completo a todos os recursos.
          Você será redirecionado automaticamente.
        </p>

        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold hover:opacity-90 transition-all shadow-lg shadow-indigo-500/25"
        >
          Ir para o painel
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
