import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

async function fetchMetrics(adAccountId: string, accessToken: string) {
  const [acctRes, campRes] = await Promise.all([
    fetch(
      `https://graph.facebook.com/v23.0/${adAccountId}/insights?date_preset=yesterday&fields=spend,actions,action_values,purchase_roas,impressions,clicks,cpm,ctr&level=account&time_increment=all_days`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    ),
    fetch(
      `https://graph.facebook.com/v23.0/${adAccountId}/insights?date_preset=yesterday&fields=campaign_name,campaign_id,spend,actions,action_values,purchase_roas,impressions,clicks,ctr,cpc&level=campaign&limit=50`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    ),
  ]);

  let spend = 0, cpa = 0, roas = 0, purchases = 0, revenue = 0;
  let impressions = 0, clicks = 0, ctr = 0, cpm = 0;

  if (acctRes.ok) {
    const json = await acctRes.json();
    const row = json.data?.[0];
    if (row) {
      spend = parseFloat(row.spend || "0");
      const actions = row.actions || [];
      const actionValues = row.action_values || [];
      purchases = Number(actions.find((a: any) => a.action_type === "purchase")?.value || 0);
      revenue = Number(actionValues.find((a: any) => a.action_type === "purchase")?.value || 0);
      const purchaseRoas = row.purchase_roas || [];
      roas = Number(purchaseRoas.find((a: any) => a.action_type === "purchase")?.value || 0);
      cpa = purchases > 0 ? spend / purchases : 0;
      impressions = Number(row.impressions || 0);
      clicks = Number(row.clicks || 0);
      ctr = parseFloat(row.ctr || "0");
      cpm = parseFloat(row.cpm || "0");
    }
  }

  let campaigns: any[] = [];
  if (campRes.ok) {
    const campJson = await campRes.json();
    campaigns = (campJson.data || []).map((c: any) => {
      const cSpend = parseFloat(c.spend || "0");
      const cActions = c.actions || [];
      const cActionValues = c.action_values || [];
      const cPurchases = Number(cActions.find((a: any) => a.action_type === "purchase")?.value || 0);
      const cRevenue = Number(cActionValues.find((a: any) => a.action_type === "purchase")?.value || 0);
      return {
        id: c.campaign_id || "",
        name: c.campaign_name || "Sem nome",
        status: "active",
        spend: cSpend,
        revenue: cRevenue,
        purchases: cPurchases,
        roas: cSpend > 0 ? cRevenue / cSpend : 0,
        cpa: cPurchases > 0 ? cSpend / cPurchases : 0,
        clicks: Number(c.clicks || 0),
        impressions: Number(c.impressions || 0),
        ctr: parseFloat(c.ctr || "0"),
        cpc: parseFloat(c.cpc || "0"),
      };
    }).filter((c: any) => c.spend > 0);
  }

  const profit = revenue - spend;

  return {
    spend: Math.round(spend * 100) / 100,
    revenue: Math.round(revenue * 100) / 100,
    roas: Math.round(roas * 100) / 100,
    cpa: Math.round(cpa * 100) / 100,
    profit: Math.round(profit * 100) / 100,
    purchases,
    impressions,
    clicks,
    ctr: Math.round(ctr * 100) / 100,
    cpm: Math.round(cpm * 100) / 100,
    campaigns,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const fallbackToken = Deno.env.get("META_ACCESS_TOKEN") || "";

    const sb = createClient(supabaseUrl, serviceKey);

    // Fetch all active profiles
    const { data: profiles, error: profileErr } = await sb
      .from("client_profiles")
      .select("id, name, ad_account_id, meta_access_token, cpa_meta, ticket_medio")
      .neq("ad_account_id", "act_");

    if (profileErr) throw profileErr;
    if (!profiles || profiles.length === 0) {
      return new Response(
        JSON.stringify({ message: "Nenhum perfil ativo encontrado." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const snapshotDate = yesterday.toISOString().slice(0, 10);

    const results: { profile: string; status: string; error?: string }[] = [];

    for (const profile of profiles) {
      const token = profile.meta_access_token || fallbackToken;
      if (!token) {
        results.push({ profile: profile.name, status: "skipped", error: "Sem token" });
        continue;
      }

      try {
        const metrics = await fetchMetrics(profile.ad_account_id, token);

        const snapshotData = {
          ...metrics,
          profile_name: profile.name,
          cpa_meta: profile.cpa_meta,
          ticket_medio: profile.ticket_medio,
        };

        const { error: upsertErr } = await sb
          .from("report_snapshots")
          .upsert(
            {
              profile_id: profile.id,
              snapshot_date: snapshotDate,
              data: snapshotData,
            },
            { onConflict: "profile_id,snapshot_date" }
          );

        if (upsertErr) {
          results.push({ profile: profile.name, status: "error", error: upsertErr.message });
        } else {
          results.push({ profile: profile.name, status: "ok" });
        }
      } catch (e) {
        results.push({ profile: profile.name, status: "error", error: (e as Error).message });
      }
    }

    return new Response(
      JSON.stringify({ date: snapshotDate, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("daily-report-sync error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
