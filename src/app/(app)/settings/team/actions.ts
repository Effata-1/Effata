'use server'

import { createClient } from '@/lib/supabase/server'
import { requireRole, type UserRole } from '@/lib/auth'
export type { UserRole } from '@/lib/auth'
import { logAuditEvent } from '@/lib/audit'
import { callData } from '@/lib/api-client.server'

export interface TeamMember {
  id:         string
  full_name:  string | null
  role:       UserRole
  created_at: string
  email:      string | null
}

export async function getTeamMembers(): Promise<{ members: TeamMember[]; error?: string }> {
  await requireRole('admin')

  try {
    const members = await callData<TeamMember[]>('/api/data/team')
    return { members }
  } catch (err) {
    return { members: [], error: err instanceof Error ? err.message : 'Failed to load team members' }
  }
}

export async function inviteTeamMember(
  _prevState: unknown,
  formData: FormData,
): Promise<{ success?: boolean; error?: string }> {
  const user = await requireRole('admin')
  const email = (formData.get('email') as string | null)?.trim().toLowerCase()
  const role  = (formData.get('role')  as string | null) ?? 'analyst'

  if (!email || !email.includes('@')) return { error: 'Enter a valid email address.' }

  try {
    await callData('/api/data/team/invite', { method: 'POST', body: { email, role } })
    await logAuditEvent({ action: 'user.invited', entity_type: 'profile', entity_name: email, details: { invited_by: user.email } })
    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Invite failed'
    if (msg.includes('409') || msg.toLowerCase().includes('already')) {
      return { error: 'This user is already a member of your organisation.' }
    }
    return { error: msg }
  }
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
