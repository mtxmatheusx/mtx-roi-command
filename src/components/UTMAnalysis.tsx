import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Link2, ArrowUpDown, RefreshCw, Settings, ChevronRight, Loader2, ShoppingBag } from "lucide-react";
import { formatCurrency } from "@/lib/mockData";
import { useClientProfiles } from "@/hooks/useClientProfiles";
import { useEcommerceConnection, useUTMSales, type UTMSale } from "@/hooks/useEcommerceIntegration";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { useMetaAds, type DateRange } from "@/hooks/useMetaAds";

type UTMLevel = "utm_source" | "utm_medium" | "utm_campaign" | "utm_content";

const LEVEL_LABELS: Record<UTMLevel, string> = {
  utm_source: "Fonte",
  utm_medium: "Mídia",
  utm_campaign: "Campanha",
  utm_content: "Conteúdo",
};

interface AggregatedRow {
  key: string;
  orders: number;
  paidOrders: number;
  revenue: number;
  paidRevenue: number;
  avgTicket: number;
}

function aggregate(sales: UTMSale[], level: UTMLevel): AggregatedRow[] {
  const map = new Map<string, AggregatedRow>();
  for (const s of sales) {
    const key = (s as any)[level] || "(não definido)";
    if (!map.has(key)) {
      map.set(key, { key, orders: 0, paidOrders: 0, revenue: 0, paidRevenue: 0, avgTicket: 0 });
    }
    const row = map.get(key)!;
    row.orders++;
    row.revenue += Number(s.total_amount) || 0;
    const paid = ["paid", "authorized"].includes((s.order_status || "").toLowerCase());
    if (paid) {
      row.paidOrders++;
      row.paidRevenue += Number(s.total_amount) || 0;
    }
  }
  for (const row of map.values()) row.avgTicket = row.paidOrders ? row.paidRevenue / row.paidOrders : 0;
  return Array.from(map.values());
}

interface UTMAnalysisProps {
  dateRange?: DateRange;
}

export default function UTMAnalysis({ dateRange }: UTMAnalysisProps) {
  const { activeProfile, adAccountId, cpaMeta, ticketMedio, metaAccessToken } = useClientProfiles();
  const profileId = activeProfile?.id;
  const { connection, isLoading: connLoading, syncOrders } = useEcommerceConnection(profileId);
  const { data: sales = [], isLoading } = useUTMSales(profileId, dateRange?.since, dateRange?.until);
  const { campaigns } = useMetaAds(dateRange || { since: "", until: "" }, {
    adAccountId, cpaMeta, ticketMedio, accessToken: metaAccessToken,
  });

  const [level, setLevel] = useState<UTMLevel>("utm_source");
  const [sortBy, setSortBy] = useState<"paidRevenue" | "paidOrders" | "avgTicket">("paidRevenue");

  // Total Meta spend across selected period (for global ROAS line)
  const metaSpend = useMemo(
    () => campaigns.reduce((s, c) => s + (c.spend || 0), 0),
    [campaigns],
  );

  const aggregated = useMemo(() => {
    const rows = aggregate(sales, level);
    return rows.sort((a, b) => (b[sortBy] as number) - (a[sortBy] as number));
  }, [sales, level, sortBy]);

  const totals = useMemo(() => {
    const orders = sales.length;
    const paid = sales.filter((s) => ["paid", "authorized"].includes((s.order_status || "").toLowerCase()));
    const revenue = paid.reduce((s, x) => s + Number(x.total_amount), 0);
    return {
      orders,
      paidOrders: paid.length,
      revenue,
      avgTicket: paid.length ? revenue / paid.length : 0,
      roas: metaSpend > 0 ? revenue / metaSpend : 0,
    };
  }, [sales, metaSpend]);

  /* ─── Empty state: not connected ─── */
  if (!connLoading && !connection) {
    return (
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Link2 className="w-5 h-5 text-primary" />
          <div>
            <h3 className="text-base font-semibold">Análise UTM</h3>
            <p className="text-xs text-muted-foreground">Rastreamento de vendas por fonte/mídia/campanha</p>
          </div>
        </div>

        <div className="text-center py-10 space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
            <ShoppingBag className="w-7 h-7 text-primary" />
          </div>
          <div className="max-w-md mx-auto">
            <p className="text-sm font-medium text-foreground">Conecte sua loja Nuvemshop</p>
            <p className="text-xs text-muted-foreground mt-1.5">
              Sincronize seus pedidos para cruzar com o gasto da Meta e ver o ROAS real por fonte, mídia, campanha e conteúdo.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 justify-center">
            {["utm_source", "utm_medium", "utm_campaign", "utm_content"].map((tag) => (
              <span key={tag} className="px-2 py-1 rounded-md bg-muted/50 border border-border text-[10px] font-mono text-muted-foreground">
                {tag}
              </span>
            ))}
          </div>
          <Link to="/configuracoes">
            <Button size="sm" className="gap-2 mt-2">
              <Settings className="w-3.5 h-3.5" />
              Configurar integração
            </Button>
          </Link>
        </div>
      </motion.div>
    );
  }

  /* ─── Connected: full dashboard ─── */
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Link2 className="w-5 h-5 text-primary shrink-0" />
          <div className="min-w-0">
            <h3 className="text-base font-semibold truncate">Análise UTM</h3>
            <p className="text-xs text-muted-foreground truncate">
              {connection?.store_name || "Loja Nuvemshop"} · {totals.orders} pedido{totals.orders === 1 ? "" : "s"} no período
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => syncOrders.mutate(30)}
            disabled={syncOrders.isPending}
            className="gap-1.5 h-8 text-xs"
          >
            {syncOrders.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            Sincronizar
          </Button>
          <Link to="/configuracoes">
            <Button variant="ghost" size="sm" className="gap-1.5 h-8 text-xs">
              <Settings className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Config</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Receita paga" value={formatCurrency(totals.revenue)} accent="success" />
        <KPI label="Pedidos pagos" value={String(totals.paidOrders)} sublabel={`${totals.orders} totais`} />
        <KPI label="Ticket médio" value={formatCurrency(totals.avgTicket)} />
        <KPI
          label="ROAS real"
          value={metaSpend > 0 ? `${totals.roas.toFixed(2)}x` : "—"}
          sublabel={metaSpend > 0 ? `gasto Meta ${formatCurrency(metaSpend)}` : "configure Meta"}
          accent={totals.roas >= 3 ? "success" : totals.roas >= 1.5 ? "neutral" : "destructive"}
        />
      </div>

      {/* Drill-down level */}
      <Tabs value={level} onValueChange={(v) => setLevel(v as UTMLevel)}>
        <TabsList className="liquid-glass h-auto p-1 flex-wrap gap-1">
          {(Object.keys(LEVEL_LABELS) as UTMLevel[]).map((lv) => (
            <TabsTrigger key={lv} value={lv} className="text-xs">
              {LEVEL_LABELS[lv]}
            </TabsTrigger>
          ))}
        </TabsList>

        {(Object.keys(LEVEL_LABELS) as UTMLevel[]).map((lv) => (
          <TabsContent key={lv} value={lv} className="mt-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando vendas...
              </div>
            ) : aggregated.length === 0 ? (
              <div className="text-center py-10 text-sm text-muted-foreground">
                Nenhuma venda com {LEVEL_LABELS[lv].toLowerCase()} no período.
                <br />
                <button
                  onClick={() => syncOrders.mutate(90)}
                  className="text-primary hover:underline mt-2 inline-flex items-center gap-1"
                >
                  Tentar sincronizar últimos 90 dias <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto -mx-2 sm:mx-0">
                <table className="w-full text-sm min-w-[480px]">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground text-[10px] uppercase tracking-wider">
                      <th className="text-left px-3 py-2 font-medium">{LEVEL_LABELS[lv]}</th>
                      <SortableTh label="Pedidos" active={sortBy === "paidOrders"} onClick={() => setSortBy("paidOrders")} />
                      <SortableTh label="Receita" active={sortBy === "paidRevenue"} onClick={() => setSortBy("paidRevenue")} />
                      <SortableTh label="Ticket méd." active={sortBy === "avgTicket"} onClick={() => setSortBy("avgTicket")} />
                      <th className="text-right px-3 py-2 font-medium">% receita</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aggregated.map((row) => {
                      const pct = totals.revenue > 0 ? (row.paidRevenue / totals.revenue) * 100 : 0;
                      return (
                        <tr key={row.key} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                          <td className="px-3 py-2 font-medium tabular-nums max-w-[280px] truncate" title={row.key}>
                            {row.key}
                          </td>
                          <td className="text-right px-3 py-2 tabular-nums">
                            <span className="font-semibold">{row.paidOrders}</span>
                            <span className="text-muted-foreground/70 text-xs"> / {row.orders}</span>
                          </td>
                          <td className="text-right px-3 py-2 font-semibold tabular-nums">{formatCurrency(row.paidRevenue)}</td>
                          <td className="text-right px-3 py-2 tabular-nums text-muted-foreground">{formatCurrency(row.avgTicket)}</td>
                          <td className="text-right px-3 py-2 tabular-nums">
                            <div className="inline-flex items-center gap-2 justify-end w-full">
                              <span className="text-xs">{pct.toFixed(1)}%</span>
                              <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden hidden sm:block">
                                <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(pct, 100)}%` }} />
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {connection?.last_sync_status === "error" && (
        <p className="text-xs text-destructive">Última sincronização falhou: {connection.last_sync_error}</p>
      )}
      {connection?.last_synced_at && (
        <p className="text-[10px] text-muted-foreground/70">
          Última sincronização: {new Date(connection.last_synced_at).toLocaleString("pt-BR")}
        </p>
      )}
    </motion.div>
  );
}

function KPI({ label, value, sublabel, accent }: { label: string; value: string; sublabel?: string; accent?: "success" | "destructive" | "neutral" }) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/40 backdrop-blur-sm p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</p>
      <p
        className={cn(
          "text-lg font-semibold tabular-nums mt-1",
          accent === "success" && "text-success",
          accent === "destructive" && "text-destructive",
        )}
      >
        {value}
      </p>
      {sublabel && <p className="text-[10px] text-muted-foreground/70 mt-0.5">{sublabel}</p>}
    </div>
  );
}

function SortableTh({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <th className="text-right px-3 py-2 font-medium cursor-pointer select-none" onClick={onClick}>
      <span className={cn("inline-flex items-center gap-1", active && "text-primary")}>
        {label} <ArrowUpDown className="w-3 h-3" />
      </span>
    </th>
  );
}
