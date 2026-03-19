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

    const { data: profile, error: profileError } = await supabase
      .from("client_profiles")
      .select("page_id, meta_access_token, name, user_id")
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
      return new Response(JSON.stringify({ error: "No page_id configured for this profile." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Try multiple API versions to find the IG Business Account
    const apiVersions = ["v19.0", "v18.0", "v17.0"];
    let igAccountId: string | null = null;
    let lastError = "";

    for (const version of apiVersions) {
      try {
        const pageRes = await fetch(
          `https://graph.facebook.com/${version}/${pageId}?fields=instagram_business_account&access_token=${accessToken}`
        );
        const pageData = await pageRes.json();
        
        if (pageData?.instagram_business_account?.id) {
          igAccountId = pageData.instagram_business_account.id;
          break;
        }
        if (pageData.error) {
          lastError = pageData.error.message;
          continue;
        }
      } catch {
        continue;
      }
    }

    // If page lookup failed, try using page ID directly as IG user
    // Some setups have the IG user ID stored as page_id
    if (!igAccountId) {
      // Try fetching directly with the page_id as an IG user ID
      for (const version of ["v19.0", "v18.0"]) {
        try {
          const directRes = await fetch(
            `https://graph.facebook.com/${version}/${pageId}?fields=id,name&access_token=${accessToken}`
          );
          const directData = await directRes.json();
          if (directData?.id && !directData.error) {
            igAccountId = pageId;
            break;
          }
        } catch {
          continue;
        }
      }
    }

    if (!igAccountId) {
      return new Response(JSON.stringify({ 
        error: `Could not find Instagram Business Account. Last error: ${lastError || "No IG account linked to this page"}. Ensure the Facebook Page has an Instagram Business Account connected.`
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch IG account data using a compatible API version
    let igData: any = null;
    for (const version of ["v19.0", "v18.0"]) {
      try {
        const igRes = await fetch(
          `https://graph.facebook.com/${version}/${igAccountId}?fields=followers_count,follows_count,media_count,username,profile_picture_url&access_token=${accessToken}`
        );
        const data = await igRes.json();
        if (!data.error) {
          igData = data;
          break;
        }
      } catch {
        continue;
      }
    }

    if (!igData) {
      return new Response(JSON.stringify({ error: "Failed to fetch Instagram data from all API versions." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Upsert snapshot
    const today = new Date().toISOString().split("T")[0];
    const { error: upsertError } = await supabase
      .from("follower_snapshots")
      .upsert({
        profile_id,
        user_id: profile.user_id,
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
