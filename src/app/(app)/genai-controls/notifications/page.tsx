import { createClient } from '@/lib/supabase/server'
import { NotificationList } from './_components/notification-list'
import { upsertNotification } from './actions'
import type { CoachingNotification } from '@/lib/genai/types'

const SEED_DEFAULTS = [
  {
    name:        'Default Coach',
    action_code: 'coach' as const,
    tone:        'informational' as const,
    title:       'Heads up — {{app_name}} may not be approved for this data',
    message:     "You're about to send {{data_type}} data to {{app_name}}. Review your org's GenAI policy before proceeding.",
    is_default:  true,
  },
  {
    name:        'Default Coach + Acknowledge',
    action_code: 'coach-ack' as const,
    tone:        'warning' as const,
    title:       'Acknowledgement required — {{data_type}} data detected',
    message:     "Sending {{data_type}} information to {{app_name}} is a policy risk. Please acknowledge that you have read your organisation's {{policy_name}} before continuing.",
    is_default:  true,
  },
  {
    name:        'Default Coach + Justify',
    action_code: 'coach-just' as const,
    tone:        'urgent' as const,
    title:       'Justification required — high-risk data transfer',
    message:     'Sending {{data_type}} data to {{app_name}} requires a written justification. Your submission will be logged for compliance review.',
    is_default:  true,
  },
]

async function ensureDefaultTemplates(orgId: string) {
  try {
    const supabase = await createClient()
    const { count } = await supabase
      .from('org_coaching_notifications')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgId)

    if ((count ?? 0) === 0) {
      await Promise.all(SEED_DEFAULTS.map(t => upsertNotification(null, t)))
    }
  } catch {
    // Table may not exist yet — migration pending
  }
}

export default async function CoachingNotificationsPage() {
  const supabase = await createClient()

  const sessionResult = await supabase.auth.getSession()
  const orgId: string | null = sessionResult.data.session?.access_token
    ? (JSON.parse(atob(sessionResult.data.session.access_token.split('.')[1]))?.org_id ?? null)
    : null

  if (orgId) {
    await ensureDefaultTemplates(orgId)
  }

  let notifications: CoachingNotification[] = []
  let policies: Array<{ id: string; name: string }> = []

  try {
    const [notificationsResult, policiesResult] = await Promise.all([
      orgId
        ? supabase
            .from('org_coaching_notifications')
            .select('*')
            .eq('org_id', orgId)
            .order('created_at')
        : Promise.resolve({ data: [] as CoachingNotification[] }),
      orgId
        ? supabase
            .from('org_genai_policies')
            .select('id, name')
            .eq('org_id', orgId)
            .eq('is_active', true)
            .order('name')
        : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
    ])
    notifications = (notificationsResult.data ?? []) as CoachingNotification[]
    policies      = policiesResult.data ?? []
  } catch {
    // Table may not exist yet — migration pending
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-xl font-bold text-foreground">Coaching Templates</h1>
        <p className="text-sm text-muted-foreground/70 mt-0.5">
          Reusable notification messages shown to users when a DLP policy fires a coaching action.
        </p>
      </div>

      <NotificationList notifications={notifications} policies={policies} />
    </div>
  )
}
