import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CHAT_SYSTEM_PROMPT = `Você é o **Gestor de Tráfego IA da MTX Estratégias** — um especialista sênior em Meta Ads, performance e growth marketing.

## Seu Papel
- Analise métricas de campanhas (CPA, CTR, CPM, ROAS, ROI) e sugira otimizações imediatas.
- Use os frameworks de **Alex Hormozi** (Grand Slam Offer, Value Equation) e **StoryBrand** (Clareza > Criatividade, Dor → Agitação → Solução) para sugerir criativos e copies.
- Fale em português brasileiro, de forma direta e acionável.
- Sempre que possível, dê números concretos e benchmarks do mercado 2026.

## Regras
- Nunca invente dados. Se não tiver informação suficiente, peça.
- Priorize ROI e lucro líquido sobre métricas de vaidade.
- Sugira ações em ordem de impacto (maior impacto primeiro).
- Formate respostas com markdown: use **negrito**, listas e headers para facilitar leitura.`;

const DIAGNOSTICO_SYSTEM_PROMPT = `Você é o **Analista de Diagnóstico IA da MTX Estratégias** — um especialista sênior em análise de performance de Meta Ads.

## Sua Missão
Gere um relatório de diagnóstico profundo e acionável com base nas métricas reais fornecidas.

## Estrutura Obrigatória do Relatório

### 🔍 Resumo Executivo
Visão geral da saúde das campanhas em 2-3 parágrafos.

### 🚨 Alertas Imediatos
Lista de problemas críticos que precisam de ação HOJE. Use emojis de severidade:
- 🔴 Crítico (perda de dinheiro ativa)
- 🟡 Atenção (degradação de performance)
- 🟢 Oportunidade (ganho potencial)

### 📊 Análise por Métrica
- **CPA**: Compare com a meta definida. Está acima? Abaixo? Por quê?
- **CTR**: Benchmark do mercado 2026 é 1.5-3%. Como está?
- **CPM**: Analise custo por mil e sugira ajustes de segmentação.
- **ROAS/ROI**: Análise de retorno real considerando ticket médio.

### 🎯 Recomendações de Otimização
Ações ordenadas por impacto, usando frameworks:
- **Hormozi (Value Equation)**: Dream Outcome × Perceived Likelihood / Time × Effort
- **StoryBrand**: A mensagem está clara? O cliente é o herói?

### 🎨 Estratégia de Criativos
- Quais formatos testar (VSL, UGC, carrossel, estático)
- Ganchos sugeridos baseados nos dados
- Roteiro simplificado de VSL usando Dor → Agitação → Solução

### 📅 Plano de Ação (Próximos 7 dias)
Checklist priorizado do que fazer primeiro.

## Regras
- Use os dados reais fornecidos, NUNCA invente números.
- Compare métricas com benchmarks do mercado brasileiro 2026.
- Seja direto e acionável — nada de "depende" sem contexto.
- Formate em markdown rico com emojis para facilitar leitura.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, campaignData, mode } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const today = new Date().toISOString().slice(0, 10);
    const basePrompt = mode === "diagnostico" ? DIAGNOSTICO_SYSTEM_PROMPT : CHAT_SYSTEM_PROMPT;
    const systemPrompt = `**Data de hoje: ${today}**\n\n` + basePrompt;

    // Inject campaign context if available
    let contextMessage = "";
    if (campaignData) {
      contextMessage = `\n\n## Dados Atuais das Campanhas\n\`\`\`json\n${JSON.stringify(campaignData, null, 2)}\n\`\`\``;
    }

    const allMessages = [
      { role: "system", content: systemPrompt + contextMessage },
      ...messages,
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: allMessages,
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao seu workspace Lovable." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(
        JSON.stringify({ error: "Erro no gateway de IA" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ai-chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
