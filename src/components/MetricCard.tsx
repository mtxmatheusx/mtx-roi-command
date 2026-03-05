import { motion } from "framer-motion";
import { ReactNode } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string;
  subtitle?: string;
  variant?: "default" | "profit" | "danger" | "highlight";
  icon?: ReactNode;
  delta?: number | null;
  invertDelta?: boolean;
}

const variantStyles = {
  default: "bg-card border-border",
  profit: "bg-card border-success/30",
  danger: "bg-card border-destructive/30",
  highlight: "bg-card border-primary/30",
};

const valueStyles = {
  default: "text-foreground",
  profit: "text-success",
  danger: "text-destructive",
  highlight: "text-primary",
};

export default function MetricCard({ title, value, subtitle, variant = "default", icon, delta, invertDelta }: MetricCardProps) {
  const hasDelta = delta !== undefined && delta !== null && isFinite(delta);
  const isPositive = hasDelta && (invertDelta ? delta! < 0 : delta! > 0);
  const isNegative = hasDelta && (invertDelta ? delta! > 0 : delta! < 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`rounded-lg border p-5 ${variantStyles[variant]}`}
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-medium text-muted-foreground">{title}</span>
        {icon && <span className="text-muted-foreground">{icon}</span>}
      </div>
      <p className={`text-2xl font-semibold tracking-tight ${valueStyles[variant]}`}>{value}</p>
      <div className="flex items-center gap-2 mt-1">
        {hasDelta && (
          <span className={`flex items-center gap-0.5 text-xs font-medium ${isPositive ? "text-success" : isNegative ? "text-destructive" : "text-muted-foreground"}`}>
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
