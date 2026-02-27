import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é o Estrategista Sênior da MTX Estratégias, especialista em Meta Ads.

Você usa dois frameworks:
1. **Hormozi Value Equation**: Resultado dos Sonhos × Probabilidade Percebida / Tempo × Esforço & Sacrifício
2. **StoryBrand**: O cliente é o herói, o produto é o guia. Copy clara: problema → solução → resultado.

Regras de nomenclatura MTX:
- Padrão: "[OBJETIVO] | [PRODUTO/OFERTA] | [PÚBLICO] | [DATA]"
- Exemplo: "VENDAS | Curso Excel Pro | Lookalike 1% | 2026-03"

Ao gerar uma sugestão de campanha, use a function tool "suggest_campaign" para retornar dados estruturados.

Considere sempre:
- O CPA Meta do perfil como referência de lance
- O Ticket Médio para calcular ROAS esperado
- O Budget Máximo para não exceder limites
- Regras Hormozi: se ROI > 1.3x meta → sugerir +15% budget; se spend > 2x CPA sem conversão → sugerir pausa`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { objective, profileConfig, campaignData } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const userPrompt = `Gere uma sugestão de campanha Meta Ads com os seguintes parâmetros:

**Objetivo:** ${objective}
**Configuração do Perfil:**
- CPA Meta: R$ ${profileConfig.cpa_meta}
- Ticket Médio: R$ ${profileConfig.ticket_medio}
- Budget Máximo: R$ ${profileConfig.budget_maximo}
- Frequência: ${profileConfig.budget_frequency}
- Limite de Escala: ${profileConfig.limite_escala}%

${campaignData ? `**Dados atuais de performance:**\n${JSON.stringify(campaignData, null, 2)}` : "Sem dados de performance disponíveis."}

Gere o nome da campanha no padrão MTX, 3 opções de copy (StoryBrand), sugestão de segmentação, orçamento diário recomendado e seu raciocínio estratégico.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "suggest_campaign",
              description: "Return a structured campaign suggestion with name, copies, targeting and budget.",
              parameters: {
                type: "object",
                properties: {
                  campaign_name: { type: "string", description: "Nome da campanha no padrão MTX" },
                  copy_options: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        headline: { type: "string" },
                        primary_text: { type: "string" },
                        cta: { type: "string" },
                      },
                      required: ["headline", "primary_text", "cta"],
                      additionalProperties: false,
                    },
                    description: "3 opções de copy baseadas em StoryBrand",
                  },
                  targeting_suggestion: {
                    type: "object",
                    properties: {
                      audience_type: { type: "string" },
                      age_range: { type: "string" },
                      interests: { type: "array", items: { type: "string" } },
                      lookalike_source: { type: "string" },
                      placements: { type: "string" },
                    },
                    required: ["audience_type", "placements"],
                    additionalProperties: false,
                  },
                  daily_budget: { type: "number", description: "Orçamento diário recomendado em BRL" },
                  ai_reasoning: { type: "string", description: "Raciocínio estratégico completo" },
                },
                required: ["campaign_name", "copy_options", "targeting_suggestion", "daily_budget", "ai_reasoning"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "suggest_campaign" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao workspace." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      return new Response(JSON.stringify({ error: "Erro ao gerar sugestão de campanha." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      return new Response(JSON.stringify({ error: "IA não retornou dados estruturados." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const suggestion = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(suggestion), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-campaign-draft error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
