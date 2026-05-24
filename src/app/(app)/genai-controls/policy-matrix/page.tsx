import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { cn } from '@/lib/utils'
import { colorClasses } from '@/lib/data-catalog/types'
import type { GenAIGovernanceCategory } from '../app-governance/actions'

// ── Action types ─────────────────────────────────────────────────────────────

type ActionCode = 'allow' | 'allow-alert' | 'allow-approved' | 'allow-monitor' | 'coach' | 'block' | 'block-coach' | 'block-exception'

interface Action {
  code: ActionCode
  label: string
}

const ACTIONS: Record<ActionCode, { label: string; cell: string; text: string }> = {
  'allow':          { label: 'Allow',           cell: 'bg-emerald-500/10 border-emerald-500/20', text: 'text-emerald-400' },
  'allow-alert':    { label: 'Allow + Alert',    cell: 'bg-green-500/10 border-green-500/20',    text: 'text-green-400' },
  'allow-approved': { label: 'Allow if Approved',cell: 'bg-green-500/10 border-green-500/20',    text: 'text-green-400' },
  'allow-monitor':  { label: 'Allow / Monitor',  cell: 'bg-blue-500/10 border-blue-500/20',      text: 'text-blue-400' },
  'coach':          { label: 'Coach',            cell: 'bg-amber-500/10 border-amber-500/20',    text: 'text-amber-400' },
  'block':          { label: 'Block',            cell: 'bg-red-500/10 border-red-500/20',        text: 'text-red-400' },
  'block-coach':    { label: 'Block / Coach',    cell: 'bg-red-500/10 border-red-500/20',        text: 'text-red-400' },
  'block-exception':{ label: 'Block / Exception',cell: 'bg-purple-500/10 border-purple-500/20',  text: 'text-purple-400' },
}

// ── Matrix data ───────────────────────────────────────────────────────────────
// Columns: enterprise-approved | approved-with-conditions | permitted-with-restriction | prohibited | personal

const MATRIX: { dataType: string; classification: string; actions: ActionCode[] }[] = [
  { dataType: 'Public Data',          classification: 'public',             actions: ['allow',          'allow',   'coach',       'block', 'allow-monitor'] },
  { dataType: 'Internal Data',        classification: 'internal',           actions: ['allow',          'coach',   'block',       'block', 'coach'] },
  { dataType: 'Confidential',         classification: 'confidential',       actions: ['allow-alert',    'block',   'block',       'block', 'block'] },
  { dataType: 'Highly Confidential',  classification: 'highly_confidential',actions: ['block-exception','block',   'block',       'block', 'block'] },
  { dataType: 'Secret / Keys',        classification: 'secret',             actions: ['block',          'block',   'block',       'block', 'block'] },
  { dataType: 'Credentials & Tokens', classification: 'secret',             actions: ['block',          'block',   'block',       'block', 'block'] },
  { dataType: 'PCI Data',             classification: 'highly_confidential',actions: ['block',          'block',   'block',       'block', 'block'] },
  { dataType: 'Low-volume PII',       classification: 'confidential',       actions: ['coach',          'coach',   'block-coach', 'block', 'coach'] },
  { dataType: 'Bulk PII',             classification: 'highly_confidential',actions: ['block',          'block',   'block',       'block', 'block'] },
  { dataType: 'Source Code',          classification: 'confidential',       actions: ['allow-approved', 'block-coach','block',    'block', 'block'] },
]

const CLASS_COLORS: Record<string, string> = {
  public:             'text-green-400',
  internal:           'text-blue-400',
  confidential:       'text-amber-400',
  highly_confidential:'text-orange-400',
  secret:             'text-red-400',
}

const SYSTEM_TAG_ORDER = [
  'enterprise-approved',
  'approved-with-conditions',
  'permitted-with-restriction',
  'prohibited',
  'personal',
]

// ── Legend ────────────────────────────────────────────────────────────────────

function Legend() {
  return (
    <div className="flex flex-wrap gap-3">
      {(Object.entries(ACTIONS) as [ActionCode, (typeof ACTIONS)[ActionCode]][]).map(([, meta]) => (
        <div key={meta.label} className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium', meta.cell, meta.text)}>
          {meta.label}
        </div>
      ))}
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function PolicyMatrixPage() {
  await requireRole('analyst')
  const supabase = await createClient()

  const { data: session } = await supabase.auth.getSession()
  const orgId = session.session?.access_token
    ? JSON.parse(atob(session.session.access_token.split('.')[1]))?.org_id
    : null

  let categories: GenAIGovernanceCategory[] = []
  if (orgId) {
    const { data } = await supabase
      .from('org_genai_governance_categories')
      .select('*')
      .eq('org_id', orgId)
      .eq('active', true)
      .order('priority')
    categories = (data ?? []) as GenAIGovernanceCategory[]
  }

  // Sort by system_tag order; custom categories appended
  const orderedCats = [
    ...SYSTEM_TAG_ORDER.map(tag => categories.find(c => c.system_tag === tag)).filter(Boolean) as GenAIGovernanceCategory[],
    ...categories.filter(c => !c.system_tag),
  ]

  // Use defaults if no org categories seeded yet
  const DEFAULT_NAMES = [
    'Approved & Supported GenAI',
    'Approved with Conditions',
    'Restricted / Unassessed',
    'Prohibited GenAI',
    'Personal Instance',
  ]

  const colNames = orderedCats.length >= 5
    ? SYSTEM_TAG_ORDER.map(tag => orderedCats.find(c => c.system_tag === tag)?.name ?? tag)
    : DEFAULT_NAMES

  const colColors = orderedCats.length >= 5
    ? SYSTEM_TAG_ORDER.map(tag => orderedCats.find(c => c.system_tag === tag)?.color ?? 'zinc')
    : ['emerald', 'blue', 'amber', 'red', 'purple']

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Policy Matrix</h1>
        <p className="text-sm text-muted-foreground/80 mt-1">
          Recommended DLP actions by data classification × GenAI governance category. Column names reflect your org&apos;s category names.
        </p>
      </div>

      {/* Legend */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wide">Action legend</p>
        <Legend />
      </div>

      {/* Matrix table */}
      <div className="rounded-xl border border-border overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="border-b border-border bg-card">
                <th className="text-left text-xs text-muted-foreground/80 font-semibold uppercase tracking-wide px-5 py-4 w-44">
                  Data Type
                </th>
                {colNames.map((name, i) => {
                  const cc = colorClasses(colColors[i] ?? 'zinc')
                  return (
                    <th key={i} className="text-left px-4 py-4">
                      <span className={cn('text-xs font-semibold', cc.text)}>{name}</span>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {MATRIX.map((row, ri) => (
                <tr
                  key={ri}
                  className={cn('hover:bg-card/30 transition-colors', ri % 2 === 0 ? '' : 'bg-card/10')}
                >
                  <td className="px-5 py-3">
                    <p className="text-sm font-medium text-foreground">{row.dataType}</p>
                    <p className={cn('text-[10px] font-semibold uppercase tracking-wide mt-0.5', CLASS_COLORS[row.classification] ?? 'text-muted-foreground/60')}>
                      {row.classification.replace(/_/g, ' ')}
                    </p>
                  </td>
                  {row.actions.map((code, ci) => {
                    const meta = ACTIONS[code]
                    return (
                      <td key={ci} className="px-4 py-3">
                        <span className={cn(
                          'inline-flex items-center px-2.5 py-1 rounded-lg border text-xs font-semibold',
                          meta.cell,
                          meta.text,
                        )}>
                          {meta.label}
                        </span>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footnote */}
      <p className="text-xs text-muted-foreground/50">
        These are recommended defaults. Override DLP actions in your Netskope policy configuration. Column names are customisable from{' '}
        <a href="/genai-controls/app-governance" className="underline hover:text-muted-foreground/80 transition-colors">App Governance → Manage Categories</a>.
      </p>
    </div>
  )
}
