import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  listAccountWebhooks, createAccountWebhook, updateAccountWebhook, deleteAccountWebhook,
  getProjects,
  type AccountWebhook, type Project,
} from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft, Plus, Webhook, Copy, Check, Trash2,
  Loader2, ChevronDown, AlertCircle, Pencil, X,
} from "lucide-react";

const GATEWAYS = [
  "hotmart", "kiwify", "kirvano", "cartpanda", "shopify",
  "ticto", "hubla", "greenn", "lastlink", "pagtrust",
  "eduzz", "perfectpay", "payt",
];

const GATEWAY_LABELS: Record<string, string> = {
  hotmart: "Hotmart", kiwify: "Kiwify", kirvano: "Kirvano",
  cartpanda: "CartPanda", shopify: "Shopify", ticto: "Ticto",
  hubla: "Hubla", greenn: "Greenn", lastlink: "Lastlink",
  pagtrust: "PagTrust", eduzz: "Eduzz", perfectpay: "PerfectPay", payt: "Payt",
};

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function AccountWebhooks() {
  const navigate = useNavigate();
  const [webhooks, setWebhooks]   = useState<AccountWebhook[]>([]);
  const [projects, setProjects]   = useState<Project[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listAccountWebhooks(), getProjects()])
      .then(([wh, p]) => { setWebhooks(wh); setProjects(p); })
      .catch(() => toast.error("Erro ao carregar webhooks"))
      .finally(() => setLoading(false));
  }, []);

  const handleCreated = (wh: AccountWebhook) => {
    setWebhooks(prev => [...prev, wh]);
    setShowForm(false);
    toast.success("Webhook criado!");
  };

  const handleUpdated = (wh: AccountWebhook) => {
    setWebhooks(prev => prev.map(w => w.id === wh.id ? wh : w));
    setEditingId(null);
    toast.success("Webhook atualizado!");
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remover este webhook? A URL deixará de funcionar.")) return;
    try {
      await deleteAccountWebhook(id);
      setWebhooks(prev => prev.filter(w => w.id !== id));
      toast.success("Webhook removido");
    } catch {
      toast.error("Erro ao remover webhook");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl animate-fade-in">
      {/* Header */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group"
      >
        <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
        Voltar
      </button>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground tracking-tight">
            Webhooks da Conta
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Crie URLs de webhook por gateway e associe a um ou mais projetos.
            Uma venda nunca dispara duas vezes no mesmo endpoint.
          </p>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditingId(null); }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-primary text-white text-sm font-semibold hover:opacity-90 transition-all shadow-glow-sm shrink-0"
        >
          <Plus className="h-4 w-4" />
          Novo webhook
        </button>
      </div>

      {/* Info box */}
      <div className="flex items-start gap-3 p-4 rounded-xl border border-primary/15 bg-primary/5">
        <AlertCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          <strong className="text-foreground">Como funciona:</strong> cada webhook tem uma URL única com <code className="bg-muted/50 px-1 rounded font-mono text-[11px]">?wid=</code>.
          Cadastre essa URL no painel do gateway. Quando uma venda ocorrer, o sistema dispara o CAPI
          para todos os projetos associados — e bloqueia duplicatas automaticamente.
        </p>
      </div>

      {/* Form de criação */}
      {showForm && (
        <WebhookForm
          projects={projects}
          onSave={handleCreated}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Lista */}
      {webhooks.length === 0 && !showForm ? (
        <EmptyState onNew={() => setShowForm(true)} />
      ) : (
        <div className="space-y-3">
          {webhooks.map(wh =>
            editingId === wh.id ? (
              <WebhookForm
                key={wh.id}
                webhook={wh}
                projects={projects}
                onSave={handleUpdated}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <WebhookCard
                key={wh.id}
                webhook={wh}
                projects={projects}
                onEdit={() => setEditingId(wh.id)}
                onDelete={() => handleDelete(wh.id)}
              />
            )
          )}
        </div>
      )}
    </div>
  );
}

// ─── WebhookCard ──────────────────────────────────────────────────────────────

function WebhookCard({
  webhook, projects, onEdit, onDelete,
}: {
  webhook: AccountWebhook;
  projects: Project[];
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(webhook.webhookUrl);
    setCopied(true);
    toast.success("URL copiada!");
    setTimeout(() => setCopied(false), 2000);
  };

  const associatedProjects = projects.filter(p => webhook.projectIds.includes(p.pixelId));

  return (
    <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
      {/* Header row */}
      <div className="flex items-center gap-4 px-5 py-4">
        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Webhook className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-foreground">{webhook.name}</p>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted/50 text-muted-foreground">
              {GATEWAY_LABELS[webhook.gateway] ?? webhook.gateway}
            </span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
              {associatedProjects.length} projeto{associatedProjects.length !== 1 ? "s" : ""}
            </span>
          </div>
          <p className="text-xs text-muted-foreground font-mono truncate mt-0.5">
            {webhook.webhookUrl}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={copy}
            className={cn(
              "h-8 w-8 rounded-lg border flex items-center justify-center transition-all",
              copied
                ? "border-success/40 bg-success/10 text-success"
                : "border-border/60 bg-muted/30 text-muted-foreground hover:text-foreground"
            )}
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={onEdit}
            className="h-8 w-8 rounded-lg border border-border/60 bg-muted/30 text-muted-foreground hover:text-foreground flex items-center justify-center transition-all"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onDelete}
            className="h-8 w-8 rounded-lg border border-border/60 bg-muted/30 text-muted-foreground hover:text-destructive flex items-center justify-center transition-all"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => setExpanded(e => !e)} className="text-muted-foreground hover:text-foreground transition-colors">
            <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", expanded && "rotate-180")} />
          </button>
        </div>
      </div>

      {/* Expanded: projetos associados */}
      {expanded && (
        <div className="border-t border-border/40 px-5 py-4 bg-muted/5 space-y-3 animate-fade-in">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Projetos associados
          </p>
          {associatedProjects.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum projeto associado.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {associatedProjects.map(p => (
                <div key={p.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border/40 bg-muted/20">
                  <div className="h-5 w-5 rounded-md bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                    {p.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-xs font-medium text-foreground">{p.name}</span>
                  {p.domain && <span className="text-[10px] text-muted-foreground">{p.domain}</span>}
                </div>
              ))}
            </div>
          )}
          <div className="pt-1">
            <p className="text-[10px] text-muted-foreground">
              ID do endpoint: <code className="font-mono bg-muted/50 px-1 rounded">{webhook.id}</code>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── WebhookForm ──────────────────────────────────────────────────────────────

function WebhookForm({
  webhook, projects, onSave, onCancel,
}: {
  webhook?: AccountWebhook;
  projects: Project[];
  onSave: (wh: AccountWebhook) => void;
  onCancel: () => void;
}) {
  const [name, setName]           = useState(webhook?.name ?? "");
  const [gateway, setGateway]     = useState(webhook?.gateway ?? "hotmart");
  const [selected, setSelected]   = useState<string[]>(webhook?.projectIds ?? []);
  const [saving, setSaving]       = useState(false);

  const toggleProject = (pixelId: string) => {
    setSelected(prev =>
      prev.includes(pixelId) ? prev.filter(id => id !== pixelId) : [...prev, pixelId]
    );
  };

  const handleSubmit = async () => {
    if (!name.trim()) { toast.error("Informe um nome"); return; }
    if (selected.length === 0) { toast.error("Selecione ao menos um projeto"); return; }

    setSaving(true);
    try {
      const result = webhook
        ? await updateAccountWebhook(webhook.id, { name, gateway, projectIds: selected })
        : await createAccountWebhook({ name, gateway, projectIds: selected });
      onSave(result);
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar webhook");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-primary/25 bg-card shadow-glow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border/40 bg-muted/5">
        <p className="text-sm font-semibold text-foreground">
          {webhook ? "Editar webhook" : "Novo webhook"}
        </p>
        <button onClick={onCancel} className="text-muted-foreground hover:text-foreground transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="px-5 py-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Nome */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-foreground/80">Nome</Label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex: Hotmart — Produto Principal"
              className="h-10 bg-muted/40 border-border/60"
            />
          </div>
          {/* Gateway */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-foreground/80">Gateway</Label>
            <select
              value={gateway}
              onChange={e => setGateway(e.target.value)}
              className="h-10 w-full rounded-md border border-border/60 bg-muted/40 px-3 text-sm text-foreground focus:outline-none focus:border-primary/60"
            >
              {GATEWAYS.map(g => (
                <option key={g} value={g}>{GATEWAY_LABELS[g] ?? g}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Projetos */}
        <div className="space-y-2">
          <Label className="text-xs font-medium text-foreground/80">
            Projetos associados
            <span className="text-muted-foreground ml-1 font-normal">(CAPI dispara em todos)</span>
          </Label>
          {/* Warning when projects with different domains are selected — data leak risk */}
          {selected.length > 1 && (() => {
            const selectedProjects = projects.filter(p => selected.includes(p.pixelId));
            const domains = new Set(selectedProjects.map(p => p.domain || p.name));
            if (domains.size > 1) {
              return (
                <div className="flex items-start gap-2 p-3 rounded-lg border border-destructive/30 bg-destructive/5">
                  <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
                  <p className="text-[11px] text-destructive leading-relaxed">
                    <strong>Atenção — projetos de lojas diferentes selecionados.</strong> Cada compra será enviada para o GA4, Meta e TikTok de <strong>todos</strong> os projetos marcados. Selecione apenas os projetos da mesma loja para evitar vazamento de dados entre clientes.
                  </p>
                </div>
              );
            }
            return null;
          })()}
          {projects.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum projeto encontrado.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {projects.map(p => {
                const checked = selected.includes(p.pixelId);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggleProject(p.pixelId)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-all",
                      checked
                        ? "border-primary/40 bg-primary/5 text-foreground"
                        : "border-border/40 bg-muted/20 text-muted-foreground hover:border-border/60"
                    )}
                  >
                    <div className={cn(
                      "h-4 w-4 rounded border-2 flex items-center justify-center shrink-0 transition-all",
                      checked ? "border-primary bg-primary" : "border-border/60"
                    )}>
                      {checked && <Check className="h-2.5 w-2.5 text-white" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">{p.name}</p>
                      {p.domain && <p className="text-[10px] text-muted-foreground truncate">{p.domain}</p>}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onCancel}
            className="px-4 h-9 rounded-lg border border-border/60 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-2 px-5 h-9 rounded-lg bg-gradient-primary text-white text-sm font-semibold hover:opacity-90 disabled:opacity-60 transition-all shadow-glow-sm"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── EmptyState ───────────────────────────────────────────────────────────────

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="rounded-xl border border-dashed border-border/60 bg-card p-12 flex flex-col items-center gap-4 text-center">
      <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
        <Webhook className="h-6 w-6 text-primary" />
      </div>
      <div>
        <p className="font-semibold text-foreground">Nenhum webhook configurado</p>
        <p className="text-sm text-muted-foreground mt-1">
          Crie endpoints de webhook por gateway e associe aos seus projetos.
        </p>
      </div>
      <button
        onClick={onNew}
        className="flex items-center gap-2 px-5 h-9 rounded-xl bg-gradient-primary text-white text-sm font-semibold hover:opacity-90 transition-all shadow-glow-sm"
      >
        <Plus className="h-4 w-4" />
        Criar primeiro webhook
      </button>
    </div>
  );
}
