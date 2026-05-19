'use client'

import { useState, useMemo, useTransition, useOptimistic } from 'react'
import { cn } from '@/lib/utils'
import { Search, X, Plus, ChevronDown, ChevronRight, Info } from 'lucide-react'
import { toggleInScope, setClassification, addCustomDataType } from '@/lib/data-catalog/actions'
import { colorClasses, SYSTEM_LEVEL_META } from '@/lib/data-catalog/types'
import type { OrgClassificationLabel, SystemLevel } from '@/lib/data-catalog/types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface EnrichedCatalogType {
  id:                     string
  slug:                   string
  name:                   string
  system_level:           SystemLevel
  subcategory:            string | null
  examples:               string[]
  notes:                  string | null
  priority:               number
  org_data_type_id:       string | null
  is_in_scope:            boolean
  classification_label_id: string | null
  mapped_by:              string | null
}

interface CustomType {
  id:                     string
  name:                   string
  description:            string | null
  examples:               string[]
  is_custom:              boolean
  org_data_type_id:       string
  classification_label_id: string | null
  mapped_by:              string | null
}

// ─── Classification Rules panel ───────────────────────────────────────────────

const RULES = [
  { title: 'Highest-risk content wins', body: 'If a file contains multiple data types, classify by the most sensitive type present.' },
  { title: 'Volume increases severity, not the label', body: 'High volume of Highly Confidential data stays Highly Confidential — but incident severity and enforcement strength should increase.' },
  { title: 'Some types are always high risk', body: 'Passwords, API keys, tokens, private keys, and privileged credentials always map to Secret, regardless of context.' },
  { title: 'Context can elevate classification', body: 'Source code with hardcoded credentials → Secret. Customer list with PII → Highly Confidential. Public file with hidden SSN → Highly Confidential.' },
]

function RulesPanel() {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-zinc-800/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-medium text-white">Classification Rules</span>
          <span className="text-xs text-zinc-600">Data Type → Classification → Context → DLP Action</span>
        </div>
        {open ? <ChevronDown className="w-4 h-4 text-zinc-500" /> : <ChevronRight className="w-4 h-4 text-zinc-500" />}
      </button>
      {open && (
        <div className="border-t border-zinc-800 px-5 py-4 grid grid-cols-2 gap-4">
          {RULES.map(r => (
            <div key={r.title}>
              <p className="text-xs font-semibold text-zinc-300 mb-1">{r.title}</p>
              <p className="text-xs text-zinc-500 leading-relaxed">{r.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Add custom type modal ────────────────────────────────────────────────────

function AddCustomModal({
  labels,
  onClose,
}: {
  labels: OrgClassificationLabel[]
  onClose: () => void
}) {
  const [form, setForm] = useState({ name: '', description: '', examples: '', notes: '', labelId: labels[0]?.id ?? '' })
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { setError('Name is required.'); return }
    startTransition(async () => {
      const result = await addCustomDataType({
        name:        form.name.trim(),
        description: form.description.trim(),
        examples:    form.examples.split(',').map(s => s.trim()).filter(Boolean),
        notes:       form.notes.trim(),
        labelId:     form.labelId,
      })
      if (result.error) { setError(result.error); return }
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold text-white">Add custom data type</h3>
          <button onClick={onClose} className="text-zinc-600 hover:text-zinc-400"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Name <span className="text-red-400">*</span></label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Customer Contract Templates"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Description</label>
            <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Brief description of this data type"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Examples (comma-separated)</label>
            <input value={form.examples} onChange={e => setForm(f => ({ ...f, examples: e.target.value }))}
              placeholder="e.g. Master Agreement, SOW, NDA"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Classification</label>
            <select value={form.labelId} onChange={e => setForm(f => ({ ...f, labelId: e.target.value }))}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-300 focus:outline-none focus:border-blue-500">
              {labels.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-300">Cancel</button>
            <button type="submit" disabled={isPending}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium disabled:opacity-50">
              {isPending ? 'Adding…' : 'Add data type'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Data type row ────────────────────────────────────────────────────────────

function DataTypeRow({
  item,
  labels,
  onToggle,
  onClassify,
}: {
  item: EnrichedCatalogType
  labels: OrgClassificationLabel[]
  onToggle: (id: string, inScope: boolean) => void
  onClassify: (orgDataTypeId: string, labelId: string) => void
}) {
  const label = labels.find(l => l.id === item.classification_label_id)
  const cc = label ? colorClasses(label.color) : null

  return (
    <tr className="hover:bg-zinc-900/30 transition-colors group border-b border-zinc-800/40 last:border-0">
      <td className="px-5 py-3">
        <div>
          <p className="text-sm text-white font-medium leading-tight">{item.name}</p>
          {item.examples.length > 0 && (
            <p className="text-xs text-zinc-600 mt-0.5 truncate max-w-xs">
              {item.examples.slice(0, 3).join(' · ')}
            </p>
          )}
          {item.notes && (
            <p className="text-[10px] text-amber-500/70 mt-0.5">{item.notes}</p>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        {item.is_in_scope ? (
          <select
            value={item.classification_label_id ?? ''}
            onChange={e => item.org_data_type_id && onClassify(item.org_data_type_id, e.target.value)}
            className="bg-zinc-800/80 border border-zinc-700 text-zinc-300 text-xs rounded-lg px-2 py-1 focus:outline-none focus:border-zinc-500 max-w-[160px]"
          >
            <option value="">— Select —</option>
            {labels.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        ) : (
          <span className="text-xs text-zinc-700">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        <button
          onClick={() => onToggle(item.id, item.is_in_scope)}
          className={cn(
            'text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors',
            item.is_in_scope
              ? 'bg-blue-500/15 text-blue-400 border-blue-500/30 hover:bg-blue-500/25'
              : 'bg-zinc-800/50 text-zinc-500 border-zinc-700 hover:bg-zinc-700/50 hover:text-zinc-300',
          )}
        >
          {item.is_in_scope ? 'In scope ✓' : 'Add to scope'}
        </button>
      </td>
    </tr>
  )
}

// ─── Classification section (one per level) ───────────────────────────────────

function ClassificationSection({
  level,
  items,
  labels,
  onToggle,
  onClassify,
}: {
  level: SystemLevel
  items: EnrichedCatalogType[]
  labels: OrgClassificationLabel[]
  onToggle: (id: string, inScope: boolean) => void
  onClassify: (orgDataTypeId: string, labelId: string) => void
}) {
  const [collapsed, setCollapsed] = useState(false)
  const meta   = SYSTEM_LEVEL_META[level]
  const cc     = colorClasses(meta.color)
  const inScope = items.filter(i => i.is_in_scope).length

  if (items.length === 0) return null

  const subcats = [...new Set(items.map(i => i.subcategory ?? 'Other'))]

  return (
    <div className="rounded-xl border border-zinc-800 overflow-hidden">
      <button
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center gap-3 px-5 py-4 bg-zinc-900/60 hover:bg-zinc-900/80 transition-colors text-left"
      >
        <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', cc.dot)} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <span className={cn('text-sm font-bold tracking-wide', cc.text)}>{meta.label.toUpperCase()}</span>
            <span className="text-xs text-zinc-600">Priority {meta.priority}</span>
            <span className="text-xs text-zinc-600">·</span>
            <span className="text-xs text-zinc-600">{items.length} types</span>
            {inScope > 0 && (
              <>
                <span className="text-xs text-zinc-600">·</span>
                <span className={cn('text-xs font-medium', cc.text)}>{inScope} in scope</span>
              </>
            )}
          </div>
          <p className="text-xs text-zinc-600 mt-0.5 truncate">{meta.tagline}</p>
        </div>
        {collapsed
          ? <ChevronRight className="w-4 h-4 text-zinc-600 shrink-0" />
          : <ChevronDown className="w-4 h-4 text-zinc-600 shrink-0" />}
      </button>

      {!collapsed && (
        <div className="divide-y divide-zinc-800/40">
          {subcats.map(subcat => {
            const subcatItems = items.filter(i => (i.subcategory ?? 'Other') === subcat)
            return (
              <div key={subcat}>
                <div className="px-5 py-2 bg-zinc-950/40">
                  <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">{subcat}</p>
                </div>
                <table className="w-full text-sm">
                  <tbody>
                    {subcatItems.map(item => (
                      <DataTypeRow key={item.id} item={item} labels={labels} onToggle={onToggle} onClassify={onClassify} />
                    ))}
                  </tbody>
                </table>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function CatalogClient({
  catalog,
  customTypes,
  labels,
}: {
  catalog:     EnrichedCatalogType[]
  customTypes: CustomType[]
  labels:      OrgClassificationLabel[]
}) {
  const [search,      setSearch]      = useState('')
  const [levelFilter, setLevelFilter] = useState<string>('all')
  const [scopeFilter, setScopeFilter] = useState<string>('all')
  const [showAddModal,setShowAddModal]= useState(false)
  const [isPending,   startTransition]= useTransition()

  const [optimisticCatalog, setOptimisticCatalog] = useOptimistic(
    catalog,
    (state, { id, inScope }: { id: string; inScope: boolean }) =>
      state.map(item => item.id === id ? { ...item, is_in_scope: inScope, org_data_type_id: inScope ? item.org_data_type_id ?? 'pending' : null } : item)
  )

  function handleToggle(catalogId: string, currentlyInScope: boolean) {
    const item = catalog.find(c => c.id === catalogId)
    if (!item) return
    setOptimisticCatalog({ id: catalogId, inScope: !currentlyInScope })
    startTransition(async () => {
      await toggleInScope(catalogId, currentlyInScope, item.system_level)
    })
  }

  function handleClassify(orgDataTypeId: string, labelId: string) {
    startTransition(async () => {
      await setClassification(orgDataTypeId, labelId)
    })
  }

  const levels: SystemLevel[] = ['secret', 'highly_confidential', 'confidential', 'internal', 'public']

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return optimisticCatalog.filter(item => {
      if (levelFilter !== 'all' && item.system_level !== levelFilter) return false
      if (scopeFilter === 'in_scope' && !item.is_in_scope) return false
      if (scopeFilter === 'not_selected' && item.is_in_scope) return false
      if (q) {
        return item.name.toLowerCase().includes(q)
          || item.subcategory?.toLowerCase().includes(q)
          || item.examples.some(e => e.toLowerCase().includes(q))
      }
      return true
    })
  }, [optimisticCatalog, search, levelFilter, scopeFilter])

  const totalInScope = optimisticCatalog.filter(i => i.is_in_scope).length + customTypes.length

  return (
    <div className="space-y-5">
      {showAddModal && <AddCustomModal labels={labels} onClose={() => setShowAddModal(false)} />}

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-zinc-600 mb-2">
            <span>Policies</span><span>›</span><span className="text-zinc-400">Data Catalog</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">Data Catalog</h1>
          <p className="text-zinc-500 text-sm">Browse system data types and mark what applies to your organisation.</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg transition-colors shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          Add custom type
        </button>
      </div>

      {/* Rules panel */}
      <RulesPanel />

      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search data types, examples…"
            className="w-full bg-zinc-800/60 border border-zinc-700 rounded-lg pl-8 pr-8 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        <div className="relative">
          <select value={levelFilter} onChange={e => setLevelFilter(e.target.value)}
            className="appearance-none bg-zinc-800/60 border border-zinc-700 rounded-lg pl-3 pr-7 py-2 text-xs text-zinc-300 focus:outline-none cursor-pointer">
            <option value="all">All levels</option>
            {levels.map(l => <option key={l} value={l}>{SYSTEM_LEVEL_META[l].label}</option>)}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-500 pointer-events-none" />
        </div>

        <div className="relative">
          <select value={scopeFilter} onChange={e => setScopeFilter(e.target.value)}
            className="appearance-none bg-zinc-800/60 border border-zinc-700 rounded-lg pl-3 pr-7 py-2 text-xs text-zinc-300 focus:outline-none cursor-pointer">
            <option value="all">All types</option>
            <option value="in_scope">In scope</option>
            <option value="not_selected">Not selected</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-500 pointer-events-none" />
        </div>

        <div className="ml-auto flex items-center gap-3 text-xs text-zinc-500">
          <span>{filtered.length} of {optimisticCatalog.length} types</span>
          <span className="text-zinc-700">·</span>
          <span className="text-blue-400 font-medium">{totalInScope} in scope</span>
        </div>
      </div>

      {/* Classification level sections */}
      <div className="space-y-3">
        {levels.map(level => (
          <ClassificationSection
            key={level}
            level={level}
            items={filtered.filter(i => i.system_level === level)}
            labels={labels}
            onToggle={handleToggle}
            onClassify={handleClassify}
          />
        ))}

        {/* Custom types */}
        {customTypes.length > 0 && (
          <div className="rounded-xl border border-zinc-800 overflow-hidden">
            <div className="px-5 py-3 bg-zinc-900/60 border-b border-zinc-800">
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">Your custom data types</p>
            </div>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-zinc-800/40">
                {customTypes.map(t => (
                  <tr key={t.id} className="hover:bg-zinc-900/30 transition-colors">
                    <td className="px-5 py-3">
                      <p className="text-sm text-white font-medium">{t.name}</p>
                      {t.examples.length > 0 && (
                        <p className="text-xs text-zinc-600 mt-0.5">{t.examples.slice(0, 3).join(' · ')}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={t.classification_label_id ?? ''}
                        onChange={e => handleClassify(t.org_data_type_id, e.target.value)}
                        className="bg-zinc-800/80 border border-zinc-700 text-zinc-300 text-xs rounded-lg px-2 py-1 focus:outline-none"
                      >
                        <option value="">— Select —</option>
                        {labels.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-xs text-zinc-600 bg-zinc-800 px-2 py-0.5 rounded">Custom</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 text-zinc-600 text-sm">
          No data types match your filters.
        </div>
      )}
    </div>
  )
}
