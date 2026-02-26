import { NavLink as RouterNavLink } from "react-router-dom";
import { BarChart3, Zap, Target, ImageIcon, Settings } from "lucide-react";

const navItems = [
  { to: "/", label: "Dashboard", icon: BarChart3 },
  { to: "/campanhas", label: "Campanhas", icon: Target },
  { to: "/simulador", label: "Simulador", icon: Zap },
  { to: "/criativos", label: "Criativos", icon: ImageIcon },
];

export default function AppSidebar() {
  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-card border-r border-border flex flex-col z-50">
      <div className="p-6 border-b border-border">
        <h1 className="text-xl font-bold tracking-tight">
          <span className="text-neon-red">MTX</span>{" "}
          <span className="text-foreground">Estratégias</span>
        </h1>
        <p className="text-xs text-muted-foreground mt-1">ROI Command Center</p>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => (
          <RouterNavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                isActive
                  ? "bg-primary/10 text-neon-red border-glow-red border glow-red"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`
            }
          >
            <item.icon className="w-4 h-4" />
            {item.label}
          </RouterNavLink>
        ))}
      </nav>
    <div className="p-4 border-t border-border">
        <RouterNavLink
          to="/configuracoes"
          className={({ isActive }) =>
            `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 w-full ${
              isActive
                ? "bg-primary/10 text-neon-red border-glow-red border glow-red"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            }`
          }
        >
          <Settings className="w-4 h-4" />
          Configurações
        </RouterNavLink>
      </div>
    </aside>
  );
}
