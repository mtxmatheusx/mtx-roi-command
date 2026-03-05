import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { email, password } = await req.json()

  const validEmail    = process.env.AUTH_EMAIL    || ''
  const validPassword = process.env.AUTH_PASSWORD || ''

  if (
    email?.trim().toLowerCase() === validEmail.toLowerCase() &&
    password === validPassword
  ) {
    const res = NextResponse.json({ success: true })
    res.cookies.set('mtx_session', 'authenticated', {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 dias
      path: '/',
    })
    return res
  }

  return NextResponse.json({ error: 'E-mail ou senha inválidos' }, { status: 401 })
}

export async function DELETE() {
  const res = NextResponse.json({ success: true })
  res.cookies.set('mtx_session', '', { maxAge: 0, path: '/' })
  return res
}
