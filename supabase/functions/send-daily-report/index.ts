import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.98.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')!
const META_API_VERSION = 'v23.0'
const META_BASE = `https://graph.facebook.com/${META_API_VERSION}`
const APP_URL = 'https://mtx-roi-command.lovable.app'

interface PeriodMetrics {
  sales: number; spend: number; revenue: number; costPerSale: number
  roi: number; cpa: number; cpm: number; ctr: number; profit: number; dataVerified: boolean
}

interface ClientData {
  nome: string; accountId: string; profileId: string; roi: number; cpaMeta: number
  metricas: {
    vendas: [number, number, number, number, number]
    custoVenda: [number, number, number, number, number]
    roi: [number, number, number, number, number]
    cpa: [number, number, number, number, number]
    cpm: [number, number, number, number, number]
    ctr: [number, number, number, number, number]
    lucro: [number, number, number, number, number]
    spend: [number, number, number, number, number]
  }
  alertas: string[]
  agentActions: number
}

const DATE_PRESETS = ['today', 'yesterday', 'last_7d', 'last_14d', 'last_30d'] as const

async function fetchMetaInsights(adAccountId: string, accessToken: string, datePreset: string): Promise<PeriodMetrics> {
  const empty: PeriodMetrics = { sales: 0, spend: 0, revenue: 0, costPerSale: 0, roi: 0, cpa: 0, cpm: 0, ctr: 0, profit: 0, dataVerified: false }
  try {
    const fields = 'campaign_name,spend,actions,action_values,cost_per_action_type,cpm,ctr'
    const filtering = JSON.stringify([{ field: 'campaign.effective_status', operator: 'IN', value: ['ACTIVE'] }])
    const url = `${META_BASE}/${adAccountId}/insights?level=campaign&fields=${fields}&date_preset=${datePreset}&filtering=${encodeURIComponent(filtering)}&limit=500&access_token=${accessToken}`
    const res = await fetch(url)
    if (!res.ok) { console.error(`Meta API error ${adAccountId} (${datePreset}): ${res.status}`); return empty }
    const json = await res.json()
    const rows = json.data || []
    let totalSpend = 0, totalSales = 0, totalRevenue = 0, totalCostPerPurchase = 0, purchaseCampaigns = 0
    for (const row of rows) {
      totalSpend += parseFloat(row.spend || '0')
      const pa = (row.actions || []).find((a: any) => a.action_type === 'purchase' || a.action_type === 'omni_purchase')
      totalSales += pa ? parseInt(pa.value || '0') : 0
      const pv = (row.action_values || []).find((a: any) => a.action_type === 'purchase' || a.action_type === 'omni_purchase')
      totalRevenue += pv ? parseFloat(pv.value || '0') : 0
      const cp = (row.cost_per_action_type || []).find((a: any) => a.action_type === 'purchase' || a.action_type === 'omni_purchase')
      if (cp) { totalCostPerPurchase += parseFloat(cp.value || '0'); purchaseCampaigns++ }
    }
    const cpm = rows.length > 0 ? rows.reduce((s: number, r: any) => s + parseFloat(r.cpm || '0'), 0) / rows.length : 0
    const ctr = rows.length > 0 ? rows.reduce((s: number, r: any) => s + parseFloat(r.ctr || '0'), 0) / rows.length : 0
    const costPerSale = totalSales > 0 ? totalSpend / totalSales : 0
    const roi = totalSpend > 0 ? ((totalRevenue - totalSpend) / totalSpend) * 100 : 0
    const cpa = purchaseCampaigns > 0 ? totalCostPerPurchase / purchaseCampaigns : (totalSales > 0 ? totalSpend / totalSales : 0)
    const profit = totalRevenue - totalSpend
    return { sales: totalSales, spend: totalSpend, revenue: totalRevenue, costPerSale, roi, cpa, cpm, ctr, profit, dataVerified: true }
  } catch (err) { console.error(`Meta fetch error ${adAccountId} (${datePreset}):`, err); return empty }
}

async function generateGeminiAnalysis(clients: ClientData[], reportType: string): Promise<string> {
  try {
    const summary = clients.map(c => {
      const m = c.metricas
      return `${c.nome}: Hoje ${m.vendas[0]}v ROI ${m.roi[0]}% CPA R$${m.cpa[0]} | Ontem ${m.vendas[1]}v ROI ${m.roi[1]}% | 7d ${m.vendas[2]}v ROI ${m.roi[2]}% | 30d ${m.vendas[4]}v ROI ${m.roi[4]}%`
    }).join('\n')
    const timeCtx = reportType === 'morning' ? 'Relatório matinal. Prioridades do dia.' : reportType === 'midday' ? 'Meio-dia (parcial). Alertas urgentes.' : 'Fechamento. Resumo + planejamento amanhã.'
    const prompt = `Analista de performance MTX. ${timeCtx}\n\nClientes:\n${summary}\n\nAnálise técnica (máx 200 palavras): Diagnóstico, alertas críticos (ROI<80%), 2-3 recomendações, projeção mensal. Seja direto.`
    const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${LOVABLE_API_KEY}` },
      body: JSON.stringify({ model: 'google/gemini-2.5-flash', messages: [{ role: 'user', content: prompt }], max_tokens: 800, temperature: 0.4 }),
    })
    if (!res.ok) return ''
    const data = await res.json()
    return data.choices?.[0]?.message?.content || ''
  } catch { return '' }
}

function generateAlerts(m: ClientData['metricas'], cpaMeta: number, nome: string): string[] {
  const alerts: string[] = []
  if (m.roi[0] < 80) alerts.push(`ROI hoje está em ${m.roi[0]}% — abaixo do mínimo saudável (80%).`)
  if (m.vendas[0] === 0 && m.vendas[1] > 0) alerts.push(`Zero vendas hoje, mas ${m.vendas[1]} nos últimos 7 dias. Verificar se campanhas estão ativas.`)
  if (cpaMeta > 0 && m.cpa[0] > cpaMeta * 1.3) alerts.push(`CPA hoje (R$${m.cpa[0]}) está ${Math.round(((m.cpa[0] - cpaMeta) / cpaMeta) * 100)}% acima da meta (R$${cpaMeta}).`)
  if (m.ctr[0] < 1) alerts.push(`CTR em ${m.ctr[0]}% — abaixo de 1%. Considerar refresh de criativos.`)
  return alerts
}

const fmt = (n: number) => Number(n).toFixed(2).replace('.', ',')
const fmtInt = (n: number) => Math.round(n).toString()

// ─── EMAIL HTML GENERATOR (Apple × Notion) ───────────────────

function generateEmailHTML(data: {
  periodo: string; horaLabel: string; dataHora: string
  totalVendas: number; roiMedio: number; spendTotal: number; cpaMedio: number; lucroTotal: number
  clientes: ClientData[]; geminiAnalysis: string
}): string {

  const statusBadge = (roi: number) => {
    if (roi >= 150) return { label: `🟢 ROI ${Math.round(roi)}%`, bg: '#edfaf1', color: '#1a7f37', border: 'rgba(52,199,89,0.25)' }
    if (roi >= 80)  return { label: `🟡 ROI ${Math.round(roi)}%`, bg: '#fff8ec', color: '#b25c00', border: 'rgba(255,159,10,0.25)' }
    return { label: `🔴 ROI ${Math.round(roi)}% — Atenção`, bg: '#fff0ef', color: '#c0392b', border: 'rgba(255,59,48,0.25)' }
  }

  const roiColor = (v: number) => v >= 150 ? '#1a7f37' : v >= 80 ? '#b25c00' : '#c0392b'

  const periods = ['Hoje', 'Ontem', '7 dias', '15 dias', '30 dias']

  const kpiPanel = (label: string, emoji: string, values: number[], format: (v: number) => string, colorFn?: (v: number) => string) => {
    return `
    <div style="margin-bottom:8px;">
      <div style="font-size:11px;font-weight:600;color:#ababab;margin-bottom:6px;">${emoji} ${label}</div>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:4px 0;">
        <tr>
          ${values.map((v, i) => `
            <td width="20%" style="background:${i === 0 ? '#f0f7ff' : '#f7f7f5'};border:1px solid ${i === 0 ? '#c5dcf7' : '#e8e8e5'};border-radius:10px;padding:9px 4px;text-align:center;vertical-align:top;">
              <div style="font-size:8px;font-weight:600;color:${i === 0 ? '#0051a2' : '#ababab'};text-transform:uppercase;letter-spacing:.04em;margin-bottom:3px;">${periods[i]}</div>
              <div style="font-size:13px;font-weight:700;color:${colorFn ? colorFn(v) : '#1a1a1a'};letter-spacing:-.3px;font-variant-numeric:tabular-nums;">${format(v)}</div>
            </td>
          `).join('')}
        </tr>
      </table>
    </div>`
  }

  const clienteCards = data.clientes.map(c => {
    const s = statusBadge(c.roi)
    const m = c.metricas
    const alerta = c.alertas.length > 0 ? `
      <div style="padding:8px 0 0;">
        <div style="background:#fff;border:1px solid rgba(255,159,10,.30);border-left:3px solid #ff9f0a;border-radius:10px;padding:12px 16px;">
          <div style="font-size:12px;font-weight:700;color:#b25c00;margin-bottom:3px;">⚠️ Ação recomendada</div>
          <div style="font-size:12px;color:#6b6b6b;line-height:1.5;">${c.alertas.join(' ')}</div>
        </div>
      </div>` : ''

    const agentBadge = c.agentActions > 0 ? `<span style="background:#f5f3ff;color:#7c3aed;border:1px solid #e0d6f5;border-radius:20px;padding:2px 8px;font-size:10px;font-weight:600;margin-left:6px;">🤖 ${c.agentActions}</span>` : ''

    const profitColor = (v: number) => v >= 0 ? '#1a7f37' : '#c0392b'

    return `
    <div style="border:1px solid #e8e8e5;border-radius:14px;margin-bottom:16px;overflow:hidden;background:#fff;">
      <!-- Client Header -->
      <div style="padding:14px 16px 12px;border-bottom:1px solid #f0f0ee;">
        <table width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="text-align:left;">
            <span style="font-size:15px;font-weight:700;color:#1a1a1a;">${c.nome}</span>${agentBadge}
            <br><span style="font-size:11px;color:#ababab;">${c.accountId}</span>
          </td>
          <td style="text-align:right;vertical-align:top;">
            <span style="background:${s.bg};color:${s.color};border:1px solid ${s.border};border-radius:20px;padding:4px 12px;font-size:11px;font-weight:600;">${s.label}</span>
          </td>
        </tr></table>
      </div>
      <!-- KPI Panels -->
      <div style="padding:14px 14px 6px;">
        ${kpiPanel('Lucro Líquido', '💰', m.lucro as unknown as number[], v => `R$${fmt(v)}`, profitColor)}
        ${kpiPanel('Vendas', '🛍️', m.vendas as unknown as number[], v => fmtInt(v))}
        ${kpiPanel('Investimento', '💳', m.spend as unknown as number[], v => `R$${fmt(v)}`)}
        ${kpiPanel('ROI', '📈', m.roi as unknown as number[], v => `${fmt(v)}%`, roiColor)}
        ${kpiPanel('CPA', '🎯', m.cpa as unknown as number[], v => `R$${fmt(v)}`)}
        ${kpiPanel('CPM', '👁️', m.cpm as unknown as number[], v => `R$${fmt(v)}`)}
        ${kpiPanel('CTR', '🔗', m.ctr as unknown as number[], v => `${fmt(v)}%`, v => v < 1 ? '#c0392b' : '#6b6b6b')}
      </div>
      ${alerta}
    </div>`
  }).join('')

  const geminiSection = data.geminiAnalysis ? `
  <!-- ANÁLISE IA -->
  <div style="background:#fff;border-left:1px solid #e8e8e5;border-right:1px solid #e8e8e5;padding:8px 32px 24px;">
    <div style="border:1px solid #e0d6f5;border-radius:14px;overflow:hidden;background:#faf8ff;">
      <div style="padding:14px 16px 10px;border-bottom:1px solid #e0d6f5;">
        <table width="100%" cellpadding="0" cellspacing="0"><tr>
          <td><span style="font-size:13px;font-weight:700;color:#7c3aed;">🧠 Diagnóstico Técnico</span></td>
          <td style="text-align:right;"><span style="font-size:9px;color:#ababab;">Gemini 2.5 Flash · ${data.clientes.length} cliente(s)</span></td>
        </tr></table>
      </div>
      <div style="padding:14px 16px;font-size:12px;color:#424245;line-height:1.85;">
        ${data.geminiAnalysis.replace(/\*\*(.*?)\*\*/g, '<strong style="color:#5b21b6;">$1</strong>').replace(/\n/g, '<br>')}
      </div>
    </div>
  </div>` : ''

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Relatório MTX</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:#f5f5f0;font-family:'Inter',-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',sans-serif;-webkit-font-smoothing:antialiased;">
<div style="padding:32px 16px;">
<div style="max-width:620px;margin:0 auto;">

  <!-- HEADER -->
  <div style="background:#fff;border:1px solid #e8e8e5;border-bottom:none;border-radius:16px 16px 0 0;padding:28px 32px;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td>
        <table cellpadding="0" cellspacing="0"><tr>
          <td style="width:36px;height:36px;background:#0071e3;border-radius:9px;text-align:center;vertical-align:middle;">
            <span style="font-size:16px;font-weight:900;color:#fff;line-height:36px;">M</span>
          </td>
          <td style="padding-left:10px;">
            <span style="font-size:18px;font-weight:700;color:#1a1a1a;letter-spacing:-0.3px;">MTX Assessoria</span>
          </td>
        </tr></table>
      </td>
      <td style="text-align:right;">
        <span style="background:#f0f7ff;border:1px solid #c5dcf7;border-radius:20px;padding:4px 12px;font-size:11px;font-weight:600;color:#0051a2;letter-spacing:.04em;text-transform:uppercase;">${data.periodo}</span>
      </td>
    </tr></table>
    <div style="height:1px;background:#e8e8e5;margin:16px -32px 0;"></div>
    <div style="padding-top:16px;">
      <span style="font-size:12px;color:#6b6b6b;">📅 ${data.dataHora}</span>
      <span style="font-size:12px;color:#6b6b6b;margin-left:16px;">🕐 ${data.horaLabel}</span>
      <span style="font-size:12px;color:#6b6b6b;margin-left:16px;">● ${data.clientes.length} clientes ativos</span>
    </div>
  </div>

  <!-- KPIs -->
  <div style="background:#fff;border-left:1px solid #e8e8e5;border-right:1px solid #e8e8e5;padding:20px 32px;border-bottom:1px solid #f0f0ee;">
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:8px 0;">
      <tr>
        <td width="19%" style="background:${data.lucroTotal >= 0 ? '#edfaf1' : '#fff0ef'};border:1px solid ${data.lucroTotal >= 0 ? 'rgba(52,199,89,0.25)' : 'rgba(255,59,48,0.25)'};border-radius:12px;padding:14px 6px;text-align:center;">
          <div style="font-size:9px;font-weight:600;color:#ababab;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;">💰 Lucro</div>
          <div style="font-size:18px;font-weight:700;color:${data.lucroTotal >= 0 ? '#1a7f37' : '#c0392b'};letter-spacing:-.5px;font-variant-numeric:tabular-nums;">R$${fmt(data.lucroTotal)}</div>
        </td>
        <td width="1%"></td>
        <td width="19%" style="background:#f7f7f5;border:1px solid #e8e8e5;border-radius:12px;padding:14px 6px;text-align:center;">
          <div style="font-size:9px;font-weight:600;color:#ababab;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;">🛍️ Vendas</div>
          <div style="font-size:18px;font-weight:700;color:#1a1a1a;letter-spacing:-.5px;font-variant-numeric:tabular-nums;">${data.totalVendas}</div>
        </td>
        <td width="1%"></td>
        <td width="19%" style="background:#f7f7f5;border:1px solid #e8e8e5;border-radius:12px;padding:14px 6px;text-align:center;">
          <div style="font-size:9px;font-weight:600;color:#ababab;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;">📈 ROI</div>
          <div style="font-size:18px;font-weight:700;color:${data.roiMedio >= 150 ? '#1a7f37' : data.roiMedio >= 80 ? '#b25c00' : '#c0392b'};letter-spacing:-.5px;font-variant-numeric:tabular-nums;">${fmt(data.roiMedio)}%</div>
        </td>
        <td width="1%"></td>
        <td width="19%" style="background:#f7f7f5;border:1px solid #e8e8e5;border-radius:12px;padding:14px 6px;text-align:center;">
          <div style="font-size:9px;font-weight:600;color:#ababab;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;">💳 Spend</div>
          <div style="font-size:18px;font-weight:700;color:#1a1a1a;letter-spacing:-.5px;font-variant-numeric:tabular-nums;">R$${fmt(data.spendTotal)}</div>
        </td>
        <td width="1%"></td>
        <td width="19%" style="background:#f7f7f5;border:1px solid #e8e8e5;border-radius:12px;padding:14px 6px;text-align:center;">
          <div style="font-size:9px;font-weight:600;color:#ababab;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;">🎯 CPA</div>
          <div style="font-size:18px;font-weight:700;color:#1a1a1a;letter-spacing:-.5px;font-variant-numeric:tabular-nums;">R$${fmt(data.cpaMedio)}</div>
        </td>
      </tr>
    </table>
  </div>

  <!-- SECTION TITLE -->
  <div style="background:#fff;border-left:1px solid #e8e8e5;border-right:1px solid #e8e8e5;padding:20px 32px 8px;">
    <div style="font-size:11px;font-weight:600;color:#ababab;text-transform:uppercase;letter-spacing:.08em;">
      ◼ Performance por Cliente — Nível de Campanha
    </div>
  </div>

  <!-- CLIENTES -->
  <div style="background:#fff;border-left:1px solid #e8e8e5;border-right:1px solid #e8e8e5;padding:8px 32px 24px;">
    ${clienteCards}
  </div>

  ${geminiSection}

  <!-- FOOTER -->
  <div style="background:#fff;border:1px solid #e8e8e5;border-top:${data.geminiAnalysis ? 'none' : '1px solid #e8e8e5'};border-radius:0 0 16px 16px;padding:24px 32px;text-align:center;">
    <a href="${APP_URL}" style="display:inline-block;background:#0071e3;color:#fff;border-radius:980px;padding:11px 28px;font-size:14px;font-weight:600;text-decoration:none;">Abrir MTX Dashboard →</a>
    <div style="font-size:11px;color:#ababab;margin-top:16px;line-height:1.6;">
      Dados via Meta Ads API · Nível de campanha · Gerado automaticamente<br>
      MTX Assessoria Estratégica · ${data.dataHora}
    </div>
  </div>

</div>
</div>
</body>
</html>`
}

// ─── MAIN HANDLER ────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    let reportType = 'morning'
    try { const body = await req.json(); if (body?.report_type) reportType = body.report_type } catch {}

    const { data: profiles } = await supabase.from('client_profiles').select('id, user_id, name, is_active, meta_access_token, ad_account_id, cpa_meta').eq('is_active', true)
    if (!profiles?.length) return new Response(JSON.stringify({ message: 'No active profiles' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const userProfiles = new Map<string, typeof profiles>()
    for (const p of profiles) {
      if (!p.meta_access_token || !p.ad_account_id || p.ad_account_id === 'act_') continue
      const list = userProfiles.get(p.user_id) || []
      list.push(p)
      userProfiles.set(p.user_id, list)
    }

    const results: { user_id: string; status: string; error?: string }[] = []
    const periodoLabel = reportType === 'morning' ? 'Relatório Matinal' : reportType === 'midday' ? 'Performance ao Vivo' : 'Fechamento do Dia'
    const horaLabel = reportType === 'morning' ? 'Dados de ontem (completo)' : reportType === 'midday' ? 'Dados parciais de hoje' : 'Fechamento do dia'
    const dateStr = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

    for (const [userId, clientProfiles] of userProfiles) {
      try {
        const { data: { user } } = await supabase.auth.admin.getUserById(userId)
        if (!user?.email) continue

        const clientDataList: ClientData[] = []

        for (const profile of clientProfiles) {
          const periodResults = await Promise.all(
            DATE_PRESETS.map(preset => fetchMetaInsights(profile.ad_account_id, profile.meta_access_token!, preset))
          )
          if (!periodResults.some(p => p.dataVerified)) {
            console.warn(`⚠️ SKIP ${profile.name}: No verified data`); continue
          }

          // Agent actions count
          let agentActions = 0
          try {
            const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
            const { data: logs } = await supabase.from('emergency_logs').select('id').eq('profile_id', profile.id).gte('created_at', since24h)
            agentActions = logs?.length || 0
          } catch {}

          const [today, yesterday, d7, d15, d30] = periodResults
          const cpaMeta = Number(profile.cpa_meta) || 45

          const metricas: ClientData['metricas'] = {
            vendas: [today.sales, yesterday.sales, d7.sales, d15.sales, d30.sales],
            custoVenda: [r(today.costPerSale), r(yesterday.costPerSale), r(d7.costPerSale), r(d15.costPerSale), r(d30.costPerSale)],
            roi: [r(today.roi), r(yesterday.roi), r(d7.roi), r(d15.roi), r(d30.roi)],
            cpa: [r(today.cpa), r(yesterday.cpa), r(d7.cpa), r(d15.cpa), r(d30.cpa)],
            cpm: [r(today.cpm), r(yesterday.cpm), r(d7.cpm), r(d15.cpm), r(d30.cpm)],
            ctr: [r(today.ctr), r(yesterday.ctr), r(d7.ctr), r(d15.ctr), r(d30.ctr)],
            lucro: [r(today.profit), r(yesterday.profit), r(d7.profit), r(d15.profit), r(d30.profit)],
            spend: [r(today.spend), r(yesterday.spend), r(d7.spend), r(d15.spend), r(d30.spend)],
          }

          const alertas = generateAlerts(metricas, cpaMeta, profile.name)

          clientDataList.push({
            nome: profile.name,
            accountId: profile.ad_account_id,
            profileId: profile.id,
            roi: r(today.roi),
            cpaMeta,
            metricas,
            alertas,
            agentActions,
          })
        }

        if (!clientDataList.length) { results.push({ user_id: userId, status: 'skipped_no_verified_data' }); continue }

        const geminiAnalysis = await generateGeminiAnalysis(clientDataList, reportType)

        const totalVendas = clientDataList.reduce((s, c) => s + c.metricas.vendas[0], 0)
        const totalSpend = clientDataList.reduce((s, c) => s + c.metricas.cpa[0] * c.metricas.vendas[0], 0) // approximate from CPA × vendas
        // Better: sum from raw periods
        const allPeriods = await Promise.all(clientProfiles.map(async p => {
          if (!p.meta_access_token || !p.ad_account_id || p.ad_account_id === 'act_') return null
          return fetchMetaInsights(p.ad_account_id, p.meta_access_token!, 'today')
        }))
        const realTotalSpend = allPeriods.reduce((s, p) => s + (p?.spend || 0), 0)
        const realTotalRevenue = allPeriods.reduce((s, p) => s + (p?.revenue || 0), 0)
        const avgRoi = realTotalSpend > 0 ? ((realTotalRevenue - realTotalSpend) / realTotalSpend) * 100 : 0
        const avgCpa = totalVendas > 0 ? realTotalSpend / totalVendas : 0
        const lucroTotal = realTotalRevenue - realTotalSpend

        const subject = getSubject(reportType)
        const html = generateEmailHTML({
          periodo: periodoLabel,
          horaLabel,
          dataHora: dateStr,
          totalVendas,
          roiMedio: r(avgRoi),
          spendTotal: r(realTotalSpend),
          cpaMedio: r(avgCpa),
          lucroTotal: r(lucroTotal),
          clientes: clientDataList,
          geminiAnalysis,
        })

        const resendRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_API_KEY}` },
          body: JSON.stringify({ from: 'MTX Command Center <onboarding@resend.dev>', to: [user.email], subject, html }),
        })
        const resendData = await resendRes.json()
        results.push({ user_id: userId, status: resendRes.ok ? 'sent' : 'failed', error: resendRes.ok ? undefined : JSON.stringify(resendData) })
      } catch (err) { results.push({ user_id: userId, status: 'error', error: String(err) }) }
    }

    return new Response(JSON.stringify({ results }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 })
  }
})

function r(n: number): number { return Math.round(n * 100) / 100 }

function getSubject(type: string): string {
  switch (type) {
    case 'morning': return '☀️ MTX — Bom dia | Prioridades do dia'
    case 'midday': return '📊 MTX — Meio-dia | Performance ao vivo'
    case 'evening': return '🎯 MTX — Fechamento | Resumo + amanhã'
    default: return '📊 MTX — Relatório Diário'
  }
}
