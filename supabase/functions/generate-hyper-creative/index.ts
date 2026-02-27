import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { fetchMasterContext } from "../_shared/fetch_master_context.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { profileId, quantity = 1, context = "", masterPrompt = "", referenceImageUrl = "" } = await req.json();
    if (!profileId) {
      return new Response(JSON.stringify({ error: "profileId is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const clampedQty = Math.max(1, Math.min(4, quantity));
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);

    // Step 1: Fetch master context
    const ctx = await fetchMasterContext(profileId);
    if (ctx.blocked) {
      return new Response(JSON.stringify({ error: ctx.error, details: ctx.details }), { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { profile } = ctx;

    // If masterPrompt provided (from Visual Forge), skip internal prompt engineering
    let imagePrompt: string;
    if (masterPrompt.trim()) {
      imagePrompt = masterPrompt.trim();
      console.log("Using master prompt from Visual Forge:", imagePrompt.substring(0, 200));
    } else {
      // Legacy fallback: generate prompt internally
      const isPhysicalProduct = (profile.product_context || "").toLowerCase().match(/roupa|tecido|produto|loja|ecommerce|e-commerce|físico|camiseta|calça|sapato|acessório/);

      const artDirectionRules = isPhysicalProduct
        ? `Focus on FABRIC TEXTURE and DRAMATIC STUDIO LIGHTING. Show the product being worn or displayed with cinematic depth of field. Emphasize material quality, stitching details, and premium feel.`
        : `Focus on an AUTHORITY FIGURE (Hormozi/Brunson style) - confident pose, direct eye contact, pointing at camera or gesturing toward pain/solution. The person should embody success and expertise.`;

      const promptEngPrompt = `You are an elite Art Director for performance marketing creatives. Based on the brand context below, generate a SINGLE detailed image generation prompt in English.

BRAND CONTEXT:
- Name: ${profile.name}
- Avatar Dossier: ${profile.avatar_dossier || "Not available"}
- Product Context: ${profile.product_context || "Not available"}
- User Campaign Context: ${context || "General brand creative"}

MANDATORY ART DIRECTION RULES (inject ALL of these):
1. "Aspect ratio: 4:5 portrait (1080x1350 pixels)."
2. "Background: Dark textured background with minimalist elements and subtle red or soft neon accents."
3. "Style: Hyper-realistic photography with extreme detail and cinematic lighting."
4. ${artDirectionRules}
5. "Color palette: Deep blacks, warm highlights, strategic pops of brand color."
6. "Mood: Premium, aspirational, high-converting ad creative."

Generate ONLY the image prompt, nothing else. Make it specific, vivid, and production-ready. Maximum 200 words.`;

      const promptResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [{ role: "user", content: promptEngPrompt }],
        }),
      });

      if (!promptResp.ok) {
        if (promptResp.status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again later." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (promptResp.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted. Add funds." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        throw new Error(`Prompt generation failed: ${promptResp.status}`);
      }

      const promptData = await promptResp.json();
      imagePrompt = promptData.choices?.[0]?.message?.content?.trim();
      if (!imagePrompt) throw new Error("Failed to generate image prompt");
      console.log("Generated image prompt:", imagePrompt.substring(0, 200));
    }

    // Step 3: Generate images
    const results: Array<{ url: string; file_name: string; asset_id: string }> = [];

    for (let i = 0; i < clampedQty; i++) {
      const variation = clampedQty > 1 ? ` Variation ${i + 1} of ${clampedQty} - slightly different angle, lighting, or composition.` : "";

      // Build multimodal content if reference image provided
      const messageContent: any[] = [{ type: "text", text: imagePrompt + variation }];
      if (referenceImageUrl) {
        messageContent.push({ type: "image_url", image_url: { url: referenceImageUrl } });
      }

      const imgResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-image",
          messages: [{ role: "user", content: referenceImageUrl ? messageContent : imagePrompt + variation }],
          modalities: ["image", "text"],
        }),
      });

      if (!imgResp.ok) {
        console.warn(`Image generation ${i + 1} failed:`, imgResp.status);
        continue;
      }

      const imgData = await imgResp.json();
      const base64Url = imgData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      if (!base64Url) {
        console.warn(`No image in response ${i + 1}`);
        continue;
      }

      // Extract base64 data
      const base64Data = base64Url.replace(/^data:image\/\w+;base64,/, "");
      const binaryData = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));

      const timestamp = Date.now();
      const fileName = `creative_${timestamp}_${i + 1}.png`;
      const storagePath = `generated/${profileId}/${fileName}`;

      // Upload to bucket
      const { error: uploadError } = await sb.storage
        .from("creative-assets")
        .upload(storagePath, binaryData, { contentType: "image/png", upsert: true });

      if (uploadError) {
        console.warn(`Upload error for ${fileName}:`, uploadError.message);
        continue;
      }

      const { data: { publicUrl } } = sb.storage.from("creative-assets").getPublicUrl(storagePath);

      // Insert into DB
      const { data: inserted, error: dbError } = await sb.from("creative_assets").insert({
        user_id: (await sb.from("client_profiles").select("user_id").eq("id", profileId).single()).data!.user_id,
        profile_id: profileId,
        file_name: fileName,
        file_url: publicUrl,
        file_type: "image",
        description: context || "AI-generated high-conversion creative",
        source_tag: "ai-generated",
      }).select("id").single();

      if (dbError) {
        console.warn(`DB insert error:`, dbError.message);
        continue;
      }

      results.push({ url: publicUrl, file_name: fileName, asset_id: inserted!.id });
    }

    return new Response(JSON.stringify({
      success: true,
      generated: results,
      total: results.length,
      prompt_used: imagePrompt.substring(0, 300),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("generate-hyper-creative error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
