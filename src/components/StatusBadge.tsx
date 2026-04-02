import { CheckCircle2, AlertTriangle, TrendingUp, OctagonAlert, Pause } from "lucide-react";

interface StatusBadgeProps {
  status: 'lucrativa' | 'atencao' | 'escalando' | 'critico' | 'pausada';
}

const badgeConfig = {
  lucrativa: { label: "Lucrativa", className: "badge-green", icon: CheckCircle2 },
  atencao:   { label: "Atenção",   className: "badge-yellow", icon: AlertTriangle },
  escalando: { label: "Escalando", className: "badge-green", icon: TrendingUp },
  critico:   { label: "Crítico",   className: "badge-red", icon: OctagonAlert },
  pausada:   { label: "Pausada",   className: "bg-muted text-muted-foreground", icon: Pause },
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  const config = badgeConfig[status];
  const Icon = config.icon;
  return (
    <span className={`badge-status border ${config.className}`}>
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
}
