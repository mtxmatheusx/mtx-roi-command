import { motion } from "framer-motion";
import { mockCampaigns, formatCurrency, formatPercent } from "@/lib/mockData";
import MetricCard from "@/components/MetricCard";
import CampaignsTable from "@/components/CampaignsTable";
import AppLayout from "@/components/AppLayout";
import { DollarSign, TrendingUp, Target, BarChart3 } from "lucide-react";

export default function Dashboard() {
  const totalSpend = mockCampaigns.reduce((s, c) => s + c.spend, 0);
  const totalRevenue = mockCampaigns.reduce((s, c) => s + c.revenue, 0);
  const totalProfit = totalRevenue - totalSpend;
  const totalPurchases = mockCampaigns.reduce((s, c) => s + c.purchases, 0);
  const avgCPA = totalPurchases > 0 ? totalSpend / totalPurchases : 0;
  const roas = totalSpend > 0 ? totalRevenue / totalSpend : 0;

  return (
    <AppLayout>
      <div className="mb-8">
        <motion.h1
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="text-3xl font-bold tracking-tight"
        >
          <span className="text-neon-red">MTX</span> Command Center
        </motion.h1>
        <p className="text-muted-foreground mt-1">Visão geral de performance · Dados em tempo real</p>
      </div>

      {/* Hero metric: Lucro Líquido */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="mb-6 rounded-xl border border-glow-green glow-green bg-card p-8"
      >
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-2">Lucro Líquido Total</p>
        <p className="text-5xl font-black tracking-tight text-neon-green">{formatCurrency(totalProfit)}</p>
        <p className="text-sm text-muted-foreground mt-2">
          Receita {formatCurrency(totalRevenue)} · Investimento {formatCurrency(totalSpend)}
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricCard
          title="Investimento Total"
          value={formatCurrency(totalSpend)}
          icon={<DollarSign className="w-4 h-4" />}
        />
        <MetricCard
          title="CPA Real"
          value={formatCurrency(avgCPA)}
          subtitle="Meta: R$ 200,00"
          variant={avgCPA > 200 * 1.2 ? "danger" : "default"}
          icon={<Target className="w-4 h-4" />}
        />
        <MetricCard
          title="ROAS"
          value={`${roas.toFixed(2)}x`}
          variant={roas > 3 ? "profit" : "default"}
          icon={<TrendingUp className="w-4 h-4" />}
        />
        <MetricCard
          title="Compras Totais"
          value={String(totalPurchases)}
          icon={<BarChart3 className="w-4 h-4" />}
        />
      </div>

      <CampaignsTable campaigns={mockCampaigns} />
    </AppLayout>
  );
}
