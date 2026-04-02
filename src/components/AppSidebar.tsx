import { NavLink as RouterNavLink, useLocation } from "react-router-dom";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup,
  SidebarGroupContent, SidebarGroupLabel, SidebarHeader,
  SidebarMenu, SidebarMenuBadge, SidebarMenuButton,
  SidebarMenuItem, SidebarMenuSub, SidebarMenuSubButton,
  SidebarMenuSubItem, useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  BarChart2, Bot, ChevronDown, CreditCard, Globe,
  LayoutDashboard, Layers, LogOut, Mail, Search, Settings,
  ShoppingBag, Sparkles, Target, TestTube, Users, Zap,
  Rocket, Brain, Shield, Beaker, ImageIcon, Wand2,
  MessageSquare, Palette, Grid3X3, FolderPlus, KanbanSquare,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "react-i18next";
import ProfileSelector from "@/components/ProfileSelector";

interface NavChild {
  to: string;
  label: string;
}

interface NavItem {
  to: string;
  icon: React.ElementType;
  label: string;
  badge?: string | null;
  end?: boolean;
  children?: NavChild[];
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV: NavGroup[] = [
  {
    label: "Principal",
    items: [
      { to: "/", icon: LayoutDashboard, label: "Dashboard", end: true },
      { to: "/agencia", icon: Globe, label: "Visão da Agência" },
    ],
  },
  {
    label: "Ads & Tráfego",
    items: [
      {
        to: "/campanhas", icon: Target, label: "Meta Ads", badge: "26",
        children: [
          { to: "/campanhas", label: "Campanhas" },
          { to: "/lancar-campanha", label: "Lançar & Publicar" },
          { to: "/diagnostico", label: "Diagnóstico IA" },
          { to: "/criativos", label: "Criativos" },
        ],
      },
      { to: "/simulador", icon: Zap, label: "Simulador" },
      { to: "/auditoria-meta", icon: Shield, label: "Auditoria Meta" },
    ],
  },
  {
    label: "Criação",
    items: [
      { to: "/laboratorio-estrategico", icon: Beaker, label: "Lab Estratégico" },
      { to: "/laboratorio-visual", icon: Wand2, label: "Lab Visual" },
      { to: "/personagens-ugc", icon: Users, label: "Personagens UGC" },
    ],
  },
  {
    label: "E-commerce",
    items: [
      { to: "/skills", icon: CreditCard, label: "Stripe", badge: "NOVO" },
      { to: "/skills", icon: Mail, label: "Klaviyo", badge: "NOVO" },
      { to: "/skills", icon: ShoppingBag, label: "Shopify" },
    ],
  },
  {
    label: "Analytics & CRO",
    items: [
      { to: "/skills", icon: Search, label: "Search Console" },
      { to: "/skills", icon: BarChart2, label: "Google Analytics 4" },
      { to: "/skills", icon: TestTube, label: "Hotjar" },
      { to: "/skills", icon: Sparkles, label: "Optimizely" },
    ],
  },
  {
    label: "Automação",
    items: [
      { to: "/agente-autonomo", icon: Bot, label: "Agente Autônomo" },
      { to: "/skills", icon: Zap, label: "N8N Flows" },
      { to: "/skills", icon: Layers, label: "Typeform" },
    ],
  },
  {
    label: "Ferramentas",
    items: [
      { to: "/feedback-copy", icon: MessageSquare, label: "Feedbacks de Copy" },
      { to: "/brand-identity", icon: Palette, label: "Briefing & ID Visual" },
      { to: "/feed-preview", icon: Grid3X3, label: "Preview do Feed" },
      { to: "/google-drive", icon: FolderPlus, label: "Pastas Google Drive" },
      { to: "/kanban", icon: KanbanSquare, label: "Quadro de Tarefas" },
      { to: "/skills", icon: Brain, label: "Skills Hub" },
    ],
  },
];

export default function AppSidebar() {
  const { signOut } = useAuth();
  const { t } = useTranslation();
  const location = useLocation();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    "Meta Ads": true,
  });

  const toggle = (label: string) =>
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }));

  const isChildActive = (children?: NavChild[]) =>
    children?.some((c) => location.pathname === c.to) ?? false;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Globe className="h-4 w-4" />
          </div>
          <div className="leading-none group-data-[collapsible=icon]:hidden">
            <p className="text-sm font-semibold">MTX Estratégias</p>
            <p className="text-[10px] text-muted-foreground tabular-nums">Command Center</p>
          </div>
        </div>
      </SidebarHeader>

      {!collapsed && <ProfileSelector />}

      <SidebarContent>
        {NAV.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) =>
                  item.children ? (
                    <Collapsible
                      key={item.label}
                      open={openGroups[item.label]}
                      onOpenChange={() => toggle(item.label)}
                      className="group/collapsible"
                    >
                      <SidebarMenuItem>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton
                            isActive={isChildActive(item.children)}
                            tooltip={item.label}
                          >
                            <item.icon />
                            <span>{item.label}</span>
                            {item.badge && <SidebarMenuBadge>{item.badge}</SidebarMenuBadge>}
                            <ChevronDown className={cn(
                              "ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
                              openGroups[item.label] && "rotate-180"
                            )} />
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <SidebarMenuSub>
                            {item.children.map((child) => (
                              <SidebarMenuSubItem key={child.to + child.label}>
                                <SidebarMenuSubButton
                                  asChild
                                  isActive={location.pathname === child.to}
                                >
                                  <RouterNavLink to={child.to}>
                                    {child.label}
                                  </RouterNavLink>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            ))}
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      </SidebarMenuItem>
                    </Collapsible>
                  ) : (
                    <SidebarMenuItem key={item.to + item.label}>
                      <SidebarMenuButton
                        asChild
                        isActive={item.end ? location.pathname === item.to : location.pathname.startsWith(item.to)}
                        tooltip={item.label}
                      >
                        <RouterNavLink to={item.to} end={item.end}>
                          <item.icon />
                          <span>{item.label}</span>
                        </RouterNavLink>
                      </SidebarMenuButton>
                      {item.badge && (
                        <SidebarMenuBadge className={cn(
                          item.badge === "NOVO" && "bg-primary/10 text-primary"
                        )}>
                          {item.badge}
                        </SidebarMenuBadge>
                      )}
                    </SidebarMenuItem>
                  )
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip={t("nav.settings")} size="sm">
              <RouterNavLink to="/configuracoes">
                <Settings />
                <span>{t("nav.settings")}</span>
              </RouterNavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip={t("nav.logout")}
              size="sm"
              onClick={signOut}
            >
              <LogOut />
              <span>{t("nav.logout")}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
