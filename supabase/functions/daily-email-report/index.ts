import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const REPORT_EMAIL = "mtxagenciacritiva@gmail.com";
const N8N_WEBHOOK_URL = "https://nervousanaconda-n8n.cloudfy.live/webhook/mtx-relatorio-diario";

interface ClientMetrics {
  profileName: string;
  profileId: string;
  spend: number;
  cpa: number;
  roas: number;
  purchases: number;
  revenue: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpm: number;
  cpaMeta: number;
  ticketMedio: number;
  budgetMaximo: number;
  campaigns: Array<{
    name: string;
    spend: number;
    purchases: number;
    roas: number;
    cpa: number;
    status: string;
  }>;
  agentActions: number;
  selfHealCount: number;
  recoveryRate: number | null;
}

async function fetchClientMetrics(
  profile: any,
  accessToken: string,
  sb: any
): Promise<ClientMetrics> {
  const adAccountId = profile.ad_account_id;
  let spend = 0, cpa = 0, roas = 0, purchases = 0, revenue = 0;
  let impressions = 0, clicks = 0, ctr = 0, cpm = 0;
  let campaigns: ClientMetrics["campaigns"] = [];

  try {
    const [acctRes, campRes] = await Promise.all([
      fetch(
        `https://graph.facebook.com/v23.0/${adAccountId}/insights?date_preset=yesterday&fields=spend,actions,action_values,purchase_roas,impressions,clicks,cpm,ctr&level=account&time_increment=all_days`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      ),
      fetch(
        `https://graph.facebook.com/v23.0/${adAccountId}/insights?date_preset=yesterday&fields=campaign_name,spend,actions,action_values,purchase_roas&level=campaign&limit=30`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      ),
    ]);

    if (acctRes.ok) {
      const json = await acctRes.json();
      const row = json.data?.[0];
      if (row) {
        spend = parseFloat(row.spend || "0");
        const actions = row.actions || [];
        const actionValues = row.action_values || [];
        const purchaseRoas = row.purchase_roas || [];
        purchases = Number(actions.find((a: any) => a.action_type === "purchase")?.value || 0);
        revenue = Number(actionValues.find((a: any) => a.action_type === "purchase")?.value || 0);
        roas = Number(purchaseRoas.find((a: any) => a.action_type === "purchase")?.value || 0);
        cpa = purchases > 0 ? spend / purchases : 0;
        impressions = Number(row.impressions || 0);
        clicks = Number(row.clicks || 0);
        ctr = parseFloat(row.ctr || "0");
        cpm = parseFloat(row.cpm || "0");
      }
    }

    if (campRes.ok) {
      const campJson = await campRes.json();
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
          status: "ACTIVE",
        };
      }).filter((c: any) => c.spend > 0);
    }
  } catch (e) {
    console.warn(`Metrics fetch error for ${profile.name}:`, e);
  }

  // Agent actions last 24h
  let agentActions = 0, selfHealCount = 0, recoveryRate: number | null = null;
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: logs } = await sb
      .from("emergency_logs")
      .select("action_type, details")
      .eq("profile_id", profile.id)
      .gte("created_at", since);

    if (logs) {
      agentActions = logs.length;
      selfHealCount = logs.filter((l: any) => l.action_type === "agent_self_heal" || l.details?.recovered).length;
      const failures = logs.filter((l: any) => l.details?.success === false || l.details?.recovered);
      const recovered = logs.filter((l: any) => l.details?.recovered === true || l.action_type === "agent_self_heal");
      recoveryRate = failures.length > 0 ? Math.round((recovered.length / failures.length) * 100) : null;
    }
  } catch {}

  return {
    profileName: profile.name,
    profileId: profile.id,
    spend: Math.round(spend * 100) / 100,
    cpa: Math.round(cpa * 100) / 100,
    roas: Math.round(roas * 100) / 100,
    purchases,
    revenue: Math.round(revenue * 100) / 100,
    impressions,
    clicks,
    ctr: Math.round(ctr * 100) / 100,
    cpm: Math.round(cpm * 100) / 100,
    cpaMeta: profile.cpa_meta,
    ticketMedio: profile.ticket_medio,
    budgetMaximo: profile.budget_maximo,
    campaigns,
    agentActions,
    selfHealCount,
    recoveryRate,
  };
}

function buildNotionStyleHTML(date: string, clients: ClientMetrics[]): string {
  const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtInt = (v: number) => v.toLocaleString("pt-BR");

  const totalSpend = clients.reduce((s, c) => s + c.spend, 0);
  const totalRevenue = clients.reduce((s, c) => s + c.revenue, 0);
  const totalPurchases = clients.reduce((s, c) => s + c.purchases, 0);
  const avgRoas = totalSpend > 0 ? totalRevenue / totalSpend : 0;

  const clientSections = clients.map((c) => {
    const cpaColor = c.cpaMeta > 0 && c.cpa > c.cpaMeta ? "#e74c3c" : "#27ae60";
    const roasColor = c.roas >= 3 ? "#27ae60" : c.roas >= 1.5 ? "#f39c12" : "#e74c3c";

    const campaignRows = c.campaigns.length > 0
      ? c.campaigns.map((camp) => `
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;color:#37352f;">${camp.name}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;color:#37352f;text-align:right;">R$ ${fmt(camp.spend)}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;color:#37352f;text-align:center;">${camp.purchases}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;color:${camp.roas >= 3 ? "#27ae60" : camp.roas >= 1.5 ? "#f39c12" : "#e74c3c"};text-align:right;font-weight:600;">${fmt(camp.roas)}x</td>
          <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;color:#37352f;text-align:right;">R$ ${fmt(camp.cpa)}</td>
        </tr>
      `).join("")
      : `<tr><td colspan="5" style="padding:16px;text-align:center;color:#9b9a97;font-size:13px;">Sem campanhas com gastos ontem</td></tr>`;

    const agentBadge = c.agentActions > 0
      ? `<span style="display:inline-block;background:#f0f0f0;border-radius:4px;padding:2px 8px;font-size:11px;color:#37352f;margin-left:8px;">🤖 ${c.agentActions} ações do agente</span>`
      : "";

    const recoveryBadge = c.recoveryRate !== null
      ? `<span style="display:inline-block;background:${c.recoveryRate >= 80 ? "#e8f5e9" : c.recoveryRate >= 50 ? "#fff3e0" : "#fce4ec"};border-radius:4px;padding:2px 8px;font-size:11px;color:${c.recoveryRate >= 80 ? "#2e7d32" : c.recoveryRate >= 50 ? "#e65100" : "#c62828"};margin-left:4px;">🔧 ${c.recoveryRate}% recuperação</span>`
      : "";

    return `
      <!-- Client Section -->
      <div style="margin-bottom:32px;">
        <div style="display:flex;align-items:center;margin-bottom:16px;padding-bottom:8px;border-bottom:1px solid #e8e7e4;">
          <div style="width:8px;height:8px;border-radius:50%;background:#2eaadc;margin-right:10px;"></div>
          <h2 style="font-size:18px;font-weight:600;color:#37352f;margin:0;">${c.profileName}</h2>
          ${agentBadge}${recoveryBadge}
        </div>

        <!-- KPI Grid -->
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
          <tr>
            <td style="padding:4px;">
              <div style="background:#fbfbfa;border:1px solid #e8e7e4;border-radius:6px;padding:14px 16px;">
                <div style="font-size:11px;color:#9b9a97;text-transform:uppercase;letter-spacing:0.5px;">Spend</div>
                <div style="font-size:20px;font-weight:700;color:#37352f;margin-top:4px;">R$ ${fmt(c.spend)}</div>
              </div>
            </td>
            <td style="padding:4px;">
              <div style="background:#fbfbfa;border:1px solid #e8e7e4;border-radius:6px;padding:14px 16px;">
                <div style="font-size:11px;color:#9b9a97;text-transform:uppercase;letter-spacing:0.5px;">CPA</div>
                <div style="font-size:20px;font-weight:700;color:${cpaColor};margin-top:4px;">R$ ${fmt(c.cpa)}</div>
                ${c.cpaMeta > 0 ? `<div style="font-size:10px;color:#9b9a97;margin-top:2px;">Meta: R$ ${fmt(c.cpaMeta)}</div>` : ""}
              </div>
            </td>
            <td style="padding:4px;">
              <div style="background:#fbfbfa;border:1px solid #e8e7e4;border-radius:6px;padding:14px 16px;">
                <div style="font-size:11px;color:#9b9a97;text-transform:uppercase;letter-spacing:0.5px;">ROAS</div>
                <div style="font-size:20px;font-weight:700;color:${roasColor};margin-top:4px;">${fmt(c.roas)}x</div>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:4px;">
              <div style="background:#fbfbfa;border:1px solid #e8e7e4;border-radius:6px;padding:14px 16px;">
                <div style="font-size:11px;color:#9b9a97;text-transform:uppercase;letter-spacing:0.5px;">Compras</div>
                <div style="font-size:20px;font-weight:700;color:#37352f;margin-top:4px;">${fmtInt(c.purchases)}</div>
              </div>
            </td>
            <td style="padding:4px;">
              <div style="background:#fbfbfa;border:1px solid #e8e7e4;border-radius:6px;padding:14px 16px;">
                <div style="font-size:11px;color:#9b9a97;text-transform:uppercase;letter-spacing:0.5px;">Receita</div>
                <div style="font-size:20px;font-weight:700;color:#37352f;margin-top:4px;">R$ ${fmt(c.revenue)}</div>
              </div>
            </td>
            <td style="padding:4px;">
              <div style="background:#fbfbfa;border:1px solid #e8e7e4;border-radius:6px;padding:14px 16px;">
                <div style="font-size:11px;color:#9b9a97;text-transform:uppercase;letter-spacing:0.5px;">CTR</div>
                <div style="font-size:20px;font-weight:700;color:#37352f;margin-top:4px;">${c.ctr}%</div>
              </div>
            </td>
          </tr>
        </table>

        <!-- Campaigns Table -->
        <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e8e7e4;border-radius:6px;overflow:hidden;">
          <thead>
            <tr style="background:#f7f6f3;">
              <th style="padding:10px 12px;text-align:left;font-size:11px;color:#9b9a97;text-transform:uppercase;letter-spacing:0.5px;font-weight:500;">Campanha</th>
              <th style="padding:10px 12px;text-align:right;font-size:11px;color:#9b9a97;text-transform:uppercase;letter-spacing:0.5px;font-weight:500;">Spend</th>
              <th style="padding:10px 12px;text-align:center;font-size:11px;color:#9b9a97;text-transform:uppercase;letter-spacing:0.5px;font-weight:500;">Vendas</th>
              <th style="padding:10px 12px;text-align:right;font-size:11px;color:#9b9a97;text-transform:uppercase;letter-spacing:0.5px;font-weight:500;">ROAS</th>
              <th style="padding:10px 12px;text-align:right;font-size:11px;color:#9b9a97;text-transform:uppercase;letter-spacing:0.5px;font-weight:500;">CPA</th>
            </tr>
          </thead>
          <tbody>${campaignRows}</tbody>
        </table>
      </div>
    `;
  }).join("");

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Relatório Diário MTX — ${date}</title>
</head>
<body style="margin:0;padding:0;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
<div style="max-width:680px;margin:0 auto;padding:40px 24px;">

  <!-- Header -->
  <div style="margin-bottom:32px;">
    <div style="font-size:11px;color:#9b9a97;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Relatório Diário</div>
    <h1 style="font-size:28px;font-weight:700;color:#37352f;margin:0 0 4px 0;">📊 MTX Command Center</h1>
    <div style="font-size:14px;color:#9b9a97;">${date} · ${clients.length} cliente(s)</div>
  </div>

  <!-- Global Summary -->
  <div style="background:#f7f6f3;border-radius:8px;padding:20px;margin-bottom:32px;">
    <div style="font-size:12px;color:#9b9a97;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px;">Resumo Geral</div>
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="padding:4px 12px 4px 0;">
          <span style="font-size:12px;color:#9b9a97;">Investimento Total</span><br>
          <span style="font-size:22px;font-weight:700;color:#37352f;">R$ ${fmt(totalSpend)}</span>
        </td>
        <td style="padding:4px 12px;">
          <span style="font-size:12px;color:#9b9a97;">Receita Total</span><br>
          <span style="font-size:22px;font-weight:700;color:#27ae60;">R$ ${fmt(totalRevenue)}</span>
        </td>
        <td style="padding:4px 12px;">
          <span style="font-size:12px;color:#9b9a97;">Vendas</span><br>
          <span style="font-size:22px;font-weight:700;color:#37352f;">${fmtInt(totalPurchases)}</span>
        </td>
        <td style="padding:4px 0 4px 12px;">
          <span style="font-size:12px;color:#9b9a97;">ROAS Médio</span><br>
          <span style="font-size:22px;font-weight:700;color:${avgRoas >= 3 ? "#27ae60" : avgRoas >= 1.5 ? "#f39c12" : "#e74c3c"};">${fmt(avgRoas)}x</span>
        </td>
      </tr>
    </table>
  </div>

  <div style="height:1px;background:#e8e7e4;margin-bottom:32px;"></div>

  <!-- Client Sections -->
  ${clientSections}

  <!-- Footer -->
  <div style="margin-top:40px;padding-top:20px;border-top:1px solid #e8e7e4;text-align:center;">
    <div style="font-size:11px;color:#c4c4c0;">
      Gerado automaticamente por MTX Command Center · ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC
    </div>
  </div>
</div>
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);

    // Fetch all active profiles
    const { data: profiles, error: profErr } = await sb
      .from("client_profiles")
      .select("id, name, ad_account_id, meta_access_token, cpa_meta, ticket_medio, budget_maximo, budget_frequency")
      .eq("is_active", true);

    if (profErr || !profiles?.length) {
      return new Response(JSON.stringify({ error: "Nenhum perfil ativo encontrado" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const globalToken = Deno.env.get("META_ACCESS_TOKEN") || "";
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    // Fetch metrics for each client
    const clientMetrics: ClientMetrics[] = [];
    for (const profile of profiles) {
      const token = profile.meta_access_token || globalToken;
      if (!token || !profile.ad_account_id || profile.ad_account_id === "act_") {
        clientMetrics.push({
          profileName: profile.name,
          profileId: profile.id,
          spend: 0, cpa: 0, roas: 0, purchases: 0, revenue: 0,
          impressions: 0, clicks: 0, ctr: 0, cpm: 0,
          cpaMeta: profile.cpa_meta, ticketMedio: profile.ticket_medio,
          budgetMaximo: profile.budget_maximo,
          campaigns: [], agentActions: 0, selfHealCount: 0, recoveryRate: null,
        });
        continue;
      }
      const metrics = await fetchClientMetrics(profile, token, sb);
      clientMetrics.push(metrics);
    }

    // Build HTML report
    const html = buildNotionStyleHTML(yesterday, clientMetrics);

    // Upload report to storage
    const filePath = `reports/daily/${yesterday}.html`;
    const fileBlob = new Blob([html], { type: "text/html" });
    await sb.storage.from("creative-assets").upload(filePath, fileBlob, { contentType: "text/html", upsert: true });
    const { data: publicUrlData } = sb.storage.from("creative-assets").getPublicUrl(filePath);
    const reportUrl = publicUrlData.publicUrl;

    // Build plain text summary for email subject/preview
    const totalSpend = clientMetrics.reduce((s, c) => s + c.spend, 0);
    const totalRevenue = clientMetrics.reduce((s, c) => s + c.revenue, 0);
    const totalPurchases = clientMetrics.reduce((s, c) => s + c.purchases, 0);

    // Dispatch to n8n webhook for email delivery
    let webhookStatus = "not_sent";
    try {
      const emailPayload = {
        to: REPORT_EMAIL,
        subject: `📊 Relatório Diário MTX — ${yesterday} | R$ ${totalSpend.toFixed(0)} investidos · ${totalPurchases} vendas`,
        html_body: html,
        report_url: reportUrl,
        date: yesterday,
        summary: {
          total_spend: totalSpend,
          total_revenue: totalRevenue,
          total_purchases: totalPurchases,
          clients: clientMetrics.length,
        },
      };

      const webhookResp = await fetch(N8N_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(emailPayload),
        signal: AbortSignal.timeout(15000),
      });
      webhookStatus = webhookResp.ok ? "sent" : `error_${webhookResp.status}`;
    } catch (e) {
      console.warn("Webhook dispatch failed:", e);
      webhookStatus = "failed";
    }

    return new Response(JSON.stringify({
      success: true,
      date: yesterday,
      clients: clientMetrics.length,
      report_url: reportUrl,
      webhook_status: webhookStatus,
      email: REPORT_EMAIL,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("daily-email-report error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
