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

  // Enterprise profiles only
  const { data: profiles } = await supabase
    .from('genai_app_profiles')
    .select('*')
    .eq('mode', 'enterprise')

  // Org-specific classifications
  const { data: classifications } = await supabase
    .from('genai_customer_classifications')
    .select('*')
    .eq('org_id', user.orgId)

  const profileMap = new Map((profiles as GenAIAppProfile[] ?? []).map(p => [p.app_id, p]))
  const classMap   = new Map((classifications as CustomerClassification[] ?? []).map(c => [c.app_id, c]))

  const totalInDb = (allApps ?? []).length

  // Only include apps that have a fully evaluated enterprise profile
  const entries: CatalogEntry[] = (allApps as GenAIApp[] ?? [])
    .filter(app => profileMap.has(app.app_id))
    .map(app => {
      const profile = profileMap.get(app.app_id)!
      const score = computeTrustScore(profile.fields, profile.dlp, profile.breach_info)
      return { app, score, classification: classMap.get(app.app_id) ?? null }
    })

  return (
    <AppCatalogClient
      entries={entries}
      lastRunInfo={lastRunInfo}
      totalInDb={totalInDb}
    />
  )
}
