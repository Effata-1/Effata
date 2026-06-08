import { requireRole }                        from '@/lib/auth'
import { createClient }                        from '@/lib/supabase/server'
import { getNetskopeRecommendationForOrg }    from '@/lib/genai/netskope/get-recommendation'
import { GenAIArchitectureMap }               from './_components/genai-architecture-map'

export default async function GenAIArchitecturePage() {
  const user     = await requireRole('analyst')
  const supabase = await createClient()

  let result: Awaited<ReturnType<typeof getNetskopeRecommendationForOrg>>
  let orgName = 'Your Organisation'

  try {
    const [{ data: orgRow }, res] = await Promise.all([
      supabase.from('organisations').select('name').eq('id', user.orgId).maybeSingle(),
      getNetskopeRecommendationForOrg(user.orgId),
    ])
    orgName = (orgRow?.name as string | null) ?? 'Your Organisation'
    result  = res
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="text-sm font-medium text-destructive">Failed to load GenAI Architecture</p>
        <p className="max-w-md text-xs text-muted-foreground">{message}</p>
      </div>
    )
  }

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
