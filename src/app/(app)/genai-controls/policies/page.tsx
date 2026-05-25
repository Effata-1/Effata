import { createClient } from '@/lib/supabase/server'
import type { GenAIPolicy } from '@/lib/genai/types'
import { PolicyList } from './_components/policy-list'

export default async function GenAIPoliciesPage() {
  const supabase = await createClient()

  const sessionResult = await supabase.auth.getSession()
  const orgId: string | null = sessionResult.data.session?.access_token
    ? (JSON.parse(atob(sessionResult.data.session.access_token.split('.')[1]))?.org_id ?? null)
    : null

  const [policyResult, categoryResult] = await Promise.all([
    orgId
      ? supabase
          .from('org_genai_policies')
          .select('*')
          .eq('org_id', orgId)
          .order('priority')
          .order('created_at')
      : Promise.resolve({ data: [] as GenAIPolicy[] }),
    orgId
      ? supabase
          .from('org_genai_governance_categories')
          .select('id, system_tag, name, color')
          .eq('org_id', orgId)
          .eq('active', true)
          .order('priority')
      : Promise.resolve({ data: [] as Array<{ id: string; system_tag: string | null; name: string; color: string }> }),
  ])

  const policies   = (policyResult.data   ?? []) as GenAIPolicy[]
  const categories = (categoryResult.data ?? []) as Array<{ id: string; system_tag: string | null; name: string; color: string }>

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Policy Library</h1>
          <p className="text-sm text-muted-foreground/70 mt-0.5">
            Named governance policies documenting how GenAI apps are approved and controlled.
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-2xl font-bold text-foreground">{policies.length}</p>
          <p className="text-xs text-muted-foreground/60">
            {policies.filter(p => p.approval_status === 'approved').length} approved
          </p>
        </div>
      </div>

      {!orgId && (
        <p className="text-sm text-muted-foreground/60">Sign in to manage your organisation&apos;s policies.</p>
      )}

      {orgId && (
        <PolicyList policies={policies} categories={categories} />
      )}
    </div>
  )
}
