import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const ROLE_RANK: Record<string, number> = { admin: 3, analyst: 2, read_only: 1 }

const ROUTE_RULES: { pattern: RegExp; minRole: string }[] = [
  { pattern: /^\/settings(\/|$)/,       minRole: 'admin'     },
  { pattern: /^\/tools(\/|$)/,          minRole: 'analyst'   },
  { pattern: /^\/compliance(\/|$)/,     minRole: 'analyst'   },
  { pattern: /^\/data-in-motion(\/|$)/, minRole: 'analyst'   },
  { pattern: /^\/dashboard(\/|$)/,      minRole: 'read_only' },
]

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname

  // Let auth and onboarding routes through unconditionally
  if (
    path.startsWith('/auth') ||
    path.startsWith('/onboarding') ||
    path === '/'
  ) {
    return NextResponse.next()
  }

  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Verify auth (server-validated)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }

  // Decode role from JWT claims (signing key trusted — Supabase project secret)
  const { data: { session } } = await supabase.auth.getSession()
  let role = 'read_only'
  if (session?.access_token) {
    try {
      const payload = JSON.parse(atob(session.access_token.split('.')[1]))
      role = payload.user_role ?? 'read_only'
    } catch { /* malformed token — fall back to read_only */ }
  }

  // Enforce route-level minimum role
  const rule = ROUTE_RULES.find(r => r.pattern.test(path))
  if (rule && (ROLE_RANK[role] ?? 0) < (ROLE_RANK[rule.minRole] ?? 99)) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|api/).*)'],
}
