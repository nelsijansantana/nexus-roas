import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { LicenseBanner } from "@/components/LicenseBanner";
import {
  LayoutDashboard,
  FolderKanban,
  LogOut,
  Menu,
  X,
  Zap,
  ChevronRight,
  Bell,
  ShieldCheck,
  BarChart2,
  Users,
  UserCircle,
  CreditCard,
  TrendingUp,
  Link as LinkIcon,
  Webhook,
  KeyRound,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard", end: true },
  { to: "/projects", icon: FolderKanban, label: "Projetos", end: false },
  { to: "/utm-generator", icon: LinkIcon, label: "Gerador de UTM", end: false },
  { to: "/account/webhooks", icon: Webhook, label: "Webhooks", end: false },
  { to: "/team", icon: Users, label: "Meu Time", end: false },
];

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const pageTitle = location.pathname === "/dashboard"
    ? "Dashboard"
    : location.pathname.endsWith("/dashboard") && location.pathname.startsWith("/projects/")
    ? "Analytics"
    : location.pathname.startsWith("/projects/")
    ? "Detalhes do Projeto"
    : location.pathname === "/admin/metrics"
    ? "Métricas"
    : location.pathname === "/admin/users"
    ? "Usuários"
    : location.pathname === "/admin/billing"
    ? "Plataforma de Pagamento"
    : location.pathname === "/admin/licenses"
    ? "Licenças"
    : location.pathname === "/team"
    ? "Meu Time"
    : location.pathname === "/profile"
    ? "Meu Perfil"
    : location.pathname === "/utm-generator"
    ? "Gerador de UTM"
    : location.pathname === "/account/webhooks"
    ? "Webhooks"
    : location.pathname === "/upgrade"
    ? "Upgrade de Plano"
    : "Projetos";

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* ── Sidebar ──────────────────────────────────────────────────── */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col",
          "border-r border-border/50 bg-sidebar",
          "transition-transform duration-300 ease-out",
          "lg:relative lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Ambient glow top */}
        <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-64 w-48 rounded-full bg-primary/6 blur-[60px]" />

        {/* Logo */}
        <div className="flex h-16 items-center gap-3 border-b border-border/40 px-5">
          <div className="relative h-8 w-8 shrink-0">
            <div className="absolute inset-0 rounded-lg bg-gradient-primary opacity-30 blur-md" />
            <div className="relative h-8 w-8 rounded-lg bg-gradient-primary flex items-center justify-center">
              <Zap className="h-4 w-4 text-white" strokeWidth={2.5} />
            </div>
          </div>
          <span className="font-display text-lg font-bold text-gradient-primary">
            Nexus ROAS
          </span>
          <button
            onClick={() => setSidebarOpen(false)}
            className="ml-auto lg:hidden text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Nav label */}
        <div className="px-5 pt-5 pb-2">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60">
            Menu
          </p>
        </div>

        {/* Nav items */}
        <nav className="flex-1 space-y-1 px-3">
          {[...navItems, { to: "/upgrade", icon: TrendingUp, label: "Upgrade", end: false }].filter((item) => {
            // "Meu Time" only for account owners
            if (item.to === "/team" && user?.ownerId) return false;
            // "Upgrade" only for account owners (not members)
            if (item.to === "/upgrade" && user?.ownerId) return false;
            return true;
          }).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                cn(
                  "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-primary/10 text-primary shadow-glow-sm"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-full bg-primary" />
                  )}
                  <item.icon
                    className={cn(
                      "h-4 w-4 shrink-0 transition-colors",
                      isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                    )}
                  />
                  <span>{item.label}</span>
                  {isActive && (
                    <ChevronRight className="ml-auto h-3.5 w-3.5 text-primary/60" />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Admin section - Only for Super Admin */}
        {user?.role === "SUPER_ADMIN" && (
          <>
            <div className="px-5 pt-3 pb-1">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-primary/60">
                Administração
              </p>
            </div>
            <nav className="space-y-1 px-3 pb-3">
              {[
                { to: "/admin/metrics",   icon: BarChart2,   label: "Métricas" },
                { to: "/admin/users",     icon: ShieldCheck, label: "Usuários" },
                { to: "/admin/billing",   icon: CreditCard,  label: "Pagamentos" },
                { to: "/admin/licenses",  icon: KeyRound,    label: "Licenças" },
              ].map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                      isActive
                        ? "bg-primary/10 text-primary shadow-glow-sm"
                        : "text-sidebar-foreground/50 hover:bg-primary/5 hover:text-primary/80"
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-full bg-primary" />
                      )}
                      <item.icon
                        className={cn(
                          "h-4 w-4 shrink-0 transition-colors",
                          isActive ? "text-primary" : "text-muted-foreground group-hover:text-primary/60"
                        )}
                      />
                      <span>{item.label}</span>
                    </>
                  )}
                </NavLink>
              ))}
            </nav>
          </>
        )}
        <div className="border-t border-border/40 p-3 space-y-1">
          <div className="flex items-center gap-3 rounded-xl px-3 py-2.5">
            {/* Avatar */}
            <div className="relative h-8 w-8 shrink-0">
              <div className="h-8 w-8 rounded-full bg-gradient-primary flex items-center justify-center text-xs font-bold text-white shadow-glow-sm">
                {user?.name?.charAt(0)?.toUpperCase() || "U"}
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-success border-2 border-sidebar animate-pulse-glow" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-sidebar-foreground">
                {user?.name}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {user?.email}
              </p>
            </div>
          </div>

          <NavLink
            to="/profile"
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              cn(
                "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm transition-all duration-200",
                isActive
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )
            }
          >
            <UserCircle className="h-4 w-4" />
            Meu Perfil
          </NavLink>

          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted-foreground hover:bg-destructive/8 hover:text-destructive transition-all duration-200"
          >
            <LogOut className="h-4 w-4" />
            Sair da conta
          </button>
        </div>
      </aside>

      {/* Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Main area ────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-16 shrink-0 items-center gap-4 border-b border-border/50 bg-background/60 backdrop-blur-md px-4 lg:px-8">
          {/* Mobile menu */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <Menu className="h-4 w-4" />
          </button>

          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Nexus</span>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
            <span className="font-medium text-foreground">{pageTitle}</span>
          </div>

          {/* Right actions */}
          <div className="ml-auto flex items-center gap-2">
            <button className="relative h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
              <Bell className="h-4 w-4" />
              <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-primary animate-pulse-glow" />
            </button>

            <div className="h-8 w-8 rounded-full bg-gradient-primary flex items-center justify-center text-xs font-bold text-white shadow-glow-sm">
              {user?.name?.charAt(0)?.toUpperCase() || "U"}
            </div>
          </div>
        </header>

        <LicenseBanner />

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          <div className="mx-auto max-w-7xl px-4 py-8 lg:px-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
