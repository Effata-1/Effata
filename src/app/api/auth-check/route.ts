import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { NextResponse } from 'next/server'

export async function GET() {
  // requireRole calls getUser() (server-verified) + getClaims() and checks role rank.
  // Redirects to /dashboard if not admin — no manual role check needed below.
  const admin = await requireRole('admin')
  const supabase = await createClient()

  const { data: { session } } = await supabase.auth.getSession()
  const jwt = session?.access_token ?? null

  // Decode (do NOT use for access decisions) the raw JWT payload to display raw claim values.
  // Admin gate is already enforced by requireRole() above — this decode is purely diagnostic.
  let rawClaims: Record<string, unknown> = {}
  if (jwt) {
    try {
      const payload = jwt.split('.')[1]
      rawClaims = JSON.parse(Buffer.from(payload, 'base64url').toString())
    } catch {
      rawClaims = { error: 'Could not decode JWT' }
    }
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', admin.id)
    .single()

  const { data: org, error: orgError } = await supabase
    .from('organisations')
    .select('*')
    .eq('id', admin.orgId)
    .single()

  return NextResponse.json({
    ok: true,
    checks: {
      auth:         { pass: true, user_id: admin.id, email: admin.email },
      jwt_org_id:   { pass: !!rawClaims.org_id, value: rawClaims.org_id ?? 'MISSING — hook may not be active yet' },
      jwt_role:     { pass: !!rawClaims.user_role, value: rawClaims.user_role ?? 'MISSING' },
      profile:      { pass: !!profile && !profileError, data: profile ?? profileError?.message },
      organisation: { pass: !!org && !orgError, data: org ?? orgError?.message },
    },
  })
}
