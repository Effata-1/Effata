'use client'

import { Fragment, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Check, ChevronDown, ChevronRight, Loader2, Pencil, Plus, Search,
  ShieldAlert, Trash2, Users2, Target, ShieldCheck, Zap, FileText, ToggleLeft, X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { colorClasses } from '@/lib/data-catalog/types'
import { upsertPolicy, deletePolicy, togglePolicyActive } from '../actions'
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

const APPROVAL_STATUSES: ApprovalStatus[] = ['draft', 'under-review', 'approved', 'rejected', 'expired']

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

const IDENTITY_FIELD_ORDER = ['business_function', 'privilege_level', 'employment_type', 'user_lifecycle_status'] as const
const IDENTITY_FIELD_LABELS: Record<string, string> = {
  business_function:     'Business Function',
  privilege_level:       'Privilege Level',
  employment_type:       'Employment Type',
  user_lifecycle_status: 'User Lifecycle Status',
}
const RISK_DOT: Record<string, string> = {
  critical: 'bg-red-400', high: 'bg-amber-400', medium: 'bg-blue-400', low: 'bg-emerald-400',
}
const LAYER_LABELS: Record<number, string> = {
  1: 'Classification Levels', 2: 'Org Data Types', 3: 'Catalog Reference Types',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function DestCell({ policy, apps }: { policy: GenAIPolicy; apps: App[] }) {
  const ids = policy.scope_app_ids ?? []
  if (ids.length === 0) return <span className="text-[11px] text-muted-foreground/40 italic">All GenAI apps</span>
  const scoped = apps.filter(a => ids.includes(a.app_id))
  if (scoped.length === 0) return <span className="text-[11px] text-muted-foreground/40 italic">All GenAI apps</span>
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

function DataCell({ policy, ruleItems }: { policy: GenAIPolicy; ruleItems: RuleItem[] }) {
  const rules = policy.rules ?? []
  const { selectedDataKeys, selectedActivities } = deriveFromRules(rules, ruleItems)
  const names = ruleItems.filter(i => selectedDataKeys.has(i.key)).map(i => i.name)
  const acts  = ACTIVITIES.filter(a => selectedActivities.has(a.key)).map(a => a.label)
  if (names.length === 0) {
    return (
      <div className="space-y-1">
        <span className="text-[11px] text-muted-foreground/40 italic">All data</span>
        <div className="flex gap-0.5 flex-wrap">
          {acts.map(l => <span key={l} className="text-[9px] px-1 py-0.5 rounded bg-muted/40 border border-border/40 text-muted-foreground/50">{l}</span>)}
        </div>
      </div>
    )
  }
  return (
    <div className="space-y-1">
      <span className="text-[11px] text-foreground/80 truncate block max-w-[140px]">
        {names[0]}{names.length > 1 ? ` +${names.length - 1}` : ''}
      </span>
      <div className="flex gap-0.5 flex-wrap">
        {acts.map(l => <span key={l} className="text-[9px] px-1 py-0.5 rounded bg-muted/40 border border-border/40 text-muted-foreground/50">{l}</span>)}
      </div>
    </div>
  )
}

function ActionCell({ policy, ruleItems }: { policy: GenAIPolicy; ruleItems: RuleItem[] }) {
  const { primaryAction } = deriveFromRules(policy.rules ?? [], ruleItems)
  const label = primaryAction === 'not-set' ? 'Inherited' : ACTION_LABELS[primaryAction]
  return (
    <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded border whitespace-nowrap', ACTION_CHIP[primaryAction])}>
      {label}
    </span>
  )
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ icon, label, children, noBorder }: {
  icon: React.ReactNode; label: string; children: React.ReactNode; noBorder?: boolean
}) {
  return (
    <div className={cn('flex gap-0', !noBorder && 'border-b border-border/60')}>
      <div className="w-32 shrink-0 flex items-start gap-2 px-4 py-4 text-muted-foreground/60">
        <span className="mt-0.5 shrink-0 [&>svg]:w-3.5 [&>svg]:h-3.5">{icon}</span>
        <span className="text-[10px] font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <div className="flex-1 px-4 py-4 min-w-0">{children}</div>
    </div>
  )
}

// ── Source section ────────────────────────────────────────────────────────────

function EditSourceSection({ identityContext, setIdentityContext, identityFields }: {
  identityContext:    Set<string>
  setIdentityContext: (v: Set<string>) => void
  identityFields:     Record<string, IdentityOption[]>
}) {
  const [open, setOpen]           = useState(false)
  const [fieldOpen, setFieldOpen] = useState<string | null>(null)

  function toggle(id: string) {
    const next = new Set(identityContext)
    next.has(id) ? next.delete(id) : next.add(id)
    setIdentityContext(next)
  }

  const allValues    = IDENTITY_FIELD_ORDER.flatMap(f => identityFields[f] ?? [])
  const selectedVals = allValues.filter(v => identityContext.has(v.id))
  const hasAny       = IDENTITY_FIELD_ORDER.some(f => (identityFields[f]?.length ?? 0) > 0)

  return (
    <div className="space-y-2">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-3.5 py-2 rounded-lg border border-border/60 text-left hover:border-border transition-colors"
      >
        <span className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wide shrink-0 w-8">User</span>
        <span className="text-xs text-muted-foreground/40 mr-1">=</span>
        {selectedVals.length === 0 ? (
          <span className="flex-1 text-xs text-muted-foreground/40 italic">All Users — click to filter</span>
        ) : (
          <div className="flex-1 flex flex-wrap gap-1">
            {selectedVals.map(v => (
              <span key={v.id} className="flex items-center gap-1 px-2 py-0.5 rounded bg-foreground/10 border border-foreground/20 text-xs text-foreground/80">
                <span className={cn('w-1.5 h-1.5 rounded-full', RISK_DOT[v.risk_level] ?? 'bg-muted')} />
                {v.value_name}
                <span role="button" tabIndex={0}
                  onClick={e => { e.stopPropagation(); toggle(v.id) }}
                  onKeyDown={e => e.key === 'Enter' && toggle(v.id)}
                  className="ml-0.5 text-muted-foreground/40 hover:text-foreground/60"
                ><X className="w-2.5 h-2.5" /></span>
              </span>
            ))}
          </div>
        )}
        <ChevronDown className={cn('w-3.5 h-3.5 text-muted-foreground/30 shrink-0 ml-auto transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="rounded-lg border border-border/50 bg-card/30 overflow-hidden">
          {!hasAny ? (
            <p className="px-4 py-3 text-xs text-muted-foreground/40 italic">No identity values configured.</p>
          ) : IDENTITY_FIELD_ORDER.map(field => {
            const values  = identityFields[field] ?? []
            if (!values.length) return null
            const isOpen  = fieldOpen === field
            const selCount = values.filter(v => identityContext.has(v.id)).length
            return (
              <div key={field} className="border-b border-border/40 last:border-0">
                <button type="button"
                  onClick={() => setFieldOpen(isOpen ? null : field)}
                  className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-muted/20 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-foreground/80">{IDENTITY_FIELD_LABELS[field]}</span>
                    {selCount > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-foreground/10 border border-foreground/20 text-foreground/70 font-semibold">{selCount}</span>
                    )}
                  </div>
                  <ChevronDown className={cn('w-3 h-3 text-muted-foreground/30 transition-transform', isOpen && 'rotate-180')} />
                </button>
                {isOpen && (
                  <div className="px-4 pb-3 pt-1 flex flex-wrap gap-1.5 border-t border-border/30 bg-card/20">
                    {values.map(v => {
                      const sel = identityContext.has(v.id)
                      return (
                        <button key={v.id} type="button" onClick={() => toggle(v.id)}
                          className={cn('flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all',
                            sel ? 'bg-foreground/10 border-foreground/30 text-foreground'
                                : 'border-border text-muted-foreground/70 hover:border-border-strong')}
                        >
                          <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', RISK_DOT[v.risk_level] ?? 'bg-muted')} />
                          {v.value_name}
                          {sel && <Check className="w-2.5 h-2.5 ml-0.5" />}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Destination section ───────────────────────────────────────────────────────

function EditDestSection({ selectedAppIds, setSelectedAppIds, apps }: {
  selectedAppIds:    Set<string>
  setSelectedAppIds: (v: Set<string>) => void
  apps:              App[]
}) {
  const [open, setOpen]     = useState(false)
  const [search, setSearch] = useState('')
  const filtered = apps.filter(a =>
    a.app_name.toLowerCase().includes(search.toLowerCase()) ||
    (a.vendor ?? '').toLowerCase().includes(search.toLowerCase())
  )

  function toggle(id: string) {
    const next = new Set(selectedAppIds)
    next.has(id) ? next.delete(id) : next.add(id)
    setSelectedAppIds(next)
  }

  const selectedApps = apps.filter(a => selectedAppIds.has(a.app_id))

  return (
    <div className="space-y-2">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-3.5 py-2 rounded-lg border border-border/60 text-left hover:border-border transition-colors"
      >
        <span className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wide shrink-0 w-8">Apps</span>
        <span className="text-xs text-muted-foreground/40 mr-1">=</span>
        {selectedApps.length === 0 ? (
          <span className="flex-1 text-xs text-muted-foreground/40 italic">All apps — click to scope to specific apps</span>
        ) : (
          <div className="flex-1 flex flex-wrap gap-1">
            {selectedApps.slice(0, 4).map(a => (
              <span key={a.app_id} className="flex items-center gap-1 px-2 py-0.5 rounded bg-foreground/10 border border-foreground/20 text-xs text-foreground/80">
                <span className="w-3 h-3 rounded flex items-center justify-center text-[8px] font-bold text-foreground shrink-0" style={{ backgroundColor: a.logo_bg }}>{a.logo_letter}</span>
                {a.app_name}
              </span>
            ))}
            {selectedApps.length > 4 && <span className="px-2 py-0.5 rounded bg-muted/60 border border-border text-xs text-muted-foreground/60">+{selectedApps.length - 4} more</span>}
          </div>
        )}
        <ChevronDown className={cn('w-3.5 h-3.5 text-muted-foreground/30 shrink-0 ml-auto transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="rounded-lg border border-border/50 bg-card/30 p-3 space-y-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground/30" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search apps…"
              className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground/30 border border-border/50 rounded-md pl-7 pr-3 py-1.5 focus:outline-none focus:border-border transition-colors"
            />
          </div>
          <div className="grid grid-cols-3 gap-1.5 max-h-48 overflow-y-auto">
            {filtered.map(app => {
              const checked = selectedAppIds.has(app.app_id)
              return (
                <button key={app.app_id} type="button" onClick={() => toggle(app.app_id)}
                  className={cn('flex items-center gap-2 px-2.5 py-2 rounded-lg border text-left transition-all',
                    checked ? 'border-foreground/30 bg-foreground/10' : 'border-border hover:border-border-strong')}
                >
                  <div className="w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold text-foreground shrink-0" style={{ backgroundColor: app.logo_bg }}>{app.logo_letter}</div>
                  <span className="text-xs font-medium text-foreground/80 truncate">{app.app_name}</span>
                  {checked && <Check className="w-3 h-3 text-foreground/60 ml-auto shrink-0" />}
                </button>
              )
            })}
          </div>
          {selectedAppIds.size > 0 && (
            <button type="button" onClick={() => setSelectedAppIds(new Set())} className="text-[10px] text-muted-foreground/40 hover:text-foreground/60 underline">Clear selection (apply to all apps)</button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Data Profile section ──────────────────────────────────────────────────────

function EditDataSection({ selectedDataKeys, setSelectedDataKeys, selectedActivities, setSelectedActivities, ruleItems }: {
  selectedDataKeys:      Set<string>
  setSelectedDataKeys:   (v: Set<string>) => void
  selectedActivities:    Set<Activity>
  setSelectedActivities: (v: Set<Activity>) => void
  ruleItems:             RuleItem[]
}) {
  const [open, setOpen]             = useState(false)
  const [activeLayer, setActiveLayer] = useState<1 | 2 | 3>(1)

  function toggleData(key: string) {
    const next = new Set(selectedDataKeys)
    next.has(key) ? next.delete(key) : next.add(key)
    setSelectedDataKeys(next)
  }

  function toggleAct(act: Activity) {
    const next = new Set(selectedActivities)
    next.has(act) ? next.delete(act) : next.add(act)
    setSelectedActivities(next)
  }

  const layers       = [...new Set(ruleItems.map(i => i.layer))] as (1 | 2 | 3)[]
  const visibleItems = ruleItems.filter(i => i.layer === activeLayer)
  const selectedNames = ruleItems.filter(i => selectedDataKeys.has(i.key)).map(i => i.name)

  return (
    <div className="space-y-3">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-3.5 py-2 rounded-lg border border-border/60 text-left hover:border-border transition-colors"
      >
        <span className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wide shrink-0 w-8">Data</span>
        <span className="text-xs text-muted-foreground/40 mr-1">=</span>
        {selectedNames.length === 0 ? (
          <span className="flex-1 text-xs text-muted-foreground/40 italic">All data — click to select types</span>
        ) : (
          <div className="flex-1 flex flex-wrap gap-1">
            {selectedNames.slice(0, 4).map(n => (
              <span key={n} className="px-2 py-0.5 rounded bg-foreground/10 border border-foreground/20 text-xs text-foreground/80">{n}</span>
            ))}
            {selectedNames.length > 4 && <span className="px-2 py-0.5 rounded bg-muted/60 border border-border text-xs text-muted-foreground/60">+{selectedNames.length - 4} more</span>}
          </div>
        )}
        <ChevronDown className={cn('w-3.5 h-3.5 text-muted-foreground/30 shrink-0 ml-auto transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="rounded-lg border border-border/50 bg-card/30 overflow-hidden">
          {layers.length > 1 && (
            <div className="flex border-b border-border/50 bg-card/50">
              {layers.map(l => (
                <button key={l} type="button" onClick={() => setActiveLayer(l)}
                  className={cn('px-4 py-2 text-[10px] font-semibold uppercase tracking-wide transition-colors',
                    activeLayer === l ? 'text-foreground border-b-2 border-foreground -mb-px bg-card/30' : 'text-muted-foreground/50 hover:text-muted-foreground/80')}
                >
                  Layer {l} — {LAYER_LABELS[l]}
                </button>
              ))}
            </div>
          )}
          <div className="p-3 flex flex-wrap gap-1.5">
            {visibleItems.map(item => {
              const cc  = colorClasses(item.color)
              const sel = selectedDataKeys.has(item.key)
              return (
                <button key={item.key} type="button" onClick={() => toggleData(item.key)}
                  className={cn('flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all',
                    item.layer === 3 && 'opacity-60',
                    sel ? 'bg-foreground/10 border-foreground/30 text-foreground' : 'border-border text-muted-foreground/70 hover:border-border-strong')}
                >
                  <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', cc.dot)} />
                  {item.name}
                  {sel && <Check className="w-2.5 h-2.5 ml-0.5 shrink-0" />}
                </button>
              )
            })}
          </div>
          {selectedDataKeys.size > 0 && (
            <div className="px-3 py-2 border-t border-border/40">
              <button type="button" onClick={() => setSelectedDataKeys(new Set())} className="text-[10px] text-muted-foreground/40 hover:text-foreground/60 underline">Clear all</button>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-3 px-3.5 py-2 rounded-lg border border-border/60">
        <span className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wide shrink-0 w-16">Activities</span>
        <span className="text-xs text-muted-foreground/40 mr-1">=</span>
        <div className="flex flex-wrap gap-1.5">
          {ACTIVITIES.map(act => {
            const sel = selectedActivities.has(act.key)
            return (
              <button key={act.key} type="button" onClick={() => toggleAct(act.key)}
                className={cn('flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all',
                  sel ? 'bg-foreground/10 border-foreground/30 text-foreground' : 'border-border text-muted-foreground/50 hover:border-border-strong')}
              >
                {sel && <Check className="w-2.5 h-2.5 shrink-0" />}
                {act.label}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Policy Form Modal (create + edit) ─────────────────────────────────────────

function PolicyFormModal({ policy, apps, classifications, identityFields, ruleItems, onClose, onRefresh }: {
  policy:          GenAIPolicy | null   // null = create new
  apps:            App[]
  classifications: Classification[]
  identityFields:  Record<string, IdentityOption[]>
  ruleItems:       RuleItem[]
  onClose:         () => void
  onRefresh:       () => void
}) {
  const isNew    = policy === null
  const derived  = deriveFromRules(policy?.rules ?? [], ruleItems)

  const [identityContext, setIdentityContext]   = useState<Set<string>>(new Set(policy?.identity_context ?? []))
  const [selectedAppIds, setSelectedAppIds]     = useState<Set<string>>(new Set(policy?.scope_app_ids ?? []))
  const [selectedDataKeys, setSelectedDataKeys] = useState<Set<string>>(derived.selectedDataKeys)
  const [selectedActivities, setSelectedActivities] = useState<Set<Activity>>(derived.selectedActivities)
  const [primaryAction, setPrimaryAction]       = useState<ActionCode>(derived.primaryAction)
  const [name, setName]                         = useState(policy?.name ?? '')
  const [description, setDescription]           = useState(policy?.description ?? '')
  const [approvalStatus, setApprovalStatus]     = useState<ApprovalStatus>(policy?.approval_status ?? 'draft')
  const [isActive, setIsActive]                 = useState(policy?.is_active ?? true)
  const [isPending, startTransition]            = useTransition()
  const [error, setError]                       = useState<string | null>(null)

  function handleSave() {
    if (!name.trim()) { setError('Policy name is required.'); return }
    setError(null)

    const saveRules: PolicyRule[] = primaryAction === 'not-set'
      ? []
      : ruleItems
          .filter(i => selectedDataKeys.has(i.key))
          .map(i => ({
            data_type:   i.key,
            post_prompt: selectedActivities.has('post_prompt') ? primaryAction : 'not-set',
            upload:      selectedActivities.has('upload')      ? primaryAction : 'not-set',
            download:    selectedActivities.has('download')    ? primaryAction : 'not-set',
            response:    selectedActivities.has('response')    ? primaryAction : 'not-set',
          }))

    startTransition(async () => {
      const res = await upsertPolicy(policy?.id ?? null, {
        name:             name.trim(),
        description:      description || undefined,
        approval_status:  approvalStatus,
        is_active:        isActive,
        scope_all_apps:   false,
        scope_app_ids:    Array.from(selectedAppIds),
        rules:            saveRules,
        identity_context: identityContext.size > 0 ? [...identityContext] : null,
      })
      if (res.error) { setError(res.error); return }
      onRefresh()
      onClose()
    })
  }

  const inputCls = 'w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/30 border border-border/60 rounded-lg px-3.5 py-2.5 focus:border-border focus:outline-none transition-colors'

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-2xl my-8">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-card z-10 rounded-t-xl">
          <h2 className="text-sm font-semibold text-foreground">{isNew ? 'New Policy' : 'Edit Policy'}</h2>
          <button onClick={onClose} className="text-muted-foreground/60 hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="divide-y divide-border/60">
          <Section icon={<Users2 />} label="Source">
            <EditSourceSection
              identityContext={identityContext} setIdentityContext={setIdentityContext}
              identityFields={identityFields}
            />
          </Section>

          <Section icon={<Target />} label="Destination">
            <EditDestSection
              selectedAppIds={selectedAppIds} setSelectedAppIds={setSelectedAppIds}
              apps={apps}
            />
          </Section>

          <Section icon={<ShieldCheck />} label="Data Profile">
            <EditDataSection
              selectedDataKeys={selectedDataKeys} setSelectedDataKeys={setSelectedDataKeys}
              selectedActivities={selectedActivities} setSelectedActivities={setSelectedActivities}
              ruleItems={ruleItems}
            />
          </Section>

          <Section icon={<Zap />} label="Action">
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wide">Action</span>
              <span className="text-xs text-muted-foreground/40">=</span>
              <select
                value={primaryAction}
                onChange={e => setPrimaryAction(e.target.value as ActionCode)}
                className={cn('text-xs font-semibold px-3 py-2 rounded-lg border cursor-pointer appearance-none focus:outline-none transition-colors bg-card',
                  primaryAction !== 'not-set' ? ACTION_CHIP[primaryAction] : 'border-border/60 text-muted-foreground/60')}
              >
                {ACTION_CODES.map(ac => (
                  <option key={ac} value={ac} className="bg-card text-foreground font-normal">{ACTION_LABELS[ac]}</option>
                ))}
              </select>
            </div>
          </Section>

          <Section icon={<FileText />} label="Details">
            <div className="space-y-3 max-w-md">
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wide block mb-1.5">
                  Policy Name <span className="text-red-400">*</span>
                </label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. GenAI Data Handling Policy" className={inputCls} />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wide block mb-1.5">Description</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} className={`${inputCls} resize-none`} />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wide block mb-1.5">Approval Status</label>
                <select value={approvalStatus} onChange={e => setApprovalStatus(e.target.value as ApprovalStatus)}
                  className="bg-card text-xs text-foreground border border-border/60 rounded-lg px-3 py-2 focus:outline-none appearance-none cursor-pointer"
                >
                  {APPROVAL_STATUSES.map(s => (
                    <option key={s} value={s}>{s.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
                  ))}
                </select>
              </div>
            </div>
          </Section>

          <Section icon={<ToggleLeft />} label="Status" noBorder>
            <div className="flex gap-2">
              {[true, false].map(val => (
                <button key={String(val)} type="button" onClick={() => setIsActive(val)}
                  className={cn('flex items-center gap-2 px-4 py-2 rounded-lg border text-xs font-semibold transition-all',
                    isActive === val
                      ? val ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-muted/60 border-border text-muted-foreground'
                      : 'border-border text-muted-foreground/50 hover:border-border-strong')}
                >
                  <span className={cn('w-2 h-2 rounded-full', val ? 'bg-emerald-400' : 'bg-muted-foreground/40')} />
                  {val ? 'Enabled' : 'Draft / Disabled'}
                </button>
              ))}
            </div>
          </Section>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border sticky bottom-0 bg-card rounded-b-xl">
          {error && <p className="text-xs text-red-400 mr-auto">{error}</p>}
          <button onClick={onClose} className="px-4 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={isPending}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-md bg-foreground text-background hover:bg-foreground/90 disabled:opacity-50 transition-colors"
          >
            {isPending && <Loader2 className="w-3 h-3 animate-spin" />}
            {isNew ? 'Create Policy' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function PolicyList({ policies: initialPolicies, categories, apps, classifications, identityFields, ruleItems }: Props) {
  const router                              = useRouter()
  const [policies, setPolicies]             = useState<GenAIPolicy[]>(initialPolicies)
  const [filterStatus, setFilterStatus]     = useState<ApprovalStatus | 'all'>('all')
  const [activeOnly, setActiveOnly]         = useState(false)
  const [search, setSearch]                 = useState('')
  const [modalPolicy, setModalPolicy]       = useState<GenAIPolicy | null | 'new'>(null)  // null=closed, 'new'=create, GenAIPolicy=edit
  const [lintResults, setLintResults]       = useState<LintIssue[] | null>(null)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [, startTransition]                 = useTransition()

  const categoryMap = new Map(categories.map(c => [c.id, c]))

  const visible = policies.filter(p => {
    if (filterStatus !== 'all' && p.approval_status !== filterStatus) return false
    if (activeOnly && !p.is_active) return false
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  // Group by governance category
  type Group = { cat: Category | null; key: string; policies: GenAIPolicy[] }
  const groups: Group[] = []
  const byCategory = new Map<string | null, GenAIPolicy[]>()
  for (const p of visible) {
    const key = p.category_id ?? null
    if (!byCategory.has(key)) byCategory.set(key, [])
    byCategory.get(key)!.push(p)
  }
  for (const cat of categories) {
    const ps = byCategory.get(cat.id)
    if (ps?.length) groups.push({ cat, key: cat.id, policies: ps })
  }
  const uncategorized = byCategory.get(null) ?? []
  if (uncategorized.length) groups.push({ cat: null, key: 'uncategorized', policies: uncategorized })

  function toggleGroup(key: string) {
    setCollapsedGroups(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  function handleToggle(id: string, current: boolean) {
    setPolicies(ps => ps.map(p => p.id === id ? { ...p, is_active: !current } : p))
    startTransition(async () => { await togglePolicyActive(id, !current) })
  }

  function handleDelete(id: string) {
    if (!confirm('Delete this policy? This cannot be undone.')) return
    setPolicies(ps => ps.filter(p => p.id !== id))
    startTransition(async () => { await deletePolicy(id) })
  }

  function handleRefresh() {
    router.refresh()
  }

  const colCount = 8

  return (
    <>
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
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as ApprovalStatus | 'all')}
          className="bg-card text-xs text-foreground border border-border/60 rounded-md px-2.5 py-1.5 focus:outline-none appearance-none cursor-pointer"
        >
          <option value="all">All statuses</option>
          {APPROVAL_STATUSES.map(s => <option key={s} value={s}>{s.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground/70 cursor-pointer select-none">
          <input type="checkbox" checked={activeOnly} onChange={e => setActiveOnly(e.target.checked)} className="accent-foreground" />
          Active only
        </label>
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
        <button
          onClick={() => setModalPolicy('new')}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-foreground text-background hover:bg-foreground/90 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          New Policy
        </button>
      </div>

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
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm text-muted-foreground/60 mb-4">
            {policies.length === 0 ? 'No policies yet. Create your first GenAI governance policy.' : 'No policies match the current filters.'}
          </p>
          {policies.length === 0 && (
            <button onClick={() => setModalPolicy('new')}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-md bg-foreground text-background hover:bg-foreground/90 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Create Policy
            </button>
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
                  <th className="w-10 px-3 py-2.5" />
                  <th className="text-left text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wide px-3 py-2.5">
                    Name
                    <span className="ml-2 text-[10px] font-normal text-muted-foreground/30 normal-case tracking-normal">{visible.length} {visible.length === 1 ? 'policy' : 'policies'}</span>
                  </th>
                  <th className="text-left text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wide px-3 py-2.5 hidden md:table-cell">Source</th>
                  <th className="text-left text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wide px-3 py-2.5 hidden md:table-cell">Destination</th>
                  <th className="text-left text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wide px-3 py-2.5 hidden lg:table-cell">Data / Activities</th>
                  <th className="text-left text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wide px-3 py-2.5">Action</th>
                  <th className="text-left text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wide px-3 py-2.5">Status</th>
                  <th className="w-16 px-3 py-2.5" />
                </tr>
              </thead>

              <tbody>
                {groups.map(({ cat, key: groupKey, policies: groupPolicies }) => {
                  const cc        = cat ? colorClasses(cat.color) : null
                  const collapsed = collapsedGroups.has(groupKey)

                  return (
                    <Fragment key={groupKey}>
                      {/* Group header */}
                      <tr className="bg-muted/20 border-y border-border/50 hover:bg-muted/30 transition-colors cursor-pointer"
                        onClick={() => toggleGroup(groupKey)}
                      >
                        <td colSpan={colCount} className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            {collapsed
                              ? <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
                              : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />}
                            {cat && cc ? (
                              <span className={cn('text-[11px] font-bold', cc.text)}>{cat.name}</span>
                            ) : (
                              <span className="text-[11px] font-bold text-muted-foreground/60">Uncategorized</span>
                            )}
                            <span className="text-[10px] text-muted-foreground/40 font-normal">({groupPolicies.length})</span>
                          </div>
                        </td>
                      </tr>

                      {/* Policy rows */}
                      {!collapsed && groupPolicies.map((policy) => (
                        <tr key={policy.id}
                          className={cn('border-b border-border/40 last:border-0 hover:bg-card/40 transition-colors', !policy.is_active && 'opacity-50')}
                        >
                          {/* Active toggle */}
                          <td className="px-3 py-2.5 align-middle">
                            <button
                              onClick={() => handleToggle(policy.id, policy.is_active)}
                              className={cn('w-7 h-4 rounded-full transition-colors relative shrink-0', policy.is_active ? 'bg-emerald-500/70' : 'bg-muted')}
                              title={policy.is_active ? 'Deactivate' : 'Activate'}
                            >
                              <span className={cn('absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-all', policy.is_active ? 'left-3.5' : 'left-0.5')} />
                            </button>
                          </td>

                          {/* Name */}
                          <td className="px-3 py-2.5 align-middle max-w-[200px]">
                            <p className="font-semibold text-foreground/90 leading-tight truncate">{policy.name}</p>
                            {policy.description && (
                              <p className="text-muted-foreground/50 mt-0.5 truncate text-[10px]">{policy.description}</p>
                            )}
                          </td>

                          {/* Source */}
                          <td className="px-3 py-2.5 align-middle hidden md:table-cell">
                            <SourceCell policy={policy} identityFields={identityFields} />
                          </td>

                          {/* Destination */}
                          <td className="px-3 py-2.5 align-middle hidden md:table-cell">
                            <DestCell policy={policy} apps={apps} />
                          </td>

                          {/* Data / Activities */}
                          <td className="px-3 py-2.5 align-middle hidden lg:table-cell">
                            <DataCell policy={policy} ruleItems={ruleItems} />
                          </td>

                          {/* Action */}
                          <td className="px-3 py-2.5 align-middle">
                            <ActionCell policy={policy} ruleItems={ruleItems} />
                          </td>

                          {/* Status */}
                          <td className="px-3 py-2.5 align-middle">
                            <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded border', APPROVAL_STYLES[policy.approval_status])}>
                              {policy.approval_status.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="px-3 py-2.5 align-middle">
                            <div className="flex items-center gap-2 justify-end">
                              <button onClick={() => setModalPolicy(policy)} className="text-muted-foreground/50 hover:text-foreground transition-colors" title="Edit">
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => handleDelete(policy.id)} className="text-muted-foreground/50 hover:text-red-400 transition-colors" title="Delete">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Form modal — new or edit */}
      {modalPolicy !== null && (
        <PolicyFormModal
          policy={modalPolicy === 'new' ? null : modalPolicy}
          apps={apps}
          classifications={classifications}
          identityFields={identityFields}
          ruleItems={ruleItems}
          onClose={() => setModalPolicy(null)}
          onRefresh={handleRefresh}
        />
      )}
    </>
  )
}
