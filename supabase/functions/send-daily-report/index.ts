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

interface PeriodMetrics {
  sales: number
  spend: number
  revenue: number
  costPerSale: number
  roi: number
  cpa: number
  cpm: number
  ctr: number
  profit: number
  dataVerified: boolean
}

interface AgentData {
  totalActions: number
  pauses: number
  scales: number
  reduces: number
  selfHeals: number
  duplicates: number
  recoveryRate: number | null
  lastRunAt: string | null
  recentActions: Array<{ action_type: string; details: any; created_at: string }>
}

interface ClientReport {
  name: string
  adAccountId: string
  cpaMeta: number
  periods: { today: PeriodMetrics; d7: PeriodMetrics; d15: PeriodMetrics; d30: PeriodMetrics }
  agent: AgentData
}

const DATE_PRESETS = ['today', 'last_7d', 'last_14d', 'last_30d'] as const

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

async function fetchAgentData(supabase: any, profileId: string): Promise<AgentData> {
  const empty: AgentData = { totalActions: 0, pauses: 0, scales: 0, reduces: 0, selfHeals: 0, duplicates: 0, recoveryRate: null, lastRunAt: null, recentActions: [] }
  try {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data: logs, error } = await supabase.from('emergency_logs').select('action_type, details, created_at').eq('profile_id', profileId).gte('created_at', since24h).order('created_at', { ascending: false }).limit(50)
    if (error || !logs) return empty
    const pauses = logs.filter((l: any) => l.action_type === 'agent_pause' || l.action_type === 'pause').length
    const scales = logs.filter((l: any) => l.action_type === 'agent_scale' || l.action_type === 'scale').length
    const reduces = logs.filter((l: any) => l.action_type === 'agent_reduce' || l.action_type === 'reduce').length
    const selfHeals = logs.filter((l: any) => l.action_type === 'agent_self_heal' || l.details?.recovered).length
    const duplicates = logs.filter((l: any) => l.action_type === 'agent_duplicate' || l.action_type === 'duplicate').length
    const failures = logs.filter((l: any) => l.details?.success === false || l.details?.recovered)
    const recovered = logs.filter((l: any) => l.details?.recovered === true || l.action_type === 'agent_self_heal')
    const recoveryRate = failures.length > 0 ? Math.round((recovered.length / failures.length) * 100) : null
    return { totalActions: logs.length, pauses, scales, reduces, selfHeals, duplicates, recoveryRate, lastRunAt: logs.length > 0 ? logs[0].created_at : null, recentActions: logs.slice(0, 5) }
  } catch { return empty }
}

async function generateGeminiAnalysis(clients: ClientReport[], reportType: string): Promise<string> {
  try {
    const clientSummaries = clients.map(c => {
      const p = c.periods
      const agentInfo = c.agent.totalActions > 0
        ? `\n  Agente (24h): ${c.agent.totalActions} ações | ${c.agent.pauses} pausas | ${c.agent.scales} escalas | Recovery: ${c.agent.recoveryRate !== null ? c.agent.recoveryRate + '%' : 'N/A'}`
        : ''
      return `${c.name} (CPA Meta: R$${c.cpaMeta})\n  Hoje: ${p.today.sales}v R$${p.today.spend.toFixed(0)} spend Lucro R$${p.today.profit.toFixed(0)} ROI ${p.today.roi.toFixed(0)}%\n  7d: ${p.d7.sales}v R$${p.d7.spend.toFixed(0)} Lucro R$${p.d7.profit.toFixed(0)} ROI ${p.d7.roi.toFixed(0)}%\n  15d: ${p.d15.sales}v R$${p.d15.spend.toFixed(0)} Lucro R$${p.d15.profit.toFixed(0)} ROI ${p.d15.roi.toFixed(0)}%\n  30d: ${p.d30.sales}v R$${p.d30.spend.toFixed(0)} Lucro R$${p.d30.profit.toFixed(0)} ROI ${p.d30.roi.toFixed(0)}%${agentInfo}`
    }).join('\n\n')
    const timeCtx = reportType === 'morning' ? 'Relatório matinal (ontem). Prioridades do dia.' : reportType === 'midday' ? 'Meio-dia (hoje parcial). Alertas urgentes.' : 'Fechamento do dia. Resumo + planejamento amanhã.'
    const prompt = `Analista de performance MTX. ${timeCtx}\n\nClientes:\n${clientSummaries}\n\nAnálise técnica (máx 250 palavras): Diagnóstico de tendências, alertas críticos (ROI<80%, zero vendas), 2-3 recomendações acionáveis, avaliação do agente autônomo, projeção mensal. Seja direto e use os números reais.`
    const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${LOVABLE_API_KEY}` },
      body: JSON.stringify({ model: 'google/gemini-2.5-flash', messages: [{ role: 'user', content: prompt }], max_tokens: 1024, temperature: 0.4 }),
    })
    if (!res.ok) return 'Análise indisponível no momento.'
    const data = await res.json()
    return data.choices?.[0]?.message?.content || 'Análise indisponível no momento.'
  } catch { return 'Análise indisponível no momento.' }
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

    for (const [userId, clientProfiles] of userProfiles) {
      try {
        const { data: { user } } = await supabase.auth.admin.getUserById(userId)
        if (!user?.email) continue

        const clientReports: ClientReport[] = []
        for (const profile of clientProfiles) {
          const [periodResults, agentData] = await Promise.all([
            Promise.all(DATE_PRESETS.map(preset => fetchMetaInsights(profile.ad_account_id, profile.meta_access_token!, preset))),
            fetchAgentData(supabase, profile.id),
          ])
          if (!periodResults.some(p => p.dataVerified)) {
            console.warn(`⚠️ SKIP ${profile.name}: No verified data`)
            continue
          }
          clientReports.push({
            name: profile.name, adAccountId: profile.ad_account_id,
            cpaMeta: Number(profile.cpa_meta) || 45,
            periods: { today: periodResults[0], d7: periodResults[1], d15: periodResults[2], d30: periodResults[3] },
            agent: agentData,
          })
        }

        if (!clientReports.length) { results.push({ user_id: userId, status: 'skipped_no_verified_data' }); continue }

        const geminiAnalysis = await generateGeminiAnalysis(clientReports, reportType)
        const subject = getSubject(reportType)
        const html = buildEmailHtml(clientReports, reportType, user.email, geminiAnalysis)

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

// ─── HELPERS ─────────────────────────────────────────────────

function getSubject(type: string): string {
  switch (type) {
    case 'morning': return '☀️ MTX — Bom dia | Prioridades do dia'
    case 'midday': return '📊 MTX — Meio-dia | Performance ao vivo'
    case 'evening': return '🎯 MTX — Fechamento | Resumo + amanhã'
    default: return '📊 MTX — Relatório Diário'
  }
}

const fmt = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtInt = (n: number) => n.toLocaleString('pt-BR')
const fmtK = (n: number) => Math.abs(n) >= 1000 ? (n / 1000).toFixed(1).replace('.', ',') + 'k' : fmt(n)

function profitColor(v: number): string { return v > 0 ? '#00ff88' : v < 0 ? '#ff3b3b' : '#888' }
function roiColor(v: number): string { return v > 150 ? '#00ff88' : v >= 80 ? '#f59e0b' : '#ff3b3b' }
function cpaColor(v: number, meta: number): string { return meta > 0 && v <= meta ? '#00ff88' : meta > 0 && v <= meta * 1.3 ? '#f59e0b' : '#ff3b3b' }
function ctrColor(v: number): string { return v > 2 ? '#00ff88' : v >= 1 ? '#f59e0b' : '#ff3b3b' }
function recoveryColor(v: number): string { return v >= 80 ? '#00ff88' : v >= 50 ? '#f59e0b' : '#ff3b3b' }

// ─── KPI CARD ────────────────────────────────────────────────

function kpiCard(label: string, value: string, color: string, subtitle?: string): string {
  return `<td style="padding:6px;">
    <div style="background:linear-gradient(135deg,rgba(255,255,255,0.10) 0%,rgba(255,255,255,0.04) 100%);border:1px solid rgba(255,255,255,0.14);border-radius:14px;padding:16px 12px;text-align:center;box-shadow:0 4px 20px rgba(0,0,0,0.15),inset 0 1px 0 rgba(255,255,255,0.08);">
      <div style="font-size:9px;color:#999;text-transform:uppercase;letter-spacing:1.2px;margin-bottom:5px;font-weight:500;">${label}</div>
      <div style="font-size:20px;font-weight:800;color:${color};font-variant-numeric:tabular-nums;line-height:1.2;">${value}</div>
      ${subtitle ? `<div style="font-size:9px;color:#666;margin-top:4px;">${subtitle}</div>` : ''}
    </div>
  </td>`
}

// ─── SECTION HEADER ──────────────────────────────────────────

function sectionHeader(number: string, title: string, icon: string, accent: string = '#ff3b3b'): string {
  return `
  <div style="display:flex;align-items:center;margin:28px 0 16px;padding-bottom:10px;border-bottom:1px solid rgba(255,255,255,0.08);">
    <div style="width:28px;height:28px;border-radius:8px;background:${accent}18;border:1px solid ${accent}30;display:flex;align-items:center;justify-content:center;margin-right:10px;">
      <span style="font-size:12px;font-weight:800;color:${accent};">${number}</span>
    </div>
    <span style="font-size:13px;margin-right:6px;">${icon}</span>
    <span style="font-size:15px;font-weight:700;color:#fff;letter-spacing:-0.2px;">${title}</span>
  </div>`
}

// ─── PERIOD PANEL ────────────────────────────────────────────

function periodPanel(label: string, emoji: string, p: PeriodMetrics, cpaMeta: number): string {
  return `
  <div style="background:linear-gradient(135deg,rgba(255,255,255,0.08) 0%,rgba(255,255,255,0.03) 100%);border:1px solid rgba(255,255,255,0.12);border-radius:16px;padding:18px;margin-bottom:12px;box-shadow:0 4px 20px rgba(0,0,0,0.15),inset 0 1px 0 rgba(255,255,255,0.06);">
    <div style="display:flex;align-items:center;margin-bottom:14px;">
      <span style="font-size:14px;margin-right:8px;">${emoji}</span>
      <span style="font-size:13px;font-weight:700;color:#fff;text-transform:uppercase;letter-spacing:0.5px;">${label}</span>
      ${p.dataVerified ? '<span style="margin-left:auto;font-size:8px;color:#00ff88;background:rgba(0,255,136,0.08);padding:2px 8px;border-radius:10px;border:1px solid rgba(0,255,136,0.15);">✓ Verificado</span>' : ''}
    </div>
    
    <!-- Hero: Lucro Líquido -->
    <div style="text-align:center;padding:10px 0 14px;border-bottom:1px solid rgba(255,255,255,0.06);margin-bottom:12px;">
      <div style="font-size:9px;color:#888;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:4px;">Lucro Líquido</div>
      <div style="font-size:28px;font-weight:900;color:${profitColor(p.profit)};font-variant-numeric:tabular-nums;">
        ${p.profit >= 0 ? '+' : ''}R$ ${fmt(p.profit)}
      </div>
      <div style="font-size:10px;color:#666;margin-top:4px;">Receita R$ ${fmtK(p.revenue)} − Spend R$ ${fmtK(p.spend)}</div>
    </div>

    <!-- KPI Grid 2x3 -->
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        ${kpiCard('Vendas', fmtInt(p.sales), p.sales > 0 ? '#00ff88' : '#ff3b3b')}
        ${kpiCard('ROI', `${fmt(p.roi)}%`, roiColor(p.roi))}
        ${kpiCard('CPA', `R$${fmt(p.cpa)}`, cpaColor(p.cpa, cpaMeta), cpaMeta > 0 ? `Meta: R$${fmt(cpaMeta)}` : undefined)}
      </tr>
      <tr>
        ${kpiCard('Spend', `R$${fmt(p.spend)}`, '#fff')}
        ${kpiCard('CPM', `R$${fmt(p.cpm)}`, '#fff')}
        ${kpiCard('CTR', `${fmt(p.ctr)}%`, ctrColor(p.ctr))}
      </tr>
    </table>
  </div>`
}

// ─── AGENT SECTION ───────────────────────────────────────────

function buildAgentSection(agent: AgentData): string {
  if (agent.totalActions === 0) {
    return `<div style="background:linear-gradient(135deg,rgba(255,255,255,0.06) 0%,rgba(255,255,255,0.02) 100%);border:1px solid rgba(255,255,255,0.10);border-radius:14px;padding:12px 14px;margin-bottom:14px;">
      <p style="color:#666;margin:0;font-size:11px;">🤖 Agente Autônomo — Sem ações nas últimas 24h</p>
    </div>`
  }

  const lastRun = agent.lastRunAt ? new Date(agent.lastRunAt).toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : '—'

  const actionItems = agent.recentActions.map(a => {
    const time = new Date(a.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    const icon = a.action_type.includes('pause') ? '⏸️' : a.action_type.includes('scale') ? '📈' : a.action_type.includes('reduce') ? '📉' : a.action_type.includes('heal') ? '🔧' : a.action_type.includes('duplicate') ? '📋' : '⚡'
    const detail = a.details?.campaign_name || a.details?.reason || a.action_type
    return `<div style="display:flex;align-items:center;padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.04);">
      <span style="color:#555;font-size:10px;min-width:40px;font-variant-numeric:tabular-nums;">${time}</span>
      <span style="color:#bbb;font-size:11px;margin-left:8px;">${icon} ${detail}</span>
    </div>`
  }).join('')

  return `
  <div style="background:linear-gradient(135deg,rgba(168,85,247,0.10) 0%,rgba(168,85,247,0.03) 100%);border:1px solid rgba(168,85,247,0.18);border-radius:16px;padding:18px;margin-bottom:14px;box-shadow:0 4px 20px rgba(0,0,0,0.15),inset 0 1px 0 rgba(255,255,255,0.06);">
    <div style="margin-bottom:12px;">
      <span style="font-size:13px;font-weight:700;color:#a855f7;">🤖 Agente Autônomo</span>
      <span style="float:right;font-size:9px;color:#555;">Última exec: ${lastRun}</span>
    </div>
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        ${kpiCard('Ações', String(agent.totalActions), '#a855f7')}
        ${kpiCard('Pausas', String(agent.pauses), '#ff3b3b')}
        ${kpiCard('Escalas', String(agent.scales), '#00ff88')}
      </tr>
      <tr>
        ${kpiCard('Reduções', String(agent.reduces), '#f59e0b')}
        ${kpiCard('Self-Heal', String(agent.selfHeals), '#38bdf8')}
        ${kpiCard('Recovery', agent.recoveryRate !== null ? `${agent.recoveryRate}%` : 'N/A', agent.recoveryRate !== null ? recoveryColor(agent.recoveryRate) : '#555')}
      </tr>
    </table>
    ${actionItems ? `<div style="margin-top:10px;padding-top:8px;border-top:1px solid rgba(168,85,247,0.12);"><div style="font-size:9px;color:#555;text-transform:uppercase;letter-spacing:1px;margin-bottom:5px;">Últimas ações</div>${actionItems}</div>` : ''}
  </div>`
}

// ─── CLIENT BLOCK ────────────────────────────────────────────

function buildClientBlock(client: ClientReport, index: number): string {
  const p = client.periods
  return `
  <!-- Client: ${client.name} -->
  <div style="margin-bottom:28px;">
    <div style="display:flex;align-items:center;padding:14px 0 10px;border-bottom:2px solid rgba(255,59,59,0.2);margin-bottom:14px;">
      <div style="width:32px;height:32px;border-radius:10px;background:linear-gradient(135deg,#ff3b3b20,#ff6b3520);border:1px solid rgba(255,59,59,0.2);display:flex;align-items:center;justify-content:center;margin-right:12px;">
        <span style="font-size:14px;font-weight:800;color:#ff3b3b;">${index + 1}</span>
      </div>
      <div>
        <h2 style="color:#fff;margin:0;font-size:18px;font-weight:800;letter-spacing:-0.3px;">${client.name}</h2>
        <p style="color:#444;margin:2px 0 0;font-size:10px;letter-spacing:0.3px;">${client.adAccountId} · CPA Meta: R$ ${fmt(client.cpaMeta)}</p>
      </div>
    </div>

    ${periodPanel('Hoje', '📅', p.today, client.cpaMeta)}
    ${periodPanel('7 Dias', '📊', p.d7, client.cpaMeta)}
    ${periodPanel('15 Dias', '📈', p.d15, client.cpaMeta)}
    ${periodPanel('30 Dias', '🗓️', p.d30, client.cpaMeta)}
    ${buildAgentSection(client.agent)}
  </div>`
}

// ─── FULL EMAIL ──────────────────────────────────────────────

function buildEmailHtml(clients: ClientReport[], type: string, email: string, geminiAnalysis: string): string {
  const greeting = type === 'morning' ? '☀️ Bom dia' : type === 'midday' ? '📊 Meio-dia' : '🎯 Fechamento'
  const subtitle = type === 'morning' ? 'Dados de ontem (fechamento completo)' : type === 'midday' ? 'Dados parciais de hoje' : 'Fechamento do dia'
  const dateStr = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const timeStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })

  const clientBlocks = clients.map((c, i) => buildClientBlock(c, i)).join('')

  const totalSales = clients.reduce((s, c) => s + c.periods.today.sales, 0)
  const totalSpend = clients.reduce((s, c) => s + c.periods.today.spend, 0)
  const totalRevenue = clients.reduce((s, c) => s + c.periods.today.revenue, 0)
  const totalProfit = totalRevenue - totalSpend
  const avgRoi = totalSpend > 0 ? ((totalRevenue - totalSpend) / totalSpend) * 100 : 0
  const totalAgentActions = clients.reduce((s, c) => s + c.agent.totalActions, 0)

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MTX Command Center — Relatório</title>
</head>
<body style="margin:0;padding:0;background:linear-gradient(135deg,#0a0e1a 0%,#12091e 50%,#0a0e1a 100%);font-family:'DM Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
<div style="max-width:640px;margin:0 auto;background:linear-gradient(180deg,rgba(10,14,26,0.98) 0%,rgba(18,9,30,0.98) 100%);">

  <!-- ═══ HEADER ═══ -->
  <div style="background:linear-gradient(135deg,rgba(255,255,255,0.05) 0%,rgba(255,255,255,0.01) 100%);padding:36px 24px 28px;text-align:center;border-bottom:1px solid rgba(255,255,255,0.08);">
    
    <!-- Logo / Brand Mark -->
    <div style="margin-bottom:16px;">
      <div style="display:inline-block;width:48px;height:48px;border-radius:14px;background:linear-gradient(135deg,#ff3b3b,#ff6b35);box-shadow:0 8px 24px rgba(255,59,59,0.3);line-height:48px;">
        <span style="font-size:20px;font-weight:900;color:#fff;letter-spacing:-1px;">M</span>
      </div>
    </div>

    <!-- Brand Badge -->
    <div style="display:inline-block;background:rgba(255,59,59,0.08);border:1px solid rgba(255,59,59,0.15);border-radius:20px;padding:3px 14px;margin-bottom:10px;">
      <span style="font-size:10px;color:#ff3b3b;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">MTX Command Center</span>
    </div>

    <h1 style="color:#fff;margin:8px 0 0;font-size:26px;font-weight:900;letter-spacing:-0.5px;line-height:1.2;">
      ${greeting}
    </h1>
    <p style="color:#777;margin:6px 0 0;font-size:13px;font-weight:400;">${subtitle}</p>
    <p style="color:#444;margin:4px 0 0;font-size:11px;">${dateStr} · ${timeStr} BRT</p>
  </div>

  <div style="padding:24px;">

    <!-- ═══ SEÇÃO 1: RESUMO CONSOLIDADO ═══ -->
    ${sectionHeader('1', 'Resumo Consolidado', '📊')}
    
    <div style="background:linear-gradient(135deg,rgba(255,255,255,0.12) 0%,rgba(255,255,255,0.04) 100%);border:1px solid rgba(255,255,255,0.16);border-radius:18px;padding:22px;margin-bottom:8px;box-shadow:0 12px 40px rgba(0,0,0,0.2),inset 0 1px 0 rgba(255,255,255,0.10);">
      
      <!-- Hero Profit -->
      <div style="text-align:center;margin-bottom:18px;padding-bottom:16px;border-bottom:1px solid rgba(255,255,255,0.06);">
        <div style="font-size:9px;color:#888;text-transform:uppercase;letter-spacing:2px;margin-bottom:4px;">Lucro Líquido Total (Hoje)</div>
        <div style="font-size:38px;font-weight:900;color:${profitColor(totalProfit)};font-variant-numeric:tabular-nums;line-height:1.1;">
          ${totalProfit >= 0 ? '+' : ''}R$ ${fmt(totalProfit)}
        </div>
      </div>

      <!-- KPI Cards -->
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          ${kpiCard('Vendas Totais', fmtInt(totalSales), totalSales > 0 ? '#00ff88' : '#ff3b3b')}
          ${kpiCard('Investimento', `R$${fmt(totalSpend)}`, '#fff')}
          ${kpiCard('ROI Médio', `${fmt(avgRoi)}%`, roiColor(avgRoi))}
        </tr>
      </table>

      ${totalAgentActions > 0 ? `
      <div style="text-align:center;margin-top:12px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.06);">
        <span style="font-size:10px;color:#a855f7;background:rgba(168,85,247,0.08);padding:3px 10px;border-radius:10px;border:1px solid rgba(168,85,247,0.12);">🤖 ${totalAgentActions} ações do agente (24h)</span>
      </div>` : ''}
    </div>

    <!-- ═══ SEÇÃO 2: PERFORMANCE POR CLIENTE ═══ -->
    ${sectionHeader('2', 'Performance por Cliente', '🏢')}
    ${clientBlocks}

    <!-- ═══ SEÇÃO 3: ANÁLISE ESTRATÉGICA IA ═══ -->
    ${sectionHeader('3', 'Análise Estratégica', '🤖', '#a855f7')}
    
    <div style="background:linear-gradient(135deg,rgba(168,85,247,0.12) 0%,rgba(168,85,247,0.04) 100%);border:1px solid rgba(168,85,247,0.18);border-radius:18px;padding:22px;box-shadow:0 8px 28px rgba(0,0,0,0.18),inset 0 1px 0 rgba(255,255,255,0.06);">
      <div style="display:flex;align-items:center;margin-bottom:14px;padding-bottom:12px;border-bottom:1px solid rgba(168,85,247,0.12);">
        <div style="width:28px;height:28px;border-radius:8px;background:rgba(168,85,247,0.15);display:flex;align-items:center;justify-content:center;margin-right:10px;">
          <span style="font-size:14px;">🧠</span>
        </div>
        <div>
          <div style="font-size:13px;font-weight:700;color:#c084fc;">Diagnóstico Técnico</div>
          <div style="font-size:9px;color:#555;">Gemini 2.5 Flash · Dados verificados · ${clients.length} cliente(s)</div>
        </div>
      </div>
      <div style="color:#ccc;font-size:12px;line-height:1.85;">
        ${geminiAnalysis.replace(/\*\*(.*?)\*\*/g, '<strong style="color:#e9d5ff;">$1</strong>').replace(/\n/g, '<br>')}
      </div>
    </div>
  </div>

  <!-- ═══ FOOTER ═══ -->
  <div style="background:linear-gradient(135deg,rgba(255,255,255,0.03) 0%,rgba(255,255,255,0.01) 100%);padding:28px 24px 36px;text-align:center;border-top:1px solid rgba(255,255,255,0.06);">
    
    <!-- CTA Button -->
    <a href="https://mtx-roi-command.lovable.app" style="display:inline-block;background:linear-gradient(135deg,#ff3b3b,#ff6b35);color:#fff;text-decoration:none;padding:13px 36px;border-radius:12px;font-weight:700;font-size:13px;letter-spacing:0.3px;box-shadow:0 8px 24px rgba(255,59,59,0.25);">
      Abrir MTX Command Center →
    </a>

    <!-- Divider -->
    <div style="width:60px;height:1px;background:rgba(255,255,255,0.08);margin:20px auto;"></div>

    <!-- Contact & Meta Info -->
    <div style="margin-top:0;">
      <p style="color:#555;font-size:10px;margin:0 0 4px;font-weight:600;text-transform:uppercase;letter-spacing:1px;">MTX Agência Criativa</p>
      <p style="color:#444;font-size:10px;margin:0 0 2px;">mtxagenciacriativa@gmail.com</p>
      <p style="color:#333;font-size:9px;margin:8px 0 0;line-height:1.5;">
        Relatório automático · ${clients.length} cliente(s) · Dados verificados via Meta API<br>
        Emitido em ${dateStr} às ${timeStr} BRT<br>
        Destinatário: ${email}
      </p>
    </div>
  </div>

</div>
</body>
</html>`
}
