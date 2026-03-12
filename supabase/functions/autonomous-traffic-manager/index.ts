import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface CampaignInsight {
  id: string;
  name: string;
  effective_status: string;
  daily_budget: number;
  created_time: string;
  age_days: number;
  dtd_spend: number; dtd_purchases: number; dtd_revenue: number; dtd_roas: number; dtd_cpa: number;
  wtd_spend: number; wtd_purchases: number; wtd_revenue: number; wtd_roas: number; wtd_cpa: number;
  mtd_spend: number; mtd_purchases: number; mtd_revenue: number; mtd_roas: number; mtd_cpa: number;
  ctr: number; frequency: number;
  trend: string;
}

interface Decision {
  campaign_id: string;
  adset_id?: string;
  action: string;
  reason: string;
  new_budget?: number;
  previous_budget?: number;
}

const MIN_DAYS_BEFORE_PAUSE = 4;

// ─── Helpers ───────────────────────────────────────────────

function dateStr(d: Date): string { return d.toISOString().slice(0, 10); }

function getTimeframeRanges() {
  const now = new Date();
  const today = dateStr(now);
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = new Date(now); monday.setDate(now.getDate() - mondayOffset);
  const wtdSince = dateStr(monday);
  const mtdSince = `${today.slice(0, 7)}-01`;
  return { today, wtdSince, mtdSince };
}

function parseMetrics(ins: any) {
  if (!ins) return { spend: 0, purchases: 0, revenue: 0, ctr: 0, frequency: 0 };
  const spend = parseFloat(ins.spend || "0");
  const purchases = (ins.actions || []).filter((a: any) => a.action_type === "purchase" || a.action_type === "omni_purchase").reduce((s: number, a: any) => s + parseInt(a.value || "0", 10), 0);
  const revenue = (ins.action_values || []).filter((a: any) => a.action_type === "purchase" || a.action_type === "omni_purchase").reduce((s: number, a: any) => s + parseFloat(a.value || "0"), 0);
  return { spend, purchases, revenue, ctr: parseFloat(ins.ctr || "0"), frequency: parseFloat(ins.frequency || "0") };
}

function determineTrend(dtdRoas: number, wtdRoas: number, mtdRoas: number): string {
  if (dtdRoas > wtdRoas * 1.15 && wtdRoas >= mtdRoas * 0.9) return "improving";
  if (dtdRoas < wtdRoas * 0.7 || (wtdRoas < mtdRoas * 0.7 && mtdRoas > 0)) return "declining";
  return "stable";
}

function currentHourBRT(): number { return (new Date().getUTCHours() - 3 + 24) % 24; }

function campaignAgeDays(createdTime: string): number {
  if (!createdTime) return 999; // unknown age = allow everything
  const created = new Date(createdTime);
  const now = new Date();
  return Math.floor((now.getTime() - created.getTime()) / 86400000);
}

const MIN_SAFE_BUDGET_REAIS = 1;

function normalizeCampaignRef(value: string): string {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function resolveCampaignReference(ref: string, campaigns: CampaignInsight[]): CampaignInsight | undefined {
  if (!ref) return undefined;

  const byId = campaigns.find((c) => c.id === ref);
  if (byId) return byId;

  const numericId = ref.match(/\d{12,}/)?.[0];
  if (numericId) {
    const byNumericId = campaigns.find((c) => c.id === numericId);
    if (byNumericId) return byNumericId;
  }

  const normalizedRef = normalizeCampaignRef(ref);
  if (!normalizedRef) return undefined;

  const exactName = campaigns.find((c) => normalizeCampaignRef(c.name) === normalizedRef);
  if (exactName) return exactName;

  return campaigns.find((c) => {
    const normalizedName = normalizeCampaignRef(c.name);
    return normalizedName.includes(normalizedRef) || normalizedRef.includes(normalizedName);
  });
}

function parseBudgetToReais(value: string | number | null | undefined): number {
  const cents = typeof value === "number" ? value : parseInt(String(value ?? "0"), 10);
  if (!Number.isFinite(cents) || cents <= 0) return 0;
  return cents / 100;
}

function ensureValidBudget(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return MIN_SAFE_BUDGET_REAIS;
  return Math.max(MIN_SAFE_BUDGET_REAIS, Math.round(value * 100) / 100);
}

function budgetRatioForAction(action: string, currentBudget: number, newBudget?: number): number {
  if (currentBudget > 0 && newBudget && Number.isFinite(newBudget) && newBudget > 0) {
    return newBudget / currentBudget;
  }

  if (action === "reduce" || action === "pause") return 0.7;
  if (action === "scale") return 1.1;
  if (action === "rollback") return 0.85;
  return 1;
}

async function applyAdsetBudgetFallback(
  campaignId: string,
  adsets: any[],
  accessToken: string,
  ratio: number
): Promise<{ success: boolean; updated: number; attempts: number; old_avg_budget: number; new_avg_budget: number; errors: string[] }> {
  const campaignAdsets = (adsets || []).filter((a: any) => a.campaign_id === campaignId);
  const editableAdsets = campaignAdsets
    .map((a: any) => ({ adset: a, oldBudget: parseBudgetToReais(a.daily_budget) }))
    .filter((item: any) => item.oldBudget > 0);

  if (editableAdsets.length === 0) {
    return {
      success: false,
      updated: 0,
      attempts: 0,
      old_avg_budget: 0,
      new_avg_budget: 0,
      errors: ["Nenhum adset com daily_budget válido para fallback."],
    };
  }

  let updated = 0;
  let attempts = 0;
  let oldBudgetSum = 0;
  let newBudgetSum = 0;
  const errors: string[] = [];

  for (const item of editableAdsets) {
    const oldBudget = item.oldBudget;
    const newBudget = ensureValidBudget(oldBudget * ratio);

    const result = await metaApiCallWithRetry(
      `https://graph.facebook.com/v23.0/${item.adset.id}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ daily_budget: Math.round(newBudget * 100), access_token: accessToken }),
      }
    );

    attempts += result.attempts;
    if (result.success) {
      updated += 1;
      oldBudgetSum += oldBudget;
      newBudgetSum += newBudget;
    } else {
      errors.push(`adset ${item.adset.id}: ${result.error || "erro desconhecido"}`);
    }
  }

  return {
    success: updated > 0,
    updated,
    attempts,
    old_avg_budget: updated > 0 ? oldBudgetSum / updated : 0,
    new_avg_budget: updated > 0 ? newBudgetSum / updated : 0,
    errors,
  };
}

// ─── Retry wrapper for Meta API calls ──────────────────────

async function metaApiCallWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 2,
  delayMs = 3000
): Promise<{ data: any; success: boolean; attempts: number; error?: string }> {
  let lastError = "";
  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      const resp = await fetch(url, options);
      const data = await resp.json();
      if (data.error) {
        lastError = data.error.message || JSON.stringify(data.error);
        // Rate limit → wait and retry
        if (resp.status === 429 || data.error.code === 32 || data.error.code === 4) {
          console.warn(`[Retry ${attempt}/${maxRetries + 1}] Rate limited: ${lastError}`);
          if (attempt <= maxRetries) { await new Promise(r => setTimeout(r, delayMs * attempt)); continue; }
        }
        // Transient errors → retry
        if (resp.status >= 500 || data.error.is_transient) {
          console.warn(`[Retry ${attempt}/${maxRetries + 1}] Transient error: ${lastError}`);
          if (attempt <= maxRetries) { await new Promise(r => setTimeout(r, delayMs * attempt)); continue; }
        }
        return { data, success: false, attempts: attempt, error: lastError };
      }
      return { data, success: data.success !== false, attempts: attempt };
    } catch (e) {
      lastError = (e as Error).message;
      if (attempt <= maxRetries) { await new Promise(r => setTimeout(r, delayMs * attempt)); continue; }
    }
  }
  return { data: null, success: false, attempts: maxRetries + 1, error: lastError };
}

// ─── AI Decision Engine ────────────────────────────────────

async function getAIDecision(
  LOVABLE_API_KEY: string,
  profileName: string,
  profileConfig: any,
  campaigns: CampaignInsight[],
  adsets: any[],
  currentHour: number
): Promise<{ decisions: Decision[]; summary: string }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);
    const isNighttime = currentHour >= 22 || currentHour < 6;
    const isLateNight = currentHour >= 0 && currentHour < 6;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST", signal: controller.signal,
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Você é o MTX Autonomous Agent v3 — gestor de tráfego autônomo SÊNIOR com análise multi-temporal profunda.

HORA ATUAL (BRT): ${currentHour}:00
PERÍODO: ${isLateNight ? "MADRUGADA" : isNighttime ? "NOTURNO" : currentHour < 12 ? "MANHÃ" : currentHour < 18 ? "TARDE" : "INÍCIO DA NOITE"}

## 🚨 REGRA ABSOLUTA DE PROTEÇÃO: MÍNIMO ${MIN_DAYS_BEFORE_PAUSE} DIAS ATIVOS

**PROIBIÇÃO TOTAL**: Campanhas com menos de ${MIN_DAYS_BEFORE_PAUSE} dias desde a criação NÃO PODEM ser PAUSADAS sob NENHUMA circunstância.
- Campanhas jovens (< ${MIN_DAYS_BEFORE_PAUSE} dias) estão em fase de aprendizado do algoritmo da Meta.
- Pausar durante esse período DESTRÓI o aprendizado e desperdiça o investimento inicial.
- Para campanhas jovens, você PODE: otimizar budget (scale/reduce), mas NUNCA pausar.
- A idade de cada campanha é informada nos dados. VERIFIQUE antes de decidir pausar.

## FRAMEWORK DE ANÁLISE MULTI-TEMPORAL (OBRIGATÓRIO)

Para CADA campanha, cruze 3 janelas:
1. **DTD**: Performance do dia atual
2. **WTD**: Tendência semanal
3. **MTD**: Baseline mensal

### Lógica de cruzamento:
- DTD ruim + WTD/MTD bons → NÃO pausar. Flutuação pontual.
- DTD e WTD ruins + MTD bom → Degradação recente. Reduzir budget.
- 3 janelas ruins + idade >= ${MIN_DAYS_BEFORE_PAUSE} dias → PAUSAR
- 3 janelas ruins + idade < ${MIN_DAYS_BEFORE_PAUSE} dias → REDUZIR budget (nunca pausar)
- DTD excelente + WTD positivo → ESCALAR

## TRATAMENTO DE FALHAS

Se uma ação falhar na execução, o sistema fará retry automático (até 3 tentativas).
Não se preocupe com falhas transientes — o sistema é resiliente.

## REGRAS DE NEGÓCIO

### PAUSA (Guardian) — SOMENTE para campanhas com >= ${MIN_DAYS_BEFORE_PAUSE} dias:
- CPA real > CPA máximo tolerável × 1.15 → PAUSAR (cruzar WTD/MTD)
- Gasto > 50% budget + 0 conversões DTD + WTD sem tração → PAUSAR
- Frequência > 3.0 + CTR < 0.8% → PAUSAR (saturação)
- NUNCA pausar lucrativa (ROAS WTD > ${profileConfig.roas_min_escala || 2})

### ESCALA:
- ROAS WTD > ${profileConfig.roas_min_escala} + purchases WTD >= 3 + trend != declining → ESCALAR
- Incremento: +${profileConfig.limite_escala}% | Teto: R$ ${profileConfig.teto_diario_escala}

### ROLLBACK:
${profileConfig.rollback_enabled ? `- ROAS DTD ≥ ${profileConfig.rollback_roas_threshold}x + 0 vendas DTD → ROLLBACK` : "- DESATIVADO"}

### VERTICAL (Duplicação):
- Budget >= 80% teto + ROAS WTD > ${profileConfig.roas_min_escala} → DUPLICAR`,
          },
          {
            role: "user",
            content: `Perfil: ${profileName}
CPA Meta: R$ ${profileConfig.cpa_meta} | CPA Máx: R$ ${profileConfig.cpa_max_toleravel}
ROAS Min: ${profileConfig.roas_min_escala} | Teto: R$ ${profileConfig.teto_diario_escala}
Limite Escala: ${profileConfig.limite_escala}%

📊 CAMPANHAS (DTD | WTD | MTD):
${campaigns.map(c => `━━ ${c.name} [${c.trend.toUpperCase()}] ⏱ IDADE: ${c.age_days} dias ${c.age_days < MIN_DAYS_BEFORE_PAUSE ? "🛡️ PROTEGIDA (< " + MIN_DAYS_BEFORE_PAUSE + " dias — NÃO PAUSAR)" : ""}
   Budget: R$${c.daily_budget.toFixed(0)} | Freq: ${c.frequency.toFixed(1)} | CTR: ${c.ctr.toFixed(2)}%
   DTD → Spend: R$${c.dtd_spend.toFixed(0)} | Purchases: ${c.dtd_purchases} | ROAS: ${c.dtd_roas.toFixed(2)}x | CPA: R$${c.dtd_cpa.toFixed(0)}
   WTD → Spend: R$${c.wtd_spend.toFixed(0)} | Purchases: ${c.wtd_purchases} | ROAS: ${c.wtd_roas.toFixed(2)}x | CPA: R$${c.wtd_cpa.toFixed(0)}
   MTD → Spend: R$${c.mtd_spend.toFixed(0)} | Purchases: ${c.mtd_purchases} | ROAS: ${c.mtd_roas.toFixed(2)}x | CPA: R$${c.mtd_cpa.toFixed(0)}`).join("\n")}

📦 ADSETS (top 30):
${adsets.slice(0, 30).map((a: any) => {
  const ins = a.insights?.data?.[0];
  const sp = parseFloat(ins?.spend || "0");
  const rev = (ins?.action_values || []).filter((v: any) => v.action_type === "purchase" || v.action_type === "omni_purchase").reduce((s: number, v: any) => s + parseFloat(v.value || "0"), 0);
  const purch = (ins?.actions || []).filter((v: any) => v.action_type === "purchase" || v.action_type === "omni_purchase").reduce((s: number, v: any) => s + parseInt(v.value || "0", 10), 0);
  const budget = parseInt(a.daily_budget || "0", 10) / 100;
  return `   [${a.id}] ${a.name} (camp:${a.campaign_id}): budget=R$${budget} spend=R$${sp.toFixed(0)} roas=${sp > 0 ? (rev/sp).toFixed(2) : "0"} purchases=${purch}`;
}).join("\n")}

Analise com profundidade e retorne decisões. LEMBRE: campanhas com < ${MIN_DAYS_BEFORE_PAUSE} dias NÃO podem ser pausadas.`,
          },
        ],
        tools: [{
          type: "function",
          function: {
            name: "execute_decisions",
            description: "Execute autonomous campaign management decisions",
            parameters: {
              type: "object",
              properties: {
                decisions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      campaign_id: { type: "string" },
                      adset_id: { type: "string" },
                      action: { type: "string", enum: ["pause", "scale", "duplicate_scale", "rollback", "reduce", "maintain"] },
                      reason: { type: "string" },
                      new_budget: { type: "number" },
                      previous_budget: { type: "number" },
                    },
                    required: ["campaign_id", "action", "reason"],
                    additionalProperties: false,
                  },
                },
                summary: { type: "string" },
              },
              required: ["decisions", "summary"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "execute_decisions" } },
      }),
    });

    if (!resp.ok) { console.warn("AI decision failed:", resp.status); return { decisions: [], summary: "AI indisponível, usando regras estáticas." }; }
    clearTimeout(timeout);
    const data = await resp.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) return { decisions: [], summary: "AI não retornou decisões estruturadas." };
    return JSON.parse(toolCall.function.arguments);
  } catch (e) {
    console.error("AI decision error:", e);
    return { decisions: [], summary: "Erro na IA, usando regras estáticas." };
  }
}

// ─── Static Rules Fallback ─────────────────────────────────

function applyStaticRules(campaigns: CampaignInsight[], profileConfig: any, adsets: any[]): Decision[] {
  const decisions: Decision[] = [];

  for (const c of campaigns) {
    // Rollback (DTD-only)
    const rollbackEnabled = profileConfig.rollback_enabled !== false;
    const rollbackThreshold = profileConfig.rollback_roas_threshold || 10;
    if (rollbackEnabled && c.dtd_roas >= rollbackThreshold && c.dtd_purchases === 0 && c.dtd_spend > 0) {
      const incrementalRatio = 1 + (profileConfig.limite_escala / 100);
      const estimatedPrevBudget = c.daily_budget / incrementalRatio;
      if (c.daily_budget > estimatedPrevBudget * 1.05) {
        decisions.push({ campaign_id: c.id, action: "rollback", reason: `DTD ROAS ${c.dtd_roas.toFixed(2)}x ≥ ${rollbackThreshold}x, 0 vendas. Rollback.`, new_budget: estimatedPrevBudget, previous_budget: c.daily_budget });
        continue;
      }
    }

    // Guardian: CPA too high — ONLY if campaign age >= MIN_DAYS_BEFORE_PAUSE
    if (profileConfig.cpa_max_toleravel > 0 && c.wtd_spend > 0) {
      const threshold = profileConfig.cpa_max_toleravel * 1.15;
      const wtdCpa = c.wtd_purchases > 0 ? c.wtd_spend / c.wtd_purchases : c.wtd_spend;
      const dtdCpa = c.dtd_purchases > 0 ? c.dtd_spend / c.dtd_purchases : c.dtd_spend;
      if (wtdCpa > threshold && (c.dtd_purchases === 0 || dtdCpa > threshold)) {
        if (c.age_days >= MIN_DAYS_BEFORE_PAUSE) {
          decisions.push({ campaign_id: c.id, action: "pause", reason: `CPA WTD R$${wtdCpa.toFixed(2)} > limite R$${threshold.toFixed(2)}. Idade: ${c.age_days} dias.` });
        } else {
          // Young campaign: reduce instead of pause
          const reducedBudget = c.daily_budget * 0.7;
          decisions.push({ campaign_id: c.id, action: "reduce" as any, reason: `CPA alto mas campanha jovem (${c.age_days} dias < ${MIN_DAYS_BEFORE_PAUSE}). Reduzindo budget em 30% ao invés de pausar.`, new_budget: reducedBudget, previous_budget: c.daily_budget });
        }
        continue;
      }
    }

    // Scale
    if (profileConfig.roas_min_escala > 0 && c.wtd_purchases >= 3 && c.wtd_roas >= profileConfig.roas_min_escala && c.trend !== "declining") {
      if (c.frequency > 2.5 && c.ctr < 1.0) continue;
      const teto = profileConfig.teto_diario_escala || 0;
      const newBudget = c.daily_budget * (1 + profileConfig.limite_escala / 100);
      if (profileConfig.vertical_scale_enabled && teto > 0 && c.daily_budget >= teto * 0.8) {
        const campaignAdsets = adsets.filter((a: any) => a.campaign_id === c.id);
        if (campaignAdsets.length > 0) {
          const bestAdset = campaignAdsets.sort((a: any, b: any) => parseFloat(b.insights?.data?.[0]?.spend || "0") - parseFloat(a.insights?.data?.[0]?.spend || "0"))[0];
          decisions.push({ campaign_id: c.id, adset_id: bestAdset.id, action: "duplicate_scale", reason: `Budget R$${c.daily_budget.toFixed(0)} ≥80% teto. Duplicando.`, new_budget: c.daily_budget });
          continue;
        }
      }
      if (teto > 0 && newBudget > teto) continue;
      decisions.push({ campaign_id: c.id, action: "scale", reason: `WTD ROAS ${c.wtd_roas.toFixed(2)}x, ${c.wtd_purchases} vendas. Trend: ${c.trend}.`, new_budget: newBudget });
    }
  }

  return decisions;
}

// ─── Adset Duplication ─────────────────────────────────────

async function duplicateAdset(adsetId: string, accessToken: string, newName?: string): Promise<{ success: boolean; new_adset_id?: string; error?: string }> {
  const result = await metaApiCallWithRetry(
    `https://graph.facebook.com/v23.0/${adsetId}/copies`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deep_copy: true, rename_options: newName ? { rename_strategy: "DEEP_RENAME", rename_prefix: newName } : undefined, status_option: "ACTIVE", access_token: accessToken }) },
  );
  if (!result.success) return { success: false, error: result.error };
  const newId = result.data?.copied_adset_id || result.data?.ad_object_ids?.[0];
  if (!newId) return { success: false, error: "Meta API não retornou o ID do adset copiado." };
  return { success: true, new_adset_id: newId };
}

// ─── Meta API Fetchers ─────────────────────────────────────

async function fetchInsightsForRange(accountId: string, accessToken: string, since: string, until: string): Promise<Map<string, any>> {
  const url = `https://graph.facebook.com/v23.0/${accountId}/insights?fields=campaign_id,spend,actions,action_values,ctr,frequency&time_range={"since":"${since}","until":"${until}"}&level=campaign&limit=500&access_token=${accessToken}`;
  try {
    const resp = await fetch(url);
    const data = await resp.json();
    const map = new Map<string, any>();
    for (const row of (data.data || [])) map.set(row.campaign_id, row);
    return map;
  } catch { return new Map(); }
}

// ─── Main Handler ──────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const sb = createClient(supabaseUrl, supabaseKey);

    const { data: profiles, error } = await sb.from("client_profiles").select("*").or("cpa_max_toleravel.gt.0,roas_min_escala.gt.0");
    if (error) throw error;
    if (!profiles || profiles.length === 0) {
      return new Response(JSON.stringify({ message: "No profiles with autonomous features enabled", timestamp: new Date().toISOString() }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { today, wtdSince, mtdSince } = getTimeframeRanges();
    const currentHour = currentHourBRT();

    console.log(`[MTX Agent v3] Running at ${currentHour}:00 BRT | Profiles: ${profiles.length}`);

    const profilePromises = profiles
      .filter((profile: any) => {
        const accessToken = profile.meta_access_token || Deno.env.get("META_ACCESS_TOKEN");
        return accessToken && profile.ad_account_id && profile.ad_account_id !== "act_";
      })
      .map(async (profile: any) => {
        const accessToken = profile.meta_access_token || Deno.env.get("META_ACCESS_TOKEN");
        const profileResult: any = { profile: profile.name, profile_id: profile.id, actions: [], ai_summary: "", hour: currentHour };

        try {
          // Fetch campaigns with created_time for age calculation
          const campaignUrl = `https://graph.facebook.com/v23.0/${profile.ad_account_id}/campaigns?fields=id,name,effective_status,daily_budget,created_time&effective_status=["ACTIVE"]&access_token=${accessToken}&limit=100`;
          const adsetUrl = `https://graph.facebook.com/v23.0/${profile.ad_account_id}/adsets?fields=id,name,daily_budget,effective_status,campaign_id,insights.time_range({"since":"${wtdSince}","until":"${today}"}){spend,actions,action_values,ctr,frequency}&effective_status=["ACTIVE"]&access_token=${accessToken}&limit=100`;

          const [campaignResp, adsetResp, dtdMap, wtdMap, mtdMap] = await Promise.all([
            fetch(campaignUrl).then(r => r.json()),
            fetch(adsetUrl).then(r => r.json()),
            fetchInsightsForRange(profile.ad_account_id, accessToken, today, today),
            fetchInsightsForRange(profile.ad_account_id, accessToken, wtdSince, today),
            fetchInsightsForRange(profile.ad_account_id, accessToken, mtdSince, today),
          ]);

          if (campaignResp.error) { profileResult.error = campaignResp.error.message; return profileResult; }

          const adsetsList = adsetResp.data || [];

          const campaignInsights: CampaignInsight[] = (campaignResp.data || []).map((c: any) => {
            const dtd = parseMetrics(dtdMap.get(c.id));
            const wtd = parseMetrics(wtdMap.get(c.id));
            const mtd = parseMetrics(mtdMap.get(c.id));
            const dtdRoas = dtd.spend > 0 ? dtd.revenue / dtd.spend : 0;
            const wtdRoas = wtd.spend > 0 ? wtd.revenue / wtd.spend : 0;
            const mtdRoas = mtd.spend > 0 ? mtd.revenue / mtd.spend : 0;
            const ageDays = campaignAgeDays(c.created_time);

            return {
              id: c.id, name: c.name, effective_status: c.effective_status,
              daily_budget: parseInt(c.daily_budget || "0", 10) / 100,
              created_time: c.created_time || "", age_days: ageDays,
              dtd_spend: dtd.spend, dtd_purchases: dtd.purchases, dtd_revenue: dtd.revenue,
              dtd_roas: dtdRoas, dtd_cpa: dtd.purchases > 0 ? dtd.spend / dtd.purchases : (dtd.spend > 0 ? dtd.spend : 0),
              wtd_spend: wtd.spend, wtd_purchases: wtd.purchases, wtd_revenue: wtd.revenue,
              wtd_roas: wtdRoas, wtd_cpa: wtd.purchases > 0 ? wtd.spend / wtd.purchases : (wtd.spend > 0 ? wtd.spend : 0),
              mtd_spend: mtd.spend, mtd_purchases: mtd.purchases, mtd_revenue: mtd.revenue,
              mtd_roas: mtdRoas, mtd_cpa: mtd.purchases > 0 ? mtd.spend / mtd.purchases : (mtd.spend > 0 ? mtd.spend : 0),
              ctr: wtd.ctr, frequency: wtd.frequency,
              trend: determineTrend(dtdRoas, wtdRoas, mtdRoas),
            };
          });

          // Get decisions
          let decisions: Decision[];
          let aiSummary = "";

          if (LOVABLE_API_KEY && campaignInsights.length > 0) {
            const aiResult = await getAIDecision(LOVABLE_API_KEY, profile.name, {
              cpa_meta: profile.cpa_meta, cpa_max_toleravel: profile.cpa_max_toleravel,
              roas_min_escala: profile.roas_min_escala, teto_diario_escala: profile.teto_diario_escala,
              limite_escala: profile.limite_escala, rollback_enabled: profile.rollback_enabled,
              rollback_roas_threshold: profile.rollback_roas_threshold,
            }, campaignInsights, adsetsList, currentHour);
            decisions = aiResult.decisions.filter((d: Decision) => d.action !== "maintain");
            if (!profile.vertical_scale_enabled) decisions = decisions.filter((d: Decision) => d.action !== "duplicate_scale");

            // 🛡️ SAFETY: Hard block pause for young campaigns (< MIN_DAYS_BEFORE_PAUSE)
            decisions = decisions.filter((d: Decision) => {
              if (d.action === "pause") {
                const campaign = campaignInsights.find((c) => c.id === d.campaign_id);
                if (!campaign) return true;

                // ABSOLUTE RULE: Never pause campaigns younger than MIN_DAYS_BEFORE_PAUSE days
                if (campaign.age_days < MIN_DAYS_BEFORE_PAUSE) {
                  console.log(`🛡️ PROTECTION: Blocked pause for "${campaign.name}" — only ${campaign.age_days} days old (min: ${MIN_DAYS_BEFORE_PAUSE})`);
                  // Convert to reduce instead
                  decisions.push({
                    campaign_id: d.campaign_id, action: "reduce" as any,
                    reason: `[Auto-convertido] Campanha jovem (${campaign.age_days} dias < ${MIN_DAYS_BEFORE_PAUSE}). Pausa bloqueada. Reduzindo budget em 30% para proteção. Motivo original: ${d.reason}`,
                    new_budget: campaign.daily_budget * 0.7, previous_budget: campaign.daily_budget,
                  });
                  return false;
                }

                // Existing safety checks
                const cpaThreshold = profile.cpa_max_toleravel * 1.15;
                if (profile.cpa_max_toleravel > 0 && campaign.wtd_cpa <= cpaThreshold && campaign.wtd_purchases > 0) {
                  console.log(`SAFETY: Blocked pause for "${campaign.name}" — WTD CPA within limit`);
                  return false;
                }
                if (d.reason && (d.reason.includes("MANTER") || d.reason.includes("dentro dos limites"))) return false;
                if (campaign.dtd_spend < campaign.daily_budget * 0.3 && campaign.wtd_purchases > 0) {
                  console.log(`SAFETY: Blocked pause for "${campaign.name}" — low DTD spend with WTD conversions`);
                  return false;
                }
              }
              return true;
            });
            aiSummary = aiResult.summary;
          } else {
            decisions = applyStaticRules(campaignInsights, profile, adsetsList);
            aiSummary = `Análise estática v3: ${campaignInsights.length} campanhas verificadas.`;
          }

          profileResult.ai_summary = aiSummary;
          profileResult.campaigns_analyzed = campaignInsights.length;
          profileResult.timeframes = { dtd: today, wtd: wtdSince, mtd: mtdSince };

          // ─── Execute Decisions (with retry) ───────────
          for (const decision of decisions) {
            try {
              const campaign = campaignInsights.find((c) => c.id === decision.campaign_id);

              if (decision.action === "pause") {
                const result = await metaApiCallWithRetry(
                  `https://graph.facebook.com/v23.0/${decision.campaign_id}`,
                  { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "PAUSED", access_token: accessToken }) },
                );
                await sb.from("emergency_logs").insert({
                  profile_id: profile.id, user_id: profile.user_id, action_type: "agent_pause",
                  details: { campaign_id: decision.campaign_id, campaign_name: campaign?.name, reason: decision.reason, ai_driven: !!LOVABLE_API_KEY, success: result.success, attempts: result.attempts, hour: currentHour, age_days: campaign?.age_days },
                });
                profileResult.actions.push({ ...decision, status: result.success ? "EXECUTED" : "FAILED", attempts: result.attempts, error: result.error });

              } else if (decision.action === "duplicate_scale") {
                const adsetId = decision.adset_id;
                if (!adsetId) { profileResult.actions.push({ ...decision, status: "SKIPPED", error: "adset_id ausente" }); continue; }
                const dupResult = await duplicateAdset(adsetId, accessToken, "[SCALE COPY 🚀] ");
                await sb.from("emergency_logs").insert({
                  profile_id: profile.id, user_id: profile.user_id, action_type: "agent_duplicate",
                  details: { campaign_id: decision.campaign_id, campaign_name: campaign?.name, original_adset_id: adsetId, new_adset_id: dupResult.new_adset_id, reason: decision.reason, success: dupResult.success, hour: currentHour },
                });
                profileResult.actions.push({ ...decision, new_adset_id: dupResult.new_adset_id, status: dupResult.success ? "DUPLICATED" : "FAILED", error: dupResult.error });

              } else if (decision.action === "rollback" || decision.action === "scale" || decision.action === "reduce") {
                const campaignRaw = (campaignResp.data || []).find((c: any) => c.id === decision.campaign_id);
                const currentBudget = parseInt(campaignRaw?.daily_budget || "0", 10) / 100;
                let newBudget: number;

                if (decision.action === "rollback") {
                  newBudget = decision.new_budget || currentBudget / (1 + profile.limite_escala / 100);
                } else if (decision.action === "scale") {
                  newBudget = decision.new_budget || currentBudget * (1 + profile.limite_escala / 100);
                  const teto = profile.teto_diario_escala || 0;
                  if (teto > 0 && newBudget > teto) { profileResult.actions.push({ ...decision, status: "ABORTED_CEILING" }); continue; }
                } else {
                  newBudget = decision.new_budget || currentBudget * 0.7;
                }

                const result = await metaApiCallWithRetry(
                  `https://graph.facebook.com/v23.0/${decision.campaign_id}`,
                  { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ daily_budget: Math.round(newBudget * 100), access_token: accessToken }) },
                );
                const actionType = decision.action === "rollback" ? "agent_rollback" : decision.action === "scale" ? "agent_scale" : "agent_reduce";
                await sb.from("emergency_logs").insert({
                  profile_id: profile.id, user_id: profile.user_id, action_type: actionType,
                  details: { campaign_id: decision.campaign_id, campaign_name: campaign?.name, old_budget: currentBudget, new_budget: newBudget, reason: decision.reason, success: result.success, attempts: result.attempts, hour: currentHour, age_days: campaign?.age_days },
                });
                profileResult.actions.push({ ...decision, old_budget: currentBudget, new_budget: newBudget, status: result.success ? "EXECUTED" : "FAILED", attempts: result.attempts, error: result.error });
              }
            } catch (execErr) {
              profileResult.actions.push({ ...decision, status: "ERROR", error: (execErr as Error).message });
            }
          }

          return profileResult;
        } catch (e) {
          return { profile: profile.name, error: (e as Error).message };
        }
      });

    const results = await Promise.all(profilePromises);
    console.log(`[MTX Agent v3] Done. Actions: ${results.reduce((s: number, r: any) => s + (r.actions?.length || 0), 0)}`);

    return new Response(JSON.stringify({ results, timestamp: new Date().toISOString(), ai_enabled: !!LOVABLE_API_KEY, version: "v3-protected", hour_brt: currentHour }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
