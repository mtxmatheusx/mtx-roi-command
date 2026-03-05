interface StatusBadgeProps {
  status: 'lucrativa' | 'atencao' | 'escalando' | 'critico' | 'pausada';
}

const badgeConfig = {
  lucrativa: { label: "Lucrativa", className: "bg-success/10 text-success border-success/20" },
  atencao: { label: "Atenção", className: "bg-warning/10 text-warning border-warning/20" },
  escalando: { label: "Escalando", className: "bg-success/10 text-success border-success/20" },
  critico: { label: "Crítico", className: "bg-destructive/10 text-destructive border-destructive/20" },
  pausada: { label: "Pausada", className: "bg-muted text-muted-foreground border-border" },
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  const config = badgeConfig[status];
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.className}`}>
      {config.label}
    </span>
  );
}
