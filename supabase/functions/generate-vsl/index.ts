import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { profileId, angle, duration, tone } = await req.json();
    if (!profileId) throw new Error("profileId is required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Get profile + context
    const { data: profile, error: pErr } = await sb.from("client_profiles").select("*").eq("id", profileId).single();
    if (pErr || !profile) throw new Error("Profile not found");

    // Get creative assets for this profile
    const { data: assets } = await sb.from("creative_assets").select("file_name, file_type, description").eq("profile_id", profileId).limit(20);

    const assetList = (assets || []).map((a: any) => `- ${a.file_name} (${a.file_type})${a.description ? `: ${a.description}` : ""}`).join("\n");

    const systemPrompt = `Você é um roteirista de alta conversão especializado em VSL (Video Sales Letters) e copies para Meta Ads. Use os frameworks Storybrand e Hook-Story-Offer (Alex Hormozi).

REGRAS ESTRITAS DE FORMATO:
- O output DEVE ser uma tabela Markdown com DUAS colunas:
  - Coluna 1: 🎥 VISUAL (B-Roll/Câmera) — Instruções exatas do que aparece na tela
  - Coluna 2: 🎙️ ÁUDIO (Locução) — Texto exato que o locutor vai ler, com **ênfases** e [PAUSA 1s]
- NÃO escreva texto corrido. Apenas tabela.
- Se houver ativos disponíveis no banco, REFERENCIE-OS na coluna VISUAL pelo nome do arquivo.

CADEIA DE RACIOCÍNIO:
1. STORYBRAND: Identifique o Cliente como o Herói e o Produto como o Guia
2. HOOK (0-5s): Interrupção de padrão focada na maior dor
3. STORY: Agite a dor e introduza o mecanismo único do produto
4. OFFER (Hormozi): Maximize Valor Percebido, minimize Esforço/Tempo`;

    const userPrompt = `## Contexto do Produto
${profile.product_context || "Sem contexto registrado."}

## Ativos Visuais Disponíveis
${assetList || "Nenhum ativo cadastrado."}

## Direção Criativa
- Ângulo da Oferta: ${angle || "Não especificado"}
- Tempo Desejado: ${duration || "30 segundos"}
- Tom de Voz: ${tone || "Direto e persuasivo"}

Gere o roteiro completo agora.`;

    // Stream from Lovable AI
    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
        stream: true,
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      console.error("AI error:", aiResp.status, errText);
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Tente novamente em alguns minutos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos esgotados. Adicione créditos ao workspace." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI gateway error");
    }

    // Collect full content for saving to DB, but stream to client
    const reader = aiResp.body!.getReader();
    const decoder = new TextDecoder();
    let fullContent = "";

    const stream = new ReadableStream({
      async start(controller) {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            controller.enqueue(new TextEncoder().encode(chunk));

            // Extract content for DB save
            for (const line of chunk.split("\n")) {
              if (!line.startsWith("data: ")) continue;
              const json = line.slice(6).trim();
              if (json === "[DONE]") continue;
              try {
                const parsed = JSON.parse(json);
                const c = parsed.choices?.[0]?.delta?.content;
                if (c) fullContent += c;
              } catch {}
            }
          }

          // Save to DB after streaming completes
          if (fullContent) {
            await sb.from("vsl_scripts").insert({
              profile_id: profileId,
              user_id: profile.user_id,
              angle: angle || "",
              duration: duration || "",
              tone: tone || "",
              script_content: fullContent,
            });
          }

          controller.close();
        } catch (e) {
          controller.error(e);
        }
      },
    });

    return new Response(stream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
