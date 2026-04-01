import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { profileId, summary } = await req.json();
    if (!profileId) throw new Error("profileId is required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);

    // Fetch profile
    const { data: profile, error: profileError } = await sb
      .from("client_profiles")
      .select("user_id, name, ad_account_id, meta_access_token")
      .eq("id", profileId)
      .single();

    if (profileError || !profile) throw new Error("Perfil não encontrado");

    const accessToken = profile.meta_access_token || Deno.env.get("META_ACCESS_TOKEN");
    let metrics: any = {};

    // Try to fetch last 24h metrics from Meta API
    if (accessToken && profile.ad_account_id && profile.ad_account_id !== "act_") {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const url = `https://graph.facebook.com/v23.0/${profile.ad_account_id}/insights?fields=spend,impressions,clicks,actions,action_values,ctr,cpm,cpc&date_preset=today&access_token=${accessToken}`;
        const resp = await fetch(url);
        const data = await resp.json();
        const ins = data.data?.[0];
        if (ins) {
          const purchases = (ins.actions || [])
            .filter((a: any) => a.action_type === "purchase" || a.action_type === "omni_purchase")
            .reduce((s: number, a: any) => s + parseInt(a.value || "0", 10), 0);
          const revenue = (ins.action_values || [])
            .filter((a: any) => a.action_type === "purchase" || a.action_type === "omni_purchase")
            .reduce((s: number, a: any) => s + parseFloat(a.value || "0"), 0);
          const spend = parseFloat(ins.spend || "0");
          metrics = {
            spend,
            impressions: parseInt(ins.impressions || "0", 10),
            clicks: parseInt(ins.clicks || "0", 10),
            purchases,
            revenue,
            roas: spend > 0 ? revenue / spend : 0,
            cpa: purchases > 0 ? spend / purchases : 0,
            ctr: parseFloat(ins.ctr || "0"),
            cpm: parseFloat(ins.cpm || "0"),
            cpc: parseFloat(ins.cpc || "0"),
            date: today,
          };
        }
      } catch (e) {
        console.error("Failed to fetch Meta metrics for report:", e);
      }
    }

    // Also fetch latest follower snapshot
    const { data: followerSnap } = await sb
      .from("follower_snapshots")
      .select("followers_count, engagement_rate, likes_count, comments_count")
      .eq("profile_id", profileId)
      .order("snapshot_date", { ascending: false })
      .limit(1)
      .single();

    if (followerSnap) {
      metrics.followers = followerSnap.followers_count;
      metrics.engagement_rate = followerSnap.engagement_rate;
      metrics.likes = followerSnap.likes_count;
      metrics.comments = followerSnap.comments_count;
    }

    // Insert report snapshot
    const { data: snapshot, error: insertError } = await sb
      .from("report_snapshots")
      .insert({
        profile_id: profileId,
        user_id: profile.user_id,
        metrics,
        summary: summary || "Relatório gerado automaticamente pelo MTX Agent.",
      })
      .select("token")
      .single();

    if (insertError) throw insertError;

    const appUrl = Deno.env.get("APP_URL") || "https://mtx-roi-command.lovable.app";
    const reportUrl = `${appUrl}/relatorio?token=${snapshot.token}`;

    return new Response(
      JSON.stringify({ reportUrl, token: snapshot.token }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-client-report error:", e);
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
