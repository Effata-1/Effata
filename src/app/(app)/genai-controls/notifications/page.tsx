import { createClient } from '@/lib/supabase/server'
import { NotificationList } from './_components/notification-list'
import { upsertNotification } from './actions'
import type { CoachingNotification } from '@/lib/genai/types'

const SEED_DEFAULTS = [
  {
    name:        'AI Acceptable Use Policy',
    action_code: 'coach' as const,
    tone:        'informational' as const,
    title:       'AI Acceptable Use Policy — please review before proceeding',
    message:     "You're about to send data to {{app_name}}. Before proceeding, please review your organisation's AI Acceptable Use Policy to ensure this application is approved for your use case. If you have a legitimate business need, you can request an exception via the IT portal.",
    is_default:  true,
  },
  {
    name:        'GenAI Confidential Data Upload',
    action_code: 'coach-ack' as const,
    tone:        'warning' as const,
    title:       'Confidential data detected — {{app_name}}',
    message:     "We detected an attempt to share Confidential information with {{app_name}}. Confidential data must not be shared with external AI tools without explicit approval. Please review the AI Acceptable Use Policy. If you need to work with this data using AI, please use an approved and supported solution.",
    is_default:  true,
  },
  {
    name:        'GenAI Highly Confidential Data Upload',
    action_code: 'coach-just' as const,
    tone:        'warning' as const,
    title:       'Sensitive information sharing — {{data_type}} detected',
    message:     "We detected an attempt to share sensitive information (classified as Highly Confidential) with {{app_name}}. This is not permitted under the Company AI Policy. If you really need to use this type of information with an AI application, please use a solution that is Permitted & Supported under the AI Acceptable Use Framework. If you believe this detection is incorrect, you can raise an exception request via the IT portal.",
    is_default:  true,
  },
  {
    name:        'GenAI Secret Data Upload',
    action_code: 'coach-just' as const,
    tone:        'urgent' as const,
    title:       'Sensitive information sharing — secrets or credentials detected',
    message:     "We detected an attempt to share sensitive information (secrets, keys, tokens, certificates, etc.) with {{app_name}}. This is not permitted under the Company AI Policy and Security Policies & Standards Framework. If you believe this detection is incorrect and would like to request an exception, you can raise a Network & Security Request via the IT portal. For additional information, please contact your compliance team.",
    is_default:  true,
  },
  {
    name:        'Prohibited GenAI App',
    action_code: 'coach' as const,
    tone:        'urgent' as const,
    title:       'Prohibited AI application — {{app_name}} is not approved',
    message:     "{{app_name}} is not approved for use in your organisation. Access to this application is restricted under the Company AI Policy. If you have a business need for this tool, please raise an exception request via the IT portal. For a list of approved AI applications, refer to the AI Acceptable Use Framework.",
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
