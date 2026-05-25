import { createClient } from '@/lib/supabase/server'
import { NotificationList } from './_components/notification-list'
import { upsertNotification } from './actions'
import type { CoachingNotification } from '@/lib/genai/types'

const SEED_DEFAULTS = [
  {
    name:        'AI Acceptable Use Policy',
    coach_label: 'Coach 1',
    action_code: 'coach' as const,
    tone:        'informational' as const,
    title:       'AI Acceptable Use Policy — please review before proceeding',
    message:     "You're about to send data to {{NS_APP}}. Before proceeding, please review your organisation's AI Acceptable Use Policy to ensure this application is approved for your use case. If you have a legitimate business need, you can request an exception via the IT portal.",
    is_default:  true,
  },
  {
    name:        'GenAI Confidential Data Upload',
    coach_label: 'Coach 2',
    action_code: 'coach-ack' as const,
    tone:        'warning' as const,
    title:       'Confidential data detected — {{NS_APP}}',
    message:     "We detected an attempt to share Confidential information with {{NS_APP}} (Policy: {{NS_POLICY_NAME}}). Confidential data must not be shared with external AI tools without explicit approval. Please review the AI Acceptable Use Policy before proceeding.",
    is_default:  true,
  },
  {
    name:        'GenAI Highly Confidential Data Upload',
    coach_label: 'Coach 3',
    action_code: 'coach-just' as const,
    tone:        'warning' as const,
    title:       'Sensitive information detected — {{NS_CATEGORY}}',
    message:     "We detected an attempt to share Highly Confidential information with {{NS_APP}} via {{NS_ACTIVITY}}. This is not permitted under the Company AI Policy. If you need to work with this data using AI, please use a Permitted & Supported solution. To request an exception, contact your IT team.",
    is_default:  true,
  },
  {
    name:        'GenAI Secret Data Upload',
    coach_label: 'Coach 4',
    action_code: 'coach-just' as const,
    tone:        'urgent' as const,
    title:       'Secrets or credentials detected — {{NS_APP}}',
    message:     "We detected an attempt to share sensitive information ({{NS_FILENAME}}) with {{NS_APP}} ({{NS_URL}}). Secrets, keys, tokens, and certificates must never be sent to external AI applications. This is not permitted under the Company AI Policy. Please contact your security team if this was not intentional.",
    is_default:  true,
  },
  {
    name:        'Prohibited GenAI App',
    coach_label: 'Coach 5',
    action_code: 'coach' as const,
    tone:        'urgent' as const,
    title:       'Prohibited AI application — {{NS_APP}} is not approved',
    message:     "{{NS_APP}} ({{NS_HOST}}) is not approved for use in your organisation. Access to this application is restricted under the Company AI Policy. If you have a business need for this tool, please raise an exception request via the IT portal.",
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

  try {
    const result = orgId
      ? await supabase
          .from('org_coaching_notifications')
          .select('*')
          .eq('org_id', orgId)
          .order('created_at')
      : { data: [] as CoachingNotification[] }
    notifications = (result.data ?? []) as CoachingNotification[]
  } catch {
    // Table may not exist yet — migration pending
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-bold text-foreground">Coaching Templates</h1>
        <p className="text-sm text-muted-foreground/70 mt-0.5">
          Messages shown to users when a DLP policy fires a coaching action. Edit each template to match your organisation&apos;s tone and policy links.
        </p>
      </div>

      <NotificationList notifications={notifications} />
    </div>
  )
}
