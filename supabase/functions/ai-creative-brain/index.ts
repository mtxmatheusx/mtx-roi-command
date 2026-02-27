import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { profileId, objective, dateRange, campaignContext } = await req.json();
    if (!profileId) throw new Error("profileId is required");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Fetch creative assets for this profile
    const { data: assets } = await supabase
      .from("creative_assets")
      .select("id, file_name, file_url, file_type, description, created_at")
      .eq("profile_id", profileId)
      .order("created_at", { ascending: false })
      .limit(50);

    // 2. Fetch profile for product context
    const { data: profile } = await supabase
      .from("client_profiles")
      .select("product_context, product_urls, name, ticket_medio, cpa_meta")
      .eq("id", profileId)
      .single();

    // 3. Fetch published campaign drafts for performance history
    const { data: publishedDrafts } = await supabase
      .from("campaign_drafts")
      .select("campaign_name, objective, daily_budget, status, copy_options, meta_campaign_id, created_at")
      .eq("profile_id", profileId)
      .in("status", ["published", "approved"])
      .order("created_at", { ascending: false })
      .limit(10);

    const today = new Date().toISOString().slice(0, 10);

    const assetList = (assets || []).map((a, i) => 
      `${i + 1}. [${a.file_type.toUpperCase()}] "${a.file_name}" — ${a.description || "Sem descrição"} (URL: ${a.file_url})`
    ).join("\n");

    const historyList = (publishedDrafts || []).map((d, i) =>
      `${i + 1}. "${d.campaign_name}" | Obj: ${d.objective} | Budget: R$${d.daily_budget}/dia | Status: ${d.status} | Meta ID: ${d.meta_campaign_id || "N/A"}`
    ).join("\n");

    const systemPrompt = `**Data de hoje: ${today}**

Você é um Diretor de Arte Sênior especializado em performance marketing (Meta Ads).

Sua tarefa: Analisar os ativos criativos disponíveis e recomendar o MELHOR criativo para a próxima campanha, justificando sua escolha com base em:
1. Alinhamento com a "Promessa Principal" do produto
2. Tipo de ativo (vídeo > carrossel > imagem para conversão)
3. Histórico de campanhas anteriores
4. Objetivo da campanha atual

REGRAS:
- Se houver vídeos, prefira vídeos para campanhas de vendas/leads
- Se a descrição do criativo menciona "depoimento" ou "resultado", dê peso extra (prova social)
- Cruze a promessa principal do produto_context com a descrição dos criativos
- Retorne SEMPRE um criativo recomendado, mesmo que a confiança seja baixa
- Score de confiança: 0-100 (acima de 70 = forte recomendação)`;

    const userPrompt = `## Contexto do Produto
${profile?.product_context || "Nenhum contexto absorvido ainda."}

## Ticket Médio: R$${profile?.ticket_medio || "N/A"} | CPA Meta: R$${profile?.cpa_meta || "N/A"}

## Objetivo da Campanha: ${objective || "OUTCOME_SALES"}

## Período de Análise: ${dateRange?.since || "últimos 7 dias"} a ${dateRange?.until || today}

## Ativos Criativos Disponíveis (${(assets || []).length} total)
${assetList || "Nenhum ativo enviado ainda."}

## Histórico de Campanhas Publicadas
${historyList || "Nenhuma campanha publicada ainda."}

${campaignContext ? `## Contexto Adicional da Campanha\n${campaignContext}` : ""}

Com base em TODA essa informação, recomende o melhor criativo para usar.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "recommend_creative",
              description: "Return the recommended creative asset for the campaign",
              parameters: {
                type: "object",
                properties: {
                  recommended_asset_id: { type: "string", description: "ID of the recommended creative asset" },
                  recommended_asset_name: { type: "string", description: "File name of the recommended asset" },
                  recommended_asset_url: { type: "string", description: "URL of the recommended asset" },
                  recommended_asset_type: { type: "string", enum: ["image", "video"], description: "Type of asset" },
                  justification: { type: "string", description: "Detailed justification in Portuguese for why this creative was chosen (2-4 sentences)" },
                  confidence_score: { type: "number", description: "Confidence score 0-100" },
                  creative_angle: { type: "string", description: "The creative angle/hook suggestion for this asset" },
                  fallback_asset_id: { type: "string", description: "ID of a secondary option if available" },
                },
                required: ["recommended_asset_id", "recommended_asset_name", "justification", "confidence_score"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "recommend_creative" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit — tente novamente em alguns segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos no workspace." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      throw new Error("Erro no gateway de IA");
    }

    const aiData = await response.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall?.function?.arguments) {
      throw new Error("IA não retornou recomendação estruturada");
    }

    const recommendation = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({
      recommendation,
      total_assets: (assets || []).length,
      total_campaigns_analyzed: (publishedDrafts || []).length,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-creative-brain error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
