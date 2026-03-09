import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const META_API = "https://graph.facebook.com/v21.0";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { profileId, audienceType, name, description, subtype, rule, pixelId, lookalikeSpec } = body;

    if (!profileId) {
      return new Response(JSON.stringify({ error: "profileId é obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch profile
    const { data: profile, error: profileError } = await supabase
      .from("client_profiles")
      .select("*")
      .eq("id", profileId)
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: "Perfil não encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accessToken = profile.meta_access_token || Deno.env.get("META_ACCESS_TOKEN");
    if (!accessToken) {
      return new Response(JSON.stringify({ error: "Token Meta não configurado" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adAccountId = profile.ad_account_id;
    if (!adAccountId || adAccountId === "act_") {
      return new Response(JSON.stringify({ error: "Ad Account ID não configurado" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build audience payload based on type
    if (audienceType === "list_audiences") {
      // List existing custom audiences
      const listResp = await fetch(
        `${META_API}/${adAccountId}/customaudiences?fields=id,name,subtype,approximate_count_lower_bound,approximate_count_upper_bound,time_created&limit=50&access_token=${accessToken}`
      );
      const listData = await listResp.json();

      if (listData.error) {
        return new Response(JSON.stringify({ error: listData.error.message }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ audiences: listData.data || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (audienceType === "website_visitors") {
      // Create website custom audience (pixel-based)
      const effectivePixelId = pixelId || profile.pixel_id;
      if (!effectivePixelId || effectivePixelId.trim() === "") {
        return new Response(JSON.stringify({ error: "Pixel ID é obrigatório para público de visitantes do site" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const retentionDays = rule?.retention_seconds ? Math.round(rule.retention_seconds / 86400) : 180;
      const audiencePayload: Record<string, unknown> = {
        name: name || `Visitantes do Site - ${retentionDays}d`,
        description: description || `Pessoas que visitaram o site nos últimos ${retentionDays} dias`,
        rule: JSON.stringify({
          inclusions: {
            operator: "or",
            rules: [{
              event_sources: [{ id: effectivePixelId, type: "pixel" }],
              retention_seconds: rule?.retention_seconds || 15552000, // 180 days default
              filter: { operator: "and", filters: [{ field: "url", operator: "i_contains", value: rule?.url_filter || "" }] },
            }],
          },
        }),
        access_token: accessToken,
      };

      const createResp = await fetch(`${META_API}/${adAccountId}/customaudiences`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(audiencePayload),
      });
      const createData = await createResp.json();

      if (createData.error) {
        return new Response(JSON.stringify({ error: createData.error.error_user_msg || createData.error.message }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        success: true,
        audience_id: createData.id,
        name: audiencePayload.name,
        type: "website_visitors",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (audienceType === "lookalike") {
      // Create lookalike audience
      if (!lookalikeSpec?.source_audience_id) {
        return new Response(JSON.stringify({ error: "source_audience_id é obrigatório para Lookalike" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const ratio = lookalikeSpec.ratio || 0.01; // 1% default
      const country = lookalikeSpec.country || "BR";

      const lookalPayload = {
        name: name || `Lookalike ${Math.round(ratio * 100)}% - ${country}`,
        origin_audience_id: lookalikeSpec.source_audience_id,
        lookalike_spec: JSON.stringify({
          type: "similarity",
          ratio,
          country,
        }),
        access_token: accessToken,
      };

      const createResp = await fetch(`${META_API}/${adAccountId}/customaudiences`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(lookalPayload),
      });
      const createData = await createResp.json();

      if (createData.error) {
        return new Response(JSON.stringify({ error: createData.error.error_user_msg || createData.error.message }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        success: true,
        audience_id: createData.id,
        name: lookalPayload.name,
        type: "lookalike",
        ratio,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (audienceType === "engagement") {
      // Create engagement custom audience (page/IG interactions)
      const pageId = profile.page_id;
      if (!pageId || pageId.trim() === "") {
        return new Response(JSON.stringify({ error: "Page ID é obrigatório para público de engajamento" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const retentionDays = rule?.retention_seconds ? Math.round(rule.retention_seconds / 86400) : 365;
      const audiencePayload = {
        name: name || `Engajamento Página - ${retentionDays}d`,
        description: description || `Pessoas que interagiram com a página nos últimos ${retentionDays} dias`,
        rule: JSON.stringify({
          inclusions: {
            operator: "or",
            rules: [{
              object_id: pageId,
              event_sources: [{ id: pageId, type: "page" }],
              retention_seconds: rule?.retention_seconds || 31536000,
            }],
          },
        }),
        access_token: accessToken,
      };

      const createResp = await fetch(`${META_API}/${adAccountId}/customaudiences`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(audiencePayload),
      });
      const createData = await createResp.json();

      if (createData.error) {
        return new Response(JSON.stringify({ error: createData.error.error_user_msg || createData.error.message }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        success: true,
        audience_id: createData.id,
        name: audiencePayload.name,
        type: "engagement",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: `Tipo de público não suportado: ${audienceType}` }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("manage-audiences error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
