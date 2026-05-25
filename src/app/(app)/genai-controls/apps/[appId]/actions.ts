'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import type { ApprovalStatus, ContractStatus, DpaStatus, SecurityReviewStatus, DlpCoverage } from '@/lib/genai/types'

export interface GovernanceFields {
  business_owner?:         string
  technical_owner?:        string
  approval_status?:        ApprovalStatus
  review_date?:            string | null
  next_review_date?:       string | null
  contract_status?:        ContractStatus
  dpa_status?:             DpaStatus
  security_review_status?: SecurityReviewStatus
  tenant_instance_id?:     string
  dlp_coverage?:           DlpCoverage
  notes?:                  string
}

export async function upsertGovernanceRecord(
  appId: string,
  fields: GovernanceFields,
): Promise<{ error?: string }> {
  const user = await requireRole('analyst')
  const supabase = await createClient()

  const { error } = await supabase
    .from('genai_customer_classifications')
    .upsert(
      {
        org_id:  user.orgId,
        app_id:  appId,
        updated_at: new Date().toISOString(),
        ...fields,
      },
      { onConflict: 'org_id,app_id' },
    )

  if (error) return { error: error.message }
  revalidatePath(`/genai-controls/apps/${appId}`)
  revalidatePath('/genai-controls/apps')
  return {}
}
