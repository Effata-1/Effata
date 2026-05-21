'use client'

import { useState, useOptimistic, useTransition } from 'react'
import { Pencil, Calendar, Users, RefreshCw, ChevronDown, ChevronRight, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DLPTool } from '@/lib/onboarding/data'
import { updateMyStack } from '../actions'
import type { LicenceDetail } from '../actions'

// ─── Types ────────────────────────────────────────────────────────────────────

interface StackState {
  tools:          string[]
  modules:        Record<string, string[]>
  licenceDetails: Record<string, LicenceDetail>
}

interface Props {
  allTools:              DLPTool[]
  initialTools:          string[]
  initialModules:        Record<string, string[]>
  initialCoverageAreas:  Record<string, string>
  initialLicenceDetails: Record<string, LicenceDetail>
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CYCLE_LABELS: Record<NonNullable<LicenceDetail['cycle']>, string> = {
  'monthly':  'Monthly',
  'annual':   'Annual',
  '2-year':   '2-Year',
  '3-year':   '3-Year',
}

function formatDate(iso?: string) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function daysUntilRenewal(endDate?: string): number | null {
  if (!endDate) return null
  return Math.ceil((new Date(endDate).getTime() - Date.now()) / 86_400_000)
}

// ─── Licence badge (view mode) ────────────────────────────────────────────────

function LicenceBadge({ detail }: { detail: LicenceDetail }) {
  const days = daysUntilRenewal(detail.endDate)
  const isExpiringSoon = days !== null && days <= 60 && days > 0
  const isExpired = days !== null && days <= 0

  return (
    <div className="mt-3 pt-3 border-t border-border/50 space-y-2">
      <p className="text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-widest">Licence</p>
      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
        {detail.seats && (
          <span className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            {detail.seats.toLocaleString()} seats
          </span>
        )}
        {detail.cycle && (
          <span className="flex items-center gap-1">
            <RefreshCw className="w-3 h-3" />
            {CYCLE_LABELS[detail.cycle]}
          </span>
        )}
        {(detail.startDate || detail.endDate) && (
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {formatDate(detail.startDate) ?? '—'} → {formatDate(detail.endDate) ?? '—'}
          </span>
        )}
      </div>
      {isExpired && (
        <p className="text-[11px] font-medium text-rose-400">Licence expired</p>
      )}
      {isExpiringSoon && (
        <p className="text-[11px] font-medium text-amber-400">Renews in {days} days</p>
      )}
      {detail.notes && (
        <p className="text-[11px] text-muted-foreground/60 italic">{detail.notes}</p>
      )}
    </div>
  )
}

// ─── Licence form (edit mode, per-tool) ───────────────────────────────────────

function LicenceForm({
  toolId,
  value,
  onChange,
}: {
  toolId:   string
  value:    LicenceDetail
  onChange: (toolId: string, detail: LicenceDetail) => void
}) {
  const [open, setOpen] = useState(
    !!(value.seats || value.cycle || value.startDate || value.endDate),
  )

  function set(patch: Partial<LicenceDetail>) {
    onChange(toolId, { ...value, ...patch })
  }

  return (
    <div className="mt-3 border-t border-border/50 pt-3">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground/60 hover:text-foreground transition-colors"
      >
        {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        <span className="uppercase tracking-widest">Licence details</span>
        {!open && !value.seats && !value.cycle && (
          <span className="ml-1 flex items-center gap-0.5 text-[10px] text-muted-foreground/40">
            <Plus className="w-2.5 h-2.5" /> Add
          </span>
        )}
      </button>

      {open && (
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {/* Seats */}
          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground/50 uppercase tracking-widest">Seats</label>
            <input
              type="number"
              min={1}
              value={value.seats ?? ''}
              onChange={e => set({ seats: e.target.value ? Number(e.target.value) : undefined })}
              placeholder="e.g. 500"
              className="w-full px-2.5 py-1.5 text-xs rounded-md bg-background border border-border text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-blue-500/40"
            />
          </div>

          {/* Billing cycle */}
          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground/50 uppercase tracking-widest">Cycle</label>
            <select
              value={value.cycle ?? ''}
              onChange={e => set({ cycle: (e.target.value as LicenceDetail['cycle']) || undefined })}
              className="w-full px-2.5 py-1.5 text-xs rounded-md bg-background border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500/40"
            >
              <option value="">— Select —</option>
              {(Object.keys(CYCLE_LABELS) as NonNullable<LicenceDetail['cycle']>[]).map(k => (
                <option key={k} value={k}>{CYCLE_LABELS[k]}</option>
              ))}
            </select>
          </div>

          {/* Start date */}
          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground/50 uppercase tracking-widest">Start date</label>
            <input
              type="date"
              value={value.startDate ?? ''}
              onChange={e => set({ startDate: e.target.value || undefined })}
              className="w-full px-2.5 py-1.5 text-xs rounded-md bg-background border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500/40"
            />
          </div>

          {/* End date */}
          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground/50 uppercase tracking-widest">End date</label>
            <input
              type="date"
              value={value.endDate ?? ''}
              onChange={e => set({ endDate: e.target.value || undefined })}
              className="w-full px-2.5 py-1.5 text-xs rounded-md bg-background border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500/40"
            />
          </div>

          {/* Notes — full width */}
          <div className="col-span-2 sm:col-span-4 space-y-1">
            <label className="text-[10px] text-muted-foreground/50 uppercase tracking-widest">Notes (optional)</label>
            <input
              type="text"
              value={value.notes ?? ''}
              onChange={e => set({ notes: e.target.value || undefined })}
              placeholder="e.g. Enterprise tier, includes Endpoint add-on"
              className="w-full px-2.5 py-1.5 text-xs rounded-md bg-background border border-border text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-blue-500/40"
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function MyStackEditor({
  allTools,
  initialTools,
  initialModules,
  initialCoverageAreas,
  initialLicenceDetails,
}: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<StackState>({
    tools:          initialTools,
    modules:        initialModules,
    licenceDetails: initialLicenceDetails,
  })
  const [isPending, startTransition] = useTransition()

  const [optimisticStack, applyOptimistic] = useOptimistic(
    { tools: initialTools, modules: initialModules, licenceDetails: initialLicenceDetails } as StackState,
    (_: StackState, next: StackState) => next,
  )

  const realTools     = allTools.filter(t => t.channelCoverage)
  const selectedTools = allTools.filter(t => optimisticStack.tools.includes(t.id))

  function toggleTool(id: string) {
    setDraft(prev => ({
      ...prev,
      tools: prev.tools.includes(id) ? prev.tools.filter(x => x !== id) : [...prev.tools, id],
    }))
  }

  function toggleModule(toolId: string, moduleId: string) {
    setDraft(prev => {
      const current = prev.modules[toolId] ?? []
      return {
        ...prev,
        modules: {
          ...prev.modules,
          [toolId]: current.includes(moduleId) ? current.filter(x => x !== moduleId) : [...current, moduleId],
        },
      }
    })
  }

  function setLicenceDetail(toolId: string, detail: LicenceDetail) {
    setDraft(prev => ({
      ...prev,
      licenceDetails: { ...prev.licenceDetails, [toolId]: detail },
    }))
  }

  function handleSave() {
    const next = { ...draft }
    startTransition(async () => {
      applyOptimistic(next)
      await updateMyStack(next.tools, next.modules, initialCoverageAreas, next.licenceDetails)
      setEditing(false)
    })
  }

  function handleCancel() {
    setDraft({
      tools:          optimisticStack.tools,
      modules:        optimisticStack.modules,
      licenceDetails: optimisticStack.licenceDetails,
    })
    setEditing(false)
  }

  // ── Edit mode ────────────────────────────────────────────────────────────────

  if (editing) {
    return (
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Edit Your Stack</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Select your tools, licences, and enter contract details.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCancel}
              className="px-3 py-1.5 text-xs rounded-md border border-border text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending}
              className="px-3 py-1.5 text-xs rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {isPending ? 'Saving…' : 'Save Stack'}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          {realTools.map(tool => {
            const selected = draft.tools.includes(tool.id)
            const licence  = draft.licenceDetails[tool.id] ?? {}
            return (
              <div
                key={tool.id}
                className={cn(
                  'rounded-xl border p-4 transition-colors',
                  selected ? 'border-blue-500/40 bg-blue-500/5' : 'border-border bg-card/40',
                )}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => toggleTool(tool.id)}
                    className="mt-0.5 accent-blue-500"
                  />
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-foreground">{tool.label}</span>
                      {tool.category?.map(c => (
                        <span key={c} className="px-1.5 py-0.5 rounded-sm text-[10px] font-semibold bg-muted border border-border text-muted-foreground/70">
                          {c}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">{tool.description}</p>

                    {selected && (
                      <>
                        {/* Module selection */}
                        {tool.modules.length > 0 && (
                          <div>
                            <p className="text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-widest mb-2">
                              Licences / Modules
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {tool.modules.map(mod => {
                                const modSelected = (draft.modules[tool.id] ?? []).includes(mod.id)
                                return (
                                  <button
                                    key={mod.id}
                                    type="button"
                                    onClick={() => toggleModule(tool.id, mod.id)}
                                    className={cn(
                                      'px-2 py-0.5 rounded-md text-xs border transition-colors',
                                      modSelected
                                        ? 'bg-blue-500/15 border-blue-500/30 text-blue-400'
                                        : 'bg-muted border-border text-muted-foreground hover:text-foreground',
                                    )}
                                  >
                                    {mod.label}
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        )}

                        {/* Licence details form */}
                        <LicenceForm
                          toolId={tool.id}
                          value={licence}
                          onChange={setLicenceDetail}
                        />
                      </>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>
    )
  }

  // ── View mode ────────────────────────────────────────────────────────────────

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Your Tools & Licences</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            DLP tools, active modules, and licence details for your organisation.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-border text-muted-foreground hover:text-foreground transition-colors"
        >
          <Pencil className="w-3 h-3" />
          Edit Stack
        </button>
      </div>

      {selectedTools.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">No tools selected.</p>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="mt-2 text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            Add your first tool →
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {selectedTools.map(tool => {
            const selectedModuleIds = optimisticStack.modules[tool.id] ?? []
            const selectedModules   = selectedModuleIds
              .map(id => tool.modules.find(m => m.id === id))
              .filter((m): m is NonNullable<typeof m> => m !== undefined)
            const licence = optimisticStack.licenceDetails[tool.id]
            const hasLicence = licence && (licence.seats || licence.cycle || licence.startDate || licence.endDate)

            return (
              <div key={tool.id} className="rounded-xl border border-border bg-card/40 p-4 space-y-3">
                {/* Tool header */}
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-semibold text-foreground">{tool.label}</span>
                  <div className="flex gap-1 flex-wrap justify-end">
                    {tool.category?.map(c => (
                      <span key={c} className="px-1.5 py-0.5 rounded-sm text-[10px] font-semibold bg-muted border border-border text-muted-foreground/60">
                        {c}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Modules */}
                {selectedModules.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedModules.map(mod => (
                      <span key={mod.id} className="px-2 py-0.5 rounded-md text-xs bg-blue-500/10 border border-blue-500/20 text-blue-400">
                        {mod.label}
                      </span>
                    ))}
                  </div>
                )}

                {/* Licence details */}
                {hasLicence ? (
                  <LicenceBadge detail={licence} />
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditing(true)}
                    className="mt-1 text-[11px] text-muted-foreground/40 hover:text-muted-foreground transition-colors flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    Add licence details
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
