import { motion } from "framer-motion";
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

export default function DashboardTab(props: DashboardTabProps) {
  const {
    campaigns, daily, previous, isLoading, isUsingMock, isRateLimited, isPermissionError, isCached,
    dataVerified, fetchedAt, budgetMaximo, budgetFrequency, cpaMeta,
    totalSpend, totalRevenue, totalProfit, totalPurchases, avgCPA, roas, avgCPM, avgCTR, calcTicketMedio,
    deltaProfit, deltaSpend, deltaCPA, deltaROAS, deltaPurchases, deltaCPM, deltaCTR, deltaTM, logs,
  } = props;

  return (
    <>
      {isPermissionError && (
        <div className="mb-4 flex items-center gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20 text-sm text-warning">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          Conecte seu Token com permissão <strong className="mx-1">ads_read</strong> na Meta para visualizar dados reais.
        </div>
      )}

      {isCached && (
        <div className="mb-4 flex items-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20 text-sm text-primary">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          Exibindo dados do cache local (última sync: {fetchedAt ? new Date(fetchedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—"}).
        </div>
      )}

      {isRateLimited && !isCached && (
        <div className="mb-4 flex items-center gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20 text-sm text-warning">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          Limite de requisições da Meta atingido. Exibindo dados de demonstração.
        </div>
      )}

      {isUsingMock && !isRateLimited && !isPermissionError && !isCached && (
        <div className="mb-4 flex items-center gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20 text-sm text-warning">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          Exibindo dados de demonstração. Configure o Ad Account ID em <strong className="mx-1">Configurações</strong>.
        </div>
      )}

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
          <div className="mb-4 space-y-2">
            {exceeded && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm font-medium text-destructive">
                <OctagonAlert className="w-4 h-4 shrink-0" />
                Limite {freqLabels[budgetFrequency]} de {formatCurrency(budgetMaximo)} atingido. Escala suspensa.
              </div>
            )}
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground whitespace-nowrap">{formatCurrency(spendNoPeriodo)} / {formatCurrency(budgetMaximo)} ({freqLabels[budgetFrequency]})</span>
              <Progress value={pct} className={`h-2 flex-1 ${exceeded ? "[&>div]:bg-destructive" : pct > 80 ? "[&>div]:bg-warning" : "[&>div]:bg-success"}`} />
              <span className="text-xs font-semibold">{pct.toFixed(0)}%</span>
            </div>
          </div>
        );
      })()}

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Sincronizando dados...</p>
        </div>
      ) : (
        <>
          <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3 }} className="mb-6 rounded-lg border border-success/20 bg-success/5 p-6">
            <p className="text-xs font-medium text-muted-foreground mb-1">Lucro Líquido Total</p>
            <p className="text-4xl font-bold tracking-tight text-success">{formatCurrency(totalProfit)}</p>
            <div className="flex items-center gap-3 mt-1.5">
              <p className="text-sm text-muted-foreground">Receita {formatCurrency(totalRevenue)} · Investimento {formatCurrency(totalSpend)}</p>
              {deltaProfit !== null && isFinite(deltaProfit) && (
                <span className={`text-xs font-medium ${deltaProfit >= 0 ? "text-success" : "text-destructive"}`}>{deltaProfit > 0 ? "+" : ""}{deltaProfit.toFixed(1)}% vs anterior</span>
              )}
            </div>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <MetricCard title="Investimento Total" value={formatCurrency(totalSpend)} icon={<DollarSign className="w-4 h-4" />} delta={deltaSpend} invertDelta />
            <MetricCard title="CPA Real" value={formatCurrency(avgCPA)} subtitle="Meta: R$ 200,00" variant={avgCPA > 200 * 1.2 ? "danger" : "default"} icon={<Target className="w-4 h-4" />} delta={deltaCPA} invertDelta />
            <MetricCard title="ROAS" value={`${roas.toFixed(2)}x`} variant={roas > 3 ? "profit" : "default"} icon={<TrendingUp className="w-4 h-4" />} delta={deltaROAS} />
            <MetricCard title="Compras Totais" value={String(totalPurchases)} icon={<BarChart3 className="w-4 h-4" />} delta={deltaPurchases} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
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
              if (budgetFrequency === "daily") sp = daily.filter((d: any) => d.date === today).reduce((s: number, d: any) => s + d.spend, 0);
              else if (budgetFrequency === "weekly") sp = daily.filter((d: any) => d.date >= format(subDays(new Date(), 6), "yyyy-MM-dd")).reduce((s: number, d: any) => s + d.spend, 0);
              else sp = daily.filter((d: any) => d.date.startsWith(thisMonth)).reduce((s: number, d: any) => s + d.spend, 0);
            }
            return sp >= budgetMaximo;
          })()} />

          {/* Automation Log */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="mt-6 bg-card rounded-lg border border-border overflow-hidden">
            <div className="p-5 border-b border-border flex items-center gap-2">
              <Activity className="w-4 h-4 text-success" />
              <h2 className="text-base font-semibold">Log de Automação</h2>
              <span className="text-xs text-muted-foreground ml-2">{logs.length} entradas</span>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {logs.length === 0 ? (
                <p className="p-5 text-sm text-muted-foreground">Nenhum log registrado ainda.</p>
              ) : (
                <div className="divide-y divide-border">
                  {logs.map((log, i) => (
                    <div key={i} className={`px-5 py-2.5 text-sm flex items-start gap-3 ${log.type === "action" ? "bg-destructive/5" : ""}`}>
                      <span className="text-xs text-muted-foreground whitespace-nowrap font-mono">{log.time}</span>
                      <span className={log.type === "action" ? "text-destructive font-medium" : "text-muted-foreground"}>{log.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>

          {!isUsingMock && dataVerified && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="mt-6 flex items-center justify-center gap-2 py-3 text-xs text-success">
              <ShieldCheck className="w-4 h-4" />
              <span>Dados Verificados com Meta Ads · Janela 7d click / 1d view</span>
            </motion.div>
          )}
        </>
      )}
    </>
  );
}
