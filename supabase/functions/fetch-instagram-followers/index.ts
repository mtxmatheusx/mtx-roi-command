import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function discoverIgAccountId(pageId: string, accessToken: string): Promise<string | null> {
  // Try to get IG business account from the Facebook Page using older API versions
  for (const version of ["v19.0", "v18.0", "v17.0"]) {
    try {
      const res = await fetch(
        `https://graph.facebook.com/${version}/${pageId}?fields=instagram_business_account&access_token=${accessToken}`
      );
      const data = await res.json();
      if (data?.instagram_business_account?.id) {
        return data.instagram_business_account.id;
      }
    } catch {
      continue;
    }
  }
  return null;
}

async function fetchIgData(igAccountId: string, accessToken: string) {
  // Try fetching IG user data from multiple API versions
  for (const version of ["v21.0", "v20.0", "v19.0", "v18.0"]) {
    try {
      const res = await fetch(
        `https://graph.facebook.com/${version}/${igAccountId}?fields=followers_count,follows_count,media_count,username,profile_picture_url,name&access_token=${accessToken}`
      );
      const data = await res.json();
      if (!data.error && (data.followers_count !== undefined || data.username)) {
        return data;
      }
      // If this specific error, try next version
      if (data.error?.code === 36106) continue;
      // For other errors, return them
      if (data.error) return data;
    } catch {
      continue;
    }
  }
  return null;
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

    const { data: profile, error: profileError } = await supabase
      .from("client_profiles")
      .select("page_id, meta_access_token, name, user_id, instagram_account_id")
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

    let igAccountId = profile.instagram_account_id;

    // If no IG account ID stored, try to discover it from page_id
    if (!igAccountId && profile.page_id) {
      console.log("Attempting to discover IG account from page:", profile.page_id);
      igAccountId = await discoverIgAccountId(profile.page_id, accessToken);
      
      // Save discovered ID for future use
      if (igAccountId) {
        console.log("Discovered IG account ID:", igAccountId);
        await supabase
          .from("client_profiles")
          .update({ instagram_account_id: igAccountId })
          .eq("id", profile_id);
      }
    }

    if (!igAccountId) {
      return new Response(JSON.stringify({ 
        error: "Instagram Account ID não encontrado. Configure o Instagram Account ID nas Configurações do perfil, ou verifique se a Page tem uma conta Business do Instagram vinculada."
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch IG data
    const igData = await fetchIgData(igAccountId, accessToken);

    if (!igData || igData.error) {
      const errorMsg = igData?.error?.message || "Failed to fetch Instagram data";
      return new Response(JSON.stringify({ error: `Instagram API: ${errorMsg}` }), {
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
        username: igData.username || igData.name,
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
