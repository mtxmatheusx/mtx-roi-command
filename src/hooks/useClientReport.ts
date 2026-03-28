import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Campaign } from "@/lib/mockData";
import type { DailyDataPoint } from "@/hooks/useMetaAds";

interface SnapshotData {
  spend: number;
  revenue: number;
  roas: number;
  cpa: number;
  profit: number;
  purchases: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpm: number;
  profile_name: string;
  cpa_meta: number;
  ticket_medio: number;
  campaigns: Array<{
    id: string;
    name: string;
    status: string;
    spend: number;
    revenue: number;
    purchases: number;
    roas: number;
    cpa: number;
    clicks: number;
    impressions: number;
    ctr: number;
    cpc: number;
  }>;
}

export function useClientReport() {
  const { user } = useAuth();

  // Check if user has client_access
  const { data: access, isLoading: accessLoading } = useQuery({
    queryKey: ["client_access", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("client_access")
        .select("profile_id, role, email")
        .eq("user_id", user.id)
        .limit(1)
        .single();
      if (error) return null;
      return data as { profile_id: string; role: string; email: string };
    },
    enabled: !!user?.id,
  });

  const isClient = !!access;
  const profileId = access?.profile_id;

  // Fetch last 7 snapshots for this profile
  const { data: snapshots, isLoading: snapshotsLoading } = useQuery({
    queryKey: ["report_snapshots", profileId],
    queryFn: async () => {
      if (!profileId) return [];
      const { data, error } = await supabase
        .from("report_snapshots")
        .select("snapshot_date, data")
        .eq("profile_id", profileId)
        .order("snapshot_date", { ascending: false })
        .limit(7);
      if (error) throw error;
      return (data || []) as Array<{ snapshot_date: string; data: SnapshotData }>;
    },
    enabled: !!profileId,
  });

  const latest = snapshots?.[0]?.data || null;

  // Map snapshot campaigns to Campaign interface
  const campaigns: Campaign[] = (latest?.campaigns || []).map((c, i) => ({
    id: c.id || String(i + 1),
    name: c.name,
    status: (c.status as Campaign["status"]) || "active",
    spend: c.spend,
    revenue: c.revenue,
    cpm: 0,
    ctr: c.ctr,
    cpc: c.cpc || 0,
    clicks: c.clicks,
    pageViews: 0,
    costPerPageView: 0,
    addToCart: 0,
    costPerATC: 0,
    initiateCheckout: 0,
    costPerIC: 0,
    purchases: c.purchases,
    costPerPurchase: c.cpa,
    conversionRate: c.clicks > 0 ? (c.purchases / c.clicks) * 100 : 0,
    roi: c.roas,
    profit: c.revenue - c.spend,
    cpaMeta: latest?.cpa_meta || 0,
    ticketMedio: latest?.ticket_medio || 0,
  }));

  // Build daily data from snapshots (reversed to chronological)
  const daily: DailyDataPoint[] = (snapshots || [])
    .slice()
    .reverse()
    .map((s) => ({
      date: s.snapshot_date,
      spend: s.data.spend,
      purchases: s.data.purchases,
      purchaseValue: s.data.revenue,
      cpa: s.data.cpa,
      roas: s.data.roas,
      profit: s.data.profit,
    }));

  return {
    isClient,
    isLoading: accessLoading || snapshotsLoading,
    profileName: latest?.profile_name || null,
    latestDate: snapshots?.[0]?.snapshot_date || null,
    totalSpend: latest?.spend || 0,
    totalRevenue: latest?.revenue || 0,
    roas: latest?.roas || 0,
    avgCPA: latest?.cpa || 0,
    totalProfit: latest?.profit || 0,
    totalPurchases: latest?.purchases || 0,
    totalImpressions: latest?.impressions || 0,
    totalClicks: latest?.clicks || 0,
    avgCTR: latest?.ctr || 0,
    avgCPM: latest?.cpm || 0,
    cpaMeta: latest?.cpa_meta || 0,
    daily,
    campaigns,
  };
}
