'use client'

import { useState, useTransition, useOptimistic } from 'react'
import { cn } from '@/lib/utils'
import { Plus, X, GripVertical, Pencil, ChevronDown, ArrowLeftRight } from 'lucide-react'
import {
  upsertLabel,
  deleteLabel,
  upsertDestinationTrustLabel,
  deleteDestinationTrustLabel,
  moveSubcategoryToTrust,
  moveDataTypeSubcategoryToLabel,
} from '@/lib/data-catalog/actions'
import {
  colorClasses,
  COLOR_OPTIONS,
  SYSTEM_LEVEL_META,
} from '@/lib/data-catalog/types'
import type { OrgClassificationLabel, OrgDestinationTrustLabel, TrustTag } from '@/lib/data-catalog/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ACRONYMS = new Set(['ai', 'crm', 'hr', 'erp', 'itsm', 'saas', 'bi', 'etl', 'api', 'it'])

function formatSubcategory(slug: string): string {
  return slug
    .split('_')
    .map(w => ACRONYMS.has(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface EnrichedOrgType {
  id:                      string
  name:                    string
  examples:                string[]
  is_custom:               boolean
  classification_label_id: string | null
  mapped_by:               string | null
  confidence:              number | null
}

// ─── Color Picker ─────────────────────────────────────────────────────────────

function ColorPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {COLOR_OPTIONS.map(c => (
        <button
          key={c.value}
          type="button"
          onClick={() => onChange(c.value)}
          className={cn('w-5 h-5 rounded-full transition-all', c.class, value === c.value ? 'ring-2 ring-offset-2 ring-offset-card ring-white scale-110' : 'opacity-60 hover:opacity-100')}
          title={c.label}
        />
      ))}
    </div>
  )
}

// ─── Edit classification label modal ─────────────────────────────────────────

function EditLabelModal({
  label,
  labels,
  onClose,
}: {
  label:  OrgClassificationLabel | null
  labels: OrgClassificationLabel[]
  onClose: () => void
}) {
  const isNew = !label
  const [form, setForm] = useState({
    name:        label?.name ?? '',
    color:       label?.color ?? 'zinc',
    priority:    label?.priority ?? (labels.length + 1),
    description: label?.description ?? '',
  })
  const [error, setError]   = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { setError('Name is required.'); return }
    startTransition(async () => {
      const result = await upsertLabel(label?.id ?? null, { ...form, name: form.name.trim() })
      if (result.error) { setError(result.error); return }
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold text-foreground">{isNew ? 'Add classification label' : 'Edit label'}</h3>
          <button onClick={onClose} className="text-muted-foreground/60 hover:text-muted-foreground"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Name <span className="text-red-400">*</span></label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Restricted, Level 4, Confidential"
              className="w-full bg-muted border border-border-strong rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Color</label>
            <ColorPicker value={form.color} onChange={c => setForm(f => ({ ...f, color: c }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Description</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={2} placeholder="What types of data belong in this classification?"
              className="w-full bg-muted border border-border-strong rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-blue-500 resize-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Priority (1 = highest risk)</label>
            <input type="number" min={1} max={99} value={form.priority}
              onChange={e => setForm(f => ({ ...f, priority: Number(e.target.value) }))}
              className="w-24 bg-muted border border-border-strong rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-blue-500" />
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground/70">Cancel</button>
            <button type="submit" disabled={isPending}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium disabled:opacity-50">
              {isPending ? 'Saving…' : isNew ? 'Add label' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Edit trust label modal ───────────────────────────────────────────────────

function EditTrustLabelModal({
  label,
  labels,
  onClose,
}: {
  label:  OrgDestinationTrustLabel | null
  labels: OrgDestinationTrustLabel[]
  onClose: () => void
}) {
  const isNew = !label
  const [form, setForm] = useState({
    name:        label?.name ?? '',
    color:       label?.color ?? 'zinc',
    priority:    label?.priority ?? (labels.length + 1),
    description: label?.description ?? '',
  })
  const [error, setError]   = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { setError('Name is required.'); return }
    startTransition(async () => {
      const result = await upsertDestinationTrustLabel(label?.id ?? null, { ...form, name: form.name.trim() })
      if (result.error) { setError(result.error); return }
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold text-foreground">{isNew ? 'Add trust level' : 'Edit trust level'}</h3>
          <button onClick={onClose} className="text-muted-foreground/60 hover:text-muted-foreground"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Name <span className="text-red-400">*</span></label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Tier 1 Approved, Under Review"
              className="w-full bg-muted border border-border-strong rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Color</label>
            <ColorPicker value={form.color} onChange={c => setForm(f => ({ ...f, color: c }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Description</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={2} placeholder="What destinations belong in this trust level?"
              className="w-full bg-muted border border-border-strong rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-blue-500 resize-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Priority (1 = most trusted)</label>
            <input type="number" min={1} max={99} value={form.priority}
              onChange={e => setForm(f => ({ ...f, priority: Number(e.target.value) }))}
              className="w-24 bg-muted border border-border-strong rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-blue-500" />
          </div>
          {label?.is_system && (
            <p className="text-xs text-muted-foreground/60 bg-muted/60 rounded-lg px-3 py-2">
              This is a system default — renaming it updates your org&apos;s display name only. The internal tag <span className="text-muted-foreground font-mono">{label.system_tag}</span> stays unchanged.
            </p>
          )}
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground/70">Cancel</button>
            <button type="submit" disabled={isPending}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium disabled:opacity-50">
              {isPending ? 'Saving…' : isNew ? 'Add trust level' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Labels tab ───────────────────────────────────────────────────────────────

type LabelSubcatAction = { type: 'move'; subcategory: string; fromLevel: string; toLevel: string }

function LabelsTab({
  labels,
  countByLabel,
  dataTypeSubcatsByLevel,
  userRole,
}: {
  labels:                  OrgClassificationLabel[]
  countByLabel:            Record<string, number>
  dataTypeSubcatsByLevel:  Record<string, string[]>
  userRole:                string
}) {
  const [editTarget,   setEditTarget]   = useState<OrgClassificationLabel | 'new' | null>(null)
  const [expanded,     setExpanded]     = useState<Set<string>>(new Set())
  const [openReassign, setOpenReassign] = useState<{ subcategory: string; fromLevel: string } | null>(null)
  const [delError,     setDelError]     = useState<string | null>(null)
  const [isPending,    startTransition] = useTransition()
  const isAdmin = userRole === 'admin'

  const [optimisticSubcats, setOptimisticSubcats] = useOptimistic(
    dataTypeSubcatsByLevel,
    (state: Record<string, string[]>, action: LabelSubcatAction) => {
      const next = { ...state }
      next[action.fromLevel] = (next[action.fromLevel] ?? []).filter(s => s !== action.subcategory)
      next[action.toLevel]   = [...(next[action.toLevel] ?? []), action.subcategory].sort()
      return next
    },
  )

  function toggleExpand(labelId: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(labelId)) { next.delete(labelId) } else { next.add(labelId) }
      return next
    })
  }

  function handleDelete(label: OrgClassificationLabel) {
    setDelError(null)
    startTransition(async () => {
      const result = await deleteLabel(label.id)
      if (result.error) setDelError(result.error)
    })
  }

  function handleMoveSubcategory(subcategory: string, fromLevel: string, toLevel: string, newLabelId: string) {
    setOpenReassign(null)
    setOptimisticSubcats({ type: 'move', subcategory, fromLevel, toLevel })
    startTransition(async () => {
      await moveDataTypeSubcategoryToLabel(subcategory, newLabelId)
    })
  }

  const sortedLabels = [...labels].sort((a, b) => a.priority - b.priority)

  return (
    <div className="space-y-4">
      {editTarget && (
        <EditLabelModal
          label={editTarget === 'new' ? null : editTarget}
          labels={labels}
          onClose={() => setEditTarget(null)}
        />
      )}

      {isAdmin && (
        <div className="flex justify-end">
          <button onClick={() => setEditTarget('new')}
            className="flex items-center gap-1.5 px-3 py-2 bg-muted hover:bg-accent text-foreground/70 text-xs font-medium rounded-lg border border-border-strong transition-colors">
            <Plus className="w-3.5 h-3.5" />
            Add label
          </button>
        </div>
      )}

      <div className="text-xs text-muted-foreground/60 bg-card/40 border border-border rounded-lg px-4 py-2.5">
        Rename labels to match your organisation&apos;s classification scheme. Click a row to reassign data type categories between levels.
      </div>

      {delError && <p className="text-xs text-red-400 px-1">{delError}</p>}

      <div className="rounded-xl border border-border divide-y divide-border [&>*:first-child]:rounded-t-xl [&>*:last-child]:rounded-b-xl">
        {sortedLabels.map(label => {
          const cc         = colorClasses(label.color)
          const count      = countByLabel[label.id] ?? 0
          const subcats    = label.system_level ? (optimisticSubcats[label.system_level] ?? []) : []
          const isExpanded = expanded.has(label.id)

          return (
            <div key={label.id}>
              {/* Label row */}
              <div
                className="flex items-center gap-4 px-5 py-4 hover:bg-card/30 transition-colors cursor-pointer select-none"
                onClick={() => toggleExpand(label.id)}
              >
                <GripVertical className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                <div className={cn('w-2.5 h-2.5 rounded-full shrink-0', cc.dot)} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn('text-sm font-semibold', cc.text)}>{label.name}</span>
                    {label.is_system && (
                      <span className="text-[10px] text-muted-foreground/60 bg-muted px-1.5 py-0.5 rounded">System default</span>
                    )}
                    {label.system_level && (
                      <span className="text-[10px] text-muted-foreground/60">
                        ↔ {SYSTEM_LEVEL_META[label.system_level as keyof typeof SYSTEM_LEVEL_META]?.label}
                      </span>
                    )}
                  </div>
                  {label.description && <p className="text-xs text-muted-foreground/60 mt-0.5 truncate">{label.description}</p>}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={cn('text-xs font-medium tabular-nums', count > 0 ? cc.text : 'text-muted-foreground/40')}>
                    {count} {count === 1 ? 'type' : 'types'}
                  </span>
                  <span className="text-xs text-muted-foreground/60">P{label.priority}</span>
                  {isAdmin && (
                    <button
                      onClick={e => { e.stopPropagation(); setEditTarget(label) }}
                      className="p-1.5 text-muted-foreground/60 hover:text-foreground/70 hover:bg-muted rounded transition-colors">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {isAdmin && !label.is_system && (
                    <button
                      onClick={e => { e.stopPropagation(); handleDelete(label) }}
                      disabled={isPending}
                      className="p-1.5 text-muted-foreground/40 hover:text-red-400 hover:bg-muted rounded transition-colors disabled:opacity-50">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <ChevronDown className={cn('w-4 h-4 text-muted-foreground/60 transition-transform', isExpanded && 'rotate-180')} />
                </div>
              </div>

              {/* Subcategory section */}
              {isExpanded && (
                <div className="px-6 pb-4 pt-2 bg-card/20 border-t border-border/50">
                  <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wide mb-2">Data Type Categories</p>
                  {subcats.length === 0 ? (
                    <p className="text-xs text-muted-foreground/60">No data type categories assigned to this classification level.</p>
                  ) : (
                    <div
                      className="flex flex-wrap gap-2"
                      onClick={() => setOpenReassign(null)}
                    >
                      {subcats.map(subcat => {
                        const isOpen = openReassign?.subcategory === subcat && openReassign?.fromLevel === (label.system_level ?? '')
                        return (
                          <div key={subcat} className="relative" onClick={e => e.stopPropagation()}>
                            <div className={cn(
                              'flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-lg text-xs border transition-colors',
                              isOpen
                                ? 'bg-accent border-border-strong text-foreground/90'
                                : 'bg-muted border-border-strong text-muted-foreground hover:border-border-strong',
                            )}>
                              <span>{formatSubcategory(subcat)}</span>
                              <button
                                title="Reassign to a different classification level"
                                onClick={() => setOpenReassign(
                                  isOpen ? null : { subcategory: subcat, fromLevel: label.system_level ?? '' },
                                )}
                                className="ml-0.5 p-0.5 text-muted-foreground/60 hover:text-muted-foreground rounded transition-colors"
                              >
                                <ArrowLeftRight className="w-3 h-3" />
                              </button>
                            </div>

                            {/* Reassign dropdown */}
                            {isOpen && (
                              <div className="absolute top-full left-0 mt-1 z-50 bg-card border border-border-strong rounded-lg overflow-hidden shadow-2xl min-w-48">
                                <p className="text-[10px] text-muted-foreground/60 px-3 pt-2 pb-1 font-medium uppercase tracking-wide">Move to</p>
                                {sortedLabels
                                  .filter(l => l.system_level && l.system_level !== label.system_level)
                                  .map(l => {
                                    const lcc = colorClasses(l.color)
                                    return (
                                      <button
                                        key={l.id}
                                        onClick={() => handleMoveSubcategory(subcat, label.system_level ?? '', l.system_level ?? '', l.id)}
                                        className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted text-left transition-colors"
                                      >
                                        <div className={cn('w-2 h-2 rounded-full shrink-0', lcc.dot)} />
                                        <span className={lcc.text}>{l.name}</span>
                                      </button>
                                    )
                                  })}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Destinations tab ─────────────────────────────────────────────────────────

type LabelOptAction =
  | { type: 'update'; id: string; fields: Partial<OrgDestinationTrustLabel> }
  | { type: 'delete'; id: string }

type SubcatOptAction = { type: 'move'; subcategory: string; fromTag: string; toTag: string }

function DestinationsTab({
  trustLabels,
  destCountByTag,
  subcategoriesByTag,
  userRole,
}: {
  trustLabels:       OrgDestinationTrustLabel[]
  destCountByTag:    Record<string, number>
  subcategoriesByTag: Record<string, string[]>
  userRole:          string
}) {
  const [editTarget,   setEditTarget]   = useState<OrgDestinationTrustLabel | 'new' | null>(null)
  const [expanded,     setExpanded]     = useState<Set<string>>(new Set())
  const [openReassign, setOpenReassign] = useState<{ subcategory: string; fromTag: string } | null>(null)
  const [delError,     setDelError]     = useState<string | null>(null)
  const [,             startTransition] = useTransition()
  const isAdmin = userRole === 'admin'

  const [optimisticLabels, setOptimisticLabels] = useOptimistic(
    trustLabels,
    (state: OrgDestinationTrustLabel[], action: LabelOptAction) => {
      if (action.type === 'update') return state.map(l => l.id === action.id ? { ...l, ...action.fields } : l)
      if (action.type === 'delete') return state.filter(l => l.id !== action.id)
      return state
    },
  )

  const [optimisticSubcats, setOptimisticSubcats] = useOptimistic(
    subcategoriesByTag,
    (state: Record<string, string[]>, action: SubcatOptAction) => {
      const next = { ...state }
      next[action.fromTag] = (next[action.fromTag] ?? []).filter(s => s !== action.subcategory)
      next[action.toTag]   = [...(next[action.toTag] ?? []), action.subcategory].sort()
      return next
    },
  )

  function toggleExpand(labelId: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(labelId)) { next.delete(labelId) } else { next.add(labelId) }
      return next
    })
  }

  function handleDelete(label: OrgDestinationTrustLabel) {
    setDelError(null)
    setOptimisticLabels({ type: 'delete', id: label.id })
    startTransition(async () => {
      const result = await deleteDestinationTrustLabel(label.id)
      if (result.error) setDelError(result.error)
    })
  }

  function handleMoveSubcategory(subcategory: string, fromTag: string, toTag: string) {
    setOpenReassign(null)
    setOptimisticSubcats({ type: 'move', subcategory, fromTag, toTag })
    startTransition(async () => {
      await moveSubcategoryToTrust(subcategory, toTag as TrustTag)
    })
  }

  const sortedLabels = [...optimisticLabels].sort((a, b) => a.priority - b.priority)
  const systemLabels = sortedLabels.filter(l => l.system_tag !== null)

  return (
    <div className="space-y-4">
      {editTarget && (
        <EditTrustLabelModal
          label={editTarget === 'new' ? null : editTarget}
          labels={trustLabels}
          onClose={() => setEditTarget(null)}
        />
      )}

      {isAdmin && (
        <div className="flex justify-end">
          <button onClick={() => setEditTarget('new')}
            className="flex items-center gap-1.5 px-3 py-2 bg-muted hover:bg-accent text-foreground/70 text-xs font-medium rounded-lg border border-border-strong transition-colors">
            <Plus className="w-3.5 h-3.5" />
            Add trust level
          </button>
        </div>
      )}

      <div className="text-xs text-muted-foreground/60 bg-card/40 border border-border rounded-lg px-4 py-2.5">
        Rename trust levels to match your organisation&apos;s terminology. Move subcategory groups between trust levels to reflect your risk posture.
      </div>

      {delError && <p className="text-xs text-red-400 px-1">{delError}</p>}

      <div className="rounded-xl border border-border divide-y divide-border [&>*:first-child]:rounded-t-xl [&>*:last-child]:rounded-b-xl">
        {sortedLabels.map(label => {
          const cc          = colorClasses(label.color)
          const count       = label.system_tag ? (destCountByTag[label.system_tag] ?? 0) : 0
          const subcats     = label.system_tag ? (optimisticSubcats[label.system_tag] ?? []) : []
          const isExpanded  = expanded.has(label.id)

          return (
            <div key={label.id}>
              {/* Label row */}
              <div
                className="flex items-center gap-4 px-5 py-4 hover:bg-card/30 transition-colors cursor-pointer select-none"
                onClick={() => toggleExpand(label.id)}
              >
                <GripVertical className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                <div className={cn('w-2.5 h-2.5 rounded-full shrink-0', cc.dot)} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn('text-sm font-semibold', cc.text)}>{label.name}</span>
                    {label.is_system && (
                      <span className="text-[10px] text-muted-foreground/60 bg-muted px-1.5 py-0.5 rounded">System default</span>
                    )}
                    {label.system_tag && (
                      <span className="text-[10px] text-muted-foreground/60 font-mono">↔ {label.system_tag}</span>
                    )}
                  </div>
                  {label.description && <p className="text-xs text-muted-foreground/60 mt-0.5 truncate">{label.description}</p>}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={cn('text-xs font-medium tabular-nums', count > 0 ? cc.text : 'text-muted-foreground/40')}>
                    {count} {count === 1 ? 'destination' : 'destinations'}
                  </span>
                  <span className="text-xs text-muted-foreground/60">P{label.priority}</span>
                  {isAdmin && (
                    <button
                      onClick={e => { e.stopPropagation(); setEditTarget(label) }}
                      className="p-1.5 text-muted-foreground/60 hover:text-foreground/70 hover:bg-muted rounded transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {isAdmin && !label.is_system && (
                    <button
                      onClick={e => { e.stopPropagation(); handleDelete(label) }}
                      className="p-1.5 text-muted-foreground/40 hover:text-red-400 hover:bg-muted rounded transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <ChevronDown className={cn('w-4 h-4 text-muted-foreground/60 transition-transform', isExpanded && 'rotate-180')} />
                </div>
              </div>

              {/* Subcategory section */}
              {isExpanded && (
                <div className="px-6 pb-4 pt-2 bg-card/20 border-t border-border/50">
                  <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wide mb-2">Subcategories</p>
                  {subcats.length === 0 ? (
                    <p className="text-xs text-muted-foreground/60">No subcategories assigned to this trust level.</p>
                  ) : (
                    <div
                      className="flex flex-wrap gap-2"
                      onClick={() => setOpenReassign(null)}
                    >
                      {subcats.map(subcat => {
                        const isOpen = openReassign?.subcategory === subcat && openReassign?.fromTag === (label.system_tag ?? '')
                        return (
                          <div key={subcat} className="relative" onClick={e => e.stopPropagation()}>
                            <div className={cn(
                              'flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-lg text-xs border transition-colors',
                              isOpen
                                ? 'bg-accent border-border-strong text-foreground/90'
                                : 'bg-muted border-border-strong text-muted-foreground hover:border-border-strong',
                            )}>
                              <span>{formatSubcategory(subcat)}</span>
                              <button
                                title="Reassign subcategory to a different trust level"
                                onClick={() => setOpenReassign(
                                  isOpen ? null : { subcategory: subcat, fromTag: label.system_tag ?? '' },
                                )}
                                className="ml-0.5 p-0.5 text-muted-foreground/60 hover:text-muted-foreground rounded transition-colors"
                              >
                                <ArrowLeftRight className="w-3 h-3" />
                              </button>
                            </div>

                            {/* Reassign dropdown */}
                            {isOpen && (
                              <div className="absolute top-full left-0 mt-1 z-50 bg-card border border-border-strong rounded-lg overflow-hidden shadow-2xl min-w-48">
                                <p className="text-[10px] text-muted-foreground/60 px-3 pt-2 pb-1 font-medium uppercase tracking-wide">Move to</p>
                                {systemLabels
                                  .filter(l => l.system_tag !== label.system_tag)
                                  .map(l => {
                                    const lcc = colorClasses(l.color)
                                    return (
                                      <button
                                        key={l.id}
                                        onClick={() => handleMoveSubcategory(subcat, label.system_tag ?? '', l.system_tag ?? '')}
                                        className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted text-left transition-colors"
                                      >
                                        <div className={cn('w-2 h-2 rounded-full shrink-0', lcc.dot)} />
                                        <span className={lcc.text}>{l.name}</span>
                                      </button>
                                    )
                                  })}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function ClassificationsClient({
  labels,
  orgTypes,
  countByLabel,
  trustLabels,
  destCountByTag,
  subcategoriesByTag,
  dataTypeSubcatsByLevel,
  userRole,
}: {
  labels:                  OrgClassificationLabel[]
  orgTypes:                EnrichedOrgType[]
  countByLabel:            Record<string, number>
  trustLabels:             OrgDestinationTrustLabel[]
  destCountByTag:          Record<string, number>
  subcategoriesByTag:      Record<string, string[]>
  dataTypeSubcatsByLevel:  Record<string, string[]>
  userRole:                string
}) {
  const [tab, setTab] = useState<'labels' | 'destinations'>('labels')

  // suppress unused-var warning — orgTypes kept for future mapping tab
  void orgTypes

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground/60 mb-2">
          <span>Policies</span><span>›</span><span className="text-muted-foreground">Classification</span>
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-1">Classification</h1>
        <p className="text-muted-foreground/80 text-sm">
          Define your organisation&apos;s sensitivity levels and destination trust structure.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        {(['labels', 'destinations'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium capitalize transition-colors border-b-2 -mb-px',
              tab === t ? 'border-blue-500 text-foreground' : 'border-transparent text-muted-foreground/80 hover:text-foreground/70',
            )}
          >
            {t === 'labels' ? 'Labels' : 'Destinations'}
          </button>
        ))}
      </div>

      {tab === 'labels'
        ? <LabelsTab labels={labels} countByLabel={countByLabel} dataTypeSubcatsByLevel={dataTypeSubcatsByLevel} userRole={userRole} />
        : <DestinationsTab
            trustLabels={trustLabels}
            destCountByTag={destCountByTag}
            subcategoriesByTag={subcategoriesByTag}
            userRole={userRole}
          />
      }
    </div>
  )
}
