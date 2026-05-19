import { NextResponse, type NextRequest } from 'next/server'

// Zero external imports — guaranteed Edge Runtime compatible.
// Role security is enforced by Supabase RLS + requireRole() in server components.
// This middleware handles routing only.

const ROLE_RANK: Record<string, number> = { admin: 3, analyst: 2, read_only: 1 }

const ROUTE_RULES: { pattern: RegExp; minRole: string }[] = [
  { pattern: /^\/settings(\/|$)/,        minRole: 'admin'     },
  { pattern: /^\/tools(\/|$)/,           minRole: 'analyst'   },
  { pattern: /^\/compliance(\/|$)/,      minRole: 'analyst'   },
  { pattern: /^\/data-in-motion(\/|$)/,  minRole: 'analyst'   },
  { pattern: /^\/dashboard(\/|$)/,       minRole: 'read_only' },
]

interface JwtClaims { sub?: string; user_role?: string }

function parseSession(request: NextRequest): JwtClaims | null {
  // Supabase stores session in sb-<project-ref>-auth-token cookies (may be chunked)
  const chunks = request.cookies.getAll()
    .filter(c => c.name.includes('-auth-token'))
    .sort((a, b) => a.name.localeCompare(b.name))

  if (chunks.length === 0) return null

  try {
    const session = JSON.parse(chunks.map(c => c.value).join(''))
    if (!session?.access_token) return null
    // Decode JWT payload (we trust the signature — Supabase signs it; RLS enforces the real security)
    return JSON.parse(atob(session.access_token.split('.')[1])) as JwtClaims
  } catch {
    return null
  }
}

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname

  if (path.startsWith('/auth') || path.startsWith('/onboarding') || path === '/') {
    return NextResponse.next()
  }

  const claims = parseSession(request)

  if (!claims?.sub) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }

  const role = claims.user_role ?? 'read_only'
  const rule = ROUTE_RULES.find(r => r.pattern.test(path))

  if (rule && (ROLE_RANK[role] ?? 0) < (ROLE_RANK[rule.minRole] ?? 99)) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|api/).*)'],
}
