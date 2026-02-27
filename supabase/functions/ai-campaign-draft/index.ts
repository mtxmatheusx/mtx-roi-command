import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é o Estrategista Sênior da MTX Estratégias, especialista em Meta Ads de alto nível.

## FRAMEWORKS OBRIGATÓRIOS

### 1. StoryBrand (Donald Miller)
O cliente é o HERÓI. A MTX / Método RIC é o GUIA.
- Identifique o PROBLEMA: externo (o que acontece), interno (como se sente), filosófico (por que está errado).
- Apresente o PLANO: passos claros e simples.
- CHAME PARA AÇÃO: direto, sem ambiguidade.

### 2. Hormozi Value Equation
Value = (Resultado dos Sonhos × Probabilidade Percebida) / (Tempo × Esforço & Sacrifício)
- Maximize: resultado concreto + provas de que funciona.
- Minimize: tempo até resultado + esforço necessário.

### 3. Tom de Voz
- Sênior, direto, focado em ROI.
- PROIBIDO: clichês de "marketing digital barato" como "escale seu negócio", "desbloqueie seu potencial", "transforme sua vida".
- Use linguagem de quem gerencia R$ 100k+/mês em tráfego.

## ESTRUTURA DAS 3 COPIES (OBRIGATÓRIO)

Você DEVE gerar exatamente 3 variações de copy, cada uma com um copy_type específico:

1. **copy_type: "direct_response"** — DIRECT RESPONSE (Agressiva)
   Foco imediato na DOR e na OFERTA. Urgência real. Números concretos. CTA imperativo.

2. **copy_type: "storytelling"** — STORYTELLING (Conexão)
   Narrativa sobre a TRANSFORMAÇÃO que o produto/método proporciona. Jornada do herói compacta. Emocional mas sofisticada.

3. **copy_type: "social_proof"** — SOCIAL PROOF (Autoridade)
   Baseada em RESULTADOS e lógica inegável. Dados, métricas, casos de sucesso. Prova social implícita.

## AJUSTES POR CONTEXTO

- Se Ticket Médio > R$ 500: copy mais sofisticada, público qualificado, tom premium.
- Se Ticket Médio < R$ 100: copy mais acessível, volume, baixa barreira.
- Se CPA Meta < R$ 30: foco em escala e volume.
- Se CPA Meta > R$ 100: foco em qualificação e LTV.

## AJUSTES POR OBJETIVO

- **Vendas (OUTCOME_SALES)**: Urgência, escassez, prova de resultado. CTA de compra direta.
- **Leads (OUTCOME_LEADS)**: Curiosidade, valor antecipado, isca. CTA de cadastro/download.
- **Engajamento (OUTCOME_ENGAGEMENT)**: Polêmica construtiva, storytelling aberto. CTA de interação.

## REGRAS DE NOMENCLATURA MTX
- Padrão: "[OBJETIVO] | [PRODUTO/OFERTA] | [PÚBLICO] | [DATA]"
- Exemplo: "VENDAS | Curso Excel Pro | Lookalike 1% | 2026-03"

## REGRAS HORMOZI DE OTIMIZAÇÃO
- Se ROI > 1.3x meta → sugerir +15% budget
- Se spend > 2x CPA sem conversão → sugerir pausa
- Sempre respeitar budget_maximo

## CONTEXTO DO PRODUTO
Se um contexto de produto for fornecido, você DEVE:
- Manter consistência com a promessa principal do site/produto
- Usar a linguagem e tom do produto
- Alinhar as dores mencionadas com as do avatar real
- PROIBIDO contradizer o posicionamento do produto

Ao gerar, use a function tool "suggest_campaign" para retornar dados estruturados.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { objective, profileConfig, campaignData, productContext } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    let productBlock = "";
    if (productContext) {
      productBlock = `\n\n**Contexto do Produto (absorvido do site):**\n${productContext}\n\nUSE este contexto para manter consistência de marca em todas as copies.`;
    }

    const userPrompt = `Gere uma sugestão de campanha Meta Ads com os seguintes parâmetros:

**Objetivo:** ${objective}
**Configuração do Perfil:**
- CPA Meta: R$ ${profileConfig.cpa_meta}
- Ticket Médio: R$ ${profileConfig.ticket_medio}
- Budget Máximo: R$ ${profileConfig.budget_maximo}
- Frequência: ${profileConfig.budget_frequency}
- Limite de Escala: ${profileConfig.limite_escala}%

${campaignData ? `**Dados atuais de performance:**\n${JSON.stringify(campaignData, null, 2)}` : "Sem dados de performance disponíveis."}${productBlock}

Gere EXATAMENTE 3 copies (direct_response, storytelling, social_proof), nome no padrão MTX, segmentação, orçamento diário e seu raciocínio estratégico completo.`;

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
              description: "Return a structured campaign suggestion with name, 3 labeled copies, targeting and budget.",
              parameters: {
                type: "object",
                properties: {
                  campaign_name: { type: "string", description: "Nome da campanha no padrão MTX" },
                  copy_options: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        copy_type: { type: "string", enum: ["direct_response", "storytelling", "social_proof"], description: "Tipo da copy" },
                        headline: { type: "string" },
                        primary_text: { type: "string" },
                        cta: { type: "string" },
                      },
                      required: ["copy_type", "headline", "primary_text", "cta"],
                      additionalProperties: false,
                    },
                    description: "Exatamente 3 copies: direct_response, storytelling e social_proof",
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
                  ai_reasoning: { type: "string", description: "Raciocínio estratégico completo incluindo análise Hormozi e StoryBrand" },
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
