'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireRole, type UserRole } from '@/lib/auth'
export type { UserRole } from '@/lib/auth'
import { logAuditEvent } from '@/lib/audit'

export interface TeamMember {
  id:         string
  full_name:  string | null
  role:       UserRole
  created_at: string
  // email comes from auth.users — fetched via service client
  email:      string
}

export async function getTeamMembers(): Promise<{ members: TeamMember[]; error?: string }> {
  const user = await requireRole('admin')

  const supabase = await createClient()
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, full_name, role, created_at')
    .eq('org_id', user.orgId)
    .order('created_at', { ascending: true })

  if (error) return { members: [], error: error.message }

  // Fetch emails via service client (auth.users not accessible via anon client)
  const service = createServiceClient()
  const { data: { users }, error: authErr } = await service.auth.admin.listUsers()
  if (authErr) return { members: [], error: authErr.message }

  const emailMap = new Map(users.map(u => [u.id, u.email ?? '']))

  const members: TeamMember[] = (profiles ?? []).map(p => ({
    id:         p.id,
    full_name:  p.full_name,
    role:       p.role as UserRole,
    created_at: p.created_at,
    email:      emailMap.get(p.id) ?? '—',
  }))

  return { members }
}

export async function inviteTeamMember(
  _prevState: unknown,
  formData: FormData,
): Promise<{ success?: boolean; error?: string }> {
  const user = await requireRole('admin')
  const email = (formData.get('email') as string | null)?.trim().toLowerCase()

  if (!email || !email.includes('@')) return { error: 'Enter a valid email address.' }

  const service = createServiceClient()

  // Check if already a member
  const supabase = await createClient()
  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('org_id', user.orgId)

  const { data: { users } } = await service.auth.admin.listUsers()
  const existingIds = new Set((existing ?? []).map(p => p.id))
  const alreadyMember = users.some(u => u.email === email && existingIds.has(u.id))
  if (alreadyMember) return { error: 'This user is already a member of your organisation.' }

  // Send magic-link invite via Supabase admin API
  const { error } = await service.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/auth/callback`,
    data: { org_id: user.orgId },
  })

  if (error) return { error: error.message }

  await logAuditEvent({ action: 'user.invited', entity_type: 'profile', entity_name: email, details: { invited_by: user.email } })
  return { success: true }
}

export async function updateMemberRole(
  userId: string,
  newRole: UserRole,
): Promise<{ error?: string }> {
  const user = await requireRole('admin')
  if (userId === user.id) return { error: 'You cannot change your own role.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('profiles')
    .update({ role: newRole })
    .eq('id', userId)
    .eq('org_id', user.orgId)

  if (error) return { error: error.message }
  await logAuditEvent({ action: 'user.role_changed', entity_type: 'profile', entity_id: userId, details: { new_role: newRole, changed_by: user.email } })
  return {}
}

export async function removeMember(userId: string): Promise<{ error?: string }> {
  const user = await requireRole('admin')
  if (userId === user.id) return { error: 'You cannot remove yourself.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('profiles')
    .delete()
    .eq('id', userId)
    .eq('org_id', user.orgId)

  if (error) return { error: error.message }
  await logAuditEvent({ action: 'user.removed', entity_type: 'profile', entity_id: userId, details: { removed_by: user.email } })
  return {}
}
