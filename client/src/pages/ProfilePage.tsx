import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { changePassword, updateTimezone } from "@/lib/api";
import { MEMBER_ROLE_LABELS, type MemberRole } from "@/lib/api";
import { getPlan } from "@/lib/plans";
import {
  User, Mail, ShieldCheck, CreditCard, Lock,
  Loader2, Check, Eye, EyeOff, Globe,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const TIMEZONES = [
  { value: "America/Sao_Paulo",    label: "Brasília (BRT, UTC-3)" },
  { value: "America/Manaus",       label: "Amazonas (AMT, UTC-4)" },
  { value: "America/Belem",        label: "Pará (BRT, UTC-3)" },
  { value: "America/Fortaleza",    label: "Fortaleza (BRT, UTC-3)" },
  { value: "America/Recife",       label: "Recife (BRT, UTC-3)" },
  { value: "America/Bahia",        label: "Salvador (BRT, UTC-3)" },
  { value: "America/Cuiaba",       label: "Cuiabá (AMT, UTC-4)" },
  { value: "America/Porto_Velho",  label: "Porto Velho (AMT, UTC-4)" },
  { value: "America/Boa_Vista",    label: "Boa Vista (AMT, UTC-4)" },
  { value: "America/Rio_Branco",   label: "Rio Branco (ACT, UTC-5)" },
  { value: "America/Noronha",      label: "Fernando de Noronha (FNT, UTC-2)" },
  { value: "America/New_York",     label: "Nova York (ET, UTC-5/-4)" },
  { value: "America/Chicago",      label: "Chicago (CT, UTC-6/-5)" },
  { value: "America/Denver",       label: "Denver (MT, UTC-7/-6)" },
  { value: "America/Los_Angeles",  label: "Los Angeles (PT, UTC-8/-7)" },
  { value: "America/Mexico_City",  label: "Cidade do México (CST, UTC-6)" },
  { value: "America/Buenos_Aires", label: "Buenos Aires (ART, UTC-3)" },
  { value: "America/Santiago",     label: "Santiago (CLT, UTC-4/-3)" },
  { value: "America/Bogota",       label: "Bogotá (COT, UTC-5)" },
  { value: "America/Lima",         label: "Lima (PET, UTC-5)" },
  { value: "Europe/London",        label: "Londres (GMT/BST, UTC+0/+1)" },
  { value: "Europe/Lisbon",        label: "Lisboa (WET/WEST, UTC+0/+1)" },
  { value: "Europe/Paris",         label: "Paris (CET/CEST, UTC+1/+2)" },
  { value: "Europe/Berlin",        label: "Berlim (CET/CEST, UTC+1/+2)" },
  { value: "Europe/Madrid",        label: "Madri (CET/CEST, UTC+1/+2)" },
  { value: "UTC",                  label: "UTC (UTC+0)" },
  { value: "Asia/Dubai",           label: "Dubai (GST, UTC+4)" },
  { value: "Asia/Tokyo",           label: "Tóquio (JST, UTC+9)" },
  { value: "Asia/Shanghai",        label: "Xangai (CST, UTC+8)" },
  { value: "Asia/Singapore",       label: "Singapura (SGT, UTC+8)" },
  { value: "Australia/Sydney",     label: "Sydney (AEDT, UTC+11/+10)" },
];

const ROLE_COLORS: Record<string, string> = {
  admin:   "bg-violet-500/10 text-violet-400 border-violet-500/20",
  analyst: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  viewer:  "bg-slate-500/10 text-slate-400 border-slate-500/20",
};

const PLAN_COLORS: Record<string, string> = {
  free:     "bg-slate-500/10 text-slate-400 border-slate-500/20",
  starter:  "bg-blue-500/10 text-blue-400 border-blue-500/20",
  pro:      "bg-violet-500/10 text-violet-400 border-violet-500/20",
  business: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  agency:   "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
};

export default function ProfilePage() {
  const { user, setTimezone } = useAuth();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [savingTimezone, setSavingTimezone] = useState(false);

  const plan = user ? getPlan((user as any).plan ?? "free") : null;
  const memberRole = user?.memberRole as MemberRole | null;

  const handleTimezoneChange = async (tz: string) => {
    setSavingTimezone(true);
    try {
      await updateTimezone(tz);
      setTimezone(tz);
      toast.success("Fuso horário atualizado");
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar fuso horário");
    } finally {
      setSavingTimezone(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("As senhas não conferem");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Nova senha deve ter pelo menos 6 caracteres");
      return;
    }
    setSubmitting(true);
    try {
      await changePassword(currentPassword, newPassword);
      toast.success("Senha alterada com sucesso");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast.error(err.message || "Erro ao alterar senha");
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) return null;

  return (
    <div className="space-y-8 animate-fade-in max-w-2xl">
      {/* Header */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-primary/70 mb-1">Conta</p>
        <h1 className="font-display text-3xl font-bold text-foreground tracking-tight">Meu Perfil</h1>
        <p className="text-sm text-muted-foreground mt-1">Informações da sua conta e configurações de segurança.</p>
      </div>

      {/* Profile info card */}
      <div className="rounded-2xl border border-border/50 bg-card/30 backdrop-blur-xl shadow-glass p-6 space-y-5">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-full bg-gradient-primary flex items-center justify-center text-xl font-bold text-white shadow-glow-sm shrink-0">
            {user.name?.charAt(0)?.toUpperCase() ?? "U"}
          </div>
          <div className="min-w-0">
            <p className="text-lg font-bold text-foreground truncate">{user.name}</p>
            <p className="text-sm text-muted-foreground truncate">{user.email}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          {/* System role */}
          <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/20 border border-border/30">
            <ShieldCheck className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Acesso</p>
              <p className="text-sm font-semibold truncate">
                {user.role === "SUPER_ADMIN" ? "Super Admin" : "Usuário"}
              </p>
            </div>
          </div>

          {/* Member role (if applicable) */}
          {memberRole ? (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/20 border border-border/30">
              <User className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Perfil no time</p>
                <div className={cn(
                  "inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase mt-0.5",
                  ROLE_COLORS[memberRole] ?? ""
                )}>
                  {MEMBER_ROLE_LABELS[memberRole]?.label ?? memberRole}
                </div>
              </div>
            </div>
          ) : plan ? (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/20 border border-border/30">
              <CreditCard className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Plano</p>
                <div className={cn(
                  "inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase mt-0.5",
                  PLAN_COLORS[(user as any).plan ?? "free"] ?? PLAN_COLORS.free
                )}>
                  {plan.name}
                </div>
              </div>
            </div>
          ) : null}

          {/* Email */}
          <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/20 border border-border/30">
            <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">E-mail</p>
              <p className="text-sm font-medium truncate">{user.email}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Change password */}
      <div className="rounded-2xl border border-border/50 bg-card/30 backdrop-blur-xl shadow-glass p-6">
        <div className="flex items-center gap-2 mb-5">
          <Lock className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Alterar Senha</h2>
        </div>

        <form onSubmit={handleChangePassword} className="space-y-4 max-w-sm">
          <div className="space-y-2">
            <Label>Senha atual</Label>
            <div className="relative">
              <Input
                type={showCurrent ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="pr-10 h-11 bg-muted/20 border-border/40"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Nova senha</Label>
            <div className="relative">
              <Input
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                required
                className="pr-10 h-11 bg-muted/20 border-border/40"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Confirmar nova senha</Label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repita a nova senha"
              required
              className={cn(
                "h-11 bg-muted/20 border-border/40",
                confirmPassword && newPassword !== confirmPassword && "border-destructive/50 focus:border-destructive"
              )}
            />
            {confirmPassword && newPassword !== confirmPassword && (
              <p className="text-xs text-destructive">As senhas não conferem</p>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting || (!!confirmPassword && newPassword !== confirmPassword)}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-primary text-white text-sm font-bold shadow-glow-sm hover:opacity-90 transition-all disabled:opacity-50"
          >
            {submitting
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Check className="h-4 w-4" />}
            Alterar Senha
          </button>
        </form>
      </div>

      {/* Timezone */}
      <div className="rounded-2xl border border-border/50 bg-card/30 backdrop-blur-xl shadow-glass p-6">
        <div className="flex items-center gap-2 mb-5">
          <Globe className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Fuso Horário</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Define como as datas do dashboard são interpretadas. Os filtros de período
          e o gráfico de receita seguirão este fuso horário.
        </p>
        <div className="flex items-center gap-3 max-w-sm">
          <Select
            value={user?.timezone || "America/Sao_Paulo"}
            onValueChange={handleTimezoneChange}
            disabled={savingTimezone}
          >
            <SelectTrigger className="h-11 bg-muted/20 border-border/40 flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-card border-border max-h-72">
              {TIMEZONES.map(tz => (
                <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {savingTimezone && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />}
        </div>
      </div>
    </div>
  );
}
