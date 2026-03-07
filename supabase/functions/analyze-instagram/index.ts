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
        const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

        if (!LOVABLE_API_KEY) {
            return new Response(
                JSON.stringify({ error: "LOVABLE_API_KEY não configurado." }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
            );
        }

        // Extract username from URL
        const username = url ? url.split('/').filter(Boolean).pop() : "";
        let contentToAnalyze = manualContent || "";

        // If manual content was provided, use it directly.
        // Otherwise, use AI knowledge-based analysis from the username.
        if (!contentToAnalyze && username) {
            contentToAnalyze = `ANÁLISE BASEADA EM CONHECIMENTO: O perfil do Instagram é @${username}. Use todo o seu conhecimento sobre essa marca/pessoa para inferir o DNA visual.`;
        }

        if (!contentToAnalyze) {
            return new Response(
                JSON.stringify({
                    error: "Nenhuma informação fornecida.",
                    tip: "Insira um link de perfil ou cole o texto da bio manualmente."
                }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
            );
        }

        // Analyze with Gemini
        console.log(`[GEMINI] Analyzing brand DNA for: ${username || "manual input"}`);
        const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
                        content: `Você é um especialista mundial em branding visual e identidade de marca para Instagram.

Sua tarefa é extrair o DNA visual de um perfil do Instagram.
Se você receber texto direto (bio, legendas), analise-o.
Se você receber apenas o nome de usuário (@username), use TODO o seu conhecimento sobre essa marca, pessoa ou empresa.
Seja criativo e detalhado. Infira cores, estilo tipográfico, tom de voz e estética com base no nicho e posicionamento.

SEMPRE retorne um JSON válido com esta estrutura exata:
{
  "palette": ["#hex1", "#hex2", "#hex3", "#hex4", "#hex5"],
  "typography": "descrição do estilo tipográfico",
  "tone": "descrição do tom de voz",
  "aesthetic": "descrição da estética visual",
  "summary": "resumo do DNA da marca em 2-3 frases",
  "image_prompt_style": "estilo para gerar imagens dessa marca"
}`
                    },
                    {
                        role: "user",
                        content: contentToAnalyze.slice(0, 10000)
                    }
                ],
                response_format: { type: "json_object" }
            }),
        });

        if (!aiRes.ok) {
            const errText = await aiRes.text();
            console.error("Gemini API Error:", aiRes.status, errText);

            if (aiRes.status === 429) {
                return new Response(
                    JSON.stringify({ error: "Limite de requisições excedido.", tip: "Aguarde alguns segundos e tente novamente." }),
                    { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
                );
            }
            if (aiRes.status === 402) {
                return new Response(
                    JSON.stringify({ error: "Créditos de IA insuficientes.", tip: "Adicione créditos ao seu workspace Lovable." }),
                    { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
                );
            }

            return new Response(
                JSON.stringify({ error: "Erro no gateway de IA.", tip: `Status: ${aiRes.status}. Tente novamente.` }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
            );
        }

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
