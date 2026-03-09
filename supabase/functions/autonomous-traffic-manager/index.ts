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
  spend: number;
  purchases: number;
  revenue: number;
  cpa: number;
  roas: number;
  ctr: number;
  frequency: number;
  daily_budget: number;
}

interface Decision {
  campaign_id: string;
  adset_id?: string;
  action: string; // "pause" | "scale" | "duplicate_scale" | "maintain"
  reason: string;
  new_budget?: number;
}

async function getAIDecision(
  LOVABLE_API_KEY: string,
  profileName: string,
  profileConfig: any,
  campaigns: CampaignInsight[],
  adsets: any[]
): Promise<{ decisions: Decision[]; summary: string }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000); // 25s timeout for AI
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: `Você é o MTX Autonomous Agent, um gestor de tráfego autônomo. Analise campanhas e tome decisões baseado nestas regras ABSOLUTAS:

REGRAS DE PAUSA (Guardian):
- Se CPA real > CPA máximo tolerável × 1.15 → PAUSAR
- Se gasto > 0 e 0 conversões nas últimas 24h e gasto > 50% do orçamento diário → PAUSAR
- Se frequência > 3.0 e CTR < 0.8% → PAUSAR (saturação)

REGRAS DE ESCALA HORIZONTAL (Budget Increase):
- Se ROAS > ROAS mínimo de escala E purchases >= 3 → ESCALAR
- Incremento: +${profileConfig.limite_escala}% do orçamento atual
- Teto diário: R$ ${profileConfig.teto_diario_escala}
- NÃO escalar se frequência > 2.5 e CTR < 1.0% (saturação)

REGRAS DE ESCALA VERTICAL (Duplicação — NOVO):
- Se um adset já está com orçamento >= 80% do teto diário (R$ ${profileConfig.teto_diario_escala}) E ROAS > ${profileConfig.roas_min_escala} E purchases >= 3 → DUPLICAR_ESCALAR
- A duplicação cria uma cópia do adset com orçamento inicial igual ao orçamento original (não escalado)
- Use "duplicate_scale" como action para esta decisão
- Informe o adset_id do adset a ser duplicado
- Prefira duplicação quando o budget já está perto do teto

REGRAS DE MANUTENÇÃO:
- Se performance está dentro dos parâmetros → MANTER (sem ação)

Retorne decisões APENAS para campanhas/adsets que precisam de ação. Campanhas saudáveis não precisam ser listadas.`,
          },
          {
            role: "user",
            content: `Perfil: ${profileName}
CPA Meta: R$ ${profileConfig.cpa_meta}
CPA Máximo Tolerável: R$ ${profileConfig.cpa_max_toleravel}
ROAS Mínimo para Escala: ${profileConfig.roas_min_escala}
Teto Diário de Escala: R$ ${profileConfig.teto_diario_escala}
Limite de Escala: ${profileConfig.limite_escala}%

Campanhas ativas (resumo):
${campaigns.map(c => `- ${c.name}: spend=R$${c.spend.toFixed(0)} purchases=${c.purchases} roas=${c.roas.toFixed(2)} cpa=R$${c.cpa.toFixed(0)} ctr=${c.ctr.toFixed(2)}% freq=${c.frequency.toFixed(1)} budget=R$${c.daily_budget.toFixed(0)}`).join("\n")}

AdSets ativos (resumo):
${adsets.slice(0, 30).map((a: any) => {
  const ins = a.insights?.data?.[0];
  const sp = parseFloat(ins?.spend || "0");
  const rev = (ins?.action_values || []).filter((v: any) => v.action_type === "purchase" || v.action_type === "omni_purchase").reduce((s: number, v: any) => s + parseFloat(v.value || "0"), 0);
  const purch = (ins?.actions || []).filter((v: any) => v.action_type === "purchase" || v.action_type === "omni_purchase").reduce((s: number, v: any) => s + parseInt(v.value || "0", 10), 0);
  const budget = parseInt(a.daily_budget || "0", 10) / 100;
  return `- [${a.id}] ${a.name} (camp:${a.campaign_id}): budget=R$${budget} spend=R$${sp.toFixed(0)} roas=${sp > 0 ? (rev/sp).toFixed(2) : "0"} purchases=${purch}`;
}).join("\n")}

Analise e retorne as decisões.`,
          },
        ],
        tools: [
          {
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
                        adset_id: { type: "string", description: "Required for duplicate_scale actions" },
                        action: { type: "string", enum: ["pause", "scale", "duplicate_scale", "maintain"] },
                        reason: { type: "string" },
                        new_budget: { type: "number", description: "New daily budget in currency (not cents). Only for scale actions." },
                      },
                      required: ["campaign_id", "action", "reason"],
                      additionalProperties: false,
                    },
                  },
                  summary: { type: "string", description: "Resumo executivo de todas as decisões em 2-3 frases." },
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

function applyStaticRules(campaigns: CampaignInsight[], profileConfig: any, adsets: any[]): Decision[] {
  const decisions: Decision[] = [];

  for (const c of campaigns) {
    // Guardian: CPA too high
    if (profileConfig.cpa_max_toleravel > 0 && c.spend > 0) {
      const threshold = profileConfig.cpa_max_toleravel * 1.15;
      const cpa = c.purchases > 0 ? c.spend / c.purchases : c.spend;
      if (cpa > threshold) {
        decisions.push({ campaign_id: c.id, action: "pause", reason: `CPA R$ ${cpa.toFixed(2)} > limite R$ ${threshold.toFixed(2)}` });
        continue;
      }
    }

    // Auto-Scale or Duplicate
    if (profileConfig.roas_min_escala > 0 && c.purchases >= 3 && c.roas >= profileConfig.roas_min_escala) {
      if (c.frequency > 2.5 && c.ctr < 1.0) continue; // Saturation

      const teto = profileConfig.teto_diario_escala || 0;
      const incrementalRatio = 1 + (profileConfig.limite_escala / 100);
      const newBudget = c.daily_budget * incrementalRatio;

      // Check if budget is near ceiling → duplicate instead (only if vertical scale enabled)
      if (profileConfig.vertical_scale_enabled && teto > 0 && c.daily_budget >= teto * 0.8) {
        // Find the best adset for this campaign to duplicate
        const campaignAdsets = adsets.filter((a: any) => a.campaign_id === c.id);
        if (campaignAdsets.length > 0) {
          // Pick the adset with highest spend (most data)
          const bestAdset = campaignAdsets.sort((a: any, b: any) => {
            const spA = parseFloat(a.insights?.data?.[0]?.spend || "0");
            const spB = parseFloat(b.insights?.data?.[0]?.spend || "0");
            return spB - spA;
          })[0];
          decisions.push({
            campaign_id: c.id,
            adset_id: bestAdset.id,
            action: "duplicate_scale",
            reason: `Budget R$ ${c.daily_budget.toFixed(2)} está a ≥80% do teto R$ ${teto}. Duplicando adset para escala vertical.`,
            new_budget: c.daily_budget, // Same budget for the copy
          });
          continue;
        }
      }

      if (teto > 0 && newBudget > teto) continue;
      decisions.push({ campaign_id: c.id, action: "scale", reason: `ROAS ${c.roas.toFixed(2)} > mínimo ${profileConfig.roas_min_escala}`, new_budget: newBudget });
    }
  }

  return decisions;
}

async function duplicateAdset(adsetId: string, accessToken: string, newName?: string): Promise<{ success: boolean; new_adset_id?: string; error?: string }> {
  try {
    // Use Meta API copy endpoint
    const copyResp = await fetch(`https://graph.facebook.com/v21.0/${adsetId}/copies`, {
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

    if (copyData.error) {
      return { success: false, error: copyData.error.message || JSON.stringify(copyData.error) };
    }

    // The copies endpoint returns { copied_adset_id: "..." } or { ad_object_ids: [...] }
    const newId = copyData.copied_adset_id || copyData.ad_object_ids?.[0];
    if (!newId) {
      return { success: false, error: "Meta API não retornou o ID do adset copiado." };
    }

    return { success: true, new_adset_id: newId };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const sb = createClient(supabaseUrl, supabaseKey);

    // Get all profiles with autonomous features enabled
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

    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);

    // Process all profiles concurrently
    const profilePromises = profiles
      .filter((profile: any) => {
        const accessToken = profile.meta_access_token || Deno.env.get("META_ACCESS_TOKEN");
        return accessToken && profile.ad_account_id && profile.ad_account_id !== "act_";
      })
      .map(async (profile: any) => {
        const accessToken = profile.meta_access_token || Deno.env.get("META_ACCESS_TOKEN");
        const profileResult: any = { profile: profile.name, profile_id: profile.id, actions: [], ai_summary: "" };

        try {
          // Fetch campaign + adset data in parallel
          const campaignUrl = `https://graph.facebook.com/v21.0/${profile.ad_account_id}/campaigns?fields=id,name,effective_status,daily_budget,insights.time_range({"since":"${yesterday}","until":"${today}"}){spend,actions,action_values,ctr,frequency}&effective_status=["ACTIVE"]&access_token=${accessToken}&limit=100`;
          const adsetUrl = `https://graph.facebook.com/v21.0/${profile.ad_account_id}/adsets?fields=id,name,daily_budget,effective_status,campaign_id,insights.time_range({"since":"${twoDaysAgo}","until":"${today}"}){spend,actions,action_values,ctr,frequency}&effective_status=["ACTIVE"]&access_token=${accessToken}&limit=100`;

          const [campaignResp, adsetResp] = await Promise.all([fetch(campaignUrl), fetch(adsetUrl)]);
          const [campaignData, adsetData] = await Promise.all([campaignResp.json(), adsetResp.json()]);

          if (campaignData.error) {
            profileResult.error = campaignData.error.message;
            return profileResult;
          }

          const adsetsList = adsetData.data || [];

          // Build campaign insights
          const campaignInsights: CampaignInsight[] = (campaignData.data || []).map((c: any) => {
            const ins = c.insights?.data?.[0];
            const spend = parseFloat(ins?.spend || "0");
            const purchases = (ins?.actions || [])
              .filter((a: any) => a.action_type === "purchase" || a.action_type === "omni_purchase")
              .reduce((s: number, a: any) => s + parseInt(a.value || "0", 10), 0);
            const revenue = (ins?.action_values || [])
              .filter((a: any) => a.action_type === "purchase" || a.action_type === "omni_purchase")
              .reduce((s: number, a: any) => s + parseFloat(a.value || "0"), 0);
            return {
              id: c.id, name: c.name, effective_status: c.effective_status, spend, purchases, revenue,
              cpa: purchases > 0 ? spend / purchases : (spend > 0 ? spend : 0),
              roas: spend > 0 ? revenue / spend : 0,
              ctr: parseFloat(ins?.ctr || "0"),
              frequency: parseFloat(ins?.frequency || "0"),
              daily_budget: parseInt(c.daily_budget || "0", 10) / 100,
            };
          });

          // Get decisions (AI-powered or static fallback)
          let decisions: Decision[];
          let aiSummary = "";

          if (LOVABLE_API_KEY && campaignInsights.length > 0) {
            const aiResult = await getAIDecision(LOVABLE_API_KEY, profile.name, {
              cpa_meta: profile.cpa_meta, cpa_max_toleravel: profile.cpa_max_toleravel,
              roas_min_escala: profile.roas_min_escala, teto_diario_escala: profile.teto_diario_escala,
              limite_escala: profile.limite_escala,
            }, campaignInsights, adsetsList);
            decisions = aiResult.decisions.filter((d: Decision) => d.action !== "maintain");
            // Filter out duplicate_scale if vertical scaling is disabled
            if (!profile.vertical_scale_enabled) {
              decisions = decisions.filter((d: Decision) => d.action !== "duplicate_scale");
            }
            aiSummary = aiResult.summary;
          } else {
            decisions = applyStaticRules(campaignInsights, profile, adsetsList);
            aiSummary = `Análise estática: ${campaignInsights.length} campanhas verificadas.`;
          }

          profileResult.ai_summary = aiSummary;
          profileResult.campaigns_analyzed = campaignInsights.length;

          // Execute decisions
          for (const decision of decisions) {
            try {
              if (decision.action === "pause") {
                const pauseResp = await fetch(`https://graph.facebook.com/v21.0/${decision.campaign_id}`, {
                  method: "POST", headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ status: "PAUSED", access_token: accessToken }),
                });
                const pauseData = await pauseResp.json();
                await sb.from("emergency_logs").insert({
                  profile_id: profile.id, user_id: profile.user_id, action_type: "agent_pause",
                  details: { campaign_id: decision.campaign_id, campaign_name: campaignInsights.find((c: CampaignInsight) => c.id === decision.campaign_id)?.name, reason: decision.reason, ai_driven: !!LOVABLE_API_KEY, success: pauseData.success || false },
                });
                profileResult.actions.push({ ...decision, status: pauseData.success ? "EXECUTED" : "FAILED" });
              } else if (decision.action === "duplicate_scale") {
                const adsetId = decision.adset_id;
                if (!adsetId) { profileResult.actions.push({ ...decision, status: "SKIPPED", error: "adset_id ausente" }); continue; }
                const campaign = campaignInsights.find((c: CampaignInsight) => c.id === decision.campaign_id);
                const adset = adsetsList.find((a: any) => a.id === adsetId);
                const dupResult = await duplicateAdset(adsetId, accessToken, "[SCALE COPY 🚀] ");
                await sb.from("emergency_logs").insert({
                  profile_id: profile.id, user_id: profile.user_id, action_type: "agent_duplicate",
                  details: { campaign_id: decision.campaign_id, campaign_name: campaign?.name, original_adset_id: adsetId, original_adset_name: adset?.name, new_adset_id: dupResult.new_adset_id || null, reason: decision.reason, ai_driven: !!LOVABLE_API_KEY, success: dupResult.success, error: dupResult.error || null },
                });
                profileResult.actions.push({ ...decision, adset_name: adset?.name, new_adset_id: dupResult.new_adset_id, status: dupResult.success ? "DUPLICATED" : "FAILED", error: dupResult.error });
              } else if (decision.action === "scale") {
                const campaignId = decision.campaign_id;
                const campaign = campaignInsights.find((c: CampaignInsight) => c.id === campaignId);
                const adsetsForCampaign = adsetsList.filter((a: any) => a.campaign_id === campaignId);
                const campaignBudgetRaw = (campaignData.data || []).find((c: any) => c.id === campaignId)?.daily_budget;
                const campaignBudget = parseInt(campaignBudgetRaw || "0", 10) / 100;
                const isCBO = campaignBudget > 0;

                if (isCBO) {
                  const newBudget = campaignBudget * (1 + profile.limite_escala / 100);
                  const teto = profile.teto_diario_escala || 0;
                  if (teto > 0 && newBudget > teto) {
                    profileResult.actions.push({ action: "scale", campaign_id: campaignId, reason: "Teto atingido", status: "ABORTED_CEILING" });
                  } else {
                    const scaleResp = await fetch(`https://graph.facebook.com/v21.0/${campaignId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ daily_budget: Math.round(newBudget * 100), access_token: accessToken }) });
                    const scaleData = await scaleResp.json();
                    await sb.from("emergency_logs").insert({ profile_id: profile.id, user_id: profile.user_id, action_type: "agent_scale", details: { campaign_id: campaignId, campaign_name: campaign?.name, old_budget: campaignBudget, new_budget: newBudget, level: "campaign", reason: decision.reason, ai_driven: !!LOVABLE_API_KEY, success: scaleData.success || false } });
                    profileResult.actions.push({ action: "scale", campaign_id: campaignId, old_budget: campaignBudget, new_budget: newBudget, reason: decision.reason, status: scaleData.success ? "EXECUTED" : "FAILED" });
                  }
                } else {
                  for (const adset of adsetsForCampaign) {
                    const currentBudget = parseInt(adset.daily_budget || "0", 10) / 100;
                    if (currentBudget <= 0) continue;
                    const newBudget = currentBudget * (1 + profile.limite_escala / 100);
                    const teto = profile.teto_diario_escala || 0;
                    if (teto > 0 && newBudget > teto) continue;
                    const scaleResp = await fetch(`https://graph.facebook.com/v21.0/${adset.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ daily_budget: Math.round(newBudget * 100), access_token: accessToken }) });
                    const scaleData = await scaleResp.json();
                    await sb.from("emergency_logs").insert({ profile_id: profile.id, user_id: profile.user_id, action_type: "agent_scale", details: { adset_id: adset.id, adset_name: adset.name, campaign_id: campaignId, old_budget: currentBudget, new_budget: newBudget, level: "adset", reason: decision.reason, ai_driven: !!LOVABLE_API_KEY, success: scaleData.success || false } });
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

    return new Response(JSON.stringify({ results, timestamp: new Date().toISOString(), ai_enabled: !!LOVABLE_API_KEY }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
