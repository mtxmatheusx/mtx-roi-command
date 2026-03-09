import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { fetchMasterContext } from "../_shared/fetch_master_context.ts";

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
- Formate respostas com markdown: use **negrito**, listas e headers para facilitar leitura.

## EXECUÇÃO AUTOMÁTICA DE CAMPANHAS (REGRA CRÍTICA)
Quando o usuário pedir para criar, lançar ou subir uma campanha, você DEVE gerar um bloco JSON executável no final da sua resposta usando o formato abaixo. Este bloco será detectado automaticamente pelo sistema e transformado em um botão de ação.

O bloco DEVE estar entre as tags \`\`\`mtx-action e \`\`\`:
\`\`\`mtx-action
{
  "action": "create_campaign",
  "campaign_name": "[OBJETIVO] | [PRODUTO] | [PÚBLICO] | [DATA]",
  "objective": "OUTCOME_SALES",
  "daily_budget": 50,
  "targeting_notes": "Descrição da segmentação sugerida",
  "reasoning": "Raciocínio estratégico completo",
  "use_catalog": false,
  "destination_url": "https://exemplo.com/produto"
}
\`\`\`

Objectives válidos: OUTCOME_SALES, OUTCOME_LEADS, OUTCOME_TRAFFIC, OUTCOME_AWARENESS, OUTCOME_ENGAGEMENT.

## REMARKETING / RETARGETING
Quando o usuário pedir campanhas de remarketing ou retargeting:
1. Pergunte qual tipo de público ele quer atingir (visitantes do site, engajamento, compradores anteriores).
2. Sugira o uso de Catálogo de Produtos (DPA) para remarketing dinâmico se aplicável.
3. Para remarketing com catálogo, defina \`"use_catalog": true\` no bloco mtx-action.
4. SEMPRE inclua um \`"destination_url"\` no bloco mtx-action com o link do site/produto.

## GESTÃO DE PÚBLICOS PERSONALIZADOS
Quando o usuário pedir para criar públicos personalizados, gere um bloco mtx-action com action "create_audience":
\`\`\`mtx-action
{
  "action": "create_audience",
  "audience_type": "website_visitors",
  "audience_name": "Visitantes do Site - 180d",
  "retention_days": 180,
  "url_filter": "",
  "reasoning": "Público base para remarketing"
}
\`\`\`

Tipos de público suportados:
- **website_visitors**: Visitantes do site (requer Pixel). Parâmetros: retention_days (1-180), url_filter (opcional).
- **engagement**: Interações com a Página do Facebook. Parâmetros: retention_days (1-365).
- **lookalike**: Público semelhante. Parâmetros: source_audience_id, ratio (0.01 = 1%, 0.02 = 2%, etc).

## CATÁLOGOS DE PRODUTOS (DPA)
Se o perfil tem um catálogo configurado, você pode sugerir campanhas de remarketing dinâmico com catálogo.
Para selecionar catálogo, basta definir \`"use_catalog": true\` no bloco mtx-action.
Se o usuário quiser usar outro catálogo, instrua-o a trocar nas Configurações.

## LINK DE DIRECIONAMENTO
SEMPRE inclua \`"destination_url"\` no bloco mtx-action quando o usuário fornecer um link.
Se o usuário não fornecer, use o primeiro URL de produto do perfil como fallback.

SEMPRE inclua o bloco mtx-action quando o usuário pedir para criar/lançar/subir uma campanha ou criar um público.`;

const DIAGNOSTICO_SYSTEM_PROMPT = `Você é o **Analista de Diagnóstico IA da MTX Estratégias** — um especialista sênior em análise de performance de Meta Ads.

## Sua Missão
Gere um relatório de diagnóstico profundo e acionável com base nas métricas reais fornecidas.

## Estrutura Obrigatória do Relatório

### 🔍 Resumo Executivo
Visão geral da saúde das campanhas em 2-3 parágrafos.

### 🚨 Alertas Imediatos
- 🔴 Crítico (perda de dinheiro ativa)
- 🟡 Atenção (degradação de performance)
- 🟢 Oportunidade (ganho potencial)

### 📊 Análise por Métrica
- **CPA**: Compare com a meta definida.
- **CTR**: Benchmark do mercado 2026 é 1.5-3%.
- **CPM**: Analise custo por mil e sugira ajustes.
- **ROAS/ROI**: Análise de retorno real.

### 🎯 Recomendações de Otimização
Ações ordenadas por impacto.

### 🎨 Estratégia de Criativos
- Formatos a testar (VSL, UGC, carrossel, estático)
- Ganchos sugeridos baseados nos dados

### 📅 Plano de Ação (Próximos 7 dias)
Checklist priorizado.

## Regras
- Use os dados reais fornecidos, NUNCA invente números.
- Compare métricas com benchmarks do mercado brasileiro 2026.
- Seja direto e acionável.
- Formate em markdown rico com emojis.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, campaignData, mode, profileId } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const today = new Date().toISOString().slice(0, 10);
    const basePrompt = mode === "diagnostico" ? DIAGNOSTICO_SYSTEM_PROMPT : CHAT_SYSTEM_PROMPT;

    // Fetch master context if profileId provided
    let masterBlock = "";
    if (profileId) {
      const ctx = await fetchMasterContext(profileId);
      if (ctx.blocked) {
        return new Response(JSON.stringify({ error: ctx.details || ctx.error, blocked: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      masterBlock = ctx.systemPromptBlock;
    }

    const systemPrompt = `**Data de hoje: ${today}**\n\n${masterBlock}\n\n${basePrompt}`;

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
