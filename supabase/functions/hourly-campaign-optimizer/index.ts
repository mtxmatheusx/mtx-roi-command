import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MIN_DAYS_BEFORE_PAUSE = 4;

function dateStr(d: Date): string { return d.toISOString().slice(0, 10); }
function currentHourBRT(): number { return (new Date().getUTCHours() - 3 + 24) % 24; }

function getDaypart(hour: number): string {
  if (hour >= 6 && hour < 12) return "morning";
  if (hour >= 12 && hour < 18) return "afternoon";
  if (hour >= 18 && hour < 24) return "evening";
  return "latenight";
}

function getDaypartLabel(dp: string): string {
  const labels: Record<string, string> = { morning: "Manhã (6h-12h)", afternoon: "Tarde (12h-18h)", evening: "Noite (18h-0h)", latenight: "Madrugada (0h-6h)" };
  return labels[dp] || dp;
}

function campaignAgeDays(createdTime: string): number {
  if (!createdTime) return 999;
  return Math.floor((new Date().getTime() - new Date(createdTime).getTime()) / 86400000);
}

interface DaypartConfig {
  enabled: boolean;
  morning: { enabled: boolean; multiplier: number };
  afternoon: { enabled: boolean; multiplier: number };
  evening: { enabled: boolean; multiplier: number };
  latenight: { enabled: boolean; multiplier: number };
  auto_learn: boolean;
}

const defaultDaypartConfig: DaypartConfig = {
  enabled: false,
  morning: { enabled: true, multiplier: 1.0 },
  afternoon: { enabled: true, multiplier: 1.0 },
  evening: { enabled: true, multiplier: 1.0 },
  latenight: { enabled: true, multiplier: 1.0 },
  auto_learn: true,
};

function parseMetrics(ins: any) {
  if (!ins) return { spend: 0, purchases: 0, revenue: 0, ctr: 0, cpc: 0, impressions: 0, clicks: 0 };
  const spend = parseFloat(ins.spend || "0");
  const purchases = (ins.actions || []).filter((a: any) => a.action_type === "purchase" || a.action_type === "omni_purchase").reduce((s: number, a: any) => s + parseInt(a.value || "0", 10), 0);
  const revenue = (ins.action_values || []).filter((a: any) => a.action_type === "purchase" || a.action_type === "omni_purchase").reduce((s: number, a: any) => s + parseFloat(a.value || "0"), 0);
  return { spend, purchases, revenue, ctr: parseFloat(ins.ctr || "0"), cpc: parseFloat(ins.cpc || "0"), impressions: parseInt(ins.impressions || "0", 10), clicks: parseInt(ins.clicks || "0", 10) };
}

// ─── Retry wrapper ─────────────────────────────────────────

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
        if ((resp.status === 429 || data.error.code === 32 || data.error.code === 4 || resp.status >= 500 || data.error.is_transient) && attempt <= maxRetries) {
          console.warn(`[Retry ${attempt}] ${lastError}`);
          await new Promise(r => setTimeout(r, delayMs * attempt));
          continue;
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

// ─── Meta API Fetchers ─────────────────────────────────────

async function fetchHourlyBreakdown(accountId: string, accessToken: string, today: string): Promise<any[]> {
  const url = `https://graph.facebook.com/v23.0/${accountId}/insights?fields=campaign_id,campaign_name,spend,actions,action_values,impressions,clicks,ctr,cpc&time_range={"since":"${today}","until":"${today}"}&time_increment=1&breakdowns=hourly_stats_aggregated_by_advertiser_time_zone&level=campaign&limit=500&access_token=${accessToken}`;
  try { const resp = await fetch(url); const data = await resp.json(); return data.data || []; } catch { return []; }
}

async function fetchWeeklyHourlyPattern(accountId: string, accessToken: string): Promise<Map<string, { spend: number; purchases: number; revenue: number }>> {
  const since = dateStr(new Date(Date.now() - 7 * 86400000));
  const until = dateStr(new Date(Date.now() - 86400000));
  const url = `https://graph.facebook.com/v23.0/${accountId}/insights?fields=spend,actions,action_values&time_range={"since":"${since}","until":"${until}"}&breakdowns=hourly_stats_aggregated_by_advertiser_time_zone&level=account&limit=500&access_token=${accessToken}`;
  try {
    const resp = await fetch(url); const data = await resp.json();
    const map = new Map<string, { spend: number; purchases: number; revenue: number }>();
    for (const row of (data.data || [])) {
      const hourRange = row.hourly_stats_aggregated_by_advertiser_time_zone || "";
      const m = parseMetrics(row);
      const existing = map.get(hourRange) || { spend: 0, purchases: 0, revenue: 0 };
      map.set(hourRange, { spend: existing.spend + m.spend, purchases: existing.purchases + m.purchases, revenue: existing.revenue + m.revenue });
    }
    return map;
  } catch { return new Map(); }
}

async function fetchTodayInsights(accountId: string, accessToken: string, today: string): Promise<Map<string, any>> {
  const url = `https://graph.facebook.com/v23.0/${accountId}/insights?fields=campaign_id,spend,actions,action_values,impressions,clicks,ctr&time_range={"since":"${today}","until":"${today}"}&level=campaign&limit=500&access_token=${accessToken}`;
  try { const resp = await fetch(url); const data = await resp.json(); const map = new Map<string, any>(); for (const row of (data.data || [])) map.set(row.campaign_id, row); return map; } catch { return new Map(); }
}

async function fetchYesterdayInsights(accountId: string, accessToken: string, yesterday: string): Promise<Map<string, any>> {
  const url = `https://graph.facebook.com/v23.0/${accountId}/insights?fields=campaign_id,spend,actions,action_values,impressions,clicks,ctr&time_range={"since":"${yesterday}","until":"${yesterday}"}&level=campaign&limit=500&access_token=${accessToken}`;
  try { const resp = await fetch(url); const data = await resp.json(); const map = new Map<string, any>(); for (const row of (data.data || [])) map.set(row.campaign_id, row); return map; } catch { return new Map(); }
}

// ─── AI Decision Engine ────────────────────────────────────

async function getHourlyAIDecision(
  LOVABLE_API_KEY: string, profileName: string, profileConfig: any,
  campaignSummaries: any[], hourlyData: any[], currentHour: number,
  businessStart: number, businessEnd: number, daypartConfig: DaypartConfig,
  weeklyPattern: Map<string, { spend: number; purchases: number; revenue: number }>,
): Promise<{ decisions: any[]; summary: string }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);
    const isWithinBusinessHours = businessEnd > businessStart ? (currentHour >= businessStart && currentHour < businessEnd) : (currentHour >= businessStart || currentHour < businessEnd);
    const isPrePeak = businessEnd > businessStart ? (currentHour >= businessStart - 2 && currentHour < businessStart) : (currentHour >= businessStart - 2 || currentHour < businessStart);

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST", signal: controller.signal,
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Você é o MTX Hourly Optimizer v3 — otimizador horário com dayparting e proteção de campanhas jovens.

⏰ HORA ATUAL (BRT): ${currentHour}:00
📍 HORÁRIO COMERCIAL: ${businessStart}h às ${businessEnd}h
📊 STATUS: ${isWithinBusinessHours ? "⚡ HORÁRIO COMERCIAL" : isPrePeak ? "🔜 PRÉ-PICO" : "😴 FORA DO HORÁRIO"}
🕐 DAYPART: ${getDaypartLabel(getDaypart(currentHour))}

## 🚨 REGRA ABSOLUTA: PROTEÇÃO DE CAMPANHAS JOVENS

**PROIBIÇÃO TOTAL**: Campanhas com MENOS de ${MIN_DAYS_BEFORE_PAUSE} dias desde a criação NÃO PODEM ser PAUSADAS.
- Campanhas jovens estão em fase de APRENDIZADO do algoritmo Meta.
- Pausar destrói o aprendizado e desperdiça investimento.
- Para campanhas jovens: PODE otimizar (scale/reduce/daypart_adjust), NUNCA pausar.
- A IDADE de cada campanha está nos dados. VERIFIQUE antes de pausar.

## DAYPARTING
${daypartConfig.enabled ? `✅ ATIVO — Multiplicadores:
- Manhã: ${daypartConfig.morning.enabled ? `${daypartConfig.morning.multiplier}x` : "OFF"}
- Tarde: ${daypartConfig.afternoon.enabled ? `${daypartConfig.afternoon.multiplier}x` : "OFF"}
- Noite: ${daypartConfig.evening.enabled ? `${daypartConfig.evening.multiplier}x` : "OFF"}
- Madrugada: ${daypartConfig.latenight.enabled ? `${daypartConfig.latenight.multiplier}x` : "OFF"}` : "❌ DESATIVADO"}

${daypartConfig.auto_learn ? `📈 PADRÃO SEMANAL:
${Array.from(weeklyPattern.entries()).sort().map(([hour, data]) => {
  const roas = data.spend > 0 ? (data.revenue / data.spend).toFixed(2) : "0";
  return `   ${hour}: spend=R$${data.spend.toFixed(0)} purchases=${data.purchases} roas=${roas}x`;
}).join("\n") || "   Sem dados"}` : ""}

## REGRAS
1. Pré-Pico: Garantir campaigns ativas
2. Horário Comercial: Sem conversões → Reduzir (não pausar se < ${MIN_DAYS_BEFORE_PAUSE} dias) | ROAS bom → Escalar
3. Fora do Horário: Pausar apenas se >= ${MIN_DAYS_BEFORE_PAUSE} dias; reduzir se jovem

### AÇÕES: pause, resume, scale, reduce, daypart_adjust, maintain
CPA Meta: R$ ${profileConfig.cpa_meta} | CPA Máx: R$ ${profileConfig.cpa_max_toleravel}
ROAS Min: ${profileConfig.roas_min_escala} | Teto: R$ ${profileConfig.teto_diario_escala}`,
          },
          {
            role: "user",
            content: `Perfil: ${profileName}

📊 CAMPANHAS:
${campaignSummaries.map(c => `━━ ${c.name} [${c.status}] ⏱ IDADE: ${c.age_days} dias ${c.age_days < MIN_DAYS_BEFORE_PAUSE ? "🛡️ PROTEGIDA" : ""}
   Budget: R$${c.daily_budget} | Spend: R$${c.today_spend.toFixed(2)} (${c.budget_pct.toFixed(0)}%)
   Purchases: ${c.today_purchases} | Revenue: R$${c.today_revenue.toFixed(2)} | ROAS: ${c.today_roas.toFixed(2)}x
   CPA: R$${c.today_cpa.toFixed(2)} | CTR: ${c.today_ctr.toFixed(2)}%
   Ontem: Spend R$${c.yesterday_spend.toFixed(2)} | ROAS ${c.yesterday_roas.toFixed(2)}x
   Variação: ${c.spend_change > 0 ? "+" : ""}${c.spend_change.toFixed(0)}% spend | ${c.roas_change > 0 ? "+" : ""}${c.roas_change.toFixed(0)}% roas`).join("\n")}

⏱ BREAKDOWN HORÁRIO:
${hourlyData.slice(-20).map(h => `   ${h.hourly_stats_aggregated_by_advertiser_time_zone || "?"} — ${h.campaign_name}: spend=R$${parseFloat(h.spend || "0").toFixed(2)} clicks=${h.clicks || 0}`).join("\n") || "   Sem dados"}

LEMBRE: Campanhas com < ${MIN_DAYS_BEFORE_PAUSE} dias NÃO podem ser pausadas. Analise e decida.`,
          },
        ],
        tools: [{
          type: "function",
          function: {
            name: "execute_hourly_decisions",
            description: "Execute hourly campaign optimization decisions",
            parameters: {
              type: "object",
              properties: {
                decisions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      campaign_id: { type: "string" },
                      action: { type: "string", enum: ["pause", "resume", "scale", "reduce", "daypart_adjust", "maintain"] },
                      reason: { type: "string" },
                      new_budget: { type: "number" },
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
        tool_choice: { type: "function", function: { name: "execute_hourly_decisions" } },
      }),
    });

    if (!resp.ok) { console.warn("Hourly AI failed:", resp.status); return { decisions: [], summary: "AI indisponível." }; }
    clearTimeout(timeout);
    const data = await resp.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) return { decisions: [], summary: "AI não retornou decisões." };
    return JSON.parse(toolCall.function.arguments);
  } catch (e) {
    console.error("Hourly AI error:", e);
    return { decisions: [], summary: "Erro na IA horária." };
  }
}

// ─── Main Handler ──────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const sb = createClient(supabaseUrl, supabaseKey);

    let targetProfileId: string | null = null;
    let targetCampaignIds: string[] | null = null;
    try {
      const text = await req.text();
      if (text) { const body = JSON.parse(text); targetProfileId = body.profile_id || null; targetCampaignIds = body.campaign_ids || null; }
    } catch { /* empty body OK */ }

    let query = sb.from("client_profiles").select("*");
    if (targetProfileId) { query = query.eq("id", targetProfileId); } else { query = query.eq("hourly_optimizer_enabled", true); }

    const { data: profiles, error } = await query;
    if (error) throw error;
    if (!profiles || profiles.length === 0) {
      return new Response(JSON.stringify({ message: "No profiles with hourly optimizer enabled" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const today = dateStr(new Date());
    const yesterday = dateStr(new Date(Date.now() - 86400000));
    const currentHour = currentHourBRT();

    console.log(`[MTX Hourly v3] ${currentHour}:00 BRT | Profiles: ${profiles.length}`);

    const profilePromises = profiles
      .filter((profile: any) => {
        const accessToken = profile.meta_access_token || Deno.env.get("META_ACCESS_TOKEN");
        return accessToken && profile.ad_account_id && profile.ad_account_id !== "act_";
      })
      .map(async (profile: any) => {
        const accessToken = profile.meta_access_token || Deno.env.get("META_ACCESS_TOKEN");
        const businessStart = profile.business_hours_start ?? 8;
        const businessEnd = profile.business_hours_end ?? 23;
        const daypart: DaypartConfig = { ...defaultDaypartConfig, ...(profile.daypart_config || {}) };
        const currentDaypart = getDaypart(currentHour);
        const profileResult: any = {
          profile: profile.name, profile_id: profile.id, actions: [], ai_summary: "", hour: currentHour,
          business_hours: `${businessStart}h-${businessEnd}h`, daypart: currentDaypart,
          daypart_multiplier: daypart.enabled ? (daypart as any)[currentDaypart]?.multiplier ?? 1.0 : 1.0,
        };

        try {
          // Fetch campaigns WITH created_time for age calculation
          const campaignUrl = `https://graph.facebook.com/v23.0/${profile.ad_account_id}/campaigns?fields=id,name,effective_status,daily_budget,created_time&effective_status=["ACTIVE","PAUSED"]&access_token=${accessToken}&limit=100`;

          const [campaignResp, todayMap, yesterdayMap, hourlyData, weeklyPattern] = await Promise.all([
            fetch(campaignUrl).then(r => r.json()),
            fetchTodayInsights(profile.ad_account_id, accessToken, today),
            fetchYesterdayInsights(profile.ad_account_id, accessToken, yesterday),
            fetchHourlyBreakdown(profile.ad_account_id, accessToken, today),
            daypart.auto_learn ? fetchWeeklyHourlyPattern(profile.ad_account_id, accessToken) : Promise.resolve(new Map()),
          ]);

          if (campaignResp.error) { profileResult.error = campaignResp.error.message; return profileResult; }

          let campaigns = campaignResp.data || [];
          if (targetCampaignIds && targetCampaignIds.length > 0) {
            campaigns = campaigns.filter((c: any) => targetCampaignIds!.includes(c.id));
          }

          const campaignSummaries = campaigns.map((c: any) => {
            const todayIns = parseMetrics(todayMap.get(c.id));
            const yesterdayIns = parseMetrics(yesterdayMap.get(c.id));
            const dailyBudget = parseInt(c.daily_budget || "0", 10) / 100;
            const todayRoas = todayIns.spend > 0 ? todayIns.revenue / todayIns.spend : 0;
            const yesterdayRoas = yesterdayIns.spend > 0 ? yesterdayIns.revenue / yesterdayIns.spend : 0;
            const ageDays = campaignAgeDays(c.created_time);

            return {
              id: c.id, name: c.name, status: c.effective_status,
              daily_budget: dailyBudget, age_days: ageDays,
              today_spend: todayIns.spend, today_purchases: todayIns.purchases, today_revenue: todayIns.revenue,
              today_roas: todayRoas, today_cpa: todayIns.purchases > 0 ? todayIns.spend / todayIns.purchases : todayIns.spend,
              today_ctr: todayIns.ctr, budget_pct: dailyBudget > 0 ? (todayIns.spend / dailyBudget) * 100 : 0,
              yesterday_spend: yesterdayIns.spend, yesterday_purchases: yesterdayIns.purchases,
              yesterday_revenue: yesterdayIns.revenue, yesterday_roas: yesterdayRoas,
              spend_change: yesterdayIns.spend > 0 ? ((todayIns.spend - yesterdayIns.spend) / yesterdayIns.spend) * 100 : 0,
              roas_change: yesterdayRoas > 0 ? ((todayRoas - yesterdayRoas) / yesterdayRoas) * 100 : 0,
            };
          });

          // Get AI decisions
          let decisions: any[] = [];
          let aiSummary = "";

          if (LOVABLE_API_KEY && campaignSummaries.length > 0) {
            const aiResult = await getHourlyAIDecision(
              LOVABLE_API_KEY, profile.name,
              { cpa_meta: profile.cpa_meta, cpa_max_toleravel: profile.cpa_max_toleravel, roas_min_escala: profile.roas_min_escala, teto_diario_escala: profile.teto_diario_escala, limite_escala: profile.limite_escala },
              campaignSummaries, hourlyData, currentHour, businessStart, businessEnd, daypart, weeklyPattern
            );
            decisions = aiResult.decisions.filter((d: any) => d.action !== "maintain");

            // 🛡️ HARD SAFETY: Block pause for young campaigns
            decisions = decisions.map((d: any) => {
              if (d.action === "pause") {
                const campaign = campaignSummaries.find((c: any) => c.id === d.campaign_id);
                if (campaign && campaign.age_days < MIN_DAYS_BEFORE_PAUSE) {
                  console.log(`🛡️ HOURLY PROTECTION: Blocked pause for "${campaign.name}" — ${campaign.age_days} days old`);
                  return {
                    ...d, action: "reduce",
                    reason: `[Auto-convertido] Campanha jovem (${campaign.age_days}d < ${MIN_DAYS_BEFORE_PAUSE}d). Pausa bloqueada → redução 30%. ${d.reason}`,
                    new_budget: campaign.daily_budget * 0.7,
                  };
                }
              }
              return d;
            });

            aiSummary = aiResult.summary;
          } else {
            aiSummary = `Análise horária (${currentHour}h): ${campaignSummaries.length} campanhas. IA indisponível.`;
          }

          profileResult.ai_summary = aiSummary;
          profileResult.campaigns_analyzed = campaignSummaries.length;

          // Execute decisions (with retry)
          for (const decision of decisions) {
            try {
              const campaign = campaignSummaries.find((c: any) => c.id === decision.campaign_id);
              if (!campaign) continue;

              if (decision.action === "pause") {
                const result = await metaApiCallWithRetry(
                  `https://graph.facebook.com/v23.0/${decision.campaign_id}`,
                  { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "PAUSED", access_token: accessToken }) },
                );
                await sb.from("emergency_logs").insert({
                  profile_id: profile.id, user_id: profile.user_id, action_type: "hourly_pause",
                  details: { campaign_id: decision.campaign_id, campaign_name: campaign.name, reason: decision.reason, hour: currentHour, success: result.success, attempts: result.attempts, age_days: campaign.age_days },
                });
                profileResult.actions.push({ ...decision, campaign_name: campaign.name, status: result.success ? "PAUSED" : "FAILED", attempts: result.attempts });

              } else if (decision.action === "resume") {
                const result = await metaApiCallWithRetry(
                  `https://graph.facebook.com/v23.0/${decision.campaign_id}`,
                  { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "ACTIVE", access_token: accessToken }) },
                );
                await sb.from("emergency_logs").insert({
                  profile_id: profile.id, user_id: profile.user_id, action_type: "hourly_resume",
                  details: { campaign_id: decision.campaign_id, campaign_name: campaign.name, reason: decision.reason, hour: currentHour, success: result.success, attempts: result.attempts },
                });
                profileResult.actions.push({ ...decision, campaign_name: campaign.name, status: result.success ? "RESUMED" : "FAILED", attempts: result.attempts });

              } else if (decision.action === "daypart_adjust" || decision.action === "scale" || decision.action === "reduce") {
                const currentBudget = campaign.daily_budget;
                let newBudget: number;
                if (decision.action === "daypart_adjust") {
                  const multiplier = (daypart as any)[currentDaypart]?.multiplier ?? 1.0;
                  newBudget = decision.new_budget || currentBudget * multiplier;
                } else if (decision.action === "scale") {
                  newBudget = decision.new_budget || currentBudget * (1 + profile.limite_escala / 100);
                } else {
                  newBudget = decision.new_budget || currentBudget * 0.7;
                }
                const teto = profile.teto_diario_escala || 0;
                if (decision.action === "scale" && teto > 0 && newBudget > teto) {
                  profileResult.actions.push({ ...decision, status: "ABORTED_CEILING" }); continue;
                }
                const result = await metaApiCallWithRetry(
                  `https://graph.facebook.com/v23.0/${decision.campaign_id}`,
                  { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ daily_budget: Math.round(newBudget * 100), access_token: accessToken }) },
                );
                const actionType = decision.action === "daypart_adjust" ? "hourly_daypart" : decision.action === "scale" ? "hourly_scale" : "hourly_reduce";
                await sb.from("emergency_logs").insert({
                  profile_id: profile.id, user_id: profile.user_id, action_type: actionType,
                  details: { campaign_id: decision.campaign_id, campaign_name: campaign.name, old_budget: currentBudget, new_budget: newBudget, daypart: currentDaypart, reason: decision.reason, hour: currentHour, success: result.success, attempts: result.attempts, age_days: campaign.age_days },
                });
                profileResult.actions.push({ ...decision, campaign_name: campaign.name, old_budget: currentBudget, new_budget: newBudget, status: result.success ? "EXECUTED" : "FAILED", attempts: result.attempts });
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
    console.log(`[MTX Hourly v3] Done. Actions: ${results.reduce((s: number, r: any) => s + (r.actions?.length || 0), 0)}`);

    return new Response(JSON.stringify({ results, timestamp: new Date().toISOString(), version: "hourly-v3-protected", hour_brt: currentHour }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
