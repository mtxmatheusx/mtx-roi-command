import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: profiles, error: profilesError } = await supabase
      .from("client_profiles")
      .select("id, instagram_account_id, page_id, meta_access_token, user_id, name")
      .or("instagram_account_id.neq.,page_id.neq.");

    if (profilesError) {
      console.error("Error fetching profiles:", profilesError);
      return new Response(JSON.stringify({ error: profilesError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const globalToken = Deno.env.get("META_ACCESS_TOKEN");
    const results: { profile_id: string; name: string; status: string; error?: string }[] = [];

    for (const profile of (profiles || [])) {
      const accessToken = profile.meta_access_token || globalToken;
      if (!accessToken) {
        results.push({ profile_id: profile.id, name: profile.name, status: "skipped", error: "No access token" });
        continue;
      }

      let igAccountId = profile.instagram_account_id;

      // Try to discover from page_id if not set
      if (!igAccountId && profile.page_id) {
        for (const version of ["v19.0", "v18.0", "v17.0"]) {
          try {
            const res = await fetch(
              `https://graph.facebook.com/${version}/${profile.page_id}?fields=instagram_business_account&access_token=${accessToken}`
            );
            const data = await res.json();
            if (data?.instagram_business_account?.id) {
              igAccountId = data.instagram_business_account.id;
              await supabase
                .from("client_profiles")
                .update({ instagram_account_id: igAccountId })
                .eq("id", profile.id);
              break;
            }
          } catch { continue; }
        }
      }

      if (!igAccountId) {
        results.push({ profile_id: profile.id, name: profile.name, status: "skipped", error: "No IG account ID" });
        continue;
      }

      // Fetch IG data
      let igData: any = null;
      for (const version of ["v21.0", "v20.0", "v19.0", "v18.0"]) {
        try {
          const res = await fetch(
            `https://graph.facebook.com/${version}/${igAccountId}?fields=followers_count,follows_count,media_count,username&access_token=${accessToken}`
          );
          const data = await res.json();
          if (!data.error && (data.followers_count !== undefined || data.username)) {
            igData = data;
            break;
          }
          if (data.error?.code === 36106) continue;
          if (data.error) { igData = data; break; }
        } catch { continue; }
      }

      if (!igData || igData.error) {
        results.push({ profile_id: profile.id, name: profile.name, status: "error", error: igData?.error?.message || "API failed" });
        continue;
      }

      // Fetch engagement
      let likes = 0, comments = 0, posts = 0;
      try {
        const engRes = await fetch(
          `https://graph.facebook.com/v19.0/${igAccountId}/media?fields=like_count,comments_count&limit=25&access_token=${accessToken}`
        );
        const engData = await engRes.json();
        if (engData?.data && Array.isArray(engData.data)) {
          posts = engData.data.length;
          for (const p of engData.data) {
            likes += p.like_count || 0;
            comments += p.comments_count || 0;
          }
        }
      } catch { /* ignore */ }

      const followers = igData.followers_count || 0;
      const engagementRate = followers > 0 && posts > 0
        ? ((likes + comments) / posts / followers) * 100
        : 0;

      const today = new Date().toISOString().split("T")[0];

      // Check for follower drop vs yesterday
      const { data: prevSnapshot } = await supabase
        .from("follower_snapshots")
        .select("followers_count, snapshot_date")
        .eq("profile_id", profile.id)
        .lt("snapshot_date", today)
        .order("snapshot_date", { ascending: false })
        .limit(1)
        .single();

      const { error: upsertError } = await supabase
        .from("follower_snapshots")
        .upsert({
          profile_id: profile.id,
          user_id: profile.user_id,
          followers_count: followers,
          following_count: igData.follows_count || 0,
          media_count: igData.media_count || 0,
          likes_count: likes,
          comments_count: comments,
          engagement_rate: Math.round(engagementRate * 100) / 100,
          snapshot_date: today,
        }, { onConflict: "profile_id,snapshot_date" });

      if (upsertError) {
        results.push({ profile_id: profile.id, name: profile.name, status: "error", error: upsertError.message });
        continue;
      }

      // Detect -5% drop and create alert
      if (prevSnapshot && prevSnapshot.followers_count > 0) {
        const changePct = ((followers - prevSnapshot.followers_count) / prevSnapshot.followers_count) * 100;
        if (changePct <= -5) {
          console.log(`⚠️ DROP ALERT: ${profile.name} lost ${Math.abs(changePct).toFixed(1)}% followers (${prevSnapshot.followers_count} → ${followers})`);
          await supabase.from("follower_alerts").insert({
            profile_id: profile.id,
            user_id: profile.user_id,
            alert_type: "drop",
            previous_count: prevSnapshot.followers_count,
            current_count: followers,
            change_pct: Math.round(changePct * 100) / 100,
            snapshot_date: today,
          });
        }
      }

      results.push({ profile_id: profile.id, name: profile.name, status: "synced" });
    }

    console.log("Daily follower sync results:", JSON.stringify(results));

    return new Response(JSON.stringify({ success: true, synced: results.filter(r => r.status === "synced").length, total: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
