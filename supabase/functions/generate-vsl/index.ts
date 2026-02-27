import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { fetchMasterContext } from "../_shared/fetch_master_context.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { profileId, angle, duration, tone } = await req.json();
    if (!profileId) throw new Error("profileId is required");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const ctx = await fetchMasterContext(profileId);
    if (ctx.blocked) {
      return new Response(JSON.stringify({ error: ctx.details || ctx.error, blocked: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);

    const { data: assets } = await sb.from("creative_assets").select("file_name, file_type, description").eq("profile_id", profileId).limit(20);
    const assetList = (assets || []).map((a: any) => `- ${a.file_name} (${a.file_type})${a.description ? `: ${a.description}` : ""}`).join("\n");

    const systemPrompt = `${ctx.systemPromptBlock}

Você é um roteirista de alta conversão especializado em VSL (Video Sales Letters) e copies para Meta Ads. Use os frameworks Storybrand e Hook-Story-Offer (Alex Hormozi).

REGRAS ESTRITAS DE FORMATO:
- Você DEVE retornar EXCLUSIVAMENTE um objeto JSON válido neste formato exato:

{
  "titulo": "Nome curto e impactante do VSL",
  "cenas": [
    { "tempo": "0-5s", "visual": "Instruções de vídeo/B-roll", "audio": "Texto da locução" },
    { "tempo": "5-15s", "visual": "...", "audio": "..." }
  ]
}

- NÃO inclua crases (\`\`\`json), comentários ou qualquer outro texto fora do JSON.
- NÃO escreva texto corrido nem tabelas Markdown. APENAS o JSON puro.
- Se houver ativos disponíveis no banco, REFERENCIE-OS na propriedade "visual" pelo nome do arquivo.
- Use \\n para quebras de linha dentro dos textos de áudio e visual.

CADEIA DE RACIOCÍNIO (aplique internamente, não escreva no output):
1. STORYBRAND: Identifique o Cliente como o Herói e o Produto como o Guia
2. HOOK (0-5s): Interrupção de padrão focada na maior dor
3. STORY: Agite a dor e introduza o mecanismo único do produto
4. OFFER (Hormozi): Maximize Valor Percebido, minimize Esforço/Tempo`;

    const userPrompt = `## Ativos Visuais Disponíveis
${assetList || "Nenhum ativo cadastrado."}

## Direção Criativa
- Ângulo da Oferta: ${angle || "Não especificado"}
- Tempo Desejado: ${duration || "30 segundos"}
- Tom de Voz: ${tone || "Direto e persuasivo"}

Gere o roteiro completo agora. Retorne APENAS o JSON.`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      console.error("AI error:", aiResp.status, errText);
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Tente novamente em alguns minutos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos esgotados. Adicione créditos ao workspace." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI gateway error");
    }

    const aiJson = await aiResp.json();
    let rawContent = aiJson.choices?.[0]?.message?.content || "";
    
    // Strip markdown code fences if the model wrapped them anyway
    rawContent = rawContent.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();

    let parsedVSL: any;
    try {
      parsedVSL = JSON.parse(rawContent);
    } catch {
      // If JSON parsing fails, return the raw content as fallback
      console.error("Failed to parse VSL JSON, returning raw");
      parsedVSL = null;
    }

    // Save to DB
    const { data: profile } = await sb.from("client_profiles").select("user_id").eq("id", profileId).single();
    if (profile) {
      await sb.from("vsl_scripts").insert({
        profile_id: profileId,
        user_id: profile.user_id,
        angle: angle || "",
        duration: duration || "",
        tone: tone || "",
        script_content: rawContent,
        title: parsedVSL?.titulo || "",
        content_json: parsedVSL,
      });
    }

    return new Response(JSON.stringify({
      content: rawContent,
      parsed: parsedVSL,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
