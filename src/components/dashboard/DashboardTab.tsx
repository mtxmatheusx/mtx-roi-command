import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { subDays, format } from "date-fns";
import { formatCurrency } from "@/lib/mockData";
import MetricCard from "@/components/MetricCard";
import CampaignsTable from "@/components/CampaignsTable";
import DashboardCharts from "@/components/DashboardCharts";
import { Progress } from "@/components/ui/progress";
import { DollarSign, TrendingUp, Target, BarChart3, Loader2, AlertTriangle, Eye, MousePointerClick, ShoppingBag, ShieldCheck, OctagonAlert, Activity } from "lucide-react";

interface LogEntry {
  time: string;
  message: string;
  type: "info" | "action";
}

interface DashboardTabProps {
  campaigns: any[];
  daily: any[];
  previous: any;
  isLoading: boolean;
  isUsingMock: boolean;
  isRateLimited: boolean;
  isPermissionError: boolean;
  isTokenExpired: boolean;
  isCached: boolean;
  dataVerified: boolean;
  fetchedAt: string | null;
  budgetMaximo: number;
  budgetFrequency: string;
  cpaMeta: number;
  totalSpend: number;
  totalRevenue: number;
  totalProfit: number;
  totalPurchases: number;
  avgCPA: number;
  roas: number;
  avgCPM: number;
  avgCTR: number;
  calcTicketMedio: number;
  deltaProfit: number | null;
  deltaSpend: number | null;
  deltaCPA: number | null;
  deltaROAS: number | null;
  deltaPurchases: number | null;
  deltaCPM: number | null;
  deltaCTR: number | null;
  deltaTM: number | null;
  logs: LogEntry[];
}

const AlertBanner = ({ children, variant = "warning" }: { children: React.ReactNode; variant?: "warning" | "info" | "error" }) => {
  const styles = {
    warning: "bg-warning/5 border-warning/15 text-warning",
    info: "bg-primary/5 border-primary/15 text-primary",
    error: "bg-destructive/5 border-destructive/15 text-destructive",
  };
  return (
    <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
      className={`mb-4 flex items-center gap-2.5 p-3.5 rounded-xl border text-sm ${styles[variant]}`}>
      <AlertTriangle className="w-4 h-4 shrink-0" />
      {children}
    </motion.div>
  );
};

export default function DashboardTab(props: DashboardTabProps) {
  const {
    campaigns, daily, previous, isLoading, isUsingMock, isRateLimited, isPermissionError, isTokenExpired, isCached,
    dataVerified, fetchedAt, budgetMaximo, budgetFrequency, cpaMeta,
    totalSpend, totalRevenue, totalProfit, totalPurchases, avgCPA, roas, avgCPM, avgCTR, calcTicketMedio,
    deltaProfit, deltaSpend, deltaCPA, deltaROAS, deltaPurchases, deltaCPM, deltaCTR, deltaTM, logs,
  } = props;

  return (
    <div className="space-y-6">
      {/* Status Banners */}
      {isPermissionError && (
        <AlertBanner variant="warning">
          Conecte seu Token com permissão <strong className="mx-1">ads_read</strong> na Meta para visualizar dados reais.
        </AlertBanner>
      )}
      {isTokenExpired && (
        <AlertBanner variant="error">
          Token da Meta expirado. Atualize o token nas <strong className="mx-1">Configurações</strong> para voltar a sincronizar dados reais.
        </AlertBanner>
      )}
      {isCached && (
        <AlertBanner variant="info">
          Exibindo dados do cache local (última sync: {fetchedAt ? new Date(fetchedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—"}).
        </AlertBanner>
      )}
      {isRateLimited && !isCached && !isTokenExpired && (
        <AlertBanner>Limite de requisições da Meta atingido. Exibindo dados de demonstração.</AlertBanner>
      )}
      {isUsingMock && !isRateLimited && !isPermissionError && !isCached && !isTokenExpired && (
        <AlertBanner>Exibindo dados de demonstração. Configure o Ad Account ID em <strong className="mx-1">Configurações</strong>.</AlertBanner>
      )}

      {/* Budget Progress */}
      {budgetMaximo > 0 && !isLoading && (() => {
        const freqLabels: Record<string, string> = { daily: "Diário", weekly: "Semanal", monthly: "Mensal" };
        const today = new Date().toISOString().slice(0, 10);
        const thisMonth = today.slice(0, 7);
        let spendNoPeriodo = totalSpend;
        if (daily.length > 0) {
          if (budgetFrequency === "daily") spendNoPeriodo = daily.filter((d: any) => d.date === today).reduce((s: number, d: any) => s + d.spend, 0);
          else if (budgetFrequency === "weekly") spendNoPeriodo = daily.filter((d: any) => d.date >= format(subDays(new Date(), 6), "yyyy-MM-dd")).reduce((s: number, d: any) => s + d.spend, 0);
          else spendNoPeriodo = daily.filter((d: any) => d.date.startsWith(thisMonth)).reduce((s: number, d: any) => s + d.spend, 0);
        }
        const pct = Math.min((spendNoPeriodo / budgetMaximo) * 100, 100);
        const exceeded = spendNoPeriodo >= budgetMaximo;
        return (
          <div className="space-y-2">
            {exceeded && (
              <div className="flex items-center gap-2 p-3.5 rounded-xl bg-destructive/5 border border-destructive/15 text-sm font-medium text-destructive">
                <OctagonAlert className="w-4 h-4 shrink-0" />
                Limite {freqLabels[budgetFrequency]} de {formatCurrency(budgetMaximo)} atingido. Escala suspensa.
              </div>
            )}
            <div className="glass-card p-4 flex items-center gap-4">
              <span className="text-xs text-muted-foreground whitespace-nowrap font-medium">
                {formatCurrency(spendNoPeriodo)} / {formatCurrency(budgetMaximo)}
              </span>
              <Progress value={pct} className={`h-2 flex-1 rounded-full ${exceeded ? "[&>div]:bg-destructive" : pct > 80 ? "[&>div]:bg-warning" : "[&>div]:bg-success"}`} />
              <span className="text-xs font-bold text-foreground">{pct.toFixed(0)}%</span>
              <span className="text-[10px] text-muted-foreground">{freqLabels[budgetFrequency]}</span>
            </div>
          </div>
        );
      })()}

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
          <p className="text-sm text-muted-foreground font-medium">Sincronizando dados…</p>
        </div>
      ) : (
        <>
          {/* Hero Profit Section */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="glass-card p-8 text-center"
          >
            <p className="text-xs font-medium text-muted-foreground tracking-wider uppercase mb-3">Lucro Líquido Total</p>
            <p className="text-3xl sm:text-5xl font-bold tracking-tighter text-success hero-number">{formatCurrency(totalProfit)}</p>
            <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 mt-4">
              <span className="text-sm text-muted-foreground">
                Receita <span className="font-semibold text-foreground">{formatCurrency(totalRevenue)}</span>
              </span>
              <span className="w-1 h-1 rounded-full bg-border" />
              <span className="text-sm text-muted-foreground">
                Investimento <span className="font-semibold text-foreground">{formatCurrency(totalSpend)}</span>
              </span>
              {deltaProfit !== null && isFinite(deltaProfit) && (
                <>
                  <span className="w-1 h-1 rounded-full bg-border" />
                  <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full
                    ${deltaProfit >= 0 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                    {deltaProfit >= 0 ? <TrendingUp className="w-3 h-3" /> : null}
                    {deltaProfit > 0 ? "+" : ""}{deltaProfit.toFixed(1)}%
                  </span>
                </>
              )}
            </div>
          </motion.div>

          {/* Primary KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard title="Investimento" value={formatCurrency(totalSpend)} icon={<DollarSign className="w-4 h-4" />} delta={deltaSpend} invertDelta />
            <MetricCard title="CPA" value={formatCurrency(avgCPA)} subtitle={`Meta: ${formatCurrency(cpaMeta)}`} variant={avgCPA > cpaMeta * 1.2 ? "danger" : "default"} icon={<Target className="w-4 h-4" />} delta={deltaCPA} invertDelta />
            <MetricCard title="ROAS" value={`${roas.toFixed(2)}x`} variant={roas > 3 ? "profit" : "default"} icon={<TrendingUp className="w-4 h-4" />} delta={deltaROAS} />
            <MetricCard title="Compras" value={String(totalPurchases)} icon={<BarChart3 className="w-4 h-4" />} delta={deltaPurchases} />
          </div>

          {/* Secondary KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <MetricCard title="CPM" value={formatCurrency(avgCPM)} icon={<Eye className="w-4 h-4" />} delta={deltaCPM} invertDelta />
            <MetricCard title="CTR" value={`${avgCTR.toFixed(2)}%`} variant={avgCTR < 1 ? "danger" : "default"} icon={<MousePointerClick className="w-4 h-4" />} delta={deltaCTR} />
            <MetricCard title="Ticket Médio" value={formatCurrency(calcTicketMedio)} icon={<ShoppingBag className="w-4 h-4" />} delta={deltaTM} />
          </div>

          {/* Charts */}
          <DashboardCharts daily={daily} cpaMeta={cpaMeta} />

          {/* Campaigns Table */}
          <CampaignsTable campaigns={campaigns} disableScale={(() => {
            if (budgetMaximo <= 0) return false;
            const today = new Date().toISOString().slice(0, 10);
            const thisMonth = today.slice(0, 7);
            let sp = totalSpend;
            if (daily.length > 0) {
              if (budgetFrequency === "daily") sp = daily.filter((d: any) => d.date === today).reduce((s: number, d: any) => s + d.spend, 0);
              else if (budgetFrequency === "weekly") sp = daily.filter((d: any) => d.date >= format(subDays(new Date(), 6), "yyyy-MM-dd")).reduce((s: number, d: any) => s + d.spend, 0);
              else sp = daily.filter((d: any) => d.date.startsWith(thisMonth)).reduce((s: number, d: any) => s + d.spend, 0);
            }
            return sp >= budgetMaximo;
          })()} />

          {/* Automation Log */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
            className="glass-card overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-md bg-success/10 flex items-center justify-center">
                <Activity className="w-3.5 h-3.5 text-success" />
              </div>
              <h2 className="text-sm font-semibold text-foreground">Log de Automação</h2>
              <span className="text-[10px] text-muted-foreground font-medium bg-muted px-2 py-0.5 rounded-full ml-1">{logs.length}</span>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {logs.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">Nenhum log registrado ainda.</p>
              ) : (
                <div className="divide-y divide-border">
                  {logs.map((log, i) => (
                    <div key={i} className={`px-6 py-3 text-sm flex items-start gap-3 transition-colors ${log.type === "action" ? "bg-destructive/3" : "hover:bg-muted/50"}`}>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap font-mono mt-0.5">{log.time}</span>
                      <span className={log.type === "action" ? "text-destructive font-medium" : "text-muted-foreground"}>{log.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>

          {/* Data Verified */}
          {!isUsingMock && dataVerified && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
              className="flex items-center justify-center gap-2 py-4 text-xs text-success">
              <ShieldCheck className="w-4 h-4" />
              <span className="font-medium">Dados Verificados com Meta Ads · Janela 7d click / 1d view</span>
            </motion.div>
          )}
        </>
      )}
    </div>
  );
}
