interface StatusBadgeProps {
  status: 'lucrativa' | 'atencao' | 'escalando' | 'critico' | 'pausada';
}

const badgeConfig = {
  lucrativa: { label: "Lucrativa", className: "bg-neon-green/15 text-neon-green border-glow-green" },
  atencao: { label: "Atenção", className: "bg-neon-yellow/15 text-neon-yellow border border-yellow-500/30" },
  escalando: { label: "Escalando", className: "bg-neon-green/15 text-neon-green border-glow-green animate-pulse-neon" },
  critico: { label: "Crítico", className: "bg-neon-red/15 text-neon-red border-glow-red animate-pulse-neon" },
  pausada: { label: "Pausada", className: "bg-secondary text-muted-foreground border border-border" },
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  const config = badgeConfig[status];
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${config.className}`}>
      {config.label}
    </span>
  );
}
