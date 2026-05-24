import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { cn } from '@/lib/utils'
import { colorClasses } from '@/lib/data-catalog/types'
import type { GenAIGovernanceCategory } from '../app-governance/actions'

// ── Action types ─────────────────────────────────────────────────────────────

type ActionCode = 'allow' | 'allow-alert' | 'allow-approved' | 'allow-monitor' | 'coach' | 'block' | 'block-coach' | 'block-exception'

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

// ── Use cases ─────────────────────────────────────────────────────────────────

interface UseCase {
  num: number
  useCase: string
  intent: string
  category: string
  dataScope: string
  enforcement: string
  enforcementType: 'block' | 'allow' | 'coach' | 'mixed'
}

const USE_CASES: UseCase[] = [
  {
    num: 1,
    useCase: 'Block Access to Not-Permitted GenAI',
    intent: 'Prevent shadow AI adoption outside approved toolset',
    category: 'Prohibited',
    dataScope: 'Any',
    enforcement: 'Block + Coaching (L2)',
    enforcementType: 'block',
  },
  {
    num: 2,
    useCase: 'Block Upload of Secrets / Keys / Tokens',
    intent: 'Prevent critical secrets from leaking to any AI tool',
    category: 'Any',
    dataScope: 'Secrets, API keys, tokens, certificates',
    enforcement: 'Always Block + Coaching (L5)',
    enforcementType: 'block',
  },
  {
    num: 3,
    useCase: 'Allow Approved GenAI Apps',
    intent: 'Enable productivity for enterprise-approved tools',
    category: 'Approved & Supported',
    dataScope: 'All except Secrets & Keys',
    enforcement: 'Allow',
    enforcementType: 'allow',
  },
  {
    num: 4,
    useCase: 'Restrict to AD User Groups',
    intent: 'Limit access to authorised users only',
    category: 'Approved with Conditions + Approved & Supported',
    dataScope: 'Any',
    enforcement: 'Allow (auth AD group) / Block others',
    enforcementType: 'mixed',
  },
  {
    num: 5,
    useCase: 'Allow Confidential Data for AD Groups',
    intent: 'Business use of confidential data with governance controls',
    category: 'Approved with Conditions + Approved & Supported',
    dataScope: 'Confidential labelled documents',
    enforcement: 'Allow + Monitoring',
    enforcementType: 'allow',
  },
  {
    num: 6,
    useCase: 'AI Acceptable Use Policy Coaching',
    intent: 'Display policy at point of activity to drive awareness',
    category: 'Approved with Conditions',
    dataScope: 'Any',
    enforcement: 'Allow + Coaching (L1)',
    enforcementType: 'coach',
  },
  {
    num: 7,
    useCase: 'Block Highly Confidential & Secret to Conditional Apps',
    intent: 'Prevent leakage of most sensitive data to conditionally approved tools',
    category: 'Approved with Conditions / Restricted',
    dataScope: 'Highly Confidential & Secret labelled documents',
    enforcement: 'Block + Coaching (L4)',
    enforcementType: 'block',
  },
  {
    num: 8,
    useCase: 'Block Confidential Uploads to Restricted Apps',
    intent: 'Prevent leakage of confidential data to unassessed tools',
    category: 'Restricted / Unassessed',
    dataScope: 'Confidential labelled documents',
    enforcement: 'Block + Coaching (L4)',
    enforcementType: 'block',
  },
  {
    num: 9,
    useCase: 'Allow Public Data (All Approved Apps)',
    intent: 'Frictionless productivity for non-sensitive work',
    category: 'Approved & Supported / Conditions / Restricted',
    dataScope: 'Public information',
    enforcement: 'Allow',
    enforcementType: 'allow',
  },
  {
    num: 10,
    useCase: 'Block PCI / PII Threshold Triggers',
    intent: 'Meet compliance requirements for regulated data categories',
    category: 'Approved with Conditions / Restricted',
    dataScope: 'PCI data, PII above threshold',
    enforcement: 'Block + Coaching (L4)',
    enforcementType: 'block',
  },
  {
    num: 11,
    useCase: 'Block Sensitive Filenames',
    intent: 'Prevent exposure via filename pattern even without content inspection',
    category: 'Approved with Conditions / Restricted',
    dataScope: 'Files: RFP, RFI, Contract, Invoice, Salary, NDA, Patent, ExCom',
    enforcement: 'Block + Coaching (L4)',
    enforcementType: 'block',
  },
]

const ENFORCEMENT_STYLE: Record<UseCase['enforcementType'], { cell: string; text: string }> = {
  block:  { cell: 'bg-red-500/10 border-red-500/20',     text: 'text-red-400' },
  allow:  { cell: 'bg-emerald-500/10 border-emerald-500/20', text: 'text-emerald-400' },
  coach:  { cell: 'bg-amber-500/10 border-amber-500/20', text: 'text-amber-400' },
  mixed:  { cell: 'bg-blue-500/10 border-blue-500/20',   text: 'text-blue-400' },
}

// ── Limitations ───────────────────────────────────────────────────────────────

interface Limitation {
  area: string
  challenge: string
  impact: string
}

const LIMITATIONS: Limitation[] = [
  {
    area: 'App Activity Coverage',
    challenge: 'Not all GenAI apps support full DLP activity inspection (upload, post-prompt, response)',
    impact: 'Some activities pass through unmonitored depending on app integration maturity',
  },
  {
    area: 'App Instance / Tenant Separation',
    challenge: 'Differentiating between corporate and personal instances of the same GenAI tool (e.g. ChatGPT personal vs. corporate)',
    impact: 'Tenant-based routing is imprecise; may require IP/domain allowlisting combined with AD group validation',
  },
  {
    area: 'AD Group Dependency',
    challenge: 'Conditional policies rely on accurate, maintained AD group membership',
    impact: 'Stale AD groups or delayed provisioning cause incorrect DLP enforcement',
  },
  {
    area: 'User-Based Allowance Risk',
    challenge: '"Allow for approved users" policies can be bypassed if user accounts are shared or compromised',
    impact: 'Monitoring and UEBA integration required to detect anomalies',
  },
  {
    area: 'Allow / DND Policy Conflicts',
    challenge: 'Allow policies conflict with Do Not Decrypt (DND) rules when SSL inspection is not applied',
    impact: 'Creates blind spots for encrypted traffic to GenAI tools; must align SSL inspection scope',
  },
  {
    area: 'Large Files & Timeout Limits',
    challenge: 'Netskope has file size and processing timeout limits for real-time DLP inspection',
    impact: 'Large files may be allowed without full inspection; use async scanning for post-upload review',
  },
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

      {/* ── Enforcement Use Cases ─────────────────────────────────────────────── */}
      <div className="space-y-3 pt-4">
        <div>
          <h2 className="text-base font-bold text-foreground">Enforcement Use Cases</h2>
          <p className="text-sm text-muted-foreground/80 mt-0.5">
            Common Netskope policy patterns mapped to governance categories and enforcement outcomes.
          </p>
        </div>
        <div className="rounded-xl border border-border overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="border-b border-border bg-card">
                  <th className="text-left text-xs text-muted-foreground/80 font-semibold uppercase tracking-wide px-4 py-3 w-8">#</th>
                  <th className="text-left text-xs text-muted-foreground/80 font-semibold uppercase tracking-wide px-4 py-3 w-60">Use Case</th>
                  <th className="text-left text-xs text-muted-foreground/80 font-semibold uppercase tracking-wide px-4 py-3">Business Intent</th>
                  <th className="text-left text-xs text-muted-foreground/80 font-semibold uppercase tracking-wide px-4 py-3">GenAI Category</th>
                  <th className="text-left text-xs text-muted-foreground/80 font-semibold uppercase tracking-wide px-4 py-3">Data Scope</th>
                  <th className="text-left text-xs text-muted-foreground/80 font-semibold uppercase tracking-wide px-4 py-3 w-48">Expected Enforcement</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {USE_CASES.map((uc, i) => {
                  const style = ENFORCEMENT_STYLE[uc.enforcementType]
                  return (
                    <tr key={uc.num} className={cn('hover:bg-card/30 transition-colors', i % 2 === 0 ? '' : 'bg-card/10')}>
                      <td className="px-4 py-3 text-xs text-muted-foreground/50 font-mono">{uc.num}</td>
                      <td className="px-4 py-3 text-sm font-medium text-foreground">{uc.useCase}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground/80">{uc.intent}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground/80">{uc.category}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground/80">{uc.dataScope}</td>
                      <td className="px-4 py-3">
                        <span className={cn('inline-flex items-center px-2.5 py-1 rounded-lg border text-xs font-semibold', style.cell, style.text)}>
                          {uc.enforcement}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Limitations & Challenges ──────────────────────────────────────────── */}
      <div className="space-y-3 pt-2">
        <div>
          <h2 className="text-base font-bold text-foreground">Limitations &amp; Challenges</h2>
          <p className="text-sm text-muted-foreground/80 mt-0.5">
            Known constraints in Netskope GenAI DLP enforcement that affect policy design.
          </p>
        </div>
        <div className="rounded-xl border border-border overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="border-b border-border bg-card">
                  <th className="text-left text-xs text-muted-foreground/80 font-semibold uppercase tracking-wide px-5 py-3 w-52">Area</th>
                  <th className="text-left text-xs text-muted-foreground/80 font-semibold uppercase tracking-wide px-5 py-3">Limitation / Challenge</th>
                  <th className="text-left text-xs text-muted-foreground/80 font-semibold uppercase tracking-wide px-5 py-3">Practical Impact</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {LIMITATIONS.map((lim, i) => (
                  <tr key={i} className={cn('hover:bg-card/30 transition-colors', i % 2 === 0 ? '' : 'bg-card/10')}>
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                        {lim.area}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-sm text-muted-foreground/80">{lim.challenge}</td>
                    <td className="px-5 py-3 text-sm text-muted-foreground/70 italic">{lim.impact}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
