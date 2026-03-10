import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const META_API = "https://graph.facebook.com/v23.0";

function metaError(data: any): string {
  return data?.error?.error_user_msg || data?.error?.message || "Erro desconhecido da Meta API";
}

function fail(msg: string, extra: Record<string, unknown> = {}) {
  return new Response(JSON.stringify({ error: msg, ...extra }), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ─── Auto-create remarketing audiences ───
async function createPixelAudience(
  adAccountId: string, accessToken: string, pixelId: string,
  name: string, eventType: string, retentionDays: number
): Promise<{ id: string } | null> {
  const payload = {
    name,
    rule: JSON.stringify({
      inclusions: {
        operator: "or",
        rules: [{
          event_sources: [{ id: pixelId, type: "pixel" }],
          retention_seconds: retentionDays * 86400,
          filter: {
            operator: "and",
            filters: [{ field: "event", operator: "eq", value: eventType }],
          },
        }],
      },
    }),
    access_token: accessToken,
  };

  const res = await fetch(`${META_API}/${adAccountId}/customaudiences`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (data.error) {
    console.warn(`Audience creation failed (${eventType}):`, data.error.message);
    return null;
  }
  return { id: data.id };
}

// ─── Inline AI copy generation aligned with dossier ───
async function generateAlignedCopy(
  profileId: string, campaignName: string, objective: string, targetingNotes: string | null
): Promise<{ headline: string; primary_text: string } | null> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    const { data: profile } = await sb
      .from("client_profiles")
      .select("name, avatar_dossier, product_context, cpa_meta, ticket_medio")
      .eq("id", profileId)
      .single();

    if (!profile || (!profile.avatar_dossier && !profile.product_context)) return null;

    let context = `Cliente: ${profile.name}\nCPA Meta: R$${profile.cpa_meta}\nTicket Médio: R$${profile.ticket_medio}\n`;
    if (profile.avatar_dossier) context += `\nDOSSIÊ DO AVATAR:\n${profile.avatar_dossier}\n`;
    if (profile.product_context) context += `\nCONTEXTO DO PRODUTO:\n${profile.product_context}\n`;

    const prompt = `Gere UM anúncio para a campanha "${campaignName}" com objetivo ${objective}.
${targetingNotes ? `Contexto de segmentação: ${targetingNotes}` : ""}

REGRAS OBRIGATÓRIAS:
- A copy é um ANÚNCIO para o CONSUMIDOR FINAL (o avatar descrito no dossiê).
- A marca fala DIRETAMENTE com o consumidor sobre o PRODUTO/SERVIÇO dela.
- Use EXCLUSIVAMENTE o dossiê do avatar e o contexto do produto abaixo.
- NÃO invente dados, métricas ou depoimentos fictícios.
- Use StoryBrand: o CONSUMIDOR é o herói, a MARCA é o guia.
- Use Hormozi Value Equation: resultado concreto para o CONSUMIDOR.
- NUNCA mencione "Instagram", "posts", "algoritmo", "seguidores", "engajamento" — a menos que o produto SEJA sobre marketing digital.
- Use o TOM DE VOZ descrito no dossiê do avatar.
- Headline: máximo 40 caracteres, gancho forte que fale da DOR ou DESEJO do consumidor.
- Primary Text: máximo 125 palavras, foco em conversão, termine com CTA claro.

${context}

Responda APENAS em JSON: {"headline":"...","primary_text":"..."}`;

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return null;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Você é um copywriter de resposta direta sênior escrevendo anúncios que falam DIRETAMENTE com o consumidor final. A copy deve soar como a MARCA falando com seu CLIENTE IDEAL, não como um gestor de tráfego. Responda APENAS em JSON válido." },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || "";
    const jsonMatch = text.match(/\{[\s\S]*"headline"[\s\S]*"primary_text"[\s\S]*\}/);
    if (!jsonMatch) return null;
    return JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.warn("AI copy generation failed:", e);
    return null;
  }
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

    const {
      profileId, campaign_name, objective, daily_budget, targeting_notes,
      use_catalog, destination_url, creative_url, headline, primary_text,
      cta_type, cta, audience_id, audience_ids, excluded_audience_ids,
      remarketing, remarketing_days,
    } = body;
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

    // ─── Remarketing: auto-create audiences ───
    const includeIds: string[] = audience_ids?.length ? [...audience_ids] : (audience_id ? [audience_id] : []);
    const excludeIds: string[] = excluded_audience_ids ? [...excluded_audience_ids] : [];

    if (remarketing && pixelId && pixelId.trim() !== "") {
      const days = remarketing_days || 15;

      const cartAudience = await createPixelAudience(
        adAccountId, accessToken, pixelId,
        `Remarketing - AddToCart ${days}d - ${campaign_name}`,
        "AddToCart", days
      );
      if (cartAudience) {
        includeIds.push(cartAudience.id);
        steps.push(`✅ Público AddToCart ${days}d: ${cartAudience.id}`);
      }

      const purchaseAudience = await createPixelAudience(
        adAccountId, accessToken, pixelId,
        `Exclusão - Compradores 30d - ${campaign_name}`,
        "Purchase", 30
      );
      if (purchaseAudience) {
        excludeIds.push(purchaseAudience.id);
        steps.push(`✅ Exclusão Compradores 30d: ${purchaseAudience.id}`);
      }
    }

    // ─── AI Copy Generation (if no explicit copy provided) ───
    let finalHeadline = headline;
    let finalPrimaryText = primary_text;

    if (!finalHeadline || !finalPrimaryText) {
      const aiCopy = await generateAlignedCopy(profileId, campaign_name, obj, targeting_notes);
      if (aiCopy) {
        finalHeadline = finalHeadline || aiCopy.headline;
        finalPrimaryText = finalPrimaryText || aiCopy.primary_text;
        steps.push("✅ Copy gerada pela IA (alinhada ao dossiê)");
      }
    }

    finalHeadline = finalHeadline || campaign_name;
    finalPrimaryText = finalPrimaryText || targeting_notes || "Descubra como transformar seus resultados";

    // Create draft record
    const { data: draft, error: draftErr } = await supabase.from("campaign_drafts").insert({
      user_id: user.id, profile_id: profileId, campaign_name, objective: obj,
      daily_budget: budget, status: "approved",
      copy_options: [{ headline: finalHeadline, primary_text: finalPrimaryText, cta: cta_type || cta || "LEARN_MORE" }],
      targeting_suggestion: { notes: targeting_notes, remarketing, includeIds, excludeIds },
    }).select().single();

    if (draftErr || !draft) return fail("Erro ao criar rascunho");

    // ─── Step 1: Campaign ───
    const campaignForm = new URLSearchParams();
    campaignForm.append("name", campaign_name);
    campaignForm.append("objective", obj);
    campaignForm.append("status", "PAUSED");
    campaignForm.append("special_ad_categories", "[]");
    campaignForm.append("access_token", accessToken);

    const campaignRes = await fetch(`${META_API}/${adAccountId}/campaigns`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: campaignForm.toString(),
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

    if (includeIds.length > 0) {
      targetingObj.custom_audiences = includeIds.map((id: string) => ({ id }));
    }
    if (excludeIds.length > 0) {
      targetingObj.excluded_custom_audiences = excludeIds.map((id: string) => ({ id }));
    }

    const optimizationGoal = obj === "OUTCOME_LEADS" ? "LEAD_GENERATION"
      : obj === "OUTCOME_SALES" ? "OFFSITE_CONVERSIONS"
      : obj === "OUTCOME_TRAFFIC" ? "LANDING_PAGE_VIEWS"
      : obj === "OUTCOME_ENGAGEMENT" ? "POST_ENGAGEMENT"
      : obj === "OUTCOME_AWARENESS" ? "REACH" : "LINK_CLICKS";

    const adSetForm = new URLSearchParams();
    adSetForm.append("name", `${campaign_name} - Conjunto Auto`);
    adSetForm.append("campaign_id", metaCampaignId);
    adSetForm.append("daily_budget", String(Math.round(budget * 100)));
    adSetForm.append("billing_event", "IMPRESSIONS");
    adSetForm.append("optimization_goal", optimizationGoal);
    adSetForm.append("bid_strategy", "LOWEST_COST_WITHOUT_CAP");
    adSetForm.append("targeting", JSON.stringify(targetingObj));
    adSetForm.append("is_adset_budget_sharing_enabled", "false");
    adSetForm.append("status", "PAUSED");
    adSetForm.append("access_token", accessToken);

    if (isConversion) {
      adSetForm.append("promoted_object", JSON.stringify({
        pixel_id: pixelId,
        custom_event_type: obj === "OUTCOME_LEADS" ? "LEAD" : "PURCHASE",
      }));
    }

    const adSetRes = await fetch(`${META_API}/${adAccountId}/adsets`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: adSetForm.toString(),
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
    const resolvedCta = cta_type || cta || "LEARN_MORE";
    const linkData: Record<string, unknown> = {
      message: finalPrimaryText,
      link: linkUrl,
      name: finalHeadline,
      call_to_action: { type: resolvedCta, value: { link: linkUrl } },
    };
    if (creative_url) {
      linkData.picture = creative_url;
    }

    const adForm = new URLSearchParams();
    adForm.append("name", `${campaign_name} - Anúncio Auto`);
    adForm.append("adset_id", metaAdSetId);
    adForm.append("status", "PAUSED");
    adForm.append("access_token", accessToken);
    adForm.append("creative", JSON.stringify({
      object_story_spec: {
        page_id: String(pageId),
        link_data: linkData,
      },
    }));

    const adRes = await fetch(`${META_API}/${adAccountId}/ads`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: adForm.toString(),
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
      details: {
        campaign_name, meta_campaign_id: metaCampaignId,
        meta_adset_id: metaAdSetId, meta_ad_id: metaAdId,
        objective: obj, daily_budget: budget,
        remarketing: !!remarketing,
        audiences_included: includeIds,
        audiences_excluded: excludeIds,
      },
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
