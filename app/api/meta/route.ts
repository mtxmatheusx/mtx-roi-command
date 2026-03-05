import { NextRequest, NextResponse } from "next/server";

const META_BASE = "https://graph.facebook.com/v21.0";

/* ── Helpers ──────────────────────────────────────────────────────────────── */

function normalizeAccountId(id: string): string {
  return `act_${id.trim().replace(/^act_/i, "")}`;
}

/** GET helper — query params only, no body */
async function metaGet(path: string) {
  const res  = await fetch(`${META_BASE}${path}`);
  const data = await res.json();
  if (!res.ok || data.error) throw metaError(data, res.status);
  return data;
}

/** POST helper — JSON body, token as query param (Meta accepts both) */
async function metaPost(path: string, token: string, body: Record<string, unknown>) {
  const res  = await fetch(
    `${META_BASE}${path}?access_token=${encodeURIComponent(token)}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
  );
  const data = await res.json();
  if (!res.ok || data.error) throw metaError(data, res.status);
  return data;
}

/** Builds a rich error message with Meta's error code + user message */
function metaError(data: any, status: number): Error {
  const e    = data?.error ?? {};
  const msg  = e.error_user_msg || e.message || `Meta API error ${status}`;
  const code = e.code       ? ` [#${e.code}]`    : "";
  const sub  = e.error_subcode ? `/${e.error_subcode}` : "";
  return new Error(`${msg}${code}${sub}`);
}

/**
 * Returns the correct optimization_goal + billing_event + destination_type for each objective.
 * Meta API v21.0 requires specific combinations — mismatches cause "Invalid parameter".
 *
 * OUTCOME_SALES   → OFFSITE_CONVERSIONS / IMPRESSIONS / WEBSITE  (needs pixel)
 *                   fallback: LINK_CLICKS / LINK_CLICKS / WEBSITE (no pixel)
 * OUTCOME_TRAFFIC → LINK_CLICKS / LINK_CLICKS / WEBSITE
 * OUTCOME_AWARENESS → REACH / IMPRESSIONS  (no destination_type)
 * OUTCOME_LEADS   → LEAD_GENERATION / IMPRESSIONS / INSTANT_FORMS
 */
function adsetOptimParams(
  objective: string,
  pixelId?: string
): Record<string, unknown> {
  switch (objective) {
    case "OUTCOME_TRAFFIC":
      return {
        optimization_goal: "LINK_CLICKS",
        billing_event:     "LINK_CLICKS",
        destination_type:  "WEBSITE",          // ✅ obrigatório para tráfego web
      };

    case "OUTCOME_AWARENESS":
      return {
        optimization_goal: "REACH",
        billing_event:     "IMPRESSIONS",
        // destination_type não se aplica a awareness
      };

    case "OUTCOME_LEADS":
      return {
        optimization_goal: "LEAD_GENERATION",
        billing_event:     "IMPRESSIONS",
        destination_type:  "INSTANT_FORMS",    // ✅ formulário instantâneo Meta
      };

    case "OUTCOME_SALES":
    default:
      if (pixelId) {
        return {
          optimization_goal: "OFFSITE_CONVERSIONS",
          billing_event:     "IMPRESSIONS",
          destination_type:  "WEBSITE",          // ✅ obrigatório com pixel
          promoted_object:   { pixel_id: pixelId, custom_event_type: "PURCHASE" },
        };
      }
      // Sem pixel → usa LINK_CLICKS como fallback seguro
      return {
        optimization_goal: "LINK_CLICKS",
        billing_event:     "LINK_CLICKS",
        destination_type:  "WEBSITE",
      };
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   GET  /api/meta
   ?type=campaigns  → campanhas + insights
   ?type=ads        → anúncios com creative thumbnails
════════════════════════════════════════════════════════════════════════════ */
export async function GET(req: NextRequest) {
  const sp           = new URL(req.url).searchParams;
  const token        = sp.get("token");
  const rawAccountId = sp.get("accountId");
  const type         = sp.get("type") || "campaigns";
  const since        = sp.get("since") || new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const until        = sp.get("until") || new Date().toISOString().slice(0, 10);

  if (!token || !rawAccountId)
    return NextResponse.json({ error: "token e accountId são obrigatórios" }, { status: 400 });

  const accountId = normalizeAccountId(rawAccountId);

  /* ── type=ads ─────────────────────────────────────────────────────────── */
  if (type === "ads") {
    try {
      const timeRange  = encodeURIComponent(JSON.stringify({ since, until }));
      const adsMetaRes = await metaGet(
        `/${accountId}/ads?fields=id,name,status,effective_status,adset_id,campaign_id,creative{id,thumbnail_url,title,body}&limit=100&access_token=${token}`
      );
      const adsMeta: any[] = adsMetaRes.data || [];

      const adsInsRes = await metaGet(
        `/${accountId}/insights?fields=ad_id,spend,impressions,clicks,ctr,cpc,actions,action_values&time_range=${timeRange}&level=ad&limit=100&access_token=${token}`
      ).catch(() => ({ data: [] }));

      const insMap: Record<string, any> = {};
      for (const ins of (adsInsRes.data || [])) insMap[ins.ad_id] = ins;

      const ads = adsMeta.map((ad: any) => {
        const ins           = insMap[ad.id] || {};
        const spend         = parseFloat(ins.spend || "0");
        const purchaseValue = parseFloat(ins.action_values?.find((a: any) => a.action_type === "purchase")?.value || "0");
        return {
          id:              ad.id,
          name:            ad.name,
          status:          ad.status,
          effectiveStatus: ad.effective_status,
          adsetId:         ad.adset_id,
          campaignId:      ad.campaign_id,
          spend,
          impressions: parseInt(ins.impressions || "0"),
          clicks:      parseInt(ins.clicks      || "0"),
          ctr:         parseFloat(ins.ctr       || "0"),
          cpc:         parseFloat(ins.cpc       || "0"),
          purchases:   parseFloat(ins.actions?.find((a: any) => a.action_type === "purchase")?.value || "0"),
          roas:        spend > 0 ? purchaseValue / spend : 0,
          creative: ad.creative ? {
            id:           ad.creative.id,
            thumbnailUrl: ad.creative.thumbnail_url || null,
            title:        ad.creative.title         || null,
            body:         ad.creative.body          || null,
          } : null,
        };
      });

      return NextResponse.json({ ads });
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 });
    }
  }

  /* ── type=campaigns (default) ─────────────────────────────────────────── */
  try {
    const campaignsRes = await metaGet(
      `/${accountId}/campaigns?fields=id,name,status,effective_status,daily_budget,lifetime_budget&limit=50&access_token=${token}`
    );
    const campaigns: any[] = campaignsRes.data || [];

    const timeRange   = encodeURIComponent(JSON.stringify({ since, until }));
    const insightsRes = await metaGet(
      `/${accountId}/insights?fields=campaign_id,spend,impressions,clicks,ctr,cpm,cpc,actions,action_values&time_range=${timeRange}&level=campaign&limit=50&access_token=${token}`
    );
    const insightMap: Record<string, any> = {};
    for (const ins of (insightsRes.data || [])) insightMap[ins.campaign_id] = ins;

    const creativeRes = await metaGet(
      `/${accountId}/insights?fields=ad_id,ad_name,spend,impressions,clicks,ctr,cpc,actions,action_values,creative{thumbnail_url}&time_range=${timeRange}&level=ad&limit=30&access_token=${token}`
    ).catch(() => ({ data: [] }));

    const creatives = (creativeRes.data || []).map((ad: any) => {
      const pv = parseFloat(ad.action_values?.find((a: any) => a.action_type === "purchase")?.value || "0");
      const sp = parseFloat(ad.spend || "0");
      return {
        adName:        ad.ad_name,
        spend:         sp,
        impressions:   parseInt(ad.impressions || "0"),
        clicks:        parseInt(ad.clicks      || "0"),
        ctr:           parseFloat(ad.ctr       || "0"),
        cpc:           parseFloat(ad.cpc       || "0"),
        purchases:     parseFloat(ad.actions?.find((a: any) => a.action_type === "purchase")?.value || "0"),
        purchaseValue: pv,
        roas:          sp > 0 ? pv / sp : 0,
        thumbnailUrl:  ad.creative?.thumbnail_url || null,
      };
    });

    const merged = campaigns.map((c: any) => {
      const ins           = insightMap[c.id] || {};
      const spend         = parseFloat(ins.spend || "0");
      const purchaseValue = parseFloat(ins.action_values?.find((a: any) => a.action_type === "purchase")?.value || "0");
      const purchases     = parseFloat(ins.actions?.find((a: any) => a.action_type === "purchase")?.value || "0");
      const roas          = spend > 0 ? purchaseValue / spend : 0;
      return {
        id:              c.id,
        name:            c.name,
        status:          c.status,
        effectiveStatus: c.effective_status,
        dailyBudget:     c.daily_budget    ? parseInt(c.daily_budget)    / 100 : null,
        lifetimeBudget:  c.lifetime_budget ? parseInt(c.lifetime_budget) / 100 : null,
        spend,
        impressions: parseInt(ins.impressions || "0"),
        clicks:      parseInt(ins.clicks      || "0"),
        ctr:         parseFloat(ins.ctr       || "0"),
        cpm:         parseFloat(ins.cpm       || "0"),
        cpc:         parseFloat(ins.cpc       || "0"),
        purchases, purchaseValue, roas,
        cpa:    purchases > 0 ? spend / purchases : 0,
        profit: purchaseValue - spend,
      };
    });

    return NextResponse.json({ campaigns: merged, creatives });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   POST /api/meta
   Actions: pause | activate | scale | duplicate
            pause_ad | activate_ad
            create_campaign
════════════════════════════════════════════════════════════════════════════ */
export async function POST(req: NextRequest) {
  const body             = await req.json();
  const { token, action } = body;

  if (!token || !action)
    return NextResponse.json({ error: "token e action são obrigatórios" }, { status: 400 });

  try {

    /* ── pause_ad / activate_ad ─────────────────────────────────────────── */
    if (action === "pause_ad" || action === "activate_ad") {
      const { adId } = body;
      if (!adId) return NextResponse.json({ error: "adId obrigatório" }, { status: 400 });
      const status = action === "pause_ad" ? "PAUSED" : "ACTIVE";
      await metaPost(`/${adId}`, token, { status });
      return NextResponse.json({ success: true, message: action === "pause_ad" ? "Anúncio pausado" : "Anúncio ativado" });
    }

    /* ── create_campaign ────────────────────────────────────────────────── */
    if (action === "create_campaign") {
      const {
        name, objective, dailyBudget, creativeId,
        accountId: rawAcc, countryCode = "BR", pixelId,
      } = body;

      if (!name || !objective || !dailyBudget || !creativeId || !rawAcc)
        return NextResponse.json({ error: "name, objective, dailyBudget, creativeId e accountId são obrigatórios" }, { status: 400 });

      const accountId = normalizeAccountId(rawAcc);

      console.log(`[CREATE_CAMPAIGN] Iniciando: ${name} | Objetivo: ${objective} | Pixel: ${pixelId || 'não'}`);

      // ── Passo 1: Campaign ────────────────────────────────────────────────
      // special_ad_categories DEVE ser array vazio [] — não enviar como string
      // buying_type AUCTION é padrão mas deve ser explícito em v21.0
      const campPayload = {
        name,
        objective,
        status:                "PAUSED",
        buying_type:           "AUCTION",  // ✅ explícito evita ambiguidade
        special_ad_categories: [],         // ✅ array JSON correto
      };
      console.log(`[STEP 1] POST /${accountId}/campaigns`, JSON.stringify(campPayload));
      const camp = await metaPost(`/${accountId}/campaigns`, token, campPayload);
      const campaignId = camp.id as string;
      console.log(`[STEP 1] ✅ Campanha criada: ${campaignId}`);

      // ── Passo 2: Ad Set ──────────────────────────────────────────────────
      // optimization_goal + billing_event variam por objetivo
      // start_time como Unix timestamp (sem milliseconds)
      const optimParams  = adsetOptimParams(objective, pixelId);
      const budgetCents  = Math.round(parseFloat(dailyBudget) * 100);
      const startTimeUnix = Math.floor(Date.now() / 1000);   // ✅ Unix timestamp

      const adsetPayload = {
        name:         `${name} - Ad Set`,
        campaign_id:  campaignId,
        daily_budget: budgetCents,
        status:       "PAUSED",
        start_time:   startTimeUnix,                          // ✅ Unix, não ISO
        targeting:    { geo_locations: { countries: [countryCode] } }, // ✅ objeto, não string
        is_adset_budget_sharing_enabled: false,               // ✅ obrigatório [#100]/4834011
        ...optimParams,                                        // ✅ goal + billing corretos
      };
      console.log(`[STEP 2] POST /${accountId}/adsets`, JSON.stringify(adsetPayload));
      console.log(`[STEP 2] Optimization params:`, JSON.stringify(optimParams));
      const adset = await metaPost(`/${accountId}/adsets`, token, adsetPayload);
      const adsetId = adset.id as string;
      console.log(`[STEP 2] ✅ Ad Set criado: ${adsetId}`);

      // ── Passo 3: Ad ──────────────────────────────────────────────────────
      // creative DEVE ser objeto JSON — não string encoded
      const adPayload = {
        name:     `${name} - Ad`,
        adset_id: adsetId,
        status:   "PAUSED",
        creative: { creative_id: creativeId },                // ✅ objeto JSON real
      };
      console.log(`[STEP 3] POST /${accountId}/ads`, JSON.stringify(adPayload));
      const ad = await metaPost(`/${accountId}/ads`, token, adPayload);
      const adId = ad.id as string;
      console.log(`[STEP 3] ✅ Anúncio criado: ${adId}`);

      return NextResponse.json({
        success: true, campaignId, adsetId, adId,
        usedPixel: !!pixelId,
        optimizationGoal: (optimParams as any).optimization_goal,
        message: "Campanha criada com sucesso!",
      });
    }

    /* ── Campaign-level actions ─────────────────────────────────────────── */
    const { campaignId, accountId: rawAcc2, percentage } = body;
    if (!campaignId)
      return NextResponse.json({ error: "campaignId obrigatório" }, { status: 400 });

    const accountId = rawAcc2 ? normalizeAccountId(rawAcc2) : "";

    if (action === "pause") {
      await metaPost(`/${campaignId}`, token, { status: "PAUSED" });
      return NextResponse.json({ success: true, message: "Campanha pausada" });
    }

    if (action === "activate") {
      await metaPost(`/${campaignId}`, token, { status: "ACTIVE" });
      return NextResponse.json({ success: true, message: "Campanha ativada" });
    }

    if (action === "scale") {
      const campaign = await metaGet(`/${campaignId}?fields=daily_budget,lifetime_budget&access_token=${token}`);
      const pct      = (percentage || 20) / 100;
      if (campaign.daily_budget) {
        const newBudget = Math.round(parseInt(campaign.daily_budget) * (1 + pct));
        await metaPost(`/${campaignId}`, token, { daily_budget: newBudget });
        return NextResponse.json({ success: true, newBudget: newBudget / 100, message: `Budget escalado +${percentage}%` });
      }
      if (campaign.lifetime_budget) {
        const newBudget = Math.round(parseInt(campaign.lifetime_budget) * (1 + pct));
        await metaPost(`/${campaignId}`, token, { lifetime_budget: newBudget });
        return NextResponse.json({ success: true, newBudget: newBudget / 100, message: `Budget escalado +${percentage}%` });
      }
      return NextResponse.json({ error: "Campanha sem budget configurado" }, { status: 400 });
    }

    if (action === "duplicate") {
      const result = await metaPost(`/${campaignId}/copies`, token, { deep_copy: true });
      return NextResponse.json({ success: true, newCampaignId: result.copied_campaign_id, message: "Campanha duplicada" });
    }

    return NextResponse.json({ error: "Ação inválida" }, { status: 400 });

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
