import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PolicyBuilder } from './_components/policy-builder'

export default async function NewPolicyPage() {
  const supabase = await createClient()

  const sessionResult = await supabase.auth.getSession()
  const orgId: string | null = sessionResult.data.session?.access_token
    ? (JSON.parse(atob(sessionResult.data.session.access_token.split('.')[1]))?.org_id ?? null)
    : null

  const [appsResult, categoriesResult] = await Promise.all([
    supabase
      .from('genai_apps')
      .select('app_id, app_name, vendor, app_type, logo_letter, logo_bg')
      .order('app_name'),
    orgId
      ? supabase
          .from('org_genai_governance_categories')
          .select('id, system_tag, name, color')
          .eq('org_id', orgId)
          .eq('active', true)
          .order('priority')
      : Promise.resolve({ data: [] as Array<{ id: string; system_tag: string | null; name: string; color: string }> }),
  ])

  const apps       = appsResult.data       ?? []
  const categories = categoriesResult.data ?? []

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

      <PolicyBuilder apps={apps} categories={categories} />
    </div>
  )
}
