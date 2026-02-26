import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { adAccountId, datePreset = "last_7d" } = await req.json();

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
      "campaign_name",
      "spend",
      "cpm",
      "ctr",
      "cpc",
      "actions",
      "action_values",
      "impressions",
      "clicks",
    ].join(",");

    const url = `https://graph.facebook.com/v21.0/${adAccountId}/insights?fields=${fields}&date_preset=${datePreset}&level=campaign&limit=50&access_token=${accessToken}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
      return new Response(
        JSON.stringify({ error: data.error.message, type: data.error.type }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const campaigns = (data.data || []).map((row: Record<string, unknown>) => {
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
        campaignName: row.campaign_name,
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
    });

    return new Response(
      JSON.stringify({ campaigns, total: campaigns.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
