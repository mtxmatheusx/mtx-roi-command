import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RAPID_HOST = "instagram-scraper-stable-api.p.rapidapi.com";

async function tryEndpoint(url: string, method: string, headers: Record<string, string>, body?: string): Promise<{ ok: boolean; status: number; data: any }> {
  try {
    const opts: RequestInit = { method, headers };
    if (body) opts.body = body;
    const res = await fetch(url, opts);
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text; }
    return { ok: res.ok, status: res.status, data };
  } catch (e) {
    return { ok: false, status: 0, data: e.message };
  }
}

async function fetchViaRapidApi(username: string, rapidApiKey: string) {
  const headers = {
    "X-RapidAPI-Key": rapidApiKey,
    "X-RapidAPI-Host": RAPID_HOST,
    "Content-Type": "application/x-www-form-urlencoded",
  };
  const jsonHeaders = {
    "X-RapidAPI-Key": rapidApiKey,
    "X-RapidAPI-Host": RAPID_HOST,
    "Content-Type": "application/json",
  };
  const getHeaders = {
    "X-RapidAPI-Key": rapidApiKey,
    "X-RapidAPI-Host": RAPID_HOST,
  };

  // Comprehensive list of endpoint patterns to try
  const attempts = [
    // .php endpoints (seen in playground for posts)
    { url: `https://${RAPID_HOST}/get_ig_user_data.php`, method: "POST", headers, body: `username_or_url=${encodeURIComponent(username)}` },
    { url: `https://${RAPID_HOST}/get_user_data.php`, method: "POST", headers, body: `username_or_url=${encodeURIComponent(username)}` },
    { url: `https://${RAPID_HOST}/get_ig_account_data.php`, method: "POST", headers, body: `username_or_url=${encodeURIComponent(username)}` },
    // JSON POST endpoints
    { url: `https://${RAPID_HOST}/account_data`, method: "POST", headers: jsonHeaders, body: JSON.stringify({ username_or_url: username }) },
    { url: `https://${RAPID_HOST}/account_data_v2`, method: "POST", headers: jsonHeaders, body: JSON.stringify({ username_or_url: username }) },
    { url: `https://${RAPID_HOST}/user_data`, method: "POST", headers: jsonHeaders, body: JSON.stringify({ username_or_url: username }) },
    // GET endpoints
    { url: `https://${RAPID_HOST}/account_data?username_or_url=${encodeURIComponent(username)}`, method: "GET", headers: getHeaders },
    { url: `https://${RAPID_HOST}/user_data?username_or_url=${encodeURIComponent(username)}`, method: "GET", headers: getHeaders },
    { url: `https://${RAPID_HOST}/user_info?username_or_url=${encodeURIComponent(username)}`, method: "GET", headers: getHeaders },
    { url: `https://${RAPID_HOST}/basic_user_info?username_or_url=${encodeURIComponent(username)}`, method: "GET", headers: getHeaders },
    { url: `https://${RAPID_HOST}/user_about?username_or_url=${encodeURIComponent(username)}`, method: "GET", headers: getHeaders },
    // With /v1 prefix
    { url: `https://${RAPID_HOST}/v1/info?username_or_url=${encodeURIComponent(username)}`, method: "GET", headers: getHeaders },
  ];

  for (const attempt of attempts) {
    const result = await tryEndpoint(attempt.url, attempt.method, attempt.headers, attempt.body);
    const path = new URL(attempt.url).pathname;
    console.log(`[API] ${attempt.method} ${path} → ${result.status} ${result.ok ? "✅" : "❌"}`);
    
    if (result.status === 403) {
      return { error: `Não inscrito na API (403). Acesse https://rapidapi.com/thetechguy32744/api/instagram-scraper-stable-api/pricing e assine.`, code: 403 };
    }
    
    if (result.ok && typeof result.data === "object") {
      const d = result.data?.data || result.data;
      if (d?.follower_count !== undefined || d?.followers_count !== undefined || d?.edge_followed_by || d?.pk) {
        console.log(`[API] ✅ Working endpoint found: ${path}`);
        return d;
      }
      // Log the actual response keys to help debug
      console.log(`[API] Response keys: ${Object.keys(result.data).join(", ")}`);
    }
  }
  
  return { error: "Nenhum endpoint funcionou. A API pode ter mudado seus endpoints. Tente usar outra API como 'Real-Time Instagram Scraper API'." };
}

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

async function fetchEngagementRapidApi(username: string, rapidApiKey: string) {
  const headers = { "X-RapidAPI-Key": rapidApiKey, "X-RapidAPI-Host": RAPID_HOST };
  const formHeaders = { ...headers, "Content-Type": "application/x-www-form-urlencoded" };
  
  const attempts = [
    { url: `https://${RAPID_HOST}/get_ig_user_posts.php`, method: "POST", headers: formHeaders, body: `username_or_url=${encodeURIComponent(username)}&amount=25` },
    { url: `https://${RAPID_HOST}/user_posts?username_or_url=${encodeURIComponent(username)}&amount=25`, method: "GET", headers },
    { url: `https://${RAPID_HOST}/basic_user_posts?username_or_url=${encodeURIComponent(username)}`, method: "GET", headers },
  ];

  for (const attempt of attempts) {
    const result = await tryEndpoint(attempt.url, attempt.method, attempt.headers, attempt.body);
    if (!result.ok) continue;
    const items = Array.isArray(result.data) ? result.data : (result.data?.items || result.data?.data || []);
    if (items.length > 0) {
      let totalLikes = 0, totalComments = 0;
      const slice = items.slice(0, 25);
      for (const post of slice) {
        const node = post.node || post;
        totalLikes += node.like_count || node.likes?.count || node.edge_media_preview_like?.count || 0;
        totalComments += node.comment_count || node.comments?.count || node.edge_media_to_comment?.count || 0;
      }
      return { likes: totalLikes, comments: totalComments, posts: slice.length };
    }
  }
  return { likes: 0, comments: 0, posts: 0 };
}

async function fetchEngagementMeta(igAccountId: string, accessToken: string) {
  try {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${igAccountId}/media?fields=like_count,comments_count&limit=25&access_token=${accessToken}`
    );
    const data = await res.json();
    if (data?.data && Array.isArray(data.data)) {
      let likes = 0, comments = 0;
      for (const p of data.data) { likes += p.like_count || 0; comments += p.comments_count || 0; }
      return { likes, comments, posts: data.data.length };
    }
  } catch {}
  return { likes: 0, comments: 0, posts: 0 };
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
    let likes = 0, comments = 0, engPosts = 0;
    let source = "none";

    // Strategy 1: RapidAPI
    if (rapidApiKey && igUsername) {
      console.log(`[Scraper] Starting for @${igUsername}`);
      const rapidData = await fetchViaRapidApi(igUsername, rapidApiKey);

      if (!rapidData.error) {
        followers = rapidData.follower_count ?? rapidData.followers_count ?? 0;
        following = rapidData.following_count ?? rapidData.follows_count ?? 0;
        mediaCount = rapidData.media_count ?? 0;
        username = rapidData.username || igUsername;
        profilePicUrl = rapidData.hd_profile_pic_url_info?.url || rapidData.profile_pic_url_hd || rapidData.profile_pic_url || "";
        source = "rapidapi";

        const eng = await fetchEngagementRapidApi(igUsername, rapidApiKey);
        likes = eng.likes; comments = eng.comments; engPosts = eng.posts;
        console.log(`[Scraper] ✅ ${followers} followers, ${mediaCount} media`);
      } else {
        console.log("[Scraper] RapidAPI failed:", rapidData.error);
      }
    }

    // Strategy 2: Meta Graph API
    if (source === "none" && igAccountId && accessToken) {
      console.log(`[Meta] Trying IG account: ${igAccountId}`);
      const metaData = await fetchViaMeta(igAccountId, accessToken);
      if (metaData && !metaData.error) {
        followers = metaData.followers_count || 0;
        following = metaData.follows_count || 0;
        mediaCount = metaData.media_count || 0;
        username = metaData.username || metaData.name || "";
        profilePicUrl = metaData.profile_picture_url || "";
        source = "meta";
        const eng = await fetchEngagementMeta(igAccountId, accessToken);
        likes = eng.likes; comments = eng.comments; engPosts = eng.posts;
      }
    }

    if (source === "none") {
      return new Response(JSON.stringify({
        error: "Nenhuma API funcionou. Verifique: 1) Você está inscrito na 'Instagram Scraper Stable API' no RapidAPI (plano BASIC gratuito)? 2) Sua RAPIDAPI_KEY está correta? Acesse: https://rapidapi.com/thetechguy32744/api/instagram-scraper-stable-api/pricing"
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const engagementRate = followers > 0 && engPosts > 0 ? ((likes + comments) / engPosts / followers) * 100 : 0;
    const today = new Date().toISOString().split("T")[0];

    await supabase.from("follower_snapshots").upsert({
      profile_id, user_id: profile.user_id,
      followers_count: followers, following_count: following, media_count: mediaCount,
      likes_count: likes, comments_count: comments,
      engagement_rate: Math.round(engagementRate * 100) / 100,
      snapshot_date: today,
    }, { onConflict: "profile_id,snapshot_date" });

    return new Response(JSON.stringify({
      success: true, source,
      data: {
        username, profile_picture_url: profilePicUrl,
        followers_count: followers, following_count: following, media_count: mediaCount,
        likes_count: likes, comments_count: comments,
        engagement_rate: Math.round(engagementRate * 100) / 100, snapshot_date: today,
      },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
