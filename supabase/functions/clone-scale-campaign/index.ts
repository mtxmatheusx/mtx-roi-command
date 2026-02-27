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

    // Fetch original draft with profile
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

    if (draft.status !== "published") {
      return new Response(JSON.stringify({ error: "Apenas campanhas publicadas podem ser clonadas." }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const profile = draft.client_profiles;
    const accessToken = profile?.meta_access_token || Deno.env.get("META_ACCESS_TOKEN");
    const adAccountId = profile?.ad_account_id;

    if (!accessToken || !adAccountId) {
      return new Response(JSON.stringify({ error: "Token ou Ad Account ID não configurado." }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!draft.meta_campaign_id || !draft.meta_adset_id || !draft.meta_ad_id) {
      return new Response(JSON.stringify({ error: "IDs Meta incompletos. Não é possível clonar." }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const steps: string[] = [];

    // Step 1: Read original AdSet to get budget and targeting
    const adSetRes = await fetch(`${META_API}/${draft.meta_adset_id}?fields=name,daily_budget,targeting,optimization_goal,billing_event,bid_strategy,promoted_object,targeting_optimization&access_token=${accessToken}`);
    const adSetData = await adSetRes.json();
    if (adSetData.error) {
      return new Response(JSON.stringify({ error: `Erro ao ler AdSet original: ${metaError(adSetData)}` }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 2: Read original Ad to get creative
    const adRes = await fetch(`${META_API}/${draft.meta_ad_id}?fields=name,creative&access_token=${accessToken}`);
    const adData = await adRes.json();
    if (adData.error) {
      return new Response(JSON.stringify({ error: `Erro ao ler Ad original: ${metaError(adData)}` }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 3: Create new campaign with scaled name
    const newCampaignName = `[SCALED 🚀] - ${draft.campaign_name}`;
    const campaignCreateRes = await fetch(`${META_API}/${adAccountId}/campaigns`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newCampaignName,
        objective: draft.objective,
        status: "PAUSED",
        special_ad_categories: [],
        is_adset_budget_sharing_enabled: false,
        access_token: accessToken,
      }),
    });

    const campaignCreateData = await campaignCreateRes.json();
    if (campaignCreateData.error) {
      return new Response(JSON.stringify({ error: `Erro ao criar campanha: ${metaError(campaignCreateData)}` }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const newCampaignId = campaignCreateData.id;
    steps.push(`Nova campanha: ${newCampaignId}`);

    // Step 4: Create new AdSet with +20% budget
    const originalBudget = parseInt(adSetData.daily_budget || "0", 10);
    const scaledBudget = Math.round(originalBudget * 1.20);

    const newAdSetBody: Record<string, unknown> = {
      name: `${newCampaignName} - Conjunto 01`,
      campaign_id: newCampaignId,
      daily_budget: scaledBudget,
      billing_event: adSetData.billing_event || "IMPRESSIONS",
      optimization_goal: adSetData.optimization_goal || "LINK_CLICKS",
      bid_strategy: adSetData.bid_strategy || "LOWEST_COST_WITHOUT_CAP",
      targeting: adSetData.targeting || { geo_locations: { countries: ["BR"] } },
      status: "PAUSED",
      access_token: accessToken,
    };

    if (adSetData.promoted_object) {
      newAdSetBody.promoted_object = adSetData.promoted_object;
    }
    if (adSetData.targeting_optimization) {
      newAdSetBody.targeting_optimization = adSetData.targeting_optimization;
    }

    const newAdSetRes = await fetch(`${META_API}/${adAccountId}/adsets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newAdSetBody),
    });

    const newAdSetData = await newAdSetRes.json();
    if (newAdSetData.error) {
      // Rollback campaign
      try { await fetch(`${META_API}/${newCampaignId}?access_token=${accessToken}`, { method: "DELETE" }); } catch {}
      return new Response(JSON.stringify({ error: `Erro no AdSet: ${metaError(newAdSetData)}. Campanha apagada.` }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const newAdSetId = newAdSetData.id;
    steps.push(`Novo AdSet: ${newAdSetId} (budget: ${scaledBudget})`);

    // Step 5: Create new Ad reusing creative
    const newAdBody: Record<string, unknown> = {
      name: `${newCampaignName} - Anúncio 01`,
      adset_id: newAdSetId,
      status: "PAUSED",
      access_token: accessToken,
    };

    if (adData.creative?.id) {
      newAdBody.creative = { creative_id: adData.creative.id };
    } else {
      // Rollback
      try { await fetch(`${META_API}/${newCampaignId}?access_token=${accessToken}`, { method: "DELETE" }); } catch {}
      return new Response(JSON.stringify({ error: "Creative ID não encontrado no anúncio original." }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const newAdRes = await fetch(`${META_API}/${adAccountId}/ads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newAdBody),
    });

    const newAdData = await newAdRes.json();
    if (newAdData.error) {
      // Rollback
      try { await fetch(`${META_API}/${newCampaignId}?access_token=${accessToken}`, { method: "DELETE" }); } catch {}
      return new Response(JSON.stringify({ error: `Erro no Ad: ${metaError(newAdData)}. Campanha apagada.` }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const newAdId = newAdData.id;
    steps.push(`Novo Ad: ${newAdId}`);

    // Step 6: Save to Supabase
    const scaledDailyBudget = Math.round((draft.daily_budget || 50) * 1.20 * 100) / 100;
    const { data: newDraft, error: insertError } = await supabase.from("campaign_drafts").insert({
      user_id: userId,
      profile_id: draft.profile_id,
      status: "published",
      objective: draft.objective,
      campaign_name: newCampaignName,
      daily_budget: scaledDailyBudget,
      copy_options: draft.copy_options,
      targeting_suggestion: draft.targeting_suggestion,
      ai_reasoning: `Clonada de "${draft.campaign_name}" com +20% de orçamento.`,
      andromeda_targeting: draft.andromeda_targeting,
      meta_campaign_id: newCampaignId,
      meta_adset_id: newAdSetId,
      meta_ad_id: newAdId,
    }).select("*").single();

    if (insertError) {
      return new Response(JSON.stringify({ error: `Campanha criada na Meta mas erro ao salvar: ${insertError.message}`, meta_campaign_id: newCampaignId }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      meta_campaign_id: newCampaignId,
      meta_adset_id: newAdSetId,
      meta_ad_id: newAdId,
      new_budget: scaledDailyBudget,
      original_budget: draft.daily_budget,
      steps,
      draft: newDraft,
      ads_manager_url: `https://business.facebook.com/adsmanager/manage/campaigns?act=${adAccountId.replace("act_", "")}&selected_campaign_ids=${newCampaignId}`,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("clone-scale-campaign error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
