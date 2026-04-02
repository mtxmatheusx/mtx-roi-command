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
  index?: number;
}

const variantStyles: Record<string, { accent: string; icon: string; value: string }> = {
  default:   { accent: "bg-muted/60",         icon: "text-muted-foreground", value: "text-foreground" },
  profit:    { accent: "bg-success/8",         icon: "text-success",          value: "text-success" },
  danger:    { accent: "bg-destructive/8",     icon: "text-destructive",      value: "text-destructive" },
  highlight: { accent: "bg-primary/8",         icon: "text-primary",          value: "text-primary" },
};

export default function MetricCard({ title, value, subtitle, variant = "default", icon, delta, invertDelta, index = 0 }: MetricCardProps) {
  const hasDelta = delta !== undefined && delta !== null && isFinite(delta);
  const isPositive = hasDelta && (invertDelta ? delta! < 0 : delta! > 0);
  const isNegative = hasDelta && (invertDelta ? delta! > 0 : delta! < 0);
  const styles = variantStyles[variant];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
      className="liquid-glass group relative"
    >
      <div className="lg-distortion" />
      <div className="lg-overlay" />
      <div className="lg-specular" />
      <div className="lg-content flex flex-col gap-3">
        {/* Subtle top accent line for non-default variants */}
        {variant !== "default" && (
          <div className={`absolute top-0 left-0 right-0 h-[2px] z-[5] ${
            variant === "profit" ? "bg-success/40" : variant === "danger" ? "bg-destructive/40" : "bg-primary/40"
          }`} />
        )}

        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-muted-foreground tracking-[0.1em] uppercase">{title}</span>
          {icon && (
            <span className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 group-hover:scale-110 group-hover:shadow-sm ${styles.accent} ${styles.icon}`}>
              {icon}
            </span>
          )}
        </div>

        <p className={`text-2xl sm:text-[1.75rem] font-bold tracking-tight hero-number ${styles.value}`}>{value}</p>

        <div className="flex items-center gap-2 min-h-[20px]">
          {hasDelta && (
            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full
              ${isPositive ? "bg-success/10 text-success" : isNegative ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"}`}>
              {isPositive ? <TrendingUp className="w-3 h-3" /> : isNegative ? <TrendingDown className="w-3 h-3" /> : null}
              {delta! > 0 ? "+" : ""}{delta!.toFixed(1)}%
            </span>
          )}
          {hasDelta && <span className="text-[10px] text-muted-foreground/60 font-medium">vs anterior</span>}
          {!hasDelta && subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
    </motion.div>
  );
}
