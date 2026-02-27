import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é o Auditor de Tráfego Sênior da MTX Estratégias. Sua função é analisar as recomendações automáticas da Meta (Facebook) e decidir se elas são seguras para o cliente.

## REGRAS DE AUDITORIA

1. **Proteção do ROI:** Qualquer sugestão que possa aumentar o custo em mais de 15% sem garantia de retorno proporcional deve ser REJEITADA.

2. **Proteção do Público-Alvo:** Se a Meta sugere expandir o público, cruze com o perfil do avatar no dossiê do produto. Se a expansão pode incluir pessoas fora do ICP, REJEITE.

3. **Respeito ao Budget:** Se a sugestão implica aumento de budget além do limite configurado, REJEITE.

4. **Advantage+ Audience:** Aceite apenas se o histórico mostra ROAS consistente com públicos amplos. Caso contrário, COM RESSALVAS.

5. **Unificação de Campanhas:** Geralmente REJEITADO para contas que dependem de segmentação granular.

## FORMATO DO VEREDITO

Use a function tool "audit_verdict" para retornar:
- verdict: "APROVADO" | "COM_RESSALVAS" | "REJEITADO"
- justification: justificativa curta (máximo 2 frases)
- risk_level: "low" | "medium" | "high"
- cost_impact: estimativa de impacto no custo ("nenhum" | "moderado" | "significativo")`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { recommendation, profileSummary, productContext } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    let contextBlock = "";
    if (productContext) {
      contextBlock = `\n\n**Dossiê do Produto:**\n${productContext}`;
    }

    const userPrompt = `Analise esta recomendação da Meta e dê seu veredito:

**Recomendação da Meta:**
- Título: ${recommendation.title || "N/A"}
- Mensagem: ${recommendation.message || "N/A"}
- Tipo: ${recommendation.recommendation_type || "N/A"}
- Importância: ${recommendation.importance || "N/A"}
- Código: ${recommendation.code || "N/A"}

**Perfil do Cliente:**
- Nome: ${profileSummary.name}
- CPA Meta: R$ ${profileSummary.cpa_meta}
- Budget Máximo: R$ ${profileSummary.budget_maximo} (${profileSummary.budget_frequency})
- Ticket Médio: R$ ${profileSummary.ticket_medio}${contextBlock}

Dê seu veredito como Auditor Sênior.`;

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
              name: "audit_verdict",
              description: "Return the audit verdict for a Meta recommendation",
              parameters: {
                type: "object",
                properties: {
                  verdict: { type: "string", enum: ["APROVADO", "COM_RESSALVAS", "REJEITADO"] },
                  justification: { type: "string", description: "Justificativa curta, máximo 2 frases" },
                  risk_level: { type: "string", enum: ["low", "medium", "high"] },
                  cost_impact: { type: "string", enum: ["nenhum", "moderado", "significativo"] },
                },
                required: ["verdict", "justification", "risk_level", "cost_impact"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "audit_verdict" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit excedido. Tente novamente." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      throw new Error("Erro no AI gateway");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      throw new Error("IA não retornou veredito estruturado");
    }

    const verdict = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(verdict), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("audit-recommendation error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
