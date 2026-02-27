import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { profileId } = await req.json();
    if (!profileId) throw new Error("profileId is required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);

    // Get profile
    const { data: profile, error: pErr } = await sb
      .from("client_profiles")
      .select("*")
      .eq("id", profileId)
      .single();
    if (pErr || !profile) throw new Error("Profile not found");

    const accessToken = profile.meta_access_token || Deno.env.get("META_ACCESS_TOKEN");
    if (!accessToken) throw new Error("No Meta access token configured");

    const actId = profile.ad_account_id;
    if (!actId || actId === "act_") throw new Error("No valid ad account ID");

    // Fetch active campaigns
    const listUrl = `https://graph.facebook.com/v21.0/${actId}/campaigns?fields=id,name&effective_status=["ACTIVE"]&access_token=${accessToken}&limit=500`;
    const listResp = await fetch(listUrl);
    const listData = await listResp.json();

    if (listData.error) throw new Error(listData.error.message || "Meta API error");

    const activeCampaigns = listData.data || [];
    if (activeCampaigns.length === 0) {
      return new Response(JSON.stringify({ paused_count: 0, message: "No active campaigns found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Pause all campaigns
    let pausedCount = 0;
    const errors: string[] = [];

    for (const campaign of activeCampaigns) {
      try {
        const pauseResp = await fetch(
          `https://graph.facebook.com/v21.0/${campaign.id}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "PAUSED", access_token: accessToken }),
          }
        );
        const pauseData = await pauseResp.json();
        if (pauseData.success) {
          pausedCount++;
        } else {
          errors.push(`${campaign.name}: ${pauseData.error?.message || "Unknown error"}`);
        }
      } catch (e) {
        errors.push(`${campaign.name}: ${(e as Error).message}`);
      }
    }

    // Log emergency action
    await sb.from("emergency_logs").insert({
      profile_id: profileId,
      user_id: profile.user_id,
      action_type: "kill_switch",
      details: {
        paused_count: pausedCount,
        total_active: activeCampaigns.length,
        campaign_names: activeCampaigns.map((c: any) => c.name),
        errors,
        timestamp: new Date().toISOString(),
      },
    });

    return new Response(
      JSON.stringify({ paused_count: pausedCount, total: activeCampaigns.length, errors }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
