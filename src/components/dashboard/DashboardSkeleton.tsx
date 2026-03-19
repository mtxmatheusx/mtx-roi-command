import { motion } from "framer-motion";

function SkeletonPulse({ className }: { className?: string }) {
  return <div className={`shimmer rounded-md ${className ?? ""}`} />;
}

export function MetricCardSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="glass-card p-5 flex flex-col gap-3"
    >
      <div className="flex items-center justify-between">
        <SkeletonPulse className="h-3 w-20" />
        <SkeletonPulse className="h-8 w-8 rounded-lg" />
      </div>
      <SkeletonPulse className="h-7 w-28" />
      <SkeletonPulse className="h-4 w-16 rounded-full" />
    </motion.div>
  );
}

export function HeroSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="glass-card p-6 sm:p-10 flex flex-col items-center gap-4"
    >
      <SkeletonPulse className="h-3 w-32" />
      <SkeletonPulse className="h-12 sm:h-16 w-56 sm:w-72" />
      <div className="flex items-center gap-4">
        <SkeletonPulse className="h-4 w-28" />
        <SkeletonPulse className="h-4 w-28" />
      </div>
    </motion.div>
  );
}

export function ChartSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="chart-container"
    >
      <div className="mb-4">
        <SkeletonPulse className="h-4 w-16 mb-1.5" />
        <SkeletonPulse className="h-3 w-32" />
      </div>
      <div className="flex items-end gap-2 h-[190px] pt-4">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex-1 flex flex-col justify-end">
            <SkeletonPulse
              className="w-full rounded-t-sm"
              style={{ height: `${30 + Math.random() * 60}%` } as any}
            />
          </div>
        ))}
      </div>
    </motion.div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <HeroSkeleton />

      {/* Primary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <MetricCardSkeleton key={i} />
        ))}
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <MetricCardSkeleton key={i} />
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <ChartSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
