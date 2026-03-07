import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { fetchMasterContext } from "../_shared/fetch_master_context.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const META_API = "https://graph.facebook.com/v21.0";

async function fetchMetaInsights(adAccountId: string, accessToken: string, level: "campaign" | "ad" = "campaign", datePreset = "last_7d") {
    const fields = level === "campaign"
        ? "campaign_name,campaign_id,spend,cpm,ctr,actions,action_values,cost_per_action_type,purchase_roas"
        : "ad_name,ad_id,campaign_name,campaign_id,spend,cpm,ctr,actions,action_values,cost_per_action_type,purchase_roas";

    const url = `${META_API}/${adAccountId}/insights?fields=${fields}&date_preset=${datePreset}&level=${level}&access_token=${accessToken}&limit=50`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return data.data || [];
}

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const { profileId } = await req.json();
        if (!profileId) throw new Error("profileId is required");

        const authHeader = req.headers.get("Authorization");
        const supabase = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_ANON_KEY")!,
            { global: { headers: { Authorization: authHeader! } } }
        );

        // 1. Fetch Master Context (Avatar, Product, Tone)
        const ctx = await fetchMasterContext(profileId);
        if (ctx.blocked) {
            return new Response(JSON.stringify({ error: ctx.details || ctx.error, blocked: true }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const { profile } = ctx;
        const accessToken = profile.meta_access_token || Deno.env.get("META_ACCESS_TOKEN");
        const adAccountId = profile.ad_account_id;

        if (!accessToken || !adAccountId || adAccountId === "act_") {
            return new Response(JSON.stringify({ error: "Meta API not configured for this profile" }), {
                status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // 2. Fetch Performance Data
        const [campaignInsights, adInsights] = await Promise.all([
            fetchMetaInsights(adAccountId, accessToken, "campaign"),
            fetchMetaInsights(adAccountId, accessToken, "ad")
        ]);

        // 3. Prepare Context for Gemini
        const performanceContext = {
            campaigns: campaignInsights.map((c: any) => ({
                name: c.campaign_name,
                spend: parseFloat(c.spend),
                ctr: parseFloat(c.ctr),
                purchases: (c.actions?.find((a: any) => a.action_type === "purchase")?.value || 0),
                roas: (c.purchase_roas?.find((r: any) => r.action_type === "omni_purchase")?.value || 0)
            })),
            top_ads: adInsights
                .sort((a: any, b: any) => (parseFloat(b.purchase_roas?.[0]?.value || 0)) - (parseFloat(a.purchase_roas?.[0]?.value || 0)))
                .slice(0, 5)
                .map((a: any) => ({
                    name: a.ad_name,
                    campaign: a.campaign_name,
                    spend: parseFloat(a.spend),
                    roas: (a.purchase_roas?.find((r: any) => r.action_type === "omni_purchase")?.value || 0),
                    ctr: parseFloat(a.ctr)
                }))
        };

        // 4. Generate Strategic Plays with Gemini
        const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
        const systemPrompt = `Você é o Diretor de Estratégia da MTX. Sua missão é analisar dados reais e sugerir "Jogadas Estratégicas" (Plays).
    
    ## Contexto do Cliente:
    ${ctx.systemPromptBlock}
    
    ## Regras das Sugestões:
    - Identifique padrões: Criativos que funcionam, públicos saturados, ou oportunidades de escala.
    - Se o ROAS estiver acima da meta (${profile.roas_min_escala || '2.0'}), sugira ESCALA.
    - Se o CPA estiver alto, sugira REFRESH de criativos ou troca de PÚBLICO.
    - Seja extremamente específico e direto.
    - Formate em JSON estruturado usando o formato abaixo.`;

        const userPrompt = `Analise estes dados de performance dos últimos 7 dias:
    ${JSON.stringify(performanceContext, null, 2)}
    
    Retorne de 1 a 3 jogadas estratégicas no formato:
    {
      "plays": [
        {
          "title": "Título Curto da Jogada",
          "type": "scale | refresh | pivot",
          "rationale": "Por que estamos fazendo isso? (Baseado nos dados)",
          "suggestion": "Instrução clara para o gestor",
          "confidence": 0-100,
          "impact": "high | medium | low",
          "draft_prefill": {
             "campaign_name": "Nome sugerido",
             "objective": "OUTCOME_SALES | OUTCOME_LEADS",
             "daily_budget": 50,
             "targeting_notes": "Notas sobre quem focar"
          }
        }
      ]
    }`;

        const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${LOVABLE_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "google/gemini-3-flash-preview",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt },
                ],
                response_format: { type: "json_object" }
            }),
        });

        const aiData = await aiRes.json();
        const suggestions = JSON.parse(aiData.choices[0].message.content);

        return new Response(JSON.stringify(suggestions), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (e: any) {
        console.error("ai-strategic-advisor error:", e);
        return new Response(JSON.stringify({ error: e.message || "Internal Server Error" }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
