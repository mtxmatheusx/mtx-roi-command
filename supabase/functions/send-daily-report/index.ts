import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.98.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

interface ReportData {
  activeClients: number
  totalProfiles: number
  mrr: number
  todaySpend: number
  todayImpressions: number
  todayClicks: number
  todayConversions: number
  todayRoas: number
  pendingTasks: number
  recentDrafts: number
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Determine report type from body or default to time-based
    let reportType = 'morning'
    try {
      const body = await req.json()
      if (body?.report_type) reportType = body.report_type
    } catch { /* no body = use default */ }

    const now = new Date()
    const today = now.toISOString().split('T')[0]

    // Fetch all users with profiles
    const { data: profiles } = await supabase
      .from('client_profiles')
      .select('id, user_id, name, is_active, meta_access_token, ad_account_id')

    if (!profiles || profiles.length === 0) {
      return new Response(JSON.stringify({ message: 'No profiles found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    // Group profiles by user
    const userProfiles = new Map<string, typeof profiles>()
    for (const p of profiles) {
      const list = userProfiles.get(p.user_id) || []
      list.push(p)
      userProfiles.set(p.user_id, list)
    }

    const results: { user_id: string; status: string; error?: string }[] = []

    for (const [userId, userProfileList] of userProfiles) {
      try {
        // Get user email
        const { data: { user } } = await supabase.auth.admin.getUserById(userId)
        if (!user?.email) continue

        const activeClients = userProfileList.filter(p => p.is_active).length
        const profileIds = userProfileList.map(p => p.id)

        // Today's metrics
        const { data: metrics } = await supabase
          .from('unified_metrics')
          .select('spend, impressions, clicks, conversions, conversion_value, roas')
          .eq('user_id', userId)
          .eq('date', today)

        const todaySpend = metrics?.reduce((s, m) => s + Number(m.spend), 0) || 0
        const todayImpressions = metrics?.reduce((s, m) => s + Number(m.impressions), 0) || 0
        const todayClicks = metrics?.reduce((s, m) => s + Number(m.clicks), 0) || 0
        const todayConversions = metrics?.reduce((s, m) => s + Number(m.conversions), 0) || 0
        const todayRevenue = metrics?.reduce((s, m) => s + Number(m.conversion_value), 0) || 0
        const todayRoas = todaySpend > 0 ? todayRevenue / todaySpend : 0

        // Pending tasks
        const { count: pendingTasks } = await supabase
          .from('team_tasks')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .in('status', ['todo', 'in_progress'])

        // Recent drafts
        const { count: recentDrafts } = await supabase
          .from('campaign_drafts')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('status', 'draft')

        const data: ReportData = {
          activeClients,
          totalProfiles: userProfileList.length,
          mrr: activeClients * 5000, // estimate
          todaySpend,
          todayImpressions,
          todayClicks,
          todayConversions,
          todayRoas,
          pendingTasks: pendingTasks || 0,
          recentDrafts: recentDrafts || 0,
        }

        const subject = getSubject(reportType)
        const html = buildEmailHtml(data, reportType, user.email)

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
      status: 200,
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

function buildEmailHtml(data: ReportData, type: string, email: string): string {
  const greeting = type === 'morning' ? 'Bom dia' : type === 'midday' ? 'Boa tarde' : 'Fechamento do dia'

  const morningSection = type === 'morning' ? `
    <div style="background:#111;border-radius:12px;padding:20px;margin-bottom:16px;border-left:4px solid #00ff88;">
      <h3 style="color:#00ff88;margin:0 0 12px;font-size:14px;text-transform:uppercase;letter-spacing:1px;">🎯 Prioridades do Dia</h3>
      <p style="color:#ccc;margin:0;font-size:14px;line-height:1.6;">
        • ${data.pendingTasks} tarefas pendentes para hoje<br>
        • ${data.recentDrafts} rascunhos de campanha aguardando revisão<br>
        • ${data.activeClients} clientes ativos para monitorar
      </p>
    </div>` : ''

  const middaySection = type === 'midday' ? `
    <div style="background:#111;border-radius:12px;padding:20px;margin-bottom:16px;border-left:4px solid #ff6b35;">
      <h3 style="color:#ff6b35;margin:0 0 12px;font-size:14px;text-transform:uppercase;letter-spacing:1px;">⚡ Alertas de Performance</h3>
      <p style="color:#ccc;margin:0;font-size:14px;line-height:1.6;">
        ${data.todayRoas < 2 && data.todaySpend > 0 ? '⚠️ ROAS abaixo de 2x — revisar campanhas ativas' : '✅ Performance dentro dos parâmetros'}<br>
        ${data.todayConversions === 0 && data.todaySpend > 100 ? '⚠️ Zero conversões com gasto > R$100' : ''}
      </p>
    </div>` : ''

  const eveningSection = type === 'evening' ? `
    <div style="background:#111;border-radius:12px;padding:20px;margin-bottom:16px;border-left:4px solid #a855f7;">
      <h3 style="color:#a855f7;margin:0 0 12px;font-size:14px;text-transform:uppercase;letter-spacing:1px;">📋 Planejamento Amanhã</h3>
      <p style="color:#ccc;margin:0;font-size:14px;line-height:1.6;">
        • Revisar ${data.recentDrafts} rascunhos pendentes<br>
        • Verificar orçamentos dos ${data.activeClients} clientes ativos<br>
        • Analisar tendências de CPA e ROAS
      </p>
    </div>` : ''

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#000;font-family:'DM Sans',Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#0a0a0a;">
    
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#0a0a0a,#1a1a2e);padding:32px 24px;text-align:center;border-bottom:1px solid #222;">
      <h1 style="color:#fff;margin:0;font-size:28px;font-weight:800;letter-spacing:-0.5px;">
        <span style="color:#ff3b3b;">MTX</span> Command Center
      </h1>
      <p style="color:#666;margin:8px 0 0;font-size:13px;">${greeting} — ${new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
    </div>

    <div style="padding:24px;">

      <!-- MRR Card -->
      <div style="background:#111;border-radius:12px;padding:20px;margin-bottom:16px;border-left:4px solid #00ff88;">
        <h3 style="color:#00ff88;margin:0 0 12px;font-size:14px;text-transform:uppercase;letter-spacing:1px;">💰 Receita (MRR Estimado)</h3>
        <div style="display:flex;gap:24px;">
          <div>
            <p style="color:#fff;font-size:32px;font-weight:800;margin:0;">R$ ${fmtInt(data.mrr)}</p>
            <p style="color:#888;font-size:12px;margin:4px 0 0;">${data.activeClients} clientes ativos / ${data.totalProfiles} total</p>
          </div>
        </div>
      </div>

      <!-- Tráfego Card -->
      <div style="background:#111;border-radius:12px;padding:20px;margin-bottom:16px;border-left:4px solid #3b82f6;">
        <h3 style="color:#3b82f6;margin:0 0 16px;font-size:14px;text-transform:uppercase;letter-spacing:1px;">📈 Tráfego Hoje</h3>
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:8px 0;border-bottom:1px solid #222;">
              <span style="color:#888;font-size:13px;">Gasto</span><br>
              <span style="color:#fff;font-size:18px;font-weight:700;">R$ ${fmt(data.todaySpend)}</span>
            </td>
            <td style="padding:8px 0;border-bottom:1px solid #222;text-align:right;">
              <span style="color:#888;font-size:13px;">ROAS</span><br>
              <span style="color:${data.todayRoas >= 2 ? '#00ff88' : '#ff3b3b'};font-size:18px;font-weight:700;">${fmt(data.todayRoas)}x</span>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 0;">
              <span style="color:#888;font-size:13px;">Impressões</span><br>
              <span style="color:#fff;font-size:16px;font-weight:600;">${fmtInt(data.todayImpressions)}</span>
            </td>
            <td style="padding:8px 0;text-align:center;">
              <span style="color:#888;font-size:13px;">Cliques</span><br>
              <span style="color:#fff;font-size:16px;font-weight:600;">${fmtInt(data.todayClicks)}</span>
            </td>
          </tr>
          <tr>
            <td colspan="2" style="padding:8px 0;">
              <span style="color:#888;font-size:13px;">Conversões</span><br>
              <span style="color:#00ff88;font-size:16px;font-weight:600;">${fmtInt(data.todayConversions)}</span>
            </td>
          </tr>
        </table>
      </div>

      <!-- Ações Card -->
      <div style="background:#111;border-radius:12px;padding:20px;margin-bottom:16px;border-left:4px solid #f59e0b;">
        <h3 style="color:#f59e0b;margin:0 0 12px;font-size:14px;text-transform:uppercase;letter-spacing:1px;">📋 Ações Pendentes</h3>
        <p style="color:#ccc;margin:0;font-size:14px;line-height:1.8;">
          🔲 ${data.pendingTasks} tarefas em aberto<br>
          📝 ${data.recentDrafts} rascunhos de campanha<br>
          👥 ${data.activeClients} clientes para monitorar
        </p>
      </div>

      ${morningSection}
      ${middaySection}
      ${eveningSection}

    </div>

    <!-- Footer -->
    <div style="background:#050505;padding:24px;text-align:center;border-top:1px solid #222;">
      <a href="https://mtx-roi-command.lovable.app" style="display:inline-block;background:linear-gradient(135deg,#ff3b3b,#ff6b35);color:#fff;text-decoration:none;padding:12px 32px;border-radius:8px;font-weight:700;font-size:14px;">
        Abrir MTX Command Center →
      </a>
      <p style="color:#444;font-size:11px;margin:16px 0 0;">
        Enviado automaticamente pelo MTX Command Center<br>
        ${email}
      </p>
    </div>

  </div>
</body>
</html>`
}
