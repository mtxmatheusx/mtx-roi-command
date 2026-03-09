import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
        const rawText = await req.text();
        if (!rawText || rawText.trim() === "") {
            return new Response(JSON.stringify({ error: "Corpo da requisição vazio." }), {
                status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        let body: any;
        try { body = JSON.parse(rawText); } catch {
            return new Response(JSON.stringify({ error: "JSON inválido no corpo da requisição." }), {
                status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const { visualDNA, theme, profileId } = body;
        const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

        if (!LOVABLE_API_KEY) {
            throw new Error("Missing LOVABLE_API_KEY");
        }

        if (!theme) {
            return new Response(JSON.stringify({ error: "Tema é obrigatório." }), {
                status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        console.log(`Generating Carousel for: ${theme}`);

        const paletteInfo = visualDNA?.palette?.length
            ? `Paleta de cores da marca: ${visualDNA.palette.join(", ")}`
            : "Use cores profissionais e contrastantes.";

        const systemPrompt = `Você é um Especialista em Copywriting para Instagram e Design Estratégico de carrosséis de alta conversão.

MISSÃO: Criar um carrossel magnético que siga os frameworks StoryBrand (Donald Miller) e AIDA (Atenção, Interesse, Desejo, Ação).

DNA VISUAL DO CLIENTE (OBRIGATÓRIO SEGUIR):
- Tom de Voz: ${visualDNA?.tone || "Profissional e direto"}
- Estética: ${visualDNA?.aesthetic || "Clean e moderna"}
- Tipografia: ${visualDNA?.typography || "Sans-serif moderna"}
- ${paletteInfo}
- Resumo da Marca: ${visualDNA?.summary || "Não disponível"}

REGRAS DE CRIAÇÃO:
1. O PRIMEIRO slide DEVE ser um gancho irresistível (hook) que gere curiosidade extrema.
2. Os slides intermediários devem entregar valor real, com dados, frameworks ou insights acionáveis.
3. O ÚLTIMO slide DEVE ser um CTA claro e persuasivo.
4. A linguagem deve ser IDÊNTICA ao tom de voz do DNA Visual — se é formal, mantenha formal; se é coloquial, use gírias.
5. Cada headline deve ser curta (máx 8 palavras), impactante e scroll-stopping.
6. O body text deve complementar sem repetir a headline.
7. Os image_prompts devem descrever cenas que refletem a estética da marca.

Retorne APENAS um JSON válido (sem markdown, sem backticks) com esta estrutura:
{
  "title": "Título do carrossel",
  "slides": [
    {
      "headline": "Título curto e impactante",
      "body": "Texto de apoio (2-3 linhas)",
      "image_prompt": "Descrição visual detalhada para gerar imagem IA no estilo da marca",
      "type": "hook | value | solution | cta"
    }
  ]
}

Gere entre 7 e 10 slides. A distribuição ideal: 1 hook, 5-7 value/solution, 1 cta.`;

        const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${LOVABLE_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "google/gemini-2.5-flash",
                messages: [
                    { role: "system", content: systemPrompt },
                    {
                        role: "user",
                        content: `Crie um carrossel magnético sobre o tema: "${theme}"\n\nO conteúdo deve ser 100% alinhado com a identidade visual e tom de voz do perfil analisado.`
                    }
                ],
                response_format: { type: "json_object" }
            }),
        });

        if (!aiRes.ok) {
            if (aiRes.status === 429) {
                return new Response(JSON.stringify({ error: "Rate limit atingido. Tente novamente em alguns segundos." }), {
                    status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
            }
            if (aiRes.status === 402) {
                return new Response(JSON.stringify({ error: "Créditos de IA insuficientes." }), {
                    status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
            }
            const errText = await aiRes.text();
            console.error("AI gateway error:", aiRes.status, errText);
            throw new Error(`AI generation failed: ${errText}`);
        }

        const aiData = await aiRes.json();
        const rawContent = aiData.choices?.[0]?.message?.content;

        if (!rawContent) {
            throw new Error("IA retornou resposta vazia.");
        }

        let carousel: any;
        try {
            carousel = JSON.parse(rawContent);
        } catch {
            // Try extracting JSON from markdown code blocks
            const jsonMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/);
            if (jsonMatch) {
                carousel = JSON.parse(jsonMatch[1]);
            } else {
                throw new Error("Resposta da IA não é JSON válido.");
            }
        }

        return new Response(JSON.stringify({
            success: true,
            data: carousel,
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (e: any) {
        console.error("generate-carousel error:", e.message);
        return new Response(JSON.stringify({
            error: e.message,
            tip: "Verifique se a visualDNA foi enviada corretamente."
        }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
