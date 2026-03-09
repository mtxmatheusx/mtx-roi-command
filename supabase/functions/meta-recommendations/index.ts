import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const META_API = "https://graph.facebook.com/v21.0";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { profileId } = await req.json();
    if (!profileId) {
      return new Response(JSON.stringify({ error: "profileId é obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile, error: profileError } = await supabase
      .from("client_profiles")
      .select("*")
      .eq("id", profileId)
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: "Perfil não encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accessToken = profile.meta_access_token || Deno.env.get("META_ACCESS_TOKEN");
    if (!accessToken) {
      return new Response(JSON.stringify({ error: "Token Meta não configurado" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adAccountId = profile.ad_account_id;
    if (!adAccountId || adAccountId === "act_") {
      return new Response(JSON.stringify({ error: "Ad Account ID não configurado" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch recommendations and campaign insights in parallel
    const today = new Date().toISOString().slice(0, 10);
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

    const [recRes, insightsRes] = await Promise.all([
      fetch(`${META_API}/${adAccountId}/recommendations?fields=title,message,importance,recommendation_type,code&access_token=${accessToken}`),
      fetch(`${META_API}/${adAccountId}/insights?fields=spend,impressions,clicks,ctr,cpm,actions,action_values,cost_per_action_type&time_range={"since":"${sevenDaysAgo}","until":"${today}"}&access_token=${accessToken}`),
    ]);
    const [recData, insightsData] = await Promise.all([recRes.json(), insightsRes.json()]);

    if (recData.error) {
      return new Response(JSON.stringify({ error: recData.error.message || "Erro ao buscar recomendações", meta_error: recData.error }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse account-level insights for audit context
    const ins = insightsData?.data?.[0] || {};
    const accountMetrics = {
      spend: parseFloat(ins.spend || "0"),
      impressions: parseInt(ins.impressions || "0", 10),
      clicks: parseInt(ins.clicks || "0", 10),
      ctr: parseFloat(ins.ctr || "0"),
      cpm: parseFloat(ins.cpm || "0"),
      purchases: (ins.actions || []).filter((a: any) => a.action_type === "purchase" || a.action_type === "omni_purchase").reduce((s: number, a: any) => s + parseInt(a.value || "0", 10), 0),
      revenue: (ins.action_values || []).filter((a: any) => a.action_type === "purchase" || a.action_type === "omni_purchase").reduce((s: number, a: any) => s + parseFloat(a.value || "0"), 0),
    };
    const roas = accountMetrics.spend > 0 ? accountMetrics.revenue / accountMetrics.spend : 0;
    const cpa = accountMetrics.purchases > 0 ? accountMetrics.spend / accountMetrics.purchases : 0;

    return new Response(JSON.stringify({
      recommendations: recData.data || [],
      profile_summary: {
        name: profile.name,
        cpa_meta: profile.cpa_meta,
        budget_maximo: profile.budget_maximo,
        budget_frequency: profile.budget_frequency,
        ticket_medio: profile.ticket_medio,
      },
      account_metrics: {
        ...accountMetrics,
        roas: parseFloat(roas.toFixed(2)),
        cpa: parseFloat(cpa.toFixed(2)),
        period: `${sevenDaysAgo} → ${today}`,
      },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("meta-recommendations error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
