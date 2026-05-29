import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { PolicyBuilder } from '../../new/_components/policy-builder'
import { PolicyIntentEditor } from './_components/policy-intent-editor'
import { getIdentityPageData } from '@/app/(app)/policies/identity/actions'
import { ensureClassificationLabels } from '@/lib/data-catalog/actions'
import type { RuleItem } from '../../new/_components/policy-builder'
import type { PolicyRule, ActionCode } from '@/lib/genai/types'

// ── Neutral-policy-json shape (minimal — only fields we read here) ─────────────
interface NpjCondition { type: string; sensitivity?: string }
interface NpjDecision  { mode?: string; require_acknowledgement?: boolean; require_justification?: boolean }
interface NpjShape     { scope?: { activities?: string[] }; content?: { conditions?: NpjCondition[] }; decision?: NpjDecision }

function npjDecisionToAction(d: NpjDecision): ActionCode {
  if (d.mode === 'block')   return 'block'
  if (d.mode === 'alert')   return 'alert'
  if (d.mode === 'monitor') return 'monitor'
  if (d.mode === 'allow')   return 'allow'
  if (d.mode === 'coach') {
    if (d.require_justification)   return 'coach-just'
    if (d.require_acknowledgement) return 'coach-ack'
    return 'coach'
  }
  return 'not-set'
}

export default async function EditPolicyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user     = await requireRole('analyst')
  const supabase = await createClient()

  const [
    policyResult,
    appsResult,
    categoriesResult,
    classificationsResult,
    identityData,
    classificationLabels,
    orgTypesResult,
    orgTypeMappingsResult,
    catalogTypesResult,
    coachingTemplatesResult,
    allPoliciesResult,
    translationsResult,
  ] = await Promise.all([
    supabase.from('org_genai_policies').select('*').eq('id', id).eq('org_id', user.orgId).single(),
    supabase.from('genai_apps').select('app_id, app_name, vendor, app_type, logo_letter, logo_bg').order('app_name'),
    supabase.from('org_genai_governance_categories').select('id, system_tag, name, color').eq('org_id', user.orgId).eq('active', true).order('priority'),
    supabase.from('org_customer_classifications').select('app_id, customer_classification').eq('org_id', user.orgId),
    getIdentityPageData(),
    ensureClassificationLabels(),
    supabase.from('org_data_types').select('id, name, catalog_data_type_id').eq('org_id', user.orgId).eq('is_in_scope', true).order('name'),
    supabase.from('org_data_type_classifications').select('org_data_type_id, org_classification_label_id').eq('org_id', user.orgId),
    supabase.from('catalog_data_types').select('id, name, system_level, subcategory').eq('active', true).order('priority').order('name'),
    supabase.from('org_coaching_notifications').select('id, name, coach_label').eq('org_id', user.orgId).order('name'),
    supabase.from('org_genai_policies').select('id, name').eq('org_id', user.orgId).order('priority'),
    supabase.from('org_vendor_translations').select('id, vendor_id, status, neutral_policy_hash').eq('policy_id', id).eq('org_id', user.orgId),
  ])

  if (!policyResult.data) notFound()

  const policy            = policyResult.data
  const apps              = appsResult.data              ?? []
  const categories        = categoriesResult.data        ?? []
  const classifications   = classificationsResult.data   ?? []
  const orgTypes          = orgTypesResult.data          ?? []
  const orgTypeMappings   = orgTypeMappingsResult.data   ?? []
  const catalogTypes      = catalogTypesResult.data      ?? []
  const coachingTemplates = coachingTemplatesResult.data ?? []
  const allPolicies       = allPoliciesResult.data       ?? []
  const translations      = translationsResult.data      ?? []

  // ── Governance-matrix policies → PolicyIntentEditor ─────────────────────────
  if (policy.generated_from === 'governance-matrix') {
    return (
      <PolicyIntentEditor
        policy={{
          id:                        policy.id,
          name:                      policy.name,
          description:               policy.description,
          is_active:                 policy.is_active,
          approval_status:           policy.approval_status,
          category_id:               policy.category_id,
          scope_app_ids:             policy.scope_app_ids ?? [],
          identity_context:          policy.identity_context,
          policy_family:             policy.policy_family ?? null,
          generated_from:            policy.generated_from ?? null,
          data_classification_label: policy.data_classification_label ?? null,
          fallback_action:           policy.fallback_action ?? null,
          coaching_template_id:      policy.coaching_template_id ?? null,
          vendor_translation_status: policy.vendor_translation_status ?? 'pending',
          required_dependencies:     policy.required_dependencies ?? [],
          test_status:               policy.test_status ?? 'untested',
          neutral_policy_json:       (policy.neutral_policy_json as Record<string, unknown>) ?? {},
          policy_key:                (policy as Record<string, unknown>).policy_key as string | null ?? null,
          neutral_policy_hash:       (policy as Record<string, unknown>).neutral_policy_hash as string | null ?? null,
          updated_at:                policy.updated_at,
        }}
        apps={apps}
        categories={categories}
        classificationLabels={classificationLabels.map(l => ({
          id:           l.id,
          system_level: l.system_level,
          name:         l.name,
          color:        l.color,
        }))}
        coachingTemplates={coachingTemplates}
        allPolicies={allPolicies}
        translations={translations}
      />
    )
  }

  // ── Other policies (manual / policy-pack-agent / legacy) → PolicyBuilder ────

  const orgTypeLabelMap = new Map(
    orgTypeMappings.map(m => [m.org_data_type_id as string, m.org_classification_label_id as string]),
  )
  const coveredCatalogIds = new Set(orgTypes.map(t => t.catalog_data_type_id).filter(Boolean))

  const ruleItems: RuleItem[] = [
    ...classificationLabels.map(l => ({
      key:         `label:${l.system_level ?? l.id}`,
      name:        l.name,
      kind:        'label' as const,
      color:       l.color,
      layer:       1 as const,
      layerLabel:  undefined as string | undefined,
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

  // When rules are empty (compiler-generated policies), synthesize them from
  // neutral_policy_json.content.conditions so DataProfileSection pre-populates.
  const effectiveRules: PolicyRule[] = (() => {
    const saved = (policy.rules ?? []) as PolicyRule[]
    if (saved.length > 0) return saved

    const npj = policy.neutral_policy_json as NpjShape | null
    const conditions = npj?.content?.conditions ?? []
    const dataConditions = conditions.filter(c => c.type === 'data_type' && c.sensitivity)
    if (dataConditions.length === 0) return saved

    const sensitivities = [...new Set(dataConditions.map(c => c.sensitivity!))]
    const actionCode    = npjDecisionToAction(npj?.decision ?? {})
    const acts          = npj?.scope?.activities ?? []

    const postPrompt: ActionCode = acts.some(a => a === 'post' || a === 'prompt_submit') ? actionCode : 'not-set'
    const upload: ActionCode     = acts.includes('upload')   ? actionCode : 'not-set'
    const download: ActionCode   = acts.includes('download') ? actionCode : 'not-set'
    const response: ActionCode   = acts.includes('response') ? actionCode : 'not-set'

    return sensitivities.map(s => ({
      data_type:   `label:${s}`,
      post_prompt: postPrompt,
      upload,
      download,
      response,
    }))
  })()

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
        <h1 className="text-xl font-bold text-foreground">Edit Policy</h1>
        <p className="text-sm text-muted-foreground/70 mt-0.5 truncate">{policy.name}</p>
      </div>

      <PolicyBuilder
        apps={apps}
        categories={categories}
        classifications={classifications}
        identityFields={identityFields}
        ruleItems={ruleItems}
        coachingTemplates={coachingTemplates}
        allPolicies={allPolicies}
        initialPolicy={{
          id:               policy.id,
          name:             policy.name,
          description:      policy.description,
          is_active:        policy.is_active,
          approval_status:  policy.approval_status,
          category_id:      policy.category_id,
          scope_app_ids:    policy.scope_app_ids ?? [],
          rules:            effectiveRules,
          identity_context: policy.identity_context,
          // migration 052
          policy_family:             policy.policy_family ?? null,
          generated_from:            policy.generated_from ?? null,
          data_classification_label: policy.data_classification_label ?? null,
          fallback_action:           policy.fallback_action ?? null,
          coaching_template_id:      policy.coaching_template_id ?? null,
          vendor_translation_status: policy.vendor_translation_status ?? 'pending',
          required_dependencies:     policy.required_dependencies ?? [],
          test_status:               policy.test_status ?? 'untested',
        }}
      />
    </div>
  )
}
