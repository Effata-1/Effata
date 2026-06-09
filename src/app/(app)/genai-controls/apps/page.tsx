// Allow up to 5 minutes so on-demand Claude evaluations don't time out
export const maxDuration = 300

import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { computeTrustScore } from '@/lib/genai/scoring'
import { AppCatalogClient } from './_components/app-catalog-client'
import type { CatalogEntry } from './_components/app-catalog-client'
import type { GenAIApp, GenAIAppProfile, CustomerClassification } from '@/lib/genai/types'

export default async function GenAIAppCatalogPage() {
  const user = await requireRole('analyst')
  const supabase = await createClient()

  // All active apps
  const { data: allApps } = await supabase
    .from('genai_apps')
    .select('*')
    .eq('status', 'active')
    .order('app_name')

  // All profiles
  const { data: profiles } = await supabase
    .from('genai_app_profiles')
    .select('*')

  // Org-specific classifications
  const { data: classifications } = await supabase
    .from('genai_customer_classifications')
    .select('*')
    .eq('org_id', user.orgId)

  // Org governance categories — needed for dynamic classification labels
  const { data: orgCategories } = await supabase
    .from('org_genai_governance_categories')
    .select('system_tag, name')
    .eq('org_id', user.orgId)
    .eq('active', true)

  // One profile per app — first found wins (DB has UNIQUE(app_id, mode))
  const profileMap = new Map<string, GenAIAppProfile>()
  for (const p of (profiles as GenAIAppProfile[] ?? [])) {
    if (!profileMap.has(p.app_id)) profileMap.set(p.app_id, p)
  }
  const classMap = new Map((classifications as CustomerClassification[] ?? []).map(c => [c.app_id, c]))

  const totalInDb = (allApps ?? []).length

  // Build entries — deduplicate by app_name (case-insensitive), keeping the higher score
  const byName = new Map<string, CatalogEntry>()
  for (const app of (allApps as GenAIApp[] ?? [])) {
    const profile = profileMap.get(app.app_id)
    if (!profile) continue
    const score = computeTrustScore(profile.fields, profile.dlp, profile.breach_info)
    const entry: CatalogEntry = { app, score, classification: classMap.get(app.app_id) ?? null }
    const nameKey = app.app_name.toLowerCase().trim()
    const existing = byName.get(nameKey)
    if (!existing || score.final_score > (existing.score?.final_score ?? 0)) {
      byName.set(nameKey, entry)
    }
  }
  const entries = Array.from(byName.values()).sort((a, b) => a.app.app_name.localeCompare(b.app.app_name))

  return (
    <AppCatalogClient
      entries={entries}
      totalInDb={totalInDb}
      orgCategories={orgCategories ?? []}
    />
  )
}
