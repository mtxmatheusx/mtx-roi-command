import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
  "Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0",
];

const SOCIAL_MEDIA_DOMAINS = ["instagram.com", "facebook.com", "tiktok.com", "twitter.com", "x.com", "threads.net"];

function isSocialMediaUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.replace("www.", "");
    return SOCIAL_MEDIA_DOMAINS.some((d) => hostname.includes(d));
  } catch {
    return false;
  }
}

async function fetchWithRetry(url: string, maxRetries = 3): Promise<string> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const ua = USER_AGENTS[attempt % USER_AGENTS.length];
    try {
      const resp = await fetch(url, {
        headers: {
          "User-Agent": ua,
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
        },
      });
      if (resp.status === 429) {
        const wait = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
        console.log(`429 received, waiting ${Math.round(wait)}ms before retry ${attempt + 1}/${maxRetries}`);
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return await resp.text();
    } catch (e) {
      if (attempt === maxRetries - 1) throw e;
      await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
    }
  }
  throw new Error("Máximo de tentativas excedido");
}

// Try Firecrawl deep crawl if available
async function tryFirecrawl(url: string): Promise<string | null> {
  const apiKey = Deno.env.get("FIRECRAWL_API_KEY");
  if (!apiKey) return null;

  console.log("Firecrawl available, attempting deep scrape for:", url);
  try {
    // Use scrape endpoint for single page (fast)
    const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        formats: ["markdown"],
        onlyMainContent: true,
      }),
    });

    if (!response.ok) {
      console.log("Firecrawl scrape failed:", response.status);
      return null;
    }

    const data = await response.json();
    const markdown = data?.data?.markdown || data?.markdown;
    if (markdown && markdown.length > 50) {
      console.log(`Firecrawl extracted ${markdown.length} chars`);
      return markdown.slice(0, 12000);
    }
    return null;
  } catch (e) {
    console.error("Firecrawl error:", e);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url, profileId, manualText } = await req.json();
    if (!profileId) throw new Error("profileId é obrigatório");
    if (!url && !manualText) throw new Error("url ou manualText é obrigatório");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let textContent: string;

    if (manualText) {
      textContent = manualText.trim().slice(0, 8000);
      if (textContent.length < 20) {
        throw new Error("Texto muito curto. Cole pelo menos um parágrafo.");
      }
    } else {
      if (isSocialMediaUrl(url!)) {
        return new Response(JSON.stringify({
          error: "Redes sociais bloqueiam scraping automático. Use o campo de 'Inserção Manual' para colar o conteúdo.",
          scrape_failed: true,
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Try Firecrawl first (deep scrape), then fallback to simple fetch
      let content = await tryFirecrawl(url!);

      if (!content) {
        let html: string;
        try {
          html = await fetchWithRetry(url!);
        } catch (e) {
          return new Response(JSON.stringify({
            error: `Não foi possível acessar a URL. Use o campo de 'Inserção Manual' para colar o conteúdo.`,
            scrape_failed: true,
          }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        content = html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 8000);
      }

      textContent = content;

      if (!textContent || textContent.length < 50) {
        return new Response(JSON.stringify({
          error: "Não foi possível extrair conteúdo suficiente. Use o campo de 'Inserção Manual'.",
          scrape_failed: true,
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Get existing context for cumulative merge
    const { data: profile } = await supabase
      .from("client_profiles")
      .select("product_context, product_urls")
      .eq("id", profileId)
      .single();

    const existingContext = profile?.product_context || "";
    const existingUrls = (profile?.product_urls as string[]) || [];
    const totalLinksAfter = url ? (existingUrls.includes(url) ? existingUrls.length : existingUrls.length + 1) : existingUrls.length;

    const consolidationInstruction = (existingContext && totalLinksAfter >= 2)
      ? `\n\nCONTEXTO EXISTENTE DO PERFIL (de URLs anteriores):\n${existingContext}\n\nVocê deve CONSOLIDAR as informações do novo conteúdo com o contexto existente acima, criando um perfil unificado. Identifique padrões consistentes e dores/objeções negligenciadas.`
      : "";

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
            content: `Você é um analista estratégico sênior especializado em Hormozi. Extraia do conteúdo as informações estratégicas.
Use a function tool "extract_product_context" para retornar dados estruturados.${consolidationInstruction ? "\nQuando houver contexto existente, CONSOLIDE as informações em vez de substituir." : ""}
Se o conteúdo parecer de e-commerce, identifique também: produtos mais vendidos, faixas de preço, provas sociais (avaliações/depoimentos).`,
          },
          {
            role: "user",
            content: `Analise o conteúdo abaixo e extraia:

1. **Promessa Principal**: O que o produto/serviço promete entregar
2. **Dores do Avatar**: As dores específicas do público-alvo (mínimo 3)
3. **Objeções Comuns**: O que impede o avatar de comprar (mínimo 3)
4. **Oferta (Hormozi Style)**: Como a oferta é estruturada (preço, bônus, garantia, escassez)
5. **Tom de Marca**: Como a marca se comunica
6. **Resumo Estratégico**: Parágrafo resumindo o posicionamento para campanhas
${consolidationInstruction}

CONTEÚDO:
${textContent}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_product_context",
              description: "Structured extraction of product context",
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

    const contextString = `## Promessa Principal\n${extracted.main_promise}\n\n## Dores do Avatar\n${extracted.avatar_pains.map((p: string) => `- ${p}`).join("\n")}\n\n## Objeções\n${extracted.objections.map((o: string) => `- ${o}`).join("\n")}\n\n## Estrutura da Oferta\n${extracted.offer_structure}\n\n## Tom de Marca\n${extracted.brand_tone}\n\n## Resumo Estratégico\n${extracted.strategic_summary}`;

    // Update profile
    const updatedUrls = url ? (existingUrls.includes(url) ? existingUrls : [...existingUrls, url]) : existingUrls;

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
