'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Mail, Lock, Loader2, AlertCircle, Eye, EyeOff } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPwd,  setShowPwd]  = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) { setError('Preencha todos os campos'); return }
    setLoading(true); setError(null)

    try {
      const res = await fetch('/api/auth', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, password }),
      })

      if (res.ok) {
        router.replace('/')
        router.refresh()
      } else {
        const d = await res.json()
        setError(d.error || 'Erro ao fazer login')
      }
    } catch {
      setError('Erro de conexão')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
    >
      {/* Background glows */}
      <div className="fixed inset-0 pointer-events-none" style={{
        background: `
          radial-gradient(ellipse 70% 50% at 50% 0%, rgba(255,23,68,0.07) 0%, transparent 60%),
          radial-gradient(ellipse 50% 40% at 80% 80%, rgba(0,180,255,0.04) 0%, transparent 50%)
        `
      }} />

      <div className="w-full max-w-sm relative z-10">

        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl text-white mb-4"
            style={{
              background: 'linear-gradient(135deg, #ff1744, #ff6b9d)',
              boxShadow: '0 0 40px rgba(255,23,68,0.35), 0 0 80px rgba(255,23,68,0.12)',
            }}
          >
            M
          </div>
          <h1 className="text-white font-bold text-xl tracking-tight">MTX Command Center</h1>
          <p className="text-white/35 text-sm mt-1">ROI Intelligence · Meta Ads</p>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl p-8"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
          }}
        >
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Email */}
            <div>
              <label className="block text-white/45 text-xs font-semibold uppercase tracking-wider mb-2">
                E-mail
              </label>
              <div className="relative">
                <Mail
                  size={15}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  style={{ color: 'rgba(255,255,255,0.25)' }}
                />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  autoComplete="email"
                  className="w-full pl-10 pr-4 py-3 rounded-xl text-sm outline-none transition-all"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.09)',
                    color: 'rgba(255,255,255,0.85)',
                  }}
                  onFocus={e => (e.target.style.borderColor = 'rgba(255,23,68,0.4)')}
                  onBlur={e  => (e.target.style.borderColor = 'rgba(255,255,255,0.09)')}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-white/45 text-xs font-semibold uppercase tracking-wider mb-2">
                Senha
              </label>
              <div className="relative">
                <Lock
                  size={15}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  style={{ color: 'rgba(255,255,255,0.25)' }}
                />
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••••"
                  autoComplete="current-password"
                  className="w-full pl-10 pr-11 py-3 rounded-xl text-sm outline-none transition-all"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.09)',
                    color: 'rgba(255,255,255,0.85)',
                  }}
                  onFocus={e => (e.target.style.borderColor = 'rgba(255,23,68,0.4)')}
                  onBlur={e  => (e.target.style.borderColor = 'rgba(255,255,255,0.09)')}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: 'rgba(255,255,255,0.25)' }}
                  onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.6)')}
                  onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.25)')}
                >
                  {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div
                className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm"
                style={{
                  background: 'rgba(255,23,68,0.08)',
                  border: '1px solid rgba(255,23,68,0.2)',
                  color: '#ff6b9d',
                }}
              >
                <AlertCircle size={14} style={{ flexShrink: 0 }} />
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all mt-2 flex items-center justify-center gap-2"
              style={{
                background: loading
                  ? 'rgba(255,23,68,0.5)'
                  : 'linear-gradient(135deg, #ff1744, #e53935)',
                boxShadow: loading ? 'none' : '0 0 28px rgba(255,23,68,0.3)',
              }}
              onMouseEnter={e => { if (!loading) (e.currentTarget.style.boxShadow = '0 0 40px rgba(255,23,68,0.5)') }}
              onMouseLeave={e => { if (!loading) (e.currentTarget.style.boxShadow = '0 0 28px rgba(255,23,68,0.3)') }}
            >
              {loading
                ? <><Loader2 size={16} className="animate-spin" /> Entrando...</>
                : 'Entrar →'
              }
            </button>
          </form>
        </div>

        <p className="text-white/15 text-xs text-center mt-6">
          Acesso restrito · MTX Estratégias
        </p>
      </div>
    </div>
  )
}
