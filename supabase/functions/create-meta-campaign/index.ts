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

function isVideoUrl(url: string): boolean {
  return /\.(mp4|mov|webm|avi|mkv)(\?|$)/i.test(url);
}

function fail(msg: string, extra: Record<string, unknown> = {}) {
  return new Response(JSON.stringify({ error: msg, ...extra }), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return fail("Não autorizado");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    let userId: string;
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return fail("Não autorizado");
    userId = user.id;

    const body = await req.json();
    const { draftId, creativeUrls, audience_id, audience_ids, excluded_audience_ids, destination_url, cta_type, use_catalog, catalog_id } = body;

    if (!draftId) return fail("draftId é obrigatório");

    // Fetch draft + profile
    const { data: draft, error: draftError } = await supabase
      .from("campaign_drafts")
      .select("*, client_profiles(*)")
      .eq("id", draftId)
      .eq("user_id", userId)
      .single();

    if (draftError || !draft) return fail("Rascunho não encontrado");

    const profile = draft.client_profiles;
    const accessToken = profile?.meta_access_token || Deno.env.get("META_ACCESS_TOKEN");

    if (!accessToken) {
      await supabase.from("campaign_drafts").update({ status: "failed", error_message: "Token Meta não configurado" }).eq("id", draftId);
      return fail("Token de acesso Meta não configurado. Configure nas Configurações.");
    }

    const adAccountId = profile?.ad_account_id;
    if (!adAccountId || adAccountId === "act_") {
      await supabase.from("campaign_drafts").update({ status: "failed", error_message: "Ad Account ID não configurado" }).eq("id", draftId);
      return fail("Ad Account ID não configurado.");
    }

    // Validate token
    const tokenCheck = await fetch(`${META_API}/me?access_token=${accessToken}&fields=id`);
    const tokenData = await tokenCheck.json();
    if (tokenData.error) {
      const msg = `Token inválido: ${metaError(tokenData)}`;
      await supabase.from("campaign_drafts").update({ status: "failed", error_message: msg }).eq("id", draftId);
      return fail(msg, { step: "token_validation" });
    }

    await supabase.from("campaign_drafts").update({ status: "approved" }).eq("id", draftId);

    const steps: string[] = [];
    const selectedCopy = Array.isArray(draft.copy_options) && draft.copy_options.length > 0 ? draft.copy_options[0] : null;

    // ─── Step 1: Create Campaign ─────────────────────────────────
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
      return fail(errorMsg, { step: "campaign" });
    }

    const metaCampaignId = campaignData.id;
    steps.push(`Campanha criada: ${metaCampaignId}`);
    await supabase.from("campaign_drafts").update({ meta_campaign_id: metaCampaignId }).eq("id", draftId);

    // Helper: rollback campaign on failure
    async function rollbackCampaign() {
      try {
        await fetch(`${META_API}/${metaCampaignId}?access_token=${accessToken}`, { method: "DELETE" });
        console.log(`Rollback: deleted campaign ${metaCampaignId}`);
      } catch (e) {
        console.error("Rollback failed:", e);
      }
    }

    // ─── Step 2: Create Ad Set ─────────────────────────────────
    const dailyBudgetCents = Math.round((draft.daily_budget || 50) * 100);
    const isConversion = ["OUTCOME_SALES", "OUTCOME_LEADS"].includes(draft.objective);
    const pixelId = profile?.pixel_id;
    const andromedaTargeting = draft.andromeda_targeting as { age_min?: number; age_max?: number; genders?: number[]; semantic_seeds?: string[]; andromeda_exclusion?: string[] } | null;

    // Resolve semantic seeds to Meta interest IDs
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

    // Build targeting — v23.0 requires explicit advantage_audience (1 or 0)
    const useAdvantagePlus = ["OUTCOME_SALES", "OUTCOME_LEADS"].includes(draft.objective);
    const targetingObj: Record<string, unknown> = {
      geo_locations: { countries: ["BR"] },
      targeting_automation: { advantage_audience: useAdvantagePlus ? 1 : 0 },
    };

    if (andromedaTargeting) {
      const ageMin = andromedaTargeting.age_min;
      if (ageMin && ageMin >= 18) {
        targetingObj.age_min = useAdvantagePlus ? Math.min(ageMin, 25) : Math.min(ageMin, 65);
      }

      if (useAdvantagePlus) {
        targetingObj.age_max = 65;
      } else {
        const ageMax = andromedaTargeting.age_max;
        if (ageMax && ageMax >= 18 && ageMax <= 65) {
          targetingObj.age_max = ageMax;
        }
      }

      if (andromedaTargeting.genders?.length && !andromedaTargeting.genders.includes(0)) {
        targetingObj.genders = andromedaTargeting.genders;
      }
      if (resolvedInterests.length > 0) {
        targetingObj.flexible_spec = [{ interests: resolvedInterests }];
      }
    } else {
      targetingObj.age_min = 18;
      targetingObj.age_max = 65;
    }

    // ─── Inject custom audiences (remarketing) ───
    const includeAudienceIds: string[] = audience_ids?.length ? [...audience_ids] : (audience_id ? [audience_id] : []);
    if (includeAudienceIds.length > 0) {
      targetingObj.custom_audiences = includeAudienceIds.map((id: string) => ({ id }));
      console.log("Injecting custom_audiences:", includeAudienceIds);
    }
    if (excluded_audience_ids?.length > 0) {
      targetingObj.excluded_custom_audiences = excluded_audience_ids.map((id: string) => ({ id }));
      console.log("Injecting excluded_custom_audiences:", excluded_audience_ids);
    }

    console.log("Final targeting payload:", JSON.stringify(targetingObj));

    const adSetBody: Record<string, unknown> = {
      name: `${draft.campaign_name} - Conjunto 01`,
      campaign_id: metaCampaignId,
      daily_budget: dailyBudgetCents,
      billing_event: "IMPRESSIONS",
      optimization_goal: draft.objective === "OUTCOME_LEADS"
        ? "LEAD_GENERATION"
        : draft.objective === "OUTCOME_SALES"
          ? "OFFSITE_CONVERSIONS"
          : draft.objective === "OUTCOME_TRAFFIC"
            ? "LANDING_PAGE_VIEWS"
            : draft.objective === "OUTCOME_ENGAGEMENT"
              ? "POST_ENGAGEMENT"
              : draft.objective === "OUTCOME_AWARENESS"
                ? "REACH"
                : "LINK_CLICKS",
      bid_strategy: "LOWEST_COST_WITHOUT_CAP",
      targeting: targetingObj,
      is_adset_budget_sharing_enabled: false,
      status: "PAUSED",
      access_token: accessToken,
    };

    if (isConversion && pixelId && pixelId.trim() !== "") {
      adSetBody.promoted_object = {
        pixel_id: pixelId,
        custom_event_type: draft.objective === "OUTCOME_LEADS" ? "LEAD" : "PURCHASE",
      };
    } else if (isConversion && (!pixelId || pixelId.trim() === "")) {
      await supabase.from("campaign_drafts").update({ status: "failed", error_message: "Pixel ID obrigatório para conversão." }).eq("id", draftId);
      await rollbackCampaign();
      return fail("Pixel ID é obrigatório para campanhas de conversão.", { step: "adset_validation", rollback: true });
    }

    const adSetRes = await fetch(`${META_API}/${adAccountId}/adsets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(adSetBody),
    });

    const adSetData = await adSetRes.json();
    if (adSetData.error) {
      const errorMsg = metaError(adSetData);
      await rollbackCampaign();
      await supabase.from("campaign_drafts").update({ status: "failed", error_message: `${errorMsg} | Rollback executado.`, meta_campaign_id: metaCampaignId }).eq("id", draftId);
      return fail(`${errorMsg} | Campanha parcial apagada automaticamente.`, { step: "adset", meta_campaign_id: metaCampaignId, steps, rollback: true });
    }

    const metaAdSetId = adSetData.id;
    steps.push(`Conjunto criado: ${metaAdSetId}`);
    await supabase.from("campaign_drafts").update({ meta_adset_id: metaAdSetId }).eq("id", draftId);

    // ─── Step 3: Create Ads (batch support, up to 50) ────────────
    const pageId = profile?.page_id;
    if (!pageId || pageId.trim() === "") {
      await supabase.from("campaign_drafts").update({ status: "failed", error_message: "Page ID não configurado." }).eq("id", draftId);
      return fail("Página do Facebook não configurada. Configure nas Configurações.", { step: "ad_validation", meta_campaign_id: metaCampaignId, meta_adset_id: metaAdSetId, steps });
    }

    // Build list of creative URLs
    const allUrls: string[] = [];
    if (Array.isArray(creativeUrls) && creativeUrls.length > 0) {
      allUrls.push(...creativeUrls.slice(0, 50));
    } else if (draft.injected_creative_url) {
      allUrls.push(draft.injected_creative_url);
    }

    const ctaRaw = selectedCopy?.cta || "";
    const ctaType = /compre|shop/i.test(ctaRaw) ? "SHOP_NOW" : "LEARN_MORE";
    const linkUrl = (Array.isArray(profile?.product_urls) && profile.product_urls.length > 0) ? profile.product_urls[0] : "https://example.com";

    // Function to build creative spec for a given URL
    function buildCreativeSpec(url: string | null): Record<string, unknown> {
      if (url && isVideoUrl(url)) {
        // For videos we still need to upload first — but use inline approach
        // We'll handle video upload separately before this
        return {
          object_story_spec: {
            page_id: String(pageId),
            link_data: {
              message: selectedCopy?.primary_text || "Descubra como transformar seus resultados",
              link: linkUrl,
              name: selectedCopy?.headline || draft.campaign_name,
              call_to_action: { type: ctaType, value: { link: linkUrl } },
              picture: url, // fallback for video thumbnail
            },
          },
        };
      }

      // Image creative — FIX: use `picture` URL directly instead of /adimages upload
      const linkData: Record<string, unknown> = {
        message: selectedCopy?.primary_text || "Descubra como transformar seus resultados",
        link: linkUrl,
        name: selectedCopy?.headline || draft.campaign_name,
        call_to_action: { type: ctaType, value: { link: linkUrl } },
      };
      if (url) linkData.picture = url;

      return {
        object_story_spec: { page_id: String(pageId), link_data: linkData },
      };
    }

    // Function to create a single ad with video support
    async function createAd(url: string | null, adIndex: number): Promise<{ success: boolean; adId?: string; error?: string }> {
      const adName = allUrls.length > 1
        ? `${draft.campaign_name} - Anúncio ${String(adIndex + 1).padStart(2, "0")}`
        : `${draft.campaign_name} - Anúncio 01`;

      let creativeSpec: Record<string, unknown>;

      // Handle video upload if needed
      if (url && isVideoUrl(url)) {
        try {
          const videoUploadRes = await fetch(`${META_API}/${adAccountId}/advideos`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              file_url: url,
              name: `Video_${adIndex + 1}_${new Date().toISOString().slice(0, 10)}`,
              access_token: accessToken,
            }),
          });
          const videoData = await videoUploadRes.json();
          if (videoData.error) {
            return { success: false, error: `Video upload falhou: ${metaError(videoData)}` };
          }
          const videoId = videoData.id;
          if (videoId) {
            creativeSpec = {
              object_story_spec: {
                page_id: String(pageId),
                video_data: {
                  video_id: String(videoId),
                  message: selectedCopy?.primary_text || "Descubra como transformar seus resultados",
                  title: selectedCopy?.headline || draft.campaign_name,
                  call_to_action: { type: ctaType, value: { link: linkUrl } },
                  link_description: selectedCopy?.headline || draft.campaign_name,
                },
              },
            };
          } else {
            // Fallback to picture URL if video upload returns no ID
            creativeSpec = buildCreativeSpec(url);
          }
        } catch (e) {
          console.error("Video upload error:", e);
          // Fallback to picture approach
          creativeSpec = buildCreativeSpec(url);
        }
      } else {
        creativeSpec = buildCreativeSpec(url);
      }

      const adBody = {
        name: adName,
        adset_id: metaAdSetId,
        status: "PAUSED",
        access_token: accessToken,
        creative: creativeSpec,
      };

      console.log(`Creating ad ${adIndex + 1}:`, JSON.stringify(adBody));

      // Retry logic for video processing
      const maxRetries = (url && isVideoUrl(url)) ? 3 : 1;
      let adData: any;

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        if (attempt > 0) {
          console.log(`Retry ${attempt} for ad ${adIndex + 1}, waiting 10s...`);
          await new Promise(r => setTimeout(r, 10000));
        }

        const adRes = await fetch(`${META_API}/${adAccountId}/ads`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(adBody),
        });
        adData = await adRes.json();

        if (!adData.error) break;

        const errMsg = metaError(adData).toLowerCase();
        if (attempt < maxRetries - 1 && (errMsg.includes("processing") || errMsg.includes("video"))) {
          continue;
        }
      }

      if (adData.error) {
        return { success: false, error: metaError(adData) };
      }

      return { success: true, adId: adData.id };
    }

    // Create ads: if no URLs, create one ad without media
    const urlsToProcess = allUrls.length > 0 ? allUrls : [null];
    const adResults: { success: boolean; adId?: string; error?: string; url?: string | null }[] = [];
    const metaAdIds: string[] = [];

    for (let i = 0; i < urlsToProcess.length; i++) {
      const url = urlsToProcess[i];
      steps.push(`Criando anúncio ${i + 1}/${urlsToProcess.length}...`);
      const result = await createAd(url, i);
      adResults.push({ ...result, url });

      if (result.success && result.adId) {
        metaAdIds.push(result.adId);
        steps.push(`Anúncio ${i + 1} criado: ${result.adId}`);
      } else {
        steps.push(`Anúncio ${i + 1} falhou: ${result.error}`);
      }
    }

    const successCount = adResults.filter(r => r.success).length;
    const failCount = adResults.filter(r => !r.success).length;

    if (successCount === 0) {
      // All ads failed — rollback
      await rollbackCampaign();
      const errorMsg = adResults.map(r => r.error).filter(Boolean).join(" | ");
      await supabase.from("campaign_drafts").update({
        status: "failed",
        error_message: `Todos os anúncios falharam: ${errorMsg} | Rollback executado.`,
      }).eq("id", draftId);
      return fail(`Todos os anúncios falharam: ${errorMsg}`, { step: "ad", meta_campaign_id: metaCampaignId, meta_adset_id: metaAdSetId, steps, rollback: true });
    }

    // At least some ads succeeded
    await supabase.from("campaign_drafts").update({
      status: "published",
      meta_ad_id: metaAdIds[0] || null,
      error_message: failCount > 0 ? `${failCount} anúncio(s) falharam de ${urlsToProcess.length}` : null,
    }).eq("id", draftId);

    return new Response(JSON.stringify({
      success: true,
      meta_campaign_id: metaCampaignId,
      meta_adset_id: metaAdSetId,
      meta_ad_ids: metaAdIds,
      meta_ad_id: metaAdIds[0] || null,
      total_ads: successCount,
      failed_ads: failCount,
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
