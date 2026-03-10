import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { fetchMasterContext } from "../_shared/fetch_master_context.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PHOTOREALISTIC_PROMPT = `You are a Senior Art Director and Photo Retoucher specialized in High-Conversion creatives for Meta Ads. Your mission is to take the user's raw idea and transform it into an EXTREMELY detailed image generation prompt in ENGLISH that produces HYPER-REALISTIC results indistinguishable from real photography.

IMMUTABLE STYLE RULES (inject ALL of these into every prompt):
1. "Aspect ratio: 4:5 portrait (1080x1350 pixels)."
2. "Background: Dark textured background with minimalist elements and subtle red or soft neon accents."
3. "Shot on Sony A7R V with 85mm f/1.4 GM lens at ISO 200. Camera RAW processed with Adobe Camera Raw."
4. "Color palette: Deep blacks, warm highlights, strategic pops of brand color. Film-like color grading with muted organic tones."
5. "Mood: Premium, aspirational, high-converting ad creative."

HYPER-REALISM DIRECTIVES (mandatory in every prompt you generate):
- Visible skin texture: pores, fine lines, subsurface scattering, micro-imperfections. NEVER plastic or airbrushed.
- Authentic materials: visible fabric weave and thread texture, metal with realistic reflections and micro-scratches, surfaces with natural wear patterns.
- Natural volumetric lighting: soft fill, realistic shadow falloff, ambient occlusion in creases and folds.
- Lens characteristics: subtle chromatic aberration on edges, natural vignette, shallow depth of field with organic bokeh circles.
- Environmental realism: dust particles catching light, subtle atmospheric haze, accurate reflections on glossy surfaces.
- NO AI artifacts, NO over-saturated colors, NO unnaturally smooth gradients, NO symmetrical perfection.

RETURN ONLY the image prompt text in English. No explanations, no quotes, no Markdown formatting. Just the raw visual instruction. Maximum 300 words.`;

const STYLIZED_PROMPT = `You are a Senior Creative Director specialized in stylized, artistic ad creatives for Meta Ads. Your mission is to take the user's raw idea and transform it into an EXTREMELY detailed image generation prompt in ENGLISH that produces visually striking STYLIZED artwork.

IMMUTABLE STYLE RULES (inject ALL of these into every prompt):
1. "Aspect ratio: 4:5 portrait (1080x1350 pixels)."
2. "Background: Bold, graphic, with dynamic composition and striking color contrasts."
3. "Style: Modern digital illustration, editorial art direction, or graphic design with a premium feel."
4. "Color palette: Vibrant yet cohesive, with bold accents and intentional color blocking."
5. "Mood: Eye-catching, scroll-stopping, and memorable."

STYLIZED DIRECTIVES (mandatory in every prompt you generate):
- Bold graphic elements: clean lines, geometric shapes, dynamic compositions.
- Expressive illustration style: can range from editorial illustration to modern flat design to 3D render.
- Intentional color choices: saturated palettes, gradient overlays, duotone effects when appropriate.
- Typography-friendly compositions: leave clear areas for text overlay placement.
- Creative textures: grain, halftone, paper texture, digital brushstrokes.
- Artistic lighting: dramatic, non-realistic, serving the composition and mood.

RETURN ONLY the image prompt text in English. No explanations, no quotes, no Markdown formatting. Just the raw visual instruction. Maximum 300 words.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { profileId, rawIdea, referenceImageUrl, style = "photorealistic" } = await req.json();
    if (!profileId || !rawIdea) {
      return new Response(JSON.stringify({ error: "profileId and rawIdea are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Fetch brand context
    const ctx = await fetchMasterContext(profileId);
    if (ctx.blocked) {
      return new Response(JSON.stringify({ error: ctx.error, details: ctx.details }), {
        status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { profile } = ctx;
    const brandContext = `
BRAND CONTEXT:
- Name: ${profile.name}
- Avatar Dossier: ${profile.avatar_dossier || "Not available"}
- Product Context: ${profile.product_context || "Not available"}`;

    // Build messages - multimodal if reference image provided
    const userContent: any[] = [];
    
    if (referenceImageUrl) {
      userContent.push({
        type: "text",
        text: `${brandContext}

USER'S RAW IDEA: ${rawIdea}

REFERENCE IMAGE ANALYSIS: You are receiving a REFERENCE IMAGE of the client's real product. Analyze the visual style, textures, colors, and lighting of the image. Create a prompt that MAINTAINS the essence and aesthetics of the product from the reference, but elevates quality to cinematic studio photorealism with dark textured background, 4:5 ratio, and high-conversion focus.`,
      });
      userContent.push({
        type: "image_url",
        image_url: { url: referenceImageUrl },
      });
    } else {
      userContent.push({
        type: "text",
        text: `${brandContext}\n\nUSER'S RAW IDEA: ${rawIdea}`,
      });
    }

    const systemPrompt = style === "stylized" ? STYLIZED_PROMPT : PHOTOREALISTIC_PROMPT;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: referenceImageUrl ? "google/gemini-2.5-pro" : "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
      }),
    });

    if (!resp.ok) {
      if (resp.status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again later." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (resp.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`AI gateway error: ${resp.status}`);
    }

    const data = await resp.json();
    const masterPrompt = data.choices?.[0]?.message?.content?.trim();
    if (!masterPrompt) throw new Error("Failed to generate master prompt");

    return new Response(JSON.stringify({ masterPrompt }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-master-prompt error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
