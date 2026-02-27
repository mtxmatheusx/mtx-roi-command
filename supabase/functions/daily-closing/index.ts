import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { fetchMasterContext } from "../_shared/fetch_master_context.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const N8N_WEBHOOK_URL = "https://nervousanaconda-n8n.cloudfy.live/webhook/mtx-fechamento-diario";

interface TodayMetrics {
  spend: number;
  cpa: number;
  roas: number;
  purchases: number;
  revenue: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpm: number;
  campaigns: Array<{
    name: string;
    spend: number;
    purchases: number;
    roas: number;
    cpa: number;
  }>;
}

async function fetchTodayMetrics(adAccountId: string, accessToken: string): Promise<TodayMetrics | null> {
  try {
    // Account-level today
    const accountUrl = `https://graph.facebook.com/v21.0/${adAccountId}/insights?date_preset=today&fields=spend,actions,action_values,purchase_roas,impressions,clicks,cpm,ctr&level=account&time_increment=all_days`;
    // Campaign-level today
    const campaignUrl = `https://graph.facebook.com/v21.0/${adAccountId}/insights?date_preset=today&fields=campaign_name,spend,actions,action_values,purchase_roas&level=campaign&limit=20`;

    const [accountRes, campaignRes] = await Promise.all([
      fetch(accountUrl, { headers: { Authorization: `Bearer ${accessToken}` } }),
      fetch(campaignUrl, { headers: { Authorization: `Bearer ${accessToken}` } }),
    ]);

    if (!accountRes.ok) {
      console.warn("Today account metrics fetch failed:", accountRes.status);
      return null;
    }

    const accountJson = await accountRes.json();
    const row = accountJson.data?.[0];
    if (!row) return null;

    const spend = parseFloat(row.spend || "0");
    const actions = row.actions || [];
    const actionValues = row.action_values || [];
    const purchaseRoas = row.purchase_roas || [];
    const purchases = Number(actions.find((a: any) => a.action_type === "purchase")?.value || 0);
    const revenue = Number(actionValues.find((a: any) => a.action_type === "purchase")?.value || 0);
    const roas = Number(purchaseRoas.find((a: any) => a.action_type === "purchase")?.value || 0);
    const cpa = purchases > 0 ? spend / purchases : 0;

    // Campaign breakdown
    let campaigns: TodayMetrics["campaigns"] = [];
    if (campaignRes.ok) {
      const campJson = await campaignRes.json();
      campaigns = (campJson.data || []).map((c: any) => {
        const cSpend = parseFloat(c.spend || "0");
        const cPurchases = Number((c.actions || []).find((a: any) => a.action_type === "purchase")?.value || 0);
        const cRevenue = Number((c.action_values || []).find((a: any) => a.action_type === "purchase")?.value || 0);
        return {
          name: c.campaign_name || "Sem nome",
          spend: cSpend,
          purchases: cPurchases,
          roas: cSpend > 0 ? cRevenue / cSpend : 0,
          cpa: cPurchases > 0 ? cSpend / cPurchases : 0,
        };
      }).filter((c: any) => c.spend > 0);
    }

    return {
      spend,
      cpa: Math.round(cpa * 100) / 100,
      roas: Math.round(roas * 100) / 100,
      purchases,
      revenue: Math.round(revenue * 100) / 100,
      impressions: Number(row.impressions || 0),
      clicks: Number(row.clicks || 0),
      ctr: Number(parseFloat(row.ctr || "0").toFixed(2)),
      cpm: Number(parseFloat(row.cpm || "0").toFixed(2)),
      campaigns,
    };
  } catch (e) {
    console.warn("fetchTodayMetrics error:", e);
    return null;
  }
}

interface AISummary {
  resumo: string;
  destaques: string[];
  alertas: string[];
}

async function generateAISummary(
  profileName: string,
  todayMetrics: TodayMetrics | null,
  systemPromptBlock: string
): Promise<AISummary> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    return { resumo: "Resumo indisponível (chave de IA não configurada).", destaques: [], alertas: [] };
  }

  const metricsText = todayMetrics
    ? `Spend: R$${todayMetrics.spend.toFixed(2)}, Compras: ${todayMetrics.purchases}, CPA: R$${todayMetrics.cpa.toFixed(2)}, ROAS: ${todayMetrics.roas.toFixed(2)}, Receita: R$${todayMetrics.revenue.toFixed(2)}, Impressões: ${todayMetrics.impressions}, Cliques: ${todayMetrics.clicks}, CTR: ${todayMetrics.ctr}%, CPM: R$${todayMetrics.cpm.toFixed(2)}. Campanhas ativas: ${todayMetrics.campaigns.map(c => `${c.name} (Spend R$${c.spend.toFixed(2)}, ${c.purchases} compras, ROAS ${c.roas.toFixed(2)})`).join("; ")}`
    : "Sem dados de métricas disponíveis para hoje.";

  const userPrompt = `Gere o fechamento diário para o perfil "${profileName}". Métricas de HOJE: ${metricsText}`;

  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `${systemPromptBlock}\n\nVocê é o analista de fechamento diário da MTX. Gere um resumo executivo conciso do dia com base nas métricas reais. Seja direto, use números. Destaque vitórias e sinalize alertas.`,
          },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "daily_summary",
              description: "Retorna o resumo executivo do fechamento diário.",
              parameters: {
                type: "object",
                properties: {
                  resumo: { type: "string", description: "Resumo executivo completo em 2-4 parágrafos." },
                  destaques: { type: "array", items: { type: "string" }, description: "Lista de 2-4 pontos positivos do dia." },
                  alertas: { type: "array", items: { type: "string" }, description: "Lista de 0-3 alertas ou pontos de atenção." },
                },
                required: ["resumo", "destaques", "alertas"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "daily_summary" } },
      }),
    });

    if (!resp.ok) {
      console.warn("AI gateway error:", resp.status, await resp.text());
      return { resumo: `Resumo indisponível (erro ${resp.status}).`, destaques: [], alertas: [] };
    }

    const json = await resp.json();
    const toolCall = json.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      const args = typeof toolCall.function.arguments === "string"
        ? JSON.parse(toolCall.function.arguments)
        : toolCall.function.arguments;
      return {
        resumo: args.resumo || "Resumo não gerado.",
        destaques: args.destaques || [],
        alertas: args.alertas || [],
      };
    }

    return { resumo: "Resumo não gerado pela IA.", destaques: [], alertas: [] };
  } catch (e) {
    console.warn("AI summary error:", e);
    return { resumo: "Erro ao gerar resumo executivo.", destaques: [], alertas: [] };
  }
}

function buildHTMLReport(
  profileName: string,
  date: string,
  metrics: TodayMetrics | null,
  summary: AISummary
): string {
  const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const kpiCards = metrics
    ? `
      <div class="kpi-grid">
        <div class="kpi"><span class="kpi-label">Spend</span><span class="kpi-value">R$ ${fmt(metrics.spend)}</span></div>
        <div class="kpi"><span class="kpi-label">CPA</span><span class="kpi-value">R$ ${fmt(metrics.cpa)}</span></div>
        <div class="kpi"><span class="kpi-label">ROAS</span><span class="kpi-value">${fmt(metrics.roas)}x</span></div>
        <div class="kpi"><span class="kpi-label">Compras</span><span class="kpi-value">${metrics.purchases}</span></div>
        <div class="kpi"><span class="kpi-label">Receita</span><span class="kpi-value">R$ ${fmt(metrics.revenue)}</span></div>
        <div class="kpi"><span class="kpi-label">CTR</span><span class="kpi-value">${metrics.ctr}%</span></div>
      </div>`
    : `<p style="color:#888;">Métricas de hoje não disponíveis.</p>`;

  const campaignRows = metrics?.campaigns?.length
    ? metrics.campaigns
        .map(
          (c) =>
            `<tr><td>${c.name}</td><td>R$ ${fmt(c.spend)}</td><td>${c.purchases}</td><td>${fmt(c.roas)}x</td><td>R$ ${fmt(c.cpa)}</td></tr>`
        )
        .join("")
    : `<tr><td colspan="5" style="text-align:center;color:#888;">Nenhuma campanha com gastos hoje</td></tr>`;

  const highlightsList = summary.destaques.length
    ? summary.destaques.map((d) => `<li>✅ ${d}</li>`).join("")
    : "<li>Nenhum destaque</li>";

  const alertsList = summary.alertas.length
    ? summary.alertas.map((a) => `<li>⚠️ ${a}</li>`).join("")
    : "";

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Fechamento Diário — ${profileName} — ${date}</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&display=swap" rel="stylesheet">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'DM Sans',sans-serif; background:#0a0a0a; color:#e0e0e0; padding:32px; max-width:800px; margin:0 auto; }
  .header { border-bottom:2px solid #1a1a2e; padding-bottom:16px; margin-bottom:24px; }
  .header h1 { font-size:24px; color:#00ff88; }
  .header p { font-size:14px; color:#888; margin-top:4px; }
  .kpi-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin-bottom:24px; }
  .kpi { background:#111; border:1px solid #222; border-radius:8px; padding:16px; text-align:center; }
  .kpi-label { display:block; font-size:12px; color:#888; text-transform:uppercase; letter-spacing:1px; }
  .kpi-value { display:block; font-size:22px; font-weight:700; color:#00ff88; margin-top:4px; }
  h2 { font-size:18px; color:#fff; margin:24px 0 12px; }
  table { width:100%; border-collapse:collapse; margin-bottom:24px; }
  th { background:#1a1a2e; color:#00ff88; padding:10px; text-align:left; font-size:12px; text-transform:uppercase; letter-spacing:1px; }
  td { padding:10px; border-bottom:1px solid #1a1a2e; font-size:14px; }
  .summary { background:#111; border:1px solid #222; border-radius:8px; padding:20px; margin-bottom:24px; line-height:1.6; }
  ul { margin:8px 0 0 16px; }
  li { margin-bottom:4px; }
  .alerts { border-color:#ff4444; }
  .footer { text-align:center; color:#555; font-size:12px; margin-top:32px; }
</style>
</head>
<body>
  <div class="header">
    <h1>📊 Fechamento Diário — MTX</h1>
    <p>${profileName} • ${date}</p>
  </div>

  ${kpiCards}

  <h2>Campanhas do Dia</h2>
  <table>
    <thead><tr><th>Campanha</th><th>Spend</th><th>Compras</th><th>ROAS</th><th>CPA</th></tr></thead>
    <tbody>${campaignRows}</tbody>
  </table>

  <h2>Resumo Executivo (IA)</h2>
  <div class="summary">${summary.resumo}</div>

  ${summary.destaques.length ? `<h2>Destaques</h2><ul>${highlightsList}</ul>` : ""}
  ${summary.alertas.length ? `<h2>Alertas</h2><div class="summary alerts"><ul>${alertsList}</ul></div>` : ""}

  <div class="footer">Gerado automaticamente pela plataforma MTX • ${new Date().toISOString()}</div>
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { profileId } = await req.json();
    if (!profileId) {
      return new Response(JSON.stringify({ error: "profileId é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 1: Master context (profile + 7d metrics)
    const ctx = await fetchMasterContext(profileId);
    if (ctx.blocked) {
      return new Response(JSON.stringify({ error: ctx.error, details: ctx.details }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { profile, systemPromptBlock } = ctx;
    const accessToken = profile.meta_access_token || Deno.env.get("META_ACCESS_TOKEN");

    // Step 2: Today's detailed metrics
    let todayMetrics: TodayMetrics | null = null;
    if (accessToken && profile.ad_account_id && profile.ad_account_id !== "act_") {
      todayMetrics = await fetchTodayMetrics(profile.ad_account_id, accessToken);
    }

    // Step 3: AI executive summary
    const summary = await generateAISummary(profile.name, todayMetrics, systemPromptBlock);

    // Step 4: Build HTML report
    const today = new Date().toISOString().slice(0, 10);
    const html = buildHTMLReport(profile.name, today, todayMetrics, summary);

    // Step 5: Upload to storage bucket
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);

    const filePath = `reports/${profileId}/${today}.html`;
    const fileBlob = new Blob([html], { type: "text/html" });

    const { error: uploadError } = await sb.storage
      .from("creative-assets")
      .upload(filePath, fileBlob, { contentType: "text/html", upsert: true });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return new Response(JSON.stringify({ error: "Falha ao salvar relatório", details: uploadError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: publicUrlData } = sb.storage.from("creative-assets").getPublicUrl(filePath);
    const mediaUrl = publicUrlData.publicUrl;

    // Build caption text
    const caption = `📊 *Fechamento Diário — ${profile.name}*\n📅 ${today}\n\n${summary.resumo}${summary.destaques.length ? "\n\n✅ " + summary.destaques.join("\n✅ ") : ""}${summary.alertas.length ? "\n\n⚠️ " + summary.alertas.join("\n⚠️ ") : ""}`;

    // Step 6: Dispatch webhook to n8n (isolated try/catch)
    let webhookStatus = "not_sent";
    try {
      const webhookResp = await fetch(N8N_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaUrl, caption }),
        signal: AbortSignal.timeout(15000), // 15s timeout
      });
      webhookStatus = webhookResp.ok ? "sent" : `error_${webhookResp.status}`;
      if (!webhookResp.ok) {
        console.warn("n8n webhook response:", webhookResp.status, await webhookResp.text());
      }
    } catch (webhookErr) {
      console.warn("n8n webhook dispatch failed (non-blocking):", webhookErr);
      webhookStatus = "failed";
    }

    return new Response(
      JSON.stringify({
        success: true,
        mediaUrl,
        caption,
        webhookStatus,
        date: today,
        profileName: profile.name,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("daily-closing error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
