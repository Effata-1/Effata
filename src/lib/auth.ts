import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export type UserRole = 'admin' | 'analyst' | 'read_only'

export const ROLE_RANK: Record<UserRole, number> = {
  admin:     3,
  analyst:   2,
  read_only: 1,
}

export async function getSessionUser() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return null

  const payload = JSON.parse(atob(session.access_token.split('.')[1]))
  return {
    id:    session.user.id,
    email: session.user.email ?? '',
    orgId: (payload.org_id ?? '') as string,
    role:  ((payload.user_role as UserRole) ?? 'read_only'),
  }
}

export async function requireRole(minRole: UserRole) {
  const user = await getSessionUser()
  if (!user || ROLE_RANK[user.role] < ROLE_RANK[minRole]) {
    redirect('/dashboard')
  }
  return user
}
