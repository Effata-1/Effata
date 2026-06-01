'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ChevronLeft, ChevronRight, Copy, FileText, Filter, Library, MessageSquare, MoreVertical,
  Pencil, Plus, RotateCcw, Search, Settings, ShieldAlert, ShieldCheck, Sparkles, Trash2, X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { deletePolicy, duplicatePolicy, generatePoliciesFromGovernance, getPolicyPackJobStatus, resetPolicyToDefault, togglePolicyActive } from '../actions'
import { PolicyChatPanel } from './policy-chat-panel'
import type { GenAIPolicy, ApprovalStatus, ActionCode, PolicyRule } from '@/lib/genai/types'
import { lintAllPolicies, SEVERITY_STYLES, type LintIssue } from '@/lib/genai/lint'
import type { RuleItem } from '../new/_components/policy-builder'

// ── Types ─────────────────────────────────────────────────────────────────────

type Activity = 'post_prompt' | 'upload' | 'download' | 'response'

interface IdentityOption { id: string; field_name: string; value_name: string; risk_level: string }
interface App { app_id: string; app_name: string; vendor: string; logo_letter: string; logo_bg: string }
interface Category { id: string; system_tag: string | null; name: string; color: string }
interface Classification { app_id: string; customer_classification: string }

interface Props {
  policies:        GenAIPolicy[]
  categories:      Category[]
  apps:            App[]
  classifications: Classification[]
  identityFields:  Record<string, IdentityOption[]>
  ruleItems:       RuleItem[]
}

// ── Constants ─────────────────────────────────────────────────────────────────

const APPROVAL_STYLES: Record<ApprovalStatus, string> = {
  approved:       'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  'under-review': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  draft:          'bg-muted/60 text-muted-foreground border-border',
  rejected:       'bg-red-500/10 text-red-400 border-red-500/20',
  expired:        'bg-amber-500/10 text-amber-400 border-amber-500/20',
}


const ACTION_CODES: ActionCode[] = ['not-set', 'allow', 'monitor', 'alert', 'coach', 'coach-ack', 'coach-just', 'block']
const ACTION_LABELS: Record<ActionCode, string> = {
  'not-set':    '— Inherit from Control Matrix',
  'allow':      'Allow',
  'monitor':    'Monitor',
  'alert':      'Alert',
  'coach':      'Coach',
  'coach-ack':  'Coach + Acknowledge',
  'coach-just': 'Coach + Justify',
  'block':      'Block',
}
const ACTION_CHIP: Record<ActionCode, string> = {
  'allow':      'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  'monitor':    'bg-blue-500/10 text-blue-400 border-blue-500/20',
  'alert':      'bg-amber-500/10 text-amber-400 border-amber-500/20',
  'coach':      'bg-orange-500/10 text-orange-400 border-orange-500/20',
  'coach-ack':  'bg-orange-500/15 text-orange-300 border-orange-500/30',
  'coach-just': 'bg-amber-600/15 text-amber-300 border-amber-600/25',
  'block':      'bg-red-500/10 text-red-400 border-red-500/20',
  'not-set':    'bg-muted/30 text-muted-foreground/50 border-border/50',
}

const ACTIVITIES: { key: Activity; label: string }[] = [
  { key: 'post_prompt', label: 'Prompt'   },
  { key: 'upload',      label: 'Upload'   },
  { key: 'download',    label: 'Download' },
  { key: 'response',    label: 'Response' },
]

const TEST_CHIP: Record<string, string> = {
  'untested':    'bg-muted/60 text-muted-foreground/60 border-border/50',
  'in-progress': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  'passed':      'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  'failed':      'bg-red-500/10 text-red-400 border-red-500/20',
}
const TEST_LABELS: Record<string, string> = {
  'untested':    '—',
  'in-progress': 'Testing',
  'passed':      'Passed',
  'failed':      'Failed',
}

const VENDOR_CHIP: Record<string, string> = {
  'pending':        'bg-amber-500/10 text-amber-400 border-amber-500/20',
  'translated':     'bg-blue-500/10 text-blue-400 border-blue-500/20',
  'verified':       'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  'not-applicable': 'bg-muted/60 text-muted-foreground/60 border-border/50',
}
const VENDOR_LABELS: Record<string, string> = {
  'pending':        'Pending',
  'translated':     'Translated',
  'verified':       'Verified',
  'not-applicable': 'N/A',
}

type ColumnId = 'source' | 'destination' | 'data' | 'activities' | 'family' | 'test' | 'vendor'

const COLUMN_DEFS: { id: ColumnId; label: string }[] = [
  { id: 'source',      label: 'Source'      },
  { id: 'destination', label: 'Destination' },
  { id: 'data',        label: 'Data'        },
  { id: 'activities',  label: 'Activities'  },
  { id: 'family',      label: 'Family'      },
  { id: 'test',        label: 'Test'        },
  { id: 'vendor',      label: 'Vendor'      },
]

const DEFAULT_COLS = new Set<ColumnId>(['source', 'destination', 'data', 'activities'])
const LS_COL_KEY = 'effata:policy-list-cols'

// ── Filter types & definitions ────────────────────────────────────────────────

type FilterKey =
  | 'action' | 'approval' | 'family' | 'category'
  | 'generated_from' | 'test_status' | 'vendor_status'
  | 'activities' | 'active' | 'npj_status'

interface FilterOption { value: string; label: string }
interface FilterDef { key: FilterKey; label: string; staticOptions?: FilterOption[] }

const FILTER_DEFS: FilterDef[] = [
  {
    key: 'action', label: 'Action',
    staticOptions: [
      { value: 'allow',      label: 'Allow'           },
      { value: 'monitor',    label: 'Monitor'         },
      { value: 'alert',      label: 'Alert'           },
      { value: 'coach',      label: 'Coach'           },
      { value: 'coach-ack',  label: 'Coach + Ack'     },
      { value: 'coach-just', label: 'Coach + Justify' },
      { value: 'block',      label: 'Block'           },
    ],
  },
  {
    key: 'approval', label: 'Approval Status',
    staticOptions: [
      { value: 'draft',        label: 'Draft'        },
      { value: 'under-review', label: 'Under Review' },
      { value: 'approved',     label: 'Approved'     },
      { value: 'rejected',     label: 'Rejected'     },
      { value: 'expired',      label: 'Expired'      },
    ],
  },
  { key: 'family',   label: 'Policy Family'   },
  { key: 'category', label: 'App Category'    },
  {
    key: 'generated_from', label: 'Source',
    staticOptions: [
      { value: 'predefined',        label: 'Predefined (RF Matrix)' },
      { value: 'governance-matrix', label: 'Governance Matrix'      },
      { value: 'policy-pack-agent', label: 'Policy Pack Agent'      },
      { value: 'manual',            label: 'Manual'                  },
      { value: 'legacy-backfill',   label: 'Legacy Backfill'        },
    ],
  },
  {
    key: 'test_status', label: 'Test Status',
    staticOptions: [
      { value: 'untested',    label: 'Untested'    },
      { value: 'in-progress', label: 'In Progress' },
      { value: 'passed',      label: 'Passed'      },
      { value: 'failed',      label: 'Failed'      },
    ],
  },
  {
    key: 'vendor_status', label: 'Vendor Translation',
    staticOptions: [
      { value: 'pending',        label: 'Pending'        },
      { value: 'translated',     label: 'Translated'     },
      { value: 'verified',       label: 'Verified'       },
      { value: 'not-applicable', label: 'Not Applicable' },
      { value: 'deferred',       label: 'Deferred'       },
    ],
  },
  {
    key: 'activities', label: 'Activity',
    staticOptions: [
      { value: 'post_prompt', label: 'Prompt'   },
      { value: 'upload',      label: 'Upload'   },
      { value: 'download',    label: 'Download' },
      { value: 'response',    label: 'Response' },
      { value: 'browse',      label: 'Browse'   },
    ],
  },
  {
    key: 'active', label: 'Active State',
    staticOptions: [
      { value: 'active',   label: 'Active'   },
      { value: 'inactive', label: 'Inactive' },
    ],
  },
  {
    key: 'npj_status', label: 'Policy Status',
    staticOptions: [
      { value: 'current',  label: 'Current'  },
      { value: 'outdated', label: 'Outdated' },
      { value: 'legacy',   label: 'Legacy'   },
      { value: 'invalid',  label: 'Invalid'  },
    ],
  },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

const CAT_COLOR_CHIP: Record<string, string> = {
  emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  green:   'bg-green-500/10 text-green-400 border-green-500/20',
  blue:    'bg-blue-500/10 text-blue-400 border-blue-500/20',
  sky:     'bg-sky-500/10 text-sky-400 border-sky-500/20',
  amber:   'bg-amber-500/10 text-amber-400 border-amber-500/20',
  orange:  'bg-orange-500/10 text-orange-400 border-orange-500/20',
  red:     'bg-red-500/10 text-red-400 border-red-500/20',
  violet:  'bg-violet-500/10 text-violet-400 border-violet-500/20',
  purple:  'bg-purple-500/10 text-purple-400 border-purple-500/20',
  zinc:    'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
}

function getPolicyCategories(policy: GenAIPolicy, categories: Category[]): Category[] {
  const npj = (policy as unknown as Record<string, unknown>).neutral_policy_json
  if (!npj || typeof npj !== 'object') return []
  const scope = (npj as Record<string, unknown>).scope
  if (!scope || typeof scope !== 'object') return []
  const npjCats = (scope as Record<string, unknown>).app_categories
  if (!Array.isArray(npjCats) || npjCats.length === 0) return []
  return (npjCats as unknown[])
    .map(item => {
      if (!item || typeof item !== 'object') return undefined
      const c = item as Record<string, unknown>
      return categories.find(cat =>
        (c.id && cat.id === c.id) ||
        (c.system_tag && cat.system_tag === (c.system_tag as string))
      )
    })
    .filter((c): c is Category => Boolean(c))
}

function deriveFromRules(rules: PolicyRule[], ruleItems: RuleItem[]) {
  const validKeys = new Set(ruleItems.map(i => i.key))
  const selectedDataKeys = new Set(
    rules
      .filter(r => validKeys.has(r.data_type))
      .filter(r => r.post_prompt !== 'not-set' || r.upload !== 'not-set' || r.download !== 'not-set' || r.response !== 'not-set')
      .map(r => r.data_type),
  )
  const selectedActivities = new Set<Activity>()
  for (const r of rules) {
    if (r.post_prompt !== 'not-set') selectedActivities.add('post_prompt')
    if (r.upload      !== 'not-set') selectedActivities.add('upload')
    if (r.download    !== 'not-set') selectedActivities.add('download')
    if (r.response    !== 'not-set') selectedActivities.add('response')
  }
  if (selectedActivities.size === 0) {
    selectedActivities.add('post_prompt'); selectedActivities.add('upload')
    selectedActivities.add('download');    selectedActivities.add('response')
  }
  const counts: Record<string, number> = {}
  for (const r of rules)
    for (const a of ['post_prompt', 'upload', 'download', 'response'] as const)
      if (r[a] !== 'not-set') counts[r[a]] = (counts[r[a]] ?? 0) + 1
  const primaryAction = (Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] as ActionCode) ?? 'not-set'
  return { selectedDataKeys, selectedActivities, primaryAction }
}

// ── Row summary cells ─────────────────────────────────────────────────────────

function SourceCell({ policy, identityFields }: { policy: GenAIPolicy; identityFields: Record<string, IdentityOption[]> }) {
  // Prefer NPJ scope.users — specific groups set by AI or editor
  const npj = getNpj(policy)
  if (npj) {
    const npjUsers = ((npj.scope as Record<string, unknown> | undefined)?.users as string[] | undefined) ?? []
    const specific = npjUsers.filter(u => u !== 'All Users')
    if (specific.length > 0) {
      return (
        <div className="space-y-0.5">
          <span className="text-[11px] text-foreground/80 truncate block max-w-[120px]">{`${specific[0]} Users`}</span>
          {specific.length > 1 && <span className="text-[10px] text-muted-foreground/50">+{specific.length - 1} more</span>}
        </div>
      )
    }
  }

  // Fall back to identity_context (legacy field IDs)
  const ids = policy.identity_context ?? []
  if (ids.length === 0) return <span className="text-[11px] text-muted-foreground/40 italic">Any user</span>
  const all = Object.values(identityFields).flat()
  const names = ids.map(id => all.find(v => v.id === id)?.value_name).filter(Boolean) as string[]
  if (names.length === 0) return <span className="text-[11px] text-muted-foreground/40 italic">Any user</span>
  return (
    <div className="space-y-0.5">
      <span className="text-[11px] text-foreground/80 truncate block max-w-[120px]">{names[0]}</span>
      {names.length > 1 && <span className="text-[10px] text-muted-foreground/50">+{names.length - 1} more</span>}
    </div>
  )
}

function DestCell({ policy, apps, categories }: { policy: GenAIPolicy; apps: App[]; categories: Category[] }) {
  // Specific app instances take priority
  const ids = policy.scope_app_ids ?? []
  const scoped = ids.length > 0 ? apps.filter(a => ids.includes(a.app_id)) : []
  if (scoped.length > 0) {
    return (
      <div className="space-y-0.5">
        <div className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded flex items-center justify-center text-[8px] font-bold text-foreground shrink-0" style={{ backgroundColor: scoped[0].logo_bg }}>{scoped[0].logo_letter}</span>
          <span className="text-[11px] text-foreground/80 truncate max-w-[100px]">{scoped[0].app_name}</span>
        </div>
        {scoped.length > 1 && <span className="text-[10px] text-muted-foreground/50">+{scoped.length - 1} more</span>}
      </div>
    )
  }

  // Fall back to app categories from neutral policy json
  const cats = getPolicyCategories(policy, categories)
  if (cats.length > 0) {
    return (
      <div className="flex gap-1 flex-wrap">
        {cats.map(cat => (
          <span key={cat.id} className={cn('text-[9px] px-1.5 py-0.5 rounded border font-medium', CAT_COLOR_CHIP[cat.color] ?? CAT_COLOR_CHIP.zinc)}>
            {cat.name}
          </span>
        ))}
      </div>
    )
  }

  // Predefined content policies have no app_categories in scope (they apply to all categories
  // with per-category actions) — show all org categories so the column isn't blank
  if (policy.policy_source === 'predefined' && categories.length > 0) {
    return (
      <div className="flex gap-1 flex-wrap">
        {categories.map(cat => (
          <span key={cat.id} className={cn('text-[9px] px-1.5 py-0.5 rounded border font-medium', CAT_COLOR_CHIP[cat.color] ?? CAT_COLOR_CHIP.zinc)}>
            {cat.name}
          </span>
        ))}
      </div>
    )
  }

  return <span className="text-[11px] text-muted-foreground/40 italic">All GenAI apps</span>
}

// ── NPJ-aware helpers ─────────────────────────────────────────────────────────

interface NpjCondition { type: string; sensitivity?: string; risk_family?: string; label_source?: string; label_name?: string }

function getNpj(policy: GenAIPolicy): Record<string, unknown> | null {
  const raw = (policy as unknown as Record<string, unknown>).neutral_policy_json
  if (!raw || typeof raw !== 'object') return null
  const n = raw as Record<string, unknown>
  return n.schema_version === '1.0' ? n : null
}

function getNpjConditions(npj: Record<string, unknown>): NpjCondition[] {
  return ((npj.content as Record<string, unknown> | undefined)?.conditions as NpjCondition[] | undefined) ?? []
}

function getNpjActivities(npj: Record<string, unknown>): string[] {
  return ((npj.scope as Record<string, unknown> | undefined)?.activities as string[] | undefined) ?? []
}

const NPJ_ACT_LABELS: Record<string, string> = {
  browse: 'Browse', login: 'Login', post: 'Post', post_prompt: 'Prompt',
  upload: 'Upload', download: 'Download', response: 'Response',
  share: 'Share', copy_paste: 'Copy/Paste', print: 'Print', email_send: 'Email Send',
}

function getNpjPolicyStatus(policy: GenAIPolicy): 'current' | 'outdated' | 'legacy' | 'invalid' {
  const raw = (policy as unknown as Record<string, unknown>).neutral_policy_json
  if (!raw || (typeof raw === 'object' && Object.keys(raw as object).length === 0)) return 'legacy'
  if (typeof raw !== 'object') return 'legacy'
  const n = raw as Record<string, unknown>
  if (n.schema_version !== '1.0' || typeof n.intent !== 'string' || typeof n.decision !== 'object') return 'invalid'
  const generatedAt = (n as { provenance?: { generated_at?: string } }).provenance?.generated_at
  const updatedAt = (policy as unknown as Record<string, unknown>).updated_at as string | undefined
  if (generatedAt && updatedAt && generatedAt < updatedAt) return 'outdated'
  return 'current'
}

function getPolicyAction(policy: GenAIPolicy, ruleItems: RuleItem[]): ActionCode {
  const npj = getNpj(policy)
  if (npj) {
    const mode = ((npj.decision as Record<string, unknown> | undefined)?.mode) as string | undefined
    if (mode && mode !== 'not-set') return mode as ActionCode
  }
  const hasRules = (policy.rules ?? []).length > 0
  return hasRules
    ? deriveFromRules(policy.rules ?? [], ruleItems).primaryAction
    : (policy.primary_action ?? 'not-set')
}

// ── Cell components ───────────────────────────────────────────────────────────

function DataTypeCell({ policy, ruleItems }: { policy: GenAIPolicy; ruleItems: RuleItem[] }) {
  const npj = getNpj(policy)

  if (npj) {
    const conds = getNpjConditions(npj)

    if (npj.intent === 'govern_app_access' || conds.length === 0) {
      return <span className="text-[11px] text-muted-foreground/40 italic">{npj.intent === 'govern_app_access' ? 'App access only' : '—'}</span>
    }
    if (conds.every(c => c.type === 'filename')) {
      return <span className="text-[11px] text-muted-foreground/60">Filename pattern</span>
    }
    if (conds.every(c => c.type === 'classification_label')) {
      const sources = [...new Set(conds.map(c => c.label_source).filter(Boolean))]
      return <span className="text-[11px] text-muted-foreground/60">{sources.length ? `${sources[0]} label` : 'Customer label'}</span>
    }
    const dtConds = conds.filter(c => c.type === 'data_type')
    if (dtConds.length > 0) {
      const rf    = dtConds[0].risk_family
      const label = rf
        ? rf.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
        : (dtConds[0].sensitivity ?? '').replace(/-/g, ' ').replace(/^./, c => c.toUpperCase())
      return (
        <span className="text-[11px] text-foreground/80 truncate block max-w-[140px]">
          {label}{dtConds.length > 1 ? ` +${dtConds.length - 1}` : ''}
        </span>
      )
    }
    return <span className="text-[11px] text-muted-foreground/40 italic">—</span>
  }

  // Legacy fallback — show with indicator
  const { selectedDataKeys } = deriveFromRules(policy.rules ?? [], ruleItems)
  const names = ruleItems.filter(i => selectedDataKeys.has(i.key)).map(i => i.name)
  const legacyLabel = names.length > 0
    ? `${names[0]}${names.length > 1 ? ` +${names.length - 1}` : ''}`
    : (policy.data_classification_label && policy.data_classification_label !== 'all')
      ? policy.data_classification_label
      : 'All data'
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] text-muted-foreground/50 italic">{legacyLabel}</span>
      <span className="text-[9px] px-1 py-px rounded bg-amber-500/10 border border-amber-500/20 text-amber-400/70 w-fit">Legacy</span>
    </div>
  )
}

function ActivitiesCell({ policy, ruleItems }: { policy: GenAIPolicy; ruleItems: RuleItem[] }) {
  const npj = getNpj(policy)

  if (npj) {
    const actKeys = getNpjActivities(npj)
    const isAppAccess = npj.intent === 'govern_app_access'

    // govern_app_access: always Browse + Login (access-level control only)
    // This normalises stale stored values from before the compiler fix.
    const acts = isAppAccess
      ? ['Browse', 'Login']
      : actKeys.length > 0
        ? actKeys.map(a => NPJ_ACT_LABELS[a] ?? a)
        : []

    if (acts.length === 0) return <span className="text-[11px] text-muted-foreground/40 italic">—</span>
    return (
      <div className="flex gap-0.5 flex-wrap">
        {acts.map(l => (
          <span key={l} className="text-[9px] px-1 py-0.5 rounded bg-muted/40 border border-border/40 text-muted-foreground/60">{l}</span>
        ))}
      </div>
    )
  }

  // Legacy fallback
  const { selectedActivities } = deriveFromRules(policy.rules ?? [], ruleItems)
  const acts = ACTIVITIES.filter(a => selectedActivities.has(a.key)).map(a => a.label)
  if (acts.length === 0) return <span className="text-[11px] text-muted-foreground/40 italic">—</span>
  return (
    <div className="flex gap-0.5 flex-wrap items-center">
      {acts.map(l => (
        <span key={l} className="text-[9px] px-1 py-0.5 rounded bg-muted/40 border border-amber-500/20 text-muted-foreground/50">{l}</span>
      ))}
      <span className="text-[9px] px-1 py-px rounded bg-amber-500/10 border border-amber-500/20 text-amber-400/70">Legacy</span>
    </div>
  )
}

function ActionCell({ policy, ruleItems }: { policy: GenAIPolicy; ruleItems: RuleItem[] }) {
  const action = getPolicyAction(policy, ruleItems)
  const label  = action === 'not-set' ? 'Inherited' : ACTION_LABELS[action]
  return (
    <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded border whitespace-nowrap', ACTION_CHIP[action])}>
      {label}
    </span>
  )
}

// ── Select-all checkbox (indeterminate support) ───────────────────────────────

function SelectAllBox({ checked, indeterminate, onChange }: { checked: boolean; indeterminate: boolean; onChange: () => void }) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { if (ref.current) ref.current.indeterminate = indeterminate }, [indeterminate])
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      className="accent-foreground w-3 h-3 cursor-pointer"
    />
  )
}

// ── Delete confirm modal ──────────────────────────────────────────────────────

function DeleteConfirmModal({
  policyName,
  onConfirm,
  onCancel,
}: {
  policyName: string
  onConfirm:  () => void
  onCancel:   () => void
}) {
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    cancelRef.current?.focus()
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onCancel() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-title"
        aria-describedby="delete-desc"
        className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm rounded-xl border border-border bg-card shadow-2xl p-6 space-y-4"
      >
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-9 h-9 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <Trash2 className="w-4 h-4 text-red-400" />
          </div>
          <div className="min-w-0">
            <p id="delete-title" className="text-sm font-semibold text-foreground">Delete policy?</p>
            <p id="delete-desc" className="text-xs text-muted-foreground/70 mt-1 leading-relaxed">
              <span className="font-medium text-foreground/80">&ldquo;{policyName}&rdquo;</span> will be permanently deleted.
              This cannot be undone — any references to this policy will be lost.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="px-3.5 py-1.5 text-xs font-medium rounded-md border border-border bg-muted/30 hover:bg-muted/60 text-foreground/70 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-3.5 py-1.5 text-xs font-semibold rounded-md bg-red-600 hover:bg-red-700 text-white transition-colors"
          >
            Delete policy
          </button>
        </div>
      </div>
    </>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function PolicyList({ policies: initialPolicies, categories, apps, classifications, identityFields, ruleItems }: Props) {
  const router = useRouter()
  const [policies, setPolicies]               = useState<GenAIPolicy[]>(initialPolicies)

  // Sync local state when server re-renders with fresh data (e.g. after generate)
  useEffect(() => { setPolicies(initialPolicies) }, [initialPolicies])
  const [filters, setFilters]                 = useState<Map<FilterKey, Set<string>>>(new Map())
  const [filterPickerOpen, setFilterPickerOpen] = useState(false)
  const [filterStep, setFilterStep]           = useState<FilterKey | null>(null)
  const filterPickerRef                       = useRef<HTMLDivElement>(null)
  const [search, setSearch]                   = useState('')
  const [lintResults, setLintResults]         = useState<LintIssue[] | null>(null)
  const [isGenerating, setIsGenerating]       = useState(false)
  const [generateError, setGenerateError]     = useState<string | null>(null)
  const [, startTransition]                   = useTransition()
  const [chatOpen, setChatOpen]               = useState(false)
  const [chatPolicyId, setChatPolicyId]       = useState<string | undefined>(undefined)
  const [deleteTarget, setDeleteTarget]       = useState<{ id: string; name: string } | null>(null)
  const [selectedIds, setSelectedIds]         = useState<Set<string>>(new Set())
  const [selectMode, setSelectMode]           = useState(false)
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false)
  const [showNewModal, setShowNewModal]       = useState(false)
  const [visibleCols, setVisibleCols]         = useState<Set<ColumnId>>(DEFAULT_COLS)
  const [colPickerOpen, setColPickerOpen]     = useState(false)
  const colPickerRef                          = useRef<HTMLDivElement>(null)
  const [openMenuId,   setOpenMenuId]         = useState<string | null>(null)
  const [menuPos,      setMenuPos]            = useState({ top: 0, right: 0 })
  const menuTriggerRef                        = useRef<HTMLButtonElement | null>(null)

  // Close new-policy modal on Escape
  useEffect(() => {
    if (!showNewModal) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setShowNewModal(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showNewModal])

  // Hydrate column visibility from localStorage after mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LS_COL_KEY)
      if (saved) setVisibleCols(new Set(JSON.parse(saved) as ColumnId[]))
    } catch { /* ignore */ }
  }, [])

  // Close column picker on outside click
  useEffect(() => {
    if (!colPickerOpen) return
    function handler(e: MouseEvent) {
      if (colPickerRef.current && !colPickerRef.current.contains(e.target as Node)) setColPickerOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [colPickerOpen])

  // Close filter picker on outside click
  useEffect(() => {
    if (!filterPickerOpen) return
    function handler(e: MouseEvent) {
      if (filterPickerRef.current && !filterPickerRef.current.contains(e.target as Node)) {
        setFilterPickerOpen(false)
        setFilterStep(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [filterPickerOpen])

  // Close row 3-dot menu on outside click
  useEffect(() => {
    if (!openMenuId) return
    function handler(e: MouseEvent) {
      if (menuTriggerRef.current && !menuTriggerRef.current.contains(e.target as Node)) {
        setOpenMenuId(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [openMenuId])

  function toggleCol(id: ColumnId) {
    setVisibleCols(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      try { localStorage.setItem(LS_COL_KEY, JSON.stringify([...next])) } catch { /* ignore */ }
      return next
    })
  }

  const col = (id: ColumnId) => visibleCols.has(id)

  function toggleFilter(key: FilterKey, value: string) {
    setFilters(prev => {
      const next = new Map(prev)
      const vals = new Set(next.get(key) ?? [])
      if (vals.has(value)) vals.delete(value)
      else vals.add(value)
      if (vals.size === 0) next.delete(key)
      else next.set(key, vals)
      return next
    })
  }

  function removeFilterKey(key: FilterKey) {
    setFilters(prev => { const next = new Map(prev); next.delete(key); return next })
  }

  function clearFilters() { setFilters(new Map()) }

  function getFilterOptions(key: FilterKey): FilterOption[] {
    const def = FILTER_DEFS.find(d => d.key === key)
    if (def?.staticOptions) return def.staticOptions
    if (key === 'category') return categories.map(c => ({ value: c.id, label: c.name }))
    if (key === 'family') {
      const families = [...new Set(policies.map(p => p.policy_family).filter((f): f is string => Boolean(f)))]
      return families.map(f => ({ value: f, label: f }))
    }
    return []
  }

  function getFilterValueLabel(key: FilterKey, value: string): string {
    if (key === 'category') return categories.find(c => c.id === value)?.name ?? value
    const def = FILTER_DEFS.find(d => d.key === key)
    return def?.staticOptions?.find(o => o.value === value)?.label ?? value
  }

  const activeFilterCount = [...filters.values()].reduce((n, s) => n + s.size, 0)

  void classifications
  void ACTION_CODES

  // ── Selection helpers ────────────────────────────────────────────────────────

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else { next.add(id) }
      return next
    })
  }

  function toggleSelectAll() {
    const ids = visible.map(p => p.id)
    const allSelected = ids.every(id => selectedIds.has(id))
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (allSelected) ids.forEach(id => next.delete(id))
      else ids.forEach(id => next.add(id))
      return next
    })
  }

  function handleBulkActivate() {
    const ids = [...selectedIds]
    setSelectedIds(new Set()); setSelectMode(false)
    setPolicies(ps => ps.map(p => ids.includes(p.id) ? { ...p, is_active: true } : p))
    startTransition(async () => { await Promise.all(ids.map(id => togglePolicyActive(id, true))) })
  }

  function handleBulkDeactivate() {
    const ids = [...selectedIds]
    setSelectedIds(new Set()); setSelectMode(false)
    setPolicies(ps => ps.map(p => ids.includes(p.id) ? { ...p, is_active: false } : p))
    startTransition(async () => { await Promise.all(ids.map(id => togglePolicyActive(id, false))) })
  }

  async function handleBulkDelete() {
    const ids = [...selectedIds]
    setBulkDeleteConfirm(false)
    setSelectedIds(new Set()); setSelectMode(false)
    setPolicies(ps => ps.filter(p => !ids.includes(p.id)))
    await Promise.all(ids.map(id => deletePolicy(id)))
  }

  function openBulkAI() {
    // Open chat in general mode — all policies are available as context
    setChatPolicyId(undefined)
    setChatOpen(true)
  }

  function openChat(policyId?: string) {
    setChatPolicyId(policyId)
    setChatOpen(true)
  }

  function handleResetToDefault(id: string) {
    setPolicies(ps => ps.map(p => p.id === id ? { ...p, is_customized: false } : p))
    startTransition(async () => { await resetPolicyToDefault(id) })
  }

  const visible = policies.filter(p => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false
    for (const [key, vals] of filters) {
      if (vals.size === 0) continue
      switch (key) {
        case 'action':
          if (!vals.has(getPolicyAction(p, ruleItems))) return false
          break
        case 'approval':
          if (!vals.has(p.approval_status)) return false
          break
        case 'family':
          if (!vals.has(p.policy_family ?? '')) return false
          break
        case 'category': {
          const cats = getPolicyCategories(p, categories).map(c => c.id)
          if (!cats.some(id => vals.has(id))) return false
          break
        }
        case 'generated_from': {
          const gf = ((p as unknown as Record<string, unknown>).generated_from as string) ?? 'manual'
          if (!vals.has(gf)) return false
          break
        }
        case 'test_status':
          if (!vals.has(p.test_status ?? 'untested')) return false
          break
        case 'vendor_status':
          if (!vals.has(p.vendor_translation_status ?? 'pending')) return false
          break
        case 'activities': {
          const npj = getNpj(p)
          const acts = npj ? getNpjActivities(npj) : []
          if (!acts.some(a => vals.has(a))) return false
          break
        }
        case 'active':
          if (!vals.has(p.is_active ? 'active' : 'inactive')) return false
          break
        case 'npj_status':
          if (!vals.has(getNpjPolicyStatus(p))) return false
          break
      }
    }
    return true
  })

  const allVisibleSelected  = visible.length > 0 && visible.every(p => selectedIds.has(p.id))
  const someVisibleSelected = visible.some(p => selectedIds.has(p.id))

  function handleToggle(id: string, current: boolean) {
    setPolicies(ps => ps.map(p => p.id === id ? { ...p, is_active: !current } : p))
    startTransition(async () => { await togglePolicyActive(id, !current) })
  }

  function handleDelete(id: string, name: string) {
    setDeleteTarget({ id, name })
  }

  function confirmDelete() {
    if (!deleteTarget) return
    const { id } = deleteTarget
    setDeleteTarget(null)
    setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n })
    setPolicies(ps => ps.filter(p => p.id !== id))
    startTransition(async () => { await deletePolicy(id) })
  }

  async function handleGenerate() {
    setIsGenerating(true)
    setGenerateError(null)
    const result = await generatePoliciesFromGovernance()
    if (result.error) {
      setGenerateError(result.error)
      setIsGenerating(false)
      return
    }
    // Poll until the compile job completes, then refresh to show generated policies
    const jobId = result.jobId
    if (!jobId) {
      router.refresh()
      setIsGenerating(false)
      return
    }
    let attempts = 0
    const poll = setInterval(async () => {
      attempts++
      try {
        const status = await getPolicyPackJobStatus(jobId)
        if (status.status === 'completed' || status.status === 'failed') {
          clearInterval(poll)
          setIsGenerating(false)
          if (status.status === 'failed') {
            setGenerateError(status.error ?? 'Policy generation failed.')
          } else {
            router.refresh()
          }
        }
      } catch {
        // getPolicyPackJobStatus requires admin — fall back to timed refresh
        clearInterval(poll)
        setTimeout(() => { router.refresh(); setIsGenerating(false) }, 4000)
      }
      if (attempts >= 30) {
        clearInterval(poll)
        setIsGenerating(false)
        router.refresh()
      }
    }, 2000)
  }

  return (
    <>
      {/* Delete confirm modal */}
      {deleteTarget && (
        <DeleteConfirmModal
          policyName={deleteTarget.name}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* AI Chat Panel */}
      {chatOpen && (
        <PolicyChatPanel
          policies={policies}
          initialPolicyId={chatPolicyId}
          onClose={() => setChatOpen(false)}
        />
      )}

      {/* Bulk delete confirmation */}
      {bulkDeleteConfirm && (
        <>
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={() => setBulkDeleteConfirm(false)} />
          <div
            role="alertdialog"
            aria-modal="true"
            className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm rounded-xl border border-border bg-card shadow-2xl p-6 space-y-4"
          >
            <div className="flex items-start gap-3">
              <div className="shrink-0 w-9 h-9 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <Trash2 className="w-4 h-4 text-red-400" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">Delete {selectedIds.size} {selectedIds.size === 1 ? 'policy' : 'policies'}?</p>
                <p className="text-xs text-muted-foreground/70 mt-1 leading-relaxed">
                  This will permanently delete all {selectedIds.size} selected {selectedIds.size === 1 ? 'policy' : 'policies'}. This cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setBulkDeleteConfirm(false)}
                className="px-3.5 py-1.5 text-xs font-medium rounded-md border border-border bg-muted/30 hover:bg-muted/60 text-foreground/70 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBulkDelete}
                className="px-3.5 py-1.5 text-xs font-semibold rounded-md bg-red-600 hover:bg-red-700 text-white transition-colors"
              >
                Delete {selectedIds.size} {selectedIds.size === 1 ? 'policy' : 'policies'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* New Policy Mode Selection Modal */}
      {showNewModal && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowNewModal(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl rounded-2xl border border-border bg-card shadow-2xl p-6 space-y-5"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-base font-bold text-foreground">Create a New Policy</h2>
                <p className="text-xs text-muted-foreground/60 mt-0.5">How would you like to create this policy?</p>
              </div>
              <button
                type="button"
                onClick={() => setShowNewModal(false)}
                className="text-muted-foreground/40 hover:text-foreground/70 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {/* AI-Assisted */}
              <button
                type="button"
                onClick={() => { setShowNewModal(false); router.push('/genai-controls/policies/new/ai') }}
                className="flex flex-col items-start gap-3 p-4 rounded-xl border border-blue-500/25 bg-blue-500/5 hover:bg-blue-500/10 hover:border-blue-500/40 transition-colors text-left group"
              >
                <div className="w-9 h-9 rounded-lg bg-blue-500/15 border border-blue-500/25 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground group-hover:text-blue-400 transition-colors">AI-Assisted</p>
                  <p className="text-xs text-muted-foreground/60 mt-0.5 leading-relaxed">
                    Describe your requirement. AI drafts a full structured proposal for your review before anything is created.
                  </p>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-md border border-blue-500/30 bg-blue-500/10 text-blue-400">
                  Proposal required · NPJ from AI
                </span>
              </button>

              {/* Blank Policy */}
              <button
                type="button"
                onClick={() => { setShowNewModal(false); router.push('/genai-controls/policies/new') }}
                className="flex flex-col items-start gap-3 p-4 rounded-xl border border-border bg-muted/20 hover:bg-muted/40 hover:border-border-strong transition-colors text-left group"
              >
                <div className="w-9 h-9 rounded-lg bg-muted/50 border border-border flex items-center justify-center">
                  <FileText className="w-4 h-4 text-foreground/60" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground">Blank Policy</p>
                  <p className="text-xs text-muted-foreground/60 mt-0.5 leading-relaxed">
                    Step-by-step structured wizard. You control every field. Creates a valid neutral policy from scratch.
                  </p>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-md border border-border/60 bg-muted/30 text-muted-foreground/60">
                  NPJ from step 1 · Full control
                </span>
              </button>

              {/* Template Library — coming soon */}
              <div className="flex flex-col items-start gap-3 p-4 rounded-xl border border-border/40 bg-muted/10 opacity-50 cursor-not-allowed">
                <div className="w-9 h-9 rounded-lg bg-muted/30 border border-border/40 flex items-center justify-center">
                  <Library className="w-4 h-4 text-muted-foreground/40" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-muted-foreground/60">Template Library</p>
                  <p className="text-xs text-muted-foreground/40 mt-0.5 leading-relaxed">
                    Start from a pre-built policy. Block secrets, coach confidential uploads, allow enterprise Copilot, and more.
                  </p>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-md border border-border/40 bg-muted/20 text-muted-foreground/40">
                  Coming soon
                </span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Floating "Refine with AI" button */}
      {policies.length > 0 && !chatOpen && (
        <button
          type="button"
          onClick={() => openChat()}
          className="fixed bottom-6 right-6 z-30 flex items-center gap-2 px-4 py-2.5 rounded-full bg-blue-600 text-white text-xs font-semibold shadow-lg hover:bg-blue-700 transition-colors"
        >
          <MessageSquare className="w-4 h-4" />
          Refine with AI
        </button>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/30" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search policies…"
            className="bg-card text-xs text-foreground placeholder:text-muted-foreground/30 border border-border/60 rounded-md pl-8 pr-3 py-1.5 w-52 focus:outline-none focus:border-border transition-colors"
          />
        </div>
        {/* Filter picker */}
        <div ref={filterPickerRef} className="relative">
          <button
            onClick={() => { setFilterPickerOpen(o => !o); setFilterStep(null) }}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors',
              filterPickerOpen || activeFilterCount > 0
                ? 'border-blue-500/40 bg-blue-500/8 text-blue-400'
                : 'border-border bg-muted/30 hover:bg-muted/60 text-muted-foreground',
            )}
          >
            <Filter className="w-3.5 h-3.5" />
            Add Filter
            {activeFilterCount > 0 && (
              <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/20 text-[10px] font-semibold leading-none">
                {activeFilterCount}
              </span>
            )}
          </button>

          {filterPickerOpen && (
            <div className="absolute left-0 top-full mt-1.5 z-40 w-56 rounded-xl border border-border bg-card shadow-xl py-1.5">
              {filterStep === null ? (
                <>
                  <p className="px-3 py-1 text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wide">Filter by</p>
                  {FILTER_DEFS.map(def => {
                    const active = filters.get(def.key)
                    return (
                      <button
                        key={def.key}
                        onClick={() => setFilterStep(def.key)}
                        className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-muted/40 text-xs text-foreground/80 transition-colors"
                      >
                        <span>{def.label}</span>
                        <div className="flex items-center gap-1.5">
                          {active && active.size > 0 && (
                            <span className="px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/20 text-[10px] font-semibold leading-none">
                              {active.size}
                            </span>
                          )}
                          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40" />
                        </div>
                      </button>
                    )
                  })}
                </>
              ) : (
                <>
                  <div className="flex items-center gap-1 px-2 py-1 border-b border-border/40 mb-1">
                    <button
                      onClick={() => setFilterStep(null)}
                      className="p-0.5 rounded hover:bg-muted/60 text-muted-foreground/60 hover:text-foreground transition-colors"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <p className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wide">
                      {FILTER_DEFS.find(d => d.key === filterStep)?.label}
                    </p>
                  </div>
                  <div className="max-h-52 overflow-y-auto">
                    {getFilterOptions(filterStep).map(opt => {
                      const checked = filters.get(filterStep)?.has(opt.value) ?? false
                      return (
                        <label key={opt.value} className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-muted/40 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleFilter(filterStep, opt.value)}
                            className="accent-foreground w-3 h-3 shrink-0"
                          />
                          <span className="text-xs text-foreground/80">{opt.label}</span>
                        </label>
                      )
                    })}
                    {getFilterOptions(filterStep).length === 0 && (
                      <p className="px-3 py-2 text-xs text-muted-foreground/40 italic">No options available</p>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
        <div className="flex-1" />
        <button onClick={() => setLintResults(lintAllPolicies(policies))}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-border bg-muted/30 hover:bg-muted/60 text-muted-foreground transition-colors"
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          Lint Policies
          {lintResults !== null && lintResults.length > 0 && (
            <span className="ml-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/20">{lintResults.length}</span>
          )}
        </button>
        {policies.length === 0 && (
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border border-border bg-muted/30 hover:bg-muted/60 text-foreground/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {isGenerating ? 'Generating…' : 'Generate Policies'}
          </button>
        )}
        {/* Select mode toggle */}
        <button
          onClick={() => { setSelectMode(m => !m); if (selectMode) setSelectedIds(new Set()) }}
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors',
            selectMode
              ? 'border-blue-500/40 bg-blue-500/10 text-blue-400'
              : 'border-border bg-muted/30 hover:bg-muted/60 text-muted-foreground',
          )}
        >
          Select
        </button>

        <button
          type="button"
          onClick={() => setShowNewModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-foreground text-background hover:bg-foreground/90 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          New Policy
        </button>
      </div>

      {/* Active filter chips */}
      {filters.size > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mb-3">
          {[...filters.entries()].map(([key, vals]) => {
            const def = FILTER_DEFS.find(d => d.key === key)!
            const valueLabels = [...vals].map(v => getFilterValueLabel(key, v)).join(', ')
            return (
              <span
                key={key}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-medium"
              >
                <span className="text-blue-400/60">{def.label}:</span>
                {valueLabels}
                <button
                  onClick={() => removeFilterKey(key)}
                  className="ml-0.5 text-blue-400/60 hover:text-blue-300 transition-colors"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            )
          })}
          <button
            onClick={clearFilters}
            className="text-[10px] text-muted-foreground/50 hover:text-foreground transition-colors ml-1"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Bulk selection action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-card border border-blue-500/20 shadow-sm mb-4">
          <span className="text-xs font-semibold text-foreground/80 shrink-0">
            {selectedIds.size} {selectedIds.size === 1 ? 'policy' : 'policies'} selected
          </span>
          <div className="w-px h-4 bg-border/60 mx-1 shrink-0" />
          <button
            type="button"
            onClick={openBulkAI}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border border-blue-500/30 bg-blue-500/8 text-blue-400 hover:bg-blue-500/15 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Ask AI
          </button>
          <button
            type="button"
            onClick={handleBulkActivate}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border border-border bg-muted/30 hover:bg-muted/60 text-muted-foreground transition-colors"
          >
            Activate
          </button>
          <button
            type="button"
            onClick={handleBulkDeactivate}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border border-border bg-muted/30 hover:bg-muted/60 text-muted-foreground transition-colors"
          >
            Deactivate
          </button>
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => setBulkDeleteConfirm(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border border-red-500/20 bg-red-500/8 text-red-400 hover:bg-red-500/15 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete {selectedIds.size}
          </button>
          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            className="p-1 rounded-md text-muted-foreground/50 hover:text-foreground hover:bg-muted/40 transition-colors"
            title="Clear selection"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Generating progress banner */}
      {isGenerating && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-blue-500/8 border border-blue-500/20 text-blue-400 text-xs mb-4">
          <svg className="animate-spin w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          Compiling policies from your Governance Matrix… this takes a few seconds.
        </div>
      )}

      {/* Generate error */}
      {generateError && (
        <div className="flex items-center justify-between px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs mb-4">
          <span>{generateError}</span>
          <button onClick={() => setGenerateError(null)} className="text-red-400/60 hover:text-red-400 transition-colors"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* Lint panel */}
      {lintResults !== null && (
        <div className="rounded-xl border border-border bg-card/50 shadow-sm overflow-hidden mb-4">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-foreground/80">Lint Results</span>
              {(() => {
                const errors = lintResults.filter(i => i.severity === 'error').length
                const warns  = lintResults.filter(i => i.severity === 'warning').length
                const infos  = lintResults.filter(i => i.severity === 'info').length
                return (<>
                  {errors > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">{errors} error{errors !== 1 ? 's' : ''}</span>}
                  {warns  > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">{warns} warning{warns !== 1 ? 's' : ''}</span>}
                  {infos  > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">{infos} suggestion{infos !== 1 ? 's' : ''}</span>}
                </>)
              })()}
            </div>
            <button onClick={() => setLintResults(null)} className="text-muted-foreground/50 hover:text-foreground transition-colors"><X className="w-3.5 h-3.5" /></button>
          </div>
          {lintResults.length === 0 ? (
            <div className="px-4 py-3 flex items-center gap-2 text-xs text-emerald-400"><span>✅</span><span>No issues found.</span></div>
          ) : (
            <ul className="divide-y divide-border/40">
              {lintResults.map(issue => {
                const s     = SEVERITY_STYLES[issue.severity]
                const names = issue.policyIds.map(id => policies.find(p => p.id === id)?.name).filter((n): n is string => Boolean(n))
                return (
                  <li key={issue.id} className="px-4 py-3 flex items-start gap-3">
                    <span className="text-xs shrink-0 mt-0.5">{s.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded border', s.bg, s.text, s.border)}>{s.label}</span>
                        <span className="text-xs font-semibold text-foreground/90">{issue.title}</span>
                      </div>
                      <p className="text-xs text-muted-foreground/70 mt-0.5 leading-relaxed">{issue.detail}</p>
                      {names.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {names.map(n => <span key={n} className="text-[10px] px-1.5 py-0.5 rounded bg-muted/40 text-muted-foreground/60 border border-border">{n}</span>)}
                        </div>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}

      {/* Empty state */}
      {visible.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          {policies.length === 0 ? (
            <>
              <div className="w-12 h-12 rounded-xl bg-card border border-border flex items-center justify-center mb-4 shadow-sm">
                <ShieldCheck className="w-6 h-6 text-muted-foreground/40" />
              </div>
              <p className="text-sm font-semibold text-foreground/70 mb-1">No policies yet</p>
              <p className="text-xs text-muted-foreground/50 mb-6 max-w-xs">
                Generate the recommended GenAI policy set from your App Governance control matrix, or create one manually.
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-md bg-foreground text-background hover:bg-foreground/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {isGenerating ? 'Generating…' : 'Generate Policies'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewModal(true)}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-md border border-border bg-card hover:bg-muted/40 text-foreground/70 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> New Policy
                </button>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground/60">No policies match the current filters.</p>
          )}
        </div>
      )}

      {/* Policy table */}
      {visible.length > 0 && (
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-card/80">
                  {selectMode && (
                    <th className="w-8 px-3 py-2.5">
                      <SelectAllBox
                        checked={allVisibleSelected}
                        indeterminate={someVisibleSelected && !allVisibleSelected}
                        onChange={toggleSelectAll}
                      />
                    </th>
                  )}
                  <th className="w-8 px-2 py-2.5 text-[10px] font-semibold text-muted-foreground/30 text-right">#</th>
                  <th className="text-left text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wide px-3 py-2.5">
                    Name
                    <span className="ml-2 text-[10px] font-normal text-muted-foreground/30 normal-case tracking-normal">{visible.length} {visible.length === 1 ? 'policy' : 'policies'}</span>
                  </th>
                  {col('source')      && <th className="text-left text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wide px-3 py-2.5">Source</th>}
                  {col('destination') && <th className="text-left text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wide px-3 py-2.5">Destination</th>}
                  {col('data')        && <th className="text-left text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wide px-3 py-2.5">Data</th>}
                  {col('activities')  && <th className="text-left text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wide px-3 py-2.5">Activities</th>}
                  <th className="text-left text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wide px-3 py-2.5">Action</th>
                  <th className="text-left text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wide px-3 py-2.5">Status</th>
                  {col('family')      && <th className="text-left text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wide px-3 py-2.5">Family</th>}
                  {col('test')        && <th className="text-left text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wide px-3 py-2.5">Test</th>}
                  {col('vendor')      && <th className="text-left text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wide px-3 py-2.5">Vendor</th>}
                  <th className="w-16 px-3 py-2.5">
                    <div ref={colPickerRef} className="relative flex justify-end">
                      <button
                        onClick={() => setColPickerOpen(o => !o)}
                        className={cn(
                          'text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors p-0.5 rounded',
                          colPickerOpen && 'text-muted-foreground/60',
                        )}
                        title="Customise columns"
                      >
                        <Settings className="w-3.5 h-3.5" />
                      </button>
                      {colPickerOpen && (
                        <div className="absolute right-0 top-full mt-1.5 z-40 w-44 rounded-xl border border-border bg-card shadow-xl py-1.5">
                          <p className="px-3 py-1 text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wide">Columns</p>
                          {COLUMN_DEFS.map(({ id, label }) => (
                            <label key={id} className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-muted/40 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={visibleCols.has(id)}
                                onChange={() => toggleCol(id)}
                                className="accent-foreground w-3 h-3"
                              />
                              <span className="text-xs text-foreground/80">{label}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  </th>
                </tr>
              </thead>

              <tbody>
                {visible.map((policy, idx) => (
                  <tr key={policy.id}
                    className={cn(
                      'border-b border-border/40 last:border-0 transition-colors',
                      selectedIds.has(policy.id)
                        ? 'bg-blue-500/5 hover:bg-blue-500/8'
                        : 'hover:bg-card/40',
                      !policy.is_active && 'opacity-50',
                    )}
                  >
                    {selectMode && (
                      <td className="px-3 py-2.5 align-middle w-8">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(policy.id)}
                          onChange={() => toggleSelect(policy.id)}
                          className="accent-foreground w-3 h-3 cursor-pointer"
                        />
                      </td>
                    )}

                    <td className="px-2 py-2.5 align-middle text-right w-8">
                      <span className="text-[10px] text-muted-foreground/30 tabular-nums">{idx + 1}</span>
                    </td>

                    <td className="px-3 py-2.5 align-middle max-w-[240px]">
                      <Link href={`/genai-controls/policies/${policy.id}/edit`} className="group">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="font-semibold text-foreground/90 leading-tight truncate group-hover:text-foreground transition-colors">{policy.name}</p>
                          {policy.policy_source === 'predefined' && !policy.is_customized && (
                            <span className="shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded border bg-blue-500/10 text-blue-400 border-blue-500/20">
                              Predefined
                            </span>
                          )}
                          {policy.policy_source === 'predefined' && policy.is_customized && (
                            <span className="shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded border bg-amber-500/10 text-amber-400 border-amber-500/20">
                              Modified
                            </span>
                          )}
                        </div>
                        {policy.description && (
                          <p className="text-muted-foreground/50 mt-0.5 truncate text-[10px]">{policy.description}</p>
                        )}
                      </Link>
                    </td>

                    {col('source')      && <td className="px-3 py-2.5 align-middle"><SourceCell policy={policy} identityFields={identityFields} /></td>}
                    {col('destination') && <td className="px-3 py-2.5 align-middle"><DestCell policy={policy} apps={apps} categories={categories} /></td>}
                    {col('data')        && <td className="px-3 py-2.5 align-middle"><DataTypeCell policy={policy} ruleItems={ruleItems} /></td>}
                    {col('activities')  && <td className="px-3 py-2.5 align-middle"><ActivitiesCell policy={policy} ruleItems={ruleItems} /></td>}

                    <td className="px-3 py-2.5 align-middle">
                      <ActionCell policy={policy} ruleItems={ruleItems} />
                    </td>

                    <td className="px-3 py-2.5 align-middle">
                      <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded border', APPROVAL_STYLES[policy.approval_status])}>
                        {policy.approval_status.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                      </span>
                    </td>

                    {col('family') && (
                      <td className="px-3 py-2.5 align-middle">
                        {policy.policy_family
                          ? <span className="text-[10px] text-muted-foreground/70 truncate block max-w-[120px]">{policy.policy_family}</span>
                          : <span className="text-[10px] text-muted-foreground/30 italic">—</span>}
                      </td>
                    )}

                    {col('test') && (
                      <td className="px-3 py-2.5 align-middle">
                        <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded border whitespace-nowrap', TEST_CHIP[policy.test_status ?? 'untested'])}>
                          {TEST_LABELS[policy.test_status ?? 'untested']}
                        </span>
                      </td>
                    )}

                    {col('vendor') && (
                      <td className="px-3 py-2.5 align-middle">
                        <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded border whitespace-nowrap', VENDOR_CHIP[policy.vendor_translation_status ?? 'pending'])}>
                          {VENDOR_LABELS[policy.vendor_translation_status ?? 'pending']}
                        </span>
                      </td>
                    )}

                    <td className="px-3 py-2.5 align-middle">
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={e => {
                            const rect = e.currentTarget.getBoundingClientRect()
                            menuTriggerRef.current = e.currentTarget
                            setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
                            setOpenMenuId(prev => prev === policy.id ? null : policy.id)
                          }}
                          className="text-muted-foreground/40 hover:text-foreground transition-colors p-0.5 rounded"
                          title="Actions"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                        {openMenuId === policy.id && (
                          <div
                            className="fixed z-50 bg-card border border-border rounded-lg shadow-xl py-1 min-w-[160px]"
                            style={{ top: menuPos.top, right: menuPos.right }}
                          >
                            <Link
                              href={`/genai-controls/policies/${policy.id}/edit`}
                              onClick={() => setOpenMenuId(null)}
                              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-foreground/80 hover:bg-muted/40 transition-colors"
                            >
                              <Pencil className="w-3.5 h-3.5 text-muted-foreground/60" />
                              Edit
                            </Link>
                            <button
                              type="button"
                              onClick={() => { setOpenMenuId(null); openChat(policy.id) }}
                              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-foreground/80 hover:bg-muted/40 transition-colors"
                            >
                              <MessageSquare className="w-3.5 h-3.5 text-muted-foreground/60" />
                              Refine with AI
                            </button>
                            <button
                              type="button"
                              onClick={() => { setOpenMenuId(null); duplicatePolicy(policy.id).then(() => router.refresh()) }}
                              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-foreground/80 hover:bg-muted/40 transition-colors"
                            >
                              <Copy className="w-3.5 h-3.5 text-muted-foreground/60" />
                              Duplicate
                            </button>
                            <div className="my-1 border-t border-border/40" />
                            <button
                              type="button"
                              onClick={() => { setOpenMenuId(null); handleToggle(policy.id, policy.is_active) }}
                              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-foreground/80 hover:bg-muted/40 transition-colors"
                            >
                              {policy.is_active
                                ? <><ShieldAlert className="w-3.5 h-3.5 text-amber-400" />Disable</>
                                : <><ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />Activate</>
                              }
                            </button>
                            {policy.policy_source === 'predefined' && policy.is_customized && (
                              <>
                                <div className="my-1 border-t border-border/40" />
                                <button
                                  type="button"
                                  onClick={() => { setOpenMenuId(null); handleResetToDefault(policy.id) }}
                                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-amber-400 hover:bg-amber-500/10 transition-colors"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                  Reset to Default
                                </button>
                              </>
                            )}
                            <div className="my-1 border-t border-border/40" />
                            <button
                              type="button"
                              onClick={() => { setOpenMenuId(null); handleDelete(policy.id, policy.name) }}
                              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  )
}
