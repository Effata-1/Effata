// Allow up to 5 minutes so on-demand Claude evaluations don't time out
export const maxDuration = 300

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireRole } from '@/lib/auth'
import { computeTrustScore } from '@/lib/genai/scoring'
import { AppCatalogClient } from './_components/app-catalog-client'
import type { CatalogEntry } from './_components/app-catalog-client'
import type { GenAIApp, GenAIAppProfile, CustomerClassification } from '@/lib/genai/types'

export default async function GenAIAppCatalogPage() {
  const user = await requireRole('analyst')
  const supabase = await createClient()

  // Last refresh run (requires service key)
  let lastRunInfo: { status: string; apps_updated: number; apps_added: number } | null = null
  try {
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const { data } = await createServiceClient()
        .from('genai_research_runs')
        .select('status, apps_updated, apps_added')
        .order('started_at', { ascending: false })
        .limit(1)
        .single()
      lastRunInfo = data
    }
  } catch { /* ignore */ }

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

  // One profile per app — first profile wins
  const profileMap = new Map<string, GenAIAppProfile>()
  for (const p of (profiles as GenAIAppProfile[] ?? [])) {
    if (!profileMap.has(p.app_id)) profileMap.set(p.app_id, p)
  }
  const classMap = new Map((classifications as CustomerClassification[] ?? []).map(c => [c.app_id, c]))

  const totalInDb = (allApps ?? []).length

  // One entry per app (only apps with an evaluated profile)
  const entries: CatalogEntry[] = []
  for (const app of (allApps as GenAIApp[] ?? [])) {
    const profile = profileMap.get(app.app_id)
    if (!profile) continue
    const score = computeTrustScore(profile.fields, profile.dlp, profile.breach_info)
    entries.push({ app, score, classification: classMap.get(app.app_id) ?? null })
  }

  return (
    <AppCatalogClient
      entries={entries}
      lastRunInfo={lastRunInfo}
      totalInDb={totalInDb}
    />
  )
}
