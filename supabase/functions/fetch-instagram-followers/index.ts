import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Strategy 1: Direct Instagram web scraper (no API key needed)
async function fetchDirectInstagram(username: string): Promise<any> {
  try {
    // Instagram public API endpoint
    const res = await fetch(`https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "X-IG-App-ID": "936619743392459",
        "X-Requested-With": "XMLHttpRequest",
      },
    });
    
    if (!res.ok) {
      console.log(`[Direct] web_profile_info → ${res.status}`);
      return null;
    }
    
    const json = await res.json();
    const user = json?.data?.user;
    if (!user) return null;
    
    return {
      username: user.username,
      full_name: user.full_name,
      follower_count: user.edge_followed_by?.count || 0,
      following_count: user.edge_follow?.count || 0,
      media_count: user.edge_owner_to_timeline_media?.count || 0,
      profile_pic_url: user.profile_pic_url_hd || user.profile_pic_url || "",
      biography: user.biography || "",
      is_private: user.is_private,
      // Get engagement from recent posts
      recent_posts: (user.edge_owner_to_timeline_media?.edges || []).slice(0, 25),
    };
  } catch (e) {
    console.log(`[Direct] Error: ${e.message}`);
    return null;
  }
}

// Strategy 2: RapidAPI - tries multiple popular APIs
async function fetchViaRapidApi(username: string, rapidApiKey: string): Promise<any> {
  const apis = [
    // Instagram Scraper Stable API - various endpoint patterns
    {
      host: "instagram-scraper-stable-api.p.rapidapi.com",
      endpoints: [
        { path: "/get_ig_user_data.php", method: "POST", contentType: "application/x-www-form-urlencoded", body: `username_or_url=${encodeURIComponent(username)}` },
        { path: "/account_data", method: "POST", contentType: "application/json", body: JSON.stringify({ username_or_url: username }) },
      ]
    },
    // Instagram Scraper API (by davethebeast)  
    {
      host: "instagram-scraper-api2.p.rapidapi.com",
      endpoints: [
        { path: `/v1/info?username_or_url=${encodeURIComponent(username)}`, method: "GET" },
        { path: `/v1.2/info?username_or_url=${encodeURIComponent(username)}`, method: "GET" },
      ]
    },
    // Real-Time Instagram Scraper
    {
      host: "real-time-instagram-scraper-api1.p.rapidapi.com",
      endpoints: [
        { path: `/v1/user_info?username_or_url=${encodeURIComponent(username)}`, method: "GET" },
      ]
    },
    // Instagram Scraper (by JoTucker)
    {
      host: "instagram-scraper2.p.rapidapi.com",
      endpoints: [
        { path: `/user_info?username_or_url=${encodeURIComponent(username)}`, method: "GET" },
      ]
    },
  ];

  for (const api of apis) {
    for (const ep of api.endpoints) {
      try {
        const headers: Record<string, string> = {
          "X-RapidAPI-Key": rapidApiKey,
          "X-RapidAPI-Host": api.host,
        };
        if (ep.contentType) headers["Content-Type"] = ep.contentType;
        
        const opts: RequestInit = { method: ep.method, headers };
        if (ep.body) opts.body = ep.body;
        
        const res = await fetch(`https://${api.host}${ep.path}`, opts);
        console.log(`[RapidAPI] ${ep.method} ${api.host}${ep.path.split("?")[0]} → ${res.status}`);
        
        if (res.status === 403) {
          console.log(`[RapidAPI] ⚠️ Not subscribed to ${api.host}`);
          continue;
        }
        
        if (!res.ok) continue;
        
        const raw = await res.json();
        const d = raw?.data || raw;
        
        if (d?.follower_count !== undefined || d?.followers_count !== undefined || d?.edge_followed_by || d?.pk) {
          console.log(`[RapidAPI] ✅ Working: ${api.host}${ep.path.split("?")[0]}`);
          return d;
        }
      } catch (e) {
        console.log(`[RapidAPI] Error ${api.host}: ${e.message}`);
      }
    }
  }
  
  return null;
}

// Strategy 3: Meta Graph API
async function fetchViaMeta(igAccountId: string, accessToken: string) {
  for (const version of ["v21.0", "v20.0", "v19.0"]) {
    try {
      const res = await fetch(
        `https://graph.facebook.com/${version}/${igAccountId}?fields=followers_count,follows_count,media_count,username,profile_picture_url,name&access_token=${accessToken}`
      );
      const data = await res.json();
      if (!data.error && (data.followers_count !== undefined || data.username)) return data;
      if (data.error?.code === 36106) continue;
      if (data.error) return data;
    } catch { continue; }
  }
  return null;
}

function calcEngagement(posts: any[], followers: number): { likes: number; comments: number; posts: number; rate: number } {
  if (!posts?.length || !followers) return { likes: 0, comments: 0, posts: 0, rate: 0 };
  let totalLikes = 0, totalComments = 0;
  for (const p of posts) {
    const node = p.node || p;
    totalLikes += node.like_count || node.edge_media_preview_like?.count || node.likes?.count || 0;
    totalComments += node.comment_count || node.edge_media_to_comment?.count || node.comments?.count || 0;
  }
  const rate = ((totalLikes + totalComments) / posts.length / followers) * 100;
  return { likes: totalLikes, comments: totalComments, posts: posts.length, rate };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { profile_id } = await req.json();
    if (!profile_id) {
      return new Response(JSON.stringify({ error: "profile_id is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const rapidApiKey = Deno.env.get("RAPIDAPI_KEY");

    const { data: profile, error: profileError } = await supabase
      .from("client_profiles")
      .select("page_id, meta_access_token, name, user_id, instagram_account_id, instagram_username")
      .eq("id", profile_id)
      .single();

    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: "Profile not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accessToken = profile.meta_access_token || Deno.env.get("META_ACCESS_TOKEN");
    const igUsername = profile.instagram_username;
    const igAccountId = profile.instagram_account_id;

    let followers = 0, following = 0, mediaCount = 0;
    let username = igUsername || "";
    let profilePicUrl = "";
    let likes = 0, comments = 0, engPosts = 0, engRate = 0;
    let source = "none";

    // === Strategy 1: Direct Instagram scraper (free, no key) ===
    if (igUsername) {
      console.log(`[1/3] Direct scraper for @${igUsername}`);
      const direct = await fetchDirectInstagram(igUsername);
      if (direct && direct.follower_count > 0) {
        followers = direct.follower_count;
        following = direct.following_count;
        mediaCount = direct.media_count;
        username = direct.username || igUsername;
        profilePicUrl = direct.profile_pic_url;
        source = "direct";
        
        const eng = calcEngagement(direct.recent_posts, followers);
        likes = eng.likes; comments = eng.comments; engPosts = eng.posts; engRate = eng.rate;
        console.log(`[Direct] ✅ ${followers} followers, ${engPosts} posts, eng=${engRate.toFixed(2)}%`);
      }
    }

    // === Strategy 2: RapidAPI (multiple providers) ===
    if (source === "none" && rapidApiKey && igUsername) {
      console.log(`[2/3] RapidAPI for @${igUsername}`);
      const rapidData = await fetchViaRapidApi(igUsername, rapidApiKey);
      if (rapidData) {
        followers = rapidData.follower_count ?? rapidData.followers_count ?? rapidData.edge_followed_by?.count ?? 0;
        following = rapidData.following_count ?? rapidData.follows_count ?? rapidData.edge_follow?.count ?? 0;
        mediaCount = rapidData.media_count ?? rapidData.edge_owner_to_timeline_media?.count ?? 0;
        username = rapidData.username || igUsername;
        profilePicUrl = rapidData.hd_profile_pic_url_info?.url || rapidData.profile_pic_url_hd || rapidData.profile_pic_url || "";
        source = "rapidapi";
        
        const posts = rapidData.recent_posts || rapidData.edge_owner_to_timeline_media?.edges || [];
        const eng = calcEngagement(posts, followers);
        likes = eng.likes; comments = eng.comments; engPosts = eng.posts; engRate = eng.rate;
      }
    }

    // === Strategy 3: Meta Graph API ===
    if (source === "none" && igAccountId && accessToken) {
      console.log(`[3/3] Meta API for ${igAccountId}`);
      const metaData = await fetchViaMeta(igAccountId, accessToken);
      if (metaData && !metaData.error) {
        followers = metaData.followers_count || 0;
        following = metaData.follows_count || 0;
        mediaCount = metaData.media_count || 0;
        username = metaData.username || metaData.name || "";
        profilePicUrl = metaData.profile_picture_url || "";
        source = "meta";
        
        // Fetch engagement from Meta
        try {
          const eRes = await fetch(
            `https://graph.facebook.com/v19.0/${igAccountId}/media?fields=like_count,comments_count&limit=25&access_token=${accessToken}`
          );
          const eData = await eRes.json();
          if (eData?.data) {
            for (const p of eData.data) { likes += p.like_count || 0; comments += p.comments_count || 0; }
            engPosts = eData.data.length;
            engRate = followers > 0 && engPosts > 0 ? ((likes + comments) / engPosts / followers) * 100 : 0;
          }
        } catch {}
      }
    }

    if (source === "none") {
      return new Response(JSON.stringify({
        error: "Não foi possível buscar dados. Verifique se o username está correto e se o perfil é público."
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const today = new Date().toISOString().split("T")[0];
    const roundedRate = Math.round(engRate * 100) / 100;

    await supabase.from("follower_snapshots").upsert({
      profile_id, user_id: profile.user_id,
      followers_count: followers, following_count: following, media_count: mediaCount,
      likes_count: likes, comments_count: comments,
      engagement_rate: roundedRate,
      snapshot_date: today,
    }, { onConflict: "profile_id,snapshot_date" });

    return new Response(JSON.stringify({
      success: true, source,
      data: {
        username, profile_picture_url: profilePicUrl,
        followers_count: followers, following_count: following, media_count: mediaCount,
        likes_count: likes, comments_count: comments,
        engagement_rate: roundedRate, snapshot_date: today,
      },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
