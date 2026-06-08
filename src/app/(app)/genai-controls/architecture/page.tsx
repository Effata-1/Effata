import { requireRole }                        from '@/lib/auth'
import { createClient }                        from '@/lib/supabase/server'
import { getNetskopeRecommendationForOrg }    from '@/lib/genai/netskope/get-recommendation'
import { GenAIArchitectureMap }               from './_components/genai-architecture-map'

export default async function GenAIArchitecturePage() {
  const user     = await requireRole('analyst')
  const supabase = await createClient()

  const [{ data: orgRow }, result] = await Promise.all([
    supabase.from('organisations').select('name').eq('id', user.orgId).maybeSingle(),
    getNetskopeRecommendationForOrg(user.orgId),
  ])

  const orgName = (orgRow?.name as string | null) ?? 'Your Organisation'
  const { recommendation, categories, appCounts, counts, sensitivityLabels } = result

  return (
    <GenAIArchitectureMap
      orgName={orgName}
      recommendation={recommendation}
      categories={categories}
      appCounts={appCounts}
      counts={counts}
      sensitivityLabels={sensitivityLabels}
    />
  )
}
