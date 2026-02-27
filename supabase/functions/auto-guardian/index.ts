import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);

    // Get all profiles with cpa_max_toleravel > 0
    const { data: profiles, error } = await sb
      .from("client_profiles")
      .select("*")
      .gt("cpa_max_toleravel", 0);

    if (error) throw error;
    if (!profiles || profiles.length === 0) {
      return new Response(JSON.stringify({ message: "No profiles with CPA guardian enabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: any[] = [];

    for (const profile of profiles) {
      const accessToken = profile.meta_access_token || Deno.env.get("META_ACCESS_TOKEN");
      if (!accessToken || !profile.ad_account_id || profile.ad_account_id === "act_") continue;

      try {
        // Fetch active campaigns with last 24h insights
        const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
        const today = new Date().toISOString().slice(0, 10);
        const url = `https://graph.facebook.com/v21.0/${profile.ad_account_id}/campaigns?fields=id,name,effective_status,insights.time_range({"since":"${yesterday}","until":"${today}"}){spend,actions}&effective_status=["ACTIVE"]&access_token=${accessToken}&limit=100`;

        const resp = await fetch(url);
        const data = await resp.json();
        if (data.error) { results.push({ profile: profile.name, error: data.error.message }); continue; }

        const threshold = profile.cpa_max_toleravel * 1.15;

        for (const campaign of (data.data || [])) {
          const insights = campaign.insights?.data?.[0];
          if (!insights) continue;

          const spend = parseFloat(insights.spend || "0");
          const purchases = (insights.actions || [])
            .filter((a: any) => a.action_type === "purchase" || a.action_type === "omni_purchase")
            .reduce((s: number, a: any) => s + parseInt(a.value || "0", 10), 0);

          if (spend <= 0) continue;
          const cpa = purchases > 0 ? spend / purchases : spend; // If 0 purchases, CPA = all spend

          if (cpa > threshold) {
            // Pause campaign
            const pauseResp = await fetch(`https://graph.facebook.com/v21.0/${campaign.id}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: "PAUSED", access_token: accessToken }),
            });
            const pauseData = await pauseResp.json();

            // Log
            await sb.from("emergency_logs").insert({
              profile_id: profile.id,
              user_id: profile.user_id,
              action_type: "guardian",
              details: {
                campaign_id: campaign.id,
                campaign_name: campaign.name,
                cpa_real: cpa,
                cpa_max: profile.cpa_max_toleravel,
                spend,
                purchases,
                paused: pauseData.success || false,
                timestamp: new Date().toISOString(),
              },
            });

            results.push({
              profile: profile.name,
              campaign: campaign.name,
              cpa,
              action: pauseData.success ? "PAUSED" : "FAILED",
            });
          }
        }
      } catch (e) {
        results.push({ profile: profile.name, error: (e as Error).message });
      }
    }

    return new Response(JSON.stringify({ results, checked_profiles: profiles.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
