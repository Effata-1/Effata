'use client'

import { useState, useTransition } from 'react'
import { cn } from '@/lib/utils'
import { colorClasses } from '@/lib/data-catalog/types'
import { RotateCcw } from 'lucide-react'
import { upsertControlMatrixCell, deleteControlMatrixCell } from '../actions'

// ── Action registry ───────────────────────────────────────────────────────────

export type ActionCode =
  | 'allow' | 'allow-alert' | 'allow-approved' | 'allow-monitor'
  | 'coach' | 'block' | 'block-coach' | 'block-exception'
  | 'not-set'

export const ACTIONS: Record<ActionCode, { label: string; cell: string; text: string }> = {
  'allow':          { label: 'Allow',            cell: 'bg-emerald-500/10 border-emerald-500/20', text: 'text-emerald-400' },
  'allow-alert':    { label: 'Allow + Alert',    cell: 'bg-green-500/10 border-green-500/20',    text: 'text-green-400' },
  'allow-approved': { label: 'Allow if Approved',cell: 'bg-green-500/10 border-green-500/20',    text: 'text-green-400' },
  'allow-monitor':  { label: 'Allow / Monitor',  cell: 'bg-blue-500/10 border-blue-500/20',      text: 'text-blue-400' },
  'coach':          { label: 'Coach',            cell: 'bg-amber-500/10 border-amber-500/20',    text: 'text-amber-400' },
  'block':          { label: 'Block',            cell: 'bg-red-500/10 border-red-500/20',        text: 'text-red-400' },
  'block-coach':    { label: 'Block / Coach',    cell: 'bg-red-500/10 border-red-500/20',        text: 'text-red-400' },
  'block-exception':{ label: 'Block / Exception',cell: 'bg-purple-500/10 border-purple-500/20',  text: 'text-purple-400' },
  'not-set':        { label: '— Not set —',      cell: 'bg-transparent border-border-strong',    text: 'text-muted-foreground/40' },
}

// ── Default matrix (columns = system tag order) ───────────────────────────────
// enterprise-approved | approved-with-conditions | permitted-with-restriction | prohibited | personal

export const SYSTEM_TAG_ORDER = [
  'enterprise-approved',
  'approved-with-conditions',
  'permitted-with-restriction',
  'prohibited',
  'personal',
] as const

const TAG_TO_COL_INDEX: Record<string, number> = {
  'enterprise-approved':        0,
  'approved-with-conditions':   1,
  'permitted-with-restriction': 2,
  'prohibited':                 3,
  'personal':                   4,
}

export const MATRIX_ROWS: { dataType: string; classification: string; defaults: ActionCode[] }[] = [
  { dataType: 'Public Data',          classification: 'public',              defaults: ['allow',          'allow',       'coach',       'block', 'allow-monitor'] },
  { dataType: 'Internal Data',        classification: 'internal',            defaults: ['allow',          'coach',       'block',       'block', 'coach'] },
  { dataType: 'Confidential',         classification: 'confidential',        defaults: ['allow-alert',    'block',       'block',       'block', 'block'] },
  { dataType: 'Highly Confidential',  classification: 'highly_confidential', defaults: ['block-exception','block',       'block',       'block', 'block'] },
  { dataType: 'Secret / Keys',        classification: 'secret',              defaults: ['block',          'block',       'block',       'block', 'block'] },
  { dataType: 'Credentials & Tokens', classification: 'secret',              defaults: ['block',          'block',       'block',       'block', 'block'] },
  { dataType: 'PCI Data',             classification: 'highly_confidential', defaults: ['block',          'block',       'block',       'block', 'block'] },
  { dataType: 'Low-volume PII',       classification: 'confidential',        defaults: ['coach',          'coach',       'block-coach', 'block', 'coach'] },
  { dataType: 'Bulk PII',             classification: 'highly_confidential', defaults: ['block',          'block',       'block',       'block', 'block'] },
  { dataType: 'Source Code',          classification: 'confidential',        defaults: ['allow-approved', 'block-coach', 'block',       'block', 'block'] },
]

const CLASS_COLORS: Record<string, string> = {
  public:              'text-green-400',
  internal:            'text-blue-400',
  confidential:        'text-amber-400',
  highly_confidential: 'text-orange-400',
  secret:              'text-red-400',
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface MatrixCategory {
  id: string
  system_tag: string | null
  name: string
  color: string
}

export interface MatrixOverride {
  data_type: string
  category_id: string
  action_code: string
}

interface Props {
  categories: MatrixCategory[]
  overrides: MatrixOverride[]
}

// ── Cell component ────────────────────────────────────────────────────────────

function MatrixCell({
  dataType,
  catId,
  effectiveAction,
  defaultAction,
  isOverride,
  onChange,
  onReset,
}: {
  dataType: string
  catId: string
  effectiveAction: ActionCode
  defaultAction: ActionCode | null
  isOverride: boolean
  onChange: (a: ActionCode) => void
  onReset: () => void
}) {
  const meta = ACTIONS[effectiveAction]

  return (
    <td className="px-3 py-2.5 align-top">
      <div className="space-y-1 min-w-[136px]">
        {/* Action select */}
        <div className={cn('relative rounded-lg border px-2 py-1', meta.cell)}>
          <select
            value={effectiveAction}
            onChange={e => onChange(e.target.value as ActionCode)}
            className={cn(
              'w-full appearance-none bg-transparent text-xs font-semibold focus:outline-none cursor-pointer pr-3',
              meta.text,
            )}
          >
            {(Object.entries(ACTIONS) as [ActionCode, typeof ACTIONS[ActionCode]][])
              .filter(([code]) => code !== 'not-set' || effectiveAction === 'not-set')
              .map(([code, m]) => (
                <option key={code} value={code} className="bg-card text-foreground">
                  {m.label}
                </option>
              ))}
          </select>
        </div>

        {/* Override indicator + reset */}
        {isOverride && defaultAction && (
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-muted-foreground/40">
              Default: {ACTIONS[defaultAction].label}
            </span>
            <button
              onClick={onReset}
              title="Reset to default"
              className="text-muted-foreground/30 hover:text-muted-foreground/70 transition-colors"
            >
              <RotateCcw className="w-2.5 h-2.5" />
            </button>
          </div>
        )}
        {!isOverride && effectiveAction !== 'not-set' && (
          <span className="text-[10px] text-muted-foreground/30 italic">recommended</span>
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
      map[`${o.data_type}|${o.category_id}`] = o.action_code as ActionCode
    }
    return map
  })
  const [, startTransition] = useTransition()

  const orderedCats: MatrixCategory[] = [
    ...(SYSTEM_TAG_ORDER.map(tag => categories.find(c => c.system_tag === tag)).filter(Boolean) as MatrixCategory[]),
    ...categories.filter(c => !c.system_tag),
  ]

  function getCell(dataType: string, cat: MatrixCategory): {
    effectiveAction: ActionCode
    defaultAction: ActionCode | null
    isOverride: boolean
  } {
    const key = `${dataType}|${cat.id}`
    const override = localOverrides[key] ?? null
    const idx = cat.system_tag != null ? TAG_TO_COL_INDEX[cat.system_tag] : undefined
    const row = MATRIX_ROWS.find(r => r.dataType === dataType)
    const defaultAction: ActionCode | null =
      idx !== undefined && row ? (row.defaults[idx] ?? null) : null

    return {
      effectiveAction: (override ?? defaultAction ?? 'not-set') as ActionCode,
      defaultAction,
      isOverride: !!override,
    }
  }

  function handleChange(dataType: string, cat: MatrixCategory, newAction: ActionCode) {
    const key = `${dataType}|${cat.id}`
    setLocalOverrides(prev => ({ ...prev, [key]: newAction }))
    startTransition(async () => {
      await upsertControlMatrixCell(dataType, cat.id, newAction)
    })
  }

  function handleReset(dataType: string, cat: MatrixCategory) {
    const key = `${dataType}|${cat.id}`
    setLocalOverrides(prev => {
      const next = { ...prev }
      delete next[key]
      return next
    })
    startTransition(async () => {
      await deleteControlMatrixCell(dataType, cat.id)
    })
  }

  return (
    <div className="rounded-xl border border-border overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px]">
          <thead>
            <tr className="border-b border-border bg-card">
              <th className="text-left text-xs text-muted-foreground/80 font-semibold uppercase tracking-wide px-5 py-4 w-44">
                Data Type
              </th>
              {orderedCats.map(cat => {
                const cc = colorClasses(cat.color)
                const isCustom = !cat.system_tag
                return (
                  <th key={cat.id} className="text-left px-4 py-4">
                    <span className={cn('text-xs font-semibold', cc.text)}>{cat.name}</span>
                    {isCustom && (
                      <span className="ml-1.5 text-[10px] text-muted-foreground/40 font-normal">custom</span>
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {MATRIX_ROWS.map((row, ri) => (
              <tr
                key={row.dataType}
                className={cn('hover:bg-card/30 transition-colors', ri % 2 === 0 ? '' : 'bg-card/10')}
              >
                <td className="px-5 py-3">
                  <p className="text-sm font-medium text-foreground">{row.dataType}</p>
                  <p className={cn('text-[10px] font-semibold uppercase tracking-wide mt-0.5', CLASS_COLORS[row.classification] ?? 'text-muted-foreground/60')}>
                    {row.classification.replace(/_/g, ' ')}
                  </p>
                </td>
                {orderedCats.map(cat => {
                  const { effectiveAction, defaultAction, isOverride } = getCell(row.dataType, cat)
                  return (
                    <MatrixCell
                      key={cat.id}
                      dataType={row.dataType}
                      catId={cat.id}
                      effectiveAction={effectiveAction}
                      defaultAction={defaultAction}
                      isOverride={isOverride}
                      onChange={a => handleChange(row.dataType, cat, a)}
                      onReset={() => handleReset(row.dataType, cat)}
                    />
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
