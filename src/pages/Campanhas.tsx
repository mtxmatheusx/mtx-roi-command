import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import ActiveProfileHeader from "@/components/ActiveProfileHeader";
import CampaignsTable from "@/components/CampaignsTable";
import { formatCurrency, formatPercent } from "@/lib/mockData";
import { useMetaAds, DateRange } from "@/hooks/useMetaAds";
import { useClientProfiles } from "@/hooks/useClientProfiles";
import DateRangePicker from "@/components/DateRangePicker";
import { motion } from "framer-motion";
import { Loader2, RefreshCw, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { subDays, format } from "date-fns";

const defaultRange: DateRange = {
  since: format(subDays(new Date(), 6), "yyyy-MM-dd"),
  until: format(new Date(), "yyyy-MM-dd"),
};

export default function CampanhasPage() {
  const [dateRange, setDateRange] = useState<DateRange>(defaultRange);
  const { adAccountId, cpaMeta, ticketMedio, metaAccessToken } = useClientProfiles();
  const { campaigns, isLoading, forceRefetch, fetchedAt, creatives } = useMetaAds(dateRange, { adAccountId, cpaMeta, ticketMedio, accessToken: metaAccessToken });
  const [viewLevel, setViewLevel] = useState<"campaigns" | "adsets" | "ads">("campaigns");

  // Group creatives (ads) by campaign for ad-level view
  const adsData = (creatives || []).map((c: any) => ({
    id: c.adName,
    name: c.adName,
    spend: c.spend,
    purchases: c.purchases,
    revenue: c.purchaseValue,
    roas: c.roas,
    ctr: c.ctr,
    clicks: c.clicks,
    impressions: c.impressions,
    costPerPurchase: c.purchases > 0 ? c.spend / c.purchases : 0,
    cpm: c.impressions > 0 ? (c.spend / c.impressions) * 1000 : 0,
    status: "ACTIVE",
    cpaMeta,
    thumbnailUrl: c.thumbnailUrl,
  }));

  return (
    <AppLayout>
      <ActiveProfileHeader />
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

      <div className="mb-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <DateRangePicker value={dateRange} onChange={setDateRange} />
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <Tabs value={viewLevel} onValueChange={(v) => setViewLevel(v as any)}>
            <TabsList className="h-8">
              <TabsTrigger value="campaigns" className="text-xs h-7 px-3">Campanhas</TabsTrigger>
              <TabsTrigger value="adsets" className="text-xs h-7 px-3">Conjuntos</TabsTrigger>
              <TabsTrigger value="ads" className="text-xs h-7 px-3">Anúncios</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {viewLevel === "campaigns" && (
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
                          <td className={`text-right px-3 py-3 ${c.ctr < 1 ? 'text-destructive' : 'text-foreground'}`}>{formatPercent(c.ctr)}</td>
                          <td className="text-right px-3 py-3">{c.clicks.toLocaleString()}</td>
                          <td className="text-right px-3 py-3">{c.pageViews.toLocaleString()}</td>
                          <td className="text-right px-3 py-3 text-muted-foreground">{formatCurrency(c.costPerPageView)}</td>
                          <td className="text-right px-3 py-3">{c.addToCart}</td>
                          <td className="text-right px-3 py-3 text-muted-foreground">{formatCurrency(c.costPerATC)}</td>
                          <td className="text-right px-3 py-3">{c.initiateCheckout}</td>
                          <td className="text-right px-3 py-3 text-muted-foreground">{formatCurrency(c.costPerIC)}</td>
                          <td className="text-right px-3 py-3 font-semibold">{c.purchases}</td>
                          <td className={`text-right px-3 py-3 font-semibold ${c.purchases > 0 && c.costPerPurchase > c.cpaMeta * 1.2 ? 'text-destructive' : ''}`}>
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

          {viewLevel === "adsets" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-card rounded-xl border border-border overflow-hidden">
              <div className="p-6 border-b border-border">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  Conjuntos de Anúncios
                  <Badge variant="secondary" className="text-xs">{campaigns.length} campanhas</Badge>
                </h2>
                <p className="text-sm text-muted-foreground">Dados agrupados por campanha (nível de conjunto)</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground text-xs uppercase tracking-wider">
                      <th className="text-left px-6 py-3 font-medium">Campanha / Conjunto</th>
                      <th className="text-right px-3 py-3 font-medium">Status</th>
                      <th className="text-right px-3 py-3 font-medium">Investimento</th>
                      <th className="text-right px-3 py-3 font-medium">Compras</th>
                      <th className="text-right px-3 py-3 font-medium">CPA</th>
                      <th className="text-right px-3 py-3 font-medium">ROAS</th>
                      <th className="text-right px-3 py-3 font-medium">CTR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaigns.map((c) => (
                      <tr key={c.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                        <td className="px-6 py-3">
                          <div className="font-medium max-w-[250px] truncate">{c.name}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">ID: {c.id}</div>
                        </td>
                        <td className="text-right px-3 py-3">
                          <Badge variant={c.status === "ACTIVE" ? "default" : "secondary"} className="text-[10px]">
                            {c.status === "ACTIVE" ? "ATIVO" : c.status}
                          </Badge>
                        </td>
                        <td className="text-right px-3 py-3">{formatCurrency(c.spend)}</td>
                        <td className="text-right px-3 py-3 font-semibold">{c.purchases}</td>
                        <td className={`text-right px-3 py-3 ${c.purchases > 0 && c.costPerPurchase > cpaMeta * 1.2 ? 'text-destructive font-semibold' : ''}`}>
                          {c.purchases > 0 ? formatCurrency(c.costPerPurchase) : '—'}
                        </td>
                        <td className={`text-right px-3 py-3 ${c.spend > 0 && c.revenue / c.spend > 3 ? 'text-success font-semibold' : ''}`}>
                          {c.spend > 0 ? `${(c.revenue / c.spend).toFixed(2)}x` : '—'}
                        </td>
                        <td className={`text-right px-3 py-3 ${c.ctr < 1 ? 'text-destructive' : ''}`}>
                          {formatPercent(c.ctr)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {viewLevel === "ads" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-card rounded-xl border border-border overflow-hidden">
              <div className="p-6 border-b border-border">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  Anúncios Individuais
                  <Badge variant="secondary" className="text-xs">{adsData.length} anúncios</Badge>
                </h2>
                <p className="text-sm text-muted-foreground">Performance por anúncio individual</p>
              </div>
              {adsData.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground">
                  <p>Nenhum dado de anúncio disponível para o período selecionado.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground text-xs uppercase tracking-wider">
                        <th className="text-left px-6 py-3 font-medium">Anúncio</th>
                        <th className="text-right px-3 py-3 font-medium">Investimento</th>
                        <th className="text-right px-3 py-3 font-medium">Impressões</th>
                        <th className="text-right px-3 py-3 font-medium">Cliques</th>
                        <th className="text-right px-3 py-3 font-medium">CTR</th>
                        <th className="text-right px-3 py-3 font-medium">Compras</th>
                        <th className="text-right px-3 py-3 font-medium">CPA</th>
                        <th className="text-right px-3 py-3 font-medium">ROAS</th>
                        <th className="text-right px-3 py-3 font-medium">Receita</th>
                      </tr>
                    </thead>
                    <tbody>
                      {adsData.map((ad: any, i: number) => (
                        <tr key={i} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                          <td className="px-6 py-3">
                            <div className="flex items-center gap-3">
                              {ad.thumbnailUrl && (
                                <img src={ad.thumbnailUrl} alt="" className="w-10 h-10 rounded object-cover border border-border" />
                              )}
                              <span className="font-medium max-w-[200px] truncate">{ad.name}</span>
                            </div>
                          </td>
                          <td className="text-right px-3 py-3">{formatCurrency(ad.spend)}</td>
                          <td className="text-right px-3 py-3">{ad.impressions.toLocaleString()}</td>
                          <td className="text-right px-3 py-3">{ad.clicks.toLocaleString()}</td>
                          <td className={`text-right px-3 py-3 ${ad.ctr < 1 ? 'text-destructive' : ''}`}>
                            {formatPercent(ad.ctr)}
                          </td>
                          <td className="text-right px-3 py-3 font-semibold">{ad.purchases}</td>
                          <td className={`text-right px-3 py-3 ${ad.costPerPurchase > cpaMeta * 1.2 ? 'text-destructive font-semibold' : ''}`}>
                            {ad.purchases > 0 ? formatCurrency(ad.costPerPurchase) : '—'}
                          </td>
                          <td className={`text-right px-3 py-3 ${ad.roas > 3 ? 'text-success font-semibold' : ''}`}>
                            {ad.roas > 0 ? `${ad.roas.toFixed(2)}x` : '—'}
                          </td>
                          <td className="text-right px-3 py-3">{formatCurrency(ad.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </motion.div>
          )}
        </>
      )}
    </AppLayout>
  );
}
