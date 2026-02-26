import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { mockCreatives, Creative, formatCurrency } from "@/lib/mockData";
import { useMetaAds, DateRange, MetaCreative } from "@/hooks/useMetaAds";
import { useClientProfiles } from "@/hooks/useClientProfiles";
import { motion } from "framer-motion";
import { subDays, format } from "date-fns";
import { Star, Video, Image, LayoutGrid, Loader2, AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

const typeIcon = { video: Video, image: Image, carousel: LayoutGrid };
const statusConfig = {
  winner: { label: "Winner", className: "bg-neon-green/15 text-neon-green" },
  testing: { label: "Testando", className: "bg-neon-yellow/15 text-neon-yellow" },
  saturated: { label: "Saturado", className: "bg-neon-red/15 text-neon-red" },
};

const defaultRange: DateRange = {
  since: format(subDays(new Date(), 6), "yyyy-MM-dd"),
  until: format(new Date(), "yyyy-MM-dd"),
};

function getCreativeStatus(roas: number, spend: number): Creative["status"] {
  if (roas >= 3 && spend > 100) return "winner";
  if (roas < 1 && spend > 50) return "saturated";
  return "testing";
}

export default function CriativosPage() {
  const { adAccountId, cpaMeta, ticketMedio } = useClientProfiles();
  const { creatives, isLoading, isUsingMock, forceRefetch, fetchedAt } = useMetaAds(defaultRange, { adAccountId, cpaMeta, ticketMedio });

  const displayCreatives: Array<{
    id: string; name: string; type: "video" | "image" | "carousel";
    status: Creative["status"]; spend: number; roas: number; ctr: number;
    purchases: number; purchaseValue: number;
  }> = creatives.length > 0
    ? creatives.map((c, i) => ({
        id: String(i + 1), name: c.adName, type: "video" as const,
        status: getCreativeStatus(c.roas, c.spend), spend: c.spend, roas: c.roas,
        ctr: c.ctr, purchases: c.purchases, purchaseValue: c.purchaseValue,
      }))
    : mockCreatives.map((c) => ({
        id: c.id, name: c.name, type: c.type, status: c.status,
        spend: 0, roas: 0, ctr: c.ctr, purchases: c.conversions, purchaseValue: 0,
      }));

  const [winners, setWinners] = useState<Set<string>>(new Set());
  const toggleWinner = (id: string) => {
    setWinners((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };

  return (
    <AppLayout>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <motion.h1 initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-3xl font-bold tracking-tight">
            Criativos
          </motion.h1>
          <p className="text-muted-foreground mt-1">
            {isUsingMock ? "Dados de demonstração" : "Performance real por anúncio"} · Analise e identifique os melhores performers
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

      {isUsingMock && (
        <div className="mb-4 flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm text-amber-400">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          Exibindo dados de demonstração. Configure o Ad Account ID em <strong className="mx-1">Configurações</strong>.
        </div>
      )}

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Sincronizando criativos...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayCreatives.map((creative, i) => {
            const isWinner = winners.has(creative.id) || creative.status === "winner";
            const sConfig = statusConfig[creative.status];
            const Icon = typeIcon[creative.type] || Video;
            return (
              <motion.div key={creative.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className={`bg-card rounded-xl border overflow-hidden ${isWinner ? "border-glow-green glow-green" : "border-border"}`}>
                <div className="h-40 bg-secondary flex items-center justify-center">
                  <Icon className="w-12 h-12 text-muted-foreground/30" />
                </div>
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="min-w-0 flex-1 mr-2"><h3 className="font-semibold text-sm truncate">{creative.name}</h3></div>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium whitespace-nowrap ${sConfig.className}`}>{sConfig.label}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mb-4 text-center">
                    <div>
                      <p className="text-xs text-muted-foreground">ROAS</p>
                      <p className={`text-lg font-bold ${creative.roas > 3 ? "text-neon-green" : creative.roas > 1 ? "text-neon-yellow" : "text-neon-red"}`}>{creative.roas.toFixed(2)}x</p>
                    </div>
                    <div><p className="text-xs text-muted-foreground">CTR</p><p className="text-lg font-bold">{creative.ctr.toFixed(1)}%</p></div>
                    <div><p className="text-xs text-muted-foreground">Compras</p><p className="text-lg font-bold">{creative.purchases}</p></div>
                  </div>
                  {creative.spend > 0 && (
                    <p className="text-xs text-muted-foreground mb-3">Invest: {formatCurrency(creative.spend)} · Receita: {formatCurrency(creative.purchaseValue)}</p>
                  )}
                  <button onClick={() => toggleWinner(creative.id)}
                    className={`w-full py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                      isWinner ? "bg-accent/20 text-neon-green border border-glow-green" : "bg-secondary text-muted-foreground hover:text-foreground"}`}>
                    <Star className={`w-4 h-4 ${isWinner ? "fill-current" : ""}`} />
                    {isWinner ? "Winner" : "Marcar Winner"}
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </AppLayout>
  );
}
