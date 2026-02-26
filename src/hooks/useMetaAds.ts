import { useState, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Campaign, mockCampaigns } from "@/lib/mockData";

export interface DateRange {
  since: string; // YYYY-MM-DD
  until: string;
}

interface MetaAdsCampaign {
  campaignName: string;
  date_start?: string;
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

export interface DailyDataPoint {
  date: string;
  spend: number;
  purchases: number;
  purchaseValue: number;
  cpa: number;
  roas: number;
  profit: number;
}

export interface PreviousPeriod {
  spend: number;
  purchases: number;
  purchaseValue: number;
  profit: number;
  cpa: number;
  roas: number;
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

// Generate mock daily data for demo mode
function generateMockDaily(): DailyDataPoint[] {
  const days: DailyDataPoint[] = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const spend = 1500 + Math.random() * 1500;
    const purchases = Math.floor(5 + Math.random() * 10);
    const purchaseValue = purchases * (600 + Math.random() * 200);
    days.push({
      date: d.toISOString().slice(0, 10),
      spend,
      purchases,
      purchaseValue,
      cpa: spend / purchases,
      roas: purchaseValue / spend,
      profit: purchaseValue - spend,
    });
  }
  return days;
}

const mockPrevious: PreviousPeriod = {
  spend: 14000,
  purchases: 60,
  purchaseValue: 43000,
  profit: 29000,
  cpa: 233,
  roas: 3.07,
};

export function useMetaAds(dateRange?: DateRange) {
  const config = getConfig();
  const adAccountId = config?.adAccountId;
  const cpaMeta = config?.cpaMeta || 200;
  const ticketMedio = config?.ticketMedio || 697;
  const [forceKey, setForceKey] = useState(0);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["meta-ads", adAccountId, dateRange?.since, dateRange?.until, forceKey],
    queryFn: async (): Promise<{
      campaigns: Campaign[];
      daily: DailyDataPoint[];
      previous: PreviousPeriod | null;
      fetchedAt: string | null;
    }> => {
      if (!adAccountId || adAccountId === "act_") {
        return { campaigns: mockCampaigns, daily: generateMockDaily(), previous: mockPrevious, fetchedAt: null };
      }

      const body: Record<string, string> = { adAccountId };
      if (dateRange?.since && dateRange?.until) {
        body.since = dateRange.since;
        body.until = dateRange.until;
      } else {
        body.datePreset = "last_7d";
      }

      const { data, error } = await supabase.functions.invoke("meta-ads-sync", { body });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const campaigns = (data?.campaigns || []).length
        ? data.campaigns.map((c: MetaAdsCampaign, i: number) => mapToCampaign(c, i, cpaMeta, ticketMedio))
        : mockCampaigns;

      const daily: DailyDataPoint[] = (data?.daily || []).map((d: MetaAdsCampaign) => ({
        date: d.date_start || "",
        spend: d.spend,
        purchases: d.purchases,
        purchaseValue: d.purchaseValue,
        cpa: d.cpa,
        roas: d.roas,
        profit: d.profit,
      }));

      return {
        campaigns,
        daily: daily.length ? daily : generateMockDaily(),
        previous: data?.previous || null,
        fetchedAt: data?.fetchedAt || null,
      };
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  useEffect(() => {
    if (query.data?.fetchedAt) {
      setFetchedAt(query.data.fetchedAt);
    }
  }, [query.data?.fetchedAt]);

  const result = query.data ?? { campaigns: mockCampaigns, daily: generateMockDaily(), previous: mockPrevious, fetchedAt: null };
  const isUsingMock = !adAccountId || adAccountId === "act_" || !!query.error;

  const forceRefetch = useCallback(() => {
    setForceKey((k) => k + 1);
  }, []);

  return {
    campaigns: result.campaigns,
    daily: result.daily,
    previous: result.previous,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    isUsingMock,
    refetch: query.refetch,
    forceRefetch,
    fetchedAt,
  };
}
