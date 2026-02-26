import { useState } from "react";
import { motion } from "framer-motion";
import { subDays, format } from "date-fns";
import { formatCurrency } from "@/lib/mockData";
import { useMetaAds, DateRange } from "@/hooks/useMetaAds";
import MetricCard from "@/components/MetricCard";
import CampaignsTable from "@/components/CampaignsTable";
import DashboardCharts from "@/components/DashboardCharts";
import DateRangePicker from "@/components/DateRangePicker";
import AppLayout from "@/components/AppLayout";
import { DollarSign, TrendingUp, Target, BarChart3, Loader2, AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

const defaultRange: DateRange = {
  since: format(subDays(new Date(), 6), "yyyy-MM-dd"),
  until: format(new Date(), "yyyy-MM-dd"),
};

function calcDelta(current: number, previous: number): number | null {
  if (!previous || previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export default function Dashboard() {
  const [dateRange, setDateRange] = useState<DateRange>(defaultRange);
  const { campaigns, daily, previous, isLoading, isUsingMock, forceRefetch, fetchedAt } = useMetaAds(dateRange);

  const totalSpend = campaigns.reduce((s, c) => s + c.spend, 0);
  const totalRevenue = campaigns.reduce((s, c) => s + c.revenue, 0);
  const totalProfit = totalRevenue - totalSpend;
  const totalPurchases = campaigns.reduce((s, c) => s + c.purchases, 0);
  const avgCPA = totalPurchases > 0 ? totalSpend / totalPurchases : 0;
  const roas = totalSpend > 0 ? totalRevenue / totalSpend : 0;

  const deltaProfit = previous ? calcDelta(totalProfit, previous.profit) : null;
  const deltaSpend = previous ? calcDelta(totalSpend, previous.spend) : null;
  const deltaCPA = previous ? calcDelta(avgCPA, previous.cpa) : null;
  const deltaROAS = previous ? calcDelta(roas, previous.roas) : null;
  const deltaPurchases = previous ? calcDelta(totalPurchases, previous.purchases) : null;

  return (
    <AppLayout>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <motion.h1
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-3xl font-bold tracking-tight"
          >
            <span className="text-neon-red">MTX</span> Command Center
          </motion.h1>
          <p className="text-muted-foreground mt-1">
            Visão geral de performance · {isUsingMock ? "Dados de demonstração" : "Dados em tempo real"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {fetchedAt && (
            <span className="text-xs text-muted-foreground hidden sm:inline">
              Última atualização: {new Date(fetchedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={() => forceRefetch()} disabled={isLoading} className="gap-2 h-8">
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            Forçar Atualização
          </Button>
        </div>
      </div>

      <div className="mb-6">
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>

      {isUsingMock && (
        <div className="mb-4 flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm text-amber-400">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          Exibindo dados de demonstração. Configure o Ad Account ID em <strong className="mx-1">Configurações</strong> para ver dados reais.
        </div>
      )}

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Sincronizando dados com Meta Ads...</p>
        </div>
      ) : (
        <>
          {/* Hero metric */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="mb-6 rounded-xl border border-glow-green glow-green bg-card p-8"
          >
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-2">Lucro Líquido Total</p>
            <p className="text-5xl font-black tracking-tight text-neon-green">{formatCurrency(totalProfit)}</p>
            <div className="flex items-center gap-3 mt-2">
              <p className="text-sm text-muted-foreground">
                Receita {formatCurrency(totalRevenue)} · Investimento {formatCurrency(totalSpend)}
              </p>
              {deltaProfit !== null && isFinite(deltaProfit) && (
                <span className={`text-xs font-medium ${deltaProfit >= 0 ? "text-neon-green" : "text-neon-red"}`}>
                  {deltaProfit > 0 ? "+" : ""}{deltaProfit.toFixed(1)}% vs anterior
                </span>
              )}
            </div>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <MetricCard
              title="Investimento Total"
              value={formatCurrency(totalSpend)}
              icon={<DollarSign className="w-4 h-4" />}
              delta={deltaSpend}
              invertDelta
            />
            <MetricCard
              title="CPA Real"
              value={formatCurrency(avgCPA)}
              subtitle="Meta: R$ 200,00"
              variant={avgCPA > 200 * 1.2 ? "danger" : "default"}
              icon={<Target className="w-4 h-4" />}
              delta={deltaCPA}
              invertDelta
            />
            <MetricCard
              title="ROAS"
              value={`${roas.toFixed(2)}x`}
              variant={roas > 3 ? "profit" : "default"}
              icon={<TrendingUp className="w-4 h-4" />}
              delta={deltaROAS}
            />
            <MetricCard
              title="Compras Totais"
              value={String(totalPurchases)}
              icon={<BarChart3 className="w-4 h-4" />}
              delta={deltaPurchases}
            />
          </div>

          <DashboardCharts daily={daily} cpaMeta={200} />

          <CampaignsTable campaigns={campaigns} />
        </>
      )}
    </AppLayout>
  );
}
