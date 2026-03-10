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
    const rawText = await req.text();
    if (!rawText || rawText.trim() === "") {
      return new Response(JSON.stringify({ error: "Corpo vazio." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let body: any;
    try { body = JSON.parse(rawText); } catch {
      return new Response(JSON.stringify({ error: "JSON inválido." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { profileId } = body;
    if (!profileId) {
      return new Response(JSON.stringify({ error: "profileId é obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: profile, error: profileError } = await supabase
      .from("client_profiles")
      .select("meta_access_token, ad_account_id")
      .eq("id", profileId)
      .single();

    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: "Perfil não encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accessToken = profile.meta_access_token || Deno.env.get("META_ACCESS_TOKEN");
    const adAccountId = profile.ad_account_id;

    if (!accessToken || !adAccountId || adAccountId === "act_") {
      return new Response(JSON.stringify({ error: "Token ou Ad Account ID não configurado." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 1: Get Business ID from Ad Account
    const acctInfoUrl = `${META_API}/${adAccountId}?fields=business&access_token=${accessToken}`;
    console.log("Fetching ad account info:", adAccountId);
    const acctInfoRes = await fetch(acctInfoUrl);
    const acctInfo = await acctInfoRes.json();
    console.log("Ad account response:", JSON.stringify(acctInfo));

    if (acctInfo?.error) {
      return new Response(JSON.stringify({ error: acctInfo.error.message, catalogs: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 2: Fetch catalogs from Business
    if (acctInfo?.business?.id) {
      const bizCatalogsUrl = `${META_API}/${acctInfo.business.id}/owned_product_catalogs?fields=id,name,product_count,vertical&access_token=${accessToken}&limit=50`;
      console.log("Fetching catalogs from business:", acctInfo.business.id);
      const bizRes = await fetch(bizCatalogsUrl);
      const bizData = await bizRes.json();
      console.log("Catalogs response:", JSON.stringify(bizData));

      if (!bizData.error) {
        return new Response(JSON.stringify({
          catalogs: bizData.data || [],
          source: "business_owned_catalogs",
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      return new Response(JSON.stringify({ error: bizData.error.message, catalogs: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fallback: no business or error — return empty
    const errorMsg = acctInfo?.error?.message || "Nenhum catálogo encontrado. Verifique se o Business Manager tem catálogos configurados.";
    return new Response(JSON.stringify({
      error: errorMsg,
      catalogs: [],
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("fetch-meta-catalogs error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
