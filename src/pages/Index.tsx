import { useState, useMemo, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { subDays, format } from "date-fns";
import { formatCurrency } from "@/lib/mockData";
import { useMetaAds, DateRange } from "@/hooks/useMetaAds";
import { useClientProfiles } from "@/hooks/useClientProfiles";
import MetricCard from "@/components/MetricCard";
import CampaignsTable from "@/components/CampaignsTable";
import DashboardCharts from "@/components/DashboardCharts";
import DateRangePicker from "@/components/DateRangePicker";
import AppLayout from "@/components/AppLayout";
import { Progress } from "@/components/ui/progress";
import { DollarSign, TrendingUp, Target, BarChart3, Loader2, AlertTriangle, RefreshCw, Eye, MousePointerClick, ShoppingBag, ShieldCheck, OctagonAlert, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";

const defaultRange: DateRange = {
  since: format(subDays(new Date(), 6), "yyyy-MM-dd"),
  until: format(new Date(), "yyyy-MM-dd"),
};

function calcDelta(current: number, previous: number): number | null {
  if (!previous || previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

interface LogEntry {
  time: string;
  message: string;
  type: "info" | "action";
}

export default function Dashboard() {
  const [dateRange, setDateRange] = useState<DateRange>(defaultRange);
  const { adAccountId, cpaMeta, ticketMedio, budgetMaximo, budgetFrequency, activeProfile, metaAccessToken } = useClientProfiles();
  const { campaigns, daily, previous, isLoading, isUsingMock, forceRefetch, fetchedAt, dataVerified, isRateLimited, isPermissionError, isCached } = useMetaAds(dateRange, { adAccountId, cpaMeta, ticketMedio, accessToken: metaAccessToken });

  const [logs, setLogs] = useState<LogEntry[]>([]);

  // Generate log entries on data changes
  const generateLogs = useCallback(() => {
    if (isLoading || campaigns.length === 0) return;
    const now = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const totalSpend = campaigns.reduce((s, c) => s + c.spend, 0);
    const totalRevenue = campaigns.reduce((s, c) => s + c.revenue, 0);
    const roas = totalSpend > 0 ? totalRevenue / totalSpend : 0;

    const newEntries: LogEntry[] = [];
    newEntries.push({ time: now, message: `Check realizado — ROI atual: ${roas.toFixed(2)}x — Nenhuma ação necessária`, type: "info" });

    campaigns.forEach((c) => {
      if (c.costPerPurchase > cpaMeta * 2 && c.purchases === 0 && c.spend > 0) {
        newEntries.push({ time: now, message: `AÇÃO: Campanha "${c.name}" sinalizada por CPA alto (spend ${formatCurrency(c.spend)} sem vendas)`, type: "action" });
      }
    });

    setLogs((prev) => [...newEntries, ...prev].slice(0, 20));
  }, [campaigns, isLoading, cpaMeta]);

  useEffect(() => { generateLogs(); }, [fetchedAt, campaigns.length]);

  const totalSpend = campaigns.reduce((s, c) => s + c.spend, 0);
  const totalRevenue = campaigns.reduce((s, c) => s + c.revenue, 0);
  const totalProfit = totalRevenue - totalSpend;
  const totalPurchases = campaigns.reduce((s, c) => s + c.purchases, 0);
  const totalImpressions = campaigns.reduce((s, c) => s + (c.clicks / (c.ctr / 100 || 1)), 0);
  const totalClicks = campaigns.reduce((s, c) => s + c.clicks, 0);
  const avgCPA = totalPurchases > 0 ? totalSpend / totalPurchases : 0;
  const roas = totalSpend > 0 ? totalRevenue / totalSpend : 0;
  const avgCPM = totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0;
  const avgCTR = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
  const calcTicketMedio = totalPurchases > 0 ? totalRevenue / totalPurchases : 0;

  const deltaProfit = previous ? calcDelta(totalProfit, previous.profit) : null;
  const deltaSpend = previous ? calcDelta(totalSpend, previous.spend) : null;
  const deltaCPA = previous ? calcDelta(avgCPA, previous.cpa) : null;
  const deltaROAS = previous ? calcDelta(roas, previous.roas) : null;
  const deltaPurchases = previous ? calcDelta(totalPurchases, previous.purchases) : null;
  const deltaCPM = previous ? calcDelta(avgCPM, previous.cpm) : null;
  const deltaCTR = previous ? calcDelta(avgCTR, previous.ctr) : null;
  const deltaTM = previous && previous.purchases > 0 ? calcDelta(calcTicketMedio, previous.purchaseValue / previous.purchases) : null;

  return (
    <AppLayout>
      {/* Monitoring Indicator */}
      <div className="mb-4 flex items-center gap-2">
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-neon-green opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-neon-green"></span>
        </span>
        <span className="text-xs font-semibold text-neon-green tracking-wide uppercase">Monitoramento Ativo em Tempo Real</span>
      </div>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <motion.h1 initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="text-3xl font-bold tracking-tight">
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

      <div className="mb-6"><DateRangePicker value={dateRange} onChange={setDateRange} /></div>

      {isPermissionError && (
        <div className="mb-4 flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm text-amber-400">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          Conecte seu Token com permissão <strong className="mx-1">ads_read</strong> na Meta para visualizar dados reais. Atualize o token em <strong className="mx-1">Configurações</strong>.
        </div>
      )}

      {isCached && (
        <div className="mb-4 flex items-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20 text-sm text-primary">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          Exibindo dados reais do cache local (última sync: {fetchedAt ? new Date(fetchedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—"}). Aguarde para sincronizar novamente.
        </div>
      )}

      {isRateLimited && !isCached && (
        <div className="mb-4 flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm text-amber-400">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          Limite de requisições da Meta atingido. Exibindo dados de demonstração. Aguarde alguns minutos e clique em <strong className="mx-1">Forçar Atualização</strong>.
        </div>
      )}

      {isPermissionError && !isCached && (
        <div className="mb-4 flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm text-amber-400">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          Conecte seu Token com permissão <strong className="mx-1">ads_read</strong> na Meta para visualizar dados reais. Atualize o token em <strong className="mx-1">Configurações</strong>.
        </div>
      )}

      {isUsingMock && !isRateLimited && !isPermissionError && !isCached && (
        <div className="mb-4 flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm text-amber-400">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          Exibindo dados de demonstração. Configure o Ad Account ID em <strong className="mx-1">Configurações</strong> para ver dados reais.
        </div>
      )}

      {budgetMaximo > 0 && !isLoading && (() => {
        const freqLabels: Record<string, string> = { daily: "Diário", weekly: "Semanal", monthly: "Mensal" };
        const today = new Date().toISOString().slice(0, 10);
        const thisMonth = today.slice(0, 7);
        let spendNoPeriodo = totalSpend;
        if (daily.length > 0) {
          if (budgetFrequency === "daily") spendNoPeriodo = daily.filter(d => d.date === today).reduce((s, d) => s + d.spend, 0);
          else if (budgetFrequency === "weekly") spendNoPeriodo = daily.filter(d => d.date >= format(subDays(new Date(), 6), "yyyy-MM-dd")).reduce((s, d) => s + d.spend, 0);
          else spendNoPeriodo = daily.filter(d => d.date.startsWith(thisMonth)).reduce((s, d) => s + d.spend, 0);
        }
        const pct = Math.min((spendNoPeriodo / budgetMaximo) * 100, 100);
        const exceeded = spendNoPeriodo >= budgetMaximo;
        return (
          <div className="mb-4 space-y-2">
            {exceeded && (
              <div className="flex items-center gap-2 p-4 rounded-lg bg-destructive/15 border border-destructive/30 text-sm font-semibold text-destructive">
                <OctagonAlert className="w-5 h-5 shrink-0" />
                🚨 Limite {freqLabels[budgetFrequency]} de {formatCurrency(budgetMaximo)} atingido. Escala suspensa.
              </div>
            )}
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground whitespace-nowrap">{formatCurrency(spendNoPeriodo)} / {formatCurrency(budgetMaximo)} ({freqLabels[budgetFrequency]})</span>
              <Progress value={pct} className={`h-2 flex-1 ${exceeded ? "[&>div]:bg-destructive" : pct > 80 ? "[&>div]:bg-amber-500" : "[&>div]:bg-neon-green"}`} />
              <span className="text-xs font-bold">{pct.toFixed(0)}%</span>
            </div>
          </div>
        );
      })()}

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Sincronizando dados com Meta Ads...</p>
        </div>
      ) : (
        <>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }} className="mb-6 rounded-xl border border-glow-green glow-green bg-card p-8">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-2">Lucro Líquido Total</p>
            <p className="text-5xl font-black tracking-tight text-neon-green">{formatCurrency(totalProfit)}</p>
            <div className="flex items-center gap-3 mt-2">
              <p className="text-sm text-muted-foreground">Receita {formatCurrency(totalRevenue)} · Investimento {formatCurrency(totalSpend)}</p>
              {deltaProfit !== null && isFinite(deltaProfit) && (
                <span className={`text-xs font-medium ${deltaProfit >= 0 ? "text-neon-green" : "text-neon-red"}`}>{deltaProfit > 0 ? "+" : ""}{deltaProfit.toFixed(1)}% vs anterior</span>
              )}
            </div>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <MetricCard title="Investimento Total" value={formatCurrency(totalSpend)} icon={<DollarSign className="w-4 h-4" />} delta={deltaSpend} invertDelta />
            <MetricCard title="CPA Real" value={formatCurrency(avgCPA)} subtitle="Meta: R$ 200,00" variant={avgCPA > 200 * 1.2 ? "danger" : "default"} icon={<Target className="w-4 h-4" />} delta={deltaCPA} invertDelta />
            <MetricCard title="ROAS" value={`${roas.toFixed(2)}x`} variant={roas > 3 ? "profit" : "default"} icon={<TrendingUp className="w-4 h-4" />} delta={deltaROAS} />
            <MetricCard title="Compras Totais" value={String(totalPurchases)} icon={<BarChart3 className="w-4 h-4" />} delta={deltaPurchases} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <MetricCard title="CPM" value={formatCurrency(avgCPM)} icon={<Eye className="w-4 h-4" />} delta={deltaCPM} invertDelta />
            <MetricCard title="CTR" value={`${avgCTR.toFixed(2)}%`} variant={avgCTR < 1 ? "danger" : "default"} icon={<MousePointerClick className="w-4 h-4" />} delta={deltaCTR} />
            <MetricCard title="Ticket Médio (AOV)" value={formatCurrency(calcTicketMedio)} icon={<ShoppingBag className="w-4 h-4" />} delta={deltaTM} />
          </div>

          <DashboardCharts daily={daily} cpaMeta={200} />

          <CampaignsTable campaigns={campaigns} disableScale={(() => {
            if (budgetMaximo <= 0) return false;
            const today = new Date().toISOString().slice(0, 10);
            const thisMonth = today.slice(0, 7);
            let sp = totalSpend;
            if (daily.length > 0) {
              if (budgetFrequency === "daily") sp = daily.filter(d => d.date === today).reduce((s, d) => s + d.spend, 0);
              else if (budgetFrequency === "weekly") sp = daily.filter(d => d.date >= format(subDays(new Date(), 6), "yyyy-MM-dd")).reduce((s, d) => s + d.spend, 0);
              else sp = daily.filter(d => d.date.startsWith(thisMonth)).reduce((s, d) => s + d.spend, 0);
            }
            return sp >= budgetMaximo;
          })()} />

          {/* Automation Log */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="mt-8 bg-card rounded-xl border border-border overflow-hidden">
            <div className="p-6 border-b border-border flex items-center gap-2">
              <Activity className="w-4 h-4 text-neon-green" />
              <h2 className="text-lg font-bold">Log de Automação</h2>
              <span className="text-xs text-muted-foreground ml-2">Últimas {logs.length} entradas</span>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {logs.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">Nenhum log registrado ainda. Os logs aparecerão após a primeira sincronização.</p>
              ) : (
                <div className="divide-y divide-border/50">
                  {logs.map((log, i) => (
                    <div key={i} className={`px-6 py-3 text-sm flex items-start gap-3 ${log.type === "action" ? "bg-destructive/5" : ""}`}>
                      <span className="text-xs text-muted-foreground whitespace-nowrap font-mono">{log.time}</span>
                      <span className={log.type === "action" ? "text-neon-red font-semibold" : "text-muted-foreground"}>{log.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>

          {!isUsingMock && dataVerified && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="mt-8 flex items-center justify-center gap-2 py-3 text-xs text-neon-green">
              <ShieldCheck className="w-4 h-4" />
              <span>Dados Verificados com Meta Ads · Janela 7d click / 1d view</span>
            </motion.div>
          )}
        </>
      )}
    </AppLayout>
  );
}
