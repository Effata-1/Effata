import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { cn } from '@/lib/utils'
import { ControlMatrixClient, ACTIONS } from './_components/control-matrix-client'
import type { MatrixCategory, MatrixOverride } from './_components/control-matrix-client'
import { ensureClassificationLabels } from '@/lib/data-catalog/actions'
import type { OrgClassificationLabel } from '@/lib/data-catalog/types'

// ── Legend ────────────────────────────────────────────────────────────────────

function Legend() {
  return (
    <div className="flex flex-wrap gap-3">
      {(Object.entries(ACTIONS) as [string, typeof ACTIONS[keyof typeof ACTIONS]][])
        .filter(([code]) => code !== 'not-set')
        .map(([, meta]) => (
          <div key={meta.label} className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium', meta.cell, meta.text)}>
            {meta.label}
          </div>
        ))}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ControlMatrixPage() {
  const user = await requireRole('analyst')
  const supabase = await createClient()

  const { data: catRows } = await supabase
    .from('org_genai_governance_categories')
    .select('id, system_tag, name, color, access_posture')
    .eq('org_id', user.orgId)
    .eq('active', true)
    .order('priority')

  const categories: MatrixCategory[] = (catRows ?? []) as MatrixCategory[]

  const { data: overrideRows } = await supabase
    .from('org_control_matrix_overrides')
    .select('data_type, category_id, action_code, coaching_notification_id')
    .eq('org_id', user.orgId)

  const overrides: MatrixOverride[] = (overrideRows ?? []) as MatrixOverride[]

  const labels: OrgClassificationLabel[] = await ensureClassificationLabels()

  const { data: customerLabelRows } = await supabase
    .from('org_customer_sensitivity_labels')
    .select('id, display_name, color, system_level, priority')
    .eq('org_id', user.orgId)
    .eq('active', true)
    .order('priority')

  const customerLabels = (customerLabelRows ?? []) as {
    id: string; display_name: string; color: string; system_level: string | null; priority: number
  }[]

  const { data: notifRows } = await supabase
    .from('org_coaching_notifications')
    .select('id, name, coach_label, control_type')
    .eq('org_id', user.orgId)
    .eq('is_active', true)
    .order('created_at')

  const notifications = (notifRows ?? []) as { id: string; name: string; coach_label: string | null; control_type: string }[]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Control Matrix</h1>
        <p className="text-sm text-muted-foreground/80 mt-1">
          DLP enforcement actions by activity and data sensitivity, mapped across your GenAI governance categories. Each cell can also assign a coaching message shown to users when the action fires.
        </p>
      </div>

      {/* Legend */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wide">Action legend</p>
        <Legend />
      </div>

      {/* Editable matrix */}
      <ControlMatrixClient
        categories={categories}
        overrides={overrides}
        labels={labels}
        customerLabels={customerLabels}
        notifications={notifications}
      />

      {/* Footnote */}
      <p className="text-xs text-muted-foreground/50">
        Changes save instantly. Use the reset icon (↺) on any cell to restore the recommended default. Columns auto-update when you add or rename categories in{' '}
        <a href="/genai-controls/app-governance" className="underline hover:text-muted-foreground/80 transition-colors">App Governance → Manage Categories</a>.
        {' '}Coaching messages are managed in{' '}
        <a href="/genai-controls/notifications" className="underline hover:text-muted-foreground/80 transition-colors">Coaching Templates</a>.
      </p>
    </div>
  )
}
