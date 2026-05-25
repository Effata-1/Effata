import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { cn } from '@/lib/utils'
import { ControlMatrixClient, ACTIONS } from './_components/control-matrix-client'
import type { MatrixCategory, MatrixOverride } from './_components/control-matrix-client'

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
    .select('id, system_tag, name, color')
    .eq('org_id', user.orgId)
    .eq('active', true)
    .order('priority')

  const categories: MatrixCategory[] = (catRows ?? []) as MatrixCategory[]

  const { data: overrideRows } = await supabase
    .from('org_control_matrix_overrides')
    .select('data_type, category_id, action_code')
    .eq('org_id', user.orgId)

  const overrides: MatrixOverride[] = (overrideRows ?? []) as MatrixOverride[]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Control Matrix</h1>
        <p className="text-sm text-muted-foreground/80 mt-1">
          DLP enforcement actions by activity and data sensitivity, mapped across your GenAI governance categories. Rows are grouped by Post/Prompt, Upload (by data classification label), and Upload (by filename detection). Click any cell to override the recommended default.
        </p>
      </div>

      {/* Legend */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wide">Action legend</p>
        <Legend />
      </div>

      {/* Editable matrix */}
      <ControlMatrixClient categories={categories} overrides={overrides} />

      {/* Footnote */}
      <p className="text-xs text-muted-foreground/50">
        Changes save instantly. Use the reset icon (↺) on any cell to restore the recommended default. Columns auto-update when you add or rename categories in{' '}
        <a href="/genai-controls/app-governance" className="underline hover:text-muted-foreground/80 transition-colors">App Governance → Manage Categories</a>.
      </p>
    </div>
  )
}
