import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/DashboardLayout";
import LandingPage from "@/pages/LandingPage";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Dashboard from "@/pages/Dashboard";
import Projects from "@/pages/Projects";
import ProjectDetail from "@/pages/ProjectDetail";
import ProjectDashboard from "@/pages/ProjectDashboard";
import AdminUsers from "@/pages/AdminUsers";
import AdminMetrics from "@/pages/AdminMetrics";
import AdminBillingConfig from "@/pages/AdminBillingConfig";
import AdminLicenses from "@/pages/admin/AdminLicenses";
import TeamPage from "@/pages/TeamPage";
import ProfilePage from "@/pages/ProfilePage";
import UpgradePage from "@/pages/UpgradePage";
import UpgradeSuccess from "@/pages/UpgradeSuccess";
import UtmGenerator from "@/pages/UtmGenerator";
import AccountWebhooks from "@/pages/AccountWebhooks";
import GoogleAdsConnect from "@/pages/GoogleAdsConnect";
import NotFound from "./pages/NotFound.tsx";
import License from "./pages/License.tsx";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  if (!user || user.role !== "SUPER_ADMIN") return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

/** Landing page: shows landing if not logged in, redirects to /dashboard if logged in */
function LandingRoute() {
  const { token, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (token) return <Navigate to="/dashboard" replace />;
  return <LandingPage />;
}

/** Public-only route (redirects logged-in users away) */
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { token, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (token) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public */}
            <Route path="/" element={<LandingRoute />} />
            <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
            <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
            <Route path="/license" element={<License />} />

            {/* Upgrade success — standalone (no DashboardLayout) */}
            <Route path="/upgrade/success" element={<ProtectedRoute><UpgradeSuccess /></ProtectedRoute>} />

            {/* Protected app (uses DashboardLayout) */}
            <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/projects" element={<Projects />} />
              <Route path="/utm-generator" element={<UtmGenerator />} />
              <Route path="/projects/:id" element={<ProjectDetail />} />
              <Route path="/projects/:id/dashboard" element={<ProjectDashboard />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/account/webhooks" element={<AccountWebhooks />} />
              <Route path="/team" element={<TeamPage />} />
              <Route path="/upgrade" element={<UpgradePage />} />

              {/* Admin Routes */}
              <Route path="/admin/users" element={<AdminRoute><AdminUsers /></AdminRoute>} />
              <Route path="/admin/metrics" element={<AdminRoute><AdminMetrics /></AdminRoute>} />
              <Route path="/admin/billing" element={<AdminRoute><AdminBillingConfig /></AdminRoute>} />
              <Route path="/admin/licenses" element={<AdminRoute><AdminLicenses /></AdminRoute>} />
            </Route>

            {/* Google Ads OAuth callback — needs auth but NOT DashboardLayout */}
            <Route path="/integrations/google-ads" element={<ProtectedRoute><GoogleAdsConnect /></ProtectedRoute>} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
