import { useEffect, useState } from "react";
import {
  teamListMembers,
  teamCreateMember,
  teamUpdateMember,
  teamRemoveMember,
  teamGetMemberProjects,
  teamGrantProject,
  teamRevokeProject,
  type TeamMember,
  type MemberProject,
  type MemberRole,
  MEMBER_ROLE_LABELS,
} from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import {
  UserPlus, Mail, User as UserIcon, Pencil, Trash2,
  Loader2, Search, Check, MoreVertical, FolderOpen,
  ShieldCheck, BarChart2, Eye, Users, Copy, CheckCheck,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader,
  DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getPlan } from "@/lib/plans";

const ROLE_ICONS: Record<MemberRole, React.ReactNode> = {
  admin:   <ShieldCheck className="h-3.5 w-3.5" />,
  analyst: <BarChart2 className="h-3.5 w-3.5" />,
  viewer:  <Eye className="h-3.5 w-3.5" />,
};

const ROLE_COLORS: Record<MemberRole, string> = {
  admin:   "bg-violet-500/10 text-violet-400 border-violet-500/20",
  analyst: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  viewer:  "bg-slate-500/10 text-slate-400 border-slate-500/20",
};

export default function TeamPage() {
  const { user } = useAuth();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Member modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "analyst" as MemberRole });

  // Credentials modal (shown once after member creation)
  const [createdCredentials, setCreatedCredentials] = useState<{
    name: string; email: string; password: string;
  } | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Projects access modal
  const [accessMember, setAccessMember] = useState<TeamMember | null>(null);
  const [memberProjects, setMemberProjects] = useState<MemberProject[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const plan = user ? getPlan((user as any).plan ?? "free") : null;

  const load = () => {
    setLoading(true);
    teamListMembers()
      .then(setMembers)
      .catch((e) => toast.error("Erro ao carregar time: " + e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const openCreate = () => {
    setEditingMember(null);
    setForm({ name: "", email: "", password: "", role: "analyst" });
    setIsModalOpen(true);
  };

  const openEdit = (m: TeamMember) => {
    setEditingMember(m);
    setForm({ name: m.name, email: m.email, password: "", role: m.role });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingMember) {
        const payload: any = { role: form.role, name: form.name };
        if (form.password) payload.password = form.password;
        await teamUpdateMember(editingMember.membershipId, payload);
        toast.success("Membro atualizado");
        setIsModalOpen(false);
        load();
      } else {
        if (!form.password) throw new Error("Senha é obrigatória");
        await teamCreateMember(form);
        setIsModalOpen(false);
        load();
        // Show credentials modal AFTER member is created
        setCreatedCredentials({ name: form.name, email: form.email, password: form.password });
      }
    } catch (e: any) {
      toast.error(e.message || "Erro na operação");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async (m: TeamMember) => {
    if (!confirm(`Remover ${m.name} do time?`)) return;
    try {
      await teamRemoveMember(m.membershipId);
      toast.success("Membro removido");
      load();
    } catch (e: any) {
      toast.error(e.message || "Erro ao remover");
    }
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const openAccessModal = async (m: TeamMember) => {
    setAccessMember(m);
    setLoadingProjects(true);
    try {
      const projects = await teamGetMemberProjects(m.membershipId);
      setMemberProjects(projects);
    } catch (e: any) {
      toast.error("Erro ao carregar projetos: " + e.message);
    } finally {
      setLoadingProjects(false);
    }
  };

  const toggleAccess = async (project: MemberProject) => {
    if (!accessMember) return;
    setTogglingId(project.id);
    try {
      if (project.hasAccess) {
        await teamRevokeProject(accessMember.membershipId, project.id);
      } else {
        await teamGrantProject(accessMember.membershipId, project.id);
      }
      // Refresh list
      const updated = await teamGetMemberProjects(accessMember.membershipId);
      setMemberProjects(updated);
    } catch (e: any) {
      toast.error(e.message || "Erro ao atualizar acesso");
    } finally {
      setTogglingId(null);
    }
  };

  const filtered = members.filter(
    (m) =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.email.toLowerCase().includes(search.toLowerCase()),
  );

  const seatLimit = plan?.seats ?? 1;
  const seatUsed = members.length;
  const canAddMore = seatLimit === -1 || seatUsed < seatLimit;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary/70 mb-1">Conta</p>
          <h1 className="font-display text-3xl font-bold text-foreground tracking-tight">Meu Time</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie quem tem acesso à sua conta e quais projetos cada pessoa pode ver.
          </p>
        </div>

        <button
          onClick={openCreate}
          disabled={!canAddMore}
          title={!canAddMore ? `Limite de ${seatLimit} membro(s) atingido no seu plano` : undefined}
          className="flex items-center gap-2 px-5 h-11 rounded-xl font-semibold text-sm text-white bg-gradient-primary shadow-glow-sm hover:shadow-glow hover:translate-y-[-1px] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
        >
          <UserPlus className="h-4 w-4" />
          Adicionar Membro
        </button>
      </div>

      {/* Seats indicator */}
      {plan && (
        <div className="flex items-center gap-3 p-4 rounded-2xl border border-border/40 bg-card/30 backdrop-blur-sm">
          <Users className="h-5 w-5 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">
              {seatUsed} de {seatLimit === -1 ? "∞" : seatLimit} membros usados
              <span className="text-muted-foreground font-normal ml-1.5">· Plano {plan.name}</span>
            </p>
            {seatLimit !== -1 && (
              <div className="mt-1.5 h-1.5 rounded-full bg-muted/30 overflow-hidden w-48">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    seatUsed >= seatLimit ? "bg-destructive" : "bg-gradient-primary",
                  )}
                  style={{ width: `${Math.min((seatUsed / seatLimit) * 100, 100)}%` }}
                />
              </div>
            )}
          </div>
          {!canAddMore && (
            <span className="text-xs text-amber-400 font-medium shrink-0">
              Faça upgrade para adicionar mais membros
            </span>
          )}
        </div>
      )}

      {/* Search */}
      <div className="relative group max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60 transition-colors group-focus-within:text-primary" />
        <input
          type="text"
          placeholder="Buscar por nome ou e-mail..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full h-11 pl-11 pr-4 rounded-xl border border-border/50 bg-card/50 backdrop-blur-md focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
        />
      </div>

      {/* Members table */}
      <div className="relative rounded-2xl border border-border/50 bg-card/30 backdrop-blur-xl shadow-glass overflow-hidden">
        {loading && (
          <div className="absolute inset-0 z-10 bg-background/40 backdrop-blur-[2px] flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {!loading && filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
            <Users className="h-10 w-10 opacity-30" />
            <p className="text-sm italic">
              {search ? "Nenhum membro encontrado." : "Você ainda não tem membros no time."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border/40 bg-muted/30">
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Membro</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Perfil</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Permissões</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Adicionado em</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filtered.map((m) => (
                  <tr key={m.membershipId} className="group hover:bg-primary/5 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-gradient-primary flex items-center justify-center text-xs font-bold text-white shadow-sm">
                          {m.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate">{m.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className={cn(
                        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider",
                        ROLE_COLORS[m.role],
                      )}>
                        {ROLE_ICONS[m.role]}
                        {MEMBER_ROLE_LABELS[m.role].label}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-xs text-muted-foreground max-w-[200px]">
                        {MEMBER_ROLE_LABELS[m.role].description}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-xs text-muted-foreground">
                      {new Date(m.createdAt).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                            <MoreVertical className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44 backdrop-blur-xl bg-card/95 border-border/50">
                          {m.role !== "admin" && (
                            <DropdownMenuItem
                              onClick={() => openAccessModal(m)}
                              className="flex items-center gap-2 cursor-pointer"
                            >
                              <FolderOpen className="h-3.5 w-3.5" />
                              Projetos
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() => openEdit(m)}
                            className="flex items-center gap-2 cursor-pointer"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleRemove(m)}
                            className="flex items-center gap-2 cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Remover
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Credentials modal */}
      <Dialog open={!!createdCredentials} onOpenChange={(open) => { if (!open) setCreatedCredentials(null); }}>
        <DialogContent className="sm:max-w-[420px] bg-card/95 backdrop-blur-2xl border-border/50">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent pointer-events-none" />
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <Check className="h-5 w-5 text-emerald-400" />
              Membro criado com sucesso!
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Compartilhe as credenciais abaixo com <strong>{createdCredentials?.name}</strong>. A senha só é exibida agora — o membro pode alterá-la no perfil após o primeiro login.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 relative">
            {[
              { label: "E-mail", value: createdCredentials?.email ?? "", field: "email" },
              { label: "Senha temporária", value: createdCredentials?.password ?? "", field: "password" },
            ].map(({ label, value, field }) => (
              <div key={field} className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">{label}</p>
                <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/20 border border-border/30">
                  <code className="flex-1 text-sm font-mono text-foreground select-all">{value}</code>
                  <button
                    onClick={() => copyToClipboard(value, field)}
                    className="shrink-0 h-7 w-7 rounded-lg flex items-center justify-center hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                  >
                    {copiedField === field
                      ? <CheckCheck className="h-3.5 w-3.5 text-emerald-400" />
                      : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
            ))}

            <button
              onClick={() => {
                const text = `E-mail: ${createdCredentials?.email}\nSenha: ${createdCredentials?.password}`;
                copyToClipboard(text, "all");
                toast.success("Credenciais copiadas!");
              }}
              className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-border/50 text-sm font-medium hover:bg-muted/30 transition-colors"
            >
              {copiedField === "all"
                ? <><CheckCheck className="h-4 w-4 text-emerald-400" /> Copiado!</>
                : <><Copy className="h-4 w-4" /> Copiar tudo</>}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create / Edit modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[440px] bg-card/95 backdrop-blur-2xl border-border/50">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              {editingMember ? <Pencil className="h-5 w-5 text-primary" /> : <UserPlus className="h-5 w-5 text-primary" />}
              {editingMember ? "Editar Membro" : "Adicionar Membro"}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {editingMember ? "Edite os dados do membro." : "Adicione um novo membro ao seu time."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 py-4 relative">
            <div className="space-y-2">
              <Label>Nome</Label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Nome completo"
                  required
                  className="pl-10 h-11 bg-muted/20 border-border/40"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>E-mail</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="email@exemplo.com"
                  required
                  disabled={!!editingMember}
                  className="pl-10 h-11 bg-muted/20 border-border/40 disabled:opacity-50"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Senha</Label>
                {editingMember && (
                  <span className="text-[10px] text-muted-foreground italic">(Deixe em branco para manter)</span>
                )}
              </div>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder={editingMember ? "••••••••" : "Mínimo 6 caracteres"}
                required={!editingMember}
                className="h-11 bg-muted/20 border-border/40"
              />
            </div>

            <div className="space-y-2">
              <Label>Perfil de acesso</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as MemberRole })}>
                <SelectTrigger className="h-11 bg-muted/20 border-border/40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card/95 backdrop-blur-xl">
                  {(Object.entries(MEMBER_ROLE_LABELS) as [MemberRole, { label: string; description: string }][]).map(
                    ([value, { label, description }]) => (
                      <SelectItem key={value} value={value}>
                        <div>
                          <span className="font-medium">{label}</span>
                          <span className="text-muted-foreground ml-2 text-xs">— {description}</span>
                        </div>
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="pt-2">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted/50 rounded-lg transition-colors"
                disabled={submitting}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2 rounded-lg bg-gradient-primary text-white text-sm font-bold shadow-glow-sm hover:opacity-90 transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {editingMember ? "Salvar" : "Adicionar"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Project access modal */}
      <Dialog open={!!accessMember} onOpenChange={(open) => { if (!open) setAccessMember(null); }}>
        <DialogContent className="sm:max-w-[480px] bg-card/95 backdrop-blur-2xl border-border/50">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <FolderOpen className="h-5 w-5 text-primary" />
              Acesso a Projetos
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              {accessMember?.name} · <span className="capitalize">{accessMember && MEMBER_ROLE_LABELS[accessMember.role].label}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 space-y-2 relative max-h-[50vh] overflow-y-auto pr-1">
            {loadingProjects ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-7 w-7 animate-spin text-primary" />
              </div>
            ) : memberProjects.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8 italic">Nenhum projeto encontrado.</p>
            ) : (
              memberProjects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => toggleAccess(p)}
                  disabled={togglingId === p.id}
                  className={cn(
                    "w-full flex items-center justify-between gap-3 p-3.5 rounded-xl border transition-all",
                    p.hasAccess
                      ? "bg-primary/5 border-primary/30 hover:bg-primary/10"
                      : "bg-muted/10 border-border/30 hover:bg-muted/20",
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={cn(
                      "h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
                      p.hasAccess ? "bg-primary/20" : "bg-muted/30",
                    )}>
                      <FolderOpen className={cn("h-4 w-4", p.hasAccess ? "text-primary" : "text-muted-foreground")} />
                    </div>
                    <div className="text-left min-w-0">
                      <p className="text-sm font-medium truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{p.domain ?? "Sem domínio"}</p>
                    </div>
                  </div>

                  {togglingId === p.id ? (
                    <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
                  ) : (
                    <div className={cn(
                      "h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all",
                      p.hasAccess
                        ? "bg-primary border-primary"
                        : "border-border/50 bg-transparent",
                    )}>
                      {p.hasAccess && <Check className="h-3 w-3 text-white" />}
                    </div>
                  )}
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
