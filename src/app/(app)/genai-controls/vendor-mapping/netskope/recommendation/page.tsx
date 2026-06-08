import { requireRole }                              from '@/lib/auth'
import { getNetskopeRecommendationForOrg }         from '@/lib/genai/netskope/get-recommendation'
import { RecommendationClient }                    from './_components/recommendation-client'

export default async function NetskopeRecommendationPage() {
  const user = await requireRole('analyst')

  const { recommendation, categories } = await getNetskopeRecommendationForOrg(user.orgId)

  return (
    <RecommendationClient
      recommendation={recommendation}
      orgCategories={categories.map(c => ({ id: c.id, name: c.name, system_tag: c.system_tag ?? '' }))}
    />
  )
}
