import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { ensureGenAIGovernanceCategories } from './actions'
import { GovernanceClient } from './_components/governance-client'
import type { GenAIApp, GenAIAppProfile, CustomerClassification } from '@/lib/genai/types'

// 'unknown' apps display under 'permitted-with-restriction'
const UNKNOWN_FALLBACK = 'permitted-with-restriction'

export default async function AppGovernancePage() {
  const user = await requireRole('analyst')
  const supabase = await createClient()

  const [categories, { data: apps }, { data: profiles }, { data: classifications }, { data: refNotes }] = await Promise.all([
    ensureGenAIGovernanceCategories(),
    supabase.from('genai_apps').select('*').eq('status', 'active').order('app_name'),
    supabase.from('genai_app_profiles').select('*').eq('mode', 'enterprise'),
    supabase.from('genai_customer_classifications').select('*').eq('org_id', user.orgId),
    supabase.from('org_reference_app_notes').select('app_slug, notes, in_scope, classification').eq('org_id', user.orgId),
  ])

  const profileMap = new Map((profiles as GenAIAppProfile[] ?? []).map(p => [p.app_id, p]))
  const classMap   = new Map((classifications as CustomerClassification[] ?? []).map(c => [c.app_id, c]))

  // Group apps by their customer_classification system_tag.
  // 'unknown' maps to the 'permitted-with-restriction' bucket.
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

  const refDataBySlug = Object.fromEntries(
    (refNotes ?? []).map(n => [
      n.app_slug as string,
      {
        notes:          (n.notes          ?? '')    as string,
        in_scope:       (n.in_scope       ?? false) as boolean,
        classification: (n.classification ?? null)  as string | null,
      },
    ]),
  )

  return (
    <GovernanceClient
      categories={categories}
      appsByCategoryTag={appsByCategoryTag}
      userRole={user.role}
      initialNotes={refDataBySlug}
    />
  )
}
