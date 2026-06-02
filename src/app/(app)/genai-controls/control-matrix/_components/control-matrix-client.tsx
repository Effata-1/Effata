'use client'

import { useState, useTransition } from 'react'
import { cn } from '@/lib/utils'
import { colorClasses, RISK_FAMILY_META } from '@/lib/data-catalog/types'
import type { OrgClassificationLabel, SystemLevel, RiskFamily } from '@/lib/data-catalog/types'
import { RotateCcw, Lock, ArrowRight, Shield, CheckCircle2 } from 'lucide-react'
import { upsertControlMatrixCell, deleteControlMatrixCell, updateCategoryAccessPosture } from '../actions'
import {
  RF_KEY, CONTENT_DETECTION_ROWS, TAG_ALIAS, TAG_DISPLAY_NAMES,
  RF_DEFAULTS, RF_COACHING_DEFAULTS,
} from '@/lib/genai/control-matrix-rows'
import { COMPATIBLE_CONTROL_TYPES } from '@/lib/genai/coaching-validation'
import type { ControlType } from '@/lib/genai/types'

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

// TAG_ALIAS, TAG_DISPLAY_NAMES, RF_KEY, CONTENT_DETECTION_ROWS,
// RF_DEFAULTS, RF_COACHING_DEFAULTS are imported from @/lib/genai/control-matrix-rows

function catDisplayName(cat: { system_tag: string | null; name: string }): string {
  return cat.system_tag ? (TAG_DISPLAY_NAMES[cat.system_tag] ?? cat.name) : cat.name
}


// ── Extra meta for rows outside RISK_FAMILY_META ─────────────────────────────

const EXTRA_ROW_META: Record<string, { color: string }> = {
  'Bulk Data / Large Dataset': { color: 'zinc' },
  'Large File Upload':         { color: 'zinc' },
  'General Usage Reminder':    { color: 'zinc' },
}

// ── Label / filename detection defaults (unchanged) ───────────────────────────

type LevelMap = Partial<Record<SystemLevel, ActionCode>>

const UL_DC_DEFAULTS: Record<string, LevelMap> = {
  'enterprise-approved':        { public: 'allow',   internal: 'monitor',    confidential: 'alert',     highly_confidential: 'coach-ack', secret: 'block' },
  'approved-with-conditions':   { public: 'allow',   internal: 'monitor',    confidential: 'coach-ack', highly_confidential: 'block',     secret: 'block' },
  'permitted-with-restriction': { public: 'monitor', internal: 'coach-ack',  confidential: 'block',     highly_confidential: 'block',     secret: 'block' },
  'prohibited':                 { public: 'block',   internal: 'block',      confidential: 'block',     highly_confidential: 'block',     secret: 'block' },
}

const UL_FN_DEFAULTS: Record<string, LevelMap> = {
  'enterprise-approved':        { highly_confidential: 'allow',     secret: 'allow' },
  'approved-with-conditions':   { highly_confidential: 'coach-ack', secret: 'coach-just' },
  'permitted-with-restriction': { highly_confidential: 'block',     secret: 'block' },
  'prohibited':                 { highly_confidential: 'block',     secret: 'block' },
}

const FILENAME_LEVELS: SystemLevel[] = ['highly_confidential', 'secret']

// 2D: catTag × sysLevel → coaching template name
const UL_FN_COACHING_DEFAULTS: Record<string, Partial<Record<string, string | null>>> = {
  'enterprise-approved':        { highly_confidential: null, secret: null },
  'approved-with-conditions':   { highly_confidential: 'Sensitive File Name Detected', secret: 'Sensitive Filename Justification Required' },
  'permitted-with-restriction': { highly_confidential: 'Highly Confidential Upload Blocked', secret: 'Secret File Upload Blocked' },
}

export const SYSTEM_TAG_ORDER = [
  'enterprise-approved',
  'approved-with-conditions',
  'permitted-with-restriction',
  'prohibited',
] as const

// ── Props ─────────────────────────────────────────────────────────────────────

export interface MatrixCategory {
  id:             string
  system_tag:     string | null
  name:           string
  color:          string
  access_posture: 'allow' | 'allow_dlp' | 'block'
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
  notifications:  { id: string; name: string; coach_label: string | null; control_type: string }[]
}

type CellOverride = { action: ActionCode; coachingId: string | null }

// ── Main component ────────────────────────────────────────────────────────────

export function ControlMatrixClient({ categories, overrides, labels, customerLabels, notifications }: Props) {
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
  const [localPostures, setLocalPostures] = useState<Record<string, 'allow' | 'allow_dlp' | 'block'>>(() =>
    Object.fromEntries(categories.map(c => [c.id, c.access_posture]))
  )
  const [, startTransition] = useTransition()

  const orderedCats: MatrixCategory[] = [
    ...(SYSTEM_TAG_ORDER.map(tag => categories.find(c => c.system_tag === tag)).filter(Boolean) as MatrixCategory[]),
    ...categories.filter(c => !c.system_tag),
  ]

  const [selectedCatId, setSelectedCatId] = useState<string>(orderedCats[0]?.id ?? '')
  const selectedCat = orderedCats.find(c => c.id === selectedCatId) ?? orderedCats[0]

  // ── Flat row list ─────────────────────────────────────────────────────────

  type FlatItem =
    | { type: 'section';      sectionId: string; label: string; color: string }
    | { type: 'rf-row';       rowKey: string; riskFamily: string; rfKey: string; sectionId: string; ri: number }
    | { type: 'row';          rowKey: string; label: OrgClassificationLabel; sectionId: string; ri: number }
    | { type: 'clabel-row';   rowKey: string; clabel: CustomerLabel; sectionId: string; ri: number }
    | { type: 'clabel-empty'; sectionId: string }

  const flatItems: FlatItem[] = []
  let rowIndex = 0

  // Content detection — risk family rows
  flatItems.push({ type: 'section', sectionId: 'pp', label: 'Prompt / Upload (Content Detection)', color: 'text-orange-400' })
  CONTENT_DETECTION_ROWS.forEach(rf => {
    const key = RF_KEY[rf]
    flatItems.push({ type: 'rf-row', rowKey: `pp|rf:${key}`, riskFamily: rf, rfKey: key, sectionId: 'pp', ri: rowIndex++ })
  })

  // Label detection — customer sensitivity labels (unchanged)
  const hasCustomerLabels = customerLabels.length > 0
  flatItems.push({
    type: 'section', sectionId: 'ul_dc',
    label: 'Upload — Data Classification Labels (Label Detection)',
    color: hasCustomerLabels ? 'text-orange-400' : 'text-muted-foreground/40',
  })
  if (hasCustomerLabels) {
    customerLabels.forEach(clbl =>
      flatItems.push({ type: 'clabel-row', rowKey: `ul|dc|clabel:${clbl.id}`, clabel: clbl, sectionId: 'ul_dc', ri: rowIndex++ })
    )
  } else {
    flatItems.push({ type: 'clabel-empty', sectionId: 'ul_dc' })
  }

  // Filename detection (unchanged)
  const filenameLabels = localLabels.filter(lbl => lbl.system_level && FILENAME_LEVELS.includes(lbl.system_level as SystemLevel))
  if (filenameLabels.length > 0) {
    flatItems.push({ type: 'section', sectionId: 'ul_fn', label: 'Upload — Filename Detection', color: 'text-muted-foreground/60' })
    filenameLabels.forEach(lbl =>
      flatItems.push({ type: 'row', rowKey: `ul|fn|${lbl.id}`, label: lbl, sectionId: 'ul_fn', ri: rowIndex++ })
    )
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  function getRfDefault(rfKey: string, catTag: string | null): ActionCode | null {
    if (!catTag) return null
    const tag = TAG_ALIAS[catTag] ?? catTag
    return (RF_DEFAULTS[tag]?.[rfKey] ?? null) as ActionCode | null
  }

  function getRfCoachingDefault(rfKey: string, catTag: string | null): string | null {
    if (!catTag) return null
    const tag = TAG_ALIAS[catTag] ?? catTag
    const notifName = RF_COACHING_DEFAULTS[tag]?.[rfKey] ?? null
    if (!notifName) return null
    return notifications.find(n => n.name === notifName)?.id ?? null
  }

  function getFnCoachingDefault(systemLevel: string | null, catTag: string | null): string | null {
    if (!systemLevel || !catTag) return null
    const notifName = UL_FN_COACHING_DEFAULTS[catTag]?.[systemLevel] ?? null
    if (!notifName) return null
    return notifications.find(n => n.name === notifName)?.id ?? null
  }

  function getDefault(sectionId: string, lbl: OrgClassificationLabel, catTag: string | null): ActionCode | null {
    if (!catTag || !lbl.system_level) return null
    if (sectionId === 'ul_fn') return UL_FN_DEFAULTS[catTag]?.[lbl.system_level as SystemLevel] ?? null
    return null
  }

  function getCustomerLabelDefault(clbl: CustomerLabel, catTag: string | null): ActionCode | null {
    if (!catTag || !clbl.system_level) return null
    return UL_DC_DEFAULTS[catTag]?.[clbl.system_level as SystemLevel] ?? null
  }

  function handleAction(rowKey: string, action: ActionCode) {
    if (!selectedCat) return
    const existingOverride = localOverrides[`${rowKey}::${selectedCat.id}`]
    const rfKey = rowKey.startsWith('pp|rf:') ? rowKey.slice('pp|rf:'.length) : null

    const currentCoachingId = existingOverride !== undefined
      ? existingOverride.coachingId
      : (rfKey ? getRfCoachingDefault(rfKey, selectedCat.system_tag) : null)

    // Compute compatible types for the new action
    const compatibleTypes = COMPATIBLE_CONTROL_TYPES[action] ?? []
    const currentTemplate = notifications.find(n => n.id === currentCoachingId)
    const templateIncompatible =
      compatibleTypes.length === 0 ||
      (currentTemplate && !compatibleTypes.includes(currentTemplate.control_type as ControlType))

    // Atomically clear coaching if incompatible with new action
    const newCoachingId = templateIncompatible ? null : currentCoachingId

    setLocalOverrides(prev => ({ ...prev, [`${rowKey}::${selectedCat.id}`]: { action, coachingId: newCoachingId } }))
    startTransition(async () => { await upsertControlMatrixCell(rowKey, selectedCat.id, action, newCoachingId) })
  }

  function handleCoaching(rowKey: string, coachingId: string | null, effectiveAction: ActionCode) {
    if (!selectedCat) return
    setLocalOverrides(prev => ({ ...prev, [`${rowKey}::${selectedCat.id}`]: { action: effectiveAction, coachingId } }))
    startTransition(async () => { await upsertControlMatrixCell(rowKey, selectedCat.id, effectiveAction, coachingId) })
  }

  function handlePostureToggle(catId: string, current: 'allow' | 'allow_dlp' | 'block') {
    const next = current === 'allow' ? 'allow_dlp' : current === 'allow_dlp' ? 'block' : 'allow'
    setLocalPostures(prev => ({ ...prev, [catId]: next }))
    startTransition(async () => { await updateCategoryAccessPosture(catId, next) })
  }

  function handleReset(rowKey: string) {
    if (!selectedCat) return
    setLocalOverrides(prev => { const n = { ...prev }; delete n[`${rowKey}::${selectedCat.id}`]; return n })
    startTransition(async () => { await deleteControlMatrixCell(rowKey, selectedCat.id) })
  }

  function renderCell(rowKey: string, defaultAction: ActionCode | null, defaultCoachingId: string | null = null) {
    if (!selectedCat) return null
    const override          = localOverrides[`${rowKey}::${selectedCat.id}`] ?? null
    const effectiveAction   = (override?.action ?? defaultAction ?? 'not-set') as ActionCode
    const effectiveCoaching = override !== null ? override.coachingId : defaultCoachingId
    const isOverride        = !!override
    const meta              = ACTIONS[effectiveAction]
    const selectedNotif     = notifications.find(n => n.id === effectiveCoaching)

    return (
      <td className="px-4 py-3 w-80">
        <div className="space-y-2">

          {/* Action dropdown */}
          <div className={cn('rounded-md border px-3 py-1.5', meta.cell)}>
            <select
              value={effectiveAction}
              onChange={e => handleAction(rowKey, e.target.value as ActionCode)}
              className={cn('w-full appearance-none bg-transparent text-[12px] font-semibold focus:outline-none cursor-pointer', meta.text)}
            >
              {(Object.entries(ACTIONS) as [ActionCode, typeof ACTIONS[ActionCode]][])
                // 'coach' is legacy-only — not selectable; 'not-set' shown only when already set
                .filter(([code]) => code !== 'coach' && (code !== 'not-set' || effectiveAction === 'not-set'))
                .map(([code, m]) => (
                  <option key={code} value={code} className="bg-card text-foreground">{m.label}</option>
                ))}
            </select>
          </div>

          {/* Reset button for allow/monitor/alert cells (no coaching row shown) */}
          {(COMPATIBLE_CONTROL_TYPES[effectiveAction] ?? []).length === 0 && isOverride && defaultAction && (
            <div className="flex justify-end">
              <button
                onClick={() => handleReset(rowKey)}
                title={`Reset to default (${ACTIONS[defaultAction].label})`}
                className="text-muted-foreground/30 hover:text-muted-foreground/70 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Coaching row — hidden for allow/monitor/alert/not-set (no template needed) */}
          {(() => {
            const compatibleTypes = COMPATIBLE_CONTROL_TYPES[effectiveAction] ?? []
            if (compatibleTypes.length === 0) return null
            const compatibleNotifs = notifications.filter(n =>
              compatibleTypes.includes(n.control_type as ControlType)
            )
            return (
              <div className="flex items-center gap-1.5">
                {selectedNotif?.coach_label && (
                  <span className="shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                    {selectedNotif.coach_label}
                  </span>
                )}
                <select
                  value={effectiveCoaching ?? ''}
                  onChange={e => handleCoaching(rowKey, e.target.value || null, effectiveAction)}
                  className="flex-1 min-w-0 appearance-none bg-transparent text-[10px] text-muted-foreground/40 hover:text-muted-foreground/70 focus:outline-none cursor-pointer transition-colors"
                >
                  <option value="" className="bg-card text-foreground">— No coaching —</option>
                  {compatibleNotifs.map(n => (
                    <option key={n.id} value={n.id} className="bg-card text-foreground">
                      {n.coach_label ? `${n.coach_label} — ${n.name}` : n.name}
                    </option>
                  ))}
                </select>
                {isOverride && defaultAction && (
                  <button
                    onClick={() => handleReset(rowKey)}
                    title={`Reset to default (${ACTIONS[defaultAction].label})`}
                    className="shrink-0 text-muted-foreground/30 hover:text-muted-foreground/70 transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </button>
                )}
              </div>
            )
          })()}

        </div>
      </td>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">

      {/* Category filter — single select */}
      <div className="flex gap-2 flex-wrap">
        {orderedCats.map(cat => {
          const cc        = colorClasses(cat.color)
          const isSelected = cat.id === selectedCat?.id
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCatId(cat.id)}
              className={cn(
                'px-4 py-1.5 rounded-lg border text-xs font-semibold transition-all',
                isSelected
                  ? cn(cc.bg, cc.text, cc.border, 'shadow-sm')
                  : 'bg-transparent border-border/40 text-muted-foreground/50 hover:border-border hover:text-muted-foreground/80',
              )}
            >
              {catDisplayName(cat)}
            </button>
          )
        })}
      </div>

      {/* ── App Access Posture ─────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-2.5 border-b border-border/50 bg-muted/10">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">
            App Access Posture
          </p>
          <p className="text-[10px] text-muted-foreground/40 mt-0.5">
            Whether access to apps in this category is permitted or blocked at the network level (browse + login).
          </p>
        </div>
        <div className="flex flex-wrap gap-2 px-4 py-3">
          {orderedCats.map(cat => {
            const isLocked   = cat.system_tag === 'prohibited'
            const posture    = localPostures[cat.id] ?? cat.access_posture
            const isBlocked  = posture === 'block'
            const isAllowDlp = posture === 'allow_dlp'
            const isSelected = cat.id === selectedCat?.id
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCatId(cat.id)}
                className={cn(
                  'inline-flex items-center gap-2 px-3 py-2 rounded-lg border transition-all text-left',
                  isSelected
                    ? 'border-border bg-muted/20 ring-1 ring-primary/20'
                    : 'border-border/30 opacity-55 hover:opacity-80',
                )}
              >
                {/* Badge — clickable to cycle allow → allow_dlp → block for non-prohibited categories */}
                <span
                  onClick={e => { if (!isLocked) { e.stopPropagation(); handlePostureToggle(cat.id, posture) } }}
                  title={isLocked ? 'Prohibited categories are always blocked' : `Click to cycle posture (currently: ${posture})`}
                  className={cn(
                    'inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-semibold transition-opacity',
                    isBlocked
                      ? 'border-red-500/30 bg-red-500/10 text-red-400'
                      : isAllowDlp
                        ? 'border-amber-500/20 bg-amber-500/5 text-amber-500'
                        : 'border-emerald-500/25 bg-emerald-500/5 text-emerald-400',
                    !isLocked && 'cursor-pointer hover:opacity-80',
                  )}
                >
                  {isBlocked
                    ? <><Lock className="h-2.5 w-2.5" /> Block Access</>
                    : isAllowDlp
                      ? <><Shield className="h-2.5 w-2.5" /> Allow + DLP Controls</>
                      : <><CheckCircle2 className="h-2.5 w-2.5" /> Allow</>
                  }
                </span>
                <span className="text-[11px] text-muted-foreground/60 font-medium">{catDisplayName(cat)}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Data Controls label ─────────────────────────────────────────────── */}
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40 px-1">
        Data Controls
      </p>

      {/* Matrix table */}
      <div className="rounded-xl border border-border overflow-hidden shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-card/80">
              <th className="text-left text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wide px-5 py-3 w-64">
                Activity / Data Type
              </th>
              <th className="px-4 py-3 text-left w-80">
                {selectedCat && (
                  <p className={cn('text-xs font-bold', colorClasses(selectedCat.color).text)}>
                    {catDisplayName(selectedCat)}
                    {!selectedCat.system_tag && (
                      <span className="ml-1.5 text-[9px] text-muted-foreground/40 font-normal">custom</span>
                    )}
                  </p>
                )}
              </th>
            </tr>
          </thead>

          <tbody>
            {flatItems.map(item => {

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

              if (item.type === 'clabel-empty') {
                return (
                  <tr key="clabel-empty">
                    <td colSpan={2} className="px-5 py-4">
                      <div className="flex items-center gap-3 text-muted-foreground/40">
                        <Lock className="w-4 h-4 shrink-0" />
                        <div>
                          <p className="text-xs font-medium">Label detection disabled — no sensitivity labels configured</p>
                          <p className="text-[11px] mt-0.5">
                            Add your MIP or custom sensitivity labels to enable this control.{' '}
                            <a href="/policies/sensitivity-labels" className="text-primary/60 hover:text-primary transition-colors inline-flex items-center gap-0.5">
                              Manage Sensitivity Labels <ArrowRight className="w-3 h-3" />
                            </a>
                          </p>
                        </div>
                      </div>
                    </td>
                  </tr>
                )
              }

              const ri = 'ri' in item ? item.ri : 0
              const rowBg = cn('border-b border-border/40 hover:bg-card/20 transition-colors', ri % 2 !== 0 && 'bg-card/10')

              if (item.type === 'rf-row') {
                const { rowKey, riskFamily, rfKey } = item
                const meta = RISK_FAMILY_META[riskFamily as RiskFamily] ?? EXTRA_ROW_META[riskFamily] ?? null
                const cc   = meta ? colorClasses(meta.color) : null
                return (
                  <tr key={rowKey} className={rowBg}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        {cc && <span className={cn('w-2 h-2 rounded-full shrink-0', cc.dot)} />}
                        <span className={cn('text-sm font-semibold', cc?.text ?? 'text-foreground/70')}>{riskFamily}</span>
                      </div>
                    </td>
                    {renderCell(
                      rowKey,
                      getRfDefault(rfKey, selectedCat?.system_tag ?? null),
                      getRfCoachingDefault(rfKey, selectedCat?.system_tag ?? null),
                    )}
                  </tr>
                )
              }

              if (item.type === 'clabel-row') {
                const { rowKey, clabel } = item
                const cc = colorClasses(clabel.color)
                return (
                  <tr key={rowKey} className={rowBg}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span className={cn('w-2 h-2 rounded-full shrink-0', cc.dot)} />
                        <span className={cn('text-sm font-semibold', cc.text)}>{clabel.display_name}</span>
                      </div>
                    </td>
                    {renderCell(rowKey, getCustomerLabelDefault(clabel, selectedCat?.system_tag ?? null))}
                  </tr>
                )
              }

              const { rowKey, label: lbl, sectionId } = item
              const cc = colorClasses(lbl.color)
              const defaultCoaching = sectionId === 'ul_fn'
                ? getFnCoachingDefault(lbl.system_level ?? null, selectedCat?.system_tag ?? null)
                : null
              return (
                <tr key={rowKey} className={rowBg}>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span className={cn('w-2 h-2 rounded-full shrink-0', cc.dot)} />
                      <span className={cn('text-sm font-semibold', cc.text)}>{lbl.name}</span>
                    </div>
                  </td>
                  {renderCell(rowKey, getDefault(sectionId, lbl, selectedCat?.system_tag ?? null), defaultCoaching)}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

    </div>
  )
}
