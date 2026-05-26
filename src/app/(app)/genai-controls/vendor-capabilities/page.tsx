import { createClient } from '@/lib/supabase/server'
import { CapabilityMatrix } from './_components/capability-matrix'
import type { AppFields, DLPActivities, AppGroup } from '@/lib/genai/types'

interface AppRow {
  app_id:      string
  app_name:    string
  vendor:      string
  logo_letter: string
  logo_bg:     string
  app_group:   AppGroup | null
  profile:     { fields: AppFields; dlp: DLPActivities } | null
}

export default async function VendorCapabilitiesPage() {
  const supabase = await createClient()

  const [appsResult, profilesResult] = await Promise.all([
    supabase
      .from('genai_apps')
      .select('app_id, app_name, vendor, logo_letter, logo_bg, app_group')
      .eq('status', 'active')
      .order('app_name'),
    supabase
      .from('genai_app_profiles')
      .select('app_id, fields, dlp'),
  ])

  const apps     = appsResult.data     ?? []
  const profiles = profilesResult.data ?? []

  const profileMap = new Map(profiles.map(p => [p.app_id, p as { app_id: string; fields: AppFields; dlp: DLPActivities }]))

  const rows: AppRow[] = apps.map(a => ({
    app_id:      a.app_id,
    app_name:    a.app_name,
    vendor:      a.vendor,
    logo_letter: a.logo_letter,
    logo_bg:     a.logo_bg,
    app_group:   (a.app_group as AppGroup | null) ?? null,
    profile:     profileMap.get(a.app_id) ?? null,
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Vendor Capabilities</h1>
        <p className="text-sm text-muted-foreground/70 mt-0.5">
          Compare security, DLP, and compliance capabilities across all active GenAI apps.
        </p>
      </div>

      <CapabilityMatrix rows={rows} />
    </div>
  )
}
