import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// RapidAPI Instagram Scraper - fetch profile data by username
async function fetchViaRapidApi(username: string, rapidApiKey: string) {
  const url = `https://instagram-scraper-stable-api.p.rapidapi.com/user_data?username=${encodeURIComponent(username)}`;
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "X-RapidAPI-Key": rapidApiKey,
        "X-RapidAPI-Host": "instagram-scraper-stable-api.p.rapidapi.com",
      },
    });
    const data = await res.json();
    console.log("RapidAPI response status:", res.status);
    if (!res.ok) {
      return { error: `RapidAPI error ${res.status}: ${JSON.stringify(data)}` };
    }
    return data;
  } catch (e) {
    console.error("RapidAPI fetch error:", e);
    return { error: e.message };
  }
}

// Fallback: Meta Graph API
async function fetchViaMeta(igAccountId: string, accessToken: string) {
  for (const version of ["v21.0", "v20.0", "v19.0", "v18.0"]) {
    try {
      const res = await fetch(
        `https://graph.facebook.com/${version}/${igAccountId}?fields=followers_count,follows_count,media_count,username,profile_picture_url,name&access_token=${accessToken}`
      );
      const data = await res.json();
      if (!data.error && (data.followers_count !== undefined || data.username)) {
        return data;
      }
      if (data.error?.code === 36106) continue;
      if (data.error) return data;
    } catch { continue; }
  }
  return null;
}

// Fetch engagement from recent posts via RapidAPI
async function fetchEngagementRapidApi(username: string, rapidApiKey: string) {
  try {
    const url = `https://instagram-scraper-stable-api.p.rapidapi.com/user_posts?username=${encodeURIComponent(username)}&amount=25`;
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "X-RapidAPI-Key": rapidApiKey,
        "X-RapidAPI-Host": "instagram-scraper-stable-api.p.rapidapi.com",
      },
    });
    const data = await res.json();
    if (!res.ok || !data?.items) return { likes: 0, comments: 0, posts: 0 };
    
    let totalLikes = 0, totalComments = 0;
    const items = Array.isArray(data.items) ? data.items : [];
    for (const post of items) {
      totalLikes += post.like_count || post.likes?.count || 0;
      totalComments += post.comment_count || post.comments?.count || 0;
    }
    return { likes: totalLikes, comments: totalComments, posts: items.length };
  } catch {
    return { likes: 0, comments: 0, posts: 0 };
  }
}

// Fetch engagement from Meta API
async function fetchEngagementMeta(igAccountId: string, accessToken: string) {
  try {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${igAccountId}/media?fields=like_count,comments_count&limit=25&access_token=${accessToken}`
    );
    const data = await res.json();
    if (data?.data && Array.isArray(data.data)) {
      let likes = 0, comments = 0;
      for (const p of data.data) {
        likes += p.like_count || 0;
        comments += p.comments_count || 0;
      }
      return { likes, comments, posts: data.data.length };
    }
  } catch {}
  return { likes: 0, comments: 0, posts: 0 };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { profile_id } = await req.json();
    if (!profile_id) {
      return new Response(JSON.stringify({ error: "profile_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const rapidApiKey = Deno.env.get("RAPIDAPI_KEY");

    const { data: profile, error: profileError } = await supabase
      .from("client_profiles")
      .select("page_id, meta_access_token, name, user_id, instagram_account_id, instagram_username")
      .eq("id", profile_id)
      .single();

    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: "Profile not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accessToken = profile.meta_access_token || Deno.env.get("META_ACCESS_TOKEN");
    const igUsername = profile.instagram_username;
    const igAccountId = profile.instagram_account_id;

    let followers = 0, following = 0, mediaCount = 0;
    let username = igUsername || "";
    let profilePicUrl = "";
    let likes = 0, comments = 0, engPosts = 0;
    let source = "none";

    // Strategy 1: RapidAPI (preferred - no need for Meta Business Account)
    if (rapidApiKey && igUsername) {
      console.log(`[RapidAPI] Fetching data for @${igUsername}`);
      const rapidData = await fetchViaRapidApi(igUsername, rapidApiKey);
      
      if (!rapidData.error && (rapidData.follower_count !== undefined || rapidData.followers_count !== undefined || rapidData.edge_followed_by)) {
        followers = rapidData.follower_count || rapidData.followers_count || rapidData.edge_followed_by?.count || 0;
        following = rapidData.following_count || rapidData.follows_count || rapidData.edge_follow?.count || 0;
        mediaCount = rapidData.media_count || rapidData.edge_owner_to_timeline_media?.count || 0;
        username = rapidData.username || igUsername;
        profilePicUrl = rapidData.profile_pic_url_hd || rapidData.profile_pic_url || rapidData.profile_picture_url || "";
        source = "rapidapi";

        // Fetch engagement
        const eng = await fetchEngagementRapidApi(igUsername, rapidApiKey);
        likes = eng.likes;
        comments = eng.comments;
        engPosts = eng.posts;
      } else {
        console.log("[RapidAPI] Failed:", rapidData.error || "No data returned");
      }
    }

    // Strategy 2: Meta Graph API (fallback)
    if (source === "none" && igAccountId && accessToken) {
      console.log(`[Meta API] Fetching data for IG account: ${igAccountId}`);
      const metaData = await fetchViaMeta(igAccountId, accessToken);
      
      if (metaData && !metaData.error) {
        followers = metaData.followers_count || 0;
        following = metaData.follows_count || 0;
        mediaCount = metaData.media_count || 0;
        username = metaData.username || metaData.name || "";
        profilePicUrl = metaData.profile_picture_url || "";
        source = "meta";

        const eng = await fetchEngagementMeta(igAccountId, accessToken);
        likes = eng.likes;
        comments = eng.comments;
        engPosts = eng.posts;
      } else {
        console.log("[Meta API] Failed:", metaData?.error?.message || "No data");
      }
    }

    if (source === "none") {
      return new Response(JSON.stringify({
        error: "Não foi possível buscar dados do Instagram. Configure o 'Instagram Username' nas Configurações do perfil e adicione sua RAPIDAPI_KEY, ou configure o Instagram Account ID para usar a Meta API."
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const engagementRate = followers > 0 && engPosts > 0
      ? ((likes + comments) / engPosts / followers) * 100
      : 0;

    const today = new Date().toISOString().split("T")[0];
    const { error: upsertError } = await supabase
      .from("follower_snapshots")
      .upsert({
        profile_id,
        user_id: profile.user_id,
        followers_count: followers,
        following_count: following,
        media_count: mediaCount,
        likes_count: likes,
        comments_count: comments,
        engagement_rate: Math.round(engagementRate * 100) / 100,
        snapshot_date: today,
      }, { onConflict: "profile_id,snapshot_date" });

    if (upsertError) console.error("Upsert error:", upsertError);

    return new Response(JSON.stringify({
      success: true,
      source,
      data: {
        username,
        profile_picture_url: profilePicUrl,
        followers_count: followers,
        following_count: following,
        media_count: mediaCount,
        likes_count: likes,
        comments_count: comments,
        engagement_rate: Math.round(engagementRate * 100) / 100,
        snapshot_date: today,
      },
    }), {
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
