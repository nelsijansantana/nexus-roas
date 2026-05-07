import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  KeyRound,
  Copy,
  Check,
  Loader2,
  ShieldOff,
  Plus,
  Mail,
  User as UserIcon,
  Calendar,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ─── Types ────────────────────────────────────────────────────────────────────

interface License {
  id: string;
  key: string;
  email: string;
  name: string;
  tier: string;
  status: string;
  domain: string | null;
  expires_at: string | null;
  sales_this_month: number;
  created_at: string;
}

interface CreateLicensePayload {
  email: string;
  name: string;
  tier: string;
  expires_at?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TIER_OPTIONS = [
  { value: "starter",  label: "Starter" },
  { value: "pro",      label: "Pro" },
  { value: "business", label: "Business" },
  { value: "agency",   label: "Agency" },
];

const TIER_COLORS: Record<string, string> = {
  starter:  "bg-blue-500/10 text-blue-400 border-blue-500/20",
  pro:      "bg-violet-500/10 text-violet-400 border-violet-500/20",
  business: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  agency:   "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
};

const STATUS_COLORS: Record<string, string> = {
  active:  "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  expired: "bg-red-500/10 text-red-400 border-red-500/20",
  revoked: "bg-slate-500/10 text-slate-400 border-slate-500/20",
};

// ─── API helpers ──────────────────────────────────────────────────────────────

const BASE_URL = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as any).message || res.statusText);
  }
  return res.json();
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminLicenses() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const [formData, setFormData] = useState<CreateLicensePayload>({
    email: "",
    name: "",
    tier: "starter",
    expires_at: "",
  });

  // ── Auth headers helper ──
  const authHeaders = () => ({
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  });

  // ── Fetch list ──
  const { data: licenses = [], isLoading } = useQuery<License[]>({
    queryKey: ["admin-licenses"],
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}/api/v1/license/admin/list`, {
        headers: authHeaders(),
      });
      const data = await handleResponse<{ licenses: License[]; total: number }>(res);
      return data.licenses ?? [];
    },
    enabled: !!token,
  });

  // ── Create mutation ──
  const createMutation = useMutation({
    mutationFn: async (payload: CreateLicensePayload) => {
      const body: Record<string, string> = {
        email: payload.email,
        name: payload.name,
        tier: payload.tier,
      };
      if (payload.expires_at) body.expires_at = payload.expires_at;
      const res = await fetch(`${BASE_URL}/api/v1/license/admin/create`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(body),
      });
      return handleResponse<License>(res);
    },
    onSuccess: () => {
      toast.success("Licença criada com sucesso");
      queryClient.invalidateQueries({ queryKey: ["admin-licenses"] });
      setIsModalOpen(false);
      setFormData({ email: "", name: "", tier: "starter", expires_at: "" });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao criar licença");
    },
  });

  // ── Revoke mutation ──
  const revokeMutation = useMutation({
    mutationFn: async (licenseKey: string) => {
      const res = await fetch(`${BASE_URL}/api/v1/license/admin/revoke`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ key: licenseKey }),
      });
      return handleResponse<{ success: boolean }>(res);
    },
    onSuccess: () => {
      toast.success("Licença revogada");
      queryClient.invalidateQueries({ queryKey: ["admin-licenses"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao revogar licença");
    },
  });

  // ── Handlers ──
  const handleCopy = (key: string) => {
    navigator.clipboard.writeText(key).then(() => {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    });
  };

  const handleRevoke = (license: License) => {
    if (!confirm(`Revogar a licença de ${license.name} (${license.email})?`)) return;
    revokeMutation.mutate(license.key);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary/70 mb-1">Super Admin</p>
          <h1 className="font-display text-3xl font-bold text-foreground tracking-tight">Gestão de Licenças</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Crie e gerencie licenças de acesso ao Nexus ROAS.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-5 h-11 rounded-xl font-semibold text-sm text-white bg-gradient-primary shadow-glow-sm hover:shadow-glow hover:translate-y-[-1px] transition-all duration-200"
        >
          <Plus className="h-4 w-4" />
          Nova Licença
        </button>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-2 px-4 h-11 rounded-xl bg-card/30 border border-border/40 backdrop-blur-sm w-fit">
        <KeyRound className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium text-muted-foreground">
          {licenses.length} licença{licenses.length !== 1 ? "s" : ""} cadastrada{licenses.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      <div className="relative rounded-2xl border border-border/50 bg-card/30 backdrop-blur-xl shadow-glass overflow-hidden">
        {isLoading && (
          <div className="absolute inset-0 z-10 bg-background/40 backdrop-blur-[2px] flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border/40 bg-muted/30">
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Chave</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cliente</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tier</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Domínio</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Expira em</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Vendas/mês</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {licenses.length === 0 && !isLoading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-muted-foreground italic">
                    Nenhuma licença cadastrada.
                  </td>
                </tr>
              ) : (
                licenses.map((lic) => (
                  <tr
                    key={lic.id}
                    className="group hover:bg-primary/5 transition-colors duration-150"
                  >
                    {/* Key + copy */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <code className="text-xs font-mono text-muted-foreground bg-muted/30 px-2 py-1 rounded-lg border border-border/30 max-w-[160px] truncate block">
                          {lic.key}
                        </code>
                        <button
                          onClick={() => handleCopy(lic.key)}
                          title="Copiar chave"
                          className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
                        >
                          {copiedKey === lic.key ? (
                            <Check className="h-3.5 w-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    </td>

                    {/* Client info */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-gradient-primary flex items-center justify-center text-xs font-bold text-white shadow-sm ring-1 ring-primary/20 shrink-0">
                          {lic.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{lic.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{lic.email}</p>
                        </div>
                      </div>
                    </td>

                    {/* Tier */}
                    <td className="px-6 py-4">
                      <div className={cn(
                        "inline-flex items-center px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider",
                        TIER_COLORS[lic.tier] ?? "bg-slate-500/10 text-slate-400 border-slate-500/20"
                      )}>
                        {lic.tier}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4">
                      <div className={cn(
                        "inline-flex items-center px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider",
                        STATUS_COLORS[lic.status] ?? "bg-slate-500/10 text-slate-400 border-slate-500/20"
                      )}>
                        {lic.status}
                      </div>
                    </td>

                    {/* Domain */}
                    <td className="px-6 py-4">
                      <span className="text-sm text-muted-foreground">
                        {lic.domain ?? <span className="italic opacity-50">—</span>}
                      </span>
                    </td>

                    {/* Expires at */}
                    <td className="px-6 py-4">
                      {lic.expires_at ? (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Calendar className="h-3.5 w-3.5 opacity-50" />
                          {new Date(lic.expires_at).toLocaleDateString("pt-BR")}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground italic opacity-50">Vitalícia</span>
                      )}
                    </td>

                    {/* Sales this month */}
                    <td className="px-6 py-4">
                      <span className="text-sm font-semibold text-foreground">
                        {lic.sales_this_month.toLocaleString("pt-BR")}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4 text-right">
                      {lic.status !== "revoked" && (
                        <button
                          onClick={() => handleRevoke(lic)}
                          disabled={revokeMutation.isPending}
                          title="Revogar licença"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-400 border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 hover:border-red-500/40 transition-colors disabled:opacity-50"
                        >
                          {revokeMutation.isPending ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <ShieldOff className="h-3 w-3" />
                          )}
                          Revogar
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[425px] overflow-hidden bg-card/95 backdrop-blur-2xl border-border/50">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />

          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <KeyRound className="h-5 w-5 text-primary" />
              Nova Licença
            </DialogTitle>
            <DialogDescription className="sr-only">
              Preencha os dados para gerar uma nova licença de acesso.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 py-4 relative">
            <div className="space-y-2">
              <Label htmlFor="lic-name">Nome do Cliente</Label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                <Input
                  id="lic-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: João Silva"
                  required
                  className="pl-10 h-11 bg-muted/20 border-border/40 focus:border-primary/50"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="lic-email">E-mail</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                <Input
                  id="lic-email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="joao@example.com"
                  required
                  className="pl-10 h-11 bg-muted/20 border-border/40 focus:border-primary/50"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="lic-tier">Tier</Label>
              <Select
                value={formData.tier}
                onValueChange={(val) => setFormData({ ...formData, tier: val })}
              >
                <SelectTrigger className="h-11 bg-muted/20 border-border/40 focus:border-primary/50">
                  <SelectValue placeholder="Selecione o tier" />
                </SelectTrigger>
                <SelectContent className="bg-card/95 backdrop-blur-xl">
                  {TIER_OPTIONS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="lic-expires">Data de Expiração</Label>
                <span className="text-[10px] text-muted-foreground italic">(opcional — deixe em branco para vitalícia)</span>
              </div>
              <Input
                id="lic-expires"
                type="date"
                value={formData.expires_at}
                onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
                className="h-11 bg-muted/20 border-border/40 focus:border-primary/50"
              />
            </div>

            <DialogFooter className="pt-4">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted/50 rounded-lg transition-colors"
                disabled={createMutation.isPending}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="px-6 py-2 rounded-lg bg-gradient-primary text-white text-sm font-bold shadow-glow-sm hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {createMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <KeyRound className="h-4 w-4" />
                )}
                Gerar Licença
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
