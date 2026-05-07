import { useEffect, useState } from "react";
import {
  adminListUsers,
  adminCreateUser,
  adminUpdateUser,
  adminDeleteUser,
  adminGetUserConsumption,
  type AdminUser,
  type UserConsumption,
} from "@/lib/api";
import {
  UserPlus,
  Mail,
  User as UserIcon,
  ShieldCheck,
  Calendar,
  Layers,
  MoreVertical,
  Pencil,
  Trash2,
  Loader2,
  Search,
  Check,
  BarChart2,
  CreditCard,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const PLAN_OPTIONS = [
  { value: "free",     label: "Free — R$0" },
  { value: "starter",  label: "Starter — R$97/mês" },
  { value: "pro",      label: "Pro — R$197/mês" },
  { value: "business", label: "Business — R$397/mês" },
  { value: "agency",   label: "Agency — R$797/mês" },
];

const PLAN_COLORS: Record<string, string> = {
  free:     "bg-slate-500/10 text-slate-400 border-slate-500/20",
  starter:  "bg-blue-500/10 text-blue-400 border-blue-500/20",
  pro:      "bg-violet-500/10 text-violet-400 border-violet-500/20",
  business: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  agency:   "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
};

export default function AdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [consumptionUser, setConsumptionUser] = useState<UserConsumption | null>(null);
  const [loadingConsumption, setLoadingConsumption] = useState(false);
  const [isConsumptionOpen, setIsConsumptionOpen] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "USER",
    plan: "free",
  });

  const loadUsers = () => {
    setLoading(true);
    adminListUsers()
      .then(setUsers)
      .catch((err) => toast.error("Erro ao carregar usuários: " + err.message))
      .finally(() => setLoading(false));
  };

  useEffect(loadUsers, []);

  const handleOpenModal = (user?: AdminUser) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        name: user.name,
        email: user.email,
        password: "",
        role: user.role,
        plan: user.plan ?? "free",
      });
    } else {
      setEditingUser(null);
      setFormData({ name: "", email: "", password: "", role: "USER", plan: "free" });
    }
    setIsModalOpen(true);
  };

  const handleOpenConsumption = async (user: AdminUser) => {
    setIsConsumptionOpen(true);
    setConsumptionUser(null);
    setLoadingConsumption(true);
    try {
      const data = await adminGetUserConsumption(user.id);
      setConsumptionUser(data);
    } catch (err: any) {
      toast.error("Erro ao carregar consumo: " + err.message);
      setIsConsumptionOpen(false);
    } finally {
      setLoadingConsumption(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingUser) {
        // Update
        const payload = { ...formData };
        if (!payload.password) delete (payload as any).password;
        await adminUpdateUser(editingUser.id, payload);
        toast.success("Usuário atualizado com sucesso");
      } else {
        // Create
        if (!formData.password) throw new Error("Senha é obrigatória para novos usuários");
        await adminCreateUser(formData);
        toast.success("Usuário criado com sucesso");
      }
      setIsModalOpen(false);
      loadUsers();
    } catch (err: any) {
      toast.error(err.message || "Erro na operação");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Tem certeza que deseja excluir a conta de ${name}?`)) return;
    try {
      await adminDeleteUser(id);
      toast.success("Usuário excluído");
      loadUsers();
    } catch (err: any) {
      toast.error(err.message || "Erro ao excluir");
    }
  };

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary/70 mb-1">Super Admin</p>
          <h1 className="font-display text-3xl font-bold text-foreground tracking-tight">Gestão de Contas</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Administre todos os usuários e permissões do Nexus ROAS.
          </p>
        </div>

        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 px-5 h-11 rounded-xl font-semibold text-sm text-white bg-gradient-primary shadow-glow-sm hover:shadow-glow hover:translate-y-[-1px] transition-all duration-200"
        >
          <UserPlus className="h-4 w-4" />
          Novo Usuário
        </button>
      </div>

      {/* Stats/Search bar */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1 group">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60 transition-colors group-focus-within:text-primary" />
          <input
            type="text"
            placeholder="Buscar por nome ou e-mail..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-11 pl-11 pr-4 rounded-xl border border-border/50 bg-card/50 backdrop-blur-md focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
          />
        </div>
        
        <div className="flex items-center gap-2 px-4 h-11 rounded-xl bg-card/30 border border-border/40 backdrop-blur-sm">
          <Layers className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">
            {users.length} usuários registrados
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="relative rounded-2xl border border-border/50 bg-card/30 backdrop-blur-xl shadow-glass overflow-hidden">
        {loading && (
          <div className="absolute inset-0 z-10 bg-background/40 backdrop-blur-[2px] flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border/40 bg-muted/30">
                        <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Usuário</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Permissão</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Plano</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Projetos</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Criado em</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground italic">
                    {searchTerm ? "Nenhum usuário encontrado para esta busca." : "Nenhum usuário cadastrado."}
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr
                    key={user.id}
                    className="group hover:bg-primary/5 transition-colors duration-150"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-gradient-primary flex items-center justify-center text-xs font-bold text-white shadow-sm ring-1 ring-primary/20">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{user.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {user.role === "SUPER_ADMIN" ? (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[10px] font-bold uppercase tracking-wider">
                          <ShieldCheck className="h-3 w-3" />
                          Super Admin
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/20 text-[10px] font-bold uppercase tracking-wider">
                          <UserIcon className="h-3 w-3" />
                          User
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className={cn(
                        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider",
                        PLAN_COLORS[user.plan ?? "free"] ?? PLAN_COLORS.free
                      )}>
                        <CreditCard className="h-3 w-3" />
                        {user.plan ?? "free"}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 text-sm">
                        <span className="font-semibold text-foreground">{user.projectsCount}</span>
                        <span className="text-muted-foreground text-xs">projetos</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5 opacity-50" />
                        {new Date(user.createdAt).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                            <MoreVertical className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44 backdrop-blur-xl bg-card/95 border-border/50">
                          <DropdownMenuItem
                            onClick={() => handleOpenConsumption(user)}
                            className="flex items-center gap-2 cursor-pointer"
                          >
                            <BarChart2 className="h-3.5 w-3.5" />
                            Ver Consumo
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleOpenModal(user)}
                            className="flex items-center gap-2 cursor-pointer"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Editar
                          </DropdownMenuItem>
                          {user.role !== "SUPER_ADMIN" && (
                            <DropdownMenuItem
                              onClick={() => handleDelete(user.id, user.name)}
                              className="flex items-center gap-2 cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Excluir
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Consumption Modal */}
      <Dialog open={isConsumptionOpen} onOpenChange={setIsConsumptionOpen}>
        <DialogContent className="sm:max-w-[480px] bg-card/95 backdrop-blur-2xl border-border/50">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <BarChart2 className="h-5 w-5 text-primary" />
              Consumo do Usuário
            </DialogTitle>
            <DialogDescription className="sr-only">Detalhes de consumo do plano do usuário.</DialogDescription>
          </DialogHeader>

          {loadingConsumption ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : consumptionUser ? (
            <div className="space-y-5 py-2 relative">
              {/* User info */}
              <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/20 border border-border/30">
                <div className="h-10 w-10 rounded-full bg-gradient-primary flex items-center justify-center text-sm font-bold text-white">
                  {consumptionUser.user.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-sm">{consumptionUser.user.name}</p>
                  <p className="text-xs text-muted-foreground">{consumptionUser.user.email}</p>
                </div>
                <div className={cn(
                  "ml-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase",
                  PLAN_COLORS[consumptionUser.user.plan] ?? PLAN_COLORS.free
                )}>
                  <CreditCard className="h-3 w-3" />
                  {consumptionUser.user.planName}
                </div>
              </div>

              {/* Sales usage */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Vendas este mês</span>
                  <span className="font-bold">
                    {consumptionUser.usage.salesThisMonth}
                    {consumptionUser.usage.salesLimit > 0 && (
                      <span className="text-muted-foreground font-normal"> / {consumptionUser.usage.salesLimit}</span>
                    )}
                  </span>
                </div>
                {consumptionUser.usage.salesLimit > 0 && (
                  <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        consumptionUser.usage.isOverLimit
                          ? "bg-destructive"
                          : consumptionUser.usage.percentUsed > 80
                          ? "bg-amber-500"
                          : "bg-gradient-primary"
                      )}
                      style={{ width: `${Math.min(consumptionUser.usage.percentUsed, 100)}%` }}
                    />
                  </div>
                )}
                {consumptionUser.usage.isOverLimit && (
                  <div className="flex items-center gap-1.5 text-xs text-destructive">
                    <span className="font-semibold">
                      {consumptionUser.usage.overageCount} vendas excedentes — R$ {consumptionUser.usage.overageAmount.toFixed(2)} em excedente
                    </span>
                  </div>
                )}
              </div>

              {/* Projects usage */}
              <div className="flex items-center justify-between text-sm p-3 rounded-xl bg-muted/20 border border-border/30">
                <span className="font-medium">Projetos ativos</span>
                <span className="font-bold">
                  {consumptionUser.usage.projectsUsed}
                  {consumptionUser.usage.projectsLimit !== -1 && (
                    <span className="text-muted-foreground font-normal"> / {consumptionUser.usage.projectsLimit}</span>
                  )}
                  {consumptionUser.usage.projectsLimit === -1 && (
                    <span className="text-muted-foreground font-normal"> (ilimitado)</span>
                  )}
                </span>
              </div>

              {/* Billing cycle */}
              <div className="flex items-center justify-between text-xs text-muted-foreground p-3 rounded-xl bg-muted/10 border border-border/20">
                <span>Ciclo de cobrança</span>
                <span>
                  {new Date(consumptionUser.billingCycle.start).toLocaleDateString("pt-BR")}
                  {" → "}
                  {new Date(consumptionUser.billingCycle.end).toLocaleDateString("pt-BR")}
                </span>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Admin Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[425px] overflow-hidden bg-card/95 backdrop-blur-2xl border-border/50">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
          
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              {editingUser ? (
                <>
                  <Pencil className="h-5 w-5 text-primary" />
                  Editar Usuário
                </>
              ) : (
                <>
                  <UserPlus className="h-5 w-5 text-primary" />
                  Novo Usuário
                </>
              )}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {editingUser ? "Edite os dados do usuário selecionado." : "Preencha os dados para criar uma nova conta de usuário."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 py-4 relative">
            <div className="space-y-2">
              <Label htmlFor="name">Nome Completo</Label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: João Silva"
                  required
                  className="pl-10 h-11 bg-muted/20 border-border/40 focus:border-primary/50"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                <Input
                  id="email"
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
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Senha</Label>
                {editingUser && (
                  <span className="text-[10px] text-muted-foreground italic">(Deixe em branco para manter a atual)</span>
                )}
              </div>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder={editingUser ? "••••••••" : "No mínimo 6 caracteres"}
                required={!editingUser}
                className="h-11 bg-muted/20 border-border/40 focus:border-primary/50"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Nível de Acesso</Label>
              <Select
                value={formData.role}
                onValueChange={(val) => setFormData({ ...formData, role: val })}
              >
                <SelectTrigger className="h-11 bg-muted/20 border-border/40 focus:border-primary/50">
                  <SelectValue placeholder="Selecione um nível" />
                </SelectTrigger>
                <SelectContent className="bg-card/95 backdrop-blur-xl">
                  <SelectItem value="USER">Usuário Regular (USER)</SelectItem>
                  <SelectItem value="SUPER_ADMIN">Super Administrador (SUPER_ADMIN)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="plan">Plano</Label>
              <Select
                value={formData.plan}
                onValueChange={(val) => setFormData({ ...formData, plan: val })}
              >
                <SelectTrigger className="h-11 bg-muted/20 border-border/40 focus:border-primary/50">
                  <SelectValue placeholder="Selecione o plano" />
                </SelectTrigger>
                <SelectContent className="bg-card/95 backdrop-blur-xl">
                  {PLAN_OPTIONS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="pt-4">
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
                className="px-6 py-2 rounded-lg bg-gradient-primary text-white text-sm font-bold shadow-glow-sm hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : editingUser ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <UserPlus className="h-4 w-4" />
                )}
                {editingUser ? "Salvar Alterações" : "Criar Conta"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
