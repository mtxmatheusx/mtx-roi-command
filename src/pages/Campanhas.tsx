import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import CampaignsTable from "@/components/CampaignsTable";
import { formatCurrency, formatPercent } from "@/lib/mockData";
import { useMetaAds, DateRange } from "@/hooks/useMetaAds";
import { useClientProfiles } from "@/hooks/useClientProfiles";
import DateRangePicker from "@/components/DateRangePicker";
import { motion } from "framer-motion";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { subDays, format } from "date-fns";

const defaultRange: DateRange = {
  since: format(subDays(new Date(), 6), "yyyy-MM-dd"),
  until: format(new Date(), "yyyy-MM-dd"),
};

export default function CampanhasPage() {
  const [dateRange, setDateRange] = useState<DateRange>(defaultRange);
  const { adAccountId, cpaMeta, ticketMedio } = useClientProfiles();
  const { campaigns, isLoading, forceRefetch, fetchedAt } = useMetaAds(dateRange, { adAccountId, cpaMeta, ticketMedio });

  return (
    <AppLayout>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <motion.h1 initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-3xl font-bold tracking-tight">
            Campanhas
          </motion.h1>
          <p className="text-muted-foreground mt-1">Gestão completa com funil profundo e motor de decisão</p>
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

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <CampaignsTable campaigns={campaigns} />

          {/* Full funnel detail table */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="bg-card rounded-xl border border-border overflow-hidden mt-8">
            <div className="p-6 border-b border-border">
              <h2 className="text-lg font-bold">Funil Detalhado</h2>
              <p className="text-sm text-muted-foreground">Métricas de topo, meio e fundo de funil</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground text-xs uppercase tracking-wider">
                    <th className="text-left px-6 py-3 font-medium">Campanha</th>
                    <th className="text-right px-3 py-3 font-medium">CPM</th>
                    <th className="text-right px-3 py-3 font-medium">CTR</th>
                    <th className="text-right px-3 py-3 font-medium">Cliques</th>
                    <th className="text-right px-3 py-3 font-medium">PV</th>
                    <th className="text-right px-3 py-3 font-medium">$/PV</th>
                    <th className="text-right px-3 py-3 font-medium">ATC</th>
                    <th className="text-right px-3 py-3 font-medium">$/ATC</th>
                    <th className="text-right px-3 py-3 font-medium">IC</th>
                    <th className="text-right px-3 py-3 font-medium">$/IC</th>
                    <th className="text-right px-3 py-3 font-medium">Compras</th>
                    <th className="text-right px-3 py-3 font-medium">CPA</th>
                    <th className="text-right px-3 py-3 font-medium">CVR</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((c) => (
                    <tr key={c.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                      <td className="px-6 py-3 font-medium max-w-[200px] truncate">{c.name}</td>
                      <td className="text-right px-3 py-3 text-muted-foreground">{formatCurrency(c.cpm)}</td>
                      <td className={`text-right px-3 py-3 ${c.ctr < 1 ? 'text-neon-red' : 'text-foreground'}`}>{formatPercent(c.ctr)}</td>
                      <td className="text-right px-3 py-3">{c.clicks.toLocaleString()}</td>
                      <td className="text-right px-3 py-3">{c.pageViews.toLocaleString()}</td>
                      <td className="text-right px-3 py-3 text-muted-foreground">{formatCurrency(c.costPerPageView)}</td>
                      <td className="text-right px-3 py-3">{c.addToCart}</td>
                      <td className="text-right px-3 py-3 text-muted-foreground">{formatCurrency(c.costPerATC)}</td>
                      <td className="text-right px-3 py-3">{c.initiateCheckout}</td>
                      <td className="text-right px-3 py-3 text-muted-foreground">{formatCurrency(c.costPerIC)}</td>
                      <td className="text-right px-3 py-3 font-semibold">{c.purchases}</td>
                      <td className={`text-right px-3 py-3 font-semibold ${c.purchases > 0 && c.costPerPurchase > c.cpaMeta * 1.2 ? 'text-neon-red' : ''}`}>
                        {c.purchases > 0 ? formatCurrency(c.costPerPurchase) : '—'}
                      </td>
                      <td className="text-right px-3 py-3">{formatPercent(c.conversionRate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        </>
      )}
    </AppLayout>
  );
}
