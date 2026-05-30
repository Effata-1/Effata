'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { logAuditEvent } from '@/lib/audit'

export interface VendorMappingInput {
  vendor_id:                    string
  neutral_object_type:          string
  neutral_object_key:           string
  neutral_object_display_name?: string
  vendor_object_type:           string
  vendor_object_name:           string
  vendor_object_id?:            string
  vendor_console_path?:         string
  mapping_quality:              'exact' | 'lossy' | 'customer_verified' | 'unverified'
  mapping_purpose:              'destination_scope' | 'detection_profile' | 'notification' | 'exception' | 'evidence' | 'policy_order'
  verification_note?:           string
  metadata?:                    Record<string, unknown>
}

export async function upsertVendorMapping(
  input: VendorMappingInput,
): Promise<{ id?: string; error?: string }> {
  const user     = await requireRole('admin')
  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('org_vendor_object_mappings')
    .select('id')
    .eq('org_id', user.orgId)
    .eq('vendor_id', input.vendor_id)
    .eq('neutral_object_type', input.neutral_object_type)
    .eq('neutral_object_key', input.neutral_object_key)
    .eq('vendor_object_type', input.vendor_object_type)
    .eq('mapping_purpose', input.mapping_purpose)
    .maybeSingle()

  const isCreate = !existing
  const { data, error } = await supabase
    .from('org_vendor_object_mappings')
    .upsert(
      {
        org_id:                      user.orgId,
        vendor_id:                   input.vendor_id,
        neutral_object_type:         input.neutral_object_type,
        neutral_object_key:          input.neutral_object_key,
        neutral_object_display_name: input.neutral_object_display_name ?? null,
        vendor_object_type:          input.vendor_object_type,
        vendor_object_name:          input.vendor_object_name,
        vendor_object_id:            input.vendor_object_id ?? null,
        vendor_console_path:         input.vendor_console_path ?? null,
        mapping_quality:             input.mapping_quality,
        mapping_purpose:             input.mapping_purpose,
        verification_note:           input.verification_note ?? null,
        metadata:                    input.metadata ?? {},
        is_active:                   true,
        // Reset verification on every save — mapping must be re-verified after any change
        verified:            false,
        verification_status: 'needs_review',
        verified_by:         null,
        verified_at:         null,
      },
      {
        onConflict: 'org_id,vendor_id,neutral_object_type,neutral_object_key,vendor_object_type,mapping_purpose',
        ignoreDuplicates: false,
      },
    )
    .select('id')
    .single()

  if (error) return { error: error.message }

  await logAuditEvent({
    action:      isCreate ? 'vendor_mapping.created' : 'vendor_mapping.updated',
    entity_type: 'vendor_mapping',
    entity_id:   data.id,
    entity_name: `${input.vendor_id}:${input.neutral_object_type}:${input.neutral_object_key}`,
    user_id:     user.id,
    org_id:      user.orgId,
    details: {
      vendor_id:           input.vendor_id,
      neutral_object_type: input.neutral_object_type,
      neutral_object_key:  input.neutral_object_key,
      mapping_purpose:     input.mapping_purpose,
    },
  })

  revalidatePath('/genai-controls/vendor-mapping/netskope')
  return { id: data.id }
}

export async function deleteVendorMapping(
  mappingId: string,
): Promise<{ error?: string }> {
  const user     = await requireRole('admin')
  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('org_vendor_object_mappings')
    .select('id, vendor_id, neutral_object_type, neutral_object_key, mapping_purpose')
    .eq('id', mappingId)
    .eq('org_id', user.orgId)
    .maybeSingle()

  if (!existing) return { error: 'Mapping not found' }

  const { error } = await supabase
    .from('org_vendor_object_mappings')
    .delete()
    .eq('id', mappingId)
    .eq('org_id', user.orgId)

  if (error) return { error: error.message }

  await logAuditEvent({
    action:      'vendor_mapping.deleted',
    entity_type: 'vendor_mapping',
    entity_id:   mappingId,
    entity_name: `${existing.vendor_id}:${existing.neutral_object_type}:${existing.neutral_object_key}`,
    user_id:     user.id,
    org_id:      user.orgId,
    details: {
      vendor_id:           existing.vendor_id,
      neutral_object_type: existing.neutral_object_type,
      neutral_object_key:  existing.neutral_object_key,
      mapping_purpose:     existing.mapping_purpose,
    },
  })

  revalidatePath('/genai-controls/vendor-mapping/netskope')
  return {}
}

export async function toggleMappingVerified(
  mappingId:        string,
  verified:         boolean,
  verificationNote?: string,
): Promise<{ error?: string }> {
  const user     = await requireRole('admin')
  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('org_vendor_object_mappings')
    .select('id, vendor_id, neutral_object_type, neutral_object_key, mapping_purpose, mapping_quality')
    .eq('id', mappingId)
    .eq('org_id', user.orgId)
    .maybeSingle()

  if (!existing) return { error: 'Mapping not found' }

  // Require verification_note when verifying a lossy mapping
  if (verified && existing.mapping_quality === 'lossy' && !verificationNote) {
    return { error: 'A verification note is required when verifying a lossy mapping. Describe the accepted limitation.' }
  }

  const { error } = await supabase
    .from('org_vendor_object_mappings')
    .update({
      verified:            verified,
      verification_status: verified ? 'verified' : 'needs_review',
      verified_by:         verified ? user.id : null,
      verified_at:         verified ? new Date().toISOString() : null,
      verification_note:   verificationNote ?? null,
    })
    .eq('id', mappingId)
    .eq('org_id', user.orgId)

  if (error) return { error: error.message }

  if (verified) {
    await logAuditEvent({
      action:      'vendor_mapping.verified',
      entity_type: 'vendor_mapping',
      entity_id:   mappingId,
      entity_name: `${existing.vendor_id}:${existing.neutral_object_type}:${existing.neutral_object_key}`,
      user_id:     user.id,
      org_id:      user.orgId,
      details: {
        vendor_id:           existing.vendor_id,
        neutral_object_type: existing.neutral_object_type,
        neutral_object_key:  existing.neutral_object_key,
        mapping_purpose:     existing.mapping_purpose,
        verification_note:   verificationNote ?? null,
      },
    })
  }

  revalidatePath('/genai-controls/vendor-mapping/netskope')
  return {}
}

export async function markMappingNotApplicable(
  mappingId:    string,
  notApplicable: boolean,
  reason?:      string,
): Promise<{ error?: string }> {
  const user     = await requireRole('admin')
  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('org_vendor_object_mappings')
    .select('id, vendor_id, neutral_object_type, neutral_object_key, mapping_purpose')
    .eq('id', mappingId)
    .eq('org_id', user.orgId)
    .maybeSingle()

  if (!existing) return { error: 'Mapping not found' }

  const { error } = await supabase
    .from('org_vendor_object_mappings')
    .update({
      not_applicable:        notApplicable,
      not_applicable_reason: reason ?? null,
    })
    .eq('id', mappingId)
    .eq('org_id', user.orgId)

  if (error) return { error: error.message }

  if (notApplicable) {
    await logAuditEvent({
      action:      'vendor_mapping.marked_not_applicable',
      entity_type: 'vendor_mapping',
      entity_id:   mappingId,
      entity_name: `${existing.vendor_id}:${existing.neutral_object_type}:${existing.neutral_object_key}`,
      user_id:     user.id,
      org_id:      user.orgId,
      details: {
        vendor_id:           existing.vendor_id,
        neutral_object_type: existing.neutral_object_type,
        neutral_object_key:  existing.neutral_object_key,
        mapping_purpose:     existing.mapping_purpose,
        not_applicable_reason: reason ?? null,
      },
    })
  }

  revalidatePath('/genai-controls/vendor-mapping/netskope')
  return {}
}
