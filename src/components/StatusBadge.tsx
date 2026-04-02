interface StatusBadgeProps {
  status: 'lucrativa' | 'atencao' | 'escalando' | 'critico' | 'pausada';
}

const badgeConfig = {
  lucrativa: { label: "Lucrativa", className: "glass-green text-success border" },
  atencao: { label: "Atenção", className: "glass-yellow text-warning border" },
  escalando: { label: "Escalando", className: "glass-green text-success border" },
  critico: { label: "Crítico", className: "glass-red text-destructive border" },
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
