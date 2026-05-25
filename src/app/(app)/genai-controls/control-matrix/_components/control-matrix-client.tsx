'use client'

import { useState, useTransition } from 'react'
import { cn } from '@/lib/utils'
import { colorClasses } from '@/lib/data-catalog/types'
import { RotateCcw } from 'lucide-react'
import { upsertControlMatrixCell, deleteControlMatrixCell } from '../actions'

// ── Action registry ───────────────────────────────────────────────────────────

export type ActionCode = 'allow' | 'block-coach-2' | 'block-coach-3' | 'block-coach-4' | 'not-set'

export const ACTIONS: Record<ActionCode, { label: string; cell: string; text: string }> = {
  'allow':         { label: 'Allow',           cell: 'bg-emerald-500/10 border-emerald-500/20', text: 'text-emerald-400' },
  'block-coach-2': { label: 'Block + Coach 2', cell: 'bg-red-500/10 border-red-500/20',         text: 'text-red-400' },
  'block-coach-3': { label: 'Block + Coach 3', cell: 'bg-orange-500/10 border-orange-500/20',   text: 'text-orange-400' },
  'block-coach-4': { label: 'Block + Coach 4', cell: 'bg-red-500/15 border-red-500/25',         text: 'text-red-300' },
  'not-set':       { label: '—',               cell: 'bg-transparent border-border',            text: 'text-muted-foreground/30' },
}

// ── Column definitions ────────────────────────────────────────────────────────

export interface MatrixColumn {
  key:      string
  label:    string
  activity: 'post_prompt' | 'upload'
  subGroup: null | 'dc' | 'filename'
}

export const COLUMNS: MatrixColumn[] = [
  { key: 'pp|public',    label: 'Public',              activity: 'post_prompt', subGroup: null },
  { key: 'pp|conf',      label: 'Confidential',         activity: 'post_prompt', subGroup: null },
  { key: 'pp|hc_secret', label: 'Keywords HC + Secret', activity: 'post_prompt', subGroup: null },
  { key: 'ul|dc|public', label: 'Public',               activity: 'upload',      subGroup: 'dc' },
  { key: 'ul|dc|int',    label: 'Internal',             activity: 'upload',      subGroup: 'dc' },
  { key: 'ul|dc|conf',   label: 'Confidential',         activity: 'upload',      subGroup: 'dc' },
  { key: 'ul|dc|hc',     label: 'Highly Conf.',         activity: 'upload',      subGroup: 'dc' },
  { key: 'ul|dc|secret', label: 'Secret',               activity: 'upload',      subGroup: 'dc' },
  { key: 'ul|fn|hc',     label: 'Highly Conf.',         activity: 'upload',      subGroup: 'filename' },
  { key: 'ul|fn|secret', label: 'Secret',               activity: 'upload',      subGroup: 'filename' },
]

const PP_COLS      = COLUMNS.filter(c => c.activity === 'post_prompt')    // 3
const UL_DC_COLS   = COLUMNS.filter(c => c.subGroup === 'dc')              // 5
const UL_FN_COLS   = COLUMNS.filter(c => c.subGroup === 'filename')        // 2

// ── Default actions per system tag ────────────────────────────────────────────

export const SYSTEM_TAG_ORDER = [
  'enterprise-approved',
  'approved-with-conditions',
  'permitted-with-restriction',
  'prohibited',
  'personal',
] as const

const DEFAULTS: Record<string, Record<string, ActionCode>> = {
  'enterprise-approved': {
    'pp|public': 'allow',  'pp|conf': 'allow',         'pp|hc_secret': 'allow',
    'ul|dc|public': 'allow', 'ul|dc|int': 'allow',     'ul|dc|conf': 'allow',
    'ul|dc|hc': 'allow',     'ul|dc|secret': 'allow',
    'ul|fn|hc': 'allow',     'ul|fn|secret': 'allow',
  },
  'approved-with-conditions': {
    'pp|public': 'allow',  'pp|conf': 'allow',          'pp|hc_secret': 'block-coach-4',
    'ul|dc|public': 'allow', 'ul|dc|int': 'allow',      'ul|dc|conf': 'allow',
    'ul|dc|hc': 'block-coach-4', 'ul|dc|secret': 'block-coach-4',
    'ul|fn|hc': 'block-coach-4', 'ul|fn|secret': 'block-coach-4',
  },
  'permitted-with-restriction': {
    'pp|public': 'allow',  'pp|conf': 'block-coach-4',  'pp|hc_secret': 'block-coach-4',
    'ul|dc|public': 'allow', 'ul|dc|int': 'block-coach-3', 'ul|dc|conf': 'block-coach-3',
    'ul|dc|hc': 'block-coach-4', 'ul|dc|secret': 'block-coach-4',
    'ul|fn|hc': 'block-coach-4', 'ul|fn|secret': 'block-coach-4',
  },
  'prohibited': {
    'pp|public': 'block-coach-2', 'pp|conf': 'block-coach-2', 'pp|hc_secret': 'block-coach-2',
    'ul|dc|public': 'block-coach-2', 'ul|dc|int': 'block-coach-2', 'ul|dc|conf': 'block-coach-2',
    'ul|dc|hc': 'block-coach-2',     'ul|dc|secret': 'block-coach-2',
    'ul|fn|hc': 'block-coach-2',     'ul|fn|secret': 'block-coach-2',
  },
  'personal': {
    'pp|public': 'allow',  'pp|conf': 'block-coach-4',  'pp|hc_secret': 'block-coach-4',
    'ul|dc|public': 'allow', 'ul|dc|int': 'block-coach-3', 'ul|dc|conf': 'block-coach-4',
    'ul|dc|hc': 'block-coach-4', 'ul|dc|secret': 'block-coach-4',
    'ul|fn|hc': 'block-coach-4', 'ul|fn|secret': 'block-coach-4',
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

// ── Cell ──────────────────────────────────────────────────────────────────────

function MatrixCell({
  colKey, catId, effectiveAction, defaultAction, isOverride, onChange, onReset,
}: {
  colKey:          string
  catId:           string
  effectiveAction: ActionCode
  defaultAction:   ActionCode | null
  isOverride:      boolean
  onChange:        (a: ActionCode) => void
  onReset:         () => void
}) {
  const meta = ACTIONS[effectiveAction]
  return (
    <td className="px-2 py-2 align-middle">
      <div className="space-y-0.5 min-w-[110px]">
        <div className={cn('relative rounded-md border px-2 py-1', meta.cell)}>
          <select
            value={effectiveAction}
            onChange={e => onChange(e.target.value as ActionCode)}
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
            <button onClick={onReset} title="Reset to default" className="text-muted-foreground/30 hover:text-muted-foreground/70 transition-colors">
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

  function getCell(colKey: string, cat: MatrixCategory) {
    const override = localOverrides[`${colKey}::${cat.id}`] ?? null
    const defaultAction: ActionCode | null = cat.system_tag ? (DEFAULTS[cat.system_tag]?.[colKey] ?? null) : null
    return {
      effectiveAction: (override ?? defaultAction ?? 'not-set') as ActionCode,
      defaultAction,
      isOverride: !!override,
    }
  }

  function handleChange(colKey: string, cat: MatrixCategory, action: ActionCode) {
    setLocalOverrides(prev => ({ ...prev, [`${colKey}::${cat.id}`]: action }))
    startTransition(async () => { await upsertControlMatrixCell(colKey, cat.id, action) })
  }

  function handleReset(colKey: string, cat: MatrixCategory) {
    setLocalOverrides(prev => { const next = { ...prev }; delete next[`${colKey}::${cat.id}`]; return next })
    startTransition(async () => { await deleteControlMatrixCell(colKey, cat.id) })
  }

  const thBase = 'text-[10px] font-semibold uppercase tracking-wide px-2 py-2 text-center border-b border-border'

  return (
    <div className="rounded-xl border border-border overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-card">

            {/* Row 1: activity groups */}
            <tr>
              <th rowSpan={3} className="text-left text-[10px] font-semibold text-muted-foreground/80 uppercase tracking-wide px-4 py-3 border-b border-r border-border align-bottom w-48">
                GenAI Category
              </th>
              <th colSpan={PP_COLS.length} className={cn(thBase, 'border-r border-border text-orange-400')}>
                Post / Prompt
              </th>
              <th colSpan={UL_DC_COLS.length + UL_FN_COLS.length} className={cn(thBase, 'text-muted-foreground/80')}>
                Upload
              </th>
            </tr>

            {/* Row 2: sub-groups (blank for post/prompt, DC Labels + Filename for upload) */}
            <tr>
              {PP_COLS.map((_, i) => (
                <th key={i} className={cn('border-b border-border', i === PP_COLS.length - 1 ? 'border-r' : '')} />
              ))}
              <th colSpan={UL_DC_COLS.length} className={cn(thBase, 'text-orange-400 border-r border-border')}>
                Data Classification Labels
              </th>
              <th colSpan={UL_FN_COLS.length} className={cn(thBase, 'text-muted-foreground/60')}>
                Filename Detection
              </th>
            </tr>

            {/* Row 3: individual column labels */}
            <tr>
              {COLUMNS.map((col, i) => {
                const isLastPP   = col.activity === 'post_prompt' && i === PP_COLS.length - 1
                const isLastDC   = col.subGroup === 'dc' && i === PP_COLS.length + UL_DC_COLS.length - 1
                return (
                  <th key={col.key} className={cn(
                    thBase,
                    (isLastPP || isLastDC) ? 'border-r border-border' : '',
                  )}>
                    {col.label}
                  </th>
                )
              })}
            </tr>
          </thead>

          <tbody className="divide-y divide-border/60">
            {orderedCats.map((cat, ri) => {
              const cc = colorClasses(cat.color)
              return (
                <tr key={cat.id} className={cn('hover:bg-card/30 transition-colors', ri % 2 === 0 ? '' : 'bg-card/10')}>
                  {/* Row label */}
                  <td className="px-4 py-3 border-r border-border/60 align-middle">
                    <div className="flex items-center gap-2">
                      <span className={cn('w-2 h-2 rounded-full shrink-0', cc.bg)} />
                      <div>
                        <p className={cn('text-xs font-semibold', cc.text)}>{cat.name}</p>
                        {!cat.system_tag && (
                          <span className="text-[9px] text-muted-foreground/40">custom</span>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Data cells */}
                  {COLUMNS.map((col, ci) => {
                    const isLastPP = col.activity === 'post_prompt' && ci === PP_COLS.length - 1
                    const isLastDC = col.subGroup === 'dc' && ci === PP_COLS.length + UL_DC_COLS.length - 1
                    const { effectiveAction, defaultAction, isOverride } = getCell(col.key, cat)
                    return (
                      <td key={col.key} className={cn('px-2 py-2 align-middle', (isLastPP || isLastDC) ? 'border-r border-border/60' : '')}>
                        <div className="space-y-0.5 min-w-[110px]">
                          <div className={cn('relative rounded-md border px-2 py-1', ACTIONS[effectiveAction].cell)}>
                            <select
                              value={effectiveAction}
                              onChange={e => handleChange(col.key, cat, e.target.value as ActionCode)}
                              className={cn('w-full appearance-none bg-transparent text-[11px] font-semibold focus:outline-none cursor-pointer', ACTIONS[effectiveAction].text)}
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
                              <button onClick={() => handleReset(col.key, cat)} title="Reset to default" className="text-muted-foreground/30 hover:text-muted-foreground/70 transition-colors">
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
