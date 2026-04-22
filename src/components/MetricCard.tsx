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

const variantStyles: Record<string, { accent: string; icon: string; value: string; topBar: string }> = {
  default:   { accent: "bg-muted",              icon: "text-muted-foreground", value: "text-foreground",  topBar: "" },
  profit:    { accent: "bg-[hsl(var(--green-bg))]",  icon: "text-success",          value: "text-success",     topBar: "bg-success/40" },
  danger:    { accent: "bg-[hsl(var(--red-bg))]",     icon: "text-destructive",      value: "text-destructive", topBar: "bg-destructive/40" },
  highlight: { accent: "bg-[hsl(var(--blue-bg))]",    icon: "text-primary",          value: "text-primary",     topBar: "bg-primary/40" },
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
      className="group relative overflow-hidden rounded-2xl bg-white/[0.80] border border-white/60 shadow-[0_8px_20px_-8px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.90)] hover:shadow-[0_12px_24px_-8px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,1)] hover:-translate-y-px transition-all duration-300 dark:bg-black/20 dark:border-white/[0.08] dark:shadow-[0_8px_20px_-8px_rgba(0,0,0,0.4)]"
    >
      {/* Top accent line for non-default variants */}
      {variant !== "default" && styles.topBar && (
        <div className={`absolute top-0 left-0 right-0 h-[2px] ${styles.topBar}`} />
      )}

      <div className="p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="t-label">{title}</span>
          {icon && (
            <span className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 group-hover:scale-110 ${styles.accent} ${styles.icon}`}>
              {icon}
            </span>
          )}
        </div>

        <p className={`text-2xl sm:text-[1.75rem] font-bold tracking-tight hero-number ${styles.value}`}>{value}</p>

        <div className="flex items-center gap-2 min-h-[20px]">
          {hasDelta && (
            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full
              ${isPositive ? "badge-green" : isNegative ? "badge-red" : "bg-muted text-muted-foreground"}`}>
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
