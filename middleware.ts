import { NextRequest, NextResponse } from 'next/server'

export function middleware(req: NextRequest) {
  const session    = req.cookies.get('mtx_session')?.value
  const pathname   = req.nextUrl.pathname
  const isLogin    = pathname === '/login'
  const isApi      = pathname.startsWith('/api')
  const isStatic   = pathname.startsWith('/_next')

  // Deixa passar: rotas de API e assets estáticos
  if (isApi || isStatic) return NextResponse.next()

  // Sem sessão → redireciona para /login
  if (!session && !isLogin) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  // Com sessão → não precisa ver /login
  if (session && isLogin) {
    return NextResponse.redirect(new URL('/', req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
