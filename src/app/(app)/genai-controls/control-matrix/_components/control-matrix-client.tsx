'use client'

import { useState, useMemo, useTransition } from 'react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { colorClasses, RISK_FAMILY_META } from '@/lib/data-catalog/types'
import type { OrgClassificationLabel, SystemLevel, RiskFamily } from '@/lib/data-catalog/types'
import { RotateCcw, Lock, ArrowRight, Shield, CheckCircle2, RefreshCw } from 'lucide-react'
import { pageById } from '@/lib/nav'
import { upsertControlMatrixCell, deleteControlMatrixCell, updateCategoryAccessPosture, resetMatrixToDefaults } from '../actions'
import {
  RF_KEY, CONTENT_DETECTION_ROWS, TAG_ALIAS, TAG_DISPLAY_NAMES,
  RF_DEFAULTS, RF_COACHING_DEFAULTS,
  UL_FN_DEFAULTS, UL_DC_DEFAULTS, UL_FN_COACHING_DEFAULTS,
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
  // Prefer the org's custom name (DB value) over the hardcoded default label.
  return cat.name || (cat.system_tag ? (TAG_DISPLAY_NAMES[cat.system_tag] ?? cat.system_tag) : '')
}


// ── Extra meta for rows outside RISK_FAMILY_META ─────────────────────────────

const EXTRA_ROW_META: Record<string, { color: string }> = {
  'Bulk Data / Large Dataset': { color: 'zinc' },
  'Large File Upload':         { color: 'zinc' },
  'General Usage Reminder':    { color: 'zinc' },
}

const FILENAME_LEVELS: SystemLevel[] = ['highly_confidential', 'secret']

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
  const [resetPending, setResetPending]   = useState(false)
  const [resetConfirm, setResetConfirm]   = useState(false)
  const [syncWarning,  setSyncWarning]    = useState<string | null>(null)

  const notifById    = useMemo(() => new Map(notifications.map(n => [n.id, n])), [notifications])
  const notifByName  = useMemo(() => new Map(notifications.map(n => [n.name, n])), [notifications])
  const notifsByType = useMemo(() => {
    const map = new Map<string, typeof notifications>()
    for (const n of notifications) {
      if (!map.has(n.control_type)) map.set(n.control_type, [])
      map.get(n.control_type)!.push(n)
    }
    return map
  }, [notifications])

  const systemTagSet = useMemo(() => new Set<string>(SYSTEM_TAG_ORDER), [])
  const orderedCats = useMemo<MatrixCategory[]>(() => [
    ...(SYSTEM_TAG_ORDER.map(tag => categories.find(c => c.system_tag === tag)).filter(Boolean) as MatrixCategory[]),
    ...categories.filter(c => !systemTagSet.has(c.system_tag ?? '')),
  ], [categories, systemTagSet])

  const [selectedCatId, setSelectedCatId] = useState<string>(orderedCats[0]?.id ?? '')
  const selectedCat = useMemo(
    () => orderedCats.find(c => c.id === selectedCatId) ?? orderedCats[0],
    [orderedCats, selectedCatId],
  )

  // ── Flat row list ─────────────────────────────────────────────────────────

  type FlatItem =
    | { type: 'section';      sectionId: string; label: string; color: string }
    | { type: 'rf-row';       rowKey: string; riskFamily: string; rfKey: string; sectionId: string; ri: number }
    | { type: 'row';          rowKey: string; label: OrgClassificationLabel; sectionId: string; ri: number }
    | { type: 'clabel-row';   rowKey: string; clabel: CustomerLabel; sectionId: string; ri: number }
    | { type: 'clabel-empty'; sectionId: string }

  const flatItems = useMemo<FlatItem[]>(() => {
    const items: FlatItem[] = []
    let rowIndex = 0

    // Content detection — risk family rows
    items.push({ type: 'section', sectionId: 'pp', label: 'Prompt / Upload (Content Detection)', color: 'text-orange-400' })
    CONTENT_DETECTION_ROWS.forEach(rf => {
      const key = RF_KEY[rf]
      items.push({ type: 'rf-row', rowKey: `pp|rf:${key}`, riskFamily: rf, rfKey: key, sectionId: 'pp', ri: rowIndex++ })
    })

    // Label detection — customer sensitivity labels
    const hasCustomerLabels = customerLabels.length > 0
    items.push({
      type: 'section', sectionId: 'ul_dc',
      label: 'Upload — Data Classification Labels (Label Detection)',
      color: hasCustomerLabels ? 'text-orange-400' : 'text-muted-foreground/40',
    })
    if (hasCustomerLabels) {
      customerLabels.forEach(clbl =>
        items.push({ type: 'clabel-row', rowKey: `ul|dc|clabel:${clbl.id}`, clabel: clbl, sectionId: 'ul_dc', ri: rowIndex++ })
      )
    } else {
      items.push({ type: 'clabel-empty', sectionId: 'ul_dc' })
    }

    // Filename detection
    const filenameLabels = localLabels.filter(lbl => lbl.system_level && FILENAME_LEVELS.includes(lbl.system_level as SystemLevel))
    if (filenameLabels.length > 0) {
      items.push({ type: 'section', sectionId: 'ul_fn', label: 'Upload — Filename Detection', color: 'text-muted-foreground/60' })
      filenameLabels.forEach(lbl =>
        items.push({ type: 'row', rowKey: `ul|fn|${lbl.id}`, label: lbl, sectionId: 'ul_fn', ri: rowIndex++ })
      )
    }

    return items
  }, [localLabels, customerLabels])

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
    return notifByName.get(notifName)?.id ?? null
  }

  function getFnCoachingDefault(systemLevel: string | null, catTag: string | null): string | null {
    if (!systemLevel || !catTag) return null
    const tag = TAG_ALIAS[catTag] ?? catTag
    const notifName = UL_FN_COACHING_DEFAULTS[tag]?.[systemLevel] ?? null
    if (!notifName) return null
    return notifByName.get(notifName)?.id ?? null
  }

  function getDefault(sectionId: string, lbl: OrgClassificationLabel, catTag: string | null): ActionCode | null {
    if (!catTag || !lbl.system_level) return null
    const tag = TAG_ALIAS[catTag] ?? catTag
    if (sectionId === 'ul_fn') return (UL_FN_DEFAULTS[tag]?.[lbl.system_level] ?? null) as ActionCode | null
    return null
  }

  function getCustomerLabelDefault(clbl: CustomerLabel, catTag: string | null): ActionCode | null {
    if (!catTag || !clbl.system_level) return null
    const tag = TAG_ALIAS[catTag] ?? catTag
    return (UL_DC_DEFAULTS[tag]?.[clbl.system_level] ?? null) as ActionCode | null
  }

  function handleAction(rowKey: string, action: ActionCode, rowDefaultCoachingId: string | null = null) {
    if (!selectedCat) return
    const existingOverride = localOverrides[`${rowKey}::${selectedCat.id}`]
    const rfKey = rowKey.startsWith('pp|rf:') ? rowKey.slice('pp|rf:'.length) : null

    // Resolve current coaching: prefer saved override, then RF default, then row default
    // (rowDefaultCoachingId covers filename/label rows that have no rfKey)
    const currentCoachingId = existingOverride !== undefined
      ? existingOverride.coachingId
      : (rfKey ? getRfCoachingDefault(rfKey, selectedCat.system_tag) : rowDefaultCoachingId)

    // Compute compatible types for the new action
    const compatibleTypes = COMPATIBLE_CONTROL_TYPES[action] ?? []
    const currentTemplate = notifications.find(n => n.id === currentCoachingId)
    const templateIncompatible =
      compatibleTypes.length === 0 ||
      (currentTemplate && !compatibleTypes.includes(currentTemplate.control_type as ControlType))

    // Atomically clear coaching if incompatible with new action
    const newCoachingId = templateIncompatible ? null : currentCoachingId

    const cellKey     = `${rowKey}::${selectedCat.id}`
    const prevOverride = localOverrides[cellKey] ?? null
    setLocalOverrides(prev => ({ ...prev, [cellKey]: { action, coachingId: newCoachingId } }))
    startTransition(async () => {
      const r = await upsertControlMatrixCell(rowKey, selectedCat.id, action, newCoachingId)
      if (r.error) {
        toast.error('Failed to save', { description: r.error })
        setLocalOverrides(prev => {
          const next = { ...prev }
          if (prevOverride === null) delete next[cellKey]
          else next[cellKey] = prevOverride
          return next
        })
      }
      if (r.warning) { setSyncWarning(r.warning); toast.warning(r.warning) }
    })
  }

  function handleCoaching(rowKey: string, coachingId: string | null, effectiveAction: ActionCode) {
    if (!selectedCat) return
    const cellKey      = `${rowKey}::${selectedCat.id}`
    const prevOverride = localOverrides[cellKey] ?? null
    setLocalOverrides(prev => ({ ...prev, [cellKey]: { action: effectiveAction, coachingId } }))
    startTransition(async () => {
      const r = await upsertControlMatrixCell(rowKey, selectedCat.id, effectiveAction, coachingId)
      if (r.error) {
        toast.error('Failed to save', { description: r.error })
        setLocalOverrides(prev => {
          const next = { ...prev }
          if (prevOverride === null) delete next[cellKey]
          else next[cellKey] = prevOverride
          return next
        })
      }
      if (r.warning) { setSyncWarning(r.warning); toast.warning(r.warning) }
    })
  }

  function handlePostureToggle(catId: string, current: 'allow' | 'allow_dlp' | 'block') {
    const next         = current === 'allow' ? 'allow_dlp' : current === 'allow_dlp' ? 'block' : 'allow'
    const prevPosture  = localPostures[catId] ?? current
    setLocalPostures(prev => ({ ...prev, [catId]: next }))
    startTransition(async () => {
      const r = await updateCategoryAccessPosture(catId, next)
      if (r.error) {
        toast.error('Failed to save posture', { description: r.error })
        setLocalPostures(prev => ({ ...prev, [catId]: prevPosture }))
      }
      if (r.warning) { setSyncWarning(r.warning); toast.warning(r.warning) }
    })
  }

  async function handleResetAllToDefaults() {
    setResetPending(true)
    setResetConfirm(false)
    const result = await resetMatrixToDefaults()
    setResetPending(false)
    if (result?.error) {
      toast.error('Reset failed', { description: result.error })
    } else {
      setLocalOverrides({})
      toast.success('Matrix reset to defaults')
    }
  }

  function handleReset(rowKey: string) {
    if (!selectedCat) return
    const cellKey      = `${rowKey}::${selectedCat.id}`
    const prevOverride = localOverrides[cellKey]
    setLocalOverrides(prev => { const n = { ...prev }; delete n[cellKey]; return n })
    startTransition(async () => {
      const r = await deleteControlMatrixCell(rowKey, selectedCat.id)
      if (r.error) {
        toast.error('Failed to reset', { description: r.error })
        if (prevOverride !== undefined) setLocalOverrides(prev => ({ ...prev, [cellKey]: prevOverride }))
      }
    })
  }

  function renderCell(rowKey: string, defaultAction: ActionCode | null, defaultCoachingId: string | null = null) {
    if (!selectedCat) return null
    const override          = localOverrides[`${rowKey}::${selectedCat.id}`] ?? null
    const effectiveAction   = (override?.action ?? defaultAction ?? 'not-set') as ActionCode
    const effectiveCoaching = override !== null ? override.coachingId : defaultCoachingId
    const isOverride        = !!override
    const meta              = ACTIONS[effectiveAction]
    const selectedNotif     = effectiveCoaching ? (notifById.get(effectiveCoaching) ?? null) : null

    return (
      <td className="px-4 py-3 w-80">
        <div className="space-y-2">

          {/* Action dropdown */}
          <div className={cn('rounded-md border px-3 py-1.5', meta.cell)}>
            <select
              value={effectiveAction}
              onChange={e => handleAction(rowKey, e.target.value as ActionCode, defaultCoachingId)}
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
            const compatibleNotifs = compatibleTypes.flatMap(t => notifsByType.get(t) ?? [])
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

      {/* Policy sync warning — shown when matrix saved but sync failed */}
      {syncWarning && (
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs">
          <span>{syncWarning}</span>
          <button type="button" onClick={() => setSyncWarning(null)} className="shrink-0 text-amber-400/60 hover:text-amber-400 transition-colors">✕</button>
        </div>
      )}

      {/* Reset confirm overlay */}
      {resetConfirm && (
        <>
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={() => setResetConfirm(false)} />
          <div className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm rounded-xl border border-border bg-card shadow-2xl p-6 space-y-4">
            <div>
              <p className="text-sm font-semibold text-foreground">Reset all overrides to defaults?</p>
              <p className="text-xs text-muted-foreground/70 mt-1 leading-relaxed">
                This will delete every customised action in the control matrix and restore system defaults. All recommended policies will be re-compiled and will show <span className="text-blue-400 font-medium">Default Matrix</span>. This cannot be undone.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setResetConfirm(false)}
                className="px-3.5 py-1.5 text-xs font-medium rounded-md border border-border bg-muted/30 hover:bg-muted/60 text-foreground/70 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleResetAllToDefaults}
                className="px-3.5 py-1.5 text-xs font-semibold rounded-md bg-amber-600 hover:bg-amber-700 text-white transition-colors"
              >
                Reset to defaults
              </button>
            </div>
          </div>
        </>
      )}

      {/* Header row: category tabs + reset button */}
      <div className="flex items-center justify-between gap-2">
        {/* Category filter — single select */}
        <div className="flex gap-2 flex-wrap flex-1">
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

        {/* Reset to defaults button */}
        <button
          type="button"
          onClick={() => setResetConfirm(true)}
          disabled={resetPending}
          title="Reset all control matrix overrides to system defaults"
          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-border bg-muted/30 hover:bg-muted/60 text-muted-foreground/60 hover:text-foreground/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw className={cn('w-3.5 h-3.5', resetPending && 'animate-spin')} />
          {resetPending ? 'Resetting…' : 'Reset to Defaults'}
        </button>
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
                            <a href={pageById('sensitivity-labels').route} className="text-primary/60 hover:text-primary transition-colors inline-flex items-center gap-0.5">
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
