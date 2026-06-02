import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { checkNetskopeReadiness } from './_lib/readiness'
import type { OrgVendorObjectMappingRow } from './_lib/readiness'
import { NetskopeVendorMappingClient } from './_components/netskope-mapping-client'

export default async function NetskopeVendorMappingPage() {
  const user     = await requireRole('admin')
  const supabase = await createClient()

  const [
    mappingsResult,
    categoriesResult,
    labelsResult,
    orgPoliciesResult,
    translationsResult,
  ] = await Promise.all([
    supabase
      .from('org_vendor_object_mappings')
      .select('*')
      .eq('org_id', user.orgId)
      .eq('vendor_id', 'netskope')
      .eq('is_active', true)
      .order('neutral_object_type')
      .order('neutral_object_key'),
    supabase
      .from('org_genai_governance_categories')
      .select('id, name, system_tag')
      .eq('org_id', user.orgId)
      .eq('active', true)
      .order('priority'),
    supabase
      .from('org_customer_sensitivity_labels')
      .select('id, display_name, label_key, label_source')
      .eq('org_id', user.orgId)
      .eq('active', true)
      .order('priority'),
    supabase
      .from('org_genai_policies')
      .select('id, neutral_policy_json')
      .eq('org_id', user.orgId),
    supabase
      .from('org_vendor_translations')
      .select('mapping_report, status')
      .eq('org_id', user.orgId)
      .eq('vendor_id', 'netskope'),
  ])

  const mappings     = (mappingsResult.data    ?? []) as OrgVendorObjectMappingRow[]
  const categories   = (categoriesResult.data  ?? []) as Array<{ id: string; name: string; system_tag: string | null }>
  const orgLabels    = (labelsResult.data       ?? []) as Array<{ id: string; display_name: string; label_key: string; label_source: string }>
  const orgPolicies  = (orgPoliciesResult.data  ?? []) as Array<{ id: string; neutral_policy_json: unknown }>
  const translations = (translationsResult.data ?? []) as Array<{ mapping_report: Record<string, unknown> | null; status: string }>

  const readiness = checkNetskopeReadiness({ policies: orgPolicies, mappings, translations })

  const SENSITIVITY_LEVELS = ['secret', 'highly-confidential', 'confidential', 'internal', 'public'] as const

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Netskope Vendor Mapping</h1>
        <p className="text-sm text-muted-foreground/70 mt-1">
          Map Effata policy concepts to your Netskope tenant objects. These mappings are used at translation time
          to produce exact, deployment-ready Netskope policy output instead of generic placeholders.
        </p>
      </div>

      {/* Readiness chips */}
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-medium">
          Vendor: Netskope
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-medium">
          Catalog: v0.1
        </span>
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-medium ${
          readiness.status === 'ready'     ? 'bg-green-50 text-green-700 border border-green-200' :
          readiness.status === 'partial'   ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                                             'bg-red-50 text-red-700 border border-red-200'
        }`}>
          Completeness: {readiness.score}%
        </span>
        {readiness.critical_gaps.length > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-50 text-red-700 border border-red-200 px-2.5 py-1 font-medium">
            Critical gaps: {readiness.critical_gaps.length}
          </span>
        )}
      </div>

      {readiness.critical_gaps.length > 0 && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3">
          <p className="text-xs font-semibold text-red-800 mb-1">Critical mapping gaps — translations are incomplete:</p>
          <ul className="space-y-0.5">
            {readiness.critical_gaps.map((gap, i) => (
              <li key={i} className="text-xs text-red-700">{gap}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Recommendation engine link */}
      <div className="flex items-center justify-between rounded-xl border border-border bg-card/50 px-5 py-3.5">
        <div>
          <p className="text-sm font-semibold text-foreground">Policy Recommendation Engine</p>
          <p className="text-xs text-muted-foreground/60 mt-0.5">
            Generate the recommended Netskope 5-policy hybrid topology from your active control matrix.
          </p>
        </div>
        <Link
          href="/genai-controls/vendor-mapping/netskope/recommendation"
          className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-blue-500/30 bg-blue-500/10 text-xs font-medium text-blue-400 hover:bg-blue-500/15 transition-colors"
        >
          View Recommendation →
        </Link>
      </div>

      <NetskopeVendorMappingClient
        mappings={mappings}
        categories={categories}
        sensitivityLevels={[...SENSITIVITY_LEVELS]}
        orgLabels={orgLabels}
        readiness={readiness}
      />
    </div>
  )
}
