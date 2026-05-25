'use client'

import { useState, useTransition } from 'react'
import { cn } from '@/lib/utils'
import { colorClasses, COLOR_OPTIONS } from '@/lib/data-catalog/types'
import type { OrgClassificationLabel, SystemLevel } from '@/lib/data-catalog/types'
import { RotateCcw, Pencil, Plus, Check, X } from 'lucide-react'
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
  { id: 'pp',    label: 'Post / Prompt',                       color: 'text-orange-400' },
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
  data_type:   string
  category_id: string
  action_code: string
}

interface Props {
  categories: MatrixCategory[]
  overrides:  MatrixOverride[]
  labels:     OrgClassificationLabel[]
}

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

export function ControlMatrixClient({ categories, overrides, labels }: Props) {
  // Sort labels by priority (lowest number = highest sensitivity = shown first in table)
  const [localLabels, setLocalLabels] = useState<OrgClassificationLabel[]>(
    [...labels].sort((a, b) => a.priority - b.priority),
  )
  const [localOverrides, setLocalOverrides] = useState<Record<string, ActionCode>>(() => {
    const map: Record<string, ActionCode> = {}
    for (const o of overrides) map[`${o.data_type}::${o.category_id}`] = o.action_code as ActionCode
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
    | { type: 'section'; sectionId: string; label: string; color: string }
    | { type: 'row'; rowKey: string; label: OrgClassificationLabel; sectionId: string; ri: number }

  const flatItems: FlatItem[] = []
  let rowIndex = 0

  // Post/Prompt — all labels
  flatItems.push({ type: 'section', sectionId: 'pp', label: 'Post / Prompt', color: 'text-orange-400' })
  localLabels.forEach(lbl => {
    flatItems.push({ type: 'row', rowKey: `pp|${lbl.id}`, label: lbl, sectionId: 'pp', ri: rowIndex++ })
  })

  // Upload — Data Classification Labels — all labels
  flatItems.push({ type: 'section', sectionId: 'ul_dc', label: 'Upload — Data Classification Labels', color: 'text-orange-400' })
  localLabels.forEach(lbl => {
    flatItems.push({ type: 'row', rowKey: `ul|dc|${lbl.id}`, label: lbl, sectionId: 'ul_dc', ri: rowIndex++ })
  })

  // Upload — Filename Detection — only high-risk labels
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
    if (sectionId === 'ul_dc') return UL_DC_DEFAULTS[catTag]?.[level] ?? null
    if (sectionId === 'ul_fn') return UL_FN_DEFAULTS[catTag]?.[level] ?? null
    return null
  }

  function getCell(rowKey: string, sectionId: string, lbl: OrgClassificationLabel, cat: MatrixCategory) {
    const override     = localOverrides[`${rowKey}::${cat.id}`] ?? null
    const defaultAction = getDefault(sectionId, lbl, cat.system_tag)
    return {
      effectiveAction: (override ?? defaultAction ?? 'not-set') as ActionCode,
      defaultAction,
      isOverride: !!override,
    }
  }

  function handleChange(rowKey: string, cat: MatrixCategory, action: ActionCode) {
    setLocalOverrides(prev => ({ ...prev, [`${rowKey}::${cat.id}`]: action }))
    startTransition(async () => { await upsertControlMatrixCell(rowKey, cat.id, action) })
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
                      const { effectiveAction, defaultAction, isOverride } = getCell(rowKey, sectionId, lbl, cat)
                      const meta = ACTIONS[effectiveAction]
                      return (
                        <td key={cat.id} className="px-3 py-2.5 align-middle">
                          <div className="space-y-0.5">
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
