import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const META_API = "https://graph.facebook.com/v21.0";

function metaError(data: any): string {
  return data?.error?.error_user_msg || data?.error?.message || "Erro desconhecido da Meta API";
}

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

    // Auth — try getClaims, fallback to getUser
    let userId: string;
    try {
      const token = authHeader.replace("Bearer ", "");
      const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
      if (claimsError || !claimsData?.claims) throw new Error("getClaims failed");
      userId = claimsData.claims.sub;
    } catch {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        return new Response(JSON.stringify({ error: "Não autorizado" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = user.id;
    }

    const { draftId } = await req.json();
    if (!draftId) {
      return new Response(JSON.stringify({ error: "draftId é obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch draft
    const { data: draft, error: draftError } = await supabase
      .from("campaign_drafts")
      .select("*, client_profiles(*)")
      .eq("id", draftId)
      .eq("user_id", userId)
      .single();

    if (draftError || !draft) {
      return new Response(JSON.stringify({ error: "Rascunho não encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const profile = draft.client_profiles;
    const accessToken = profile?.meta_access_token || Deno.env.get("META_ACCESS_TOKEN");

    if (!accessToken) {
      await supabase.from("campaign_drafts").update({ status: "failed", error_message: "Token Meta não configurado" }).eq("id", draftId);
      return new Response(JSON.stringify({ error: "Token de acesso Meta não configurado. Configure nas Configurações." }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adAccountId = profile?.ad_account_id;
    if (!adAccountId || adAccountId === "act_") {
      await supabase.from("campaign_drafts").update({ status: "failed", error_message: "Ad Account ID não configurado" }).eq("id", draftId);
      return new Response(JSON.stringify({ error: "Ad Account ID não configurado." }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate token
    const tokenCheck = await fetch(`${META_API}/me?access_token=${accessToken}&fields=id`);
    const tokenData = await tokenCheck.json();
    if (tokenData.error) {
      const msg = `Token inválido ou sem permissão ads_management: ${metaError(tokenData)}`;
      await supabase.from("campaign_drafts").update({ status: "failed", error_message: msg }).eq("id", draftId);
      return new Response(JSON.stringify({ error: msg, step: "token_validation" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update status to approved
    await supabase.from("campaign_drafts").update({ status: "approved" }).eq("id", draftId);

    const steps: string[] = [];
    const selectedCopy = Array.isArray(draft.copy_options) && draft.copy_options.length > 0 ? draft.copy_options[0] : null;

    // Step 1: Create Campaign
    const campaignRes = await fetch(`${META_API}/${adAccountId}/campaigns`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: draft.campaign_name,
        objective: draft.objective,
        status: "PAUSED",
        special_ad_categories: [],
        is_adset_budget_sharing_enabled: false,
        access_token: accessToken,
      }),
    });

    const campaignData = await campaignRes.json();
    if (campaignData.error) {
      const errorMsg = metaError(campaignData);
      await supabase.from("campaign_drafts").update({ status: "failed", error_message: errorMsg }).eq("id", draftId);
      return new Response(JSON.stringify({ error: errorMsg, step: "campaign" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const metaCampaignId = campaignData.id;
    steps.push(`Campanha criada: ${metaCampaignId}`);
    await supabase.from("campaign_drafts").update({ meta_campaign_id: metaCampaignId }).eq("id", draftId);

    // Step 2: Create Ad Set — with pixel injection for conversion objectives
    const dailyBudgetCents = Math.round((draft.daily_budget || 50) * 100);
    const isConversion = ["OUTCOME_SALES", "OUTCOME_LEADS"].includes(draft.objective);
    const pixelId = profile?.pixel_id;

    const adSetBody: Record<string, unknown> = {
      name: `${draft.campaign_name} - Conjunto 01`,
      campaign_id: metaCampaignId,
      daily_budget: dailyBudgetCents,
      billing_event: "IMPRESSIONS",
      optimization_goal: draft.objective === "OUTCOME_LEADS"
        ? "LEAD_GENERATION"
        : draft.objective === "OUTCOME_SALES"
          ? "OFFSITE_CONVERSIONS"
          : "LINK_CLICKS",
      bid_strategy: "LOWEST_COST_WITHOUT_CAP",
      targeting: { geo_locations: { countries: ["BR"] } },
      status: "PAUSED",
      access_token: accessToken,
    };

    // Inject pixel_id as promoted_object for conversion campaigns
    if (isConversion && pixelId && pixelId.trim() !== "") {
      adSetBody.promoted_object = { pixel_id: pixelId };
    }

    const adSetRes = await fetch(`${META_API}/${adAccountId}/adsets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(adSetBody),
    });

    const adSetData = await adSetRes.json();
    if (adSetData.error) {
      const errorMsg = metaError(adSetData);
      await supabase.from("campaign_drafts").update({ status: "failed", error_message: errorMsg, meta_campaign_id: metaCampaignId }).eq("id", draftId);
      return new Response(JSON.stringify({ error: errorMsg, step: "adset", meta_campaign_id: metaCampaignId, steps }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const metaAdSetId = adSetData.id;
    steps.push(`Conjunto criado: ${metaAdSetId}`);
    await supabase.from("campaign_drafts").update({ meta_adset_id: metaAdSetId }).eq("id", draftId);

    // Step 3: Create Ad (creative inline)
    const adBody: Record<string, unknown> = {
      name: `${draft.campaign_name} - Anúncio 01`,
      adset_id: metaAdSetId,
      status: "PAUSED",
      access_token: accessToken,
      creative: {
        object_story_spec: {
          link_data: {
            message: selectedCopy?.primary_text || "Descubra como transformar seus resultados",
            name: selectedCopy?.headline || draft.campaign_name,
            call_to_action: { type: selectedCopy?.cta === "Saiba Mais" ? "LEARN_MORE" : "SHOP_NOW" },
          },
        },
      },
    };

    const adRes = await fetch(`${META_API}/${adAccountId}/ads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(adBody),
    });

    const adData = await adRes.json();
    if (adData.error) {
      const errorMsg = metaError(adData);
      await supabase.from("campaign_drafts").update({
        status: "failed",
        error_message: `Campanha e conjunto criados, mas erro no anúncio: ${errorMsg}`,
      }).eq("id", draftId);
      return new Response(JSON.stringify({ error: errorMsg, step: "ad", meta_campaign_id: metaCampaignId, meta_adset_id: metaAdSetId, steps }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const metaAdId = adData.id;
    steps.push(`Anúncio criado: ${metaAdId}`);

    // Mark as published
    await supabase.from("campaign_drafts").update({
      status: "published",
      meta_ad_id: metaAdId,
      error_message: null,
    }).eq("id", draftId);

    return new Response(JSON.stringify({
      success: true,
      meta_campaign_id: metaCampaignId,
      meta_adset_id: metaAdSetId,
      meta_ad_id: metaAdId,
      steps,
      ads_manager_url: `https://business.facebook.com/adsmanager/manage/campaigns?act=${adAccountId.replace("act_", "")}&selected_campaign_ids=${metaCampaignId}`,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("create-meta-campaign error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
