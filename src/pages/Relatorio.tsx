import { Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { useClientReport } from "@/hooks/useClientReport";
import MetricCard from "@/components/MetricCard";
import DashboardCharts from "@/components/DashboardCharts";
import CampaignsTable from "@/components/CampaignsTable";
import { formatCurrency, formatPercent } from "@/lib/mockData";
import { DollarSign, TrendingUp, Target, ShoppingBag, BarChart3, LogOut, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Relatorio() {
  const { signOut } = useAuth();
  const {
    isClient, isLoading, profileName, latestDate,
    totalSpend, totalRevenue, roas, avgCPA, totalProfit,
    totalPurchases, avgCTR, avgCPM,
    cpaMeta, daily, campaigns,
  } = useClientReport();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isClient) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">M</span>
            </div>
            <div>
              <h1 className="text-sm font-semibold text-foreground">MTX Estratégias</h1>
              <p className="text-xs text-muted-foreground">Relatório de Performance</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {profileName && (
              <span className="text-sm font-medium text-foreground hidden sm:inline">
                {profileName}
              </span>
            )}
            <Button variant="outline" size="sm" onClick={signOut} className="gap-2">
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sair</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Title */}
        <div>
          <motion.h2
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-2xl font-semibold tracking-tight"
          >
            <span className="text-gradient-accent">Relatório de Performance</span>
          </motion.h2>
          {latestDate && (
            <p className="text-muted-foreground text-sm mt-1">
              Dados atualizados em {new Date(latestDate + "T00:00:00").toLocaleDateString("pt-BR")}
            </p>
          )}
          {!latestDate && (
            <p className="text-muted-foreground text-sm mt-1">
              Nenhum relatório disponível ainda. Os dados serão sincronizados automaticamente.
            </p>
          )}
        </div>

        {latestDate && (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              <MetricCard
                title="Investimento"
                value={formatCurrency(totalSpend)}
                icon={<DollarSign className="w-4 h-4" />}
                index={0}
              />
              <MetricCard
                title="Faturamento"
                value={formatCurrency(totalRevenue)}
                variant="highlight"
                icon={<TrendingUp className="w-4 h-4" />}
                index={1}
              />
              <MetricCard
                title="ROAS"
                value={`${roas.toFixed(2)}x`}
                variant={roas >= 3 ? "profit" : roas >= 1.5 ? "default" : "danger"}
                icon={<BarChart3 className="w-4 h-4" />}
                index={2}
              />
              <MetricCard
                title="CPA"
                value={formatCurrency(avgCPA)}
                variant={cpaMeta > 0 && avgCPA > cpaMeta ? "danger" : "default"}
                subtitle={cpaMeta > 0 ? `Meta: ${formatCurrency(cpaMeta)}` : undefined}
                icon={<Target className="w-4 h-4" />}
                index={3}
              />
              <MetricCard
                title="Lucro"
                value={formatCurrency(totalProfit)}
                variant={totalProfit > 0 ? "profit" : "danger"}
                icon={<ShoppingBag className="w-4 h-4" />}
                index={4}
              />
            </div>

            {/* Secondary KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <MetricCard title="Vendas" value={String(totalPurchases)} index={5} />
              <MetricCard title="CTR" value={formatPercent(avgCTR)} index={6} />
              <MetricCard title="CPM" value={formatCurrency(avgCPM)} index={7} />
              <MetricCard
                title="Ticket Médio"
                value={formatCurrency(totalPurchases > 0 ? totalRevenue / totalPurchases : 0)}
                index={8}
              />
            </div>

            {/* Charts */}
            {daily.length > 1 && (
              <DashboardCharts daily={daily} cpaMeta={cpaMeta} />
            )}

            {/* Campaigns */}
            {campaigns.length > 0 && (
              <CampaignsTable campaigns={campaigns} disableScale />
            )}
          </>
        )}

        {/* Footer */}
        <footer className="text-center py-8 border-t border-border">
          <p className="text-xs text-muted-foreground">
            Relatório gerado automaticamente por <strong className="text-foreground">MTX Estratégias</strong>
          </p>
        </footer>
      </main>
    </div>
  );
}
