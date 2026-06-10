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
  const { data, error } = await supabase.auth.getClaims()
  if (error || !data?.claims) return null

  const claims = data.claims as Record<string, unknown>
  return {
    id:    data.claims.sub,
    email: (data.claims.email as string | undefined) ?? '',
    orgId: (claims.org_id as string | undefined) ?? '',
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
