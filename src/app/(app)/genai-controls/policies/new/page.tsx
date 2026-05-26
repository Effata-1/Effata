import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { PolicyBuilder } from './_components/policy-builder'
import { getIdentityPageData } from '@/app/(app)/policies/identity/actions'
import { ensureClassificationLabels } from '@/lib/data-catalog/actions'
import type { RuleItem } from './_components/policy-builder'

export default async function NewPolicyPage() {
  const user = await requireRole('analyst')
  const supabase = await createClient()

  const [
    appsResult,
    categoriesResult,
    classificationsResult,
    identityData,
    classificationLabels,
    orgTypesResult,
    orgTypeMappingsResult,
    catalogTypesResult,
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
    supabase
      .from('org_customer_classifications')
      .select('app_id, customer_classification')
      .eq('org_id', user.orgId),
    getIdentityPageData(),
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
  ])

  const apps            = appsResult.data            ?? []
  const categories      = categoriesResult.data      ?? []
  const classifications = classificationsResult.data ?? []
  const orgTypes        = orgTypesResult.data        ?? []
  const orgTypeMappings = orgTypeMappingsResult.data ?? []
  const catalogTypes    = catalogTypesResult.data    ?? []

  // Map org data type ID → classification label ID
  const orgTypeLabelMap = new Map(
    orgTypeMappings.map(m => [m.org_data_type_id as string, m.org_classification_label_id as string]),
  )

  // Set of catalog_data_type_ids already covered by org data types
  const coveredCatalogIds = new Set(orgTypes.map(t => t.catalog_data_type_id).filter(Boolean))

  // Build rule items for all 3 layers
  const ruleItems: RuleItem[] = [
    // Layer 1 — Classification Labels
    ...classificationLabels.map(l => ({
      key:         `label:${l.system_level ?? l.id}`,
      name:        l.name,
      kind:        'label' as const,
      color:       l.color,
      layer:       1 as const,
      layerLabel:  undefined as string | undefined,
    })),

    // Layer 2 — Org Data Types (in scope, mapped to a label)
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

    // Layer 3 — Catalog types not yet added to org scope (reference only, still configurable)
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

  // Flatten identity fields to simple options for the picker
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
      <div>
        <Link
          href="/genai-controls/policies"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground/80 hover:text-foreground/70 transition-colors mb-3"
        >
          <ChevronLeft className="h-3 w-3" /> Policy Library
        </Link>
        <h1 className="text-xl font-bold text-foreground">New Policy</h1>
        <p className="text-sm text-muted-foreground/70 mt-0.5">
          Build a structured GenAI governance policy with app scope and DLP rules.
        </p>
      </div>

      <PolicyBuilder
        apps={apps}
        categories={categories}
        identityFields={identityFields}
        ruleItems={ruleItems}
        initialPolicy={null}
      />
    </div>
  )
}
