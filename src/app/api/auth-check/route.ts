import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 })
  }

  const { data: { session } } = await supabase.auth.getSession()
  const jwt = session?.access_token ?? null

  // Decode JWT payload without verification (we trust Supabase)
  let claims: Record<string, unknown> = {}
  if (jwt) {
    try {
      const payload = jwt.split('.')[1]
      claims = JSON.parse(Buffer.from(payload, 'base64url').toString())
    } catch {
      claims = { error: 'Could not decode JWT' }
    }
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const { data: org, error: orgError } = await supabase
    .from('organisations')
    .select('*')
    .eq('id', profile?.org_id)
    .single()

  return NextResponse.json({
    ok: true,
    checks: {
      auth:         { pass: true, user_id: user.id, email: user.email },
      jwt_org_id:   { pass: !!claims.org_id, value: claims.org_id ?? 'MISSING — hook may not be active yet' },
      jwt_role:     { pass: !!claims.user_role, value: claims.user_role ?? 'MISSING' },
      profile:      { pass: !!profile && !profileError, data: profile ?? profileError?.message },
      organisation: { pass: !!org && !orgError, data: org ?? orgError?.message },
    },
  })
}
