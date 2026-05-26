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

  // All profiles (enterprise + personal)
  const { data: profiles } = await supabase
    .from('genai_app_profiles')
    .select('*')

  // Org-specific classifications
  const { data: classifications } = await supabase
    .from('genai_customer_classifications')
    .select('*')
    .eq('org_id', user.orgId)

  // Group profiles by app_id, then by mode
  const profilesByApp = new Map<string, Map<string, GenAIAppProfile>>()
  for (const p of (profiles as GenAIAppProfile[] ?? [])) {
    if (!profilesByApp.has(p.app_id)) profilesByApp.set(p.app_id, new Map())
    profilesByApp.get(p.app_id)!.set(p.mode, p)
  }
  const classMap = new Map((classifications as CustomerClassification[] ?? []).map(c => [c.app_id, c]))

  const totalInDb = (allApps ?? []).length

  // One entry per mode per app (only apps with at least one evaluated profile)
  const entries: CatalogEntry[] = []
  for (const app of (allApps as GenAIApp[] ?? [])) {
    const modeMap = profilesByApp.get(app.app_id)
    if (!modeMap) continue
    for (const mode of (['enterprise', 'personal'] as const)) {
      const profile = modeMap.get(mode)
      if (!profile) continue
      const score = computeTrustScore(profile.fields, profile.dlp, profile.breach_info)
      entries.push({ app, score, classification: classMap.get(app.app_id) ?? null, mode })
    }
  }

  return (
    <AppCatalogClient
      entries={entries}
      lastRunInfo={lastRunInfo}
      totalInDb={totalInDb}
    />
  )
}
