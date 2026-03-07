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
        const { url, manualContent } = await req.json();
        const RAPIDAPI_KEY = Deno.env.get("RAPIDAPI_KEY");
        const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

        if (!LOVABLE_API_KEY) {
            return new Response(
                JSON.stringify({ error: "LOVABLE_API_KEY não configurado." }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
            );
        }

        let contentToAnalyze = manualContent || "";

        // 1. If no manual content, try RocketAPI (RapidAPI)
        if (!contentToAnalyze && url) {
            const username = url.split('/').filter(Boolean).pop();
            console.log(`[ROCKET-API] Analyzing username: ${username}`);

            if (!RAPIDAPI_KEY) {
                console.warn("RAPIDAPI_KEY not configured. Automated analysis will skip.");
            } else {
                try {
                    // Step A: Get User ID
                    const userRes = await fetch(`https://instagram47.p.rapidapi.com/get_user_id?username=${username}`, {
                        method: 'GET',
                        headers: {
                            'x-rapidapi-key': RAPIDAPI_KEY,
                            'x-rapidapi-host': 'instagram47.p.rapidapi.com'
                        }
                    });

                    const userData = await userRes.json();
                    const userId = userData.user_id;

                    if (userId) {
                        console.log(`[ROCKET-API] Found User ID: ${userId}. Fetching posts...`);
                        // Step B: Get Recent Posts
                        const postsRes = await fetch(`https://instagram47.p.rapidapi.com/get_user_posts?user_id=${userId}`, {
                            method: 'GET',
                            headers: {
                                'x-rapidapi-key': RAPIDAPI_KEY,
                                'x-rapidapi-host': 'instagram47.p.rapidapi.com'
                            }
                        });
                        const postsData = await postsRes.json();

                        const posts = postsData.posts || [];
                        contentToAnalyze = `
                            Perfil: ${username}
                            Recent Posts Captions:
                            ${posts.slice(0, 5).map((p: any) => p.caption?.text || "").join("\n---\n")}
                        `;
                    } else {
                        console.warn("[ROCKET-API] User ID not found.");
                    }
                } catch (e) {
                    console.error("RocketAPI integration error:", e);
                }
            }
        }

        if (!contentToAnalyze || contentToAnalyze.length < 20) {
            return new Response(
                JSON.stringify({
                    error: "Não conseguimos ler o perfil automaticamente.",
                    tip: "O Instagram bloqueou o acesso padrão. Por favor, use o botão 'Colar Texto' ou configure sua RAPIDAPI_KEY no Supabase."
                }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
            );
        }

        // 2. Analyze with Gemini
        console.log("[GEMINI] Analyzing brand DNA...");
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
                        content: `Você é um especialista em branding. 
                        Analise as informações de um perfil do Instagram e extraia o DNA visual.
                        Retorne JSON: palette (5 hex codes), typography, tone, aesthetic, summary, image_prompt_style.`
                    },
                    {
                        role: "user",
                        content: `Extraia o DNA visual destas informações:\n\n${contentToAnalyze.slice(0, 10000)}`
                    }
                ],
                response_format: { type: "json_object" }
            }),
        });

        const aiData = await aiRes.json();
        const result = JSON.parse(aiData.choices[0].message.content);

        return new Response(
            JSON.stringify({ success: true, data: result }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );

    } catch (err: any) {
        console.error("Global Error:", err.message);
        return new Response(
            JSON.stringify({
                error: "Erro inesperado na análise.",
                tip: "Tente copiar e colar o texto do perfil manualmente ou verifique sua conexão."
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
    }
});
