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
  // DTD (Day-to-date)
  dtd_spend: number;
  dtd_purchases: number;
  dtd_revenue: number;
  dtd_roas: number;
  dtd_cpa: number;
  // WTD (Week-to-date)
  wtd_spend: number;
  wtd_purchases: number;
  wtd_revenue: number;
  wtd_roas: number;
  wtd_cpa: number;
  // MTD (Month-to-date)
  mtd_spend: number;
  mtd_purchases: number;
  mtd_revenue: number;
  mtd_roas: number;
  mtd_cpa: number;
  // Engagement
  ctr: number;
  frequency: number;
  // Computed
  trend: string; // "improving" | "declining" | "stable"
}

interface Decision {
  campaign_id: string;
  adset_id?: string;
  action: string;
  reason: string;
  new_budget?: number;
  previous_budget?: number;
}

// ─── Helpers ───────────────────────────────────────────────

function dateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function getTimeframeRanges() {
  const now = new Date();
  const today = dateStr(now);

  // WTD: Monday of current week
  const dayOfWeek = now.getDay(); // 0=Sun
  const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - mondayOffset);
  const wtdSince = dateStr(monday);

  // MTD: 1st of current month
  const mtdSince = `${today.slice(0, 7)}-01`;

  return { today, wtdSince, mtdSince };
}

function parseMetrics(ins: any) {
  if (!ins) return { spend: 0, purchases: 0, revenue: 0, ctr: 0, frequency: 0 };
  const spend = parseFloat(ins.spend || "0");
  const purchases = (ins.actions || [])
    .filter((a: any) => a.action_type === "purchase" || a.action_type === "omni_purchase")
    .reduce((s: number, a: any) => s + parseInt(a.value || "0", 10), 0);
  const revenue = (ins.action_values || [])
    .filter((a: any) => a.action_type === "purchase" || a.action_type === "omni_purchase")
    .reduce((s: number, a: any) => s + parseFloat(a.value || "0"), 0);
  return {
    spend,
    purchases,
    revenue,
    ctr: parseFloat(ins.ctr || "0"),
    frequency: parseFloat(ins.frequency || "0"),
  };
}

function determineTrend(dtdRoas: number, wtdRoas: number, mtdRoas: number): string {
  if (dtdRoas > wtdRoas * 1.15 && wtdRoas >= mtdRoas * 0.9) return "improving";
  if (dtdRoas < wtdRoas * 0.7 || (wtdRoas < mtdRoas * 0.7 && mtdRoas > 0)) return "declining";
  return "stable";
}

function currentHourBRT(): number {
  // Brazil BRT = UTC-3
  const utcHour = new Date().getUTCHours();
  return (utcHour - 3 + 24) % 24;
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
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Você é o MTX Autonomous Agent v2 — um gestor de tráfego autônomo SÊNIOR que opera com profundidade analítica real. Você NÃO é superficial. Cada decisão é justificada com dados cruzados de 3 janelas temporais.

HORA ATUAL (BRT): ${currentHour}:00
PERÍODO: ${isLateNight ? "MADRUGADA (0h-6h) — Muitos negócios noturnos operam aqui" : isNighttime ? "NOTURNO (22h-0h) — Pico de delivery/entretenimento" : currentHour < 12 ? "MANHÃ" : currentHour < 18 ? "TARDE" : "INÍCIO DA NOITE"}

## FRAMEWORK DE ANÁLISE MULTI-TEMPORAL (OBRIGATÓRIO)

Para CADA campanha, cruze 3 janelas:
1. **DTD (Day-to-date)**: Dados do dia ATUAL. Indica performance em tempo real.
2. **WTD (Week-to-date)**: Dados da semana. Indica tendência de curto prazo.
3. **MTD (Month-to-date)**: Dados do mês. Indica consistência e baseline.

### Lógica de cruzamento:
- Se DTD é ruim MAS WTD e MTD são bons → NÃO pausar precipitadamente. Pode ser flutuação pontual.
- Se DTD e WTD são ruins MAS MTD é bom → Sinal de DEGRADAÇÃO RECENTE. Monitorar ou reduzir budget levemente.
- Se as 3 janelas são ruins → PAUSAR ou ROLLBACK imediato.
- Se DTD é excelente E WTD confirma tendência positiva → ESCALAR com confiança.
- Se apenas DTD é bom mas WTD/MTD são fracos → NÃO escalar. Pode ser pico isolado.

### Análise de TREND:
- "improving": DTD > WTD em 15%+ → Campanha ganhando tração
- "declining": DTD < WTD em 30%+ → Campanha perdendo força
- "stable": Variação normal

## REGRAS DE NEGÓCIO COM HORÁRIOS

IMPORTANTE: Alguns negócios operam principalmente à noite (ex: hamburguerias, delivery, entretenimento).
- ${isNighttime || isLateNight ? "⚡ ESTAMOS NO HORÁRIO NOTURNO. Negócios noturnos podem estar em seu PICO. NÃO pausar campanhas de negócios noturnos por 'baixa performance DTD' se o dia mal começou para eles." : "Horário comercial normal."}
- Se o nome do perfil ou campanha sugere negócio noturno (delivery, burger, pizza, bar, club, etc.) → Ponderar que o DTD pode estar vazio por ser cedo demais.
- Para negócios noturnos no horário diurno: avaliar WTD/MTD como referência principal.

## REGRAS ABSOLUTAS

### PAUSA (Guardian):
- CPA real > CPA máximo tolerável × 1.15 → PAUSAR (mas cruzar com WTD/MTD antes)
- Gasto > 50% do budget diário E 0 conversões no DTD E WTD também sem tração → PAUSAR
- Frequência > 3.0 E CTR < 0.8% → PAUSAR (saturação confirmada)
- NUNCA pausar uma campanha lucrativa (ROAS WTD > ${profileConfig.roas_min_escala || 2}) baseado apenas no DTD

### ESCALA HORIZONTAL (Budget Increase):
- ROAS WTD > ${profileConfig.roas_min_escala} E purchases WTD >= 3 E trend != "declining" → ESCALAR
- Incremento: +${profileConfig.limite_escala}% do orçamento atual
- Teto diário: R$ ${profileConfig.teto_diario_escala}
- NÃO escalar se frequência > 2.5 E CTR < 1.0%
- CONFIANÇA EXTRA se MTD confirma (ROAS MTD > ${profileConfig.roas_min_escala}) → escalar sem hesitar

### ROLLBACK DE ESCALA:
${profileConfig.rollback_enabled ? `- Limiar: ${profileConfig.rollback_roas_threshold}x
- Se budget atual > budget anterior estimado E DTD_ROAS ≥ ${profileConfig.rollback_roas_threshold}x E DTD_purchases == 0 → ROLLBACK
- Use dados DTD exclusivamente para esta regra
- EXCEÇÃO: se WTD_ROAS < ${profileConfig.rollback_roas_threshold}x → NÃO fazer rollback` : "- DESATIVADO pelo usuário."}

### ESCALA VERTICAL (Duplicação):
- Budget >= 80% do teto R$ ${profileConfig.teto_diario_escala} E ROAS WTD > ${profileConfig.roas_min_escala} E purchases WTD >= 3 → DUPLICAR
- Use "duplicate_scale" como action

### MANUTENÇÃO:
- Se campanhas estão dentro dos parâmetros → NÃO listar. Retorne apenas campanhas que precisam de ação.

## FORMATO DA RESPOSTA
Para cada decisão, inclua:
- Dados das 3 janelas que sustentam a decisão
- Trend observado
- Justificativa cruzada (ex: "WTD confirma degradação vista no DTD, MTD ainda positivo mas tendência é de queda")`,
          },
          {
            role: "user",
            content: `Perfil: ${profileName}
CPA Meta: R$ ${profileConfig.cpa_meta} | CPA Máx Tolerável: R$ ${profileConfig.cpa_max_toleravel}
ROAS Mínimo Escala: ${profileConfig.roas_min_escala} | Teto Diário: R$ ${profileConfig.teto_diario_escala}
Limite Escala: ${profileConfig.limite_escala}%

📊 CAMPANHAS (DTD | WTD | MTD):
${campaigns.map(c => `━━ ${c.name} [${c.trend.toUpperCase()}]
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

Analise com profundidade e retorne decisões.`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "execute_decisions",
              description: "Execute autonomous campaign management decisions based on multi-temporal analysis",
              parameters: {
                type: "object",
                properties: {
                  decisions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        campaign_id: { type: "string" },
                        adset_id: { type: "string", description: "Required for duplicate_scale actions" },
                        action: { type: "string", enum: ["pause", "scale", "duplicate_scale", "rollback", "maintain"] },
                        reason: { type: "string", description: "Detailed multi-temporal justification with DTD/WTD/MTD data" },
                        new_budget: { type: "number", description: "New daily budget in currency (not cents)" },
                        previous_budget: { type: "number", description: "Previous budget before change" },
                      },
                      required: ["campaign_id", "action", "reason"],
                      additionalProperties: false,
                    },
                  },
                  summary: { type: "string", description: "Resumo executivo com contexto temporal e horário do dia." },
                },
                required: ["decisions", "summary"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "execute_decisions" } },
      }),
    });

    if (!resp.ok) {
      console.warn("AI decision failed:", resp.status);
      return { decisions: [], summary: "AI indisponível, usando regras estáticas." };
    }

    clearTimeout(timeout);
    const data = await resp.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      return { decisions: [], summary: "AI não retornou decisões estruturadas." };
    }

    return JSON.parse(toolCall.function.arguments);
  } catch (e) {
    console.error("AI decision error:", e);
    return { decisions: [], summary: "Erro na IA, usando regras estáticas." };
  }
}

// ─── Static Rules Fallback (also multi-temporal) ───────────

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
        decisions.push({
          campaign_id: c.id, action: "rollback",
          reason: `DTD: ROAS ${c.dtd_roas.toFixed(2)}x ≥ ${rollbackThreshold}x mas 0 vendas hoje. WTD: ${c.wtd_purchases} vendas. Rollback para R$ ${estimatedPrevBudget.toFixed(2)}.`,
          new_budget: estimatedPrevBudget, previous_budget: c.daily_budget,
        });
        continue;
      }
    }

    // Guardian: CPA too high — cross-reference WTD
    if (profileConfig.cpa_max_toleravel > 0 && c.wtd_spend > 0) {
      const threshold = profileConfig.cpa_max_toleravel * 1.15;
      const wtdCpa = c.wtd_purchases > 0 ? c.wtd_spend / c.wtd_purchases : c.wtd_spend;
      const dtdCpa = c.dtd_purchases > 0 ? c.dtd_spend / c.dtd_purchases : c.dtd_spend;
      // Only pause if BOTH DTD and WTD show bad CPA
      if (wtdCpa > threshold && (c.dtd_purchases === 0 || dtdCpa > threshold)) {
        decisions.push({ campaign_id: c.id, action: "pause", reason: `CPA WTD R$ ${wtdCpa.toFixed(2)} e DTD R$ ${dtdCpa.toFixed(2)} > limite R$ ${threshold.toFixed(2)}. MTD ROAS: ${c.mtd_roas.toFixed(2)}x.` });
        continue;
      }
    }

    // Scale — based on WTD confirmed by MTD
    if (profileConfig.roas_min_escala > 0 && c.wtd_purchases >= 3 && c.wtd_roas >= profileConfig.roas_min_escala && c.trend !== "declining") {
      if (c.frequency > 2.5 && c.ctr < 1.0) continue;
      const teto = profileConfig.teto_diario_escala || 0;
      const newBudget = c.daily_budget * (1 + profileConfig.limite_escala / 100);

      // Vertical scale if near ceiling
      if (profileConfig.vertical_scale_enabled && teto > 0 && c.daily_budget >= teto * 0.8) {
        const campaignAdsets = adsets.filter((a: any) => a.campaign_id === c.id);
        if (campaignAdsets.length > 0) {
          const bestAdset = campaignAdsets.sort((a: any, b: any) => parseFloat(b.insights?.data?.[0]?.spend || "0") - parseFloat(a.insights?.data?.[0]?.spend || "0"))[0];
          decisions.push({
            campaign_id: c.id, adset_id: bestAdset.id, action: "duplicate_scale",
            reason: `Budget R$ ${c.daily_budget.toFixed(0)} ≥80% teto R$ ${teto}. WTD ROAS: ${c.wtd_roas.toFixed(2)}x, MTD: ${c.mtd_roas.toFixed(2)}x. Duplicando.`,
            new_budget: c.daily_budget,
          });
          continue;
        }
      }

      if (teto > 0 && newBudget > teto) continue;
      decisions.push({
        campaign_id: c.id, action: "scale",
        reason: `WTD ROAS ${c.wtd_roas.toFixed(2)}x > min ${profileConfig.roas_min_escala}, ${c.wtd_purchases} vendas. Trend: ${c.trend}. MTD confirma: ${c.mtd_roas.toFixed(2)}x.`,
        new_budget: newBudget,
      });
    }
  }

  return decisions;
}

// ─── Adset Duplication ─────────────────────────────────────

async function duplicateAdset(adsetId: string, accessToken: string, newName?: string): Promise<{ success: boolean; new_adset_id?: string; error?: string }> {
  try {
    const copyResp = await fetch(`https://graph.facebook.com/v23.0/${adsetId}/copies`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deep_copy: true,
        rename_options: newName ? { rename_strategy: "DEEP_RENAME", rename_prefix: newName } : undefined,
        status_option: "ACTIVE",
        access_token: accessToken,
      }),
    });
    const copyData = await copyResp.json();
    if (copyData.error) return { success: false, error: copyData.error.message || JSON.stringify(copyData.error) };
    const newId = copyData.copied_adset_id || copyData.ad_object_ids?.[0];
    if (!newId) return { success: false, error: "Meta API não retornou o ID do adset copiado." };
    return { success: true, new_adset_id: newId };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

// ─── Meta API Fetchers ─────────────────────────────────────

async function fetchInsightsForRange(accountId: string, accessToken: string, since: string, until: string): Promise<Map<string, any>> {
  const url = `https://graph.facebook.com/v23.0/${accountId}/insights?fields=campaign_id,spend,actions,action_values,ctr,frequency&time_range={"since":"${since}","until":"${until}"}&level=campaign&limit=500&access_token=${accessToken}`;
  try {
    const resp = await fetch(url);
    const data = await resp.json();
    const map = new Map<string, any>();
    for (const row of (data.data || [])) {
      map.set(row.campaign_id, row);
    }
    return map;
  } catch {
    return new Map();
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

    const { data: profiles, error } = await sb
      .from("client_profiles")
      .select("*")
      .or("cpa_max_toleravel.gt.0,roas_min_escala.gt.0");

    if (error) throw error;
    if (!profiles || profiles.length === 0) {
      return new Response(JSON.stringify({ message: "No profiles with autonomous features enabled", timestamp: new Date().toISOString() }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { today, wtdSince, mtdSince } = getTimeframeRanges();
    const currentHour = currentHourBRT();

    console.log(`[MTX Agent v2] Running at ${currentHour}:00 BRT | Profiles: ${profiles.length} | Timeframes: DTD=${today}, WTD=${wtdSince}, MTD=${mtdSince}`);

    const profilePromises = profiles
      .filter((profile: any) => {
        const accessToken = profile.meta_access_token || Deno.env.get("META_ACCESS_TOKEN");
        return accessToken && profile.ad_account_id && profile.ad_account_id !== "act_";
      })
      .map(async (profile: any) => {
        const accessToken = profile.meta_access_token || Deno.env.get("META_ACCESS_TOKEN");
        const profileResult: any = { profile: profile.name, profile_id: profile.id, actions: [], ai_summary: "", hour: currentHour };

        try {
          // Fetch all 3 timeframes + campaigns + adsets in parallel
          const campaignUrl = `https://graph.facebook.com/v23.0/${profile.ad_account_id}/campaigns?fields=id,name,effective_status,daily_budget&effective_status=["ACTIVE"]&access_token=${accessToken}&limit=100`;
          const adsetUrl = `https://graph.facebook.com/v23.0/${profile.ad_account_id}/adsets?fields=id,name,daily_budget,effective_status,campaign_id,insights.time_range({"since":"${wtdSince}","until":"${today}"}){spend,actions,action_values,ctr,frequency}&effective_status=["ACTIVE"]&access_token=${accessToken}&limit=100`;

          const [campaignResp, adsetResp, dtdMap, wtdMap, mtdMap] = await Promise.all([
            fetch(campaignUrl).then(r => r.json()),
            fetch(adsetUrl).then(r => r.json()),
            fetchInsightsForRange(profile.ad_account_id, accessToken, today, today),
            fetchInsightsForRange(profile.ad_account_id, accessToken, wtdSince, today),
            fetchInsightsForRange(profile.ad_account_id, accessToken, mtdSince, today),
          ]);

          if (campaignResp.error) {
            profileResult.error = campaignResp.error.message;
            return profileResult;
          }

          const adsetsList = adsetResp.data || [];

          // Build rich campaign insights with 3 timeframes
          const campaignInsights: CampaignInsight[] = (campaignResp.data || []).map((c: any) => {
            const dtd = parseMetrics(dtdMap.get(c.id));
            const wtd = parseMetrics(wtdMap.get(c.id));
            const mtd = parseMetrics(mtdMap.get(c.id));

            const dtdRoas = dtd.spend > 0 ? dtd.revenue / dtd.spend : 0;
            const wtdRoas = wtd.spend > 0 ? wtd.revenue / wtd.spend : 0;
            const mtdRoas = mtd.spend > 0 ? mtd.revenue / mtd.spend : 0;

            return {
              id: c.id,
              name: c.name,
              effective_status: c.effective_status,
              daily_budget: parseInt(c.daily_budget || "0", 10) / 100,
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
              limite_escala: profile.limite_escala,
              rollback_enabled: profile.rollback_enabled,
              rollback_roas_threshold: profile.rollback_roas_threshold,
            }, campaignInsights, adsetsList, currentHour);
            decisions = aiResult.decisions.filter((d: Decision) => d.action !== "maintain");
            if (!profile.vertical_scale_enabled) {
              decisions = decisions.filter((d: Decision) => d.action !== "duplicate_scale");
            }
            // SAFETY: block invalid AI pauses
            decisions = decisions.filter((d: Decision) => {
              if (d.action === "pause") {
                const campaign = campaignInsights.find((c) => c.id === d.campaign_id);
                if (!campaign) return true;
                const cpaThreshold = profile.cpa_max_toleravel * 1.15;
                // Don't pause if WTD CPA is within limits and has purchases
                if (profile.cpa_max_toleravel > 0 && campaign.wtd_cpa <= cpaThreshold && campaign.wtd_purchases > 0) {
                  console.log(`SAFETY: Blocked pause for "${campaign.name}" — WTD CPA R$${campaign.wtd_cpa.toFixed(2)} within limit`);
                  return false;
                }
                if (d.reason && (d.reason.includes("MANTER") || d.reason.includes("dentro dos limites"))) {
                  return false;
                }
                // Don't pause low-spend campaigns with WTD conversions
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
            aiSummary = `Análise estática v2 (${currentHour}h BRT): ${campaignInsights.length} campanhas verificadas com DTD/WTD/MTD.`;
          }

          profileResult.ai_summary = aiSummary;
          profileResult.campaigns_analyzed = campaignInsights.length;
          profileResult.timeframes = { dtd: today, wtd: wtdSince, mtd: mtdSince };

          // ─── Execute Decisions ───────────────────────
          for (const decision of decisions) {
            try {
              const campaign = campaignInsights.find((c) => c.id === decision.campaign_id);
              const campaignRaw = (campaignResp.data || []).find((c: any) => c.id === decision.campaign_id);

              if (decision.action === "pause") {
                const pauseResp = await fetch(`https://graph.facebook.com/v23.0/${decision.campaign_id}`, {
                  method: "POST", headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ status: "PAUSED", access_token: accessToken }),
                });
                const pauseData = await pauseResp.json();
                await sb.from("emergency_logs").insert({
                  profile_id: profile.id, user_id: profile.user_id, action_type: "agent_pause",
                  details: { campaign_id: decision.campaign_id, campaign_name: campaign?.name, reason: decision.reason, ai_driven: !!LOVABLE_API_KEY, success: pauseData.success || false, hour: currentHour, dtd_roas: campaign?.dtd_roas, wtd_roas: campaign?.wtd_roas, mtd_roas: campaign?.mtd_roas },
                });
                profileResult.actions.push({ ...decision, status: pauseData.success ? "EXECUTED" : "FAILED" });
              } else if (decision.action === "duplicate_scale") {
                const adsetId = decision.adset_id;
                if (!adsetId) { profileResult.actions.push({ ...decision, status: "SKIPPED", error: "adset_id ausente" }); continue; }
                const adset = adsetsList.find((a: any) => a.id === adsetId);
                const dupResult = await duplicateAdset(adsetId, accessToken, "[SCALE COPY 🚀] ");
                await sb.from("emergency_logs").insert({
                  profile_id: profile.id, user_id: profile.user_id, action_type: "agent_duplicate",
                  details: { campaign_id: decision.campaign_id, campaign_name: campaign?.name, original_adset_id: adsetId, original_adset_name: adset?.name, new_adset_id: dupResult.new_adset_id || null, reason: decision.reason, ai_driven: !!LOVABLE_API_KEY, success: dupResult.success, hour: currentHour },
                });
                profileResult.actions.push({ ...decision, new_adset_id: dupResult.new_adset_id, status: dupResult.success ? "DUPLICATED" : "FAILED", error: dupResult.error });
              } else if (decision.action === "rollback") {
                const currentBudget = parseInt(campaignRaw?.daily_budget || "0", 10) / 100;
                const rollbackBudget = decision.new_budget || currentBudget / (1 + profile.limite_escala / 100);
                const rollbackResp = await fetch(`https://graph.facebook.com/v23.0/${decision.campaign_id}`, {
                  method: "POST", headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ daily_budget: Math.round(rollbackBudget * 100), access_token: accessToken }),
                });
                const rollbackData = await rollbackResp.json();
                await sb.from("emergency_logs").insert({
                  profile_id: profile.id, user_id: profile.user_id, action_type: "agent_rollback",
                  details: { campaign_id: decision.campaign_id, campaign_name: campaign?.name, old_budget: currentBudget, new_budget: rollbackBudget, reason: decision.reason, ai_driven: !!LOVABLE_API_KEY, success: rollbackData.success || false, hour: currentHour },
                });
                profileResult.actions.push({ action: "rollback", campaign_id: decision.campaign_id, old_budget: currentBudget, new_budget: rollbackBudget, reason: decision.reason, status: rollbackData.success ? "ROLLED_BACK" : "FAILED" });
              } else if (decision.action === "scale") {
                const adsetsForCampaign = adsetsList.filter((a: any) => a.campaign_id === decision.campaign_id);
                const campaignBudget = parseInt(campaignRaw?.daily_budget || "0", 10) / 100;
                const isCBO = campaignBudget > 0;

                if (isCBO) {
                  const newBudget = campaignBudget * (1 + profile.limite_escala / 100);
                  const teto = profile.teto_diario_escala || 0;
                  if (teto > 0 && newBudget > teto) {
                    profileResult.actions.push({ action: "scale", campaign_id: decision.campaign_id, reason: "Teto atingido", status: "ABORTED_CEILING" });
                  } else {
                    const scaleResp = await fetch(`https://graph.facebook.com/v23.0/${decision.campaign_id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ daily_budget: Math.round(newBudget * 100), access_token: accessToken }) });
                    const scaleData = await scaleResp.json();
                    await sb.from("emergency_logs").insert({ profile_id: profile.id, user_id: profile.user_id, action_type: "agent_scale", details: { campaign_id: decision.campaign_id, campaign_name: campaign?.name, old_budget: campaignBudget, new_budget: newBudget, level: "campaign", reason: decision.reason, ai_driven: !!LOVABLE_API_KEY, success: scaleData.success || false, hour: currentHour } });
                    profileResult.actions.push({ action: "scale", campaign_id: decision.campaign_id, old_budget: campaignBudget, new_budget: newBudget, reason: decision.reason, status: scaleData.success ? "EXECUTED" : "FAILED" });
                  }
                } else {
                  for (const adset of adsetsForCampaign) {
                    const currentBudget = parseInt(adset.daily_budget || "0", 10) / 100;
                    if (currentBudget <= 0) continue;
                    const newBudget = currentBudget * (1 + profile.limite_escala / 100);
                    const teto = profile.teto_diario_escala || 0;
                    if (teto > 0 && newBudget > teto) continue;
                    const scaleResp = await fetch(`https://graph.facebook.com/v23.0/${adset.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ daily_budget: Math.round(newBudget * 100), access_token: accessToken }) });
                    const scaleData = await scaleResp.json();
                    await sb.from("emergency_logs").insert({ profile_id: profile.id, user_id: profile.user_id, action_type: "agent_scale", details: { adset_id: adset.id, adset_name: adset.name, campaign_id: decision.campaign_id, old_budget: currentBudget, new_budget: newBudget, level: "adset", reason: decision.reason, ai_driven: !!LOVABLE_API_KEY, success: scaleData.success || false, hour: currentHour } });
                    profileResult.actions.push({ action: "scale", adset_id: adset.id, adset_name: adset.name, old_budget: currentBudget, new_budget: newBudget, reason: decision.reason, status: scaleData.success ? "EXECUTED" : "FAILED" });
                  }
                }
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

    console.log(`[MTX Agent v2] Completed. Profiles: ${results.length}. Total actions: ${results.reduce((s: number, r: any) => s + (r.actions?.length || 0), 0)}`);

    return new Response(JSON.stringify({ results, timestamp: new Date().toISOString(), ai_enabled: !!LOVABLE_API_KEY, version: "v2-deep-analysis", hour_brt: currentHour }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
