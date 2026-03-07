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
        const { visualDNA, theme, profileId } = await req.json();
        const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

        if (!LOVABLE_API_KEY) {
            throw new Error("Missing LOVABLE_API_KEY");
        }

        console.log(`Generating Carousel for: ${theme}`);

        // Generate Carousel Content with Gemini
        const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${LOVABLE_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "google/gemini-2.0-flash-exp",
                messages: [
                    {
                        role: "system",
                        content: `Você é um Especialista em Copywriting para Instagram e Design Estratégico.
            Sua missão é criar um carrossel de alto impacto que siga o framework स्टोरीब्रांड (StoryBrand) e AIDA.
            
            O carrossel deve respeitar o DNA Visual do cliente:
            - Tom: ${visualDNA.tone}
            - Estética: ${visualDNA.aesthetic}
            
            Retorne um JSON com:
            - "title": Título do carrossel.
            - "slides": Uma lista de objetos para cada slide (mínimo 7, máximo 10).
              Cada slide deve ter:
              - "headline": Título curto e impactante.
              - "body": Texto de apoio curto.
              - "image_prompt": Descrição para gerar uma imagem usando IA que combine com o conteúdo do slide.
              - "type": "hook", "value", "solution", "cta".`
                    },
                    {
                        role: "user",
                        content: `Crie um carrossel magnético sobre o tema: ${theme}`
                    }
                ],
                response_format: { type: "json_object" }
            }),
        });

        const aiData = await aiRes.json();
        if (!aiRes.ok) {
            throw new Error(`AI generation failed: ${JSON.stringify(aiData)}`);
        }

        const carousel = JSON.parse(aiData.choices[0].message.content);

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
            tip: "Verifique se a visualDNA foi enviada corretamente e se sua LOVABLE_API_KEY está configurada."
        }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
