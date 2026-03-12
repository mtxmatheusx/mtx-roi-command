import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function dateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function currentHourBRT(): number {
  return (new Date().getUTCHours() - 3 + 24) % 24;
}

function parseMetrics(ins: any) {
  if (!ins) return { spend: 0, purchases: 0, revenue: 0, ctr: 0, cpc: 0, impressions: 0, clicks: 0 };
  const spend = parseFloat(ins.spend || "0");
  const impressions = parseInt(ins.impressions || "0", 10);
  const clicks = parseInt(ins.clicks || "0", 10);
  const purchases = (ins.actions || [])
    .filter((a: any) => a.action_type === "purchase" || a.action_type === "omni_purchase")
    .reduce((s: number, a: any) => s + parseInt(a.value || "0", 10), 0);
  const revenue = (ins.action_values || [])
    .filter((a: any) => a.action_type === "purchase" || a.action_type === "omni_purchase")
    .reduce((s: number, a: any) => s + parseFloat(a.value || "0"), 0);
  return { spend, purchases, revenue, ctr: parseFloat(ins.ctr || "0"), cpc: parseFloat(ins.cpc || "0"), impressions, clicks };
}

// Fetch hourly breakdown for today
async function fetchHourlyBreakdown(accountId: string, accessToken: string, today: string): Promise<any[]> {
  const url = `https://graph.facebook.com/v23.0/${accountId}/insights?fields=campaign_id,campaign_name,spend,actions,action_values,impressions,clicks,ctr,cpc&time_range={"since":"${today}","until":"${today}"}&time_increment=1&breakdowns=hourly_stats_aggregated_by_advertiser_time_zone&level=campaign&limit=500&access_token=${accessToken}`;
  try {
    const resp = await fetch(url);
    const data = await resp.json();
    return data.data || [];
  } catch {
    return [];
  }
}

// Fetch today-total insights per campaign
async function fetchTodayInsights(accountId: string, accessToken: string, today: string): Promise<Map<string, any>> {
  const url = `https://graph.facebook.com/v23.0/${accountId}/insights?fields=campaign_id,spend,actions,action_values,impressions,clicks,ctr&time_range={"since":"${today}","until":"${today}"}&level=campaign&limit=500&access_token=${accessToken}`;
  try {
    const resp = await fetch(url);
    const data = await resp.json();
    const map = new Map<string, any>();
    for (const row of (data.data || [])) map.set(row.campaign_id, row);
    return map;
  } catch {
    return new Map();
  }
}

// Fetch yesterday insights for comparison
async function fetchYesterdayInsights(accountId: string, accessToken: string, yesterday: string): Promise<Map<string, any>> {
  const url = `https://graph.facebook.com/v23.0/${accountId}/insights?fields=campaign_id,spend,actions,action_values,impressions,clicks,ctr&time_range={"since":"${yesterday}","until":"${yesterday}"}&level=campaign&limit=500&access_token=${accessToken}`;
  try {
    const resp = await fetch(url);
    const data = await resp.json();
    const map = new Map<string, any>();
    for (const row of (data.data || [])) map.set(row.campaign_id, row);
    return map;
  } catch {
    return new Map();
  }
}

async function getHourlyAIDecision(
  LOVABLE_API_KEY: string,
  profileName: string,
  profileConfig: any,
  campaignSummaries: any[],
  hourlyData: any[],
  currentHour: number,
  businessStart: number,
  businessEnd: number,
): Promise<{ decisions: any[]; summary: string }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);

    const isWithinBusinessHours = businessEnd > businessStart
      ? (currentHour >= businessStart && currentHour < businessEnd)
      : (currentHour >= businessStart || currentHour < businessEnd); // handles overnight (e.g. 18-03)

    const isPrePeak = businessEnd > businessStart
      ? (currentHour >= businessStart - 2 && currentHour < businessStart)
      : (currentHour >= businessStart - 2 || currentHour < businessStart);

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
            content: `Você é o MTX Hourly Optimizer — um agente de otimização de tráfego que opera HORA A HORA com foco em negócios com horários de operação específicos.

⏰ HORA ATUAL (BRT): ${currentHour}:00
📍 HORÁRIO COMERCIAL DO NEGÓCIO: ${businessStart}h às ${businessEnd}h
📊 STATUS: ${isWithinBusinessHours ? "⚡ DENTRO DO HORÁRIO COMERCIAL — Negócio está operando!" : isPrePeak ? "🔜 PRÉ-PICO — Preparando para o horário comercial" : "😴 FORA DO HORÁRIO — Negócio fechado"}

## FILOSOFIA DE OTIMIZAÇÃO HORÁRIA

Diferente do agente de 3h, você opera com GRANULARIDADE MÁXIMA:
- Analise a performance HORA A HORA do dia atual
- Compare com o mesmo horário de ONTEM
- Identifique padrões de pico e vale no consumo

### REGRAS PARA NEGÓCIOS COM HORÁRIO ESPECÍFICO

1. **Pré-Pico (2h antes da abertura)**: 
   - Verificar se campanhas estão ativas e entregando
   - Se budget estiver quase esgotado, NÃO escalar — redistribuir
   - Garantir que o orçamento está disponível para o pico

2. **Durante Horário Comercial**:
   - Se uma campanha está gastando muito rápido sem conversões → Reduzir budget (não pausar imediatamente)
   - Se campanha tem ROAS > ${profileConfig.roas_min_escala || 2}x na última hora → Escalar agressivamente
   - Se CTR caiu > 50% vs hora anterior → Sinal de saturação, considerar pause

3. **Fora do Horário Comercial**:
   - ${businessEnd > businessStart ? `Negócio opera de dia (${businessStart}h-${businessEnd}h)` : `Negócio opera à noite/madrugada (${businessStart}h-${businessEnd}h)`}
   - ${isWithinBusinessHours ? "" : "Campanhas fora do horário podem ser PAUSADAS para economizar budget"}
   - Se o negócio NÃO pode atender pedidos agora → pausar é CORRETO
   - Se é delivery/online que opera 24h → manter com orçamento reduzido

4. **Análise Comparativa (Hoje vs Ontem)**:
   - Se performance hoje no mesmo horário é 30%+ pior que ontem → Alerta
   - Se performance hoje é 30%+ melhor que ontem → Oportunidade de escala

### AÇÕES DISPONÍVEIS:
- "pause": Pausar campanha (fora do horário ou CPA incontrolável)
- "resume": Reativar campanha pausada (entrando no horário comercial)
- "scale": Aumentar budget em ${profileConfig.limite_escala}%
- "reduce": Reduzir budget em 20% (gastar sem converter)
- "maintain": Sem ação (não listar)

CPA Meta: R$ ${profileConfig.cpa_meta} | CPA Máximo: R$ ${profileConfig.cpa_max_toleravel}
ROAS Mínimo Escala: ${profileConfig.roas_min_escala} | Teto Diário: R$ ${profileConfig.teto_diario_escala}

Retorne decisões APENAS para campanhas que precisam de ação AGORA.`,
          },
          {
            role: "user",
            content: `Perfil: ${profileName}

📊 CAMPANHAS — Performance HOJE (total acumulado):
${campaignSummaries.map(c => `━━ ${c.name} [ID: ${c.id}] — Status: ${c.status}
   Budget: R$${c.daily_budget} | Spend hoje: R$${c.today_spend.toFixed(2)} (${c.budget_pct.toFixed(0)}% usado)
   Purchases: ${c.today_purchases} | Revenue: R$${c.today_revenue.toFixed(2)} | ROAS: ${c.today_roas.toFixed(2)}x
   CPA: R$${c.today_cpa.toFixed(2)} | CTR: ${c.today_ctr.toFixed(2)}%
   Ontem: Spend R$${c.yesterday_spend.toFixed(2)} | Purchases ${c.yesterday_purchases} | ROAS ${c.yesterday_roas.toFixed(2)}x
   Variação: ${c.spend_change > 0 ? "+" : ""}${c.spend_change.toFixed(0)}% spend | ${c.roas_change > 0 ? "+" : ""}${c.roas_change.toFixed(0)}% roas`).join("\n")}

⏱ BREAKDOWN POR HORA (últimas horas do dia):
${hourlyData.slice(-20).map(h => `   ${h.hourly_stats_aggregated_by_advertiser_time_zone || "?"} — ${h.campaign_name}: spend=R$${parseFloat(h.spend || "0").toFixed(2)} clicks=${h.clicks || 0} ctr=${parseFloat(h.ctr || "0").toFixed(2)}%`).join("\n") || "   Sem dados horários disponíveis"}

Analise e decida ações para ESTA HORA.`,
          },
        ],
        tools: [
          {
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
                        action: { type: "string", enum: ["pause", "resume", "scale", "reduce", "maintain"] },
                        reason: { type: "string", description: "Justificativa com dados horários" },
                        new_budget: { type: "number", description: "New budget for scale/reduce actions" },
                      },
                      required: ["campaign_id", "action", "reason"],
                      additionalProperties: false,
                    },
                  },
                  summary: { type: "string", description: "Resumo da análise horária com contexto de horário comercial." },
                },
                required: ["decisions", "summary"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "execute_hourly_decisions" } },
      }),
    });

    if (!resp.ok) {
      console.warn("Hourly AI failed:", resp.status);
      return { decisions: [], summary: "AI indisponível." };
    }

    clearTimeout(timeout);
    const data = await resp.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      return { decisions: [], summary: "AI não retornou decisões." };
    }

    return JSON.parse(toolCall.function.arguments);
  } catch (e) {
    console.error("Hourly AI error:", e);
    return { decisions: [], summary: "Erro na IA horária." };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const sb = createClient(supabaseUrl, supabaseKey);

    // Parse optional body for on-demand targeting
    let targetProfileId: string | null = null;
    let targetCampaignIds: string[] | null = null;
    try {
      const text = await req.text();
      if (text) {
        const body = JSON.parse(text);
        targetProfileId = body.profile_id || null;
        targetCampaignIds = body.campaign_ids || null;
      }
    } catch { /* empty body is OK */ }

    // Fetch profiles with hourly optimizer enabled (or specific profile if on-demand)
    let query = sb.from("client_profiles").select("*");
    if (targetProfileId) {
      query = query.eq("id", targetProfileId);
    } else {
      query = query.eq("hourly_optimizer_enabled", true);
    }

    const { data: profiles, error } = await query;
    if (error) throw error;
    if (!profiles || profiles.length === 0) {
      return new Response(JSON.stringify({ message: "No profiles with hourly optimizer enabled", timestamp: new Date().toISOString() }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const today = dateStr(new Date());
    const yesterday = dateStr(new Date(Date.now() - 86400000));
    const currentHour = currentHourBRT();

    console.log(`[MTX Hourly Optimizer] Running at ${currentHour}:00 BRT | Profiles: ${profiles.length} | Target: ${targetProfileId || "all"}`);

    const profilePromises = profiles
      .filter((profile: any) => {
        const accessToken = profile.meta_access_token || Deno.env.get("META_ACCESS_TOKEN");
        return accessToken && profile.ad_account_id && profile.ad_account_id !== "act_";
      })
      .map(async (profile: any) => {
        const accessToken = profile.meta_access_token || Deno.env.get("META_ACCESS_TOKEN");
        const businessStart = profile.business_hours_start ?? 8;
        const businessEnd = profile.business_hours_end ?? 23;
        const profileResult: any = {
          profile: profile.name, profile_id: profile.id,
          actions: [], ai_summary: "", hour: currentHour,
          business_hours: `${businessStart}h-${businessEnd}h`,
        };

        try {
          // Fetch campaigns + today/yesterday insights + hourly breakdown in parallel
          const campaignUrl = `https://graph.facebook.com/v23.0/${profile.ad_account_id}/campaigns?fields=id,name,effective_status,daily_budget&effective_status=["ACTIVE","PAUSED"]&access_token=${accessToken}&limit=100`;

          const [campaignResp, todayMap, yesterdayMap, hourlyData] = await Promise.all([
            fetch(campaignUrl).then(r => r.json()),
            fetchTodayInsights(profile.ad_account_id, accessToken, today),
            fetchYesterdayInsights(profile.ad_account_id, accessToken, yesterday),
            fetchHourlyBreakdown(profile.ad_account_id, accessToken, today),
          ]);

          if (campaignResp.error) {
            profileResult.error = campaignResp.error.message;
            return profileResult;
          }

          let campaigns = campaignResp.data || [];
          // Filter to specific campaign IDs if on-demand
          if (targetCampaignIds && targetCampaignIds.length > 0) {
            campaigns = campaigns.filter((c: any) => targetCampaignIds!.includes(c.id));
          }

          // Build campaign summaries with today vs yesterday comparison
          const campaignSummaries = campaigns.map((c: any) => {
            const todayIns = parseMetrics(todayMap.get(c.id));
            const yesterdayIns = parseMetrics(yesterdayMap.get(c.id));
            const dailyBudget = parseInt(c.daily_budget || "0", 10) / 100;

            const todayRoas = todayIns.spend > 0 ? todayIns.revenue / todayIns.spend : 0;
            const yesterdayRoas = yesterdayIns.spend > 0 ? yesterdayIns.revenue / yesterdayIns.spend : 0;

            return {
              id: c.id,
              name: c.name,
              status: c.effective_status,
              daily_budget: dailyBudget,
              today_spend: todayIns.spend,
              today_purchases: todayIns.purchases,
              today_revenue: todayIns.revenue,
              today_roas: todayRoas,
              today_cpa: todayIns.purchases > 0 ? todayIns.spend / todayIns.purchases : todayIns.spend,
              today_ctr: todayIns.ctr,
              budget_pct: dailyBudget > 0 ? (todayIns.spend / dailyBudget) * 100 : 0,
              yesterday_spend: yesterdayIns.spend,
              yesterday_purchases: yesterdayIns.purchases,
              yesterday_revenue: yesterdayIns.revenue,
              yesterday_roas: yesterdayRoas,
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
              campaignSummaries, hourlyData, currentHour, businessStart, businessEnd
            );
            decisions = aiResult.decisions.filter((d: any) => d.action !== "maintain");
            aiSummary = aiResult.summary;
          } else {
            aiSummary = `Análise horária (${currentHour}h): ${campaignSummaries.length} campanhas. IA indisponível.`;
          }

          profileResult.ai_summary = aiSummary;
          profileResult.campaigns_analyzed = campaignSummaries.length;

          // Execute decisions
          for (const decision of decisions) {
            try {
              const campaign = campaignSummaries.find((c: any) => c.id === decision.campaign_id);
              if (!campaign) continue;

              if (decision.action === "pause") {
                const resp = await fetch(`https://graph.facebook.com/v23.0/${decision.campaign_id}`, {
                  method: "POST", headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ status: "PAUSED", access_token: accessToken }),
                });
                const data = await resp.json();
                await sb.from("emergency_logs").insert({
                  profile_id: profile.id, user_id: profile.user_id, action_type: "hourly_pause",
                  details: { campaign_id: decision.campaign_id, campaign_name: campaign.name, reason: decision.reason, hour: currentHour, success: data.success || false, today_roas: campaign.today_roas, today_spend: campaign.today_spend },
                });
                profileResult.actions.push({ ...decision, campaign_name: campaign.name, status: data.success ? "PAUSED" : "FAILED" });

              } else if (decision.action === "resume") {
                const resp = await fetch(`https://graph.facebook.com/v23.0/${decision.campaign_id}`, {
                  method: "POST", headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ status: "ACTIVE", access_token: accessToken }),
                });
                const data = await resp.json();
                await sb.from("emergency_logs").insert({
                  profile_id: profile.id, user_id: profile.user_id, action_type: "hourly_resume",
                  details: { campaign_id: decision.campaign_id, campaign_name: campaign.name, reason: decision.reason, hour: currentHour, success: data.success || false },
                });
                profileResult.actions.push({ ...decision, campaign_name: campaign.name, status: data.success ? "RESUMED" : "FAILED" });

              } else if (decision.action === "scale" || decision.action === "reduce") {
                const currentBudget = campaign.daily_budget;
                const newBudget = decision.new_budget || (decision.action === "scale"
                  ? currentBudget * (1 + profile.limite_escala / 100)
                  : currentBudget * 0.8);
                const teto = profile.teto_diario_escala || 0;
                if (decision.action === "scale" && teto > 0 && newBudget > teto) {
                  profileResult.actions.push({ ...decision, status: "ABORTED_CEILING" });
                  continue;
                }
                const resp = await fetch(`https://graph.facebook.com/v23.0/${decision.campaign_id}`, {
                  method: "POST", headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ daily_budget: Math.round(newBudget * 100), access_token: accessToken }),
                });
                const data = await resp.json();
                await sb.from("emergency_logs").insert({
                  profile_id: profile.id, user_id: profile.user_id,
                  action_type: decision.action === "scale" ? "hourly_scale" : "hourly_reduce",
                  details: { campaign_id: decision.campaign_id, campaign_name: campaign.name, old_budget: currentBudget, new_budget: newBudget, reason: decision.reason, hour: currentHour, success: data.success || false },
                });
                profileResult.actions.push({ ...decision, campaign_name: campaign.name, old_budget: currentBudget, new_budget: newBudget, status: data.success ? "EXECUTED" : "FAILED" });
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

    console.log(`[MTX Hourly Optimizer] Done. Profiles: ${results.length}. Actions: ${results.reduce((s: number, r: any) => s + (r.actions?.length || 0), 0)}`);

    return new Response(JSON.stringify({ results, timestamp: new Date().toISOString(), version: "hourly-v1", hour_brt: currentHour }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
