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
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let body: any;
    try {
      body = JSON.parse(rawText);
    } catch {
      return new Response(JSON.stringify({ error: "JSON inválido." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { prompt, visualDNA } = body;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("Missing LOVABLE_API_KEY");
    }

    if (!prompt) {
      return new Response(JSON.stringify({ error: "Prompt é obrigatório." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const paletteInfo = visualDNA?.palette?.length
      ? `Color palette: ${visualDNA.palette.join(", ")}.`
      : "";

    const fullPrompt = `Create a professional-grade Instagram carousel slide image with editorial quality. ${prompt}. ${paletteInfo} Style: ${visualDNA?.aesthetic || "Clean and modern"}. CRITICAL QUALITY DIRECTIVES: Shot on Hasselblad X2D 100C with XCD 90mm f/2.5 lens at native ISO 64. Camera RAW processed in Capture One Pro with careful highlight recovery and shadow detail. HUMAN RENDERING: Anatomically correct proportions, natural asymmetric features, realistic skin with visible pores and subsurface scattering, natural hair texture with individual strand detail, eyes with realistic iris patterns and specular highlights, natural lip texture. MATERIAL QUALITY: Authentic fabric rendering with visible thread count, proper drape physics, realistic leather grain, metal with accurate HDRI reflections. LIGHTING: Three-point studio setup with large octabox key light, edge-lit rim, and negative fill for sculpting. Natural color temperature mixing. POST-PROCESSING: Subtle frequency separation retouching preserving skin texture, dodge-and-burn contouring, color-accurate output. NO uncanny valley effects, NO waxy skin, NO anatomical errors, NO AI artifacts. 1080x1350 portrait format, social media ready. No text overlays.`;

    console.log("Generating image with prompt:", fullPrompt.substring(0, 100));

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3.1-flash-image-preview",
        messages: [
          {
            role: "user",
            content: fullPrompt,
          },
        ],
        modalities: ["image", "text"],
      }),
    });

    if (!aiRes.ok) {
      if (aiRes.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit atingido. Tente novamente em alguns segundos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiRes.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA insuficientes." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiRes.text();
      console.error("AI gateway error:", aiRes.status, errText);
      throw new Error(`Image generation failed: ${errText}`);
    }

    const aiData = await aiRes.json();
    const imageUrl = aiData.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!imageUrl) {
      throw new Error("IA não retornou imagem.");
    }

    return new Response(JSON.stringify({
      success: true,
      image_url: imageUrl,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e: any) {
    console.error("generate-carousel-image error:", e.message);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
