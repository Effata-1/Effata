'use client'

import { useState, useTransition } from 'react'
import { cn } from '@/lib/utils'
import { colorClasses } from '@/lib/data-catalog/types'
import type { OrgClassificationLabel, SystemLevel } from '@/lib/data-catalog/types'
import { RotateCcw, Lock, ArrowRight } from 'lucide-react'
import { upsertControlMatrixCell, deleteControlMatrixCell } from '../actions'

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

const FILENAME_LEVELS: SystemLevel[] = ['highly_confidential', 'secret']

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
  notifications:  { id: string; name: string; coach_label: string | null }[]
}

type CellOverride = { action: ActionCode; coachingId: string | null }

// ── Main client component ─────────────────────────────────────────────────────

export function ControlMatrixClient({ categories, overrides, labels, customerLabels }: Props) {
  const [localLabels] = useState<OrgClassificationLabel[]>(
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
  const [, startTransition] = useTransition()

  const orderedCats: MatrixCategory[] = [
    ...(SYSTEM_TAG_ORDER.map(tag => categories.find(c => c.system_tag === tag)).filter(Boolean) as MatrixCategory[]),
    ...categories.filter(c => !c.system_tag),
  ]

  const [selectedCatId, setSelectedCatId] = useState<string>(orderedCats[0]?.id ?? '')
  const selectedCat = orderedCats.find(c => c.id === selectedCatId) ?? orderedCats[0]

  // ── Flat row list ───────────────────────────────────────────────────────────

  type FlatItem =
    | { type: 'section'; sectionId: string; label: string; color: string }
    | { type: 'row'; rowKey: string; label: OrgClassificationLabel; sectionId: string; ri: number }
    | { type: 'clabel-row'; rowKey: string; clabel: CustomerLabel; sectionId: string; ri: number }
    | { type: 'clabel-empty'; sectionId: string }

  const flatItems: FlatItem[] = []
  let rowIndex = 0

  flatItems.push({ type: 'section', sectionId: 'pp', label: 'Prompt / Upload (Content Detection)', color: 'text-orange-400' })
  localLabels.forEach(lbl => {
    flatItems.push({ type: 'row', rowKey: `pp|${lbl.id}`, label: lbl, sectionId: 'pp', ri: rowIndex++ })
  })

  const hasCustomerLabels = customerLabels.length > 0
  flatItems.push({
    type: 'section', sectionId: 'ul_dc',
    label: 'Upload — Data Classification Labels (Label Detection)',
    color: hasCustomerLabels ? 'text-orange-400' : 'text-muted-foreground/40',
  })
  if (hasCustomerLabels) {
    customerLabels.forEach(clbl => {
      flatItems.push({ type: 'clabel-row', rowKey: `ul|dc|clabel:${clbl.id}`, clabel: clbl, sectionId: 'ul_dc', ri: rowIndex++ })
    })
  } else {
    flatItems.push({ type: 'clabel-empty', sectionId: 'ul_dc' })
  }

  const filenameLabels = localLabels.filter(lbl => lbl.system_level && FILENAME_LEVELS.includes(lbl.system_level as SystemLevel))
  if (filenameLabels.length > 0) {
    flatItems.push({ type: 'section', sectionId: 'ul_fn', label: 'Upload — Filename Detection', color: 'text-muted-foreground/60' })
    filenameLabels.forEach(lbl => {
      flatItems.push({ type: 'row', rowKey: `ul|fn|${lbl.id}`, label: lbl, sectionId: 'ul_fn', ri: rowIndex++ })
    })
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

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

  function handleChange(rowKey: string, cat: MatrixCategory, action: ActionCode) {
    const coachingId = localOverrides[`${rowKey}::${cat.id}`]?.coachingId ?? null
    setLocalOverrides(prev => ({ ...prev, [`${rowKey}::${cat.id}`]: { action, coachingId } }))
    startTransition(async () => { await upsertControlMatrixCell(rowKey, cat.id, action, coachingId) })
  }

  function handleReset(rowKey: string, cat: MatrixCategory) {
    setLocalOverrides(prev => { const n = { ...prev }; delete n[`${rowKey}::${cat.id}`]; return n })
    startTransition(async () => { await deleteControlMatrixCell(rowKey, cat.id) })
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">

      {/* ── Category filter tabs ─────────────────────────────────────────────── */}
      <div className="flex gap-2 flex-wrap">
        {orderedCats.map(cat => {
          const cc        = colorClasses(cat.color)
          const isSelected = cat.id === selectedCat?.id
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCatId(cat.id)}
              className={cn(
                'px-3.5 py-1.5 rounded-lg border text-xs font-semibold transition-all',
                isSelected
                  ? cn(cc.bg, cc.text, cc.border, 'shadow-sm')
                  : 'bg-transparent border-border/40 text-muted-foreground/50 hover:border-border hover:text-muted-foreground/80',
              )}
            >
              {cat.name}
            </button>
          )
        })}
      </div>

      {/* ── Matrix table ─────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border overflow-hidden shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-card/80">
              <th className="text-left text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wide px-5 py-3 w-64">
                Activity / Label
              </th>
              <th className="px-5 py-3 text-left">
                {selectedCat && (
                  <div>
                    <p className={cn('text-xs font-bold', colorClasses(selectedCat.color).text)}>{selectedCat.name}</p>
                    {!selectedCat.system_tag && (
                      <p className="text-[9px] text-muted-foreground/40 font-normal mt-0.5">custom category</p>
                    )}
                  </div>
                )}
              </th>
            </tr>
          </thead>

          <tbody>
            {flatItems.map(item => {

              // ── Section header ───────────────────────────────────────────────
              if (item.type === 'section') {
                return (
                  <tr key={`sec-${item.sectionId}`} className="bg-muted/25 border-y border-border/50">
                    <td colSpan={2} className="px-5 py-1.5">
                      <span className={cn('text-[10px] font-bold uppercase tracking-widest', item.color)}>
                        {item.label}
                      </span>
                    </td>
                  </tr>
                )
              }

              // ── No customer labels placeholder ───────────────────────────────
              if (item.type === 'clabel-empty') {
                return (
                  <tr key="clabel-empty">
                    <td colSpan={2} className="px-5 py-5">
                      <div className="flex items-center gap-3 text-muted-foreground/40">
                        <Lock className="w-4 h-4 shrink-0" />
                        <div>
                          <p className="text-xs font-medium">Label detection disabled — no sensitivity labels configured</p>
                          <p className="text-[11px] mt-0.5">
                            Add your MIP or custom sensitivity labels to enable this control.{' '}
                            <a
                              href="/genai-controls/sensitivity-labels"
                              className="text-primary/60 hover:text-primary transition-colors inline-flex items-center gap-0.5"
                            >
                              Manage Sensitivity Labels <ArrowRight className="w-3 h-3" />
                            </a>
                          </p>
                        </div>
                      </div>
                    </td>
                  </tr>
                )
              }

              if (!selectedCat) return null

              // ── Customer label row ───────────────────────────────────────────
              if (item.type === 'clabel-row') {
                const { rowKey, clabel, ri } = item
                const cc             = colorClasses(clabel.color)
                const override       = localOverrides[`${rowKey}::${selectedCat.id}`] ?? null
                const defaultAction  = getCustomerLabelDefault(clabel, selectedCat.system_tag)
                const effectiveAction = (override?.action ?? defaultAction ?? 'not-set') as ActionCode
                const isOverride     = !!override
                const meta           = ACTIONS[effectiveAction]

                return (
                  <tr
                    key={rowKey}
                    className={cn('border-b border-border/40 hover:bg-card/30 transition-colors', ri % 2 !== 0 && 'bg-card/10')}
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span className={cn('w-2 h-2 rounded-full shrink-0', cc.dot)} />
                        <span className={cn('text-xs font-semibold', cc.text)}>{clabel.display_name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className={cn('relative rounded-md border px-2.5 py-1.5 min-w-[150px]', meta.cell)}>
                          <select
                            value={effectiveAction}
                            onChange={e => handleChange(rowKey, selectedCat, e.target.value as ActionCode)}
                            className={cn('w-full appearance-none bg-transparent text-[11px] font-semibold focus:outline-none cursor-pointer', meta.text)}
                          >
                            {(Object.entries(ACTIONS) as [ActionCode, typeof ACTIONS[ActionCode]][])
                              .filter(([code]) => code !== 'not-set' || effectiveAction === 'not-set')
                              .map(([code, m]) => (
                                <option key={code} value={code} className="bg-card text-foreground">{m.label}</option>
                              ))}
                          </select>
                        </div>
                        {isOverride && defaultAction ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] text-muted-foreground/40">Default: {ACTIONS[defaultAction].label}</span>
                            <button
                              onClick={() => handleReset(rowKey, selectedCat)}
                              title="Reset to default"
                              className="text-muted-foreground/30 hover:text-muted-foreground/70 transition-colors"
                            >
                              <RotateCcw className="w-3 h-3" />
                            </button>
                          </div>
                        ) : effectiveAction !== 'not-set' && (
                          <span className="text-[9px] text-muted-foreground/30 italic">recommended</span>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              }

              // ── Effata system label row ──────────────────────────────────────
              const { rowKey, label: lbl, sectionId, ri } = item
              const cc             = colorClasses(lbl.color)
              const override       = localOverrides[`${rowKey}::${selectedCat.id}`] ?? null
              const defaultAction  = getDefault(sectionId, lbl, selectedCat.system_tag)
              const effectiveAction = (override?.action ?? defaultAction ?? 'not-set') as ActionCode
              const isOverride     = !!override
              const meta           = ACTIONS[effectiveAction]

              return (
                <tr
                  key={rowKey}
                  className={cn('border-b border-border/40 hover:bg-card/30 transition-colors', ri % 2 !== 0 && 'bg-card/10')}
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span className={cn('w-2 h-2 rounded-full shrink-0', cc.dot)} />
                      <span className={cn('text-xs font-semibold', cc.text)}>{lbl.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className={cn('relative rounded-md border px-2.5 py-1.5 min-w-[150px]', meta.cell)}>
                        <select
                          value={effectiveAction}
                          onChange={e => handleChange(rowKey, selectedCat, e.target.value as ActionCode)}
                          className={cn('w-full appearance-none bg-transparent text-[11px] font-semibold focus:outline-none cursor-pointer', meta.text)}
                        >
                          {(Object.entries(ACTIONS) as [ActionCode, typeof ACTIONS[ActionCode]][])
                            .filter(([code]) => code !== 'not-set' || effectiveAction === 'not-set')
                            .map(([code, m]) => (
                              <option key={code} value={code} className="bg-card text-foreground">{m.label}</option>
                            ))}
                        </select>
                      </div>
                      {isOverride && defaultAction ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] text-muted-foreground/40">Default: {ACTIONS[defaultAction].label}</span>
                          <button
                            onClick={() => handleReset(rowKey, selectedCat)}
                            title="Reset to default"
                            className="text-muted-foreground/30 hover:text-muted-foreground/70 transition-colors"
                          >
                            <RotateCcw className="w-3 h-3" />
                          </button>
                        </div>
                      ) : effectiveAction !== 'not-set' && (
                        <span className="text-[9px] text-muted-foreground/30 italic">recommended</span>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
