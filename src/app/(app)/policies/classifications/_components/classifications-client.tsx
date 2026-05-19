'use client'

import { useState, useTransition, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { Plus, X, Check, Loader2, Sparkles, ChevronDown, GripVertical, Pencil } from 'lucide-react'
import { upsertLabel, deleteLabel, setClassification, suggestClassificationsAI, acceptAISuggestions } from '@/lib/data-catalog/actions'
import { colorClasses, COLOR_OPTIONS, SYSTEM_LEVEL_META } from '@/lib/data-catalog/types'
import type { OrgClassificationLabel, AISuggestion } from '@/lib/data-catalog/types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface EnrichedOrgType {
  id:                     string
  name:                   string
  examples:               string[]
  is_custom:              boolean
  classification_label_id: string | null
  mapped_by:              string | null
  confidence:             number | null
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
          className={cn('w-5 h-5 rounded-full transition-all', c.class, value === c.value ? 'ring-2 ring-offset-2 ring-offset-zinc-900 ring-white scale-110' : 'opacity-60 hover:opacity-100')}
          title={c.label}
        />
      ))}
    </div>
  )
}

// ─── Edit label modal ─────────────────────────────────────────────────────────

function EditLabelModal({
  label,
  labels,
  onClose,
}: {
  label: OrgClassificationLabel | null
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
  const [error, setError] = useState<string | null>(null)
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
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold text-white">{isNew ? 'Add classification label' : 'Edit label'}</h3>
          <button onClick={onClose} className="text-zinc-600 hover:text-zinc-400"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Name <span className="text-red-400">*</span></label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Restricted, Level 4, Confidential"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Color</label>
            <ColorPicker value={form.color} onChange={c => setForm(f => ({ ...f, color: c }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Description</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={2} placeholder="What types of data belong in this classification?"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 resize-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Priority (1 = highest risk)</label>
            <input type="number" min={1} max={99} value={form.priority}
              onChange={e => setForm(f => ({ ...f, priority: Number(e.target.value) }))}
              className="w-24 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500" />
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-300">Cancel</button>
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

// ─── Labels tab ───────────────────────────────────────────────────────────────

function LabelsTab({
  labels,
  countByLabel,
  userRole,
}: {
  labels:       OrgClassificationLabel[]
  countByLabel: Record<string, number>
  userRole:     string
}) {
  const [editTarget, setEditTarget] = useState<OrgClassificationLabel | 'new' | null>(null)
  const [delError,   setDelError]   = useState<string | null>(null)
  const [isPending,  startTransition] = useTransition()
  const isAdmin = userRole === 'admin'

  function handleDelete(label: OrgClassificationLabel) {
    setDelError(null)
    startTransition(async () => {
      const result = await deleteLabel(label.id)
      if (result.error) setDelError(result.error)
    })
  }

  const systemLabels = labels.filter(l => l.is_system).sort((a, b) => a.priority - b.priority)
  const customLabels = labels.filter(l => !l.is_system).sort((a, b) => a.priority - b.priority)

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
            className="flex items-center gap-1.5 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium rounded-lg border border-zinc-700 transition-colors">
            <Plus className="w-3.5 h-3.5" />
            Add label
          </button>
        </div>
      )}

      <div className="text-xs text-zinc-600 bg-zinc-900/40 border border-zinc-800 rounded-lg px-4 py-2.5">
        You are using the system defaults. Rename or add labels to match your organisation&apos;s classification scheme.
      </div>

      {delError && <p className="text-xs text-red-400 px-1">{delError}</p>}

      <div className="rounded-xl border border-zinc-800 overflow-hidden divide-y divide-zinc-800">
        {[...systemLabels, ...customLabels].map(label => {
          const cc    = colorClasses(label.color)
          const count = countByLabel[label.id] ?? 0
          return (
            <div key={label.id} className="flex items-center gap-4 px-5 py-4 hover:bg-zinc-900/30 transition-colors">
              <GripVertical className="w-4 h-4 text-zinc-700 shrink-0" />
              <div className={cn('w-2.5 h-2.5 rounded-full shrink-0', cc.dot)} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={cn('text-sm font-semibold', cc.text)}>{label.name}</span>
                  {label.is_system && (
                    <span className="text-[10px] text-zinc-600 bg-zinc-800 px-1.5 py-0.5 rounded">System default</span>
                  )}
                  {label.system_level && (
                    <span className="text-[10px] text-zinc-600">
                      ↔ {SYSTEM_LEVEL_META[label.system_level as keyof typeof SYSTEM_LEVEL_META]?.label}
                    </span>
                  )}
                </div>
                {label.description && <p className="text-xs text-zinc-600 mt-0.5 truncate">{label.description}</p>}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className={cn('text-xs font-medium tabular-nums', count > 0 ? cc.text : 'text-zinc-700')}>
                  {count} {count === 1 ? 'type' : 'types'}
                </span>
                <span className="text-xs text-zinc-600">P{label.priority}</span>
                {isAdmin && (
                  <button onClick={() => setEditTarget(label)}
                    className="p-1.5 text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 rounded transition-colors">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                )}
                {isAdmin && !label.is_system && (
                  <button onClick={() => handleDelete(label)} disabled={isPending}
                    className="p-1.5 text-zinc-700 hover:text-red-400 hover:bg-zinc-800 rounded transition-colors disabled:opacity-50">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── AI Assist modal ──────────────────────────────────────────────────────────

function AIAssistModal({
  unclassified,
  labels,
  onClose,
  onAccept,
}: {
  unclassified: EnrichedOrgType[]
  labels:       OrgClassificationLabel[]
  onClose:      () => void
  onAccept:     (suggestions: AISuggestion[]) => void
}) {
  const [step, setStep] = useState<'confirm' | 'loading' | 'review'>('confirm')
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleRun() {
    setStep('loading')
    startTransition(async () => {
      const result = await suggestClassificationsAI(unclassified.map(t => t.id))
      if (result.error) { setError(result.error); setStep('confirm'); return }
      setSuggestions(result.suggestions ?? [])
      setStep('review')
    })
  }

  function handleAcceptAll() {
    startTransition(async () => {
      const result = await acceptAISuggestions(suggestions)
      if (result.error) { setError(result.error); return }
      onAccept(suggestions)
      onClose()
    })
  }

  const labelMap = new Map(labels.map(l => [l.id, l]))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 w-full max-w-2xl shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-400" />
            <h3 className="text-base font-semibold text-white">AI Classification Assist</h3>
          </div>
          <button onClick={onClose} className="text-zinc-600 hover:text-zinc-400"><X className="w-4 h-4" /></button>
        </div>

        {step === 'confirm' && (
          <div className="space-y-4">
            <p className="text-sm text-zinc-400">
              Claude will suggest a classification label for{' '}
              <span className="text-white font-medium">{unclassified.length} unclassified data type{unclassified.length !== 1 ? 's' : ''}</span>{' '}
              based on your organisation&apos;s classification labels.
            </p>
            <div className="bg-zinc-800/40 rounded-lg p-3 max-h-32 overflow-y-auto">
              {unclassified.map(t => (
                <p key={t.id} className="text-xs text-zinc-500 py-0.5">{t.name}</p>
              ))}
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <div className="flex justify-end gap-2">
              <button onClick={onClose} className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-300">Cancel</button>
              <button onClick={handleRun} className="flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium">
                <Sparkles className="w-3.5 h-3.5" />
                Run AI mapping
              </button>
            </div>
          </div>
        )}

        {step === 'loading' && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="w-7 h-7 text-blue-400 animate-spin" />
            <p className="text-sm text-zinc-400">Claude is analysing your data types…</p>
          </div>
        )}

        {step === 'review' && (
          <div className="space-y-4">
            <p className="text-sm text-zinc-400">Review suggestions below. You can change any before accepting.</p>
            <div className="rounded-lg border border-zinc-800 overflow-hidden max-h-72 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-zinc-900">
                  <tr className="border-b border-zinc-800">
                    <th className="text-left text-[10px] font-semibold text-zinc-600 uppercase tracking-wide px-4 py-2.5">Data type</th>
                    <th className="text-left text-[10px] font-semibold text-zinc-600 uppercase tracking-wide px-3 py-2.5">Suggested label</th>
                    <th className="text-left text-[10px] font-semibold text-zinc-600 uppercase tracking-wide px-3 py-2.5">Confidence</th>
                    <th className="text-left text-[10px] font-semibold text-zinc-600 uppercase tracking-wide px-3 py-2.5">Reasoning</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/40">
                  {suggestions.map((s, i) => {
                    const dt    = unclassified.find(t => t.id === s.org_data_type_id)
                    const label = labelMap.get(s.label_id ?? '')
                    const cc    = label ? colorClasses(label.color) : null
                    return (
                      <tr key={i} className="hover:bg-zinc-900/30">
                        <td className="px-4 py-2.5 text-xs text-white">{dt?.name ?? s.org_data_type_id}</td>
                        <td className="px-3 py-2.5">
                          {cc && <span className={cn('text-xs font-medium px-2 py-0.5 rounded', cc.text, cc.bg)}>{s.label_name}</span>}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <div className="w-12 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                              <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.round(s.confidence * 100)}%` }} />
                            </div>
                            <span className="text-[10px] text-zinc-500">{Math.round(s.confidence * 100)}%</span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-zinc-600 max-w-xs">{s.reasoning}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <div className="flex justify-end gap-2">
              <button onClick={onClose} className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-300">Discard</button>
              <button onClick={handleAcceptAll} disabled={isPending}
                className="flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium disabled:opacity-50">
                {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Accept all {suggestions.length} suggestion{suggestions.length !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Mapping tab ──────────────────────────────────────────────────────────────

function MappingTab({
  orgTypes,
  labels,
}: {
  orgTypes: EnrichedOrgType[]
  labels:   OrgClassificationLabel[]
}) {
  const [search,       setSearch]       = useState('')
  const [mapFilter,    setMapFilter]    = useState<string>('all')
  const [showAI,       setShowAI]       = useState(false)
  const [isPending,    startTransition] = useTransition()

  const unclassified = orgTypes.filter(t => !t.classification_label_id)
  const mapped       = orgTypes.filter(t => !!t.classification_label_id)

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return orgTypes.filter(t => {
      if (mapFilter === 'unclassified' && t.classification_label_id) return false
      if (mapFilter === 'classified' && !t.classification_label_id) return false
      if (q) return t.name.toLowerCase().includes(q)
      return true
    })
  }, [orgTypes, search, mapFilter])

  function handleClassify(orgDataTypeId: string, labelId: string) {
    startTransition(async () => { await setClassification(orgDataTypeId, labelId) })
  }

  const labelMap = new Map(labels.map(l => [l.id, l]))

  return (
    <div className="space-y-4">
      {showAI && (
        <AIAssistModal
          unclassified={unclassified}
          labels={labels}
          onClose={() => setShowAI(false)}
          onAccept={() => {}}
        />
      )}

      {/* Stats bar */}
      <div className="flex items-center gap-4 px-4 py-3 rounded-xl border border-zinc-800 bg-zinc-900/40 text-xs text-zinc-500">
        <span><span className="text-white font-semibold">{orgTypes.length}</span> data types in scope</span>
        <span className="text-zinc-700">·</span>
        <span><span className="text-green-400 font-semibold">{mapped.length}</span> mapped</span>
        <span className="text-zinc-700">·</span>
        <span>
          <span className={cn('font-semibold', unclassified.length > 0 ? 'text-amber-400' : 'text-zinc-500')}>
            {unclassified.length}
          </span>{' '}
          unclassified
        </span>
        <div className="ml-auto flex items-center gap-2">
          {unclassified.length > 0 && (
            <button
              onClick={() => setShowAI(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 text-xs font-medium rounded-lg transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" />
              AI Assist ({unclassified.length})
            </button>
          )}
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-xs">
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search data types…"
            className="w-full bg-zinc-800/60 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500" />
        </div>
        <div className="relative">
          <select value={mapFilter} onChange={e => setMapFilter(e.target.value)}
            className="appearance-none bg-zinc-800/60 border border-zinc-700 rounded-lg pl-3 pr-7 py-2 text-xs text-zinc-300 focus:outline-none cursor-pointer">
            <option value="all">All types</option>
            <option value="unclassified">Unclassified only</option>
            <option value="classified">Mapped only</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-500 pointer-events-none" />
        </div>
      </div>

      {/* Mapping table */}
      {orgTypes.length === 0 ? (
        <div className="text-center py-12 text-zinc-600 text-sm rounded-xl border border-zinc-800">
          No data types in scope yet.{' '}
          <a href="/policies/data-catalog" className="text-blue-400 hover:underline">Go to Data Catalog</a>{' '}
          to mark which data types apply to your organisation.
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/60">
                {['Data type', 'Classification', 'Mapped by'].map(h => (
                  <th key={h} className="text-left text-[10px] font-semibold text-zinc-600 uppercase tracking-wide px-4 py-3 first:px-5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/40">
              {filtered.map(t => {
                const label = labelMap.get(t.classification_label_id ?? '')
                const cc    = label ? colorClasses(label.color) : null
                return (
                  <tr key={t.id} className="hover:bg-zinc-900/30 transition-colors">
                    <td className="px-5 py-3">
                      <p className="text-sm text-white font-medium">{t.name}</p>
                      {t.examples.length > 0 && (
                        <p className="text-xs text-zinc-600 mt-0.5">{t.examples.slice(0, 2).join(' · ')}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={t.classification_label_id ?? ''}
                        onChange={e => handleClassify(t.id, e.target.value)}
                        className="bg-zinc-800/80 border border-zinc-700 text-zinc-300 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-zinc-500"
                      >
                        <option value="">— Select —</option>
                        {labels.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      {t.mapped_by === 'ai' ? (
                        <div className="flex items-center gap-1.5">
                          <Sparkles className="w-3 h-3 text-blue-400" />
                          <span className="text-xs text-blue-400">AI</span>
                          {t.confidence != null && (
                            <span className="text-[10px] text-zinc-600">({Math.round(t.confidence * 100)}%)</span>
                          )}
                        </div>
                      ) : t.mapped_by === 'user' ? (
                        <div className="flex items-center gap-1.5">
                          <Check className="w-3 h-3 text-green-400" />
                          <span className="text-xs text-green-400">Manual</span>
                        </div>
                      ) : t.mapped_by === 'system' ? (
                        <span className="text-xs text-zinc-500">System default</span>
                      ) : (
                        <span className="text-xs text-amber-500">Unclassified</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function ClassificationsClient({
  labels,
  orgTypes,
  countByLabel,
  userRole,
}: {
  labels:       OrgClassificationLabel[]
  orgTypes:     EnrichedOrgType[]
  countByLabel: Record<string, number>
  userRole:     string
}) {
  const [tab, setTab] = useState<'labels' | 'mapping'>('labels')

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <div className="flex items-center gap-1.5 text-xs text-zinc-600 mb-2">
          <span>Policies</span><span>›</span><span className="text-zinc-400">Classification Labels</span>
        </div>
        <h1 className="text-2xl font-bold text-white mb-1">Classification Labels</h1>
        <p className="text-zinc-500 text-sm">Define your organisation&apos;s sensitivity levels and map your data types to them.</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-zinc-800">
        {(['labels', 'mapping'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium capitalize transition-colors border-b-2 -mb-px',
              tab === t ? 'border-blue-500 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300',
            )}
          >
            {t === 'labels' ? 'Labels' : 'Data Type Mapping'}
          </button>
        ))}
      </div>

      {tab === 'labels'
        ? <LabelsTab labels={labels} countByLabel={countByLabel} userRole={userRole} />
        : <MappingTab orgTypes={orgTypes} labels={labels} />}
    </div>
  )
}
