import { createClient } from '@/lib/supabase/server'
import { TestingLab } from './_components/testing-lab'
import type { GenAIPolicy, CoachingNotification } from '@/lib/genai/types'

export default async function TestingLabPage() {
  const supabase = await createClient()

  const sessionResult = await supabase.auth.getSession()
  const orgId: string | null = sessionResult.data.session?.access_token
    ? (JSON.parse(atob(sessionResult.data.session.access_token.split('.')[1]))?.org_id ?? null)
    : null

  const [policiesResult, appsResult, notificationsResult] = await Promise.all([
    orgId
      ? supabase
          .from('org_genai_policies')
          .select('*')
          .eq('org_id', orgId)
          .eq('is_active', true)
          .order('priority')
      : Promise.resolve({ data: [] as GenAIPolicy[] }),
    supabase
      .from('genai_apps')
      .select('app_id, app_name, vendor, domain, logo_letter, logo_bg, logo_url')
      .order('app_name'),
    orgId
      ? supabase
          .from('org_coaching_notifications')
          .select('*')
          .eq('org_id', orgId)
          .eq('is_active', true)
      : Promise.resolve({ data: [] as CoachingNotification[] }),
  ])

  const policies      = (policiesResult.data      ?? []) as GenAIPolicy[]
  const apps          = appsResult.data            ?? []
  const notifications = (notificationsResult.data  ?? []) as CoachingNotification[]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Testing Lab</h1>
        <p className="text-sm text-muted-foreground/70 mt-0.5">
          Simulate a policy decision — select an app, data type, and activity to see which action fires.
        </p>
      </div>

      <TestingLab policies={policies} apps={apps} notifications={notifications} />
    </div>
  )
}
