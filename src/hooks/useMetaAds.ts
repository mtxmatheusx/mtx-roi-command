import { useState, useCallback, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Campaign, mockCampaigns } from "@/lib/mockData";

export interface DateRange {
  since: string; // YYYY-MM-DD
  until: string;
}

interface MetaAdsCampaign {
  campaignName: string;
  campaignId?: string;
  effectiveStatus?: string;
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
  verified?: boolean;
}

export interface MetaCreative {
  adName: string;
  spend: number;
  purchases: number;
  purchaseValue: number;
  roas: number;
  ctr: number;
  cpc: number;
  impressions: number;
  clicks: number;
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
  cpm: number;
  ctr: number;
  impressions: number;
  clicks: number;
}

function mapToCampaign(c: MetaAdsCampaign, index: number, cpaMeta: number, ticketMedio: number): Campaign {
  const costPerPV = c.pageView > 0 ? c.spend / c.pageView : 0;
  const costPerATC = c.addToCart > 0 ? c.spend / c.addToCart : 0;
  const costPerIC = c.initiateCheckout > 0 ? c.spend / c.initiateCheckout : 0;

  let status: Campaign["status"] = "active";
  if (c.effectiveStatus) {
    status = c.effectiveStatus === "ACTIVE" ? "active" : "paused";
  } else {
    if (c.spend > 2 * cpaMeta && c.purchases === 0) status = "paused";
    else if (c.roas > 3 && c.purchases > 5) status = "scaling";
  }

  return {
    id: c.campaignId || String(index + 1),
    name: c.campaignName,
    status,
    effectiveStatus: c.effectiveStatus,
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
      spend, purchases, purchaseValue,
      cpa: spend / purchases,
      roas: purchaseValue / spend,
      profit: purchaseValue - spend,
    });
  }
  return days;
}

const mockPrevious: PreviousPeriod = {
  spend: 14000, purchases: 60, purchaseValue: 43000,
  profit: 29000, cpa: 233, roas: 3.07,
  cpm: 32.5, ctr: 1.8, impressions: 430000, clicks: 7740,
};

function isShortRange(dateRange?: DateRange): boolean {
  if (!dateRange) return false;
  const s = new Date(dateRange.since);
  const u = new Date(dateRange.until);
  const diffDays = (u.getTime() - s.getTime()) / 86400000;
  return diffDays <= 1;
}

export function useMetaAds(dateRange?: DateRange, profileConfig?: { adAccountId?: string; cpaMeta?: number; ticketMedio?: number }) {
  const adAccountId = profileConfig?.adAccountId;
  const cpaMeta = profileConfig?.cpaMeta || 200;
  const ticketMedio = profileConfig?.ticketMedio || 697;
  const [forceKey, setForceKey] = useState(0);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [dataVerified, setDataVerified] = useState(false);
  const [isRateLimited, setIsRateLimited] = useState(false);

  const shortRange = isShortRange(dateRange);

  const query = useQuery({
    queryKey: ["meta-ads", adAccountId, dateRange?.since, dateRange?.until, forceKey],
    queryFn: async (): Promise<{
      campaigns: Campaign[];
      daily: DailyDataPoint[];
      previous: PreviousPeriod | null;
      creatives: MetaCreative[];
      fetchedAt: string | null;
      dataVerified: boolean;
    }> => {
      if (!adAccountId || adAccountId === "act_") {
        return { campaigns: mockCampaigns, daily: generateMockDaily(), previous: mockPrevious, creatives: [], fetchedAt: null, dataVerified: false };
      }

      const body: Record<string, string> = { adAccountId };
      if (dateRange?.since && dateRange?.until) {
        body.since = dateRange.since;
        body.until = dateRange.until;
      } else {
        body.datePreset = "last_7d";
      }

      const { data, error } = await supabase.functions.invoke("meta-ads-sync", { body });

      // Check for rate limit or permission errors — return mock data instead of crashing
      const errorMsg = data?.error || (error as Error)?.message || "";
      const isRateOrPermission = typeof errorMsg === "string" && (
        errorMsg.includes("Limite de requisições") ||
        errorMsg.includes("Application request limit reached") ||
        errorMsg.includes("rate limit") ||
        errorMsg.includes("permission")
      );
      if (isRateOrPermission) {
        setIsRateLimited(true);
        return { campaigns: mockCampaigns, daily: generateMockDaily(), previous: mockPrevious, creatives: [], fetchedAt: null, dataVerified: false };
      }
      setIsRateLimited(false);

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const campaigns = (data?.campaigns || []).length
        ? data.campaigns.map((c: MetaAdsCampaign, i: number) => mapToCampaign(c, i, cpaMeta, ticketMedio))
        : mockCampaigns;

      const daily: DailyDataPoint[] = (data?.daily || []).map((d: MetaAdsCampaign) => ({
        date: d.date_start || "",
        spend: d.spend, purchases: d.purchases, purchaseValue: d.purchaseValue,
        cpa: d.cpa, roas: d.roas, profit: d.profit,
      }));

      const creatives: MetaCreative[] = (data?.creatives || []);

      return {
        campaigns,
        daily: daily.length ? daily : generateMockDaily(),
        previous: data?.previous || null,
        creatives,
        fetchedAt: data?.fetchedAt || null,
        dataVerified: data?.dataVerified ?? false,
      };
    },
    staleTime: shortRange ? 0 : 5 * 60 * 1000,
    retry: (failureCount, error) => {
      const msg = (error as Error)?.message || "";
      if (msg.includes("rate limit") || msg.includes("Limite") || msg.includes("permission")) return false;
      return failureCount < 1;
    },
  });

  useEffect(() => {
    if (query.data?.fetchedAt) setFetchedAt(query.data.fetchedAt);
    if (query.data?.dataVerified !== undefined) setDataVerified(query.data.dataVerified);
  }, [query.data?.fetchedAt, query.data?.dataVerified]);

  const result = query.data ?? { campaigns: mockCampaigns, daily: generateMockDaily(), previous: mockPrevious, creatives: [] as MetaCreative[], fetchedAt: null, dataVerified: false };
  const isUsingMock = !adAccountId || adAccountId === "act_" || !!query.error;

  const forceRefetch = useCallback(() => {
    setForceKey((k) => k + 1);
  }, []);

  return {
    campaigns: result.campaigns,
    daily: result.daily,
    previous: result.previous,
    creatives: result.creatives,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    isUsingMock,
    refetch: query.refetch,
    forceRefetch,
    fetchedAt,
    dataVerified,
  };
}
