import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Campaign, mockCampaigns } from "@/lib/mockData";

interface MetaAdsCampaign {
  campaignName: string;
  spend: number;
  cpm: number;
  ctr: number;
  cpc: number;
  impressions: number;
  clicks: number;
  pageView: number;
  addToCart: number;
  initiateCheckout: number;
  purchases: number;
  purchaseValue: number;
  cpa: number;
  roas: number;
  profit: number;
  conversionRate: number;
}

function getConfig() {
  try {
    const raw = localStorage.getItem("mtx_config");
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

function mapToCampaign(c: MetaAdsCampaign, index: number, cpaMeta: number, ticketMedio: number): Campaign {
  const costPerPV = c.pageView > 0 ? c.spend / c.pageView : 0;
  const costPerATC = c.addToCart > 0 ? c.spend / c.addToCart : 0;
  const costPerIC = c.initiateCheckout > 0 ? c.spend / c.initiateCheckout : 0;

  let status: Campaign["status"] = "active";
  if (c.spend > 2 * cpaMeta && c.purchases === 0) status = "paused";
  else if (c.roas > 3 && c.purchases > 5) status = "scaling";

  return {
    id: String(index + 1),
    name: c.campaignName,
    status,
    spend: c.spend,
    revenue: c.purchaseValue,
    cpm: c.cpm,
    ctr: c.ctr,
    cpc: c.cpc,
    clicks: c.clicks,
    pageViews: c.pageView,
    costPerPageView: costPerPV,
    addToCart: c.addToCart,
    costPerATC,
    initiateCheckout: c.initiateCheckout,
    costPerIC,
    purchases: c.purchases,
    costPerPurchase: c.cpa,
    conversionRate: c.conversionRate,
    roi: c.roas,
    profit: c.profit,
    cpaMeta,
    ticketMedio,
  };
}

export function useMetaAds() {
  const config = getConfig();
  const adAccountId = config?.adAccountId;
  const cpaMeta = config?.cpaMeta || 200;
  const ticketMedio = config?.ticketMedio || 697;

  const query = useQuery({
    queryKey: ["meta-ads", adAccountId],
    queryFn: async (): Promise<Campaign[]> => {
      if (!adAccountId || adAccountId === "act_") {
        return mockCampaigns;
      }

      const { data, error } = await supabase.functions.invoke("meta-ads-sync", {
        body: { adAccountId, datePreset: "last_7d" },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (!data?.campaigns?.length) {
        return mockCampaigns;
      }

      return data.campaigns.map((c: MetaAdsCampaign, i: number) =>
        mapToCampaign(c, i, cpaMeta, ticketMedio)
      );
    },
    staleTime: 5 * 60 * 1000, // 5 min cache
    retry: 1,
  });

  const isUsingMock = !adAccountId || adAccountId === "act_" || !!query.error;

  return {
    campaigns: query.data ?? mockCampaigns,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    isUsingMock,
    refetch: query.refetch,
  };
}
