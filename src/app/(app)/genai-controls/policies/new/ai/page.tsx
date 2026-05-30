import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { ensureClassificationLabels } from '@/lib/data-catalog/actions'
import { AiPolicyAssistant } from './_components/ai-policy-assistant'
import type { RuleItem } from '../_components/blank-policy-wizard'

export default async function AiPolicyPage() {
  const user = await requireRole('analyst')
  const supabase = await createClient()

  const [
    appsResult,
    categoriesResult,
    classificationLabels,
    orgTypesResult,
    orgTypeMappingsResult,
    catalogTypesResult,
    vendorsResult,
  ] = await Promise.all([
    supabase
      .from('genai_apps')
      .select('app_id, app_name, vendor, app_type, logo_letter, logo_bg')
      .order('app_name'),
    supabase
      .from('org_genai_governance_categories')
      .select('id, system_tag, name, color')
      .eq('org_id', user.orgId)
      .eq('active', true)
      .order('priority'),
    ensureClassificationLabels(),
    supabase
      .from('org_data_types')
      .select('id, name, catalog_data_type_id')
      .eq('org_id', user.orgId)
      .eq('is_in_scope', true)
      .order('name'),
    supabase
      .from('org_data_type_classifications')
      .select('org_data_type_id, org_classification_label_id')
      .eq('org_id', user.orgId),
    supabase
      .from('catalog_data_types')
      .select('id, name, system_level, subcategory')
      .eq('active', true)
      .order('priority')
      .order('name'),
    supabase
      .from('onboarding_profiles')
      .select('tools')
      .eq('org_id', user.orgId)
      .maybeSingle(),
  ])

  const apps       = appsResult.data     ?? []
  const categories = categoriesResult.data ?? []
  const vendors    = (vendorsResult.data?.tools ?? []) as string[]
  const orgTypes   = orgTypesResult.data ?? []
  const orgTypeMappings = orgTypeMappingsResult.data ?? []
  const catalogTypes = catalogTypesResult.data ?? []

  const orgTypeLabelMap = new Map(
    orgTypeMappings.map(m => [m.org_data_type_id as string, m.org_classification_label_id as string]),
  )
  const coveredCatalogIds = new Set(orgTypes.map(t => t.catalog_data_type_id).filter(Boolean))

  const ruleItems: RuleItem[] = [
    ...classificationLabels.map(l => ({
      key:        `label:${l.system_level ?? l.id}`,
      name:       l.name,
      kind:       'label' as const,
      color:      l.color,
      layer:      1 as const,
      layerLabel: undefined as string | undefined,
    })),
    ...orgTypes.map(dt => {
      const labelId = orgTypeLabelMap.get(dt.id)
      const label   = classificationLabels.find(l => l.id === labelId)
      return {
        key:        `dt:${dt.id}`,
        name:       dt.name,
        kind:       'type' as const,
        color:      label?.color ?? 'zinc',
        layer:      2 as const,
        layerLabel: label?.name,
      }
    }),
    ...catalogTypes
      .filter(c => !coveredCatalogIds.has(c.id))
      .map(c => {
        const matchingLabel = classificationLabels.find(l => l.system_level === c.system_level)
        return {
          key:        `cat:${c.id}`,
          name:       c.name,
          kind:       'catalog' as const,
          color:      matchingLabel?.color ?? 'zinc',
          layer:      3 as const,
          layerLabel: matchingLabel?.name,
        }
      }),
  ]

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/genai-controls/policies"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground/80 hover:text-foreground/70 transition-colors mb-3"
        >
          <ChevronLeft className="h-3 w-3" /> Policy Library
        </Link>
        <h1 className="text-xl font-bold text-foreground">AI-Assisted Policy</h1>
        <p className="text-sm text-muted-foreground/70 mt-0.5">
          Describe what you need — AI drafts a full structured proposal for your review before anything is created.
        </p>
      </div>

      <AiPolicyAssistant
        apps={apps}
        categories={categories}
        ruleItems={ruleItems}
        vendors={vendors}
      />
    </div>
  )
}
