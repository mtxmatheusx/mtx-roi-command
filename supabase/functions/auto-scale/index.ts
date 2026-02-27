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

    // Get all profiles with roas_min_escala > 0
    const { data: profiles, error } = await sb
      .from("client_profiles")
      .select("*")
      .gt("roas_min_escala", 0);

    if (error) throw error;
    if (!profiles || profiles.length === 0) {
      return new Response(JSON.stringify({ message: "No profiles with auto-scale enabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: any[] = [];

    for (const profile of profiles) {
      const accessToken = profile.meta_access_token || Deno.env.get("META_ACCESS_TOKEN");
      if (!accessToken || !profile.ad_account_id || profile.ad_account_id === "act_") continue;

      try {
        // Fetch adsets with 48h insights
        const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
        const today = new Date().toISOString().slice(0, 10);
        const url = `https://graph.facebook.com/v21.0/${profile.ad_account_id}/adsets?fields=id,name,daily_budget,effective_status,insights.time_range({"since":"${twoDaysAgo}","until":"${today}"}){spend,actions,action_values,ctr,frequency}&effective_status=["ACTIVE"]&access_token=${accessToken}&limit=100`;

        const resp = await fetch(url);
        const data = await resp.json();
        if (data.error) { results.push({ profile: profile.name, error: data.error.message }); continue; }

        for (const adset of (data.data || [])) {
          const insights = adset.insights?.data?.[0];
          if (!insights) continue;

          const spend = parseFloat(insights.spend || "0");
          const purchases = (insights.actions || [])
            .filter((a: any) => a.action_type === "purchase" || a.action_type === "omni_purchase")
            .reduce((s: number, a: any) => s + parseInt(a.value || "0", 10), 0);
          const revenue = (insights.action_values || [])
            .filter((a: any) => a.action_type === "purchase" || a.action_type === "omni_purchase")
            .reduce((s: number, a: any) => s + parseFloat(a.value || "0"), 0);
          const ctr = parseFloat(insights.ctr || "0");
          const frequency = parseFloat(insights.frequency || "0");

          if (spend <= 0 || purchases < 3) continue;

          const roas = revenue / spend;

          // Check ROAS threshold
          if (roas < profile.roas_min_escala) continue;

          // Saturation check: if frequency > 2.5 AND CTR dropping, abort
          if (frequency > 2.5 && ctr < 1.0) {
            results.push({ profile: profile.name, adset: adset.name, action: "ABORTED_SATURATION", roas, frequency, ctr });
            continue;
          }

          // Calculate new budget (+20%)
          const currentBudget = parseInt(adset.daily_budget || "0", 10) / 100; // Meta returns in cents
          const newBudget = currentBudget * 1.20;
          const teto = profile.teto_diario_escala || 0;

          if (teto > 0 && newBudget > teto) {
            results.push({ profile: profile.name, adset: adset.name, action: "ABORTED_CEILING", newBudget, teto });
            continue;
          }

          // Scale budget
          const scaleResp = await fetch(`https://graph.facebook.com/v21.0/${adset.id}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              daily_budget: Math.round(newBudget * 100), // Meta expects cents
              access_token: accessToken,
            }),
          });
          const scaleData = await scaleResp.json();

          // Log
          await sb.from("emergency_logs").insert({
            profile_id: profile.id,
            user_id: profile.user_id,
            action_type: "auto_scale",
            details: {
              adset_id: adset.id,
              adset_name: adset.name,
              old_budget: currentBudget,
              new_budget: newBudget,
              roas,
              purchases,
              ctr,
              frequency,
              success: scaleData.success || false,
              timestamp: new Date().toISOString(),
            },
          });

          results.push({
            profile: profile.name,
            adset: adset.name,
            action: scaleData.success ? "SCALED" : "FAILED",
            oldBudget: currentBudget,
            newBudget,
            roas,
          });
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
