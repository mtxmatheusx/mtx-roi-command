import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { subDays, format } from "date-fns";
import { formatCurrency } from "@/lib/mockData";
import { useMetaAds, DateRange } from "@/hooks/useMetaAds";
import { useClientProfiles } from "@/hooks/useClientProfiles";
import MetricCard from "@/components/MetricCard";
import CampaignsTable from "@/components/CampaignsTable";
import DashboardCharts from "@/components/DashboardCharts";
import DateRangePicker from "@/components/DateRangePicker";
import ActiveProfileHeader from "@/components/ActiveProfileHeader";
import AppLayout from "@/components/AppLayout";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { metaApi } from "@/lib/metaApiClient";
import DashboardTab from "@/components/dashboard/DashboardTab";
import CampaignManagerTab from "@/components/dashboard/CampaignManagerTab";
import FollowerGrowthTab from "@/components/dashboard/FollowerGrowthTab";
import { DollarSign, TrendingUp, Target, BarChart3, Loader2, AlertTriangle, RefreshCw, Eye, MousePointerClick, ShoppingBag, ShieldCheck, OctagonAlert, Activity, Briefcase, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import DashboardCustomizer from "@/components/DashboardCustomizer";
import { useDashboardPrefs } from "@/hooks/useDashboardPrefs";

interface LogEntry {
  time: string;
  message: string;
  type: "info" | "action";
}

const defaultRange: DateRange = {
  since: format(subDays(new Date(), 27), "yyyy-MM-dd"),
  until: format(new Date(), "yyyy-MM-dd"),
};

function calcDelta(current: number, previous: number): number | null {
  if (!previous || previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export default function Dashboard() {
  const { toast } = useToast();
  const [dateRange, setDateRange] = useState<DateRange>(defaultRange);
  const { adAccountId, cpaMeta, ticketMedio, budgetMaximo, budgetFrequency, activeProfile, metaAccessToken, apiBaseUrl } = useClientProfiles();
  const { campaigns, daily, previous, demographics, isLoading, isUsingMock, forceRefetch, fetchedAt, dataVerified, isRateLimited, isPermissionError, isTokenExpired, isCached } = useMetaAds(dateRange, { adAccountId, cpaMeta, ticketMedio, accessToken: metaAccessToken });

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [apiConfigured, setApiConfigured] = useState(false);
  const { isVisible } = useDashboardPrefs();

  // Initialize external API connection on load
  useEffect(() => {
    if (apiBaseUrl && metaAccessToken) {
      metaApi.configure(apiBaseUrl, metaAccessToken, { meta_token: metaAccessToken, ad_account_id: adAccountId })
        .then(() => setApiConfigured(true))
        .catch((err) => {
          console.warn("API externa indisponível:", err.message);
          setApiConfigured(false);
        });
    } else {
      setApiConfigured(false);
    }
  }, [apiBaseUrl, metaAccessToken, adAccountId]);

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

  // Auto-refresh every 15 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      forceRefetch();
    }, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, [forceRefetch]);

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
      <ActiveProfileHeader />

      {/* Monitoring Indicator */}
      <div className="mb-4 flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
        </span>
        <span className="text-xs font-medium text-success tracking-wide">Monitoramento Ativo</span>
        {apiBaseUrl && (
          <span className={`ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${apiConfigured ? "bg-success/10 border-success/20 text-success" : "bg-warning/10 border-warning/20 text-warning"}`}>
            {apiConfigured ? "API Conectada" : "API Desconectada"}
          </span>
        )}
      </div>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <motion.h1 initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-2xl font-semibold tracking-tight">
            MTX Command Center
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
          <DashboardCustomizer />
        </div>
      </div>

      <div className="mb-6"><DateRangePicker value={dateRange} onChange={setDateRange} /></div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="flex items-center gap-2 flex-wrap">
          <TabsList className="liquid-glass !rounded-xl flex-wrap h-auto gap-1 p-1">
            <TabsTrigger value="dashboard" className="gap-2 text-xs sm:text-sm"><BarChart3 className="w-4 h-4" />Dashboard</TabsTrigger>
            <TabsTrigger value="campaign-manager" className="gap-2 text-xs sm:text-sm"><Briefcase className="w-4 h-4" />Gestão</TabsTrigger>
            <TabsTrigger value="followers" className="gap-2 text-xs sm:text-sm"><Users className="w-4 h-4" />Seguidores</TabsTrigger>
          </TabsList>
          <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" className="gap-2 h-8 text-xs sm:text-sm">
              <Eye className="w-4 h-4" />
              <span className="hidden sm:inline">Graph API Explorer</span>
              <span className="sm:hidden">Graph API</span>
            </Button>
          </a>
        </div>

        <TabsContent value="dashboard">
          <DashboardTab
            campaigns={campaigns}
            daily={daily}
            previous={previous}
            isLoading={isLoading}
            isUsingMock={isUsingMock}
            isRateLimited={isRateLimited}
            isPermissionError={isPermissionError}
            isTokenExpired={isTokenExpired}
            isCached={isCached}
            dataVerified={dataVerified}
            fetchedAt={fetchedAt}
            budgetMaximo={budgetMaximo}
            budgetFrequency={budgetFrequency}
            cpaMeta={cpaMeta}
            totalSpend={totalSpend}
            totalRevenue={totalRevenue}
            totalProfit={totalProfit}
            totalPurchases={totalPurchases}
            avgCPA={avgCPA}
            roas={roas}
            avgCPM={avgCPM}
            avgCTR={avgCTR}
            calcTicketMedio={calcTicketMedio}
            deltaProfit={deltaProfit}
            deltaSpend={deltaSpend}
            deltaCPA={deltaCPA}
            deltaROAS={deltaROAS}
            deltaPurchases={deltaPurchases}
            deltaCPM={deltaCPM}
            deltaCTR={deltaCTR}
            deltaTM={deltaTM}
            logs={logs}
            demographics={demographics}
            sectionVisible={isVisible}
          />
        </TabsContent>

        <TabsContent value="campaign-manager">
          <CampaignManagerTab campaigns={campaigns} isLoading={isLoading} />
        </TabsContent>

        <TabsContent value="followers">
          <FollowerGrowthTab />
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
