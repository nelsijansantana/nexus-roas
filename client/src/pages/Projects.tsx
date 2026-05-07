import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getProjects, deleteProject, type Project } from "@/lib/api";
import { ProjectWizard } from "@/components/wizard/ProjectWizard";
import {
  Plus, ExternalLink, Trash2, Loader2, FolderKanban,
  Globe, CheckCircle2, XCircle, ChevronRight, Facebook, Zap, ShoppingCart,
  BarChart2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const navigate = useNavigate();

  const load = () => {
    setLoading(true);
    getProjects().then(setProjects).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Excluir "${name}"? Esta ação não pode ser desfeita.`)) return;
    setDeletingId(id);
    try {
      await deleteProject(id);
      toast.success("Projeto excluído");
      load();
    } catch (err: any) {
      toast.error(err.message || "Erro ao excluir");
    } finally {
      setDeletingId(null);
    }
  };

  const handleCreated = () => {
    load();
    // Navigate to latest project after a brief moment
    setTimeout(() => setWizardOpen(false), 500);
  };

  return (
    <div className="space-y-8">
      {/* Wizard overlay */}
      <ProjectWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onCreated={handleCreated}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 animate-fade-in">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary/70 mb-1">Gerenciar</p>
          <h1 className="font-display text-3xl font-bold text-foreground tracking-tight">Projetos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {projects.length} {projects.length === 1 ? "projeto configurado" : "projetos configurados"}
          </p>
        </div>

        <button
          onClick={() => setWizardOpen(true)}
          className="relative flex items-center gap-2 px-5 h-10 rounded-xl font-semibold text-sm text-white bg-gradient-primary shadow-glow-sm hover:shadow-glow hover:opacity-95 active:scale-[0.98] transition-all duration-200 overflow-hidden"
        >
          <span className="absolute inset-0 animate-shine" />
          <Plus className="h-4 w-4 relative" />
          <span className="relative">Novo Projeto</span>
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-32">
          <div className="flex flex-col items-center gap-4">
            <div className="relative h-12 w-12">
              <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
              <div className="relative h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">Carregando projetos...</p>
          </div>
        </div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 rounded-2xl border border-dashed border-border/50 bg-card/30 animate-fade-in">
          <div className="h-16 w-16 rounded-2xl bg-muted/40 flex items-center justify-center mb-4">
            <FolderKanban className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="font-display text-lg font-semibold text-foreground mb-1">Nenhum projeto ainda</h3>
          <p className="text-sm text-muted-foreground mb-6 text-center max-w-xs">
            Crie seu primeiro projeto com o assistente guiado e configure Meta, TikTok e gateways em minutos.
          </p>
          <button
            onClick={() => setWizardOpen(true)}
            className="flex items-center gap-2 px-5 h-10 rounded-xl bg-gradient-primary text-white text-sm font-semibold hover:opacity-90 transition-all shadow-glow-sm"
          >
            <Plus className="h-4 w-4" />
            Criar primeiro projeto
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {projects.map((p, i) => (
            <ProjectCard
              key={p.id}
              project={p}
              delay={i * 60}
              onDelete={handleDelete}
              deleting={deletingId === p.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ProjectCard({
  project: p,
  delay,
  onDelete,
  deleting,
}: {
  project: Project;
  delay: number;
  onDelete: (id: string, name: string) => void;
  deleting: boolean;
}) {
  const integrations = [
    p.hasFacebookToken || p.pixelFacebookId
      ? { label: "Meta", icon: Facebook, connected: p.hasFacebookToken }
      : null,
    p.hasTikTokToken || p.tikTokPixelId
      ? { label: "TikTok", icon: Zap, connected: p.hasTikTokToken }
      : null,
  ].filter(Boolean) as { label: string; icon: React.ElementType; connected: boolean }[];

  return (
    <div
      className="group relative flex flex-col rounded-2xl border border-border/60 bg-card shadow-card hover:shadow-card-hover hover:border-primary/25 hover:-translate-y-0.5 transition-all duration-300 overflow-hidden animate-fade-in"
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Status stripe */}
      <div className={cn(
        "absolute inset-x-0 top-0 h-0.5",
        p.isActive ? "bg-gradient-primary" : "bg-muted/50"
      )} />

      <div className="flex flex-col flex-1 p-5 gap-4 pt-6">
        {/* Top */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-display font-semibold text-foreground truncate">{p.name}</h3>
            {p.domain && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                <Globe className="h-3 w-3 shrink-0" />
                <span className="truncate">{p.domain}</span>
              </div>
            )}
          </div>
          <StatusBadge active={p.isActive} />
        </div>

        {/* Integrations */}
        {integrations.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {integrations.map((int) => (
              <div
                key={int.label}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium",
                  int.connected
                    ? "bg-primary/6 border-primary/20 text-primary/90"
                    : "bg-muted/30 border-border/40 text-muted-foreground/70"
                )}
              >
                <int.icon className="h-3 w-3" />
                {int.label}
                {int.connected
                  ? <CheckCircle2 className="h-3 w-3 text-success" />
                  : <XCircle className="h-3 w-3 opacity-40" />
                }
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-muted-foreground/60">
            <ShoppingCart className="h-3 w-3" />
            <span>Sem plataformas de tráfego</span>
          </div>
        )}

        {/* Footer */}
        <div className="mt-auto flex items-center gap-2 pt-3 border-t border-border/40">
          <Link
            to={`/projects/${p.id}`}
            className="flex items-center gap-2 h-8 px-3 rounded-lg text-xs font-medium text-foreground/80 hover:bg-primary/8 hover:text-primary transition-all"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Configurar
          </Link>
          <Link
            to={`/projects/${p.id}/dashboard`}
            className="flex items-center gap-2 h-8 px-3 rounded-lg text-xs font-medium text-muted-foreground hover:bg-emerald-500/10 hover:text-emerald-400 transition-all"
          >
            <BarChart2 className="h-3.5 w-3.5" />
            Analytics
          </Link>
          <button
            onClick={() => onDelete(p.id, p.name)}
            disabled={deleting}
            className="ml-auto h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all"
          >
            {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <div className={cn(
      "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold shrink-0",
      active ? "bg-success/10 text-success" : "bg-muted/50 text-muted-foreground"
    )}>
      <span className={cn(
        "h-1.5 w-1.5 rounded-full",
        active ? "bg-success animate-pulse-glow" : "bg-muted-foreground"
      )} />
      {active ? "Ativo" : "Inativo"}
    </div>
  );
}
