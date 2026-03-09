import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Loader2 } from "lucide-react";

// Eager load: Auth + main dashboard
import Index from "./pages/Index";
import Auth from "./pages/Auth";

// Lazy load everything else
const Campanhas = lazy(() => import("./pages/Campanhas"));
const Simulador = lazy(() => import("./pages/Simulador"));
const Criativos = lazy(() => import("./pages/Criativos"));
const AuditoriaMeta = lazy(() => import("./pages/AuditoriaMeta"));
const Configuracoes = lazy(() => import("./pages/Configuracoes"));
const Diagnostico = lazy(() => import("./pages/Diagnostico"));
const LancarCampanha = lazy(() => import("./pages/LancarCampanha"));
const AgencyView = lazy(() => import("./pages/AgencyView"));
const PersonagensUGC = lazy(() => import("./pages/PersonagensUGC"));
const LaboratorioEstrategico = lazy(() => import("./pages/LaboratorioEstrategico"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const LaboratorioVisual = lazy(() => import("./pages/LaboratorioVisual"));
const LaboratorioVisualLanding = lazy(() => import("./pages/LaboratorioVisualLanding"));
const LegacyLanding = lazy(() => import("./pages/LegacyLanding"));
const MetodoRIC = lazy(() => import("./pages/MetodoRIC"));
const NotFound = lazy(() => import("./pages/NotFound"));
const AgenteAutonomo = lazy(() => import("./pages/AgenteAutonomo"));
const FeedbackAdmin = lazy(() => import("./pages/FeedbackAdmin"));
const PublicarCampanha = lazy(() => import("./pages/PublicarCampanha"));

const queryClient = new QueryClient();

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="w-6 h-6 animate-spin text-primary" />
    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
              <Route path="/agencia" element={<ProtectedRoute><AgencyView /></ProtectedRoute>} />
              <Route path="/campanhas" element={<ProtectedRoute><Campanhas /></ProtectedRoute>} />
              <Route path="/diagnostico" element={<ProtectedRoute><Diagnostico /></ProtectedRoute>} />
              <Route path="/laboratorio-estrategico" element={<ProtectedRoute><LaboratorioEstrategico /></ProtectedRoute>} />
              <Route path="/lancar-campanha" element={<ProtectedRoute><LancarCampanha /></ProtectedRoute>} />
              <Route path="/simulador" element={<ProtectedRoute><Simulador /></ProtectedRoute>} />
              <Route path="/criativos" element={<ProtectedRoute><Criativos /></ProtectedRoute>} />
              <Route path="/auditoria-meta" element={<ProtectedRoute><AuditoriaMeta /></ProtectedRoute>} />
              <Route path="/configuracoes" element={<ProtectedRoute><Configuracoes /></ProtectedRoute>} />
              <Route path="/personagens-ugc" element={<ProtectedRoute><PersonagensUGC /></ProtectedRoute>} />
              <Route path="/agente-autonomo" element={<ProtectedRoute><AgenteAutonomo /></ProtectedRoute>} />
              <Route path="/feedback-copy" element={<ProtectedRoute><FeedbackAdmin /></ProtectedRoute>} />
              <Route path="/publicar" element={<ProtectedRoute><LancarCampanha /></ProtectedRoute>} />
              <Route path="/laboratorio-visual/landing" element={<LaboratorioVisualLanding />} />
              <Route path="/laboratorio-visual" element={<ProtectedRoute><LaboratorioVisual /></ProtectedRoute>} />
              <Route path="/legacy" element={<LegacyLanding />} />
              <Route path="/metodo-ric" element={<MetodoRIC />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
