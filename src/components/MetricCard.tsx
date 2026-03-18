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

const variantAccent: Record<string, string> = {
  default: "bg-muted/50",
  profit: "bg-success/8",
  danger: "bg-destructive/8",
  highlight: "bg-primary/8",
};

const variantIcon: Record<string, string> = {
  default: "text-muted-foreground",
  profit: "text-success",
  danger: "text-destructive",
  highlight: "text-primary",
};

const valueColor: Record<string, string> = {
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
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="glass-card p-5 flex flex-col gap-3 group"
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-muted-foreground tracking-widest uppercase">{title}</span>
        {icon && (
          <span className={`w-8 h-8 rounded-lg flex items-center justify-center transition-transform duration-200 group-hover:scale-110 ${variantAccent[variant]} ${variantIcon[variant]}`}>
            {icon}
          </span>
        )}
      </div>
      <p className={`text-2xl font-bold tracking-tight hero-number ${valueColor[variant]}`}>{value}</p>
      <div className="flex items-center gap-2 min-h-[20px]">
        {hasDelta && (
          <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full transition-colors duration-200
            ${isPositive ? "bg-success/10 text-success" : isNegative ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"}`}>
            {isPositive ? <TrendingUp className="w-3 h-3" /> : isNegative ? <TrendingDown className="w-3 h-3" /> : null}
            {delta! > 0 ? "+" : ""}{delta!.toFixed(1)}%
          </span>
        )}
        {hasDelta && <span className="text-[10px] text-muted-foreground/70 font-medium">vs período anterior</span>}
        {!hasDelta && subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
    </motion.div>
  );
}
