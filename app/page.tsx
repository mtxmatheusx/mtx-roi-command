'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  LayoutDashboard, Megaphone, Trophy, Zap, Settings,
  RefreshCw, Pause, Play, Copy, Star, AlertTriangle, Loader2,
  DollarSign, Target, Activity, MousePointer2, ShieldCheck, Flame,
  Plus, Trash2, Edit3, Check, X, User, Key, TrendingUp,
  Image, Rocket,
} from 'lucide-react'

/* ══════════════════════════════════════════════════
   TYPES
══════════════════════════════════════════════════ */
interface Profile {
  id:        string
  name:      string
  accountId: string
  pixelId:   string
  pageId:    string
}
interface Campaign {
  id: string; name: string; status: string; effectiveStatus: string
  dailyBudget: number | null; lifetimeBudget: number | null
  spend: number; impressions: number; clicks: number; ctr: number
  cpm: number; cpc: number; purchases: number; purchaseValue: number
  roas: number; cpa: number; profit: number
}
interface Creative {
  adName: string; spend: number; impressions: number; clicks: number
  ctr: number; cpc: number; purchases: number; purchaseValue: number
  roas: number; thumbnailUrl: string | null
}
interface Ad {
  id: string; name: string; status: string; effectiveStatus: string
  adsetId: string; campaignId: string
  spend: number; impressions: number; clicks: number
  ctr: number; cpc: number; purchases: number; roas: number
  creative: { id: string; thumbnailUrl: string | null; title: string | null; body: string | null } | null
}

/* ── Constants ── */
const SCALE_OPTIONS = [10, 20, 30, 50]

const OBJECTIVES = [
  { value: 'OUTCOME_SALES',     label: 'Conversões / Vendas' },
  { value: 'OUTCOME_TRAFFIC',   label: 'Tráfego' },
  { value: 'OUTCOME_AWARENESS', label: 'Alcance / Reconhecimento' },
  { value: 'OUTCOME_LEADS',     label: 'Geração de Leads' },
]
const COUNTRIES = [
  { value: 'BR', label: '🇧🇷 Brasil' },
  { value: 'US', label: '🇺🇸 EUA' },
  { value: 'PT', label: '🇵🇹 Portugal' },
  { value: 'AR', label: '🇦🇷 Argentina' },
  { value: 'MX', label: '🇲🇽 México' },
]

const DEMO: Campaign[] = [
  { id: 'd1', name: 'VSL Principal – Oferta',    status: 'ACTIVE',  effectiveStatus: 'ACTIVE',  dailyBudget: 150, lifetimeBudget: null, spend: 4920, impressions: 128500, clicks: 4879, ctr: 3.8, cpm: 38.3, cpc: 1.01, purchases: 32, purchaseValue: 45711, roas: 9.29, cpa: 153.75, profit: 40791 },
  { id: 'd2', name: 'Reels Prova Social',        status: 'ACTIVE',  effectiveStatus: 'ACTIVE',  dailyBudget: 80,  lifetimeBudget: null, spend: 2100, impressions: 95000,  clicks: 1140, ctr: 1.2, cpm: 22.1, cpc: 1.84, purchases: 8,  purchaseValue: 5600,  roas: 2.67, cpa: 262.5,  profit: 3500  },
  { id: 'd3', name: 'Carrossel Método',          status: 'PAUSED',  effectiveStatus: 'PAUSED',  dailyBudget: 60,  lifetimeBudget: null, spend: 980,  impressions: 40800,  clicks: 979,  ctr: 2.4, cpm: 24.0, cpc: 1.00, purchases: 4,  purchaseValue: 1960,  roas: 2.0,  cpa: 245,    profit: 980   },
  { id: 'd4', name: 'Imagem Estática CTA',       status: 'ACTIVE',  effectiveStatus: 'ACTIVE',  dailyBudget: 120, lifetimeBudget: null, spend: 3200, impressions: 103225, clicks: 3200, ctr: 3.1, cpm: 31.0, cpc: 1.00, purchases: 15, purchaseValue: 12150, roas: 3.8,  cpa: 213.3,  profit: 8950  },
  { id: 'd5', name: 'UGC Depoimento Cold',       status: 'PAUSED',  effectiveStatus: 'PAUSED',  dailyBudget: 50,  lifetimeBudget: null, spend: 420,  impressions: 52500,  clicks: 420,  ctr: 0.8, cpm: 8.0,  cpc: 1.00, purchases: 0,  purchaseValue: 0,     roas: 0,    cpa: 0,      profit: -420  },
]
const DEMO_CR: Creative[] = [
  { adName: 'VSL Dor Principal 60s',        spend: 3200, impressions: 84210, clicks: 3200, ctr: 3.8, cpc: 1, purchases: 28, purchaseValue: 32900, roas: 10.28, thumbnailUrl: null },
  { adName: 'Imagem Estática – CTA Direto', spend: 1720, impressions: 55484, clicks: 1720, ctr: 3.1, cpc: 1, purchases: 12, purchaseValue: 9200,  roas: 5.35,  thumbnailUrl: null },
  { adName: 'Carrossel Método 5 Slides',    spend: 980,  impressions: 40833, clicks: 979,  ctr: 2.4, cpc: 1, purchases: 6,  purchaseValue: 4200,  roas: 4.29,  thumbnailUrl: null },
]

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard',  icon: LayoutDashboard },
  { id: 'campaigns', label: 'Campanhas',  icon: Megaphone },
  { id: 'ads',       label: 'Anúncios',   icon: Image },
  { id: 'optimize',  label: 'Otimizar',   icon: Zap },
  { id: 'creatives', label: 'Criativos',  icon: Trophy },
  { id: 'create',    label: 'Criar',      icon: Rocket },
]

/* ── Helpers ── */
const fmt     = (n: number, d = 2) => n.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d })
const fmtBRL  = (n: number) => `R$ ${fmt(n)}`
const fmtROAS = (n: number) => `${n.toFixed(2)}x`
const fmtPct  = (n: number) => `${n.toFixed(1)}%`
const roasCol = (r: number) => r >= 3 ? '#00e676' : r >= 1.5 ? '#ff9100' : '#ff1744'
const uid     = () => Math.random().toString(36).slice(2, 10)

/* ════════════════════════════════════════════════════════════ */
export default function Dashboard() {

  /* ── Global token ── */
  const [token,     setToken]    = useState('')
  const [tokenEdit, setTokenEdit] = useState('')

  /* ── Profiles ── */
  const [profiles,  setProfiles] = useState<Profile[]>([])
  const [activeId,  setActiveId] = useState<string | null>(null)

  /* ── Campaign data ── */
  const [campaigns,  setCampaigns]  = useState<Campaign[]>([])
  const [creatives,  setCreatives]  = useState<Creative[]>([])
  const [loading,    setLoading]    = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [connected,  setConnected]  = useState(false)
  const [apiError,   setApiError]   = useState<string | null>(null)
  const [dateRange,  setDateRange]  = useState<'hoje' | 'ontem' | 7 | 14 | 30>(30)

  /* ── Ads data ── */
  const [ads,        setAds]        = useState<Ad[]>([])
  const [adsLoading, setAdsLoading] = useState(false)
  const [adsFilter,  setAdsFilter]  = useState<'all' | 'ACTIVE' | 'PAUSED'>('all')

  /* ── Create wizard ── */
  const [selectedCreative, setSelectedCreative] = useState<Ad | null>(null)
  const [createStep,       setCreateStep]       = useState<1 | 2 | 3>(1)
  const [createForm,       setCreateForm]       = useState({ name: '', objective: 'OUTCOME_SALES', dailyBudget: '50', country: 'BR' })
  const [createLoading,    setCreateLoading]    = useState(false)
  const [createResult,     setCreateResult]     = useState<{ ok: boolean; msg: string; campaignId?: string; adsetId?: string; adId?: string } | null>(null)

  /* ── UI ── */
  const [view,     setView]    = useState('dashboard')
  const [hovNav,   setHovNav]  = useState<string | null>(null)
  const [scales,   setScales]  = useState<Record<string, number>>({})
  const [actLoad,  setActLoad] = useState<Record<string, boolean>>({})
  const [toast,    setToast]   = useState<{ msg: string; ok: boolean } | null>(null)

  /* ── Settings form ── */
  const blank = { name: '', accountId: '', pixelId: '', pageId: '' }
  const [form,        setForm]        = useState(blank)
  const [editingId,   setEditingId]   = useState<string | null>(null)
  const [formErr,     setFormErr]     = useState<string | null>(null)
  const [testLoading, setTestLoading] = useState(false)
  const [testResult,  setTestResult]  = useState<{ ok: boolean; msg: string } | null>(null)

  const active = profiles.find(p => p.id === activeId) ?? null

  /* ── Persist / Load ── */
  useEffect(() => {
    const t   = localStorage.getItem('mtx_token') || ''
    const raw = localStorage.getItem('mtx_profiles')
    const aid = localStorage.getItem('mtx_active_profile')
    const ps: Profile[] = raw ? JSON.parse(raw) : []
    setToken(t); setTokenEdit(t)
    setProfiles(ps)
    setActiveId(ps.find(p => p.id === aid)?.id ?? ps[0]?.id ?? null)
  }, [])

  useEffect(() => { localStorage.setItem('mtx_profiles', JSON.stringify(profiles)) }, [profiles])
  useEffect(() => { if (activeId) localStorage.setItem('mtx_active_profile', activeId) }, [activeId])

  /* ── Fetch campaigns ── */
  const fetchData = useCallback(async (isRefresh = false) => {
    if (!active || !token) { setCampaigns(DEMO); setCreatives(DEMO_CR); return }
    if (isRefresh) setRefreshing(true); else setLoading(true)
    try {
      const today     = new Date().toISOString().slice(0, 10)
      const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)
      const since = dateRange === 'hoje' ? today : dateRange === 'ontem' ? yesterday
                  : new Date(Date.now() - (dateRange as number) * 86_400_000).toISOString().slice(0, 10)
      const until = dateRange === 'ontem' ? yesterday : today
      const ctrl  = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 12000)
      const params = new URLSearchParams({ token, accountId: active.accountId, since, until })
      const res   = await fetch(`/api/meta?${params}`, { signal: ctrl.signal })
      clearTimeout(timer)
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || `HTTP ${res.status}`) }
      const data = await res.json()
      setCampaigns(data.campaigns || []); setCreatives(data.creatives || [])
      setConnected(true); setApiError(null)
    } catch (e: any) {
      setConnected(false)
      setApiError(e.name === 'AbortError' ? 'Tempo esgotado' : e.message)
      setCampaigns(DEMO); setCreatives(DEMO_CR)
    } finally {
      setLoading(false); setRefreshing(false)
    }
  }, [active?.id, token, dateRange])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchData() }, [active?.id, token, dateRange])

  /* ── Fetch ads ── */
  const fetchAds = useCallback(async () => {
    if (!active || !token) return
    setAdsLoading(true)
    try {
      const today = new Date().toISOString().slice(0, 10)
      const since = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10)
      const params = new URLSearchParams({ token, accountId: active.accountId, type: 'ads', since, until: today })
      const res  = await fetch(`/api/meta?${params}`)
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || `HTTP ${res.status}`) }
      const data = await res.json()
      setAds(data.ads || [])
    } catch (e: any) {
      showToast(e.message || 'Erro ao carregar anúncios', false)
    } finally {
      setAdsLoading(false)
    }
  }, [active?.id, token])

  // Fetch ads when entering ads or create views
  useEffect(() => {
    if ((view === 'ads' || view === 'create') && active && token) {
      fetchAds()
    }
  }, [view, active?.id, token])

  /* ── Toast ── */
  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok }); setTimeout(() => setToast(null), 3500)
  }

  /* ── Profile CRUD ── */
  const saveProfile = () => {
    if (!form.name.trim() || !form.accountId.trim()) { setFormErr('Nome e Account ID são obrigatórios'); return }
    if (editingId) {
      setProfiles(ps => ps.map(p => p.id === editingId ? { ...p, ...form } : p))
      showToast('Perfil atualizado!')
    } else {
      const np = { id: uid(), ...form }
      setProfiles(ps => [...ps, np])
      if (!activeId) setActiveId(np.id)
      showToast('Perfil criado!')
    }
    setForm(blank); setEditingId(null); setFormErr(null)
  }
  const deleteProfile = (id: string) => {
    setProfiles(ps => ps.filter(p => p.id !== id))
    if (activeId === id) setActiveId(profiles.filter(p => p.id !== id)[0]?.id ?? null)
  }
  const startEdit  = (p: Profile) => { setEditingId(p.id); setForm({ name: p.name, accountId: p.accountId, pixelId: p.pixelId, pageId: p.pageId }); setFormErr(null) }
  const cancelEdit = () => { setEditingId(null); setForm(blank); setFormErr(null) }

  /* ── Test connection ── */
  const testConnection = async () => {
    if (!tokenEdit.trim()) { setTestResult({ ok: false, msg: 'Cole o token antes de testar' }); return }
    const testAccountId = active?.accountId || profiles[0]?.accountId || ''
    if (!testAccountId) { setTestResult({ ok: false, msg: 'Crie um perfil com Account ID primeiro' }); return }
    setTestLoading(true); setTestResult(null)
    try {
      const today = new Date().toISOString().slice(0, 10)
      const since = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10)
      const params = new URLSearchParams({ token: tokenEdit.trim(), accountId: testAccountId, since, until: today })
      const res  = await fetch(`/api/meta?${params}`)
      const data = await res.json()
      if (res.ok) setTestResult({ ok: true,  msg: `✓ Conectado! ${data.campaigns?.length ?? 0} campanhas encontradas` })
      else        setTestResult({ ok: false, msg: data.error || `Erro ${res.status}` })
    } catch (e: any) {
      setTestResult({ ok: false, msg: e.message || 'Erro de conexão' })
    } finally {
      setTestLoading(false)
    }
  }

  /* ── Campaign action ── */
  const doAction = async (action: string, campaignId: string, extra?: Record<string, unknown>) => {
    if (!active || !token) return
    const key = `${action}-${campaignId}`
    setActLoad(p => ({ ...p, [key]: true }))
    try {
      const res  = await fetch('/api/meta', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, action, campaignId, accountId: active.accountId, ...extra }),
      })
      const data = await res.json()
      if (res.ok) { showToast(data.message || 'Ação executada'); fetchData(true) }
      else        showToast(data.error || 'Erro', false)
    } catch { showToast('Erro de conexão', false) }
    finally { setActLoad(p => ({ ...p, [key]: false })) }
  }
  const isAct = (action: string, id: string) => actLoad[`${action}-${id}`]

  /* ── Ad action ── */
  const doAdAction = async (action: 'pause_ad' | 'activate_ad', adId: string) => {
    if (!active || !token) return
    const key = `${action}-${adId}`
    setActLoad(p => ({ ...p, [key]: true }))
    try {
      const res  = await fetch('/api/meta', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, action, adId }),
      })
      const data = await res.json()
      if (res.ok) { showToast(data.message || 'Ação executada'); fetchAds() }
      else        showToast(data.error || 'Erro', false)
    } catch { showToast('Erro de conexão', false) }
    finally { setActLoad(p => ({ ...p, [key]: false })) }
  }

  /* ── Launch campaign ── */
  const launchCampaign = async () => {
    if (!active || !token || !selectedCreative?.creative?.id) return
    setCreateLoading(true); setCreateResult(null)
    try {
      const res  = await fetch('/api/meta', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          action:      'create_campaign',
          name:        createForm.name,
          objective:   createForm.objective,
          dailyBudget: createForm.dailyBudget,
          creativeId:  selectedCreative.creative.id,
          accountId:   active.accountId,
          countryCode: createForm.country,
          pixelId:     active.pixelId || undefined,  // passa pixel para OUTCOME_SALES
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setCreateResult({ ok: true, msg: data.message || 'Campanha criada!', campaignId: data.campaignId, adsetId: data.adsetId, adId: data.adId })
        showToast('🚀 Campanha criada com sucesso!')
        setCreateStep(3)
      } else {
        setCreateResult({ ok: false, msg: data.error || 'Erro ao criar campanha' })
        showToast(data.error || 'Erro ao criar campanha', false)
      }
    } catch (e: any) {
      setCreateResult({ ok: false, msg: e.message || 'Erro de conexão' })
      showToast(e.message || 'Erro de conexão', false)
    } finally {
      setCreateLoading(false)
    }
  }

  /* ── Reset wizard ── */
  const resetWizard = () => {
    setSelectedCreative(null)
    setCreateStep(1)
    setCreateForm({ name: '', objective: 'OUTCOME_SALES', dailyBudget: '50', country: 'BR' })
    setCreateResult(null)
  }

  /* ── Derived ── */
  const totals = campaigns.reduce((a, c) => ({
    spend: a.spend + (c.spend || 0), revenue: a.revenue + (c.purchaseValue || 0),
    purchases: a.purchases + (c.purchases || 0), clicks: a.clicks + (c.clicks || 0),
    impressions: a.impressions + (c.impressions || 0), profit: a.profit + (c.profit || 0),
  }), { spend: 0, revenue: 0, purchases: 0, clicks: 0, impressions: 0, profit: 0 })

  const globalROAS   = totals.spend > 0 ? totals.revenue / totals.spend : 0
  const avgCTR       = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0
  const activeCamps  = campaigns.filter(c => c.status === 'ACTIVE')
  const pausedCamps  = campaigns.filter(c => c.status === 'PAUSED')
  const topCamps     = [...campaigns].sort((a, b) => b.roas - a.roas).filter(c => c.roas > 0)
  const topCreatives = [...creatives].sort((a, b) => b.roas - a.roas).filter(c => c.roas > 0)
  const filteredAds  = adsFilter === 'all' ? ads : ads.filter(a => a.status === adsFilter)

  /* ── Nav label helper ── */
  const navLabel = (v: string) => NAV_ITEMS.find(n => n.id === v)?.label ?? v

  /* ════════════════════════════════════════════════════════════ */
  return (
    <div className="flex min-h-screen" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* ══════════════════ SIDEBAR ══════════════════ */}
      <nav className="fixed left-0 top-0 h-full z-50 flex flex-col overflow-y-auto" style={{
        width: 232, background: 'rgba(6,8,16,0.9)',
        borderRight: '1px solid rgba(255,255,255,0.05)',
        backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
      }}>
        {/* Logo */}
        <div className="px-5 pt-6 pb-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm text-white flex-shrink-0"
              style={{ background: 'linear-gradient(135deg,#ff1744,#ff6b9d)', boxShadow: '0 0 20px rgba(255,23,68,0.35)' }}>M</div>
            <div>
              <div className="text-white font-semibold text-sm">MTX Command</div>
              <div className="text-white/30 text-[11px]">ROI Intelligence</div>
            </div>
          </div>
        </div>

        {/* ─── Client Profiles List ─── */}
        <div className="flex-shrink-0 px-3 mb-2">
          <div className="flex items-center justify-between px-2 mb-2">
            <span className="text-white/25 text-[10px] font-semibold uppercase tracking-widest">Clientes</span>
            <button onClick={() => { setView('settings'); cancelEdit() }}
              className="w-5 h-5 rounded-md flex items-center justify-center transition-all"
              style={{ color: 'rgba(255,255,255,0.3)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#ff1744'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,23,68,0.1)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.3)'; (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
              <Plus size={12} />
            </button>
          </div>

          {profiles.length === 0 ? (
            <button onClick={() => setView('settings')}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs transition-all"
              style={{ background: 'rgba(255,23,68,0.06)', border: '1px solid rgba(255,23,68,0.12)', color: 'rgba(255,23,68,0.7)' }}>
              <Plus size={11} /> Adicionar cliente
            </button>
          ) : (
            <div className="space-y-0.5">
              {profiles.map(p => {
                const isActive = p.id === activeId
                return (
                  <button key={p.id}
                    onClick={() => { setActiveId(p.id); if (view === 'settings') setView('dashboard') }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-all duration-150"
                    style={{
                      background: isActive ? 'rgba(255,23,68,0.1)' : 'transparent',
                      border: isActive ? '1px solid rgba(255,23,68,0.18)' : '1px solid transparent',
                    }}
                    onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)' }}
                    onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-[10px] font-black text-white"
                      style={{ background: isActive ? 'rgba(255,23,68,0.2)' : 'rgba(255,255,255,0.08)' }}>
                      {p.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <div className="truncate text-xs font-semibold"
                        style={{ color: isActive ? '#fff' : 'rgba(255,255,255,0.55)' }}>{p.name}</div>
                      <div className="text-white/25 text-[10px] truncate num">{p.accountId}</div>
                    </div>
                    {isActive && (
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ background: connected ? '#00e676' : '#ff9100', boxShadow: `0 0 5px ${connected ? '#00e676' : '#ff9100'}` }} />
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="mx-3 mb-3 flex-shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }} />

        {/* ─── Page Nav ─── */}
        <div className="flex-1 px-3 space-y-0.5 flex-shrink-0">
          {NAV_ITEMS.map(item => {
            const Icon     = item.icon
            const isActive = view === item.id
            const isHov    = hovNav === item.id && !isActive
            const isCreate = item.id === 'create'
            return (
              <button key={item.id}
                onClick={() => { setView(item.id); if (item.id === 'create') resetWizard() }}
                onMouseEnter={() => setHovNav(item.id)}
                onMouseLeave={() => setHovNav(null)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150"
                style={{
                  background: isActive ? (isCreate ? 'rgba(255,23,68,0.15)' : 'rgba(255,23,68,0.1)') : isHov ? 'rgba(255,255,255,0.04)' : 'transparent',
                  border: isActive ? (isCreate ? '1px solid rgba(255,23,68,0.3)' : '1px solid rgba(255,23,68,0.18)') : '1px solid transparent',
                  color: isActive ? '#ff1744' : isHov ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.38)',
                }}>
                <Icon size={16} strokeWidth={isActive ? 2.2 : 1.6} />
                <span className="font-medium">{item.label}</span>
                {isCreate && !isActive && <span className="ml-auto px-1.5 py-0.5 rounded text-[9px] font-bold" style={{ background: 'rgba(255,23,68,0.15)', color: '#ff6b9d' }}>NEW</span>}
                {isActive && <div className="ml-auto w-1 h-4 rounded-full" style={{ background: '#ff1744', boxShadow: '0 0 8px #ff1744' }} />}
              </button>
            )
          })}
        </div>

        {/* ─── Bottom ─── */}
        <div className="px-3 pb-5 pt-3 flex-shrink-0 space-y-0.5" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <button onClick={() => setView('settings')}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all"
            style={{
              background: view === 'settings' ? 'rgba(255,23,68,0.1)' : 'transparent',
              border: view === 'settings' ? '1px solid rgba(255,23,68,0.18)' : '1px solid transparent',
              color: view === 'settings' ? '#ff1744' : 'rgba(255,255,255,0.35)',
            }}>
            <Settings size={15} strokeWidth={1.6} />
            <span className="font-medium">Configurações</span>
          </button>
          <button
            onClick={async () => { await fetch('/api/auth', { method: 'DELETE' }); window.location.href = '/login' }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all"
            style={{ color: 'rgba(255,255,255,0.22)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#ff6b9d'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,23,68,0.06)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.22)'; (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
            <X size={14} strokeWidth={1.5} />
            <span>Sair</span>
          </button>
        </div>
      </nav>

      {/* ══════════════════ MAIN ══════════════════ */}
      <main className="flex-1 flex flex-col" style={{ marginLeft: 232 }}>

        {/* Header */}
        <header className="sticky top-0 z-40 flex items-center justify-between px-8 py-4"
          style={{ background: 'rgba(6,8,16,0.75)', borderBottom: '1px solid rgba(255,255,255,0.04)', backdropFilter: 'blur(20px)' }}>
          <div>
            <h1 className="text-white font-semibold text-base">
              {view === 'settings' ? 'Configurações'
               : view === 'create' ? 'Criar Campanha'
               : active ? active.name
               : (navLabel(view))}
            </h1>
            <p className="text-white/30 text-xs mt-0.5 num">
              {active && view !== 'settings'
                ? `${active.accountId} · ${dateRange === 'hoje' ? 'Hoje' : dateRange === 'ontem' ? 'Ontem' : `Últimos ${dateRange} dias`}`
                : 'Gerencie perfis e token de acesso'}
            </p>
          </div>
          {view !== 'settings' && view !== 'create' && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs"
                style={{ background: connected ? 'rgba(0,230,118,0.06)' : 'rgba(255,23,68,0.06)', border: `1px solid ${connected ? 'rgba(0,230,118,0.15)' : 'rgba(255,23,68,0.15)'}` }}>
                <span className="w-1.5 h-1.5 rounded-full"
                  style={{ background: connected ? '#00e676' : '#ff1744', boxShadow: `0 0 5px ${connected ? '#00e676' : '#ff1744'}` }} />
                <span style={{ color: connected ? '#00e676' : '#ff1744' }}>{connected ? 'Conectado' : 'Demo'}</span>
              </div>
              {view !== 'ads' && (
                <div className="flex items-center gap-1 rounded-xl p-0.5"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  {(['hoje', 'ontem', 7, 14, 30] as const).map(d => (
                    <button key={String(d)} onClick={() => setDateRange(d)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                      style={dateRange === d ? { background: 'rgba(255,23,68,0.15)', color: '#ff1744' } : { color: 'rgba(255,255,255,0.35)' }}>
                      {d === 'hoje' ? 'Hoje' : d === 'ontem' ? 'Ontem' : `${d}d`}
                    </button>
                  ))}
                </div>
              )}
              <button onClick={() => view === 'ads' ? fetchAds() : fetchData(true)} disabled={refreshing || loading || adsLoading}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}>
                <RefreshCw size={13} className={(refreshing || adsLoading) ? 'animate-spin' : ''} />
                Atualizar
              </button>
            </div>
          )}
        </header>

        {/* Content */}
        <div className="px-8 py-7 space-y-7 flex-1">

          {/* ─ Demo banner ─ */}
          {view !== 'settings' && view !== 'create' && !connected && !loading && (
            <div className="flex items-start gap-3 px-4 py-3 rounded-xl text-sm"
              style={{ background: 'rgba(255,145,0,0.06)', border: '1px solid rgba(255,145,0,0.18)' }}>
              <AlertTriangle size={14} style={{ color: '#ff9100', flexShrink: 0, marginTop: 1 }} />
              <span style={{ color: 'rgba(255,255,255,0.5)' }}>
                <span style={{ color: '#ff9100', fontWeight: 600 }}>Dados de demonstração</span>
                {apiError
                  ? <span style={{ color: '#ff6b9d' }}> · {apiError}</span>
                  : !token
                  ? ' · Configure seu Access Token em Configurações'
                  : !active
                  ? ' · Crie um perfil de cliente com o Account ID'
                  : ' · Verifique o token e o Account ID'}
                {' — '}
                <button onClick={() => setView('settings')} style={{ color: '#ff9100', textDecoration: 'underline' }}>
                  {!token ? 'Adicionar token' : !active ? 'Criar perfil' : 'Configurações'}
                </button>
              </span>
            </div>
          )}

          {/* ══════ SETTINGS ══════ */}
          {view === 'settings' && (
            <div className="max-w-2xl space-y-6">
              {/* Global Token */}
              <div className="glass rounded-2xl p-6" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: 'rgba(255,23,68,0.1)', border: '1px solid rgba(255,23,68,0.2)' }}>
                    <Key size={14} style={{ color: '#ff1744' }} />
                  </div>
                  <div>
                    <h2 className="text-white font-semibold text-sm">Access Token Global</h2>
                    <p className="text-white/30 text-xs">Um único token acessa todas as contas de anúncios</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <input value={tokenEdit} onChange={e => setTokenEdit(e.target.value)}
                    placeholder="EAAzKs9Wttn4B..."
                    type="password"
                    className="flex-1 px-3.5 py-2.5 rounded-xl text-sm outline-none num"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.85)' }}
                    onFocus={e => (e.target.style.borderColor = 'rgba(255,23,68,0.35)')}
                    onBlur={e  => (e.target.style.borderColor = 'rgba(255,255,255,0.08)')} />
                  <button onClick={() => {
                    localStorage.setItem('mtx_token', tokenEdit.trim())
                    setToken(tokenEdit.trim()); setTestResult(null); showToast('Token salvo!')
                  }}
                    className="px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-all flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg,#ff1744,#e53935)', boxShadow: '0 0 16px rgba(255,23,68,0.25)' }}>
                    Salvar
                  </button>
                  <button onClick={testConnection} disabled={testLoading}
                    className="px-4 py-2.5 rounded-xl text-sm font-semibold transition-all flex-shrink-0 flex items-center gap-1.5"
                    style={{ background: 'rgba(0,180,255,0.08)', border: '1px solid rgba(0,180,255,0.2)', color: '#00b4ff' }}>
                    {testLoading ? <><Loader2 size={13} className="animate-spin" /> Testando...</> : '⚡ Testar'}
                  </button>
                </div>
                {testResult && (
                  <div className="flex items-start gap-2 mt-3 px-3 py-2.5 rounded-xl text-xs"
                    style={{ background: testResult.ok ? 'rgba(0,230,118,0.08)' : 'rgba(255,23,68,0.08)', border: `1px solid ${testResult.ok ? 'rgba(0,230,118,0.2)' : 'rgba(255,23,68,0.2)'}`, color: testResult.ok ? '#00e676' : '#ff6b9d' }}>
                    {testResult.ok ? <Check size={12} className="mt-0.5 flex-shrink-0" /> : <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />}
                    <span className="num">{testResult.msg}</span>
                  </div>
                )}
                {!testResult && token && (
                  <div className="flex items-center gap-2 mt-3 text-xs" style={{ color: '#00e676' }}>
                    <Check size={12} /> Token configurado
                  </div>
                )}
              </div>

              {/* Profile form */}
              <div className="glass rounded-2xl p-6" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
                <h2 className="text-white font-semibold text-sm mb-5">
                  {editingId ? '✏️ Editar Perfil' : '+ Novo Perfil de Cliente'}
                </h2>
                <div className="space-y-3">
                  <div>
                    <label className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-1.5 block">Nome do Cliente</label>
                    <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="Ex: Anefran | MTX"
                      className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.85)' }}
                      onFocus={e => (e.target.style.borderColor = 'rgba(255,23,68,0.35)')}
                      onBlur={e  => (e.target.style.borderColor = 'rgba(255,255,255,0.08)')} />
                  </div>
                  <div>
                    <label className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-1.5 flex items-center justify-between">
                      <span>Ad Account ID</span>
                      <span className="text-white/20 normal-case tracking-normal font-normal">Gerenciador → Contas de Anúncio → ID</span>
                    </label>
                    <input value={form.accountId} onChange={e => setForm(f => ({ ...f, accountId: e.target.value }))}
                      placeholder="act_2387614768083418 (ou só o número)"
                      className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none num"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.85)' }}
                      onFocus={e => (e.target.style.borderColor = 'rgba(255,23,68,0.35)')}
                      onBlur={e  => (e.target.style.borderColor = 'rgba(255,255,255,0.08)')} />
                    <p className="text-white/20 text-[10px] mt-1">O prefixo <span className="num text-white/35">act_</span> é adicionado automaticamente</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {[{ key: 'pixelId', label: 'Pixel ID', ph: '1234567890' }, { key: 'pageId', label: 'Facebook Page ID', ph: '123456789012345' }].map(f => (
                      <div key={f.key}>
                        <label className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-1.5 block">{f.label}</label>
                        <input value={form[f.key as keyof typeof form]} onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                          placeholder={f.ph}
                          className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none num"
                          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.85)' }}
                          onFocus={e => (e.target.style.borderColor = 'rgba(255,23,68,0.35)')}
                          onBlur={e  => (e.target.style.borderColor = 'rgba(255,255,255,0.08)')} />
                      </div>
                    ))}
                  </div>
                  {formErr && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs"
                      style={{ background: 'rgba(255,23,68,0.08)', border: '1px solid rgba(255,23,68,0.18)', color: '#ff6b9d' }}>
                      <AlertTriangle size={11} /> {formErr}
                    </div>
                  )}
                  <div className="flex gap-2 pt-1">
                    <button onClick={saveProfile}
                      className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white"
                      style={{ background: 'linear-gradient(135deg,#ff1744,#e53935)', boxShadow: '0 0 16px rgba(255,23,68,0.2)' }}>
                      {editingId ? 'Salvar alterações' : 'Criar perfil'}
                    </button>
                    {editingId && (
                      <button onClick={cancelEdit}
                        className="px-4 py-2.5 rounded-xl text-sm font-medium"
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}>
                        Cancelar
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Profiles list */}
              {profiles.length > 0 && (
                <div className="glass rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
                  <div className="px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <h3 className="text-white font-semibold text-sm">Perfis Salvos</h3>
                    <p className="text-white/30 text-xs">{profiles.length} perfil(s)</p>
                  </div>
                  {profiles.map((p, i) => (
                    <div key={p.id}
                      className="flex items-center gap-4 px-6 py-4 transition-all"
                      style={{ borderTop: i === 0 ? 'none' : '1px solid rgba(255,255,255,0.04)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.015)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm text-white flex-shrink-0"
                        style={{ background: p.id === activeId ? 'rgba(255,23,68,0.2)' : 'rgba(255,255,255,0.06)' }}>
                        {p.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-white/80 text-sm font-medium">{p.name}</span>
                          {p.id === activeId && (
                            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold"
                              style={{ background: 'rgba(0,230,118,0.1)', color: '#00e676', border: '1px solid rgba(0,230,118,0.2)' }}>Ativo</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-white/30 text-[11px] num">{p.accountId}</span>
                          {p.pixelId && <span className="text-white/20 text-[10px] num">Pixel {p.pixelId}</span>}
                          {p.pageId  && <span className="text-white/20 text-[10px] num">Page {p.pageId}</span>}
                        </div>
                      </div>
                      <div className="flex gap-1.5 flex-shrink-0">
                        {p.id !== activeId && (
                          <button onClick={() => { setActiveId(p.id); showToast(`"${p.name}" ativado`) }}
                            className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium"
                            style={{ background: 'rgba(0,230,118,0.08)', border: '1px solid rgba(0,230,118,0.15)', color: '#00e676' }}>
                            Ativar
                          </button>
                        )}
                        <button onClick={() => startEdit(p)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center"
                          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)' }}
                          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = '#fff')}
                          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.4)')}>
                          <Edit3 size={12} />
                        </button>
                        <button onClick={() => deleteProfile(p.id)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center"
                          style={{ background: 'rgba(255,23,68,0.06)', border: '1px solid rgba(255,23,68,0.12)', color: 'rgba(255,23,68,0.5)' }}
                          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = '#ff1744')}
                          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,23,68,0.5)')}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ══════ KPIs ══════ */}
          {view !== 'settings' && view !== 'ads' && view !== 'create' && (
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: 'ROAS Global', sub: 'Retorno sobre gasto',           value: fmtROAS(globalROAS),                 color: roasCol(globalROAS), icon: TrendingUp,    glow: globalROAS >= 2 ? '#00e676' : globalROAS >= 1 ? '#ff9100' : '#ff1744' },
                { label: 'Receita',     sub: `Gasto: ${fmtBRL(totals.spend)}`, value: fmtBRL(totals.revenue),             color: '#00b4ff',           icon: DollarSign,    glow: '#00b4ff' },
                { label: 'Compras',     sub: `Lucro: ${fmtBRL(totals.profit)}`, value: String(Math.round(totals.purchases)), color: '#ff9100',         icon: Target,        glow: '#ff9100' },
                { label: 'CTR Médio',   sub: `${activeCamps.length} ativas`,   value: fmtPct(avgCTR),                     color: '#c77dff',           icon: MousePointer2, glow: '#c77dff' },
              ].map((kpi, i) => {
                const Icon = kpi.icon
                return (
                  <div key={i} className="glass rounded-2xl p-5 relative overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(ellipse 80% 60% at 100% 0%, ${kpi.glow}0f 0%, transparent 70%)` }} />
                    <div className="flex items-start justify-between mb-4 relative">
                      <span className="text-white/40 text-[11px] font-semibold uppercase tracking-widest">{kpi.label}</span>
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${kpi.glow}14`, border: `1px solid ${kpi.glow}20` }}>
                        <Icon size={15} style={{ color: kpi.glow }} />
                      </div>
                    </div>
                    {loading
                      ? <div className="h-9 w-28 rounded-lg animate-pulse" style={{ background: 'rgba(255,255,255,0.06)' }} />
                      : <div className="text-[2rem] font-bold tracking-tight leading-none num relative" style={{ color: kpi.color, textShadow: `0 0 32px ${kpi.glow}50` }}>{kpi.value}</div>
                    }
                    <div className="text-white/30 text-xs mt-2 num">{kpi.sub}</div>
                  </div>
                )
              })}
            </div>
          )}

          {/* ══════ CAMPAIGNS ══════ */}
          {(view === 'dashboard' || view === 'campaigns') && (
            <div className="glass rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <div>
                  <h2 className="text-white font-semibold text-sm">Campanhas</h2>
                  <p className="text-white/30 text-xs mt-0.5">Controle em tempo real · Meta Ads</p>
                </div>
                <div className="flex gap-2">
                  {[{ l: `${activeCamps.length} ativas`, c: '#00e676' }, { l: `${pausedCamps.length} pausadas`, c: '#ff9100' }].map((b, i) => (
                    <span key={i} className="px-2.5 py-1 rounded-lg text-[11px] font-medium num"
                      style={{ background: `${b.c}10`, color: b.c, border: `1px solid ${b.c}20` }}>{b.l}</span>
                  ))}
                </div>
              </div>
              {loading ? (
                <div className="py-14 flex flex-col items-center gap-3">
                  <Loader2 size={22} className="animate-spin" style={{ color: '#ff1744' }} />
                  <span className="text-white/30 text-sm">Carregando campanhas...</span>
                </div>
              ) : (
                <div>
                  <div className="grid px-6 py-2 text-[10px] font-semibold uppercase tracking-widest text-white/20"
                    style={{ gridTemplateColumns: '14px 1fr 80px 90px 70px 70px 260px', gap: 12 }}>
                    <span /><span>Campanha</span><span className="text-right">ROAS</span><span className="text-right">Gasto</span><span className="text-right">Compras</span><span className="text-right">CTR</span><span className="text-right">Ações</span>
                  </div>
                  {campaigns.map((c, idx) => {
                    const isPaused = c.status === 'PAUSED'; const scale = scales[c.id] || 20
                    return (
                      <div key={c.id} className="grid px-6 py-3.5 items-center transition-all"
                        style={{ gridTemplateColumns: '14px 1fr 80px 90px 70px 70px 260px', gap: 12, borderTop: idx === 0 ? 'none' : '1px solid rgba(255,255,255,0.04)' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.015)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <span className="w-1.5 h-1.5 rounded-full block mx-auto"
                          style={{ background: isPaused ? '#ff9100' : '#00e676', boxShadow: !isPaused ? '0 0 6px #00e676' : 'none' }} />
                        <div className="min-w-0">
                          <div className="text-white/80 text-sm font-medium truncate">{c.name}</div>
                          <div className="text-white/25 text-[11px] num mt-0.5">{c.dailyBudget ? `R$ ${c.dailyBudget.toFixed(2)}/dia` : c.lifetimeBudget ? `R$ ${c.lifetimeBudget.toFixed(2)} vitalício` : 'Sem budget'}</div>
                        </div>
                        <div className="text-right"><div className="text-sm font-bold num" style={{ color: roasCol(c.roas) }}>{fmtROAS(c.roas)}</div><div className="text-white/20 text-[10px]">ROAS</div></div>
                        <div className="text-right"><div className="text-sm text-white/70 num">{fmtBRL(c.spend)}</div><div className="text-white/20 text-[10px]">Gasto</div></div>
                        <div className="text-right"><div className="text-sm text-white/70 num">{Math.round(c.purchases)}</div><div className="text-white/20 text-[10px]">Compras</div></div>
                        <div className="text-right"><div className="text-sm text-white/70 num">{fmtPct(c.ctr)}</div><div className="text-white/20 text-[10px]">CTR</div></div>
                        <div className="flex items-center justify-end gap-1.5">
                          {!isPaused && (
                            <><select value={scale} onChange={e => setScales(p => ({ ...p, [c.id]: +e.target.value }))}
                                className="text-[11px] rounded-lg px-2 py-1.5 outline-none num"
                                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}>
                                {SCALE_OPTIONS.map(o => <option key={o} value={o}>+{o}%</option>)}
                              </select>
                              <button onClick={() => doAction('scale', c.id, { percentage: scale })} disabled={isAct('scale', c.id)}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold"
                                style={{ background: 'rgba(0,230,118,0.09)', border: '1px solid rgba(0,230,118,0.18)', color: '#00e676' }}>
                                {isAct('scale', c.id) ? <Loader2 size={10} className="animate-spin" /> : <TrendingUp size={10} />} Escalar
                              </button></>
                          )}
                          <button onClick={() => doAction('duplicate', c.id)} disabled={isAct('duplicate', c.id)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold"
                            style={{ background: 'rgba(0,180,255,0.08)', border: '1px solid rgba(0,180,255,0.16)', color: '#00b4ff' }}>
                            {isAct('duplicate', c.id) ? <Loader2 size={10} className="animate-spin" /> : <Copy size={10} />} Dup.
                          </button>
                          <button onClick={() => doAction(isPaused ? 'activate' : 'pause', c.id)}
                            disabled={isAct('pause', c.id) || isAct('activate', c.id)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold"
                            style={isPaused ? { background: 'rgba(0,230,118,0.08)', border: '1px solid rgba(0,230,118,0.16)', color: '#00e676' } : { background: 'rgba(255,145,0,0.08)', border: '1px solid rgba(255,145,0,0.16)', color: '#ff9100' }}>
                            {isPaused ? <Play size={10} /> : <Pause size={10} />} {isPaused ? 'Ativar' : 'Pausar'}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ══════ ADS VIEW ══════ */}
          {view === 'ads' && (
            <div className="space-y-5">
              {/* Filter bar */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 rounded-xl p-0.5"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  {([['all', 'Todos'], ['ACTIVE', 'Ativos'], ['PAUSED', 'Pausados']] as const).map(([val, lbl]) => (
                    <button key={val} onClick={() => setAdsFilter(val)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                      style={adsFilter === val ? { background: 'rgba(255,23,68,0.15)', color: '#ff1744' } : { color: 'rgba(255,255,255,0.35)' }}>
                      {lbl}
                    </button>
                  ))}
                </div>
                <span className="text-white/25 text-xs num">{filteredAds.length} anúncio(s)</span>
              </div>

              {/* Grid */}
              {adsLoading ? (
                <div className="py-20 flex flex-col items-center gap-3">
                  <Loader2 size={24} className="animate-spin" style={{ color: '#ff1744' }} />
                  <span className="text-white/30 text-sm">Carregando anúncios...</span>
                </div>
              ) : !active || !token ? (
                <div className="py-20 flex flex-col items-center gap-3">
                  <Image size={32} style={{ color: 'rgba(255,255,255,0.1)' }} />
                  <span className="text-white/30 text-sm">Configure o token e um perfil para ver os anúncios</span>
                  <button onClick={() => setView('settings')} className="px-4 py-2 rounded-xl text-sm font-semibold"
                    style={{ background: 'rgba(255,23,68,0.1)', border: '1px solid rgba(255,23,68,0.2)', color: '#ff1744' }}>
                    Ir para Configurações
                  </button>
                </div>
              ) : filteredAds.length === 0 ? (
                <div className="py-20 flex flex-col items-center gap-3">
                  <Image size={32} style={{ color: 'rgba(255,255,255,0.1)' }} />
                  <span className="text-white/30 text-sm">Nenhum anúncio encontrado</span>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-4">
                  {filteredAds.map(ad => {
                    const isPaused   = ad.status === 'PAUSED'
                    const isPauseAct = actLoad[`pause_ad-${ad.id}`]
                    const isActAct   = actLoad[`activate_ad-${ad.id}`]
                    return (
                      <div key={ad.id} className="glass rounded-2xl overflow-hidden transition-all"
                        style={{ border: '1px solid rgba(255,255,255,0.06)' }}
                        onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)')}
                        onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)')}>

                        {/* Thumbnail */}
                        <div className="w-full h-36 flex items-center justify-center relative overflow-hidden"
                          style={{ background: 'rgba(255,255,255,0.03)' }}>
                          {ad.creative?.thumbnailUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={ad.creative.thumbnailUrl} alt={ad.name}
                              className="w-full h-full object-cover" />
                          ) : (
                            <Image size={28} style={{ color: 'rgba(255,255,255,0.12)' }} />
                          )}
                          {/* Status badge overlay */}
                          <div className="absolute top-2 right-2">
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold"
                              style={isPaused
                                ? { background: 'rgba(255,145,0,0.2)', color: '#ff9100', border: '1px solid rgba(255,145,0,0.3)' }
                                : { background: 'rgba(0,230,118,0.2)', color: '#00e676', border: '1px solid rgba(0,230,118,0.3)' }}>
                              {isPaused ? '⏸ Pausado' : '▶ Ativo'}
                            </span>
                          </div>
                        </div>

                        {/* Content */}
                        <div className="p-4 space-y-3">
                          <div className="text-white/80 text-sm font-medium line-clamp-2 leading-snug">{ad.name}</div>

                          {/* Metrics */}
                          <div className="grid grid-cols-3 gap-1.5">
                            {[
                              { l: 'ROAS',     v: fmtROAS(ad.roas),      c: roasCol(ad.roas) },
                              { l: 'CTR',      v: fmtPct(ad.ctr),        c: 'rgba(255,255,255,0.6)' },
                              { l: 'Compras',  v: String(Math.round(ad.purchases)), c: 'rgba(255,255,255,0.6)' },
                            ].map((m, mi) => (
                              <div key={mi} className="text-center py-2 rounded-xl"
                                style={{ background: 'rgba(255,255,255,0.025)' }}>
                                <div className="text-sm font-bold num" style={{ color: m.c }}>{m.v}</div>
                                <div className="text-white/25 text-[10px]">{m.l}</div>
                              </div>
                            ))}
                          </div>

                          {/* Actions */}
                          <div className="flex gap-2">
                            <button
                              onClick={() => doAdAction(isPaused ? 'activate_ad' : 'pause_ad', ad.id)}
                              disabled={isPauseAct || isActAct}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-semibold transition-all"
                              style={isPaused
                                ? { background: 'rgba(0,230,118,0.08)', border: '1px solid rgba(0,230,118,0.16)', color: '#00e676' }
                                : { background: 'rgba(255,145,0,0.08)', border: '1px solid rgba(255,145,0,0.16)', color: '#ff9100' }}>
                              {(isPauseAct || isActAct) ? <Loader2 size={10} className="animate-spin" /> : (isPaused ? <Play size={10} /> : <Pause size={10} />)}
                              {isPaused ? 'Ativar' : 'Pausar'}
                            </button>
                            <button
                              onClick={() => {
                                setSelectedCreative(ad)
                                setCreateStep(2)
                                setView('create')
                              }}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-semibold transition-all"
                              style={{ background: 'rgba(255,23,68,0.08)', border: '1px solid rgba(255,23,68,0.16)', color: '#ff6b9d' }}>
                              <Rocket size={10} /> Usar em campanha
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ══════ CREATE WIZARD ══════ */}
          {view === 'create' && (
            <div className="max-w-2xl space-y-6">

              {/* Step indicator */}
              <div className="flex items-center gap-3">
                {([
                  [1, 'Selecionar Criativo'],
                  [2, 'Configurar'],
                  [3, 'Lançar'],
                ] as const).map(([n, lbl]) => (
                  <div key={n} className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold transition-all"
                      style={createStep >= n
                        ? { background: '#ff1744', color: '#fff', boxShadow: '0 0 10px rgba(255,23,68,0.35)' }
                        : { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.3)' }}>
                      {createResult?.ok && n === 3 ? <Check size={12} /> : n}
                    </div>
                    <span className="text-xs" style={{ color: createStep >= n ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.25)' }}>{lbl}</span>
                    {n < 3 && <div className="w-8 h-px" style={{ background: createStep > n ? '#ff1744' : 'rgba(255,255,255,0.08)' }} />}
                  </div>
                ))}
              </div>

              {/* ── Step 1: Select creative ── */}
              {createStep === 1 && (
                <div className="space-y-4">
                  <div>
                    <h2 className="text-white font-semibold text-sm">Selecionar Criativo</h2>
                    <p className="text-white/30 text-xs mt-1">Escolha um anúncio existente para usar como criativo da nova campanha</p>
                  </div>

                  {adsLoading ? (
                    <div className="py-16 flex flex-col items-center gap-3">
                      <Loader2 size={22} className="animate-spin" style={{ color: '#ff1744' }} />
                      <span className="text-white/30 text-sm">Carregando criativos...</span>
                    </div>
                  ) : !active || !token ? (
                    <div className="py-16 text-center">
                      <span className="text-white/30 text-sm">Configure o token e um perfil para carregar os criativos</span>
                    </div>
                  ) : ads.length === 0 ? (
                    <div className="py-16 text-center">
                      <span className="text-white/30 text-sm">Nenhum anúncio encontrado na conta</span>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-3 max-h-[480px] overflow-y-auto pr-1">
                        {ads.filter(a => a.creative?.id).map(ad => {
                          const isSel = selectedCreative?.id === ad.id
                          return (
                            <button key={ad.id} onClick={() => setSelectedCreative(ad)}
                              className="text-left glass rounded-xl overflow-hidden transition-all"
                              style={{ border: isSel ? '1px solid rgba(255,23,68,0.5)' : '1px solid rgba(255,255,255,0.06)', background: isSel ? 'rgba(255,23,68,0.06)' : undefined }}>
                              <div className="w-full h-28 flex items-center justify-center overflow-hidden"
                                style={{ background: 'rgba(255,255,255,0.03)' }}>
                                {ad.creative?.thumbnailUrl
                                  // eslint-disable-next-line @next/next/no-img-element
                                  ? <img src={ad.creative.thumbnailUrl} alt={ad.name} className="w-full h-full object-cover" />
                                  : <Image size={24} style={{ color: 'rgba(255,255,255,0.1)' }} />}
                              </div>
                              <div className="px-3 py-2.5 flex items-start justify-between gap-2">
                                <span className="text-white/70 text-xs font-medium line-clamp-2 flex-1">{ad.name}</span>
                                {isSel && <Check size={14} style={{ color: '#ff1744', flexShrink: 0 }} />}
                              </div>
                            </button>
                          )
                        })}
                      </div>
                      <button
                        onClick={() => setCreateStep(2)}
                        disabled={!selectedCreative}
                        className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all"
                        style={selectedCreative
                          ? { background: 'linear-gradient(135deg,#ff1744,#e53935)', boxShadow: '0 0 20px rgba(255,23,68,0.3)' }
                          : { background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.25)', cursor: 'not-allowed' }}>
                        Próximo →
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* ── Step 2: Configure ── */}
              {createStep === 2 && (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-white font-semibold text-sm">Configurar Campanha</h2>
                    <p className="text-white/30 text-xs mt-1">Defina os parâmetros da nova campanha</p>
                  </div>

                  {/* Selected creative preview */}
                  {selectedCreative && (
                    <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
                      style={{ background: 'rgba(255,23,68,0.04)', border: '1px solid rgba(255,23,68,0.12)' }}>
                      <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center"
                        style={{ background: 'rgba(255,255,255,0.05)' }}>
                        {selectedCreative.creative?.thumbnailUrl
                          // eslint-disable-next-line @next/next/no-img-element
                          ? <img src={selectedCreative.creative.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                          : <Image size={18} style={{ color: 'rgba(255,255,255,0.2)' }} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-white/70 text-xs font-medium truncate">{selectedCreative.name}</div>
                        <div className="text-white/30 text-[10px] num mt-0.5">ID: {selectedCreative.creative?.id}</div>
                      </div>
                      <button onClick={() => setCreateStep(1)} className="text-[11px]" style={{ color: 'rgba(255,23,68,0.6)' }}>Trocar</button>
                    </div>
                  )}

                  {/* Form */}
                  <div className="space-y-4">
                    {/* Name */}
                    <div>
                      <label className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-1.5 block">Nome da Campanha</label>
                      <input
                        value={createForm.name}
                        onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
                        placeholder="Ex: VSL Verão 2025 – Oferta Principal"
                        className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none"
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.85)' }}
                        onFocus={e => (e.target.style.borderColor = 'rgba(255,23,68,0.35)')}
                        onBlur={e  => (e.target.style.borderColor = 'rgba(255,255,255,0.08)')} />
                    </div>

                    {/* Objective + Country */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-1.5 block">Objetivo</label>
                        <select
                          value={createForm.objective}
                          onChange={e => setCreateForm(f => ({ ...f, objective: e.target.value }))}
                          className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none"
                          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.75)' }}>
                          {OBJECTIVES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-1.5 block">País Alvo</label>
                        <select
                          value={createForm.country}
                          onChange={e => setCreateForm(f => ({ ...f, country: e.target.value }))}
                          className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none"
                          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.75)' }}>
                          {COUNTRIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                        </select>
                      </div>
                    </div>

                    {/* Budget */}
                    <div>
                      <label className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-1.5 block">Orçamento Diário (R$)</label>
                      <input
                        type="number" min="1"
                        value={createForm.dailyBudget}
                        onChange={e => setCreateForm(f => ({ ...f, dailyBudget: e.target.value }))}
                        placeholder="50"
                        className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none num"
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.85)' }}
                        onFocus={e => (e.target.style.borderColor = 'rgba(255,23,68,0.35)')}
                        onBlur={e  => (e.target.style.borderColor = 'rgba(255,255,255,0.08)')} />
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button onClick={() => setCreateStep(1)}
                      className="px-5 py-2.5 rounded-xl text-sm font-medium"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}>
                      ← Voltar
                    </button>
                    <button
                      onClick={() => setCreateStep(3)}
                      disabled={!createForm.name.trim() || !createForm.dailyBudget}
                      className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-all"
                      style={createForm.name.trim() && createForm.dailyBudget
                        ? { background: 'linear-gradient(135deg,#ff1744,#e53935)', boxShadow: '0 0 20px rgba(255,23,68,0.3)' }
                        : { background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.25)', cursor: 'not-allowed' }}>
                      Revisar →
                    </button>
                  </div>
                </div>
              )}

              {/* ── Step 3: Confirm & Launch ── */}
              {createStep === 3 && (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-white font-semibold text-sm">Confirmar e Lançar</h2>
                    <p className="text-white/30 text-xs mt-1">Revise os detalhes antes de criar a campanha</p>
                  </div>

                  {/* Success result */}
                  {createResult?.ok ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-3 px-5 py-4 rounded-2xl"
                        style={{ background: 'rgba(0,230,118,0.06)', border: '1px solid rgba(0,230,118,0.2)' }}>
                        <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ background: 'rgba(0,230,118,0.15)' }}>
                          <Check size={18} style={{ color: '#00e676' }} />
                        </div>
                        <div>
                          <div className="text-white font-semibold text-sm">🚀 Campanha criada com sucesso!</div>
                          <div className="text-white/40 text-xs mt-0.5">{createResult.msg}</div>
                        </div>
                      </div>
                      <div className="glass rounded-2xl p-4 space-y-2" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
                        {[
                          ['Campaign ID', createResult.campaignId],
                          ['Ad Set ID',   createResult.adsetId],
                          ['Ad ID',       createResult.adId],
                        ].map(([lbl, val]) => val && (
                          <div key={lbl} className="flex items-center justify-between">
                            <span className="text-white/30 text-xs">{lbl}</span>
                            <span className="text-white/60 text-xs num font-mono">{val}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <button onClick={resetWizard}
                          className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                          style={{ background: 'rgba(255,23,68,0.08)', border: '1px solid rgba(255,23,68,0.18)', color: '#ff6b9d' }}>
                          + Criar outra
                        </button>
                        <button onClick={() => setView('campaigns')}
                          className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white"
                          style={{ background: 'linear-gradient(135deg,#ff1744,#e53935)' }}>
                          Ver Campanhas →
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Summary */}
                      <div className="glass rounded-2xl p-5 space-y-3" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
                        {[
                          ['Criativo',  selectedCreative?.name ?? '—'],
                          ['ID Criativo', selectedCreative?.creative?.id ?? '—'],
                          ['Nome',      createForm.name || '—'],
                          ['Objetivo',  OBJECTIVES.find(o => o.value === createForm.objective)?.label ?? '—'],
                          ['Orçamento', `R$ ${createForm.dailyBudget}/dia`],
                          ['País',      COUNTRIES.find(c => c.value === createForm.country)?.label ?? '—'],
                          ['Otimização', (() => {
                          if (createForm.objective === 'OUTCOME_SALES')
                            return active?.pixelId ? 'OFFSITE_CONVERSIONS (Pixel ✓)' : 'LINK_CLICKS (sem Pixel)'
                          if (createForm.objective === 'OUTCOME_TRAFFIC')   return 'LINK_CLICKS'
                          if (createForm.objective === 'OUTCOME_AWARENESS') return 'REACH'
                          if (createForm.objective === 'OUTCOME_LEADS')     return 'LEAD_GENERATION'
                          return '—'
                        })()],
                        ['Status',    'PAUSED (edite no Gerenciador)'],
                        ].map(([lbl, val]) => (
                          <div key={lbl} className="flex items-start justify-between gap-4">
                            <span className="text-white/30 text-xs flex-shrink-0">{lbl}</span>
                            <span className="text-white/70 text-xs text-right num">{val}</span>
                          </div>
                        ))}
                      </div>

                      {createResult && !createResult.ok && (
                        <div className="flex items-start gap-2 px-4 py-3 rounded-xl text-xs"
                          style={{ background: 'rgba(255,23,68,0.08)', border: '1px solid rgba(255,23,68,0.2)', color: '#ff6b9d' }}>
                          <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
                          {createResult.msg}
                        </div>
                      )}

                      <div className="flex gap-2">
                        <button onClick={() => setCreateStep(2)}
                          className="px-5 py-2.5 rounded-xl text-sm font-medium"
                          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}>
                          ← Editar
                        </button>
                        <button
                          onClick={launchCampaign}
                          disabled={createLoading || !active || !token || !selectedCreative?.creative?.id}
                          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white transition-all"
                          style={active && token && selectedCreative?.creative?.id
                            ? { background: 'linear-gradient(135deg,#ff1744,#e53935)', boxShadow: '0 0 24px rgba(255,23,68,0.35)' }
                            : { background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.25)', cursor: 'not-allowed' }}>
                          {createLoading ? <><Loader2 size={14} className="animate-spin" /> Criando...</> : <><Rocket size={14} /> Lançar Campanha</>}
                        </button>
                      </div>
                      {(!active || !token) && (
                        <p className="text-center text-xs" style={{ color: '#ff9100' }}>
                          ⚠️ Configure o token e um perfil para lançar campanhas reais
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ══════ CREATIVES ══════ */}
          {(view === 'dashboard' || view === 'creatives') && (
            <div>
              <div className="mb-4"><h2 className="text-white font-semibold text-sm">Criativos Campeões</h2><p className="text-white/30 text-xs mt-0.5">Top performers · ROAS</p></div>
              <div className="grid grid-cols-3 gap-4">
                {(topCreatives.length > 0 ? topCreatives : DEMO_CR).slice(0, 3).map((cr, i) => (
                  <div key={i} className="glass glass-hover rounded-2xl p-5 relative overflow-hidden"
                    style={{ border: i === 0 ? '1px solid rgba(0,230,118,0.2)' : '1px solid rgba(255,255,255,0.06)' }}>
                    {i === 0 && <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at top left, rgba(0,230,118,0.06), transparent 65%)' }} />}
                    <div className="flex items-center justify-between mb-4 relative">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-black" style={{ color: i === 0 ? '#00e676' : i === 1 ? '#00b4ff' : 'rgba(255,255,255,0.25)' }}>#{i + 1}</span>
                        {i === 0 && <Star size={13} fill="#00e676" style={{ color: '#00e676' }} />}
                      </div>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold"
                        style={i === 0 ? { background: 'rgba(0,230,118,0.1)', color: '#00e676', border: '1px solid rgba(0,230,118,0.2)' } : { background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.08)' }}>
                        {i === 0 ? '★ Winner' : `Top ${i + 1}`}
                      </span>
                    </div>
                    <div className="text-white/75 text-sm font-medium mb-4 line-clamp-2 relative">{cr.adName}</div>
                    <div className="grid grid-cols-3 gap-2 relative">
                      {[{ l: 'ROAS', v: fmtROAS(cr.roas), c: roasCol(cr.roas) }, { l: 'CTR', v: fmtPct(cr.ctr), c: 'rgba(255,255,255,0.7)' }, { l: 'Compras', v: String(Math.round(cr.purchases)), c: 'rgba(255,255,255,0.7)' }].map((s, si) => (
                        <div key={si} className="text-center">
                          <div className="text-base font-bold num" style={{ color: s.c }}>{s.v}</div>
                          <div className="text-white/25 text-[10px]">{s.l}</div>
                        </div>
                      ))}
                    </div>
                    {i === 0 && <button className="w-full mt-4 py-2 rounded-xl text-[11px] font-semibold relative" style={{ background: 'rgba(0,230,118,0.1)', border: '1px solid rgba(0,230,118,0.22)', color: '#00e676' }}>★ Escalar criativo vencedor</button>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ══════ OPTIMIZE ══════ */}
          {view === 'optimize' && (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-4">
                {[
                  { label: 'Para Escalar', desc: 'ROAS ≥ 3x', color: '#00e676', count: activeCamps.filter(c => c.roas >= 3).length },
                  { label: 'Alto CPA',     desc: 'CPA alto',  color: '#ff9100', count: activeCamps.filter(c => c.cpa > 100).length },
                  { label: 'Sem Retorno',  desc: 'ROAS < 1x', color: '#ff1744', count: activeCamps.filter(c => c.roas < 1).length },
                  { label: 'Campeões',     desc: 'Top',       color: '#00b4ff', count: topCamps.length },
                ].map((s, i) => (
                  <div key={i} className="glass rounded-2xl p-5 relative overflow-hidden" style={{ border: `1px solid ${s.color}18` }}>
                    <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(ellipse at bottom right, ${s.color}08, transparent 70%)` }} />
                    <div className="text-3xl font-black num relative" style={{ color: s.color }}>{s.count}</div>
                    <div className="text-white/60 text-xs font-medium mt-1 relative">{s.label}</div>
                    <div className="text-white/25 text-[10px] relative">{s.desc}</div>
                  </div>
                ))}
              </div>
              <div className="glass rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="px-6 py-4 flex items-center gap-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,23,68,0.1)', border: '1px solid rgba(255,23,68,0.18)' }}>
                    <Zap size={16} style={{ color: '#ff1744' }} />
                  </div>
                  <div>
                    <h2 className="text-white font-semibold text-sm">Ações de Otimização</h2>
                    <p className="text-white/30 text-xs">Últimos {dateRange} dias</p>
                  </div>
                </div>
                {[
                  { icon: Flame,       label: 'Pausar ineficientes',          desc: `${activeCamps.filter(c => c.roas < 1).length} com ROAS < 1x`, color: '#ff1744', action: () => activeCamps.filter(c => c.roas < 1).forEach(c => doAction('pause', c.id)) },
                  { icon: TrendingUp,  label: 'Escalar vencedores +20%',      desc: `${activeCamps.filter(c => c.roas >= 3).length} com ROAS ≥ 3x`, color: '#00e676', action: () => activeCamps.filter(c => c.roas >= 3).forEach(c => doAction('scale', c.id, { percentage: 20 })) },
                  { icon: Copy,        label: 'Duplicar top 3',               desc: 'Criar cópias para A/B',                                        color: '#00b4ff', action: () => topCamps.slice(0, 3).forEach(c => doAction('duplicate', c.id)) },
                  { icon: ShieldCheck, label: 'Ativar pausadas com histórico', desc: `${pausedCamps.filter(c => c.roas >= 2).length} elegíveis`,     color: '#c77dff', action: () => pausedCamps.filter(c => c.roas >= 2).forEach(c => doAction('activate', c.id)) },
                ].map((a, i) => {
                  const Icon = a.icon
                  return (
                    <div key={i} className="flex items-center justify-between px-6 py-4 transition-all"
                      style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.015)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <div className="flex items-center gap-4">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${a.color}10`, border: `1px solid ${a.color}18` }}>
                          <Icon size={16} style={{ color: a.color }} />
                        </div>
                        <div>
                          <div className="text-white/80 text-sm font-medium">{a.label}</div>
                          <div className="text-white/30 text-xs num mt-0.5">{a.desc}</div>
                        </div>
                      </div>
                      <button onClick={a.action}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold flex-shrink-0 ml-6 transition-all"
                        style={{ background: `${a.color}12`, border: `1px solid ${a.color}22`, color: a.color }}
                        onMouseEnter={e => (e.currentTarget.style.background = `${a.color}22`)}
                        onMouseLeave={e => (e.currentTarget.style.background = `${a.color}12`)}>
                        <Zap size={11} /> Executar
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

        </div>
      </main>

      {/* ══ TOAST ══ */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[200] flex items-center gap-3 px-5 py-3 rounded-2xl text-sm font-medium"
          style={{
            background: toast.ok ? 'rgba(0,230,118,0.12)' : 'rgba(255,23,68,0.12)',
            border: `1px solid ${toast.ok ? 'rgba(0,230,118,0.3)' : 'rgba(255,23,68,0.3)'}`,
            color: toast.ok ? '#00e676' : '#ff1744',
            backdropFilter: 'blur(16px)',
          }}>
          {toast.ok ? <ShieldCheck size={16} /> : <AlertTriangle size={16} />}
          {toast.msg}
        </div>
      )}
    </div>
  )
}
