import { requireRole }                              from '@/lib/auth'
import { getNetskopeRecommendationForOrg }         from '@/lib/genai/netskope/get-recommendation'
import { RecommendationClient }                    from './_components/recommendation-client'

export default async function NetskopeRecommendationPage() {
  const user = await requireRole('analyst')

  let result: Awaited<ReturnType<typeof getNetskopeRecommendationForOrg>>
  try {
    result = await getNetskopeRecommendationForOrg(user.orgId)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="text-sm font-medium text-destructive">Failed to load Netskope recommendation</p>
        <p className="max-w-md text-xs text-muted-foreground">{message}</p>
      </div>
    )
  }

  const { recommendation, categories } = result

  return (
    <RecommendationClient
      recommendation={recommendation}
      orgCategories={categories.map(c => ({ id: c.id, name: c.name, system_tag: c.system_tag ?? '' }))}
    />
  )
}
