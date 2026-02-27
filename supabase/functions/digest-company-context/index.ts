import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é um Estrategista de Marketing Sênior (nível Russell Brunson e Alex Hormozi). Sua missão é ler os documentos desta empresa e extrair a psicologia profunda do cliente ideal (Avatar).

Analise o texto fornecido e retorne os seguintes pontos usando a function tool "extract_avatar_dossier":

- **A Dor Sangrenta (Agitation):** Qual é a maior frustração que tira o sono do cliente antes de comprar este produto/serviço?
- **O Desejo Final (Dream Outcome):** O que ele realmente quer alcançar? (Não foque no produto, foque na transformação).
- **Mecanismo Único (Solução):** Como o produto desta empresa resolve a dor de uma forma que os concorrentes não fazem?
- **Objeções Principais:** Quais são as 3 desculpas que o cliente dá para não comprar hoje?
- **Tom de Voz da Marca:** Como a empresa deve soar (ex: Sofisticada, Agressiva, Acolhedora)?

Seja específico ao nicho da empresa. NÃO use exemplos genéricos de marketing digital. Adapte 100% ao contexto fornecido.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { profileId } = await req.json();
    if (!profileId) throw new Error("profileId é obrigatório");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);

    // Fetch all knowledge_base entries for this profile
    const { data: kbEntries } = await sb
      .from("knowledge_base")
      .select("*")
      .eq("profile_id", profileId)
      .order("created_at", { ascending: true });

    // Fetch profile for product_context fallback and name
    const { data: profile } = await sb
      .from("client_profiles")
      .select("name, product_context, product_urls")
      .eq("id", profileId)
      .single();

    // Build consolidated text
    const blocks: string[] = [];

    if (profile?.name) {
      blocks.push(`**Nome da Empresa/Perfil:** ${profile.name}`);
    }

    // Text fields from knowledge_base
    const textFields = (kbEntries || []).filter((e: any) => e.doc_type === "text_field" && e.extracted_text);
    const fieldLabels: Record<string, string> = {
      what_we_sell: "O que vendemos",
      our_story: "Nossa História/Narrativa",
      main_trigger: "Nosso Diferencial/Gatilho Principal",
    };
    for (const tf of textFields) {
      const label = fieldLabels[tf.field_key] || tf.field_key;
      blocks.push(`**${label}:** ${tf.extracted_text}`);
    }

    // File extractions
    const fileEntries = (kbEntries || []).filter((e: any) => e.doc_type === "file" && e.status === "processed" && e.extracted_text);
    for (const fe of fileEntries) {
      blocks.push(`**Documento "${fe.file_name}":**\n${fe.extracted_text}`);
    }

    // Fallback to product_context
    if (profile?.product_context) {
      blocks.push(`**Contexto do Produto (absorvido anteriormente):**\n${profile.product_context}`);
    }

    if (blocks.length === 0) {
      return new Response(JSON.stringify({ error: "Nenhum conteúdo encontrado. Adicione documentos ou preencha os campos de texto primeiro." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const consolidatedText = blocks.join("\n\n---\n\n");

    const userPrompt = `Analise o seguinte dossiê da empresa e extraia o perfil psicológico completo do Avatar (cliente ideal):\n\n${consolidatedText}`;

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
              name: "extract_avatar_dossier",
              description: "Retorna o dossiê estruturado do Avatar baseado na análise do contexto da empresa.",
              parameters: {
                type: "object",
                properties: {
                  bleeding_pain: { type: "string", description: "A Dor Sangrenta — maior frustração do cliente antes de comprar" },
                  dream_outcome: { type: "string", description: "O Desejo Final — transformação que o cliente quer alcançar" },
                  unique_mechanism: { type: "string", description: "Mecanismo Único — como o produto resolve a dor diferente dos concorrentes" },
                  main_objections: {
                    type: "array",
                    items: { type: "string" },
                    description: "3 objeções principais que impedem a compra",
                  },
                  brand_voice: { type: "string", description: "Tom de Voz da Marca (ex: Sofisticada, Agressiva, Acolhedora)" },
                  executive_summary: { type: "string", description: "Resumo executivo do avatar em 2-3 frases" },
                },
                required: ["bleeding_pain", "dream_outcome", "unique_mechanism", "main_objections", "brand_voice", "executive_summary"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_avatar_dossier" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }), {
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
      return new Response(JSON.stringify({ error: "Erro ao gerar dossiê." }), {
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

    const dossier = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(dossier), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("digest-company-context error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
