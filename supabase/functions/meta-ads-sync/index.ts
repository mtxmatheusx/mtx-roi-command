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
  url += `&action_attribution_windows=["7d_click","1d_view"]`;
  url += `&time_zone=America/Sao_Paulo`;

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
  const actions = (row?.actions as Array<{ action_type: string; value: string }>) || [];
  const actionValues = (row?.action_values as Array<{ action_type: string; value: string }>) || [];
  const costPerAction = (row?.cost_per_action_type as Array<{ action_type: string; value: string }>) || [];
  const purchaseRoasArr = (row?.purchase_roas as Array<{ action_type: string; value: string }>) || [];

  const getAction = (type: string) =>
    Number(actions.find((a) => a?.action_type === type)?.value || 0);
  const getActionValue = (type: string) =>
    Number(actionValues.find((a) => a?.action_type === type)?.value || 0);

  const spend = Number(row?.spend || 0);
  const purchases = getAction("purchase");
  const purchaseValue = getActionValue("purchase");
  const addToCart = getAction("add_to_cart");
  const initiateCheckout = getAction("initiate_checkout");
  const pageView = getAction("landing_page_view");

  let cpa = purchases > 0 ? spend / purchases : 0;
  let roas = spend > 0 ? purchaseValue / spend : 0;

  const metaCpaRaw = costPerAction.find((a) => a?.action_type === "purchase");
  const metaRoasRaw = purchaseRoasArr.find((a) => a?.action_type === "omni_purchase") || purchaseRoasArr[0];
  const metaCpa = metaCpaRaw ? Number(metaCpaRaw.value) : null;
  const metaRoas = metaRoasRaw ? Number(metaRoasRaw.value) : null;

  let verified = true;

  if (metaCpa !== null && metaCpa > 0 && cpa > 0) {
    const cpaDivergence = Math.abs(cpa - metaCpa) / metaCpa;
    if (cpaDivergence > 0.01) {
      cpa = metaCpa;
      verified = false;
    }
  }

  if (metaRoas !== null && metaRoas > 0 && roas > 0) {
    const roasDivergence = Math.abs(roas - metaRoas) / metaRoas;
    if (roasDivergence > 0.01) {
      roas = metaRoas;
      verified = false;
    }
  }

  const profit = purchaseValue - spend;
  const conversionRate = initiateCheckout > 0 ? (purchases / initiateCheckout) * 100 : 0;

  return {
    campaignName: row?.campaign_name || undefined,
    campaignId: row?.campaign_id || undefined,
    effectiveStatus: row?.effective_status || undefined,
    date_start: row?.date_start || undefined,
    spend,
    cpm: Number(row?.cpm || 0),
    ctr: Number(row?.ctr || 0),
    cpc: Number(row?.cpc || 0),
    impressions: Number(row?.impressions || 0),
    clicks: Number(row?.clicks || 0),
    pageView,
    addToCart,
    initiateCheckout,
    purchases,
    purchaseValue,
    cpa,
    roas,
    profit,
    conversionRate,
    verified,
  };
}

function shiftDateRange(since: string, until: string): { prevSince: string; prevUntil: string } {
  const s = new Date(since + "T00:00:00Z");
  const u = new Date(until + "T00:00:00Z");
  const diffMs = u.getTime() - s.getTime();
  const prevUntil = new Date(s.getTime() - 86400000);
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
    const { adAccountId, datePreset, since, until, testConnection } = await req.json();

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

    // Lightweight test mode
    if (testConnection) {
      const testUrl = `https://graph.facebook.com/v21.0/${adAccountId}/campaigns?fields=id,name&limit=1&access_token=${accessToken}`;
      const testRes = await fetch(testUrl);
      const testData = await testRes.json();
      if (testData?.error) {
        const msg = testData.error.message || "";
        const isRateLimit = msg.includes("Application request limit reached");
        return new Response(
          JSON.stringify({ error: isRateLimit ? "Limite de requisições da Meta atingido. Aguarde alguns minutos." : msg }),
          { status: isRateLimit ? 429 : 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ success: true, total: testData?.data?.length ?? 0, fetchedAt: new Date().toISOString() }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const fields = [
      "campaign_name", "campaign_id",
      "spend", "cpm", "ctr", "cpc",
      "actions", "action_values", "impressions", "clicks",
      "cost_per_action_type", "purchase_roas",
    ].join(",");

    const dailyFields = [
      "spend", "actions", "action_values", "impressions", "clicks", "cpm", "ctr",
      "cost_per_action_type", "purchase_roas",
    ].join(",");

    const adFields = [
      "ad_name", "spend", "cpm", "ctr", "cpc",
      "actions", "action_values", "impressions", "clicks",
      "cost_per_action_type", "purchase_roas",
    ].join(",");

    const useDateRange = since && until;

    const campaignUrl = buildUrl(adAccountId, fields, accessToken, {
      since, until, datePreset: datePreset || "last_7d", level: "campaign",
    });

    const dailyUrl = useDateRange
      ? buildUrl(adAccountId, dailyFields, accessToken, { since, until, level: "account" })
      : null;

    const adUrl = buildUrl(adAccountId, adFields, accessToken, {
      since, until, datePreset: datePreset || "last_7d", level: "ad",
    });

    let prevUrl: string | null = null;
    let prevPeriod: { prevSince: string; prevUntil: string } | null = null;
    if (useDateRange) {
      prevPeriod = shiftDateRange(since, until);
      prevUrl = buildUrl(adAccountId, fields, accessToken, {
        since: prevPeriod.prevSince, until: prevPeriod.prevUntil, level: "campaign",
      });
    }

    const statusUrl = `https://graph.facebook.com/v21.0/${adAccountId}/campaigns?fields=id,name,effective_status&limit=100&access_token=${accessToken}`;

    const fetches: Promise<Response>[] = [fetch(campaignUrl), fetch(statusUrl)];
    if (dailyUrl) fetches.push(fetch(dailyUrl));
    if (prevUrl) fetches.push(fetch(prevUrl));
    fetches.push(fetch(adUrl));

    const responses = await Promise.all(fetches);
    const results = await Promise.all(responses.map((r) => r.json()));

    // Check ALL results for rate limit errors first
    for (const result of results) {
      if (result?.error) {
        const msg = typeof result.error === "string" ? result.error : result.error?.message || "";
        if (typeof msg === "string" && msg.includes("Application request limit reached")) {
          return new Response(
            JSON.stringify({ error: "Limite de requisições da Meta atingido. Aguarde alguns minutos e tente novamente.", type: "RateLimitError" }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    const campaignData = results[0];
    const statusData = results[1];

    // If primary campaign fetch failed with a non-rate-limit error, return it
    if (campaignData?.error) {
      return new Response(
        JSON.stringify({ error: campaignData.error?.message || campaignData.error, type: campaignData.error?.type }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build status map (null-safe — statusData might have failed)
    const statusMap: Record<string, string> = {};
    if (statusData?.data && Array.isArray(statusData.data)) {
      for (const c of statusData.data) {
        if (c?.id) statusMap[c.id] = c.effective_status;
      }
    }

    // Merge effective_status (null-safe)
    const campaignRows = campaignData?.data && Array.isArray(campaignData.data) ? campaignData.data : [];
    const campaigns = campaignRows.map((r: Record<string, unknown>) => {
      const cid = r?.campaign_id as string;
      if (cid && statusMap[cid]) {
        r.effective_status = statusMap[cid];
      }
      return parseCampaignRow(r);
    });

    const dataVerified = campaigns.length > 0 && campaigns.every((c: { verified: boolean }) => c.verified);

    // Daily data (null-safe)
    let daily: unknown[] = [];
    const dailyIdx = dailyUrl ? 2 : -1;
    if (dailyIdx > 0 && results[dailyIdx]?.data && Array.isArray(results[dailyIdx].data)) {
      daily = results[dailyIdx].data.map((r: Record<string, unknown>) => parseCampaignRow(r));
    }

    // Previous period (null-safe)
    let previous: Record<string, number> | null = null;
    const prevIdx = dailyUrl ? 3 : 2;
    if (prevUrl && results[prevIdx]?.data && Array.isArray(results[prevIdx].data)) {
      const prevRows = results[prevIdx].data.map((r: Record<string, unknown>) => parseCampaignRow(r));
      const totalImpressions = prevRows.reduce((s: number, c: { impressions: number }) => s + (c?.impressions || 0), 0);
      const totalSpend = prevRows.reduce((s: number, c: { spend: number }) => s + (c?.spend || 0), 0);
      const totalClicks = prevRows.reduce((s: number, c: { clicks: number }) => s + (c?.clicks || 0), 0);
      previous = {
        spend: totalSpend,
        purchases: prevRows.reduce((s: number, c: { purchases: number }) => s + (c?.purchases || 0), 0),
        purchaseValue: prevRows.reduce((s: number, c: { purchaseValue: number }) => s + (c?.purchaseValue || 0), 0),
        impressions: totalImpressions,
        clicks: totalClicks,
        cpm: totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0,
        ctr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
      };
      previous.profit = previous.purchaseValue - previous.spend;
      previous.cpa = previous.purchases > 0 ? previous.spend / previous.purchases : 0;
      previous.roas = previous.spend > 0 ? previous.purchaseValue / previous.spend : 0;
    }

    // Creatives (null-safe)
    const adIdx = fetches.length - 1;
    let creatives: unknown[] = [];
    if (results[adIdx]?.data && Array.isArray(results[adIdx].data)) {
      creatives = results[adIdx].data.map((r: Record<string, unknown>) => {
        const parsed = parseCampaignRow(r);
        return {
          adName: r?.ad_name || "Sem nome",
          spend: parsed.spend,
          purchases: parsed.purchases,
          purchaseValue: parsed.purchaseValue,
          roas: parsed.roas,
          ctr: parsed.ctr,
          cpc: parsed.cpc,
          impressions: parsed.impressions,
          clicks: parsed.clicks,
        };
      });
    }

    return new Response(
      JSON.stringify({ campaigns, daily, previous, creatives, dataVerified, total: campaigns.length, fetchedAt: new Date().toISOString() }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
