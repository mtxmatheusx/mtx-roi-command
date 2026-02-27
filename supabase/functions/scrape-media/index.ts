import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { url, profileId } = await req.json();
    if (!url || !profileId) {
      return new Response(JSON.stringify({ error: "url e profileId são obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    if (!FIRECRAWL_API_KEY) {
      return new Response(JSON.stringify({ error: "Firecrawl não configurado. Conecte o Firecrawl nas configurações." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Scrape the URL with Firecrawl to get HTML
    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith("http://") && !formattedUrl.startsWith("https://")) {
      formattedUrl = `https://${formattedUrl}`;
    }

    console.log("Scraping media from:", formattedUrl);

    const scrapeRes = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: formattedUrl,
        formats: ["html", "links"],
        onlyMainContent: true,
      }),
    });

    const scrapeData = await scrapeRes.json();
    if (!scrapeRes.ok || !scrapeData.success) {
      return new Response(JSON.stringify({ error: "Falha ao extrair página: " + (scrapeData.error || "Erro desconhecido") }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const html = scrapeData.data?.html || scrapeData.html || "";

    // Extract image URLs from HTML
    const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
    const videoRegex = /<video[^>]*>.*?<source[^>]+src=["']([^"']+)["'][^>]*>.*?<\/video>/gis;
    const videoSrcRegex = /<video[^>]+src=["']([^"']+)["'][^>]*>/gi;

    const imageUrls = new Set<string>();
    const videoUrls = new Set<string>();

    let match;
    while ((match = imgRegex.exec(html)) !== null) {
      let src = match[1];
      if (src.startsWith("//")) src = "https:" + src;
      else if (src.startsWith("/")) {
        try { src = new URL(src, formattedUrl).href; } catch { continue; }
      }
      if (!src.startsWith("http")) continue;
      // Filter out tiny images (icons, tracking pixels) by URL patterns
      if (/\.(svg|ico|gif)(\?|$)/i.test(src)) continue;
      if (/tracking|pixel|analytics|facebook\.com\/tr|google-analytics/i.test(src)) continue;
      if (/1x1|spacer|blank|placeholder/i.test(src)) continue;
      imageUrls.add(src);
    }

    while ((match = videoRegex.exec(html)) !== null) {
      let src = match[1];
      if (src.startsWith("//")) src = "https:" + src;
      else if (src.startsWith("/")) {
        try { src = new URL(src, formattedUrl).href; } catch { continue; }
      }
      if (src.startsWith("http")) videoUrls.add(src);
    }
    while ((match = videoSrcRegex.exec(html)) !== null) {
      let src = match[1];
      if (src.startsWith("//")) src = "https:" + src;
      else if (src.startsWith("/")) {
        try { src = new URL(src, formattedUrl).href; } catch { continue; }
      }
      if (src.startsWith("http")) videoUrls.add(src);
    }

    // Also check links for common media extensions
    const links: string[] = scrapeData.data?.links || scrapeData.links || [];
    for (const link of links) {
      if (/\.(jpg|jpeg|png|webp)(\?|$)/i.test(link) && !imageUrls.has(link)) {
        imageUrls.add(link);
      }
      if (/\.(mp4|webm|mov)(\?|$)/i.test(link) && !videoUrls.has(link)) {
        videoUrls.add(link);
      }
    }

    console.log(`Found ${imageUrls.size} images, ${videoUrls.size} videos`);

    // Download and save media (limit to 20 items to avoid timeouts)
    const allMedia = [
      ...Array.from(imageUrls).slice(0, 15).map((u) => ({ url: u, type: "image" as const })),
      ...Array.from(videoUrls).slice(0, 5).map((u) => ({ url: u, type: "video" as const })),
    ];

    const saved: { file_name: string; file_url: string; file_type: string; source_tag: string }[] = [];
    const sourceTag = `scraped:${formattedUrl}`;

    for (const media of allMedia) {
      try {
        const mediaRes = await fetch(media.url, {
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
        });
        if (!mediaRes.ok) continue;

        const contentType = mediaRes.headers.get("content-type") || "";
        if (media.type === "image" && !contentType.startsWith("image/")) continue;

        const blob = await mediaRes.blob();
        // Skip tiny files (likely icons)
        if (blob.size < 5000 && media.type === "image") continue;

        const ext = media.url.split(".").pop()?.split("?")[0]?.slice(0, 5) || (media.type === "image" ? "jpg" : "mp4");
        const fileName = `scraped_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.${ext}`;
        const filePath = `${user.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("creative-assets")
          .upload(filePath, blob, { contentType });

        if (uploadError) {
          console.error("Upload error:", uploadError.message);
          continue;
        }

        const { data: { publicUrl } } = supabase.storage
          .from("creative-assets")
          .getPublicUrl(filePath);

        // Extract filename from URL for display
        const displayName = decodeURIComponent(media.url.split("/").pop()?.split("?")[0] || fileName);

        const { error: dbError } = await supabase.from("creative_assets").insert({
          user_id: user.id,
          profile_id: profileId,
          file_name: displayName.slice(0, 100),
          file_url: publicUrl,
          file_type: media.type,
          source_tag: sourceTag,
        });

        if (dbError) {
          console.error("DB insert error:", dbError.message);
          continue;
        }

        saved.push({ file_name: displayName, file_url: publicUrl, file_type: media.type, source_tag: sourceTag });
      } catch (err) {
        console.error("Error processing media:", media.url, err);
        continue;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      total_found: imageUrls.size + videoUrls.size,
      total_saved: saved.length,
      assets: saved,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("scrape-media error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
