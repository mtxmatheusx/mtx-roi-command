import { NavLink as RouterNavLink } from "react-router-dom";
import { BarChart3, Zap, Target, ImageIcon, Settings, LogOut, Brain, Rocket, Shield, Building2, Users, Beaker, Wand2, Layout, Sparkles, Bot, MessageSquare } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "react-i18next";
import ProfileSelector from "@/components/ProfileSelector";

export default function AppSidebar() {
  const { signOut } = useAuth();
  const { t } = useTranslation();

  const navItems = [
    { to: "/", label: t("nav.dashboard"), icon: BarChart3 },
    { to: "/campanhas", label: t("nav.campaigns"), icon: Target },
    { to: "/laboratorio-estrategico", label: "Laboratório Estratégico", icon: Beaker },
    { to: "/diagnostico", label: t("nav.diagnostic"), icon: Brain },
    { to: "/lancar-campanha", label: t("nav.launchCampaign"), icon: Rocket },
    { to: "/simulador", label: t("nav.simulator"), icon: Zap },
    { to: "/criativos", label: t("nav.creatives"), icon: ImageIcon },
    { to: "/auditoria-meta", label: t("nav.auditMeta"), icon: Shield },
    
    { to: "/laboratorio-visual", label: "Laboratório Visual", icon: Wand2 },
    { to: "/personagens-ugc", label: "Personagens UGC", icon: Users },
    { to: "/agente-autonomo", label: "Agente Autônomo", icon: Bot },
    { to: "/feedback-copy", label: "Feedbacks de Copy", icon: MessageSquare },
    { to: "/publicar", label: "Central de Publicação", icon: Rocket },
  ];

  return (
    <aside className="fixed left-0 top-0 h-screen w-60 bg-card border-r border-border flex flex-col z-50">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">M</span>
          </div>
          <div>
            <h1 className="text-sm font-semibold text-foreground leading-none">MTX Estratégias</h1>
            <p className="text-[11px] text-muted-foreground mt-0.5">Command Center</p>
          </div>
        </div>
      </div>

      {/* Agency Link */}
      <div className="px-3 pt-3 pb-1">
        <RouterNavLink
          to="/agencia"
          className={({ isActive }) =>
            `flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${isActive
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:text-foreground hover:bg-accent"
            }`
          }
        >
          <Building2 className="w-4 h-4" />
          {t("nav.agencyView")}
        </RouterNavLink>
      </div>

      <ProfileSelector />

      {/* Nav */}
      <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => (
          <RouterNavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${isActive
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-accent"
              }`
            }
          >
            <item.icon className="w-4 h-4" />
            {item.label}
          </RouterNavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-3 py-3 border-t border-border space-y-0.5">
        <RouterNavLink
          to="/configuracoes"
          className={({ isActive }) =>
            `flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors w-full ${isActive
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:text-foreground hover:bg-accent"
            }`
          }
        >
          <Settings className="w-4 h-4" />
          {t("nav.settings")}
        </RouterNavLink>
        <button
          onClick={signOut}
          className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors w-full text-muted-foreground hover:text-destructive hover:bg-destructive/10"
        >
          <LogOut className="w-4 h-4" />
          {t("nav.logout")}
        </button>
      </div>
    </aside>
  );
}
