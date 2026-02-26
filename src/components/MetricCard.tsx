import { motion } from "framer-motion";
import { ReactNode } from "react";

interface MetricCardProps {
  title: string;
  value: string;
  subtitle?: string;
  variant?: "default" | "profit" | "danger" | "highlight";
  icon?: ReactNode;
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

export default function MetricCard({ title, value, subtitle, variant = "default", icon }: MetricCardProps) {
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
      {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
    </motion.div>
  );
}
