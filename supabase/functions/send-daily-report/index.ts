import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.98.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const META_API_VERSION = 'v23.0'
const META_BASE = `https://graph.facebook.com/${META_API_VERSION}`

interface PeriodMetrics {
  sales: number
  spend: number
  revenue: number
  costPerSale: number
  roi: number
  cpa: number
  cpm: number
  ctr: number
}

interface ClientReport {
  name: string
  adAccountId: string
  cpaMeta: number
  periods: { today: PeriodMetrics; d7: PeriodMetrics; d15: PeriodMetrics; d30: PeriodMetrics }
}

const DATE_PRESETS = ['today', 'last_7_days', 'last_14_days', 'last_30_days'] as const
const PERIOD_KEYS = ['today', 'd7', 'd15', 'd30'] as const

async function fetchMetaInsights(
  adAccountId: string,
  accessToken: string,
  datePreset: string
): Promise<PeriodMetrics> {
  const empty: PeriodMetrics = { sales: 0, spend: 0, revenue: 0, costPerSale: 0, roi: 0, cpa: 0, cpm: 0, ctr: 0 }

  try {
    const fields = 'campaign_name,spend,actions,action_values,cost_per_action_type,cpm,ctr'
    const filtering = JSON.stringify([{ field: 'effective_status', operator: 'IN', value: ['ACTIVE'] }])
    const url = `${META_BASE}/${adAccountId}/insights?level=campaign&fields=${fields}&date_preset=${datePreset}&filtering=${encodeURIComponent(filtering)}&limit=500&access_token=${accessToken}`

    const res = await fetch(url)
    if (!res.ok) {
      const errBody = await res.text()
      console.error(`Meta API error for ${adAccountId} (${datePreset}): ${res.status} - ${errBody}`)
      return empty
    }

    const json = await res.json()
    const rows = json.data || []

    let totalSpend = 0
    let totalSales = 0
    let totalRevenue = 0
    let totalImpressions = 0
    let totalClicks = 0
    let totalCostPerPurchase = 0
    let purchaseCampaigns = 0

    for (const row of rows) {
      const spend = parseFloat(row.spend || '0')
      totalSpend += spend

      // Extract purchase actions
      const actions = row.actions || []
      const purchaseAction = actions.find((a: any) =>
        a.action_type === 'purchase' || a.action_type === 'omni_purchase'
      )
      const sales = purchaseAction ? parseInt(purchaseAction.value || '0') : 0
      totalSales += sales

      // Extract purchase value
      const actionValues = row.action_values || []
      const purchaseValue = actionValues.find((a: any) =>
        a.action_type === 'purchase' || a.action_type === 'omni_purchase'
      )
      const revenue = purchaseValue ? parseFloat(purchaseValue.value || '0') : 0
      totalRevenue += revenue

      // CPA from cost_per_action_type
      const costPerActions = row.cost_per_action_type || []
      const cpaPurchase = costPerActions.find((a: any) =>
        a.action_type === 'purchase' || a.action_type === 'omni_purchase'
      )
      if (cpaPurchase) {
        totalCostPerPurchase += parseFloat(cpaPurchase.value || '0')
        purchaseCampaigns++
      }
    }

    const cpm = rows.length > 0 ? rows.reduce((s: number, r: any) => s + parseFloat(r.cpm || '0'), 0) / rows.length : 0
    const ctr = rows.length > 0 ? rows.reduce((s: number, r: any) => s + parseFloat(r.ctr || '0'), 0) / rows.length : 0
    const costPerSale = totalSales > 0 ? totalSpend / totalSales : 0
    const roi = totalSpend > 0 ? ((totalRevenue - totalSpend) / totalSpend) * 100 : 0
    const cpa = purchaseCampaigns > 0 ? totalCostPerPurchase / purchaseCampaigns : (totalSales > 0 ? totalSpend / totalSales : 0)

    return { sales: totalSales, spend: totalSpend, revenue: totalRevenue, costPerSale, roi, cpa, cpm, ctr }
  } catch (err) {
    console.error(`Meta fetch error for ${adAccountId} (${datePreset}):`, err)
    return empty
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    let reportType = 'morning'
    try {
      const body = await req.json()
      if (body?.report_type) reportType = body.report_type
    } catch { /* no body */ }

    // Fetch all profiles with Meta tokens
    const { data: profiles } = await supabase
      .from('client_profiles')
      .select('id, user_id, name, is_active, meta_access_token, ad_account_id, cpa_meta')
      .eq('is_active', true)

    if (!profiles || profiles.length === 0) {
      return new Response(JSON.stringify({ message: 'No active profiles' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Group by user
    const userProfiles = new Map<string, typeof profiles>()
    for (const p of profiles) {
      if (!p.meta_access_token || !p.ad_account_id || p.ad_account_id === 'act_') continue
      const list = userProfiles.get(p.user_id) || []
      list.push(p)
      userProfiles.set(p.user_id, list)
    }

    const results: { user_id: string; status: string; error?: string }[] = []

    for (const [userId, clientProfiles] of userProfiles) {
      try {
        const { data: { user } } = await supabase.auth.admin.getUserById(userId)
        if (!user?.email) continue

        // Fetch metrics for each client across all 4 periods
        const clientReports: ClientReport[] = []

        for (const profile of clientProfiles) {
          const periodResults = await Promise.all(
            DATE_PRESETS.map(preset => fetchMetaInsights(profile.ad_account_id, profile.meta_access_token!, preset))
          )

          clientReports.push({
            name: profile.name,
            adAccountId: profile.ad_account_id,
            cpaMeta: Number(profile.cpa_meta) || 45,
            periods: {
              today: periodResults[0],
              d7: periodResults[1],
              d15: periodResults[2],
              d30: periodResults[3],
            },
          })
        }

        const subject = getSubject(reportType)
        const html = buildEmailHtml(clientReports, reportType, user.email)

        const resendRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: 'MTX Command Center <onboarding@resend.dev>',
            to: [user.email],
            subject,
            html,
          }),
        })

        const resendData = await resendRes.json()
        results.push({
          user_id: userId,
          status: resendRes.ok ? 'sent' : 'failed',
          error: resendRes.ok ? undefined : JSON.stringify(resendData),
        })
      } catch (err) {
        results.push({ user_id: userId, status: 'error', error: String(err) })
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})

function getSubject(type: string): string {
  switch (type) {
    case 'morning': return '☀️ MTX — Bom dia | Prioridades do dia'
    case 'midday': return '📊 MTX — Meio-dia | Performance ao vivo'
    case 'evening': return '🎯 MTX — Fechamento | Resumo + amanhã'
    default: return '📊 MTX — Relatório Diário'
  }
}

function fmt(n: number): string {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtInt(n: number): string {
  return n.toLocaleString('pt-BR')
}

function statusIcon(metric: string, value: number, cpaMeta?: number): string {
  switch (metric) {
    case 'roi':
      if (value > 150) return '🟢'
      if (value >= 80) return '🟡'
      return '🔴'
    case 'ctr':
      if (value > 2) return '🟢'
      if (value >= 1) return '🟡'
      return '🔴'
    case 'cpa':
      if (cpaMeta && value <= cpaMeta) return '🟢'
      if (cpaMeta && value <= cpaMeta * 1.3) return '🟡'
      return '🔴'
    case 'sales':
      return value > 0 ? '🟢' : '🔴'
    default:
      return ''
  }
}

function statusColor(metric: string, value: number, cpaMeta?: number): string {
  switch (metric) {
    case 'roi':
      if (value > 150) return '#00ff88'
      if (value >= 80) return '#f59e0b'
      return '#ff3b3b'
    case 'ctr':
      if (value > 2) return '#00ff88'
      if (value >= 1) return '#f59e0b'
      return '#ff3b3b'
    case 'cpa':
      if (cpaMeta && value <= cpaMeta) return '#00ff88'
      if (cpaMeta && value <= cpaMeta * 1.3) return '#f59e0b'
      return '#ff3b3b'
    case 'sales':
      return value > 0 ? '#00ff88' : '#ff3b3b'
    default:
      return '#ffffff'
  }
}

function overallStatus(periods: ClientReport['periods']): string {
  const rois = [periods.today.roi, periods.d7.roi, periods.d15.roi, periods.d30.roi]
  if (rois.every(r => r > 150)) return '🟢 ROI > 150% nos 4 períodos'
  if (rois.every(r => r >= 80)) return '🟡 ROI entre 80-150% em algum período'
  return '🔴 ROI < 80% em pelo menos um período'
}

function buildClientTable(client: ClientReport): string {
  const p = client.periods
  const rows = [
    {
      label: 'Vendas',
      values: [fmtInt(p.today.sales), fmtInt(p.d7.sales), fmtInt(p.d15.sales), fmtInt(p.d30.sales)],
      colors: [
        statusColor('sales', p.today.sales),
        statusColor('sales', p.d7.sales),
        statusColor('sales', p.d15.sales),
        statusColor('sales', p.d30.sales),
      ],
    },
    {
      label: 'Custo/V',
      values: [`R$${fmt(p.today.costPerSale)}`, `R$${fmt(p.d7.costPerSale)}`, `R$${fmt(p.d15.costPerSale)}`, `R$${fmt(p.d30.costPerSale)}`],
      colors: ['#fff', '#fff', '#fff', '#fff'],
    },
    {
      label: 'ROI',
      values: [`${fmt(p.today.roi)}%`, `${fmt(p.d7.roi)}%`, `${fmt(p.d15.roi)}%`, `${fmt(p.d30.roi)}%`],
      colors: [
        statusColor('roi', p.today.roi),
        statusColor('roi', p.d7.roi),
        statusColor('roi', p.d15.roi),
        statusColor('roi', p.d30.roi),
      ],
    },
    {
      label: 'CPA',
      values: [`R$${fmt(p.today.cpa)}`, `R$${fmt(p.d7.cpa)}`, `R$${fmt(p.d15.cpa)}`, `R$${fmt(p.d30.cpa)}`],
      colors: [
        statusColor('cpa', p.today.cpa, client.cpaMeta),
        statusColor('cpa', p.d7.cpa, client.cpaMeta),
        statusColor('cpa', p.d15.cpa, client.cpaMeta),
        statusColor('cpa', p.d30.cpa, client.cpaMeta),
      ],
    },
    {
      label: 'CPM',
      values: [`R$${fmt(p.today.cpm)}`, `R$${fmt(p.d7.cpm)}`, `R$${fmt(p.d15.cpm)}`, `R$${fmt(p.d30.cpm)}`],
      colors: ['#fff', '#fff', '#fff', '#fff'],
    },
    {
      label: 'CTR',
      values: [`${fmt(p.today.ctr)}%`, `${fmt(p.d7.ctr)}%`, `${fmt(p.d15.ctr)}%`, `${fmt(p.d30.ctr)}%`],
      colors: [
        statusColor('ctr', p.today.ctr),
        statusColor('ctr', p.d7.ctr),
        statusColor('ctr', p.d15.ctr),
        statusColor('ctr', p.d30.ctr),
      ],
    },
  ]

  const tableRows = rows.map(r => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #222;color:#888;font-size:13px;font-weight:600;">${r.label}</td>
      ${r.values.map((v, i) => `<td style="padding:8px 10px;border-bottom:1px solid #222;color:${r.colors[i]};font-size:14px;font-weight:700;text-align:center;">${v}</td>`).join('')}
    </tr>
  `).join('')

  const status = overallStatus(client.periods)

  return `
    <div style="background:#111;border-radius:12px;overflow:hidden;margin-bottom:20px;">
      <div style="padding:16px 20px;border-bottom:1px solid #222;">
        <h3 style="color:#fff;margin:0;font-size:16px;font-weight:800;">🏪 ${client.name}</h3>
        <p style="color:#666;margin:4px 0 0;font-size:12px;">Conta: ${client.adAccountId}</p>
      </div>
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="background:#0a0a0a;">
            <th style="padding:10px 12px;text-align:left;color:#666;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Métrica</th>
            <th style="padding:10px 10px;text-align:center;color:#666;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Hoje</th>
            <th style="padding:10px 10px;text-align:center;color:#666;font-size:11px;text-transform:uppercase;letter-spacing:1px;">7d</th>
            <th style="padding:10px 10px;text-align:center;color:#666;font-size:11px;text-transform:uppercase;letter-spacing:1px;">15d</th>
            <th style="padding:10px 10px;text-align:center;color:#666;font-size:11px;text-transform:uppercase;letter-spacing:1px;">30d</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
      <div style="padding:12px 20px;background:#0a0a0a;border-top:1px solid #222;">
        <p style="color:#ccc;margin:0;font-size:13px;">Status: ${status}</p>
      </div>
    </div>
  `
}

function buildEmailHtml(clients: ClientReport[], type: string, email: string): string {
  const greeting = type === 'morning' ? '☀️ Bom dia' : type === 'midday' ? '📊 Meio-dia' : '🎯 Fechamento'
  const subtitle = type === 'morning' ? 'Dados de ontem (fechamento completo)' : type === 'midday' ? 'Dados parciais de hoje' : 'Fechamento do dia'

  const clientTables = clients.map(c => buildClientTable(c)).join('')

  // Consolidation
  const totalSalesToday = clients.reduce((s, c) => s + c.periods.today.sales, 0)
  const totalSpendToday = clients.reduce((s, c) => s + c.periods.today.spend, 0)
  const totalRevenueToday = clients.reduce((s, c) => s + c.periods.today.revenue, 0)
  const avgRoi = totalSpendToday > 0 ? ((totalRevenueToday - totalSpendToday) / totalSpendToday) * 100 : 0

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#000;font-family:'DM Sans',Arial,sans-serif;">
  <div style="max-width:640px;margin:0 auto;background:#0a0a0a;">
    
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#0a0a0a,#1a1a2e);padding:32px 24px;text-align:center;border-bottom:1px solid #222;">
      <h1 style="color:#fff;margin:0;font-size:28px;font-weight:800;letter-spacing:-0.5px;">
        <span style="color:#ff3b3b;">MTX</span> Command Center
      </h1>
      <p style="color:#999;margin:8px 0 0;font-size:15px;">${greeting}</p>
      <p style="color:#666;margin:4px 0 0;font-size:12px;">${subtitle} — ${new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
    </div>

    <div style="padding:24px;">
      ${clientTables}

      <!-- Consolidação MTX -->
      <div style="background:linear-gradient(135deg,#111,#1a1a2e);border-radius:12px;padding:20px;margin-top:8px;border:1px solid #333;">
        <h3 style="color:#00ff88;margin:0 0 16px;font-size:14px;text-transform:uppercase;letter-spacing:1px;">📊 Consolidado MTX</h3>
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:6px 0;">
              <span style="color:#888;font-size:12px;">Total Vendas (Hoje)</span><br>
              <span style="color:#00ff88;font-size:24px;font-weight:800;">${fmtInt(totalSalesToday)}</span>
            </td>
            <td style="padding:6px 0;text-align:right;">
              <span style="color:#888;font-size:12px;">Spend Total (Hoje)</span><br>
              <span style="color:#fff;font-size:24px;font-weight:800;">R$ ${fmt(totalSpendToday)}</span>
            </td>
          </tr>
          <tr>
            <td colspan="2" style="padding:12px 0 0;">
              <span style="color:#888;font-size:12px;">ROI Médio Ponderado</span><br>
              <span style="color:${statusColor('roi', avgRoi)};font-size:28px;font-weight:800;">${fmt(avgRoi)}%</span>
            </td>
          </tr>
        </table>
      </div>
    </div>

    <!-- Footer -->
    <div style="background:#050505;padding:24px;text-align:center;border-top:1px solid #222;">
      <a href="https://mtx-roi-command.lovable.app" style="display:inline-block;background:linear-gradient(135deg,#ff3b3b,#ff6b35);color:#fff;text-decoration:none;padding:14px 36px;border-radius:8px;font-weight:700;font-size:14px;">
        Abrir MTX →
      </a>
      <p style="color:#444;font-size:11px;margin:16px 0 0;">
        Relatório automático · ${clients.length} clientes ativos<br>
        ${email}
      </p>
    </div>

  </div>
</body>
</html>`
}
