import { motion } from "framer-motion";
import { ReactNode } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string;
  subtitle?: string;
  variant?: "default" | "profit" | "danger" | "highlight";
  icon?: ReactNode;
  delta?: number | null; // percentage change vs previous period
  invertDelta?: boolean; // true = lower is better (e.g. CPA)
}

const variantStyles = {
  default: "bg-card border-border",
  profit: "bg-card border-glow-green glow-green",
  danger: "bg-card border-glow-red glow-red",
  highlight: "bg-card border-glow-red",
};

const valueStyles = {
  default: "text-foreground",
  profit: "text-neon-green",
  danger: "text-neon-red",
  highlight: "text-neon-red",
};

export default function MetricCard({ title, value, subtitle, variant = "default", icon, delta, invertDelta }: MetricCardProps) {
  const hasDelta = delta !== undefined && delta !== null && isFinite(delta);
  const isPositive = hasDelta && (invertDelta ? delta! < 0 : delta! > 0);
  const isNegative = hasDelta && (invertDelta ? delta! > 0 : delta! < 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={`rounded-xl border p-6 ${variantStyles[variant]}`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{title}</span>
        {icon && <span className="text-muted-foreground">{icon}</span>}
      </div>
      <p className={`text-3xl font-bold tracking-tight ${valueStyles[variant]}`}>{value}</p>
      <div className="flex items-center gap-2 mt-1">
        {hasDelta && (
          <span className={`flex items-center gap-0.5 text-xs font-medium ${isPositive ? "text-neon-green" : isNegative ? "text-neon-red" : "text-muted-foreground"}`}>
            {isPositive ? <TrendingUp className="w-3 h-3" /> : isNegative ? <TrendingDown className="w-3 h-3" /> : null}
            {delta! > 0 ? "+" : ""}{delta!.toFixed(1)}%
            <span className="text-muted-foreground ml-1">vs anterior</span>
          </span>
        )}
        {!hasDelta && subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
    </motion.div>
  );
}
