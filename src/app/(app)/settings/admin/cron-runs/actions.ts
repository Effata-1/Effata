'use server'

import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { logAuditEvent } from '@/lib/audit'

export async function triggerComplianceCheck(): Promise<{
  error?: string
  regs_checked?: number
  regs_proposed?: number
}> {
  try {
    const res = await fetch(`${process.env.RAILWAY_API_BASE_URL}/api/internal/compliance-check`, {
      method:  'POST',
      headers: { 'x-cron-key': process.env.CRON_API_KEY! },
    })
    const body = await res.json() as { regs_checked?: number; regs_proposed?: number; regs_updated?: number; error?: string }
    if (!res.ok) return { error: body.error ?? `Railway returned ${res.status}` }
    revalidatePath('/settings/admin/cron-runs')
    return { regs_checked: body.regs_checked, regs_proposed: body.regs_proposed ?? body.regs_updated }
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
}

// ── Proposal review actions ───────────────────────────────────────────────────

export async function approveProposal(proposalId: string): Promise<{ error?: string }> {
  const user = await requireRole('admin')
  const reviewedBy = user.id
  const supabase = await createClient()

  // All writes (compliance_regulations, compliance_requirements,
  // compliance_verification_log, compliance_proposed_changes) run inside a single
  // Postgres transaction via the apply_compliance_proposal RPC function.
  // Either all succeed or all roll back — no partial state possible.
  const { error } = await supabase.rpc('apply_compliance_proposal', {
    p_proposal_id: proposalId,
    p_reviewed_by: reviewedBy,
  })

  if (error) return { error: error.message }
  await logAuditEvent({
    action:      'compliance_proposal.approved',
    entity_type: 'compliance_proposed_changes',
    entity_id:   proposalId,
    org_id:  user.orgId,
    user_id: user.id,
  })
  revalidatePath('/settings/admin/cron-runs')
  return {}
}

export async function rejectProposal(proposalId: string): Promise<{ error?: string }> {
  const user = await requireRole('admin')
  const reviewedBy = user.id
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('compliance_proposed_changes')
    .update({
      status:      'rejected',
      reviewed_by: reviewedBy,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', proposalId)
    .eq('status', 'pending')  // guard: can't reject something already reviewed
    .select('id')
    .maybeSingle()

  if (error) return { error: error.message }
  // Supabase returns no error when 0 rows match — guard explicitly so we don't log a phantom rejection.
  if (!data) return { error: 'Proposal not found or already reviewed.' }
  await logAuditEvent({
    action:      'compliance_proposal.rejected',
    entity_type: 'compliance_proposed_changes',
    entity_id:   proposalId,
    org_id:  user.orgId,
    user_id: user.id,
  })
  revalidatePath('/settings/admin/cron-runs')
  return {}
}
