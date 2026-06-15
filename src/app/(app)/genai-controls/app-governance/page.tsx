import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { ensureGenAIGovernanceCategories } from './actions'
import { GovernanceClient } from './_components/governance-client'
import type { GenAIApp, GenAIAppProfile, CustomerClassification } from '@/lib/genai/types'

// 'unknown' apps display under the Restricted / Unassessed category
const UNKNOWN_FALLBACK = 'permitted-with-restriction'

export default async function AppGovernancePage() {
  const user = await requireRole('analyst')
  const supabase = await createClient()

  const [categories, { data: apps }, { data: profiles }, { data: classifications }] = await Promise.all([
    ensureGenAIGovernanceCategories(),
    supabase.from('genai_apps').select('*').eq('status', 'active').order('app_name'),
    supabase.from('genai_app_profiles').select('*'),
    supabase.from('genai_customer_classifications').select('*').eq('org_id', user.orgId),
  ])

  const profileMap = new Map((profiles as GenAIAppProfile[] ?? []).map(p => [p.app_id, p]))
  const classMap   = new Map((classifications as CustomerClassification[] ?? []).map(c => [c.app_id, c]))

  // Group apps by their customer_classification system_tag.
  // 'unknown' maps to the Restricted / Unassessed bucket.
  const appsByCategoryTag: Record<string, { app: GenAIApp; profile: GenAIAppProfile | null; classification: CustomerClassification | null }[]> = {}

  for (const app of (apps as GenAIApp[] ?? [])) {
    const profile        = profileMap.get(app.app_id) ?? null
    const classification = classMap.get(app.app_id) ?? null
    const tag            = classification?.customer_classification === 'unknown' || !classification
      ? UNKNOWN_FALLBACK
      : classification.customer_classification

    if (!appsByCategoryTag[tag]) appsByCategoryTag[tag] = []
    appsByCategoryTag[tag].push({ app, profile, classification })
  }

  return (
    <GovernanceClient
      categories={categories}
      appsByCategoryTag={appsByCategoryTag}
      userRole={user.role}
    />
  )
}
