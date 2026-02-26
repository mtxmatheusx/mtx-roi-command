import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function buildUrl(adAccountId: string, fields: string, accessToken: string, opts: {
  since?: string; until?: string; datePreset?: string; level?: string;
}) {
  const base = `https://graph.facebook.com/v21.0/${adAccountId}/insights?fields=${fields}&limit=50&access_token=${accessToken}`;
  const level = opts.level || "campaign";
  let url = `${base}&level=${level}`;

  if (opts.since && opts.until) {
    url += `&time_range={"since":"${opts.since}","until":"${opts.until}"}`;
    if (level === "account") {
      url += `&time_increment=1`;
    }
  } else {
    url += `&date_preset=${opts.datePreset || "last_7d"}`;
  }
  return url;
}

function parseCampaignRow(row: Record<string, unknown>) {
  const actions = (row.actions as Array<{ action_type: string; value: string }>) || [];
  const actionValues = (row.action_values as Array<{ action_type: string; value: string }>) || [];

  const getAction = (type: string) =>
    Number(actions.find((a) => a.action_type === type)?.value || 0);
  const getActionValue = (type: string) =>
    Number(actionValues.find((a) => a.action_type === type)?.value || 0);

  const spend = Number(row.spend || 0);
  const purchases = getAction("purchase");
  const purchaseValue = getActionValue("purchase");
  const addToCart = getAction("add_to_cart");
  const initiateCheckout = getAction("initiate_checkout");
  const pageView = getAction("landing_page_view");

  const cpa = purchases > 0 ? spend / purchases : 0;
  const roas = spend > 0 ? purchaseValue / spend : 0;
  const profit = purchaseValue - spend;
  const conversionRate = initiateCheckout > 0 ? (purchases / initiateCheckout) * 100 : 0;

  return {
    campaignName: row.campaign_name || undefined,
    date_start: row.date_start || undefined,
    spend,
    cpm: Number(row.cpm || 0),
    ctr: Number(row.ctr || 0),
    cpc: Number(row.cpc || 0),
    impressions: Number(row.impressions || 0),
    clicks: Number(row.clicks || 0),
    pageView,
    addToCart,
    initiateCheckout,
    purchases,
    purchaseValue,
    cpa,
    roas,
    profit,
    conversionRate,
  };
}

function shiftDateRange(since: string, until: string): { prevSince: string; prevUntil: string } {
  const s = new Date(since + "T00:00:00Z");
  const u = new Date(until + "T00:00:00Z");
  const diffMs = u.getTime() - s.getTime();
  const prevUntil = new Date(s.getTime() - 86400000); // day before since
  const prevSince = new Date(prevUntil.getTime() - diffMs);
  return {
    prevSince: prevSince.toISOString().slice(0, 10),
    prevUntil: prevUntil.toISOString().slice(0, 10),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { adAccountId, datePreset, since, until } = await req.json();

    if (!adAccountId) {
      return new Response(
        JSON.stringify({ error: "adAccountId é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accessToken = Deno.env.get("META_ACCESS_TOKEN");
    if (!accessToken) {
      return new Response(
        JSON.stringify({ error: "META_ACCESS_TOKEN não configurado" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const fields = [
      "campaign_name", "spend", "cpm", "ctr", "cpc",
      "actions", "action_values", "impressions", "clicks",
    ].join(",");

    const dailyFields = [
      "spend", "actions", "action_values", "impressions", "clicks", "cpm",
    ].join(",");

    const useDateRange = since && until;

    // 1) Campaign-level data
    const campaignUrl = buildUrl(adAccountId, fields, accessToken, {
      since, until, datePreset: datePreset || "last_7d", level: "campaign",
    });

    // 2) Daily breakdown for charts (account level, time_increment=1)
    const dailyUrl = useDateRange
      ? buildUrl(adAccountId, dailyFields, accessToken, { since, until, level: "account" })
      : null;

    // 3) Previous period for deltas
    let prevUrl: string | null = null;
    let prevPeriod: { prevSince: string; prevUntil: string } | null = null;
    if (useDateRange) {
      prevPeriod = shiftDateRange(since, until);
      prevUrl = buildUrl(adAccountId, fields, accessToken, {
        since: prevPeriod.prevSince, until: prevPeriod.prevUntil, level: "campaign",
      });
    }

    // Fetch in parallel
    const fetches: Promise<Response>[] = [fetch(campaignUrl)];
    if (dailyUrl) fetches.push(fetch(dailyUrl));
    if (prevUrl) fetches.push(fetch(prevUrl));

    const responses = await Promise.all(fetches);
    const results = await Promise.all(responses.map((r) => r.json()));

    const campaignData = results[0];
    if (campaignData.error) {
      return new Response(
        JSON.stringify({ error: campaignData.error.message, type: campaignData.error.type }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const campaigns = (campaignData.data || []).map((r: Record<string, unknown>) => parseCampaignRow(r));

    // Daily data for charts
    let daily: unknown[] = [];
    if (dailyUrl && results[1]?.data) {
      daily = results[1].data.map((r: Record<string, unknown>) => parseCampaignRow(r));
    }

    // Previous period totals
    let previous: Record<string, number> | null = null;
    const prevIdx = dailyUrl ? 2 : 1;
    if (prevUrl && results[prevIdx]?.data) {
      const prevRows = results[prevIdx].data.map((r: Record<string, unknown>) => parseCampaignRow(r));
      previous = {
        spend: prevRows.reduce((s: number, c: { spend: number }) => s + c.spend, 0),
        purchases: prevRows.reduce((s: number, c: { purchases: number }) => s + c.purchases, 0),
        purchaseValue: prevRows.reduce((s: number, c: { purchaseValue: number }) => s + c.purchaseValue, 0),
      };
      previous.profit = previous.purchaseValue - previous.spend;
      previous.cpa = previous.purchases > 0 ? previous.spend / previous.purchases : 0;
      previous.roas = previous.spend > 0 ? previous.purchaseValue / previous.spend : 0;
    }

    return new Response(
      JSON.stringify({ campaigns, daily, previous, total: campaigns.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
