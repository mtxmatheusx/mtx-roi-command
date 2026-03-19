import { NavLink as RouterNavLink } from "react-router-dom";
import {
  BarChart3, Zap, Target, ImageIcon, Settings, LogOut, Brain, Rocket,
  Shield, Building2, Users, Beaker, Wand2, Bot, MessageSquare,
  PanelLeftClose, PanelLeft, X
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "react-i18next";
import ProfileSelector from "@/components/ProfileSelector";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useSidebarState } from "@/hooks/useSidebarState";
import { useIsMobile } from "@/hooks/use-mobile";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";

interface NavGroup {
  label: string;
  items: { to: string; label: string; icon: React.ElementType; end?: boolean }[];
}

export default function AppSidebar() {
  const { signOut } = useAuth();
  const { t } = useTranslation();
  const { collapsed, toggle, mobileOpen, setMobileOpen } = useSidebarState();
  const isMobile = useIsMobile();

  const navGroups: NavGroup[] = [
    {
      label: "Analytics",
      items: [
        { to: "/", label: t("nav.dashboard"), icon: BarChart3, end: true },
        { to: "/campanhas", label: t("nav.campaigns"), icon: Target },
        { to: "/diagnostico", label: t("nav.diagnostic"), icon: Brain },
      ],
    },
    {
      label: "Criação",
      items: [
        { to: "/lancar-campanha", label: "Lançar & Publicar", icon: Rocket },
        { to: "/laboratorio-estrategico", label: "Laboratório Estratégico", icon: Beaker },
        { to: "/criativos", label: t("nav.creatives"), icon: ImageIcon },
        { to: "/laboratorio-visual", label: "Laboratório Visual", icon: Wand2 },
        { to: "/personagens-ugc", label: "Personagens UGC", icon: Users },
      ],
    },
    {
      label: "Ferramentas",
      items: [
        { to: "/simulador", label: t("nav.simulator"), icon: Zap },
        { to: "/auditoria-meta", label: t("nav.auditMeta"), icon: Shield },
        { to: "/agente-autonomo", label: "Agente Autônomo", icon: Bot },
        { to: "/feedback-copy", label: "Feedbacks de Copy", icon: MessageSquare },
      ],
    },
  ];

  const isVisible = isMobile ? mobileOpen : true;
  const showLabels = isMobile ? true : !collapsed;

  const handleNavClick = () => {
    if (isMobile) setMobileOpen(false);
  };

  const NavItem = ({ to, label, icon: Icon, end }: { to: string; label: string; icon: React.ElementType; end?: boolean }) => {
    const link = (
      <RouterNavLink
        to={to}
        end={end}
        onClick={handleNavClick}
        aria-label={label}
        className={({ isActive }) =>
          cn(
            "group relative flex items-center gap-2.5 rounded-lg text-sm font-medium transition-all duration-200 ease-out active:scale-[0.97]",
            !showLabels ? "justify-center px-2 py-2.5" : "px-3 py-2.5",
            isActive
              ? "bg-primary/8 text-primary shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-accent/70"
          )
        }
      >
        {({ isActive }: { isActive: boolean }) => (
          <>
            {/* Animated active indicator bar */}
            <AnimatePresence>
              {isActive && (
                <motion.span
                  layoutId="sidebar-active-indicator"
                  className={cn(
                    "absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-r-full bg-primary",
                    !showLabels ? "h-5" : "h-6"
                  )}
                  initial={{ opacity: 0, scaleY: 0 }}
                  animate={{ opacity: 1, scaleY: 1 }}
                  exit={{ opacity: 0, scaleY: 0 }}
                  transition={{ type: "spring", stiffness: 350, damping: 30 }}
                />
              )}
            </AnimatePresence>
            <Icon className={cn("w-4 h-4 shrink-0 transition-colors", isActive && "text-primary")} />
            <AnimatePresence mode="wait">
              {showLabels && (
                <motion.span
                  className="truncate"
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "auto" }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  {label}
                </motion.span>
              )}
            </AnimatePresence>
          </>
        )}
      </RouterNavLink>
    );

    if (!showLabels) {
      return (
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>{link}</TooltipTrigger>
          <TooltipContent side="right" sideOffset={10} className="font-medium">
            {label}
          </TooltipContent>
        </Tooltip>
      );
    }
    return link;
  };

  if (!isVisible) return null;

  return (
    <aside
      role="navigation"
      aria-label="Menu principal"
      className={cn(
        "fixed left-0 top-0 h-screen bg-card/80 backdrop-blur-2xl border-r border-border/80 flex flex-col transition-all duration-200 ease-out",
        isMobile ? "w-64 z-50 shadow-2xl" : collapsed ? "w-[56px] z-50" : "w-60 z-50"
      )}
    >
      {/* Logo */}
      <div className={cn(
        "border-b border-border flex items-center shrink-0",
        !showLabels ? "px-2 py-4 justify-center" : "px-5 py-5 justify-between"
      )}>
        {!showLabels ? (
          <motion.div
            className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center shadow-sm"
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.95 }}
          >
            <span className="text-primary-foreground font-bold text-sm">M</span>
          </motion.div>
        ) : (
          <>
            <div className="flex items-center gap-2.5">
              <motion.div
                className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center shrink-0 shadow-sm"
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.95 }}
              >
                <span className="text-primary-foreground font-bold text-sm">M</span>
              </motion.div>
              <div>
                <h1 className="text-sm font-semibold text-foreground leading-none">MTX Estratégias</h1>
                <p className="text-[11px] text-muted-foreground mt-0.5">Command Center</p>
              </div>
            </div>
            {isMobile && (
              <button
                onClick={() => setMobileOpen(false)}
                className="p-1 rounded-md hover:bg-accent text-muted-foreground"
                aria-label="Fechar menu"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </>
        )}
      </div>

      {/* Agency Link */}
      <div className={cn("pt-3 pb-1 shrink-0", !showLabels ? "px-1.5" : "px-3")}>
        <NavItem to="/agencia" label={t("nav.agencyView")} icon={Building2} />
      </div>

      {showLabels && <ProfileSelector />}

      {/* Grouped Nav with animations */}
      <LayoutGroup>
        <nav className={cn("flex-1 py-1 overflow-y-auto", !showLabels ? "px-1.5" : "px-3")} aria-label="Navegação principal">
          {navGroups.map((group, gi) => (
            <motion.div
              key={group.label}
              className={cn(gi > 0 && "mt-1")}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: gi * 0.05, duration: 0.2 }}
            >
              {/* Group label */}
              <AnimatePresence mode="wait">
                {showLabels ? (
                  <motion.p
                    key="label"
                    className="px-3 pt-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    {group.label}
                  </motion.p>
                ) : (
                  gi > 0 && (
                    <motion.div
                      key="divider"
                      className="my-2 mx-2"
                      initial={{ opacity: 0, scaleX: 0 }}
                      animate={{ opacity: 1, scaleX: 1 }}
                      exit={{ opacity: 0, scaleX: 0 }}
                      transition={{ duration: 0.15 }}
                    >
                      <div className="h-px bg-border" />
                    </motion.div>
                  )
                )}
              </AnimatePresence>
              <div className="space-y-0.5">
                {group.items.map((item, ii) => (
                  <motion.div
                    key={item.to}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: gi * 0.05 + ii * 0.02, duration: 0.2 }}
                  >
                    <NavItem to={item.to} label={item.label} icon={item.icon} end={item.end} />
                  </motion.div>
                ))}
              </div>
            </motion.div>
          ))}
        </nav>
      </LayoutGroup>

      {/* Footer */}
      <div className={cn(
        "border-t border-border space-y-0.5 shrink-0",
        !showLabels ? "px-1.5 py-2" : "px-3 py-3"
      )}>
        <NavItem to="/configuracoes" label={t("nav.settings")} icon={Settings} />

        {!showLabels ? (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <button
                onClick={signOut}
                aria-label={t("nav.logout")}
                className="flex items-center justify-center w-full px-2 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 text-muted-foreground hover:text-destructive hover:bg-destructive/8 active:scale-95"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={10} className="font-medium">{t("nav.logout")}</TooltipContent>
          </Tooltip>
        ) : (
          <button
            onClick={signOut}
            aria-label={t("nav.logout")}
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 w-full text-muted-foreground hover:text-destructive hover:bg-destructive/8 active:scale-[0.97]"
          >
            <LogOut className="w-4 h-4" />
            {t("nav.logout")}
          </button>
        )}

        {/* Collapse toggle - desktop only */}
        {!isMobile && (
          !showLabels ? (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <button
                  onClick={toggle}
                  aria-label="Expandir menu"
                  className="flex items-center justify-center w-full px-2 py-2.5 rounded-lg text-sm transition-colors text-muted-foreground hover:text-foreground hover:bg-accent"
                >
                  <PanelLeft className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={10} className="font-medium">Expandir menu</TooltipContent>
            </Tooltip>
          ) : (
            <button
              onClick={toggle}
              aria-label="Recolher menu"
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors w-full text-muted-foreground hover:text-foreground hover:bg-accent"
            >
              <PanelLeftClose className="w-4 h-4" />
              Recolher
            </button>
          )
        )}
      </div>
    </aside>
  );
}
