'use server'

import { createClient } from '@/lib/supabase/server'
import { logAuditEvent } from '@/lib/audit'

export interface RequirementFields {
  description?: string
  dlp_relevance?: string
  fine?: string | null
  severity?: 'critical' | 'high' | 'medium'
}

export interface RegulationFields {
  summary?: string
  max_fine?: string | null
}

async function getOrgAndUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: { session } } = await supabase.auth.getSession()
  const orgId = session?.access_token
    ? JSON.parse(atob(session.access_token.split('.')[1]))?.org_id
    : null
  if (!orgId) return null
  return { supabase, user, orgId }
}

export async function updateRequirement(
  requirementId: string,
  regulationId: string,
  regulationName: string,
  fields: RequirementFields,
  oldFields: RequirementFields
): Promise<{ error?: string }> {
  const ctx = await getOrgAndUser()
  if (!ctx) return { error: 'Not authenticated' }
  const { supabase, user, orgId } = ctx

  const { error: updateError } = await supabase
    .from('compliance_requirements')
    .update(fields)
    .eq('id', requirementId)

  if (updateError) return { error: updateError.message }

  await supabase.from('compliance_verification_log').insert({
    regulation_id: regulationId,
    org_id:        orgId,
    verified_by:   user.id,
    changed:       true,
    notes:         `Requirement ${requirementId} updated`,
    changes:       { requirement_id: requirementId, fields, old_fields: oldFields },
  })

  await logAuditEvent({
    action:      'compliance.requirement_updated',
    entity_type: 'compliance_requirement',
    entity_id:   requirementId,
    entity_name: regulationName,
    details:     { fields, old_fields: oldFields },
    user_id:     user.id,
    user_email:  user.email ?? undefined,
    org_id:      orgId,
  })

  return {}
}

export async function updateRegulation(
  regulationId: string,
  regulationName: string,
  fields: RegulationFields,
  oldFields: RegulationFields
): Promise<{ error?: string }> {
  const ctx = await getOrgAndUser()
  if (!ctx) return { error: 'Not authenticated' }
  const { supabase, user, orgId } = ctx

  const { error: updateError } = await supabase
    .from('compliance_regulations')
    .update(fields)
    .eq('id', regulationId)

  if (updateError) return { error: updateError.message }

  await supabase.from('compliance_verification_log').insert({
    regulation_id: regulationId,
    org_id:        orgId,
    verified_by:   user.id,
    changed:       true,
    notes:         `Regulation top-level fields updated`,
    changes:       { fields, old_fields: oldFields },
  })

  await logAuditEvent({
    action:      'compliance.regulation_updated',
    entity_type: 'compliance_regulation',
    entity_id:   regulationId,
    entity_name: regulationName,
    details:     { fields, old_fields: oldFields },
    user_id:     user.id,
    user_email:  user.email ?? undefined,
    org_id:      orgId,
  })

  return {}
}

export async function markRegulationVerified(
  regulationId: string,
  regulationName: string,
  changed: boolean,
  notes?: string
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: { session } } = await supabase.auth.getSession()
  const orgId = session?.access_token
    ? JSON.parse(atob(session.access_token.split('.')[1]))?.org_id
    : null
  if (!orgId) return { error: 'Organisation not found' }

  const { error: logError } = await supabase
    .from('compliance_verification_log')
    .insert({
      regulation_id: regulationId,
      org_id:        orgId,
      verified_by:   user.id,
      changed,
      notes:         notes ?? null,
    })
  if (logError) return { error: logError.message }

  await supabase
    .from('compliance_regulations')
    .update({ last_verified_at: new Date().toISOString() })
    .eq('id', regulationId)

  await logAuditEvent({
    action:      'compliance.regulation_verified',
    entity_type: 'compliance_regulation',
    entity_id:   regulationId,
    entity_name: regulationName,
    details:     { changed, notes },
    user_id:     user.id,
    user_email:  user.email ?? undefined,
    org_id:      orgId,
  })

  return {}
}
