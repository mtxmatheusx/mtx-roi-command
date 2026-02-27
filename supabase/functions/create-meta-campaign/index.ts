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

    // Step 2: Create Ad Set — with pixel injection for conversion objectives + Andromeda targeting
    const dailyBudgetCents = Math.round((draft.daily_budget || 50) * 100);
    const isConversion = ["OUTCOME_SALES", "OUTCOME_LEADS"].includes(draft.objective);
    const pixelId = profile?.pixel_id;
    const andromedaTargeting = draft.andromeda_targeting as { age_min?: number; age_max?: number; genders?: number[]; semantic_seeds?: string[]; andromeda_exclusion?: string[] } | null;

    // Resolve semantic_seeds to real Meta interest IDs if Andromeda targeting is present
    let resolvedInterests: { id: string; name: string }[] = [];
    if (andromedaTargeting?.semantic_seeds?.length) {
      for (const seed of andromedaTargeting.semantic_seeds) {
        try {
          const searchRes = await fetch(`${META_API}/search?type=adinterest&q=${encodeURIComponent(seed)}&limit=1&access_token=${accessToken}`);
          const searchData = await searchRes.json();
          if (searchData.data?.[0]) {
            resolvedInterests.push({ id: searchData.data[0].id, name: searchData.data[0].name });
          }
        } catch (e) {
          console.warn(`Failed to resolve interest "${seed}":`, e);
        }
      }
    }

    // Build targeting object
    const targetingObj: Record<string, unknown> = { geo_locations: { countries: ["BR"] } };
    if (andromedaTargeting) {
      if (andromedaTargeting.age_min) targetingObj.age_min = andromedaTargeting.age_min;
      if (andromedaTargeting.age_max) targetingObj.age_max = andromedaTargeting.age_max;
      if (andromedaTargeting.genders?.length && !andromedaTargeting.genders.includes(0)) {
        targetingObj.genders = andromedaTargeting.genders;
      }
      if (resolvedInterests.length > 0) {
        targetingObj.flexible_spec = [{ interests: resolvedInterests }];
      }
    }

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
      targeting: targetingObj,
      status: "PAUSED",
      access_token: accessToken,
    };

    // Enable Andromeda/Advantage+ audience expansion
    if (andromedaTargeting) {
      adSetBody.targeting_optimization = "expansion_all";
      adSetBody.targeting_automation = { advantage_audience: 1 };
    }

    // Inject pixel_id as promoted_object for conversion campaigns
    if (isConversion && pixelId && pixelId.trim() !== "") {
      adSetBody.promoted_object = {
        pixel_id: pixelId,
        custom_event_type: draft.objective === "OUTCOME_LEADS" ? "LEAD" : "PURCHASE",
      };
    } else if (isConversion && (!pixelId || pixelId.trim() === "")) {
      await supabase.from("campaign_drafts").update({ status: "failed", error_message: "Pixel ID é obrigatório para campanhas de conversão. Configure nas Configurações." }).eq("id", draftId);
      return new Response(JSON.stringify({ error: "Pixel ID é obrigatório para campanhas de conversão.", step: "adset_validation" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adSetRes = await fetch(`${META_API}/${adAccountId}/adsets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(adSetBody),
    });

    const adSetData = await adSetRes.json();
    if (adSetData.error) {
      const errorMsg = metaError(adSetData);
      // Rollback: delete orphan campaign from Meta
      try {
        await fetch(`${META_API}/${metaCampaignId}?access_token=${accessToken}`, { method: "DELETE" });
        console.log(`Rollback: deleted orphan campaign ${metaCampaignId}`);
      } catch (rollbackErr) {
        console.error("Rollback failed:", rollbackErr);
      }
      await supabase.from("campaign_drafts").update({ status: "failed", error_message: `${errorMsg} | Campanha parcial apagada automaticamente.`, meta_campaign_id: metaCampaignId }).eq("id", draftId);
      return new Response(JSON.stringify({ error: `${errorMsg} | Campanha parcial apagada automaticamente.`, step: "adset", meta_campaign_id: metaCampaignId, steps, rollback: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const metaAdSetId = adSetData.id;
    steps.push(`Conjunto criado: ${metaAdSetId}`);
    await supabase.from("campaign_drafts").update({ meta_adset_id: metaAdSetId }).eq("id", draftId);

    // Step 3: Create Ad (creative inline)
    const pageId = profile?.page_id;
    if (!pageId || pageId.trim() === "") {
      await supabase.from("campaign_drafts").update({ status: "failed", error_message: "Page ID do Facebook não configurado. Configure nas Configurações." }).eq("id", draftId);
      return new Response(JSON.stringify({ error: "Page ID do Facebook não configurado. Configure nas Configurações.", step: "ad_validation", meta_campaign_id: metaCampaignId, meta_adset_id: metaAdSetId, steps }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ctaRaw = selectedCopy?.cta || "";
    const ctaType = /compre|shop/i.test(ctaRaw) ? "SHOP_NOW" : "LEARN_MORE";
    const linkUrl = (Array.isArray(profile?.product_urls) && profile.product_urls.length > 0) ? profile.product_urls[0] : "https://example.com";

    const adBody: Record<string, unknown> = {
      name: `${draft.campaign_name} - Anúncio 01`,
      adset_id: metaAdSetId,
      status: "PAUSED",
      access_token: accessToken,
      creative: {
        object_story_spec: {
          page_id: pageId,
          link_data: {
            message: selectedCopy?.primary_text || "Descubra como transformar seus resultados",
            link: linkUrl,
            name: selectedCopy?.headline || draft.campaign_name,
            call_to_action: { type: ctaType, value: { link: linkUrl } },
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
      // Rollback: delete orphan campaign (which cascades adset) from Meta
      try {
        await fetch(`${META_API}/${metaCampaignId}?access_token=${accessToken}`, { method: "DELETE" });
        console.log(`Rollback: deleted orphan campaign ${metaCampaignId} after ad failure`);
      } catch (rollbackErr) {
        console.error("Rollback failed:", rollbackErr);
      }
      await supabase.from("campaign_drafts").update({
        status: "failed",
        error_message: `Erro no anúncio: ${errorMsg} | Campanha parcial apagada automaticamente.`,
      }).eq("id", draftId);
      return new Response(JSON.stringify({ error: `${errorMsg} | Campanha parcial apagada automaticamente.`, step: "ad", meta_campaign_id: metaCampaignId, meta_adset_id: metaAdSetId, steps, rollback: true }), {
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
