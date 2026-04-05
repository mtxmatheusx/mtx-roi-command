import { motion } from "framer-motion";
import { formatCurrency } from "@/lib/mockData";
import type { Campaign } from "@/lib/mockData";

interface FunnelVisualizationProps {
  campaigns: Campaign[];
}

interface FunnelStep {
  label: string;
  value: number;
  cost: number;
}

function getColor(rate: number, thresholds: [number, number]): string {
  if (rate >= thresholds[1]) return "text-success";
  if (rate >= thresholds[0]) return "text-warning";
  return "text-destructive";
}

function getBgColor(rate: number, thresholds: [number, number]): string {
  if (rate >= thresholds[1]) return "bg-success/15 border-success/30";
  if (rate >= thresholds[0]) return "bg-warning/15 border-warning/30";
  return "bg-destructive/15 border-destructive/30";
}

function getBarColor(rate: number, thresholds: [number, number]): string {
  if (rate >= thresholds[1]) return "bg-success";
  if (rate >= thresholds[0]) return "bg-warning";
  return "bg-destructive";
}

export default function FunnelVisualization({ campaigns }: FunnelVisualizationProps) {
  const totals = campaigns.reduce(
    (acc, c) => ({
      impressions: acc.impressions + (c.clicks / (c.ctr / 100 || 1)),
      clicks: acc.clicks + c.clicks,
      pageViews: acc.pageViews + c.pageViews,
      addToCart: acc.addToCart + c.addToCart,
      initCheckout: acc.initCheckout + c.initiateCheckout,
      purchases: acc.purchases + c.purchases,
      spend: acc.spend + c.spend,
    }),
    { impressions: 0, clicks: 0, pageViews: 0, addToCart: 0, initCheckout: 0, purchases: 0, spend: 0 }
  );

  const steps: FunnelStep[] = [
    { label: "Impressões", value: Math.round(totals.impressions), cost: totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : 0 },
    { label: "Cliques", value: totals.clicks, cost: totals.clicks > 0 ? totals.spend / totals.clicks : 0 },
    { label: "Visualizações", value: totals.pageViews, cost: totals.pageViews > 0 ? totals.spend / totals.pageViews : 0 },
    { label: "Add to Cart", value: totals.addToCart, cost: totals.addToCart > 0 ? totals.spend / totals.addToCart : 0 },
    { label: "Checkout", value: totals.initCheckout, cost: totals.initCheckout > 0 ? totals.spend / totals.initCheckout : 0 },
    { label: "Compras", value: totals.purchases, cost: totals.purchases > 0 ? totals.spend / totals.purchases : 0 },
  ];

  const maxValue = steps[0].value || 1;

  // Conversion rates between steps
  const convRates = steps.slice(1).map((step, i) => {
    const prev = steps[i].value;
    return prev > 0 ? (step.value / prev) * 100 : 0;
  });

  // Thresholds for each conversion step (yellow, green)
  const thresholds: [number, number][] = [
    [1, 2],      // impressions → clicks (CTR)
    [30, 60],    // clicks → page views
    [5, 15],     // page views → ATC
    [20, 40],    // ATC → checkout
    [30, 60],    // checkout → purchase
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-6"
    >
      <div className="mb-4">
        <h3 className="text-base font-semibold">Funil de Conversão</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Semáforo visual — verde, amarelo, vermelho por etapa</p>
      </div>

      <div className="space-y-2">
        {steps.map((step, i) => {
          const barWidth = maxValue > 0 ? (step.value / maxValue) * 100 : 0;
          const convRate = i > 0 ? convRates[i - 1] : null;
          const threshold = i > 0 ? thresholds[i - 1] : null;

          return (
            <div key={step.label}>
              {/* Conversion rate arrow between steps */}
              {convRate !== null && threshold && (
                <div className="flex items-center justify-center py-1">
                  <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getBgColor(convRate, threshold)}`}>
                    <span className="text-[8px]">▼</span>
                    <span className={getColor(convRate, threshold)}>{convRate.toFixed(1)}%</span>
                  </div>
                </div>
              )}

              {/* Step bar */}
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-medium text-muted-foreground w-24 text-right shrink-0">
                  {step.label}
                </span>
                <div className="flex-1 relative h-8 bg-muted/30 rounded-lg overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.max(barWidth, 2)}%` }}
                    transition={{ duration: 0.6, delay: i * 0.08 }}
                    className={`absolute inset-y-0 left-0 rounded-lg ${
                      i > 0 && threshold
                        ? getBarColor(convRates[i - 1], threshold)
                        : "bg-primary"
                    } opacity-80`}
                  />
                  <div className="absolute inset-0 flex items-center px-3 justify-between">
                    <span className="text-xs font-bold text-foreground drop-shadow-sm">
                      {step.value.toLocaleString("pt-BR")}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-medium">
                      {i === 0 ? `CPM: ${formatCurrency(step.cost)}` : `Custo: ${formatCurrency(step.cost)}`}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
