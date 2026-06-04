import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { ensureClassificationLabels } from '@/lib/data-catalog/actions'
import { getIdentityPageData } from '@/app/(app)/policies/identity/actions'
import { syncRecommendedPolicies } from './actions'
import { PolicyList } from './_components/policy-list'
import type { GenAIPolicy } from '@/lib/genai/types'
import type { RuleItem } from './new/_components/policy-builder'

export default async function GenAIPoliciesPage() {
  const user     = await requireRole('analyst')
  const supabase = await createClient()

  // Fetch labels once — shared with sync (avoids a duplicate DB call inside syncRecommendedPolicies)
  const classificationLabels = await ensureClassificationLabels().catch(() => [])
  try { await syncRecommendedPolicies(classificationLabels) } catch (e) { console.error('[policies/page] sync error:', e) }

  const [
    policyResult,
    categoryResult,
    appsResult,
    classificationsResult,
    orgTypesResult,
    orgTypeMappingsResult,
    catalogTypesResult,
    identityData,
  ] = await Promise.all([
    supabase.from('org_genai_policies').select('*').eq('org_id', user.orgId).order('priority').order('created_at'),
    supabase.from('org_genai_governance_categories').select('id, system_tag, name, color').eq('org_id', user.orgId).eq('active', true).order('priority'),
    supabase.from('genai_apps').select('app_id, app_name, vendor, logo_letter, logo_bg').order('app_name'),
    supabase.from('org_customer_classifications').select('app_id, customer_classification').eq('org_id', user.orgId),
    supabase.from('org_data_types').select('id, name, catalog_data_type_id').eq('org_id', user.orgId).eq('is_in_scope', true).order('name'),
    supabase.from('org_data_type_classifications').select('org_data_type_id, org_classification_label_id').eq('org_id', user.orgId),
    supabase.from('catalog_data_types').select('id, name, system_level, risk_family').eq('active', true).order('priority').order('name'),
    getIdentityPageData(),
  ])

  const policies        = (policyResult.data        ?? []) as GenAIPolicy[]
  const categories      = (categoryResult.data      ?? []) as Array<{ id: string; system_tag: string | null; name: string; color: string }>
  const apps            = appsResult.data            ?? []
  const classifications = classificationsResult.data ?? []
  const orgTypes        = orgTypesResult.data        ?? []
  const orgTypeMappings = orgTypeMappingsResult.data ?? []
  const catalogTypes    = catalogTypesResult.data    ?? []

  const orgTypeLabelMap = new Map(
    orgTypeMappings.map(m => [m.org_data_type_id as string, m.org_classification_label_id as string]),
  )
  const coveredCatalogIds = new Set(orgTypes.map(t => t.catalog_data_type_id).filter(Boolean))

  const ruleItems: RuleItem[] = [
    ...classificationLabels.map(l => ({
      key: `label:${l.system_level ?? l.id}`,
      name: l.name,
      kind: 'label' as const,
      color: l.color,
      layer: 1 as const,
      layerLabel: undefined as string | undefined,
    })),
    ...orgTypes.map(dt => {
      const labelId = orgTypeLabelMap.get(dt.id)
      const label   = classificationLabels.find(l => l.id === labelId)
      return {
        key: `dt:${dt.id}`,
        name: dt.name,
        kind: 'type' as const,
        color: label?.color ?? 'zinc',
        layer: 2 as const,
        layerLabel: label?.name,
      }
    }),
    ...catalogTypes
      .filter(c => !coveredCatalogIds.has(c.id))
      .map(c => {
        const matchingLabel = classificationLabels.find(l => l.system_level === c.system_level)
        return {
          key: `cat:${c.id}`,
          name: c.name,
          kind: 'catalog' as const,
          color: matchingLabel?.color ?? 'zinc',
          layer: 3 as const,
          layerLabel: matchingLabel?.name,
        }
      }),
  ]

  const identityFields = Object.fromEntries(
    identityData.fieldOrder.map(f => [
      f,
      (identityData.fields[f] ?? []).map(v => ({
        id:         v.id,
        field_name: v.field_name,
        value_name: v.value_name,
        risk_level: v.risk_level,
      })),
    ]),
  ) as Record<string, { id: string; field_name: string; value_name: string; risk_level: string }[]>

  return (
    <div className="space-y-6">
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

      <PolicyList
        policies={policies}
        categories={categories}
        apps={apps as { app_id: string; app_name: string; vendor: string; logo_letter: string; logo_bg: string }[]}
        classifications={classifications as { app_id: string; customer_classification: string }[]}
        identityFields={identityFields}
        ruleItems={ruleItems}
      />
    </div>
  )
}
