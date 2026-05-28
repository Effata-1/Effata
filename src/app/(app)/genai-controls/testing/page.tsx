import { createClient } from '@/lib/supabase/server'
import { TestingLab } from './_components/testing-lab'
import type { GenAIPolicy, CoachingNotification } from '@/lib/genai/types'

export default async function TestingLabPage() {
  const supabase = await createClient()

  const sessionResult = await supabase.auth.getSession()
  const orgId: string | null = sessionResult.data.session?.access_token
    ? (JSON.parse(atob(sessionResult.data.session.access_token.split('.')[1]))?.org_id ?? null)
    : null

  const [
    policiesResult,
    appsResult,
    notificationsResult,
    labelsResult,
    orgTypesResult,
    catalogTypesResult,
    orgTypeMappingsResult,
  ] = await Promise.all([
    orgId
      ? supabase.from('org_genai_policies').select('*').eq('org_id', orgId).eq('is_active', true).order('priority')
      : Promise.resolve({ data: [] as GenAIPolicy[] }),
    supabase.from('genai_apps').select('app_id, app_name, vendor, domain, logo_letter, logo_bg, logo_url').order('app_name'),
    orgId
      ? supabase.from('org_coaching_notifications').select('*').eq('org_id', orgId).eq('is_active', true)
      : Promise.resolve({ data: [] as CoachingNotification[] }),
    orgId
      ? supabase.from('org_classification_labels').select('id, name, system_level, priority').eq('org_id', orgId).eq('active', true).order('priority')
      : Promise.resolve({ data: [] }),
    orgId
      ? supabase.from('org_data_types').select('id, name, catalog_data_type_id').eq('org_id', orgId).eq('is_in_scope', true).order('name')
      : Promise.resolve({ data: [] }),
    supabase.from('catalog_data_types').select('id, name, system_level').eq('active', true).order('priority').order('name'),
    orgId
      ? supabase.from('org_data_type_classifications').select('org_data_type_id, org_classification_label_id').eq('org_id', orgId)
      : Promise.resolve({ data: [] }),
  ])

  const policies      = (policiesResult.data      ?? []) as GenAIPolicy[]
  const apps          = appsResult.data            ?? []
  const notifications = (notificationsResult.data  ?? []) as CoachingNotification[]
  const labels        = (labelsResult.data         ?? []) as Array<{ id: string; name: string; system_level: string | null; priority: number }>
  const orgTypes      = (orgTypesResult.data       ?? []) as Array<{ id: string; name: string; catalog_data_type_id: string | null }>
  const catalogTypes  = (catalogTypesResult.data   ?? []) as Array<{ id: string; name: string; system_level: string | null }>

  const coveredCatalogIds = new Set(orgTypes.map(t => t.catalog_data_type_id).filter(Boolean))

  // Build data type options matching exactly the keys stored in policy rules
  const dataTypeOptions: { key: string; label: string; group: string }[] = [
    ...labels.map(l => ({
      key:   `label:${l.system_level ?? l.id}`,
      label: l.name,
      group: 'Classification Labels',
    })),
    ...orgTypes.map(dt => ({
      key:   `dt:${dt.id}`,
      label: dt.name,
      group: 'Your Data Types',
    })),
    ...catalogTypes
      .filter(c => !coveredCatalogIds.has(c.id))
      .map(c => ({
        key:   `cat:${c.id}`,
        label: c.name,
        group: 'Catalog Types',
      })),
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Testing Lab</h1>
        <p className="text-sm text-muted-foreground/70 mt-0.5">
          Simulate a policy decision — select an app, data type, and activity to see which action fires.
        </p>
      </div>

      <TestingLab
        policies={policies}
        apps={apps}
        notifications={notifications}
        dataTypeOptions={dataTypeOptions}
      />
    </div>
  )
}
