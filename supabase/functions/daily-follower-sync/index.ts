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

    const rapidApiKey = Deno.env.get("RAPIDAPI_KEY");

    const { data: profiles, error: profilesError } = await supabase
      .from("client_profiles")
      .select("id, instagram_account_id, instagram_username, page_id, meta_access_token, user_id, name")
      .or("instagram_account_id.neq.,page_id.neq.,instagram_username.neq.");

    if (profilesError) {
      return new Response(JSON.stringify({ error: profilesError.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const globalToken = Deno.env.get("META_ACCESS_TOKEN");
    const results: { profile_id: string; name: string; status: string; source?: string; error?: string }[] = [];

    for (const profile of (profiles || [])) {
      let followers = 0, following = 0, mediaCount = 0;
      let likes = 0, comments = 0, engPosts = 0;
      let source = "none";

      // Strategy 1: RapidAPI (POST /account_data)
      if (rapidApiKey && profile.instagram_username) {
        try {
          const res = await fetch(
            `https://instagram-scraper-stable-api.p.rapidapi.com/account_data`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-RapidAPI-Key": rapidApiKey,
                "X-RapidAPI-Host": "instagram-scraper-stable-api.p.rapidapi.com",
              },
              body: JSON.stringify({ username_or_url: profile.instagram_username }),
            }
          );
          const raw = await res.json();
          const data = raw.data || raw;
          if (res.ok && (data.follower_count !== undefined || data.followers_count !== undefined || data.edge_followed_by)) {
            followers = data.follower_count || data.followers_count || data.edge_followed_by?.count || 0;
            following = data.following_count || data.follows_count || data.edge_follow?.count || 0;
            mediaCount = data.media_count || data.edge_owner_to_timeline_media?.count || 0;
            source = "rapidapi";

            // Engagement from posts
            try {
              const pRes = await fetch(
                `https://instagram-scraper-stable-api.p.rapidapi.com/basic_user_posts?username_or_url=${encodeURIComponent(profile.instagram_username)}`,
                { headers: { "X-RapidAPI-Key": rapidApiKey, "X-RapidAPI-Host": "instagram-scraper-stable-api.p.rapidapi.com" } }
              );
              const pRaw = await pRes.json();
              const items = Array.isArray(pRaw) ? pRaw : (pRaw?.items || pRaw?.data || []);
              engPosts = Math.min(items.length, 25);
              for (const p of items.slice(0, 25)) {
                likes += p.like_count || p.likes?.count || 0;
                comments += p.comment_count || p.comments?.count || 0;
              }
            } catch {}
          }
        } catch (e) {
          console.error(`RapidAPI error for ${profile.name}:`, e.message);
        }
      }

      // Strategy 2: Meta Graph API fallback
      if (source === "none") {
        const accessToken = profile.meta_access_token || globalToken;
        const igId = profile.instagram_account_id;
        if (accessToken && igId) {
          for (const v of ["v21.0", "v20.0", "v19.0", "v18.0"]) {
            try {
              const res = await fetch(
                `https://graph.facebook.com/${v}/${igId}?fields=followers_count,follows_count,media_count,username&access_token=${accessToken}`
              );
              const data = await res.json();
              if (!data.error && (data.followers_count !== undefined || data.username)) {
                followers = data.followers_count || 0;
                following = data.follows_count || 0;
                mediaCount = data.media_count || 0;
                source = "meta";

                // Meta engagement
                try {
                  const eRes = await fetch(
                    `https://graph.facebook.com/v19.0/${igId}/media?fields=like_count,comments_count&limit=25&access_token=${accessToken}`
                  );
                  const eData = await eRes.json();
                  if (eData?.data) {
                    engPosts = eData.data.length;
                    for (const p of eData.data) {
                      likes += p.like_count || 0;
                      comments += p.comments_count || 0;
                    }
                  }
                } catch {}
                break;
              }
              if (data.error?.code === 36106) continue;
              if (data.error) break;
            } catch { continue; }
          }
        }
      }

      if (source === "none") {
        results.push({ profile_id: profile.id, name: profile.name, status: "skipped", error: "No data source available" });
        continue;
      }

      const engagementRate = followers > 0 && engPosts > 0
        ? ((likes + comments) / engPosts / followers) * 100
        : 0;

      const today = new Date().toISOString().split("T")[0];

      // Check for drop
      const { data: prevSnap } = await supabase
        .from("follower_snapshots")
        .select("followers_count")
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
          following_count: following,
          media_count: mediaCount,
          likes_count: likes,
          comments_count: comments,
          engagement_rate: Math.round(engagementRate * 100) / 100,
          snapshot_date: today,
        }, { onConflict: "profile_id,snapshot_date" });

      if (upsertError) {
        results.push({ profile_id: profile.id, name: profile.name, status: "error", error: upsertError.message });
        continue;
      }

      // Detect -5% drop
      if (prevSnap && prevSnap.followers_count > 0) {
        const changePct = ((followers - prevSnap.followers_count) / prevSnap.followers_count) * 100;
        if (changePct <= -5) {
          console.log(`⚠️ DROP: ${profile.name} ${changePct.toFixed(1)}% (${prevSnap.followers_count} → ${followers})`);
          await supabase.from("follower_alerts").insert({
            profile_id: profile.id,
            user_id: profile.user_id,
            alert_type: "drop",
            previous_count: prevSnap.followers_count,
            current_count: followers,
            change_pct: Math.round(changePct * 100) / 100,
            snapshot_date: today,
          });
        }
      }

      results.push({ profile_id: profile.id, name: profile.name, status: "synced", source });
    }

    console.log("Daily sync results:", JSON.stringify(results));
    return new Response(JSON.stringify({
      success: true,
      synced: results.filter(r => r.status === "synced").length,
      total: results.length,
      results,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
