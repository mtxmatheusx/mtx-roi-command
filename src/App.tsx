import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Campanhas from "./pages/Campanhas";
import Simulador from "./pages/Simulador";
import Criativos from "./pages/Criativos";
import AuditoriaMeta from "./pages/AuditoriaMeta";
import Configuracoes from "./pages/Configuracoes";
import Diagnostico from "./pages/Diagnostico";
import LancarCampanha from "./pages/LancarCampanha";
import AgencyView from "./pages/AgencyView";
import PersonagensUGC from "./pages/PersonagensUGC";
import LaboratorioEstrategico from "./pages/LaboratorioEstrategico";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import LaboratorioVisual from "./pages/LaboratorioVisual";
import LaboratorioVisualLanding from "./pages/LaboratorioVisualLanding";
import LegacyLanding from "./pages/LegacyLanding";
import MetodoRIC from "./pages/MetodoRIC";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
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
            <Route path="/laboratorio-visual/landing" element={<LaboratorioVisualLanding />} />
            <Route path="/laboratorio-visual" element={<ProtectedRoute><LaboratorioVisual /></ProtectedRoute>} />
            <Route path="/legacy" element={<LegacyLanding />} />
            <Route path="/metodo-ric" element={<MetodoRIC />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
