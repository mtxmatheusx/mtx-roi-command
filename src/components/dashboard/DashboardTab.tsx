import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { subDays, format } from "date-fns";
import { formatCurrency } from "@/lib/mockData";
import MetricCard from "@/components/MetricCard";
import CampaignsTable from "@/components/CampaignsTable";
import DashboardCharts from "@/components/DashboardCharts";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { Progress } from "@/components/ui/progress";
import { useTokenHealth } from "@/hooks/useTokenHealth";
import { DollarSign, TrendingUp, Target, BarChart3, AlertTriangle, Eye, MousePointerClick, ShoppingBag, ShieldCheck, OctagonAlert, Activity, X, KeyRound } from "lucide-react";

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

const AlertBanner = ({ children, variant = "warning", onDismiss }: { children: React.ReactNode; variant?: "warning" | "info" | "error"; onDismiss?: () => void }) => {
  const styles = {
    warning: "bg-warning/5 border-warning/15 text-warning",
    info: "bg-primary/5 border-primary/15 text-primary",
    error: "bg-destructive/5 border-destructive/15 text-destructive",
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: -4, height: "auto" }}
      animate={{ opacity: 1, y: 0, height: "auto" }}
      exit={{ opacity: 0, height: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }}
      transition={{ duration: 0.2 }}
      className={`mb-4 flex items-center gap-2.5 p-3.5 rounded-xl border text-sm ${styles[variant]}`}>
      <AlertTriangle className="w-4 h-4 shrink-0" />
      <span className="flex-1">{children}</span>
      {onDismiss && (
        <button onClick={onDismiss} className="shrink-0 p-1 rounded-md hover:bg-foreground/10 transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      )}
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

  const { alerts: tokenAlerts } = useTokenHealth();
  const [dismissed, setDismissed] = useState<Record<string, boolean>>({});
  const dismiss = (key: string) => setDismissed((prev) => ({ ...prev, [key]: true }));

  return (
    <div className="space-y-6">
      {/* Status Banners */}
      <AnimatePresence>
        {isPermissionError && !dismissed.permission && (
          <AlertBanner key="permission" variant="warning" onDismiss={() => dismiss("permission")}>
            Conecte seu Token com permissão <strong className="mx-1">ads_read</strong> na Meta para visualizar dados reais.
          </AlertBanner>
        )}
        {isTokenExpired && !dismissed.tokenExpired && (
          <AlertBanner key="tokenExpired" variant="error" onDismiss={() => dismiss("tokenExpired")}>
            Token da Meta expirado. Atualize o token nas <strong className="mx-1">Configurações</strong> para voltar a sincronizar dados reais.
          </AlertBanner>
        )}
        {isCached && !dismissed.cached && (
          <AlertBanner key="cached" variant="info" onDismiss={() => dismiss("cached")}>
            Exibindo dados do cache local (última sync: {fetchedAt ? new Date(fetchedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—"}).
          </AlertBanner>
        )}
        {isRateLimited && !isCached && !isTokenExpired && !dismissed.rateLimit && (
          <AlertBanner key="rateLimit" onDismiss={() => dismiss("rateLimit")}>Limite de requisições da Meta atingido. Exibindo dados de demonstração.</AlertBanner>
        )}
        {isUsingMock && !isRateLimited && !isPermissionError && !isCached && !isTokenExpired && !dismissed.mock && (
          <AlertBanner key="mock" onDismiss={() => dismiss("mock")}>Exibindo dados de demonstração. Configure o Ad Account ID em <strong className="mx-1">Configurações</strong>.</AlertBanner>
        )}
      </AnimatePresence>

      {/* Token Expiration Alerts */}
      <AnimatePresence>
        {tokenAlerts.map((alert) => {
          const key = `token-${alert.profileName}`;
          if (dismissed[key]) return null;
          return (
            <motion.div
              key={key}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className={`mb-4 flex items-center gap-2.5 p-3.5 rounded-xl border text-sm ${
                alert.status === "expired" || alert.status === "invalid"
                  ? "bg-destructive/5 border-destructive/15 text-destructive"
                  : "bg-warning/5 border-warning/15 text-warning"
              }`}
            >
              <KeyRound className="w-4 h-4 shrink-0" />
              <span className="flex-1">
                {alert.status === "expired"
                  ? <>Token do perfil <strong>{alert.profileName}</strong> expirou. Atualize em <strong>Configurações</strong>.</>
                  : alert.status === "invalid"
                  ? <>Token do perfil <strong>{alert.profileName}</strong> é inválido. Reconfigure em <strong>Configurações</strong>.</>
                  : <>Token do perfil <strong>{alert.profileName}</strong> expira em <strong>{alert.daysLeft} dia{alert.daysLeft !== 1 ? "s" : ""}</strong>. Renove em <strong>Configurações</strong>.</>
                }
              </span>
              <button onClick={() => dismiss(key)} className="shrink-0 p-1 rounded-md hover:bg-foreground/10 transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>

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
            <div className="liquid-glass">
              <div className="lg-distortion" />
              <div className="lg-overlay" />
              <div className="lg-specular" />
              <div className="lg-content flex items-center gap-4">
              <span className="text-xs text-muted-foreground whitespace-nowrap font-medium">
                {formatCurrency(spendNoPeriodo)} / {formatCurrency(budgetMaximo)}
              </span>
              <Progress value={pct} className={`h-2 flex-1 rounded-full ${exceeded ? "[&>div]:bg-destructive" : pct > 80 ? "[&>div]:bg-warning" : "[&>div]:bg-success"}`} />
              <span className="text-xs font-bold text-foreground">{pct.toFixed(0)}%</span>
              <span className="text-[10px] text-muted-foreground">{freqLabels[budgetFrequency]}</span>
              </div>
            </div>
          </div>
        );
      })()}

      {isLoading ? (
        <DashboardSkeleton />
      ) : (
        <>
          {/* Hero Profit Section */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="glass-strong p-6 sm:p-10 text-center relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.015] via-transparent to-success/[0.015] pointer-events-none" />
            <div className="relative">
              <p className="text-[11px] font-semibold text-muted-foreground tracking-[0.2em] uppercase mb-4">Lucro Líquido Total</p>
              <p className={`text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tighter hero-number ${totalProfit >= 0 ? "text-success" : "text-destructive"}`}>{formatCurrency(totalProfit)}</p>
              <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-5 mt-5">
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
                    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full transition-colors
                      ${deltaProfit >= 0 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                      {deltaProfit >= 0 ? <TrendingUp className="w-3 h-3" /> : null}
                      {deltaProfit > 0 ? "+" : ""}{deltaProfit.toFixed(1)}%
                    </span>
                  </>
                )}
              </div>
            </div>
          </motion.div>

          {/* Primary KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <MetricCard title="Investimento" value={formatCurrency(totalSpend)} icon={<DollarSign className="w-4 h-4" />} delta={deltaSpend} invertDelta index={0} />
            <MetricCard title="CPA" value={formatCurrency(avgCPA)} subtitle={`Meta: ${formatCurrency(cpaMeta)}`} variant={avgCPA > cpaMeta * 1.2 ? "danger" : "default"} icon={<Target className="w-4 h-4" />} delta={deltaCPA} invertDelta index={1} />
            <MetricCard title="ROAS" value={`${roas.toFixed(2)}x`} variant={roas > 3 ? "profit" : "default"} icon={<TrendingUp className="w-4 h-4" />} delta={deltaROAS} index={2} />
            <MetricCard title="Compras" value={String(totalPurchases)} icon={<BarChart3 className="w-4 h-4" />} delta={deltaPurchases} index={3} />
          </div>

          {/* Secondary KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
            <MetricCard title="CPM" value={formatCurrency(avgCPM)} icon={<Eye className="w-4 h-4" />} delta={deltaCPM} invertDelta index={4} />
            <MetricCard title="CTR" value={`${avgCTR.toFixed(2)}%`} variant={avgCTR < 1 ? "danger" : "default"} icon={<MousePointerClick className="w-4 h-4" />} delta={deltaCTR} index={5} />
            <MetricCard title="Ticket Médio" value={formatCurrency(calcTicketMedio)} icon={<ShoppingBag className="w-4 h-4" />} delta={deltaTM} index={6} />
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
            className="glass overflow-hidden">
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
