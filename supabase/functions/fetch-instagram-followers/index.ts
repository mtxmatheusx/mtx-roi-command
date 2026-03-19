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

    // Get profile to find page_id and access token
    const { data: profile, error: profileError } = await supabase
      .from("client_profiles")
      .select("page_id, meta_access_token, name")
      .eq("id", profile_id)
      .single();

    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: "Profile not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accessToken = profile.meta_access_token || Deno.env.get("META_ACCESS_TOKEN");
    if (!accessToken) {
      return new Response(JSON.stringify({ error: "No access token available" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const pageId = profile.page_id;
    if (!pageId) {
      return new Response(JSON.stringify({ error: "No page_id configured for this profile. Configure the Facebook Page ID in settings." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 1: Get Instagram Business Account ID from the Facebook Page
    const pageRes = await fetch(
      `https://graph.facebook.com/v21.0/${pageId}?fields=instagram_business_account&access_token=${accessToken}`
    );
    const pageData = await pageRes.json();

    if (pageData.error) {
      return new Response(JSON.stringify({ error: `Meta API error: ${pageData.error.message}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const igAccountId = pageData?.instagram_business_account?.id;
    if (!igAccountId) {
      return new Response(JSON.stringify({ error: "No Instagram Business Account linked to this Facebook Page." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 2: Get follower count
    const igRes = await fetch(
      `https://graph.facebook.com/v21.0/${igAccountId}?fields=followers_count,follows_count,media_count,username,profile_picture_url&access_token=${accessToken}`
    );
    const igData = await igRes.json();

    if (igData.error) {
      return new Response(JSON.stringify({ error: `Instagram API error: ${igData.error.message}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 3: Upsert snapshot for today
    const today = new Date().toISOString().split("T")[0];

    // Get user_id from profile
    const { data: fullProfile } = await supabase
      .from("client_profiles")
      .select("user_id")
      .eq("id", profile_id)
      .single();

    const { error: upsertError } = await supabase
      .from("follower_snapshots")
      .upsert({
        profile_id,
        user_id: fullProfile!.user_id,
        followers_count: igData.followers_count || 0,
        following_count: igData.follows_count || 0,
        media_count: igData.media_count || 0,
        snapshot_date: today,
      }, { onConflict: "profile_id,snapshot_date" });

    if (upsertError) {
      console.error("Upsert error:", upsertError);
    }

    return new Response(JSON.stringify({
      success: true,
      data: {
        username: igData.username,
        profile_picture_url: igData.profile_picture_url,
        followers_count: igData.followers_count || 0,
        following_count: igData.follows_count || 0,
        media_count: igData.media_count || 0,
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
