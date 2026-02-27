import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url, profileId } = await req.json();
    if (!url || !profileId) throw new Error("url e profileId são obrigatórios");

    // Get user from auth header
    const authHeader = req.headers.get("authorization") || "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch the URL content
    const pageResp = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; MTXBot/1.0)" },
    });
    if (!pageResp.ok) throw new Error(`Não foi possível acessar a URL: ${pageResp.status}`);

    const html = await pageResp.text();

    // Extract text from HTML (simple approach)
    const textContent = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 8000); // Limit context size

    if (!textContent || textContent.length < 50) {
      throw new Error("Não foi possível extrair conteúdo suficiente da URL.");
    }

    // Send to AI for structured extraction
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `Você é um analista estratégico sênior. Extraia do conteúdo do site as informações estratégicas no framework Hormozi.
Use a function tool "extract_product_context" para retornar dados estruturados.`,
          },
          {
            role: "user",
            content: `Analise o conteúdo abaixo de um site/landing page e extraia:

1. **Promessa Principal**: O que o produto/serviço promete entregar
2. **Dores do Avatar**: As dores específicas do público-alvo (mínimo 3)
3. **Objeções Comuns**: O que impede o avatar de comprar (mínimo 3)
4. **Oferta (Hormozi Style)**: Como a oferta é estruturada (preço, bônus, garantia, escassez)
5. **Tom de Marca**: Como a marca se comunica (formal, casual, técnico, emocional)
6. **Resumo Estratégico**: Parágrafo resumindo o posicionamento para usar em campanhas

CONTEÚDO DO SITE:
${textContent}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_product_context",
              description: "Structured extraction of product context from website content",
              parameters: {
                type: "object",
                properties: {
                  main_promise: { type: "string", description: "Promessa principal do produto" },
                  avatar_pains: { type: "array", items: { type: "string" }, description: "Dores do avatar" },
                  objections: { type: "array", items: { type: "string" }, description: "Objeções comuns" },
                  offer_structure: { type: "string", description: "Estrutura da oferta Hormozi style" },
                  brand_tone: { type: "string", description: "Tom de voz da marca" },
                  strategic_summary: { type: "string", description: "Resumo estratégico para campanhas" },
                },
                required: ["main_promise", "avatar_pains", "objections", "offer_structure", "brand_tone", "strategic_summary"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_product_context" } },
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao workspace." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("Erro na análise da IA");
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      throw new Error("IA não retornou dados estruturados.");
    }

    const extracted = JSON.parse(toolCall.function.arguments);

    // Build full context string for storage
    const contextString = `## Promessa Principal\n${extracted.main_promise}\n\n## Dores do Avatar\n${extracted.avatar_pains.map((p: string) => `- ${p}`).join("\n")}\n\n## Objeções\n${extracted.objections.map((o: string) => `- ${o}`).join("\n")}\n\n## Estrutura da Oferta\n${extracted.offer_structure}\n\n## Tom de Marca\n${extracted.brand_tone}\n\n## Resumo Estratégico\n${extracted.strategic_summary}`;

    // Update profile with product context
    // First get existing URLs
    const { data: profile } = await supabase
      .from("client_profiles")
      .select("product_urls")
      .eq("id", profileId)
      .single();

    const existingUrls = (profile?.product_urls as string[]) || [];
    const updatedUrls = existingUrls.includes(url) ? existingUrls : [...existingUrls, url];

    const { error: updateError } = await supabase
      .from("client_profiles")
      .update({
        product_context: contextString,
        product_urls: updatedUrls,
      })
      .eq("id", profileId);

    if (updateError) throw new Error(`Erro ao salvar contexto: ${updateError.message}`);

    return new Response(JSON.stringify({ ...extracted, context_saved: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("absorb-product-context error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
