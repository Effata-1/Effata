import { requireRole }                        from '@/lib/auth'
import { createClient }                        from '@/lib/supabase/server'
import { getNetskopeRecommendationForOrg }    from '@/lib/genai/netskope/get-recommendation'
import { PolicyFlowDiagram }                  from './_components/policy-flow-diagram'

export default async function NetskopeArchitecturePage() {
  const user     = await requireRole('analyst')
  const supabase = await createClient()

  const [{ data: orgRow }, result] = await Promise.all([
    supabase.from('organisations').select('name').eq('id', user.orgId).maybeSingle(),
    getNetskopeRecommendationForOrg(user.orgId),
  ])

  const orgName = (orgRow?.name as string | null) ?? 'Your Organisation'
  const { recommendation, categories } = result

  return (
    <PolicyFlowDiagram
      orgName={orgName}
      recommendation={recommendation}
      categories={categories}
    />
  )
}
