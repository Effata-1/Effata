'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Check, ChevronDown, Loader2, Search, Users2, Target, ShieldCheck, Zap, FileText, ToggleLeft, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { colorClasses } from '@/lib/data-catalog/types'
import { upsertPolicy } from '../../actions'
import type { PolicyRule, ActionCode, ApprovalStatus } from '@/lib/genai/types'

// ── Exported types (used by page.tsx + edit page) ─────────────────────────────

export type RuleItemKind = 'label' | 'type' | 'catalog'

export interface RuleItem {
  key:        string
  name:       string
  kind:       RuleItemKind
  color:      string
  layer:      1 | 2 | 3
  layerLabel: string | undefined
}

export interface InitialPolicyData {
  id:               string
  name:             string
  description:      string | null
  is_active:        boolean
  approval_status:  ApprovalStatus
  category_id:      string | null
  scope_app_ids:    string[]
  rules:            PolicyRule[]
  identity_context: string[] | null
}

// ── Local types ───────────────────────────────────────────────────────────────

type IdentityFieldName =
  | 'business_function'
  | 'privilege_level'
  | 'employment_type'
  | 'user_lifecycle_status'

interface IdentityOption {
  id:         string
  field_name: string
  value_name: string
  risk_level: string
}

interface App {
  app_id:      string
  app_name:    string
  vendor:      string
  logo_letter: string
  logo_bg:     string
}

interface Category {
  id:         string
  system_tag: string | null
  name:       string
  color:      string
}

interface Props {
  apps:            App[]
  categories:      Category[]
  identityFields:  Record<string, IdentityOption[]>
  ruleItems:       RuleItem[]
  initialPolicy?:  InitialPolicyData | null
}

// ── Constants ─────────────────────────────────────────────────────────────────

const IDENTITY_FIELD_ORDER: IdentityFieldName[] = [
  'business_function',
  'privilege_level',
  'employment_type',
  'user_lifecycle_status',
]

const IDENTITY_FIELD_LABELS: Record<IdentityFieldName, string> = {
  business_function:     'Business Function',
  privilege_level:       'Privilege Level',
  employment_type:       'Employment Type',
  user_lifecycle_status: 'User Lifecycle Status',
}

const RISK_DOT: Record<string, string> = {
  critical: 'bg-red-400',
  high:     'bg-amber-400',
  medium:   'bg-blue-400',
  low:      'bg-emerald-400',
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
  'not-set':    'bg-muted/40 text-muted-foreground/50 border-border/60',
}

const APPROVAL_STATUSES: ApprovalStatus[] = ['draft', 'under-review', 'approved', 'rejected', 'expired']

type Activity = 'post_prompt' | 'upload' | 'download' | 'response'
const ACTIVITIES: { key: Activity; label: string }[] = [
  { key: 'post_prompt', label: 'Prompt' },
  { key: 'upload',      label: 'Upload' },
  { key: 'download',    label: 'Download' },
  { key: 'response',    label: 'Response' },
]

const LAYER_LABELS: Record<1 | 2 | 3, string> = {
  1: 'Classification Levels',
  2: 'Org Data Types',
  3: 'Catalog Reference Types',
}

// ── Derive initial form state from saved policy rules ─────────────────────────

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

// ── Section wrapper ───────────────────────────────────────────────────────────

function PolicySection({
  icon, label, children, noBorder,
}: {
  icon: React.ReactNode
  label: string
  children: React.ReactNode
  noBorder?: boolean
}) {
  return (
    <div className={cn('flex gap-0', !noBorder && 'border-b border-border/60')}>
      <div className="w-36 shrink-0 flex items-start gap-2 px-5 py-5 text-muted-foreground/60">
        <span className="mt-0.5 shrink-0 [&>svg]:w-3.5 [&>svg]:h-3.5">{icon}</span>
        <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <div className="flex-1 px-5 py-5 min-w-0">
        {children}
      </div>
    </div>
  )
}

// ── Source section — identity context ─────────────────────────────────────────

function SourceSection({
  identityContext, setIdentityContext, identityFields,
}: {
  identityContext: Set<string>
  setIdentityContext: (v: Set<string>) => void
  identityFields: Record<string, IdentityOption[]>
}) {
  const [open, setOpen] = useState(false)
  const [fieldOpen, setFieldOpen] = useState<IdentityFieldName | null>(null)
  const [search, setSearch] = useState<Record<string, string>>({})

  function toggle(id: string) {
    const next = new Set(identityContext)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setIdentityContext(next)
  }

  function clearField(field: IdentityFieldName) {
    const ids = new Set((identityFields[field] ?? []).map(v => v.id))
    setIdentityContext(new Set([...identityContext].filter(id => !ids.has(id))))
  }

  const allValues = IDENTITY_FIELD_ORDER.flatMap(f => identityFields[f] ?? [])
  const selectedValues = allValues.filter(v => identityContext.has(v.id))
  const hasAny = IDENTITY_FIELD_ORDER.some(f => (identityFields[f]?.length ?? 0) > 0)

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg border border-border/60 text-left hover:border-border transition-colors group"
      >
        <span className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wide shrink-0 w-10">User</span>
        <span className="text-xs text-muted-foreground/40 mr-1">=</span>
        {selectedValues.length === 0 ? (
          <span className="flex-1 text-xs text-muted-foreground/40 italic">All Users — click to filter by group</span>
        ) : (
          <div className="flex-1 flex flex-wrap gap-1">
            {selectedValues.map(v => (
              <span key={v.id} className="flex items-center gap-1 px-2 py-0.5 rounded bg-foreground/10 border border-foreground/20 text-xs text-foreground/80">
                <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', RISK_DOT[v.risk_level] ?? 'bg-muted')} />
                {v.value_name}
                <span
                  role="button"
                  tabIndex={0}
                  onClick={e => { e.stopPropagation(); toggle(v.id) }}
                  onKeyDown={e => e.key === 'Enter' && (e.stopPropagation(), toggle(v.id))}
                  className="ml-0.5 text-muted-foreground/40 hover:text-foreground/70"
                >
                  <X className="w-2.5 h-2.5" />
                </span>
              </span>
            ))}
          </div>
        )}
        <ChevronDown className={cn('w-3.5 h-3.5 text-muted-foreground/30 shrink-0 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="rounded-lg border border-border/50 bg-card/30 overflow-hidden">
          {!hasAny ? (
            <p className="px-4 py-3 text-xs text-muted-foreground/40 italic">
              No identity values configured. Set them up in{' '}
              <a href="/policies/identity" className="underline hover:text-muted-foreground/60">Policies → Identity</a>.
            </p>
          ) : (
            IDENTITY_FIELD_ORDER.map(field => {
              const values = identityFields[field] ?? []
              if (!values.length) return null
              const isFieldOpen = fieldOpen === field
              const selectedInField = values.filter(v => identityContext.has(v.id)).length
              const q = (search[field] ?? '').toLowerCase()
              const filtered = q ? values.filter(v => v.value_name.toLowerCase().includes(q)) : values

              return (
                <div key={field} className="border-b border-border/40 last:border-0">
                  <button
                    type="button"
                    onClick={() => setFieldOpen(isFieldOpen ? null : field)}
                    className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-muted/20 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-foreground/80">{IDENTITY_FIELD_LABELS[field]}</span>
                      {selectedInField > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-foreground/10 border border-foreground/20 text-foreground/70 font-semibold">
                          {selectedInField}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedInField > 0 && (
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={e => { e.stopPropagation(); clearField(field) }}
                          onKeyDown={e => e.key === 'Enter' && (e.stopPropagation(), clearField(field))}
                          className="text-[10px] text-muted-foreground/40 hover:text-foreground/60 px-1 rounded"
                        >
                          Clear
                        </span>
                      )}
                      <ChevronDown className={cn('w-3 h-3 text-muted-foreground/30 transition-transform', isFieldOpen && 'rotate-180')} />
                    </div>
                  </button>

                  {isFieldOpen && (
                    <div className="px-4 pb-3 pt-1 space-y-2 border-t border-border/30 bg-card/20">
                      {values.length > 6 && (
                        <div className="relative">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground/30" />
                          <input
                            value={search[field] ?? ''}
                            onChange={e => setSearch(s => ({ ...s, [field]: e.target.value }))}
                            placeholder="Search…"
                            className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground/30 border border-border/50 rounded-md pl-7 pr-3 py-1.5 focus:outline-none focus:border-border transition-colors"
                          />
                        </div>
                      )}
                      <div className="flex flex-wrap gap-1.5">
                        {filtered.map(v => {
                          const sel = identityContext.has(v.id)
                          return (
                            <button
                              key={v.id}
                              type="button"
                              onClick={() => toggle(v.id)}
                              className={cn(
                                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all',
                                sel ? 'bg-foreground/10 border-foreground/30 text-foreground'
                                    : 'border-border text-muted-foreground/70 hover:border-border-strong',
                              )}
                            >
                              <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', RISK_DOT[v.risk_level] ?? 'bg-muted')} />
                              {v.value_name}
                              {sel && <Check className="w-2.5 h-2.5 ml-0.5 shrink-0" />}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}

// ── Destination section — app scope ───────────────────────────────────────────

function DestinationSection({
  selectedAppIds, setSelectedAppIds, apps,
}: {
  selectedAppIds: Set<string>
  setSelectedAppIds: (v: Set<string>) => void
  apps: App[]
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  function toggleApp(appId: string) {
    const next = new Set(selectedAppIds)
    if (next.has(appId)) next.delete(appId)
    else next.add(appId)
    setSelectedAppIds(next)
  }

  const selectedApps  = apps.filter(a => selectedAppIds.has(a.app_id))
  const filteredApps  = apps.filter(a =>
    a.app_name.toLowerCase().includes(search.toLowerCase()) ||
    (a.vendor ?? '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg border border-border/60 text-left hover:border-border transition-colors"
      >
        <span className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wide shrink-0 w-10">Apps</span>
        <span className="text-xs text-muted-foreground/40 mr-1">=</span>
        {selectedApps.length === 0 ? (
          <span className="flex-1 text-xs text-muted-foreground/40 italic">All apps — click to scope to specific apps</span>
        ) : (
          <div className="flex-1 flex flex-wrap gap-1">
            {selectedApps.slice(0, 4).map(a => (
              <span key={a.app_id} className="flex items-center gap-1 px-2 py-0.5 rounded bg-foreground/10 border border-foreground/20 text-xs text-foreground/80">
                <span className="w-3 h-3 rounded flex items-center justify-center text-[8px] font-bold shrink-0" style={{ backgroundColor: a.logo_bg }}>{a.logo_letter}</span>
                {a.app_name}
              </span>
            ))}
            {selectedApps.length > 4 && <span className="px-2 py-0.5 rounded bg-muted/60 border border-border text-xs text-muted-foreground/60">+{selectedApps.length - 4} more</span>}
          </div>
        )}
        <ChevronDown className={cn('w-3.5 h-3.5 text-muted-foreground/30 shrink-0 ml-auto transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="rounded-lg border border-border/50 bg-card/30 p-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground/30" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search apps…"
              className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground/30 border border-border/50 rounded-md pl-7 pr-3 py-1.5 focus:outline-none focus:border-border transition-colors"
            />
          </div>
          <div className="grid grid-cols-3 gap-1.5 max-h-56 overflow-y-auto pr-0.5">
            {filteredApps.map(app => {
              const checked = selectedAppIds.has(app.app_id)
              return (
                <button
                  key={app.app_id}
                  type="button"
                  onClick={() => toggleApp(app.app_id)}
                  className={cn(
                    'flex items-center gap-2 px-2.5 py-2 rounded-lg border text-left transition-all',
                    checked ? 'border-foreground/30 bg-foreground/10' : 'border-border hover:border-border-strong',
                  )}
                >
                  <div
                    className="w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold text-foreground shrink-0"
                    style={{ backgroundColor: app.logo_bg }}
                  >
                    {app.logo_letter}
                  </div>
                  <span className="text-xs font-medium text-foreground/80 truncate">{app.app_name}</span>
                  {checked && <Check className="w-3 h-3 text-foreground/60 ml-auto shrink-0" />}
                </button>
              )
            })}
          </div>
          {selectedAppIds.size > 0 && (
            <div className="flex items-center gap-2 pt-1 border-t border-border/40">
              <span className="text-[10px] text-muted-foreground/50">{selectedAppIds.size} app{selectedAppIds.size !== 1 ? 's' : ''} selected</span>
              <button type="button" onClick={() => setSelectedAppIds(new Set())} className="text-[10px] text-muted-foreground/40 hover:text-foreground/60 underline">Clear</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Data Profile section — data types + activities ────────────────────────────

function DataProfileSection({
  selectedDataKeys, setSelectedDataKeys,
  selectedActivities, setSelectedActivities,
  ruleItems,
}: {
  selectedDataKeys:      Set<string>
  setSelectedDataKeys:   (v: Set<string>) => void
  selectedActivities:    Set<Activity>
  setSelectedActivities: (v: Set<Activity>) => void
  ruleItems:             RuleItem[]
}) {
  const [open, setOpen] = useState(false)
  const [activeLayer, setActiveLayer] = useState<1 | 2 | 3>(1)

  function toggleData(key: string) {
    const next = new Set(selectedDataKeys)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    setSelectedDataKeys(next)
  }

  function toggleActivity(act: Activity) {
    const next = new Set(selectedActivities)
    if (next.has(act)) next.delete(act)
    else next.add(act)
    setSelectedActivities(next)
  }

  const layers: (1 | 2 | 3)[] = [...new Set(ruleItems.map(i => i.layer))] as (1 | 2 | 3)[]
  const visibleItems = ruleItems.filter(i => i.layer === activeLayer)
  const selectedNames = ruleItems.filter(i => selectedDataKeys.has(i.key)).map(i => i.name)

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg border border-border/60 text-left hover:border-border transition-colors"
      >
        <span className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wide shrink-0 w-10">Data</span>
        <span className="text-xs text-muted-foreground/40 mr-1">=</span>
        {selectedNames.length === 0 ? (
          <span className="flex-1 text-xs text-muted-foreground/40 italic">All data — click to select types</span>
        ) : (
          <div className="flex-1 flex flex-wrap gap-1">
            {selectedNames.slice(0, 5).map(name => (
              <span key={name} className="px-2 py-0.5 rounded bg-foreground/10 border border-foreground/20 text-xs text-foreground/80">{name}</span>
            ))}
            {selectedNames.length > 5 && (
              <span className="px-2 py-0.5 rounded bg-muted/60 border border-border text-xs text-muted-foreground/60">+{selectedNames.length - 5} more</span>
            )}
          </div>
        )}
        <ChevronDown className={cn('w-3.5 h-3.5 text-muted-foreground/30 shrink-0 ml-auto transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="rounded-lg border border-border/50 bg-card/30 overflow-hidden">
          {layers.length > 1 && (
            <div className="flex border-b border-border/50 bg-card/50">
              {layers.map(l => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setActiveLayer(l)}
                  className={cn(
                    'px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wide transition-colors',
                    activeLayer === l
                      ? 'text-foreground border-b-2 border-foreground -mb-px bg-card/30'
                      : 'text-muted-foreground/50 hover:text-muted-foreground/80',
                  )}
                >
                  Layer {l} — {LAYER_LABELS[l]}
                  {l === 3 && <span className="ml-1.5 text-[9px] opacity-60">(catalog)</span>}
                </button>
              ))}
            </div>
          )}

          <div className="p-4 flex flex-wrap gap-1.5">
            {visibleItems.length === 0 ? (
              <p className="text-xs text-muted-foreground/40 italic">No items in this layer.</p>
            ) : visibleItems.map(item => {
              const cc = colorClasses(item.color)
              const sel = selectedDataKeys.has(item.key)
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => toggleData(item.key)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all',
                    item.layer === 3 && 'opacity-60',
                    sel ? 'bg-foreground/10 border-foreground/30 text-foreground'
                        : cn('border-border text-muted-foreground/70 hover:border-border-strong'),
                  )}
                >
                  <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', cc.dot)} />
                  {item.name}
                  {item.layerLabel && !sel && (
                    <span className={cn('text-[9px] px-1 rounded', cc.bg, cc.text)}>{item.layerLabel}</span>
                  )}
                  {sel && <Check className="w-2.5 h-2.5 ml-0.5 shrink-0" />}
                </button>
              )
            })}
          </div>

          {selectedDataKeys.size > 0 && (
            <div className="px-4 py-2 border-t border-border/40 flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground/50">{selectedDataKeys.size} type{selectedDataKeys.size !== 1 ? 's' : ''} selected</span>
              <button type="button" onClick={() => setSelectedDataKeys(new Set())} className="text-[10px] text-muted-foreground/40 hover:text-foreground/60 underline">Clear all</button>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-border/60">
        <span className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wide shrink-0 w-20">Activities</span>
        <span className="text-xs text-muted-foreground/40 mr-1">=</span>
        <div className="flex flex-wrap gap-2">
          {ACTIVITIES.map(act => {
            const sel = selectedActivities.has(act.key)
            return (
              <button
                key={act.key}
                type="button"
                onClick={() => toggleActivity(act.key)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all',
                  sel ? 'bg-foreground/10 border-foreground/30 text-foreground'
                      : 'border-border text-muted-foreground/50 hover:border-border-strong',
                )}
              >
                {sel && <Check className="w-2.5 h-2.5 shrink-0" />}
                {act.label}
              </button>
            )
          })}
        </div>
        {selectedActivities.size === 0 && (
          <span className="text-[10px] text-amber-400 ml-1">Select at least one</span>
        )}
      </div>
    </div>
  )
}

// ── Action section ────────────────────────────────────────────────────────────

function ActionSection({
  primaryAction, setPrimaryAction,
}: {
  primaryAction: ActionCode
  setPrimaryAction: (v: ActionCode) => void
}) {
  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wide">Action</span>
        <span className="text-xs text-muted-foreground/40">=</span>
        <select
          value={primaryAction}
          onChange={e => setPrimaryAction(e.target.value as ActionCode)}
          className={cn(
            'text-xs font-semibold px-3 py-2 rounded-lg border cursor-pointer appearance-none focus:outline-none transition-colors bg-card',
            primaryAction !== 'not-set' ? ACTION_CHIP[primaryAction] : 'border-border/60 text-muted-foreground/60',
          )}
        >
          {ACTION_CODES.map(ac => (
            <option key={ac} value={ac} className="bg-card text-foreground font-normal">
              {ACTION_LABELS[ac]}
            </option>
          ))}
        </select>
      </div>

      {primaryAction !== 'not-set' && (
        <span className={cn('text-[10px] px-2 py-1 rounded border font-semibold', ACTION_CHIP[primaryAction])}>
          {primaryAction.toUpperCase().replace(/-/g, ' ')}
        </span>
      )}

      {primaryAction === 'not-set' && (
        <p className="text-xs text-muted-foreground/40 italic">
          Rules inherit from the{' '}
          <a href="/genai-controls/control-matrix" className="underline hover:text-muted-foreground/60 transition-colors">Control Matrix</a>
        </p>
      )}
    </div>
  )
}

// ── Policy Details section ────────────────────────────────────────────────────

function PolicyDetailsSection({
  name, setName, description, setDescription,
  approvalStatus, setApprovalStatus,
}: {
  name: string; setName: (v: string) => void
  description: string; setDescription: (v: string) => void
  approvalStatus: ApprovalStatus; setApprovalStatus: (v: ApprovalStatus) => void
}) {
  const inputCls = 'w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/30 border border-border/60 rounded-lg px-3.5 py-2.5 focus:border-border focus:outline-none transition-colors'
  const selectCls = 'bg-card text-xs text-foreground border border-border/60 rounded-lg px-3 py-2.5 focus:outline-none appearance-none cursor-pointer'

  return (
    <div className="space-y-3 max-w-lg">
      <div>
        <label className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wide block mb-1.5">
          Policy Name <span className="text-red-400">*</span>
        </label>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. ChatGPT Enterprise Upload Block"
          className={inputCls}
        />
      </div>
      <div>
        <label className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wide block mb-1.5">Description</label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="What does this policy enforce?"
          rows={2}
          className={`${inputCls} resize-none`}
        />
      </div>
      <div>
        <label className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wide block mb-1.5">Approval Status</label>
        <select value={approvalStatus} onChange={e => setApprovalStatus(e.target.value as ApprovalStatus)} className={selectCls}>
          {APPROVAL_STATUSES.map(s => (
            <option key={s} value={s}>{s.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
          ))}
        </select>
      </div>
    </div>
  )
}

// ── Status section ────────────────────────────────────────────────────────────

function StatusSection({
  isActive, setIsActive,
}: {
  isActive: boolean; setIsActive: (v: boolean) => void
}) {
  return (
    <div className="flex gap-3">
      {[true, false].map(val => (
        <button
          key={String(val)}
          type="button"
          onClick={() => setIsActive(val)}
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 rounded-lg border text-xs font-semibold transition-all',
            isActive === val
              ? val
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-muted/60 border-border text-muted-foreground'
              : 'border-border text-muted-foreground/50 hover:border-border-strong',
          )}
        >
          <span className={cn('w-2 h-2 rounded-full', val ? 'bg-emerald-400' : 'bg-muted-foreground/40')} />
          {val ? 'Enabled' : 'Draft / Disabled'}
        </button>
      ))}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function PolicyBuilder({ apps, categories, identityFields, ruleItems, initialPolicy }: Props) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const isEdit = Boolean(initialPolicy?.id)

  const derived = initialPolicy?.rules?.length
    ? deriveFromRules(initialPolicy.rules, ruleItems)
    : {
        selectedDataKeys:   new Set<string>(),
        selectedActivities: new Set<Activity>(['post_prompt', 'upload', 'download', 'response']),
        primaryAction:      'not-set' as ActionCode,
      }

  // Source
  const [identityContext, setIdentityContext] = useState<Set<string>>(new Set(initialPolicy?.identity_context ?? []))

  // Destination — specific apps only
  const [selectedAppIds, setSelectedAppIds] = useState<Set<string>>(new Set(initialPolicy?.scope_app_ids ?? []))

  // Data Profile
  const [selectedDataKeys, setSelectedDataKeys]     = useState<Set<string>>(derived.selectedDataKeys)
  const [selectedActivities, setSelectedActivities] = useState<Set<Activity>>(derived.selectedActivities)

  // Action
  const [primaryAction, setPrimaryAction] = useState<ActionCode>(derived.primaryAction)

  // Details
  const [name, setName]                     = useState(initialPolicy?.name ?? '')
  const [description, setDescription]       = useState(initialPolicy?.description ?? '')
  const [approvalStatus, setApprovalStatus] = useState<ApprovalStatus>(initialPolicy?.approval_status ?? 'draft')

  // Status
  const [isActive, setIsActive] = useState(initialPolicy?.is_active ?? true)

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
      const result = await upsertPolicy(initialPolicy?.id ?? null, {
        name:             name.trim(),
        description:      description || undefined,
        policy_type:      'usage',
        approval_status:  approvalStatus,
        is_active:        isActive,
        scope_all_apps:   selectedAppIds.size === 0,
        scope_app_ids:    Array.from(selectedAppIds),
        rules:            saveRules,
        identity_context: identityContext.size > 0 ? [...identityContext] : null,
      })
      if (result.error) { setError(result.error); return }
      router.push('/genai-controls/policies')
    })
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card/50 shadow-sm overflow-hidden">
        <PolicySection icon={<Users2 />} label="Source">
          <SourceSection
            identityContext={identityContext}
            setIdentityContext={setIdentityContext}
            identityFields={identityFields}
          />
        </PolicySection>

        <PolicySection icon={<Target />} label="Destination">
          <DestinationSection
            selectedAppIds={selectedAppIds} setSelectedAppIds={setSelectedAppIds}
            apps={apps}
          />
        </PolicySection>

        <PolicySection icon={<ShieldCheck />} label="Data Profile">
          <DataProfileSection
            selectedDataKeys={selectedDataKeys} setSelectedDataKeys={setSelectedDataKeys}
            selectedActivities={selectedActivities} setSelectedActivities={setSelectedActivities}
            ruleItems={ruleItems}
          />
        </PolicySection>

        <PolicySection icon={<Zap />} label="Action">
          <ActionSection primaryAction={primaryAction} setPrimaryAction={setPrimaryAction} />
        </PolicySection>

        <PolicySection icon={<FileText />} label="Details">
          <PolicyDetailsSection
            name={name} setName={setName}
            description={description} setDescription={setDescription}
            approvalStatus={approvalStatus} setApprovalStatus={setApprovalStatus}
          />
        </PolicySection>

        <PolicySection icon={<ToggleLeft />} label="Status" noBorder>
          <StatusSection isActive={isActive} setIsActive={setIsActive} />
        </PolicySection>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="flex items-center justify-end gap-3 pb-8">
        <Link
          href="/genai-controls/policies"
          className="px-4 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancel
        </Link>
        <button
          onClick={handleSave}
          disabled={isPending}
          className="flex items-center gap-1.5 px-5 py-2 text-xs font-semibold rounded-md bg-foreground text-background hover:bg-foreground/90 transition-colors disabled:opacity-50"
        >
          {isPending && <Loader2 className="w-3 h-3 animate-spin" />}
          {isEdit ? 'Save Changes' : 'Create Policy'}
        </button>
      </div>
    </div>
  )
}
