import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { PolicyBuilder } from './_components/policy-builder'
import { getIdentityPageData } from '@/app/(app)/policies/identity/actions'

export default async function NewPolicyPage() {
  const user = await requireRole('analyst')
  const supabase = await createClient()

  const [appsResult, categoriesResult, classificationsResult, identityData] = await Promise.all([
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
  ])

  const apps            = appsResult.data            ?? []
  const categories      = categoriesResult.data      ?? []
  const classifications = classificationsResult.data ?? []

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
    <div className="space-y-6 max-w-4xl">
      <div>
        <Link
          href="/genai-controls/policies"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground/80 hover:text-foreground/70 transition-colors mb-3"
        >
          <ChevronLeft className="h-3 w-3" /> Policy Library
        </Link>
        <h1 className="text-xl font-bold text-foreground">Policy Builder</h1>
        <p className="text-sm text-muted-foreground/70 mt-0.5">
          Build a structured GenAI governance policy with app scope and DLP rules.
        </p>
      </div>

      <PolicyBuilder
        apps={apps}
        categories={categories}
        classifications={classifications as { app_id: string; customer_classification: string }[]}
        identityFields={identityFields}
      />
    </div>
  )
}
