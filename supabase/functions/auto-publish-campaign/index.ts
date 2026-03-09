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

function fail(msg: string, extra: Record<string, unknown> = {}) {
  return new Response(JSON.stringify({ error: msg, ...extra }), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return fail("Não autorizado");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return fail("Não autorizado");

    const rawBody = await req.text();
    let body: any;
    try { body = JSON.parse(rawBody); } catch { return fail("JSON inválido"); }

    const { profileId, campaign_name, objective, daily_budget, targeting_notes, use_catalog, destination_url, creative_url, headline, cta_type, audience_id, audience_ids, excluded_audience_ids } = body;
    if (!profileId || !campaign_name) return fail("profileId e campaign_name obrigatórios");

    // Fetch profile
    const { data: profile, error: profileError } = await supabase
      .from("client_profiles")
      .select("*")
      .eq("id", profileId)
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) return fail("Perfil não encontrado");

    const accessToken = profile.meta_access_token || Deno.env.get("META_ACCESS_TOKEN");
    if (!accessToken) return fail("Token Meta não configurado");

    const adAccountId = profile.ad_account_id;
    if (!adAccountId || adAccountId === "act_") return fail("Ad Account ID não configurado");

    const pageId = profile.page_id;
    if (!pageId || pageId.trim() === "") return fail("Page ID não configurado. Configure nas Configurações.");

    const pixelId = profile.pixel_id;
    const isConversion = ["OUTCOME_SALES", "OUTCOME_LEADS"].includes(objective || "OUTCOME_SALES");
    if (isConversion && (!pixelId || pixelId.trim() === "")) return fail("Pixel ID obrigatório para campanhas de conversão.");

    // Validate token
    const tokenCheck = await fetch(`${META_API}/me?access_token=${accessToken}&fields=id`);
    const tokenData = await tokenCheck.json();
    if (tokenData.error) return fail(`Token inválido: ${metaError(tokenData)}`);

    const steps: string[] = [];
    const obj = objective || "OUTCOME_SALES";
    const budget = daily_budget || 50;
    const linkUrl = destination_url || (Array.isArray(profile.product_urls) && profile.product_urls.length > 0 ? profile.product_urls[0] : "https://example.com");

    // Create draft record
    const { data: draft, error: draftErr } = await supabase.from("campaign_drafts").insert({
      user_id: user.id, profile_id: profileId, campaign_name, objective: obj,
      daily_budget: budget, status: "approved",
      copy_options: [{ headline: campaign_name, primary_text: targeting_notes || "", cta: "Saiba Mais" }],
      targeting_suggestion: { notes: targeting_notes },
    }).select().single();

    if (draftErr || !draft) return fail("Erro ao criar rascunho");

    // ─── Step 1: Campaign ───
    const campaignRes = await fetch(`${META_API}/${adAccountId}/campaigns`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: campaign_name, objective: obj, status: "PAUSED",
        special_ad_categories: [], access_token: accessToken,
      }),
    });
    const campaignData = await campaignRes.json();
    if (campaignData.error) {
      const msg = metaError(campaignData);
      await supabase.from("campaign_drafts").update({ status: "failed", error_message: msg }).eq("id", draft.id);
      return fail(msg, { step: "campaign" });
    }
    const metaCampaignId = campaignData.id;
    steps.push(`✅ Campanha: ${metaCampaignId}`);

    async function rollback() {
      try { await fetch(`${META_API}/${metaCampaignId}?access_token=${accessToken}`, { method: "DELETE" }); } catch {}
    }

    // ─── Step 2: AdSet ───
    const targetingObj: Record<string, unknown> = {
      geo_locations: { countries: ["BR"] },
      targeting_automation: { advantage_audience: 1 },
    };
    if (audience_id) {
      targetingObj.custom_audiences = [{ id: audience_id }];
    }

    const adSetBody: Record<string, unknown> = {
      name: `${campaign_name} - Conjunto Auto`,
      campaign_id: metaCampaignId,
      daily_budget: Math.round(budget * 100),
      billing_event: "IMPRESSIONS",
      optimization_goal: obj === "OUTCOME_LEADS" ? "LEAD_GENERATION"
        : obj === "OUTCOME_SALES" ? "OFFSITE_CONVERSIONS"
        : obj === "OUTCOME_TRAFFIC" ? "LANDING_PAGE_VIEWS"
        : obj === "OUTCOME_ENGAGEMENT" ? "POST_ENGAGEMENT"
        : obj === "OUTCOME_AWARENESS" ? "REACH" : "LINK_CLICKS",
      bid_strategy: "LOWEST_COST_WITHOUT_CAP",
      targeting: targetingObj,
      is_adset_budget_sharing_enabled: false,
      status: "PAUSED",
      access_token: accessToken,
    };

    if (isConversion) {
      adSetBody.promoted_object = {
        pixel_id: pixelId,
        custom_event_type: obj === "OUTCOME_LEADS" ? "LEAD" : "PURCHASE",
      };
    }

    const adSetRes = await fetch(`${META_API}/${adAccountId}/adsets`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(adSetBody),
    });
    const adSetData = await adSetRes.json();
    if (adSetData.error) {
      await rollback();
      const msg = metaError(adSetData);
      await supabase.from("campaign_drafts").update({ status: "failed", error_message: `${msg} | Rollback.` }).eq("id", draft.id);
      return fail(msg, { step: "adset", rollback: true });
    }
    const metaAdSetId = adSetData.id;
    steps.push(`✅ Conjunto: ${metaAdSetId}`);

    // ─── Step 3: Ad ───
    const linkData: Record<string, unknown> = {
      message: targeting_notes || "Descubra como transformar seus resultados",
      link: linkUrl,
      name: headline || campaign_name,
      call_to_action: { type: cta_type || "LEARN_MORE", value: { link: linkUrl } },
    };
    if (creative_url) {
      linkData.picture = creative_url;
    }

    const adBody = {
      name: `${campaign_name} - Anúncio Auto`,
      adset_id: metaAdSetId,
      status: "PAUSED",
      access_token: accessToken,
      creative: {
        object_story_spec: {
          page_id: String(pageId),
          link_data: linkData,
        },
      },
    };

    const adRes = await fetch(`${META_API}/${adAccountId}/ads`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(adBody),
    });
    const adData = await adRes.json();
    if (adData.error) {
      await rollback();
      const msg = metaError(adData);
      await supabase.from("campaign_drafts").update({ status: "failed", error_message: `${msg} | Rollback.` }).eq("id", draft.id);
      return fail(msg, { step: "ad", rollback: true });
    }
    const metaAdId = adData.id;
    steps.push(`✅ Anúncio: ${metaAdId}`);

    // Update draft
    await supabase.from("campaign_drafts").update({
      status: "published", meta_campaign_id: metaCampaignId,
      meta_adset_id: metaAdSetId, meta_ad_id: metaAdId,
    }).eq("id", draft.id);

    // Log
    await supabase.from("emergency_logs").insert({
      profile_id: profileId, user_id: user.id, action_type: "auto_publish",
      details: { campaign_name, meta_campaign_id: metaCampaignId, meta_adset_id: metaAdSetId, meta_ad_id: metaAdId, objective: obj, daily_budget: budget },
    });

    return new Response(JSON.stringify({
      success: true, meta_campaign_id: metaCampaignId, meta_adset_id: metaAdSetId, meta_ad_id: metaAdId, steps,
      ads_manager_url: `https://business.facebook.com/adsmanager/manage/campaigns?act=${adAccountId.replace("act_", "")}&selected_campaign_ids=${metaCampaignId}`,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("auto-publish error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
