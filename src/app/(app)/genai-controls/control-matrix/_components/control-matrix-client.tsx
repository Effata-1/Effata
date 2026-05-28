'use client'

import { useState, useTransition } from 'react'
import { cn } from '@/lib/utils'
import { colorClasses, COLOR_OPTIONS } from '@/lib/data-catalog/types'
import type { OrgClassificationLabel, SystemLevel } from '@/lib/data-catalog/types'
import { RotateCcw, Pencil, Plus, Check, X, Lock, ArrowRight } from 'lucide-react'
import { upsertControlMatrixCell, deleteControlMatrixCell, upsertMatrixLabel, deleteMatrixLabel } from '../actions'

// ── Action registry ───────────────────────────────────────────────────────────

export type ActionCode =
  | 'allow' | 'monitor' | 'alert' | 'coach'
  | 'coach-ack' | 'coach-just' | 'block' | 'not-set'

export const ACTIONS: Record<ActionCode, { label: string; cell: string; text: string }> = {
  'allow':      { label: 'Allow',                 cell: 'bg-emerald-500/10 border-emerald-500/20', text: 'text-emerald-400' },
  'monitor':    { label: 'Monitor',               cell: 'bg-blue-500/10 border-blue-500/20',       text: 'text-blue-400' },
  'alert':      { label: 'Alert',                 cell: 'bg-amber-500/10 border-amber-500/20',     text: 'text-amber-400' },
  'coach':      { label: 'Coach',                 cell: 'bg-orange-500/10 border-orange-500/20',   text: 'text-orange-400' },
  'coach-ack':  { label: 'Coach + Acknowledge',   cell: 'bg-orange-500/15 border-orange-500/30',   text: 'text-orange-300' },
  'coach-just': { label: 'Coach + Justification', cell: 'bg-amber-600/15 border-amber-600/25',     text: 'text-amber-300' },
  'block':      { label: 'Block',                 cell: 'bg-red-500/10 border-red-500/20',         text: 'text-red-400' },
  'not-set':    { label: '—',                     cell: 'bg-transparent border-border',            text: 'text-muted-foreground/30' },
}

// ── Default actions by system_level per governance category ───────────────────

type LevelMap = Partial<Record<SystemLevel, ActionCode>>

const PP_DEFAULTS: Record<string, LevelMap> = {
  'enterprise-approved':        { public: 'allow',   internal: 'monitor', confidential: 'alert',     highly_confidential: 'coach-ack', secret: 'block' },
  'approved-with-conditions':   { public: 'allow',   internal: 'monitor', confidential: 'coach',     highly_confidential: 'block',     secret: 'block' },
  'permitted-with-restriction': { public: 'monitor', internal: 'coach',   confidential: 'block',     highly_confidential: 'block',     secret: 'block' },
  'prohibited':                 { public: 'block',   internal: 'block',   confidential: 'block',     highly_confidential: 'block',     secret: 'block' },
}

const UL_DC_DEFAULTS: Record<string, LevelMap> = {
  'enterprise-approved':        { public: 'allow',   internal: 'monitor', confidential: 'alert',     highly_confidential: 'coach-ack', secret: 'block' },
  'approved-with-conditions':   { public: 'allow',   internal: 'monitor', confidential: 'coach',     highly_confidential: 'block',     secret: 'block' },
  'permitted-with-restriction': { public: 'monitor', internal: 'coach',   confidential: 'block',     highly_confidential: 'block',     secret: 'block' },
  'prohibited':                 { public: 'block',   internal: 'block',   confidential: 'block',     highly_confidential: 'block',     secret: 'block' },
}

const UL_FN_DEFAULTS: Record<string, LevelMap> = {
  'enterprise-approved':        { highly_confidential: 'alert',     secret: 'block' },
  'approved-with-conditions':   { highly_confidential: 'coach-ack', secret: 'block' },
  'permitted-with-restriction': { highly_confidential: 'block',     secret: 'block' },
  'prohibited':                 { highly_confidential: 'block',     secret: 'block' },
}

// Filename detection only applies to high-risk levels
const FILENAME_LEVELS: SystemLevel[] = ['highly_confidential', 'secret']

// ── Sections ──────────────────────────────────────────────────────────────────

const SECTIONS = [
  { id: 'pp',    label: 'Prompt / Upload',                     color: 'text-orange-400' },
  { id: 'ul_dc', label: 'Upload — Data Classification Labels', color: 'text-orange-400' },
  { id: 'ul_fn', label: 'Upload — Filename Detection',         color: 'text-muted-foreground/60' },
] as const

// ── System tag order ──────────────────────────────────────────────────────────

export const SYSTEM_TAG_ORDER = [
  'enterprise-approved',
  'approved-with-conditions',
  'permitted-with-restriction',
  'prohibited',
] as const

// ── Props ─────────────────────────────────────────────────────────────────────

export interface MatrixCategory {
  id:         string
  system_tag: string | null
  name:       string
  color:      string
}

export interface MatrixOverride {
  data_type:                string
  category_id:              string
  action_code:              string
  coaching_notification_id: string | null
}

interface CoachingOption {
  id:          string
  name:        string
  coach_label: string | null
}

export interface CustomerLabel {
  id:           string
  display_name: string
  color:        string
  system_level: string | null
  priority:     number
}

interface Props {
  categories:     MatrixCategory[]
  overrides:      MatrixOverride[]
  labels:         OrgClassificationLabel[]
  customerLabels: CustomerLabel[]
  notifications:  CoachingOption[]
}

type CellOverride = { action: ActionCode; coachingId: string | null }

// ── Inline label editor row ───────────────────────────────────────────────────

function LabelRow({ label, onSave, onDelete }: {
  label: OrgClassificationLabel
  onSave:   (id: string, name: string, color: string) => void
  onDelete: (id: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [name,    setName]    = useState(label.name)
  const [color,   setColor]   = useState(label.color)
  const cc = colorClasses(label.color)

  function submit() {
    if (name.trim()) {
      onSave(label.id, name.trim(), color)
      setEditing(false)
    }
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-card border border-border">
        <input
          autoFocus
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') setEditing(false) }}
          className="flex-1 bg-transparent text-xs text-foreground focus:outline-none border-b border-border pb-0.5"
        />
        {/* Color picker */}
        <div className="flex gap-1">
          {COLOR_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setColor(opt.value)}
              className={cn('w-3.5 h-3.5 rounded-full transition-transform', opt.class, color === opt.value ? 'ring-2 ring-offset-1 ring-offset-card ring-white/40 scale-125' : 'opacity-60 hover:opacity-100')}
              title={opt.label}
            />
          ))}
        </div>
        <button onClick={submit} className="text-emerald-400 hover:text-emerald-300"><Check className="w-3.5 h-3.5" /></button>
        <button onClick={() => { setName(label.name); setColor(label.color); setEditing(false) }} className="text-muted-foreground/50 hover:text-muted-foreground/80"><X className="w-3.5 h-3.5" /></button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-card/50 border border-border/60 group">
      <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', cc.dot)} />
      <span className={cn('text-xs font-semibold flex-1', cc.text)}>{label.name}</span>
      {label.system_level && (
        <span className="text-[9px] text-muted-foreground/40 font-mono">{label.system_level.replace('_', ' ')}</span>
      )}
      <button
        onClick={() => setEditing(true)}
        className="opacity-0 group-hover:opacity-100 text-muted-foreground/40 hover:text-muted-foreground/80 transition-all"
      >
        <Pencil className="w-3 h-3" />
      </button>
      {!label.is_system && (
        <button
          onClick={() => onDelete(label.id)}
          className="opacity-0 group-hover:opacity-100 text-muted-foreground/30 hover:text-red-400 transition-all"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  )
}

// ── Main client component ─────────────────────────────────────────────────────

export function ControlMatrixClient({ categories, overrides, labels, customerLabels, notifications }: Props) {
  const [localLabels, setLocalLabels] = useState<OrgClassificationLabel[]>(
    [...labels].sort((a, b) => a.priority - b.priority),
  )
  const [localOverrides, setLocalOverrides] = useState<Record<string, CellOverride>>(() => {
    const map: Record<string, CellOverride> = {}
    for (const o of overrides) {
      map[`${o.data_type}::${o.category_id}`] = {
        action:     o.action_code as ActionCode,
        coachingId: o.coaching_notification_id ?? null,
      }
    }
    return map
  })
  const [showLabelEditor, setShowLabelEditor] = useState(false)
  const [addingLabel,     setAddingLabel]     = useState(false)
  const [newLabelName,    setNewLabelName]     = useState('')
  const [newLabelColor,   setNewLabelColor]    = useState('blue')
  const [, startTransition] = useTransition()

  const orderedCats: MatrixCategory[] = [
    ...(SYSTEM_TAG_ORDER.map(tag => categories.find(c => c.system_tag === tag)).filter(Boolean) as MatrixCategory[]),
    ...categories.filter(c => !c.system_tag),
  ]

  // Build flat list of table rows (section headers + data rows)
  type FlatItem =
    | { type: 'section'; sectionId: string; label: string; color: string; disabled?: boolean }
    | { type: 'row'; rowKey: string; label: OrgClassificationLabel; sectionId: string; ri: number }
    | { type: 'clabel-row'; rowKey: string; clabel: CustomerLabel; sectionId: string; ri: number }
    | { type: 'clabel-empty'; sectionId: string }

  const flatItems: FlatItem[] = []
  let rowIndex = 0

  // Prompt/Upload — Effata system labels (content detection)
  flatItems.push({ type: 'section', sectionId: 'pp', label: 'Prompt / Upload (Content Detection)', color: 'text-orange-400' })
  localLabels.forEach(lbl => {
    flatItems.push({ type: 'row', rowKey: `pp|${lbl.id}`, label: lbl, sectionId: 'pp', ri: rowIndex++ })
  })

  // Upload — Data Classification Labels — customer labels only (metadata/label detection)
  const hasCustomerLabels = customerLabels.length > 0
  flatItems.push({
    type: 'section', sectionId: 'ul_dc',
    label: 'Upload — Data Classification Labels (Label Detection)',
    color: hasCustomerLabels ? 'text-orange-400' : 'text-muted-foreground/40',
    disabled: !hasCustomerLabels,
  })
  if (hasCustomerLabels) {
    customerLabels.forEach(clbl => {
      flatItems.push({ type: 'clabel-row', rowKey: `ul|dc|clabel:${clbl.id}`, clabel: clbl, sectionId: 'ul_dc', ri: rowIndex++ })
    })
  } else {
    flatItems.push({ type: 'clabel-empty', sectionId: 'ul_dc' })
  }

  // Upload — Filename Detection — only high-risk Effata labels
  const filenameLabels = localLabels.filter(lbl => lbl.system_level && FILENAME_LEVELS.includes(lbl.system_level as SystemLevel))
  if (filenameLabels.length > 0) {
    flatItems.push({ type: 'section', sectionId: 'ul_fn', label: 'Upload — Filename Detection', color: 'text-muted-foreground/60' })
    filenameLabels.forEach(lbl => {
      flatItems.push({ type: 'row', rowKey: `ul|fn|${lbl.id}`, label: lbl, sectionId: 'ul_fn', ri: rowIndex++ })
    })
  }

  function getDefault(sectionId: string, lbl: OrgClassificationLabel, catTag: string | null): ActionCode | null {
    if (!catTag || !lbl.system_level) return null
    const level = lbl.system_level as SystemLevel
    if (sectionId === 'pp')    return PP_DEFAULTS[catTag]?.[level]    ?? null
    if (sectionId === 'ul_fn') return UL_FN_DEFAULTS[catTag]?.[level] ?? null
    return null
  }

  function getCustomerLabelDefault(clbl: CustomerLabel, catTag: string | null): ActionCode | null {
    if (!catTag || !clbl.system_level) return null
    return UL_DC_DEFAULTS[catTag]?.[clbl.system_level as SystemLevel] ?? null
  }

  function getCell(rowKey: string, sectionId: string, lbl: OrgClassificationLabel, cat: MatrixCategory) {
    const override      = localOverrides[`${rowKey}::${cat.id}`] ?? null
    const defaultAction = getDefault(sectionId, lbl, cat.system_tag)
    return {
      effectiveAction:    (override?.action ?? defaultAction ?? 'not-set') as ActionCode,
      effectiveCoaching:  override?.coachingId ?? null,
      defaultAction,
      isOverride:         !!override,
    }
  }

  function handleChange(rowKey: string, cat: MatrixCategory, action: ActionCode) {
    const coachingId = localOverrides[`${rowKey}::${cat.id}`]?.coachingId ?? null
    setLocalOverrides(prev => ({ ...prev, [`${rowKey}::${cat.id}`]: { action, coachingId } }))
    startTransition(async () => { await upsertControlMatrixCell(rowKey, cat.id, action, coachingId) })
  }

  function handleCoachingChange(rowKey: string, cat: MatrixCategory, coachingId: string | null, effectiveAction: ActionCode) {
    setLocalOverrides(prev => ({ ...prev, [`${rowKey}::${cat.id}`]: { action: effectiveAction, coachingId } }))
    startTransition(async () => { await upsertControlMatrixCell(rowKey, cat.id, effectiveAction, coachingId) })
  }

  function handleReset(rowKey: string, cat: MatrixCategory) {
    setLocalOverrides(prev => { const n = { ...prev }; delete n[`${rowKey}::${cat.id}`]; return n })
    startTransition(async () => { await deleteControlMatrixCell(rowKey, cat.id) })
  }

  function handleLabelSave(id: string, name: string, color: string) {
    setLocalLabels(prev => prev.map(l => l.id === id ? { ...l, name, color } : l))
    startTransition(async () => {
      const lbl = localLabels.find(l => l.id === id)!
      await upsertMatrixLabel(id, { name, color, description: lbl.description ?? '', priority: lbl.priority })
    })
  }

  function handleLabelDelete(id: string) {
    setLocalLabels(prev => prev.filter(l => l.id !== id))
    startTransition(async () => { await deleteMatrixLabel(id) })
  }

  function handleAddLabel() {
    if (!newLabelName.trim()) return
    const priority = localLabels.length + 1
    startTransition(async () => {
      await upsertMatrixLabel(null, { name: newLabelName.trim(), color: newLabelColor, description: '', priority })
    })
    setNewLabelName('')
    setNewLabelColor('blue')
    setAddingLabel(false)
  }

  return (
    <div className="space-y-3">

      {/* ── Label manager strip ─────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card/30">
        <button
          onClick={() => setShowLabelEditor(v => !v)}
          className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-card/40 transition-colors rounded-xl"
        >
          <span className="text-xs font-semibold text-muted-foreground/70">Data Classification Labels</span>
          <div className="flex gap-1.5 flex-1">
            {localLabels.map(lbl => {
              const cc = colorClasses(lbl.color)
              return (
                <span key={lbl.id} className={cn('text-[10px] font-semibold px-2 py-0.5 rounded border', cc.bg, cc.text, cc.border)}>
                  {lbl.name}
                </span>
              )
            })}
          </div>
          <span className="text-[10px] text-muted-foreground/40">{showLabelEditor ? 'Hide' : 'Edit labels'}</span>
        </button>

        {showLabelEditor && (
          <div className="px-4 pb-4 space-y-2 border-t border-border/50 pt-3">
            <p className="text-[10px] text-muted-foreground/50 mb-2">
              These labels drive the matrix rows. Changes here also update Policies → Classifications.
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {localLabels.map(lbl => (
                <LabelRow
                  key={lbl.id}
                  label={lbl}
                  onSave={handleLabelSave}
                  onDelete={handleLabelDelete}
                />
              ))}
            </div>

            {/* Add new label */}
            {addingLabel ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-card border border-border mt-2">
                <input
                  autoFocus
                  value={newLabelName}
                  onChange={e => setNewLabelName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddLabel(); if (e.key === 'Escape') setAddingLabel(false) }}
                  placeholder="Label name…"
                  className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none"
                />
                <div className="flex gap-1">
                  {COLOR_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setNewLabelColor(opt.value)}
                      className={cn('w-3.5 h-3.5 rounded-full transition-transform', opt.class, newLabelColor === opt.value ? 'ring-2 ring-offset-1 ring-offset-card ring-white/40 scale-125' : 'opacity-60 hover:opacity-100')}
                      title={opt.label}
                    />
                  ))}
                </div>
                <button onClick={handleAddLabel} className="text-emerald-400 hover:text-emerald-300"><Check className="w-3.5 h-3.5" /></button>
                <button onClick={() => setAddingLabel(false)} className="text-muted-foreground/40 hover:text-muted-foreground/70"><X className="w-3.5 h-3.5" /></button>
              </div>
            ) : (
              <button
                onClick={() => setAddingLabel(true)}
                className="flex items-center gap-1.5 text-[11px] text-muted-foreground/50 hover:text-muted-foreground/80 transition-colors mt-1"
              >
                <Plus className="w-3 h-3" />Add custom label
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Coaching templates strip ──────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-border/40 bg-card/30 text-xs text-muted-foreground/60">
        <span className="font-medium text-muted-foreground/80">Coaching messages:</span>
        {notifications.length === 0 ? (
          <span className="text-muted-foreground/40 italic">None defined yet</span>
        ) : (
          <div className="flex gap-1.5 flex-wrap">
            {notifications.map(n => (
              <span key={n.id} className="px-2 py-0.5 rounded border border-border/50 bg-muted/20 text-[10px] font-medium text-muted-foreground/70">
                {n.coach_label ? `${n.coach_label} — ${n.name}` : n.name}
              </span>
            ))}
          </div>
        )}
        <a
          href="/genai-controls/notifications"
          className="ml-auto shrink-0 text-[11px] text-primary hover:underline"
        >
          Manage →
        </a>
      </div>

      {/* ── Matrix table ────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-card/80">
                <th className="text-left text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wide px-5 py-3 w-52">
                  Activity / Label
                </th>
                {orderedCats.map(cat => {
                  const cc = colorClasses(cat.color)
                  return (
                    <th key={cat.id} className="px-3 py-3 text-left min-w-[148px]">
                      <p className={cn('text-xs font-bold', cc.text)}>{cat.name}</p>
                      {!cat.system_tag && <p className="text-[9px] text-muted-foreground/40 font-normal mt-0.5">custom</p>}
                    </th>
                  )
                })}
              </tr>
            </thead>

            <tbody>
              {flatItems.map(item => {
                if (item.type === 'section') {
                  return (
                    <tr key={`sec-${item.sectionId}`} className="bg-muted/25 border-y border-border/50">
                      <td colSpan={orderedCats.length + 1} className="px-5 py-1.5">
                        <span className={cn('text-[10px] font-bold uppercase tracking-widest', item.color)}>
                          {item.label}
                        </span>
                      </td>
                    </tr>
                  )
                }

                // Customer label — disabled / no labels state
                if (item.type === 'clabel-empty') {
                  return (
                    <tr key="clabel-empty">
                      <td colSpan={orderedCats.length + 1} className="px-5 py-5">
                        <div className="flex items-center gap-3 text-muted-foreground/40">
                          <Lock className="w-4 h-4 shrink-0" />
                          <div>
                            <p className="text-xs font-medium">Label detection disabled — no sensitivity labels configured</p>
                            <p className="text-[11px] mt-0.5">
                              Add your MIP or custom sensitivity labels to enable this control.{' '}
                              <a href="/genai-controls/sensitivity-labels" className="text-primary/60 hover:text-primary transition-colors inline-flex items-center gap-0.5">
                                Manage Sensitivity Labels <ArrowRight className="w-3 h-3" />
                              </a>
                            </p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )
                }

                // Customer label row (label detection)
                if (item.type === 'clabel-row') {
                  const { rowKey, clabel, sectionId, ri } = item
                  const cc = colorClasses(clabel.color)
                  return (
                    <tr
                      key={rowKey}
                      className={cn('border-b border-border/40 hover:bg-card/30 transition-colors', ri % 2 === 0 ? '' : 'bg-card/10')}
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <span className={cn('w-2 h-2 rounded-full shrink-0', cc.dot)} />
                          <span className={cn('text-xs font-semibold', cc.text)}>{clabel.display_name}</span>
                        </div>
                      </td>
                      {orderedCats.map(cat => {
                        const override      = localOverrides[`${rowKey}::${cat.id}`] ?? null
                        const defaultAction = getCustomerLabelDefault(clabel, cat.system_tag)
                        const effectiveAction = (override?.action ?? defaultAction ?? 'not-set') as ActionCode
                        const effectiveCoaching = override?.coachingId ?? null
                        const isOverride = !!override
                        const meta          = ACTIONS[effectiveAction]
                        const selectedNotif = notifications.find(n => n.id === effectiveCoaching)
                        return (
                          <td key={cat.id} className="px-3 py-2.5 align-top">
                            <div className="space-y-1">
                              <div className={cn('relative rounded-md border px-2 py-1', meta.cell)}>
                                <select
                                  value={effectiveAction}
                                  onChange={e => handleChange(rowKey, cat, e.target.value as ActionCode)}
                                  className={cn('w-full appearance-none bg-transparent text-[11px] font-semibold focus:outline-none cursor-pointer', meta.text)}
                                >
                                  {(Object.entries(ACTIONS) as [ActionCode, (typeof ACTIONS)[ActionCode]][])
                                    .filter(([code]) => code !== 'not-set' || effectiveAction === 'not-set')
                                    .map(([code, m]) => (
                                      <option key={code} value={code} className="bg-card text-foreground">{m.label}</option>
                                    ))}
                                </select>
                              </div>
                              <div className="relative rounded border border-border/40 bg-muted/10 px-1.5 py-0.5">
                                <select
                                  value={effectiveCoaching ?? ''}
                                  onChange={e => handleCoachingChange(rowKey, cat, e.target.value || null, effectiveAction)}
                                  className="w-full appearance-none bg-transparent text-[10px] text-muted-foreground/60 focus:outline-none cursor-pointer"
                                >
                                  <option value="" className="bg-card text-foreground">— No coaching —</option>
                                  {notifications.map(n => (
                                    <option key={n.id} value={n.id} className="bg-card text-foreground">
                                      {n.coach_label ? `${n.coach_label} — ${n.name}` : n.name}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              {selectedNotif?.coach_label && (
                                <span className="inline-flex text-[9px] font-semibold px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                                  {selectedNotif.coach_label}
                                </span>
                              )}
                              {isOverride && defaultAction && (
                                <div className="flex items-center gap-1">
                                  <span className="text-[9px] text-muted-foreground/40">Default: {ACTIONS[defaultAction].label}</span>
                                  <button onClick={() => handleReset(rowKey, cat)} title="Reset to default" className="text-muted-foreground/30 hover:text-muted-foreground/70 transition-colors">
                                    <RotateCcw className="w-2.5 h-2.5" />
                                  </button>
                                </div>
                              )}
                              {!isOverride && effectiveAction !== 'not-set' && (
                                <span className="text-[9px] text-muted-foreground/30 italic">recommended</span>
                              )}
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  )
                }

                // Effata system label row
                const { rowKey, label: lbl, sectionId, ri } = item
                const cc = colorClasses(lbl.color)

                return (
                  <tr
                    key={rowKey}
                    className={cn(
                      'border-b border-border/40 hover:bg-card/30 transition-colors',
                      ri % 2 === 0 ? '' : 'bg-card/10',
                    )}
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span className={cn('w-2 h-2 rounded-full shrink-0', cc.dot)} />
                        <span className={cn('text-xs font-semibold', cc.text)}>{lbl.name}</span>
                      </div>
                    </td>

                    {orderedCats.map(cat => {
                      const { effectiveAction, effectiveCoaching, defaultAction, isOverride } = getCell(rowKey, sectionId, lbl, cat)
                      const meta          = ACTIONS[effectiveAction]
                      const selectedNotif = notifications.find(n => n.id === effectiveCoaching)
                      return (
                        <td key={cat.id} className="px-3 py-2.5 align-top">
                          <div className="space-y-1">
                            {/* Action dropdown */}
                            <div className={cn('relative rounded-md border px-2 py-1', meta.cell)}>
                              <select
                                value={effectiveAction}
                                onChange={e => handleChange(rowKey, cat, e.target.value as ActionCode)}
                                className={cn('w-full appearance-none bg-transparent text-[11px] font-semibold focus:outline-none cursor-pointer', meta.text)}
                              >
                                {(Object.entries(ACTIONS) as [ActionCode, (typeof ACTIONS)[ActionCode]][])
                                  .filter(([code]) => code !== 'not-set' || effectiveAction === 'not-set')
                                  .map(([code, m]) => (
                                    <option key={code} value={code} className="bg-card text-foreground">{m.label}</option>
                                  ))}
                              </select>
                            </div>

                            {/* Coaching dropdown */}
                            <div className="relative rounded border border-border/40 bg-muted/10 px-1.5 py-0.5">
                              <select
                                value={effectiveCoaching ?? ''}
                                onChange={e => handleCoachingChange(rowKey, cat, e.target.value || null, effectiveAction)}
                                className="w-full appearance-none bg-transparent text-[10px] text-muted-foreground/60 focus:outline-none cursor-pointer"
                              >
                                <option value="" className="bg-card text-foreground">— No coaching —</option>
                                {notifications.map(n => (
                                  <option key={n.id} value={n.id} className="bg-card text-foreground">
                                    {n.coach_label ? `${n.coach_label} — ${n.name}` : n.name}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Selected coaching badge */}
                            {selectedNotif?.coach_label && (
                              <span className="inline-flex text-[9px] font-semibold px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                                {selectedNotif.coach_label}
                              </span>
                            )}

                            {/* Default / reset row */}
                            {isOverride && defaultAction && (
                              <div className="flex items-center gap-1">
                                <span className="text-[9px] text-muted-foreground/40">Default: {ACTIONS[defaultAction].label}</span>
                                <button onClick={() => handleReset(rowKey, cat)} title="Reset to default" className="text-muted-foreground/30 hover:text-muted-foreground/70 transition-colors">
                                  <RotateCcw className="w-2.5 h-2.5" />
                                </button>
                              </div>
                            )}
                            {!isOverride && effectiveAction !== 'not-set' && (
                              <span className="text-[9px] text-muted-foreground/30 italic">recommended</span>
                            )}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
