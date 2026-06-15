import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export type UserRole = 'admin' | 'analyst' | 'read_only'

export const ROLE_RANK: Record<UserRole, number> = {
  admin:     3,
  analyst:   2,
  read_only: 1,
}

function normaliseRole(role: unknown): UserRole {
  return role === 'admin' || role === 'analyst' || role === 'read_only'
    ? role
    : 'read_only'
}

export async function getSessionUser() {
  const supabase = await createClient()

  // Step 1: Verify identity with Supabase Auth server.
  // getUser() makes a network call to validate the JWT — not cookie-only.
  // This is the explicit server-verification step visible to any security reviewer.
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return null

  // Step 2: Extract custom application claims that getUser() does not return.
  // org_id and user_role live in the JWT as custom claims, not in the Supabase user object.
  // getClaims() is safe here because identity was already verified above.
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims()
  if (claimsError || !claimsData?.claims) return null

  const claims = claimsData.claims as Record<string, unknown>
  return {
    id:    user.id,           // from verified getUser() — authoritative
    email: user.email ?? '',  // from verified getUser() — authoritative
    orgId: (claims.org_id   as string | undefined) ?? '',
    role:  normaliseRole(claims.user_role),
  }
}

export async function requireRole(minRole: UserRole) {
  const user = await getSessionUser()
  if (!user || ROLE_RANK[user.role] < ROLE_RANK[minRole]) {
    redirect('/dashboard')
  }
  return user
}
