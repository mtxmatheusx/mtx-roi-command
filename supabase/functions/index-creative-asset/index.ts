import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { assetId, profileId, fileUrl, fileType, fileName } = await req.json();
    if (!assetId || !fileUrl) throw new Error("assetId and fileUrl are required");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const isVideo = fileType === "video" || /\.(mp4|mov|webm)$/i.test(fileName || "");

    const systemPrompt = `Você é um analista de criativos para campanhas de performance marketing (Meta Ads).
Analise este ativo visual e gere uma descrição técnica rica em metadados para matching com campanhas.

Inclua obrigatoriamente:
- Tipo de conteúdo (depoimento, produto, lifestyle, before/after, UGC, etc.)
- Iluminação e cores dominantes
- Emoção transmitida
- Cenário/ambiente
- Público-alvo implícito
- Elementos de prova social (se houver)
- Adequação para formatos: feed, stories, reels

Responda em português brasileiro, máximo 200 palavras.`;

    const messages: any[] = [
      { role: "system", content: systemPrompt },
    ];

    if (isVideo) {
      messages.push({
        role: "user",
        content: `Analise este ativo de vídeo para campanhas Meta Ads. Nome do arquivo: "${fileName || "video"}". URL: ${fileUrl}\n\nDescreva tecnicamente este criativo para matching com campanhas.`,
      });
    } else {
      messages.push({
        role: "user",
        content: [
          { type: "text", text: `Analise esta imagem criativa para campanhas Meta Ads. Nome: "${fileName || "image"}"` },
          { type: "image_url", image_url: { url: fileUrl } },
        ],
      });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit — tente novamente em alguns segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      throw new Error("Erro no gateway de IA");
    }

    const aiData = await response.json();
    const description = aiData.choices?.[0]?.message?.content || "Sem descrição gerada";

    // Update asset description
    await supabase
      .from("creative_assets")
      .update({ description })
      .eq("id", assetId);

    return new Response(JSON.stringify({ description, assetId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("index-creative-asset error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
