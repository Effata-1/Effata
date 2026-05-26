'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ChevronDown, Loader2, Search, Users2, Target, ShieldCheck, Zap, FileText, ToggleLeft, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { colorClasses } from '@/lib/data-catalog/types'
import { upsertPolicy } from '../../actions'
import type { PolicyRule, ActionCode } from '@/lib/genai/types'

// ── Exported types (used by page.tsx) ─────────────────────────────────────────

export type RuleItemKind = 'label' | 'type' | 'catalog'

export interface RuleItem {
  key:        string
  name:       string
  kind:       RuleItemKind
  color:      string
  layer:      1 | 2 | 3
  layerLabel: string | undefined
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

interface Classification {
  app_id:                  string
  customer_classification: string
}

interface Props {
  apps:            App[]
  categories:      Category[]
  classifications: Classification[]
  identityFields:  Record<string, IdentityOption[]>
  ruleItems:       RuleItem[]
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
  'not-set':    '— No action (inherit from Control Matrix)',
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

type ScopeMode = 'category' | 'specific'

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
      {/* Left label */}
      <div className="w-36 shrink-0 flex items-start gap-2 px-5 py-5 text-muted-foreground/60">
        <span className="mt-0.5 shrink-0 [&>svg]:w-3.5 [&>svg]:h-3.5">{icon}</span>
        <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
      </div>
      {/* Right content */}
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
      {/* Row chip showing current state */}
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

      {/* Expanded accordion */}
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
  scopeMode, setScopeMode, scopeCategoryId, setScopeCategoryId,
  selectedAppIds, setSelectedAppIds, categories, apps, classifications,
}: {
  scopeMode: ScopeMode | null
  setScopeMode: (v: ScopeMode) => void
  scopeCategoryId: string | null
  setScopeCategoryId: (v: string | null) => void
  selectedAppIds: Set<string>
  setSelectedAppIds: (v: Set<string>) => void
  categories: Category[]
  apps: App[]
  classifications: Classification[]
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  function appCountForCategory(cat: Category): number {
    if (!cat.system_tag) return 0
    return classifications.filter(c => c.customer_classification === cat.system_tag).length
  }

  function toggleApp(appId: string) {
    const next = new Set(selectedAppIds)
    if (next.has(appId)) next.delete(appId)
    else next.add(appId)
    setSelectedAppIds(next)
  }

  const selectedCategory = categories.find(c => c.id === scopeCategoryId)
  const filteredApps = apps.filter(a =>
    a.app_name.toLowerCase().includes(search.toLowerCase()) ||
    a.vendor?.toLowerCase().includes(search.toLowerCase())
  )

  function scopeLabel(): string {
    if (scopeMode === 'category' && selectedCategory) return selectedCategory.name
    if (scopeMode === 'specific' && selectedAppIds.size > 0) return `${selectedAppIds.size} app${selectedAppIds.size !== 1 ? 's' : ''} selected`
    return 'All apps — click to scope'
  }

  return (
    <div className="space-y-2">
      {/* Summary row */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg border border-border/60 text-left hover:border-border transition-colors"
      >
        <span className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wide shrink-0 w-10">Apps</span>
        <span className="text-xs text-muted-foreground/40 mr-1">=</span>
        {scopeMode ? (
          <span className={cn('flex items-center gap-1.5 px-2.5 py-0.5 rounded border text-xs font-medium',
            selectedCategory ? colorClasses(selectedCategory.color).bg + ' ' + colorClasses(selectedCategory.color).text + ' ' + colorClasses(selectedCategory.color).border
                             : 'bg-foreground/10 border-foreground/20 text-foreground/80'
          )}>
            {scopeMode === 'category' && selectedCategory && (
              <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', colorClasses(selectedCategory.color).dot)} />
            )}
            {scopeLabel()}
          </span>
        ) : (
          <span className="flex-1 text-xs text-muted-foreground/40 italic">{scopeLabel()}</span>
        )}
        <ChevronDown className={cn('w-3.5 h-3.5 text-muted-foreground/30 shrink-0 ml-auto transition-transform', open && 'rotate-180')} />
      </button>

      {/* Expanded picker */}
      {open && (
        <div className="rounded-lg border border-border/50 bg-card/30 p-4 space-y-3">
          <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wide font-semibold">Select by governance category or specific apps</p>
          <div className="grid grid-cols-2 gap-2">
            {categories.map(cat => {
              const cc = colorClasses(cat.color)
              const isSelected = scopeMode === 'category' && scopeCategoryId === cat.id
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => { setScopeMode('category'); setScopeCategoryId(cat.id) }}
                  className={cn(
                    'flex items-center gap-2.5 px-3.5 py-3 rounded-lg border text-left transition-all',
                    isSelected ? 'bg-foreground/10 border-foreground/30' : 'border-border hover:border-border-strong',
                  )}
                >
                  <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', cc.dot)} />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground/85 truncate">{cat.name}</p>
                    <p className="text-[10px] text-muted-foreground/50">{appCountForCategory(cat)} apps</p>
                  </div>
                  {isSelected && <Check className="w-3 h-3 text-foreground/60 ml-auto shrink-0" />}
                </button>
              )
            })}

            {/* Specific apps */}
            <button
              type="button"
              onClick={() => { setScopeMode('specific'); setScopeCategoryId(null) }}
              className={cn(
                'flex items-center gap-2.5 px-3.5 py-3 rounded-lg border text-left transition-all',
                scopeMode === 'specific' ? 'bg-foreground/10 border-foreground/30' : 'border-border hover:border-border-strong',
              )}
            >
              <span className="w-2.5 h-2.5 rounded-full bg-muted-foreground/40 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground/85">Specific Apps</p>
                <p className="text-[10px] text-muted-foreground/50">
                  {selectedAppIds.size > 0 ? `${selectedAppIds.size} selected` : 'Pick from catalog'}
                </p>
              </div>
              {scopeMode === 'specific' && <Check className="w-3 h-3 text-foreground/60 ml-auto shrink-0" />}
            </button>
          </div>

          {scopeMode === 'specific' && (
            <div className="space-y-2 pt-1">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground/30" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search apps…"
                  className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground/30 border border-border/50 rounded-md pl-7 pr-3 py-1.5 focus:outline-none focus:border-border transition-colors"
                />
              </div>
              <div className="grid grid-cols-3 gap-1.5 max-h-48 overflow-y-auto pr-0.5">
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
      {/* Data types row */}
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

      {/* Expanded data type picker */}
      {open && (
        <div className="rounded-lg border border-border/50 bg-card/30 overflow-hidden">
          {/* Layer tabs */}
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

          {/* Chips for active layer */}
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

      {/* Activities row — always visible */}
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
}: {
  name: string; setName: (v: string) => void
  description: string; setDescription: (v: string) => void
}) {
  const inputCls = 'w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/30 border border-border/60 rounded-lg px-3.5 py-2.5 focus:border-border focus:outline-none transition-colors'

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

export function PolicyBuilder({ apps, categories, classifications, identityFields, ruleItems }: Props) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Source
  const [identityContext, setIdentityContext] = useState<Set<string>>(new Set())

  // Destination
  const [scopeMode, setScopeMode]             = useState<ScopeMode | null>(null)
  const [scopeCategoryId, setScopeCategoryId] = useState<string | null>(null)
  const [selectedAppIds, setSelectedAppIds]   = useState<Set<string>>(new Set())

  // Data Profile
  const [selectedDataKeys, setSelectedDataKeys]     = useState<Set<string>>(new Set())
  const [selectedActivities, setSelectedActivities] = useState<Set<Activity>>(
    new Set<Activity>(['post_prompt', 'upload', 'download', 'response']),
  )

  // Action
  const [primaryAction, setPrimaryAction] = useState<ActionCode>('not-set')

  // Details
  const [name, setName]               = useState('')
  const [description, setDescription] = useState('')

  // Status
  const [isActive, setIsActive] = useState(true)

  function handleSave(submitForReview: boolean) {
    if (!name.trim()) { setError('Policy name is required.'); return }
    setError(null)

    // Expand category scope to app IDs
    let saveAppIds: string[] = []
    if (scopeMode === 'category' && scopeCategoryId) {
      const cat = categories.find(c => c.id === scopeCategoryId)
      if (cat?.system_tag) {
        saveAppIds = classifications
          .filter(c => c.customer_classification === cat.system_tag)
          .map(c => c.app_id)
      }
    } else if (scopeMode === 'specific') {
      saveAppIds = Array.from(selectedAppIds)
    }

    // Build rules: selected data types × selected activities → primary action
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
      const result = await upsertPolicy(null, {
        name:             name.trim(),
        description:      description || undefined,
        policy_type:      'usage',
        approval_status:  submitForReview ? 'under-review' : 'draft',
        is_active:        isActive,
        scope_all_apps:   false,
        scope_app_ids:    saveAppIds,
        rules:            saveRules,
        identity_context: identityContext.size > 0 ? [...identityContext] : null,
      })
      if (result.error) { setError(result.error); return }
      router.push('/genai-controls/policies')
    })
  }

  return (
    <div className="space-y-6">
      {/* Policy form */}
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
            scopeMode={scopeMode} setScopeMode={setScopeMode}
            scopeCategoryId={scopeCategoryId} setScopeCategoryId={setScopeCategoryId}
            selectedAppIds={selectedAppIds} setSelectedAppIds={setSelectedAppIds}
            categories={categories} apps={apps} classifications={classifications}
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
          />
        </PolicySection>

        <PolicySection icon={<ToggleLeft />} label="Status" noBorder>
          <StatusSection isActive={isActive} setIsActive={setIsActive} />
        </PolicySection>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      {/* Save buttons */}
      <div className="flex items-center justify-end gap-3">
        <button
          onClick={() => handleSave(false)}
          disabled={isPending}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-md border border-border hover:bg-card/80 transition-colors disabled:opacity-50"
        >
          {isPending && <Loader2 className="w-3 h-3 animate-spin" />}
          Save as Draft
        </button>
        <button
          onClick={() => handleSave(true)}
          disabled={isPending}
          className="flex items-center gap-1.5 px-5 py-2 text-xs font-semibold rounded-md bg-foreground text-background hover:bg-foreground/90 transition-colors disabled:opacity-50"
        >
          {isPending && <Loader2 className="w-3 h-3 animate-spin" />}
          Submit for Review →
        </button>
      </div>
    </div>
  )
}
