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
  if (!createdTime) return 999;
  const created = new Date(createdTime);
  const now = new Date();
  return Math.floor((now.getTime() - created.getTime()) / 86400000);
}

const MIN_SAFE_BUDGET_REAIS = 1;

function normalizeCampaignRef(value: string): string {
  return (value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function resolveCampaignReference(ref: string, campaigns: CampaignInsight[]): CampaignInsight | undefined {
  if (!ref) return undefined;
  const byId = campaigns.find((c) => c.id === ref);
  if (byId) return byId;
  const numericId = ref.match(/\d{12,}/)?.[0];
  if (numericId) { const byNumericId = campaigns.find((c) => c.id === numericId); if (byNumericId) return byNumericId; }
  const normalizedRef = normalizeCampaignRef(ref);
  if (!normalizedRef) return undefined;
  const exactName = campaigns.find((c) => normalizeCampaignRef(c.name) === normalizedRef);
  if (exactName) return exactName;
  return campaigns.find((c) => { const n = normalizeCampaignRef(c.name); return n.includes(normalizedRef) || normalizedRef.includes(n); });
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
  if (currentBudget > 0 && newBudget && Number.isFinite(newBudget) && newBudget > 0) return newBudget / currentBudget;
  if (action === "reduce" || action === "pause") return 0.7;
  if (action === "scale") return 1.1;
  if (action === "rollback") return 0.85;
  return 1;
}

async function applyAdsetBudgetFallback(
  campaignId: string, adsets: any[], accessToken: string, ratio: number
): Promise<{ success: boolean; updated: number; attempts: number; old_avg_budget: number; new_avg_budget: number; errors: string[] }> {
  const campaignAdsets = (adsets || []).filter((a: any) => a.campaign_id === campaignId);
  const editableAdsets = campaignAdsets.map((a: any) => ({ adset: a, oldBudget: parseBudgetToReais(a.daily_budget) })).filter((item: any) => item.oldBudget > 0);
  if (editableAdsets.length === 0) return { success: false, updated: 0, attempts: 0, old_avg_budget: 0, new_avg_budget: 0, errors: ["Nenhum adset com daily_budget válido."] };

  let updated = 0, attempts = 0, oldBudgetSum = 0, newBudgetSum = 0;
  const errors: string[] = [];

  for (const item of editableAdsets) {
    const newBudget = ensureValidBudget(item.oldBudget * ratio);
    const result = await metaApiCallWithRetry(`https://graph.facebook.com/v23.0/${item.adset.id}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ daily_budget: Math.round(newBudget * 100), access_token: accessToken }),
    });
    attempts += result.attempts;
    if (result.success) { updated += 1; oldBudgetSum += item.oldBudget; newBudgetSum += newBudget; }
    else { errors.push(`adset ${item.adset.id}: ${result.error || "erro desconhecido"}`); }
  }
  return { success: updated > 0, updated, attempts, old_avg_budget: updated > 0 ? oldBudgetSum / updated : 0, new_avg_budget: updated > 0 ? newBudgetSum / updated : 0, errors };
}

// ─── Retry wrapper for Meta API calls ──────────────────────

async function metaApiCallWithRetry(
  url: string, options: RequestInit, maxRetries = 2, delayMs = 3000
): Promise<{ data: any; success: boolean; attempts: number; error?: string }> {
  let lastError = "";
  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      const resp = await fetch(url, options);
      const data = await resp.json();
      if (data.error) {
        lastError = data.error.message || JSON.stringify(data.error);
        if (resp.status === 429 || data.error.code === 32 || data.error.code === 4) {
          if (attempt <= maxRetries) { await new Promise(r => setTimeout(r, delayMs * attempt)); continue; }
        }
        if (resp.status >= 500 || data.error.is_transient) {
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

// ─── Gemini Agent Tools (Function Declarations) ────────────

const GEMINI_TOOLS = [{
  function_declarations: [
    {
      name: "pause_campaign",
      description: "Pausa campanha com CPA acima do limite ou saturação",
      parameters: { type: "OBJECT", properties: { campaign_id: { type: "STRING" }, campaign_name: { type: "STRING" }, reason: { type: "STRING" } }, required: ["campaign_id", "campaign_name", "reason"] },
    },
    {
      name: "scale_campaign",
      description: "Aumenta budget de campanha com ROAS positivo",
      parameters: { type: "OBJECT", properties: { campaign_id: { type: "STRING" }, campaign_name: { type: "STRING" }, new_budget_reais: { type: "NUMBER" }, reason: { type: "STRING" } }, required: ["campaign_id", "campaign_name", "new_budget_reais", "reason"] },
    },
    {
      name: "reduce_budget",
      description: "Reduz budget em 30% de campanha jovem com CPA alto (menos de 4 dias)",
      parameters: { type: "OBJECT", properties: { campaign_id: { type: "STRING" }, campaign_name: { type: "STRING" }, new_budget_reais: { type: "NUMBER" }, reason: { type: "STRING" } }, required: ["campaign_id", "campaign_name", "new_budget_reais", "reason"] },
    },
    {
      name: "create_new_campaign",
      description: "Cria nova campanha quando não há campanhas ativas suficientes OU ROAS geral está abaixo do mínimo há 3+ dias",
      parameters: { type: "OBJECT", properties: { profile_id: { type: "STRING" }, objective: { type: "STRING" }, daily_budget_reais: { type: "NUMBER" }, justification: { type: "STRING" } }, required: ["profile_id", "objective", "daily_budget_reais", "justification"] },
    },
    {
      name: "generate_creative",
      description: "Gera novo criativo quando frequência > 3.5 ou CTR < 0.8% (fadiga detectada)",
      parameters: { type: "OBJECT", properties: { profile_id: { type: "STRING" }, campaign_id: { type: "STRING" }, creative_type: { type: "STRING" }, reason: { type: "STRING" } }, required: ["profile_id", "campaign_id", "creative_type", "reason"] },
    },
    {
      name: "generate_client_report",
      description: "Gera relatório público para o cliente",
      parameters: { type: "OBJECT", properties: { profile_id: { type: "STRING" }, profile_name: { type: "STRING" }, summary: { type: "STRING" } }, required: ["profile_id", "profile_name", "summary"] },
    },
  ],
}];

// ─── Gemini Agent (Function-Calling Loop) ──────────────────

async function executeGeminiAgent(
  apiKey: string,
  profileName: string,
  profileConfig: any,
  campaigns: CampaignInsight[],
  adsets: any[],
  profile: any,
  accessToken: string,
  supabase: any,
  currentHour: number
): Promise<{ decisions: Decision[]; summary: string }> {
  const decisions: Decision[] = [];
  const isNighttime = currentHour >= 22 || currentHour < 6;

  const systemPrompt = `Você é o MTX Autonomous Agent v4 — gestor de tráfego sênior da agência MTX Assessoria Estratégica.
HORA BRT: ${currentHour}:00 | PERÍODO: ${isNighttime ? "NOTURNO" : currentHour < 12 ? "MANHÃ" : "TARDE/NOITE"}

## REGRA ABSOLUTA: Não pausar campanhas com menos de ${MIN_DAYS_BEFORE_PAUSE} dias de vida. Converter em reduce_budget.

## ANÁLISE MULTI-TEMPORAL OBRIGATÓRIA
Cruze sempre DTD (hoje) + WTD (semana) + MTD (mês):
- DTD ruim + WTD/MTD bons → NÃO agir, flutuação pontual
- DTD e WTD ruins + MTD bom → reduce_budget
- 3 janelas ruins + idade >= ${MIN_DAYS_BEFORE_PAUSE} dias → pause_campaign
- DTD excelente + WTD positivo + trend improving → scale_campaign
- Frequência > 3.5 ou CTR < 0.8% → generate_creative (fadiga)
- 0 campanhas ativas ou ROAS geral < mínimo há 3+ dias → create_new_campaign

## REGRAS DO PERFIL ${profileName}
- CPA Meta: R$ ${profileConfig.cpa_meta} | CPA Máx Tolerável: R$ ${profileConfig.cpa_max_toleravel}
- ROAS Mínimo para Escala: ${profileConfig.roas_min_escala}x
- Limite de Escala: +${profileConfig.limite_escala}%
- Teto Diário: R$ ${profileConfig.teto_diario_escala}
- Rollback: ${profileConfig.rollback_enabled ? "ATIVADO (threshold: " + profileConfig.rollback_roas_threshold + "x)" : "DESATIVADO"}

## COMPORTAMENTO
Após cada ação, avalie se é necessária ação adicional.
Use generate_client_report no final se houve ações significativas.
Responda sempre em português com justificativa técnica clara.`;

  const campaignsText = campaigns.map(c =>
    `━━ "${c.name}" [${c.trend.toUpperCase()}] | Idade: ${c.age_days} dias${c.age_days < MIN_DAYS_BEFORE_PAUSE ? " 🛡️ PROTEGIDA" : ""}
   Budget: R$${c.daily_budget.toFixed(0)} | Status: ${c.effective_status}
   DTD → Spend: R$${c.dtd_spend.toFixed(0)} | Vendas: ${c.dtd_purchases} | ROAS: ${c.dtd_roas.toFixed(2)}x | CPA: R$${c.dtd_cpa.toFixed(0)}
   WTD → Spend: R$${c.wtd_spend.toFixed(0)} | Vendas: ${c.wtd_purchases} | ROAS: ${c.wtd_roas.toFixed(2)}x | CPA: R$${c.wtd_cpa.toFixed(0)}
   MTD → Spend: R$${c.mtd_spend.toFixed(0)} | Vendas: ${c.mtd_purchases} | ROAS: ${c.mtd_roas.toFixed(2)}x | CPA: R$${c.mtd_cpa.toFixed(0)}
   CTR: ${c.ctr.toFixed(2)}% | Frequência: ${c.frequency.toFixed(2)}`
  ).join("\n\n");

  const contents: any[] = [
    { role: "user", parts: [{ text: `Analise e otimize as campanhas do perfil "${profileName}". Tome todas as ações necessárias.\n\n${campaignsText}` }] },
  ];

  for (let turn = 0; turn < 6; turn++) {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents,
          tools: GEMINI_TOOLS,
        }),
      }
    );

    if (!resp.ok) {
      const errText = await resp.text();
      console.error(`Gemini API error (turn ${turn}):`, resp.status, errText);
      break;
    }

    const result = await resp.json();
    const candidate = result.candidates?.[0];
    if (!candidate?.content) break;

    contents.push(candidate.content);

    const functionCalls = (candidate.content.parts || []).filter((p: any) => p.functionCall);
    if (functionCalls.length === 0) break; // model finished with text only

    const functionResponses: any[] = [];

    for (const part of functionCalls) {
      const { name, args: inp } = part.functionCall;
      let toolResult: any = { success: false };

      try {
        if (name === "pause_campaign") {
          const campaign = campaigns.find(c => c.id === inp.campaign_id);
          if (campaign && campaign.age_days < MIN_DAYS_BEFORE_PAUSE) {
            toolResult = { success: false, blocked: true, reason: `Campanha protegida (${campaign.age_days} dias < ${MIN_DAYS_BEFORE_PAUSE}). Use reduce_budget.` };
          } else {
            const pauseResp = await metaApiCallWithRetry(
              `https://graph.facebook.com/v23.0/${inp.campaign_id}`,
              { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "PAUSED", access_token: accessToken }) }
            );
            toolResult = { success: pauseResp.success, error: pauseResp.error };
            if (pauseResp.success) decisions.push({ campaign_id: inp.campaign_id, action: "pause", reason: inp.reason });
          }
        } else if (name === "scale_campaign") {
          const newBudgetCents = Math.round(inp.new_budget_reais * 100);
          const scaleResp = await metaApiCallWithRetry(
            `https://graph.facebook.com/v23.0/${inp.campaign_id}`,
            { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ daily_budget: newBudgetCents, access_token: accessToken }) }
          );
          toolResult = { success: scaleResp.success, new_budget: inp.new_budget_reais, error: scaleResp.error };
          if (scaleResp.success) {
            const campaign = campaigns.find(c => c.id === inp.campaign_id);
            decisions.push({ campaign_id: inp.campaign_id, action: "scale", reason: inp.reason, new_budget: inp.new_budget_reais, previous_budget: campaign?.daily_budget });
          }
        } else if (name === "reduce_budget") {
          const newBudgetCents = Math.round(inp.new_budget_reais * 100);
          const reduceResp = await metaApiCallWithRetry(
            `https://graph.facebook.com/v23.0/${inp.campaign_id}`,
            { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ daily_budget: newBudgetCents, access_token: accessToken }) }
          );
          toolResult = { success: reduceResp.success, error: reduceResp.error };
          if (reduceResp.success) decisions.push({ campaign_id: inp.campaign_id, action: "reduce", reason: inp.reason, new_budget: inp.new_budget_reais });
        } else if (name === "create_new_campaign") {
          const createResp = await supabase.functions.invoke("ai-campaign-draft", {
            body: { profileId: inp.profile_id, objective: inp.objective, dailyBudget: Math.round(inp.daily_budget_reais * 100) },
          });
          toolResult = { success: !createResp.error, draft_id: createResp.data?.draftId, message: "Campanha draft criada. Aguarda publicação manual." };
        } else if (name === "generate_creative") {
          const creativeResp = await supabase.functions.invoke("ai-creative-brain", {
            body: { profileId: inp.profile_id, campaignId: inp.campaign_id, creativeType: inp.creative_type, autoMode: true },
          });
          toolResult = { success: !creativeResp.error, creative_id: creativeResp.data?.creativeId };
        } else if (name === "generate_client_report") {
          const reportResp = await supabase.functions.invoke("generate-client-report", {
            body: { profileId: inp.profile_id, summary: inp.summary },
          });
          toolResult = { success: !reportResp.error, report_url: reportResp.data?.reportUrl };
        }
      } catch (e: any) {
        toolResult = { success: false, error: e.message };
      }

      functionResponses.push({ functionResponse: { name, response: toolResult } });
    }

    contents.push({ role: "function", parts: functionResponses });
  }

  // Extract final text from last model response
  const lastModel = [...contents].reverse().find(c => c.role === "model");
  const textPart = (lastModel?.parts || []).find((p: any) => p.text);

  return { decisions, summary: textPart?.text || "Análise concluída pelo Gemini Agent v4." };
}

// ─── Static Rules Fallback ─────────────────────────────────

function applyStaticRules(campaigns: CampaignInsight[], profileConfig: any, adsets: any[]): Decision[] {
  const decisions: Decision[] = [];

  for (const c of campaigns) {
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

    if (profileConfig.cpa_max_toleravel > 0 && c.wtd_spend > 0) {
      const threshold = profileConfig.cpa_max_toleravel * 1.15;
      const wtdCpa = c.wtd_purchases > 0 ? c.wtd_spend / c.wtd_purchases : c.wtd_spend;
      const dtdCpa = c.dtd_purchases > 0 ? c.dtd_spend / c.dtd_purchases : c.dtd_spend;
      if (wtdCpa > threshold && (c.dtd_purchases === 0 || dtdCpa > threshold)) {
        if (c.age_days >= MIN_DAYS_BEFORE_PAUSE) {
          decisions.push({ campaign_id: c.id, action: "pause", reason: `CPA WTD R$${wtdCpa.toFixed(2)} > limite R$${threshold.toFixed(2)}. Idade: ${c.age_days} dias.` });
        } else {
          const reducedBudget = c.daily_budget * 0.7;
          decisions.push({ campaign_id: c.id, action: "reduce", reason: `CPA alto mas campanha jovem (${c.age_days} dias < ${MIN_DAYS_BEFORE_PAUSE}). Reduzindo budget em 30%.`, new_budget: reducedBudget, previous_budget: c.daily_budget });
        }
        continue;
      }
    }

    if (profileConfig.roas_min_escala > 0 && c.wtd_purchases >= 3 && c.wtd_roas >= profileConfig.roas_min_escala && c.trend !== "declining") {
      if (c.frequency > 2.5 && c.ctr < 1.0) continue;
      const teto = profileConfig.teto_diario_escala || 0;
      const newBudget = c.daily_budget * (1 + profileConfig.limite_escala / 100);
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
    const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY");
    const sb = createClient(supabaseUrl, supabaseKey);

    const { data: profiles, error } = await sb.from("client_profiles").select("*").or("cpa_max_toleravel.gt.0,roas_min_escala.gt.0");
    if (error) throw error;
    if (!profiles || profiles.length === 0) {
      return new Response(JSON.stringify({ message: "No profiles with autonomous features enabled", timestamp: new Date().toISOString() }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { today, wtdSince, mtdSince } = getTimeframeRanges();
    const currentHour = currentHourBRT();

    console.log(`[MTX Agent v4 — Gemini] Running at ${currentHour}:00 BRT | Profiles: ${profiles.length}`);

    const profilePromises = profiles
      .filter((profile: any) => {
        const accessToken = profile.meta_access_token || Deno.env.get("META_ACCESS_TOKEN");
        return accessToken && profile.ad_account_id && profile.ad_account_id !== "act_";
      })
      .map(async (profile: any) => {
        const accessToken = profile.meta_access_token || Deno.env.get("META_ACCESS_TOKEN");
        const profileResult: any = { profile: profile.name, profile_id: profile.id, actions: [], ai_summary: "", hour: currentHour };

        try {
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

          // Get decisions — Gemini Agent v4 or static fallback
          let decisions: Decision[];
          let aiSummary = "";

          if (GEMINI_KEY && campaignInsights.length > 0) {
            try {
              const aiResult = await executeGeminiAgent(
                GEMINI_KEY, profile.name, {
                  cpa_meta: profile.cpa_meta,
                  cpa_max_toleravel: profile.cpa_max_toleravel,
                  roas_min_escala: profile.roas_min_escala,
                  teto_diario_escala: profile.teto_diario_escala,
                  limite_escala: profile.limite_escala,
                  rollback_enabled: profile.rollback_enabled,
                  rollback_roas_threshold: profile.rollback_roas_threshold,
                },
                campaignInsights, adsetsList, profile, accessToken, sb, currentHour
              );
              decisions = aiResult.decisions;
              aiSummary = aiResult.summary;
            } catch (geminiErr) {
              console.error("Gemini Agent error, falling back to static rules:", geminiErr);
              decisions = applyStaticRules(campaignInsights, profile, adsetsList);
              aiSummary = `Gemini indisponível, regras estáticas aplicadas. Erro: ${(geminiErr as Error).message}`;
            }
          } else {
            decisions = applyStaticRules(campaignInsights, profile, adsetsList);
            aiSummary = `Análise estática v4: ${campaignInsights.length} campanhas verificadas.`;
          }

          profileResult.ai_summary = aiSummary;
          profileResult.campaigns_analyzed = campaignInsights.length;
          profileResult.timeframes = { dtd: today, wtd: wtdSince, mtd: mtdSince };
          profileResult.campaign_insights = campaignInsights;
          profileResult.cpa_meta = profile.cpa_meta;
          profileResult.roas_min_escala = profile.roas_min_escala;

          // Log all decisions to emergency_logs
          for (const decision of decisions) {
            const actionType = `agent_${decision.action}`;
            await sb.from("emergency_logs").insert({
              profile_id: profile.id,
              user_id: profile.user_id,
              action_type: actionType,
              details: {
                campaign_id: decision.campaign_id,
                reason: decision.reason,
                new_budget: decision.new_budget,
                previous_budget: decision.previous_budget,
                ai_driven: true,
                engine: "gemini-2.0-flash",
                hour: currentHour,
              },
            });

            profileResult.actions.push({ ...decision, status: "EXECUTED", engine: "gemini" });
          }

          return profileResult;
        } catch (e) {
          return { profile: profile.name, error: (e as Error).message };
        }
      });

    const results = await Promise.all(profilePromises);
    const totalActions = results.reduce((s: number, r: any) => s + (r.actions?.length || 0), 0);
    console.log(`[MTX Agent v4] Done. Actions: ${totalActions}`);

    // ─── Send summary email via Resend ─────────────────────────
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (RESEND_API_KEY) {
      const nowBRT = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
      const dateBRT = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
      const nextRun = `${((currentHour + 12) % 24).toString().padStart(2, "0")}:00 BRT`;

      for (const r of results) {
        if (r.error && !r.actions) continue;
        const profileName = r.profile || "Perfil";
        const actions: any[] = r.actions || [];
        const campaignsCount = r.campaigns_analyzed || 0;

        const actionIcon = (action: string) => {
          const map: Record<string, string> = { pause: "🔴", scale: "✅", reduce: "🟡", rollback: "🔄", create_new_campaign: "🆕", generate_creative: "🎨" };
          return map[action] || "⚡";
        };
        const actionLabel = (action: string) => {
          const map: Record<string, string> = { pause: "PAUSA", scale: "ESCALA", reduce: "REDUÇÃO", rollback: "ROLLBACK", create_new_campaign: "NOVA CAMPANHA", generate_creative: "NOVO CRIATIVO" };
          return map[action] || action.toUpperCase();
        };
        const actionColor = (action: string) => {
          if (action === "pause") return "#ff4444";
          if (action === "scale") return "#00ff88";
          if (action === "reduce" || action === "rollback") return "#ffaa00";
          return "#00ff88";
        };

        const actionsHtml = actions.length > 0
          ? actions.map((a: any) => `
            <div style="background:#111111;border:1px solid #1e1e1e;border-radius:8px;padding:14px 16px;margin-bottom:8px;">
              <div style="display:flex;align-items:center;margin-bottom:6px;">
                <span style="font-size:16px;margin-right:8px;">${actionIcon(a.action)}</span>
                <span style="font-size:12px;font-weight:700;color:${actionColor(a.action)};text-transform:uppercase;letter-spacing:0.5px;">${actionLabel(a.action)}</span>
                ${a.new_budget ? `<span style="margin-left:auto;font-size:13px;color:#ffffff;font-weight:600;">R$ ${a.previous_budget?.toFixed(0) || "?"} → R$ ${a.new_budget.toFixed(0)}</span>` : ""}
              </div>
              <div style="font-size:13px;color:#888888;line-height:1.4;">${a.reason || "—"}</div>
            </div>`).join("")
          : `<div style="background:#111111;border:1px solid #00ff88;border-radius:8px;padding:20px;text-align:center;">
              <div style="font-size:24px;margin-bottom:8px;">✅</div>
              <div style="font-size:16px;font-weight:700;color:#00ff88;">Todas as campanhas saudáveis</div>
              <div style="font-size:12px;color:#888888;margin-top:4px;">Nenhuma intervenção necessária neste ciclo</div>
            </div>`;

        // Find latest report for this profile
        let reportLink = "";
        try {
          const { data: snap } = await sb.from("report_snapshots").select("token").eq("profile_id", r.profile_id).order("created_at", { ascending: false }).limit(1);
          if (snap?.[0]) reportLink = `https://mtx-roi-command.lovable.app/relatorio?token=${snap[0].token}`;
        } catch {}

        const statusColor = actions.length === 0 ? "#00ff88" : actions.some((a: any) => a.action === "pause") ? "#ff4444" : "#ffaa00";
        const statusText = actions.length === 0 ? "SAUDÁVEL" : actions.some((a: any) => a.action === "pause") ? "INTERVENÇÃO" : "OTIMIZADO";

        const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#ffffff;">
<div style="max-width:600px;margin:0 auto;padding:0;">

  <!-- Header -->
  <div style="background:linear-gradient(135deg,#0a0a0a 0%,#111111 100%);padding:32px 24px 24px;border-bottom:1px solid #1e1e1e;">
    <div style="font-size:10px;color:#00ff88;text-transform:uppercase;letter-spacing:2px;font-weight:600;margin-bottom:4px;">MTX Assessoria Estratégica</div>
    <div style="font-size:22px;font-weight:800;color:#ffffff;margin-bottom:2px;">🤖 Agente Autônomo</div>
    <div style="font-size:11px;color:#888888;">Engine Claude Opus 4.5 · Tool-Use Loop</div>
  </div>

  <!-- Destaque -->
  <div style="background:#111111;border-bottom:1px solid #1e1e1e;padding:20px 24px;">
    <div style="font-size:10px;color:#888888;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px;">Perfil Analisado</div>
    <div style="font-size:20px;font-weight:700;color:#ffffff;margin-bottom:4px;">${profileName}</div>
    <div style="font-size:12px;color:#888888;">${dateBRT} · ${nowBRT}</div>
  </div>

  <!-- Metric Cards -->
  <div style="padding:20px 24px;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td width="33%" style="padding:0 4px 0 0;">
          <div style="background:#111111;border:1px solid #1e1e1e;border-radius:8px;padding:16px;text-align:center;">
            <div style="font-size:9px;color:#888888;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Campanhas</div>
            <div style="font-size:28px;font-weight:800;color:#ffffff;">${campaignsCount}</div>
          </div>
        </td>
        <td width="33%" style="padding:0 2px;">
          <div style="background:#111111;border:1px solid #1e1e1e;border-radius:8px;padding:16px;text-align:center;">
            <div style="font-size:9px;color:#888888;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Ações</div>
            <div style="font-size:28px;font-weight:800;color:${actions.length > 0 ? "#ffaa00" : "#00ff88"};">${actions.length}</div>
          </div>
        </td>
        <td width="33%" style="padding:0 0 0 4px;">
          <div style="background:#111111;border:1px solid ${statusColor};border-radius:8px;padding:16px;text-align:center;">
            <div style="font-size:9px;color:#888888;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Status</div>
            <div style="font-size:14px;font-weight:800;color:${statusColor};">${statusText}</div>
          </div>
        </td>
      </tr>
    </table>
  </div>

  <!-- Actions Section -->
  <div style="padding:0 24px 20px;">
    <div style="font-size:10px;color:#888888;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:12px;">Ações Tomadas</div>
    ${actionsHtml}
  </div>

  <!-- Campaign Metrics Table -->
  ${(() => {
    const insights: CampaignInsight[] = r.campaign_insights || [];
    if (insights.length === 0) return "";
    const cpaMeta = r.cpa_meta || 0;
    const roasMin = r.roas_min_escala || 0;
    const metricColor = (val: number, good: boolean) => good ? "#00ff88" : val === 0 ? "#888888" : "#ff4444";
    const cpaColor = (v: number) => v === 0 ? "#888888" : v <= cpaMeta ? "#00ff88" : v <= cpaMeta * 1.15 ? "#ffaa00" : "#ff4444";
    const roasColor = (v: number) => v === 0 ? "#888888" : v >= roasMin ? "#00ff88" : v >= roasMin * 0.8 ? "#ffaa00" : "#ff4444";
    const fmtR = (v: number) => v > 0 ? `R$ ${v.toFixed(2)}` : "—";
    const fmtX = (v: number) => v > 0 ? `${v.toFixed(2)}x` : "—";
    const fmtP = (v: number) => v > 0 ? `${v.toFixed(2)}%` : "—";

    const rows = insights.map(c => {
      const windows = [
        { label: "DTD", purchases: c.dtd_purchases, cpa: c.dtd_cpa, roas: c.dtd_roas, cpm: c.dtd_spend > 0 ? 0 : 0, ctr: c.ctr },
        { label: "WTD", purchases: c.wtd_purchases, cpa: c.wtd_cpa, roas: c.wtd_roas, cpm: 0, ctr: c.ctr },
        { label: "MTD", purchases: c.mtd_purchases, cpa: c.mtd_cpa, roas: c.mtd_roas, cpm: 0, ctr: c.ctr },
      ];
      return `
        <div style="background:#111111;border:1px solid #1e1e1e;border-radius:8px;margin-bottom:12px;overflow:hidden;">
          <div style="padding:12px 16px;border-bottom:1px solid #1e1e1e;">
            <div style="font-size:13px;font-weight:700;color:#ffffff;">${c.name}</div>
            <div style="font-size:11px;color:#888888;margin-top:2px;">Budget: R$ ${c.daily_budget.toFixed(0)} · Status: ${c.effective_status} · Trend: ${c.trend.toUpperCase()}</div>
          </div>
          <table width="100%" cellpadding="0" cellspacing="0" style="font-size:12px;">
            <tr style="border-bottom:1px solid #1e1e1e;">
              <th style="padding:8px 12px;text-align:left;color:#888888;font-weight:600;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;">Janela</th>
              <th style="padding:8px 8px;text-align:center;color:#888888;font-weight:600;font-size:10px;text-transform:uppercase;">Vendas</th>
              <th style="padding:8px 8px;text-align:center;color:#888888;font-weight:600;font-size:10px;text-transform:uppercase;">CPA</th>
              <th style="padding:8px 8px;text-align:center;color:#888888;font-weight:600;font-size:10px;text-transform:uppercase;">ROAS</th>
              <th style="padding:8px 8px;text-align:center;color:#888888;font-weight:600;font-size:10px;text-transform:uppercase;">CTR</th>
            </tr>
            ${windows.map(w => `
            <tr style="border-bottom:1px solid #1a1a1a;">
              <td style="padding:8px 12px;color:#ffffff;font-weight:600;">${w.label}</td>
              <td style="padding:8px 8px;text-align:center;color:${w.purchases > 0 ? "#00ff88" : "#888888"};font-weight:700;font-variant-numeric:tabular-nums;">${w.purchases}</td>
              <td style="padding:8px 8px;text-align:center;color:${cpaColor(w.cpa)};font-weight:600;font-variant-numeric:tabular-nums;">${fmtR(w.cpa)}</td>
              <td style="padding:8px 8px;text-align:center;color:${roasColor(w.roas)};font-weight:600;font-variant-numeric:tabular-nums;">${fmtX(w.roas)}</td>
              <td style="padding:8px 8px;text-align:center;color:${w.ctr >= 1.0 ? "#00ff88" : w.ctr >= 0.8 ? "#ffaa00" : "#888888"};font-variant-numeric:tabular-nums;">${fmtP(w.ctr)}</td>
            </tr>`).join("")}
          </table>
        </div>`;
    }).join("");

    return `
    <div style="padding:0 24px 20px;">
      <div style="font-size:10px;color:#888888;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:12px;">Métricas por Campanha</div>
      ${rows}
      <div style="font-size:10px;color:#444444;margin-top:4px;">🟢 Acima da meta · 🟡 Atenção · 🔴 Abaixo da meta · Meta CPA: R$ ${cpaMeta} · ROAS mín: ${roasMin}x</div>
    </div>`;
  })()}

  ${r.ai_summary ? `
  <!-- Claude Analysis -->
  <div style="padding:0 24px 20px;">
    <div style="font-size:10px;color:#888888;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:12px;">Análise do Claude</div>
    <div style="background:#111111;border:1px solid #1e1e1e;border-radius:8px;padding:16px;">
      <div style="font-size:13px;color:#cccccc;line-height:1.6;">${r.ai_summary.slice(0, 600)}</div>
    </div>
  </div>` : ""}

  ${reportLink ? `
  <!-- Report CTA -->
  <div style="padding:0 24px 24px;text-align:center;">
    <a href="${reportLink}" style="display:inline-block;background:#00ff88;color:#0a0a0a;padding:12px 32px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:700;letter-spacing:0.3px;">📊 Ver Relatório Completo</a>
  </div>` : ""}

  <!-- Footer -->
  <div style="background:#111111;border-top:1px solid #1e1e1e;padding:20px 24px;text-align:center;">
    <div style="font-size:11px;color:#888888;margin-bottom:4px;">Próxima análise: <strong style="color:#ffffff;">${nextRun}</strong></div>
    <div style="font-size:10px;color:#444444;margin-top:8px;">MTX Command Center · Agente Autônomo v4 · ${nowBRT}</div>
  </div>

</div>
</body></html>`;

        try {
          const emailResp = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: "MTX Agent <onboarding@resend.dev>",
              to: ["mtxagenciacriativa@gmail.com"],
              subject: `🤖 MTX Agent — ${profileName} | ${dateBRT} ${nowBRT.split(" ")[1] || nowBRT}`,
              html,
            }),
          });
          const emailData = await emailResp.json();
          if (!emailResp.ok) {
            console.error(`[Email] ${profileName}: failed`, JSON.stringify(emailData));
            r.email_error = emailData.message || `Resend error ${emailResp.status}`;
          } else {
            console.log(`[Email] ${profileName}: sent`, emailData.id);
            r.email_sent = true;
          }
        } catch (emailErr) {
          console.error(`[Email] Failed for ${profileName}:`, emailErr);
          r.email_error = (emailErr as Error).message;
        }
      }
    }

    return new Response(JSON.stringify({
      results,
      timestamp: new Date().toISOString(),
      ai_enabled: !!ANTHROPIC_KEY,
      engine: ANTHROPIC_KEY ? "claude-opus-4-5" : "static-rules",
      version: "v4-claude",
      hour_brt: currentHour,
      email_enabled: !!RESEND_API_KEY,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
