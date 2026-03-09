import { NavLink as RouterNavLink } from "react-router-dom";
import { BarChart3, Zap, Target, ImageIcon, Settings, LogOut, Brain, Rocket, Shield, Building2, Users, Beaker, Wand2, Bot, MessageSquare, PanelLeftClose, PanelLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "react-i18next";
import ProfileSelector from "@/components/ProfileSelector";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export default function AppSidebar() {
  const { signOut } = useAuth();
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(false);

  const navItems = [
    { to: "/", label: t("nav.dashboard"), icon: BarChart3 },
    { to: "/campanhas", label: t("nav.campaigns"), icon: Target },
    { to: "/laboratorio-estrategico", label: "Laboratório Estratégico", icon: Beaker },
    { to: "/diagnostico", label: t("nav.diagnostic"), icon: Brain },
    { to: "/lancar-campanha", label: "Lançar & Publicar", icon: Rocket },
    { to: "/simulador", label: t("nav.simulator"), icon: Zap },
    { to: "/criativos", label: t("nav.creatives"), icon: ImageIcon },
    { to: "/auditoria-meta", label: t("nav.auditMeta"), icon: Shield },
    { to: "/laboratorio-visual", label: "Laboratório Visual", icon: Wand2 },
    { to: "/personagens-ugc", label: "Personagens UGC", icon: Users },
    { to: "/agente-autonomo", label: "Agente Autônomo", icon: Bot },
    { to: "/feedback-copy", label: "Feedbacks de Copy", icon: MessageSquare },
  ];

  const NavItem = ({ to, label, icon: Icon, end }: { to: string; label: string; icon: React.ElementType; end?: boolean }) => {
    const link = (
      <RouterNavLink
        to={to}
        end={end}
        className={({ isActive }) =>
          cn(
            "flex items-center gap-2.5 rounded-md text-sm font-medium transition-colors",
            collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2",
            isActive
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:text-foreground hover:bg-accent"
          )
        }
      >
        <Icon className="w-4 h-4 shrink-0" />
        {!collapsed && <span className="truncate">{label}</span>}
      </RouterNavLink>
    );

    if (collapsed) {
      return (
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>{link}</TooltipTrigger>
          <TooltipContent side="right" sideOffset={8}>{label}</TooltipContent>
        </Tooltip>
      );
    }
    return link;
  };

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 h-screen bg-card border-r border-border flex flex-col z-50 transition-all duration-200",
        collapsed ? "w-[52px]" : "w-60"
      )}
    >
      {/* Logo */}
      <div className={cn("border-b border-border", collapsed ? "px-2 py-4 flex justify-center" : "px-5 py-5")}>
        {collapsed ? (
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">M</span>
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">M</span>
            </div>
            <div>
              <h1 className="text-sm font-semibold text-foreground leading-none">MTX Estratégias</h1>
              <p className="text-[11px] text-muted-foreground mt-0.5">Command Center</p>
            </div>
          </div>
        )}
      </div>

      {/* Agency Link */}
      <div className={cn("pt-3 pb-1", collapsed ? "px-1" : "px-3")}>
        <NavItem to="/agencia" label={t("nav.agencyView")} icon={Building2} />
      </div>

      {!collapsed && <ProfileSelector />}

      {/* Nav */}
      <nav className={cn("flex-1 py-2 space-y-0.5 overflow-y-auto", collapsed ? "px-1" : "px-3")}>
        {navItems.map((item) => (
          <NavItem key={item.to} to={item.to} label={item.label} icon={item.icon} end={item.to === "/"} />
        ))}
      </nav>

      {/* Footer */}
      <div className={cn("border-t border-border space-y-0.5", collapsed ? "px-1 py-2" : "px-3 py-3")}>
        <NavItem to="/configuracoes" label={t("nav.settings")} icon={Settings} />

        {collapsed ? (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <button
                onClick={signOut}
                className="flex items-center justify-center w-full px-2 py-2.5 rounded-md text-sm font-medium transition-colors text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>{t("nav.logout")}</TooltipContent>
          </Tooltip>
        ) : (
          <button
            onClick={signOut}
            className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors w-full text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          >
            <LogOut className="w-4 h-4" />
            {t("nav.logout")}
          </button>
        )}

        {/* Collapse toggle */}
        {collapsed ? (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <button
                onClick={() => setCollapsed(false)}
                className="flex items-center justify-center w-full px-2 py-2.5 rounded-md text-sm transition-colors text-muted-foreground hover:text-foreground hover:bg-accent"
              >
                <PanelLeft className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>Expandir menu</TooltipContent>
          </Tooltip>
        ) : (
          <button
            onClick={() => setCollapsed(true)}
            className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors w-full text-muted-foreground hover:text-foreground hover:bg-accent"
          >
            <PanelLeftClose className="w-4 h-4" />
            Recolher
          </button>
        )}
      </div>
    </aside>
  );
}
