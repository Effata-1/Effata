'use client'

import { useState, useTransition } from 'react'
import { cn } from '@/lib/utils'
import { colorClasses } from '@/lib/data-catalog/types'
import { RotateCcw } from 'lucide-react'
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

// ── Row definitions ───────────────────────────────────────────────────────────

interface MatrixRow {
  key:            string
  label:          string
  classification: string
  section:        number
}

const SECTIONS = [
  { id: 0, label: 'Post / Prompt',                       color: 'text-orange-400' },
  { id: 1, label: 'Upload — Data Classification Labels', color: 'text-orange-400' },
  { id: 2, label: 'Upload — Filename Detection',         color: 'text-muted-foreground/60' },
]

const MATRIX_ROWS: MatrixRow[] = [
  { key: 'pp|public',    label: 'Public',              classification: 'public',   section: 0 },
  { key: 'pp|conf',      label: 'Confidential',         classification: 'conf',     section: 0 },
  { key: 'pp|hc_secret', label: 'Keywords HC + Secret', classification: 'secret',   section: 0 },
  { key: 'ul|dc|public', label: 'Public',               classification: 'public',   section: 1 },
  { key: 'ul|dc|int',    label: 'Internal',             classification: 'internal', section: 1 },
  { key: 'ul|dc|conf',   label: 'Confidential',         classification: 'conf',     section: 1 },
  { key: 'ul|dc|hc',     label: 'Highly Confidential',  classification: 'hc',       section: 1 },
  { key: 'ul|dc|secret', label: 'Secret',               classification: 'secret',   section: 1 },
  { key: 'ul|fn|hc',     label: 'Highly Confidential',  classification: 'hc',       section: 2 },
  { key: 'ul|fn|secret', label: 'Secret',               classification: 'secret',   section: 2 },
]

const CLASS_COLORS: Record<string, string> = {
  public:   'text-green-400',
  internal: 'text-sky-400',
  conf:     'text-amber-400',
  hc:       'text-orange-400',
  secret:   'text-red-400',
}

// ── Default actions by system tag ─────────────────────────────────────────────

export const SYSTEM_TAG_ORDER = [
  'enterprise-approved',
  'approved-with-conditions',
  'permitted-with-restriction',
  'prohibited',
] as const

const DEFAULTS: Record<string, Record<string, ActionCode>> = {
  'enterprise-approved': {
    'pp|public':    'allow',     'pp|conf':     'monitor',    'pp|hc_secret': 'alert',
    'ul|dc|public': 'allow',     'ul|dc|int':   'monitor',    'ul|dc|conf':   'alert',
    'ul|dc|hc':     'coach-ack', 'ul|dc|secret':'block',
    'ul|fn|hc':     'alert',     'ul|fn|secret':'block',
  },
  'approved-with-conditions': {
    'pp|public':    'allow',  'pp|conf':      'coach',    'pp|hc_secret': 'block',
    'ul|dc|public': 'allow',  'ul|dc|int':    'monitor',  'ul|dc|conf':   'coach',
    'ul|dc|hc':     'block',  'ul|dc|secret': 'block',
    'ul|fn|hc':     'coach-ack', 'ul|fn|secret': 'block',
  },
  'permitted-with-restriction': {
    'pp|public':    'monitor',   'pp|conf':      'coach-ack', 'pp|hc_secret': 'block',
    'ul|dc|public': 'monitor',   'ul|dc|int':    'coach',     'ul|dc|conf':   'block',
    'ul|dc|hc':     'block',     'ul|dc|secret': 'block',
    'ul|fn|hc':     'block',     'ul|fn|secret': 'block',
  },
  'prohibited': {
    'pp|public':    'block', 'pp|conf':      'block', 'pp|hc_secret': 'block',
    'ul|dc|public': 'block', 'ul|dc|int':    'block', 'ul|dc|conf':   'block',
    'ul|dc|hc':     'block', 'ul|dc|secret': 'block',
    'ul|fn|hc':     'block', 'ul|fn|secret': 'block',
  },
}

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
}

// ── Main client component ─────────────────────────────────────────────────────

export function ControlMatrixClient({ categories, overrides }: Props) {
  const [localOverrides, setLocalOverrides] = useState<Record<string, ActionCode>>(() => {
    const map: Record<string, ActionCode> = {}
    for (const o of overrides) {
      map[`${o.data_type}::${o.category_id}`] = o.action_code as ActionCode
    }
    return map
  })
  const [, startTransition] = useTransition()

  const orderedCats: MatrixCategory[] = [
    ...(SYSTEM_TAG_ORDER.map(tag => categories.find(c => c.system_tag === tag)).filter(Boolean) as MatrixCategory[]),
    ...categories.filter(c => !c.system_tag),
  ]

  function getCell(rowKey: string, cat: MatrixCategory) {
    const override     = localOverrides[`${rowKey}::${cat.id}`] ?? null
    const defaultAction: ActionCode | null = cat.system_tag ? (DEFAULTS[cat.system_tag]?.[rowKey] ?? null) : null
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
    setLocalOverrides(prev => { const next = { ...prev }; delete next[`${rowKey}::${cat.id}`]; return next })
    startTransition(async () => { await deleteControlMatrixCell(rowKey, cat.id) })
  }

  // Build a flat list: section-header items + row items (avoids Fragment key issues)
  type FlatItem =
    | { type: 'section'; section: typeof SECTIONS[0] }
    | { type: 'row'; row: MatrixRow; ri: number }

  const flatItems: FlatItem[] = []
  let lastSection = -1
  MATRIX_ROWS.forEach((row, ri) => {
    if (row.section !== lastSection) {
      lastSection = row.section
      flatItems.push({ type: 'section', section: SECTIONS[row.section] })
    }
    flatItems.push({ type: 'row', row, ri })
  })

  return (
    <div className="rounded-xl border border-border overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-card/80">
              <th className="text-left text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wide px-5 py-3 w-52">
                Activity / Data Type
              </th>
              {orderedCats.map(cat => {
                const cc = colorClasses(cat.color)
                return (
                  <th key={cat.id} className="px-3 py-3 text-left min-w-[148px]">
                    <p className={cn('text-xs font-bold', cc.text)}>{cat.name}</p>
                    {!cat.system_tag && (
                      <p className="text-[9px] text-muted-foreground/40 font-normal mt-0.5">custom</p>
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>

          <tbody>
            {flatItems.map(item => {
              if (item.type === 'section') {
                return (
                  <tr key={`sec-${item.section.id}`} className="bg-muted/25 border-y border-border/50">
                    <td colSpan={orderedCats.length + 1} className="px-5 py-1.5">
                      <span className={cn('text-[10px] font-bold uppercase tracking-widest', item.section.color)}>
                        {item.section.label}
                      </span>
                    </td>
                  </tr>
                )
              }

              const { row, ri } = item
              const classColor = CLASS_COLORS[row.classification] ?? 'text-muted-foreground/60'

              return (
                <tr
                  key={row.key}
                  className={cn(
                    'border-b border-border/40 hover:bg-card/30 transition-colors',
                    ri % 2 === 0 ? '' : 'bg-card/10',
                  )}
                >
                  <td className="px-5 py-3">
                    <span className={cn('text-xs font-semibold', classColor)}>{row.label}</span>
                  </td>

                  {orderedCats.map(cat => {
                    const { effectiveAction, defaultAction, isOverride } = getCell(row.key, cat)
                    const meta = ACTIONS[effectiveAction]
                    return (
                      <td key={cat.id} className="px-3 py-2.5 align-middle">
                        <div className="space-y-0.5">
                          <div className={cn('relative rounded-md border px-2 py-1', meta.cell)}>
                            <select
                              value={effectiveAction}
                              onChange={e => handleChange(row.key, cat, e.target.value as ActionCode)}
                              className={cn(
                                'w-full appearance-none bg-transparent text-[11px] font-semibold focus:outline-none cursor-pointer',
                                meta.text,
                              )}
                            >
                              {(Object.entries(ACTIONS) as [ActionCode, (typeof ACTIONS)[ActionCode]][])
                                .filter(([code]) => code !== 'not-set' || effectiveAction === 'not-set')
                                .map(([code, m]) => (
                                  <option key={code} value={code} className="bg-card text-foreground">
                                    {m.label}
                                  </option>
                                ))}
                            </select>
                          </div>

                          {isOverride && defaultAction && (
                            <div className="flex items-center gap-1">
                              <span className="text-[9px] text-muted-foreground/40">
                                Default: {ACTIONS[defaultAction].label}
                              </span>
                              <button
                                onClick={() => handleReset(row.key, cat)}
                                title="Reset to default"
                                className="text-muted-foreground/30 hover:text-muted-foreground/70 transition-colors"
                              >
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
  )
}
