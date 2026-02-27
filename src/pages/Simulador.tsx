import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import ActiveProfileHeader from "@/components/ActiveProfileHeader";
import ScaleSimulator from "@/components/ScaleSimulator";
import { useMetaAds, DateRange } from "@/hooks/useMetaAds";
import { useClientProfiles } from "@/hooks/useClientProfiles";
import { motion } from "framer-motion";
import { RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { subDays, format } from "date-fns";

const defaultRange: DateRange = {
  since: format(subDays(new Date(), 6), "yyyy-MM-dd"),
  until: format(new Date(), "yyyy-MM-dd"),
};

export default function SimuladorPage() {
  const { adAccountId, cpaMeta, ticketMedio, metaAccessToken } = useClientProfiles();
  const { campaigns, isLoading, forceRefetch, fetchedAt } = useMetaAds(defaultRange, { adAccountId, cpaMeta, ticketMedio, accessToken: metaAccessToken });

  // Derive real CPA and ticket from live data
  const totalSpend = campaigns.reduce((s, c) => s + c.spend, 0);
  const totalPurchases = campaigns.reduce((s, c) => s + c.purchases, 0);
  const totalRevenue = campaigns.reduce((s, c) => s + c.revenue, 0);
  const realCpa = totalPurchases > 0 ? totalSpend / totalPurchases : cpaMeta;
  const realTicket = totalPurchases > 0 ? totalRevenue / totalPurchases : ticketMedio;

  return (
    <AppLayout>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <motion.h1 initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-3xl font-bold tracking-tight">
            Simulador de Escala
          </motion.h1>
          <p className="text-muted-foreground mt-1">Projete resultados antes de investir</p>
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

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <ScaleSimulator initialCpa={Math.round(realCpa)} initialTicket={Math.round(realTicket)} />
      )}
    </AppLayout>
  );
}
