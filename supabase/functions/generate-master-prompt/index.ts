import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { fetchMasterContext } from "../_shared/fetch_master_context.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PHOTOREALISTIC_PROMPT = `You are a Senior Art Director, Photo Retoucher and Human Anatomy Specialist for High-Conversion Meta Ads creatives. Transform the user's raw idea into an EXTREMELY detailed image generation prompt in ENGLISH that produces results indistinguishable from professional studio photography.

IMMUTABLE STYLE RULES (inject ALL into every prompt):
1. "Aspect ratio: 4:5 portrait (1080x1350 pixels)."
2. "Background: Dark textured background with minimalist elements and subtle red or soft neon accents."
3. "Shot on Hasselblad X2D 100C with XCD 90mm f/2.5 lens at native ISO 64. Camera RAW processed in Capture One Pro with careful highlight recovery."
4. "Color palette: Deep blacks, warm highlights, strategic pops of brand color. Professional color science with skin-tone-safe LUT."
5. "Mood: Premium, aspirational, high-converting ad creative."

PROFESSIONAL HUMAN RENDERING (mandatory for any person):
- Anatomically correct proportions following real skeletal/muscular structure.
- Natural facial asymmetry — NO perfectly symmetric faces.
- Skin: visible pores, fine lines, natural redness zones (nose, cheeks, ears), subsurface scattering. Frequency separation retouching preserving texture.
- Eyes: realistic iris patterns with limbal ring, natural catchlights from light source, visible eyelash detail.
- Hair: individual strand texture, natural flyaway hairs, realistic scalp transition. NO helmet hair.
- Hands: correct finger count, natural nail beds, visible knuckle wrinkles, proportional fingers.
- Expression: natural micro-expressions with muscle engagement — NO mannequin faces.

MATERIAL & LIGHTING QUALITY:
- Fabric: visible thread count, proper drape physics, realistic joint wrinkles.
- Studio: three-point lighting with large octabox key, edge-lit rim, negative fill for depth.
- Lens: subtle chromatic aberration, natural vignette, shallow DOF with organic bokeh.
- NO AI artifacts, NO waxy/plastic skin, NO over-saturation, NO anatomical errors.

RETURN ONLY the image prompt text in English. No explanations, no quotes, no Markdown. Maximum 300 words.`;

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
