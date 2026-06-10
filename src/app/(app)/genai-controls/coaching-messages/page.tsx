import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { NotificationList } from './_components/notification-list'
import type { CoachingNotification } from '@/lib/genai/types'
import { SEED_DEFAULTS } from './_data/seeds'

function extractTokens(...inputs: (string | null | undefined)[]): string[] {
  const combined = inputs.filter(Boolean).join(' ')
  const matches = combined.match(/\{\{[A-Z_]+\}\}/g) ?? []
  return Array.from(new Set(matches))
}

async function ensureDefaultTemplates(orgId: string) {
  try {
    const supabase = await createClient()

    const { data: existing } = await supabase
      .from('org_coaching_notifications')
      .select('template_key')
      .eq('org_id', orgId)
      .not('template_key', 'is', null)

    const existingKeys = new Set((existing ?? []).map((r: { template_key: string | null }) => r.template_key))
    const missing = SEED_DEFAULTS.filter(t => !existingKeys.has(t.template_key))

    if (missing.length === 0) return

    // Insert directly via supabase client — do NOT go through upsertNotification (which
    // calls requireRole) so that seeding works regardless of the viewer's role.
    const rows = missing.map(t => ({
      org_id:              orgId,
      template_key:        t.template_key,
      name:                t.name,
      description:         t.description,
      control_type:        t.control_type,
      title:               t.title,
      subtitle:            t.subtitle,
      message:             t.message,
      show_exception_line: t.show_exception_line,
      show_details:        t.show_details,
      recommended_for:     t.recommended_for,
      tokens_used:         extractTokens(t.title, t.subtitle, t.message),
      action_code:         t.action_code,
      tone:                t.tone,
      is_default:          true,
      is_active:           true,
      updated_at:          new Date().toISOString(),
    }))

    await supabase.from('org_coaching_notifications').insert(rows)
  } catch {
    // Table may not exist yet — migration pending
  }
}

export default async function CoachingNotificationsPage() {
  const { orgId } = await requireRole('analyst')
  const supabase = await createClient()

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
          .order('is_default', { ascending: false })
          .order('created_at')
      : { data: [] as CoachingNotification[] }
    notifications = (result.data ?? []) as CoachingNotification[]
  } catch {
    // Table may not exist yet — migration pending
  }

  const activeCount = notifications.filter(n => n.is_active).length

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Coaching Message Templates</h1>
          <p className="text-sm text-muted-foreground/70 mt-0.5">
            Messages shown to users when a DLP policy triggers a coaching, block, or notification action.
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-2xl font-bold text-foreground">{notifications.length}</p>
          <p className="text-xs text-muted-foreground/60">{activeCount} active</p>
        </div>
      </div>

      <NotificationList notifications={notifications} />
    </div>
  )
}
