'use client'

import {
  useState, useMemo, useTransition, useOptimistic, useEffect, useRef,
} from 'react'
import { cn } from '@/lib/utils'
import {
  Search, X, Plus, ChevronDown, ChevronRight, Check, Pencil, Trash2,
} from 'lucide-react'
import {
  toggleDestinationInScope,
  updateDestinationProfile,
  addCustomDestination,
  deleteCustomDestination,
  searchApps,
} from '../actions'
import type { EnrichedDestination, CustomDestination, TrustTag, RiskLevel } from '../actions'
import { FilterSelect, MultiFilterSelect } from '@/components/ui/filter-select'

// ─── Trust tag metadata ────────────────────────────────────────────────────────

const TRUST_TAGS: Record<TrustTag, {
  label:   string
  tagline: string
  dot:     string
  text:    string
  bg:      string
  border:  string
}> = {
  enterprise_approved: {
    label:   'Approved & Supported',
    tagline: 'Fully managed and approved for corporate use. Covered by your DLP policies and access controls.',
    dot:     'bg-emerald-400', text: 'text-emerald-400',
    bg:      'bg-emerald-500/10', border: 'border-emerald-500/25',
  },
  approved_with_conditions: {
    label:   'Approved with Conditions',
    tagline: 'Permitted with specific controls in place. Review acceptable use policy before sharing sensitive data.',
    dot:     'bg-blue-400', text: 'text-blue-400',
    bg:      'bg-blue-500/10', border: 'border-blue-500/25',
  },
  permitted_with_restriction: {
    label:   'Restricted / Unassessed',
    tagline: 'Allowed for specific low-risk use cases only. Confidential data and above must be blocked.',
    dot:     'bg-amber-400', text: 'text-amber-400',
    bg:      'bg-amber-500/10', border: 'border-amber-500/25',
  },
  personal: {
    label:   'Personal',
    tagline: 'Personal consumer accounts not managed by the organisation. Monitor for corporate data transfers.',
    dot:     'bg-violet-400', text: 'text-violet-400',
    bg:      'bg-violet-500/10', border: 'border-violet-500/25',
  },
  public: {
    label:   'Public',
    tagline: 'Approved public-facing channels. Only public-classified content should reach these destinations.',
    dot:     'bg-sky-400', text: 'text-sky-400',
    bg:      'bg-sky-500/10', border: 'border-sky-500/25',
  },
  unknown: {
    label:   'Unknown',
    tagline: 'Not yet assessed. Treat as untrusted until a security review is completed.',
    dot:     'bg-accent', text: 'text-muted-foreground',
    bg:      'bg-accent/30', border: 'border-border-strong',
  },
  prohibited: {
    label:   'Prohibited',
    tagline: 'Blocked for all corporate data. DLP policies must prevent any data movement to these destinations.',
    dot:     'bg-red-400', text: 'text-red-400',
    bg:      'bg-red-500/10', border: 'border-red-500/25',
  },
}

const TRUST_TAG_ORDER: TrustTag[] = [
  'enterprise_approved', 'approved_with_conditions', 'permitted_with_restriction',
  'personal', 'public', 'unknown', 'prohibited',
]

// ─── Risk level metadata ───────────────────────────────────────────────────────

const RISK_META: Record<RiskLevel, { label: string; text: string; bg: string }> = {
  critical: { label: 'CRITICAL', text: 'text-red-400',    bg: 'bg-red-500/15' },
  high:     { label: 'HIGH',     text: 'text-orange-400', bg: 'bg-orange-500/15' },
  medium:   { label: 'MEDIUM',   text: 'text-amber-400',  bg: 'bg-amber-500/15' },
  low:      { label: 'LOW',      text: 'text-green-400',  bg: 'bg-green-500/15' },
}

const RISK_LEVEL_ORDER: RiskLevel[] = ['critical', 'high', 'medium', 'low']

// ─── App search input ─────────────────────────────────────────────────────────

function AppSearchInput({
  selected,
  onChange,
}: {
  selected: string[]
  onChange: (apps: string[]) => void
}) {
  const [query, setQuery]     = useState('')
  const [results, setResults] = useState<string[]>([])
  const [open, setOpen]       = useState(false)
  const containerRef          = useRef<HTMLDivElement>(null)
  const timerRef              = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (query.length < 2) { setResults([]); setOpen(false); return }
    timerRef.current = setTimeout(async () => {
      const apps = await searchApps(query)
      setResults(apps)
      setOpen(apps.length > 0)
    }, 250)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [query])

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  function add(app: string) {
    if (!selected.includes(app)) onChange([...selected, app])
    setQuery(''); setResults([]); setOpen(false)
  }

  function addCustom() {
    if (query.trim() && !selected.includes(query.trim())) onChange([...selected, query.trim()])
    setQuery(''); setResults([]); setOpen(false)
  }

  return (
    <div className="space-y-2">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map(app => (
            <span key={app} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-muted border border-border-strong text-xs text-foreground/70">
              {app}
              <button type="button" onClick={() => onChange(selected.filter(a => a !== app))} className="text-muted-foreground/80 hover:text-foreground/70 transition-colors ml-0.5">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div ref={containerRef} className="relative">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/60 border border-border-strong focus-within:border-border-strong transition-colors">
          <Search className="w-3.5 h-3.5 text-muted-foreground/80 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustom() } }}
            placeholder="Search apps or type to add custom…"
            className="flex-1 bg-transparent text-sm text-foreground/70 placeholder:text-muted-foreground/50 outline-none"
          />
        </div>
        {open && (
          <div className="absolute z-50 top-full mt-1 w-full rounded-lg bg-card border border-border-strong shadow-xl overflow-hidden">
            <div className="max-h-48 overflow-y-auto">
              {results.map(app => (
                <button key={app} type="button" onClick={() => add(app)}
                  className={cn('w-full text-left px-3 py-2 text-sm transition-colors',
                    selected.includes(app) ? 'text-muted-foreground/60 cursor-default' : 'text-foreground/70 hover:bg-muted')}>
                  <span className="flex items-center justify-between">
                    {app}
                    {selected.includes(app) && <Check className="w-3.5 h-3.5 text-muted-foreground/60" />}
                  </span>
                </button>
              ))}
            </div>
            {query.trim() && !selected.includes(query.trim()) && (
              <button type="button" onClick={addCustom}
                className="w-full text-left px-3 py-2 text-sm text-blue-400 hover:bg-muted border-t border-border transition-colors flex items-center gap-2">
                <Plus className="w-3.5 h-3.5" />
                Add &quot;{query.trim()}&quot; as custom app
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Catalog row ───────────────────────────────────────────────────────────────

function CatalogRow({
  item,
  onToggle,
  onUpdate,
}: {
  item:     EnrichedDestination
  onToggle: (id: string, name: string, tag: TrustTag, sub: string, inScope: boolean) => void
  onUpdate: (id: string, fields: Partial<{ name: string; applications: string[]; notes: string | null; definition: string | null }>) => void
}) {
  const [expanded, setExpanded]     = useState(false)
  const [editingName, setEditName]  = useState(false)
  const [draftName, setDraftName]   = useState(item.name)
  const [apps, setApps]             = useState<string[]>(item.applications)
  const [notes, setNotes]           = useState(item.notes ?? '')
  const [definition, setDefinition] = useState(item.definition ?? '')
  const [saving, setSaving]         = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setDraftName(item.name) }, [item.name])
  useEffect(() => { setApps(item.applications) }, [item.applications])
  useEffect(() => { setNotes(item.notes ?? '') }, [item.notes])
  useEffect(() => { setDefinition(item.definition ?? '') }, [item.definition])
  useEffect(() => { if (editingName) nameRef.current?.focus() }, [editingName])

  async function saveName() {
    setEditName(false)
    if (!item.org_profile_id || (item as OptEnriched)._pending || draftName.trim() === item.name) return
    setSaving(true)
    await onUpdate(item.org_profile_id, { name: draftName.trim() })
    setSaving(false)
  }

  async function saveApps(newApps: string[]) {
    setApps(newApps)
    if (!item.org_profile_id || (item as OptEnriched)._pending) return
    await onUpdate(item.org_profile_id, { applications: newApps })
  }

  async function saveNotes() {
    if (!item.org_profile_id || (item as OptEnriched)._pending) return
    await onUpdate(item.org_profile_id, { notes: notes.trim() || null })
  }

  async function saveDefinition() {
    if (!item.org_profile_id || (item as OptEnriched)._pending) return
    await onUpdate(item.org_profile_id, { definition: definition.trim() || null })
  }

  const meta = TRUST_TAGS[item.trust_tag]

  return (
    <div className={cn('border-b border-border/50 last:border-0', !item.is_in_scope && 'opacity-50')}>
      <div
        className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors cursor-pointer"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="shrink-0 text-muted-foreground/60">
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn('text-sm font-medium', item.is_in_scope ? 'text-foreground' : 'text-muted-foreground/80')}>{item.name}</span>
            {(() => {
              const rm = RISK_META[item.risk_level]
              return (
                <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded', rm.text, rm.bg)}>
                  {rm.label}
                </span>
              )
            })()}
            {saving && <span className="text-xs text-muted-foreground/60">saving…</span>}
          </div>
          {item.description && (
            <p className="text-xs text-muted-foreground/60 truncate mt-0.5 pr-4">{item.description}</p>
          )}
        </div>
        <div
          className="shrink-0"
          onClick={e => {
            e.stopPropagation()
            onToggle(item.catalog_id, item.name, item.trust_tag, item.subcategory, item.is_in_scope)
          }}
        >
          <span className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all cursor-pointer select-none',
            item.is_in_scope
              ? `${meta.bg} ${meta.text} ${meta.border}`
              : 'bg-muted/50 text-muted-foreground/60 border-border-strong hover:border-border-strong',
          )}>
            <span className={cn('w-1.5 h-1.5 rounded-full', item.is_in_scope ? meta.dot : 'bg-accent')} />
            {item.is_in_scope ? 'In Scope' : 'Toggle In'}
          </span>
        </div>
      </div>

      {expanded && (
        <div className="px-11 pb-4 space-y-4">
          {item.description && (
            <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
          )}
          {item.examples.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground/80 uppercase tracking-wider mb-1.5">Example URLs</p>
              <div className="flex flex-wrap gap-1.5">
                {item.examples.map(ex => (
                  <span key={ex} className="px-2 py-0.5 rounded bg-muted border border-border-strong text-xs text-muted-foreground font-mono">{ex}</span>
                ))}
              </div>
            </div>
          )}
          {item.is_in_scope && (
            <div>
              <p className="text-xs font-medium text-muted-foreground/80 uppercase tracking-wider mb-1.5">Display Name</p>
              {editingName ? (
                <input
                  ref={nameRef}
                  type="text"
                  value={draftName}
                  onChange={e => setDraftName(e.target.value)}
                  onBlur={saveName}
                  onKeyDown={e => {
                    if (e.key === 'Enter') saveName()
                    if (e.key === 'Escape') { setEditName(false); setDraftName(item.name) }
                  }}
                  className="px-3 py-1.5 rounded-lg bg-muted border border-border-strong text-sm text-foreground outline-none focus:border-border-strong w-64 transition-colors"
                />
              ) : (
                <button type="button" onClick={() => setEditName(true)}
                  className="flex items-center gap-2 text-sm text-foreground/70 hover:text-foreground transition-colors group">
                  {item.name}
                  <Pencil className="w-3 h-3 text-muted-foreground/60 group-hover:text-muted-foreground transition-colors" />
                </button>
              )}
            </div>
          )}
          {item.is_in_scope && (
            <div>
              <p className="text-xs font-medium text-muted-foreground/80 uppercase tracking-wider mb-1.5">
                Applications <span className="text-muted-foreground/40 normal-case font-normal">— specify which apps use this destination</span>
              </p>
              <AppSearchInput selected={apps} onChange={saveApps} />
            </div>
          )}
          {!item.is_in_scope && apps.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground/80 uppercase tracking-wider mb-1.5">Applications</p>
              <div className="flex flex-wrap gap-1.5">
                {apps.map(a => (
                  <span key={a} className="px-2 py-0.5 rounded-lg bg-muted border border-border-strong text-xs text-muted-foreground">{a}</span>
                ))}
              </div>
            </div>
          )}
          {item.is_in_scope && (
            <div>
              <p className="text-xs font-medium text-muted-foreground/80 uppercase tracking-wider mb-1.5">Notes</p>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                onBlur={saveNotes}
                placeholder="Add context, conditions, or restrictions for this destination…"
                rows={2}
                className="w-full px-3 py-2 rounded-lg bg-muted/60 border border-border-strong text-sm text-foreground/70 placeholder:text-muted-foreground/50 outline-none focus:border-border-strong resize-none transition-colors"
              />
            </div>
          )}
          {item.is_in_scope && (
            <div>
              <p className="text-xs font-medium text-muted-foreground/80 uppercase tracking-wider mb-1.5">
                Definition
                <span className="text-muted-foreground/40 normal-case font-normal ml-1">— URLs, domains, IPs, RANGE: or CIDR: separated by newlines</span>
              </p>
              <textarea
                value={definition}
                onChange={e => setDefinition(e.target.value)}
                onBlur={saveDefinition}
                placeholder={"www.example.com\n*.example.com\nRANGE:1.1.1.1-1.1.1.10\nCIDR:1.1.1.0/24"}
                rows={4}
                className="w-full px-3 py-2 rounded-lg bg-muted/60 border border-border-strong text-sm text-foreground/70 placeholder:text-muted-foreground/50 outline-none focus:border-border-strong resize-none transition-colors font-mono"
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Custom row ────────────────────────────────────────────────────────────────

function CustomRow({
  item,
  onDelete,
  onUpdate,
}: {
  item:     CustomDestination
  onDelete: (id: string) => void
  onUpdate: (id: string, fields: Partial<{ name: string; applications: string[]; notes: string | null; definition: string | null }>) => void
}) {
  const [expanded, setExpanded]     = useState(false)
  const [confirmDelete, setConfirm] = useState(false)
  const [apps, setApps]             = useState<string[]>(item.applications)
  const [notes, setNotes]           = useState(item.notes ?? '')
  const [definition, setDefinition] = useState(item.definition ?? '')

  useEffect(() => { setApps(item.applications) }, [item.applications])
  useEffect(() => { setNotes(item.notes ?? '') }, [item.notes])
  useEffect(() => { setDefinition(item.definition ?? '') }, [item.definition])

  async function saveApps(newApps: string[]) {
    setApps(newApps)
    await onUpdate(item.org_profile_id, { applications: newApps })
  }

  async function saveNotes() {
    await onUpdate(item.org_profile_id, { notes: notes.trim() || null })
  }

  async function saveDefinition() {
    await onUpdate(item.org_profile_id, { definition: definition.trim() || null })
  }

  const meta = TRUST_TAGS[item.trust_tag]

  return (
    <div className="border-b border-border/50 last:border-0">
      <div
        className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors cursor-pointer"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="shrink-0 text-muted-foreground/60">
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">{item.name}</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-accent/60 text-muted-foreground/80 border border-border-strong">custom</span>
          </div>
          {item.subcategory && item.subcategory !== 'custom' && (
            <p className="text-xs text-muted-foreground/60 mt-0.5">{item.subcategory.replace(/_/g, ' ')}</p>
          )}
        </div>
        <span className={cn('shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border', meta.bg, meta.text, meta.border)}>
          <span className={cn('w-1.5 h-1.5 rounded-full', meta.dot)} />
          {meta.label}
        </span>
        <div className="shrink-0" onClick={e => e.stopPropagation()}>
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <button onClick={() => setConfirm(false)} className="text-xs text-muted-foreground/80 hover:text-foreground/70 transition-colors">Cancel</button>
              <button onClick={() => onDelete(item.org_profile_id)} className="text-xs text-red-400 hover:text-red-300 transition-colors">Delete</button>
            </div>
          ) : (
            <button onClick={() => setConfirm(true)} className="p-1 rounded text-muted-foreground/60 hover:text-red-400 hover:bg-red-500/10 transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="px-11 pb-4 space-y-4">
          <div>
            <p className="text-xs font-medium text-muted-foreground/80 uppercase tracking-wider mb-1.5">Applications</p>
            <AppSearchInput selected={apps} onChange={saveApps} />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground/80 uppercase tracking-wider mb-1.5">Notes</p>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              onBlur={saveNotes}
              placeholder="Add context or restrictions for this destination…"
              rows={2}
              className="w-full px-3 py-2 rounded-lg bg-muted/60 border border-border-strong text-sm text-foreground/70 placeholder:text-muted-foreground/50 outline-none focus:border-border-strong resize-none transition-colors"
            />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground/80 uppercase tracking-wider mb-1.5">
              Definition
              <span className="text-muted-foreground/40 normal-case font-normal ml-1">— URLs, domains, IPs, RANGE: or CIDR: separated by newlines</span>
            </p>
            <textarea
              value={definition}
              onChange={e => setDefinition(e.target.value)}
              onBlur={saveDefinition}
              placeholder={"www.example.com\n*.example.com\nRANGE:1.1.1.1-1.1.1.10\nCIDR:1.1.1.0/24"}
              rows={4}
              className="w-full px-3 py-2 rounded-lg bg-muted/60 border border-border-strong text-sm text-foreground/70 placeholder:text-muted-foreground/50 outline-none focus:border-border-strong resize-none transition-colors font-mono"
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Add Custom Modal ─────────────────────────────────────────────────────────

function AddCustomModal({
  defaultTrustTag,
  onClose,
  onAdd,
}: {
  defaultTrustTag: TrustTag
  onClose: () => void
  onAdd:   (fields: { name: string; subcategory: string; trust_tag: TrustTag; applications: string[]; notes: string; definition: string }) => Promise<void>
}) {
  const [name, setName]         = useState('')
  const [subcategory, setSub]   = useState('')
  const [trustTag, setTrustTag] = useState<TrustTag>(defaultTrustTag)
  const [apps, setApps]         = useState<string[]>([])
  const [notes, setNotes]       = useState('')
  const [definition, setDef]    = useState('')
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Name is required.'); return }
    setSaving(true)
    await onAdd({ name, subcategory, trust_tag: trustTag, applications: apps, notes, definition })
    setSaving(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl bg-card border border-border shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">Add Custom Destination</h2>
          <button onClick={onClose} className="text-muted-foreground/80 hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Trust Tag</label>
            <div className="flex flex-wrap gap-1.5">
              {TRUST_TAG_ORDER.map(tag => {
                const m = TRUST_TAGS[tag]
                return (
                  <button key={tag} type="button" onClick={() => setTrustTag(tag)}
                    className={cn(
                      'px-2.5 py-1 rounded-full text-xs font-medium border transition-all',
                      trustTag === tag ? `${m.bg} ${m.text} ${m.border}` : 'bg-muted text-muted-foreground/80 border-border-strong hover:border-border-strong',
                    )}>
                    {m.label}
                  </button>
                )
              })}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">Name *</label>
            <input type="text" value={name} onChange={e => { setName(e.target.value); setError('') }}
              placeholder="e.g. Internal Wiki, Customer Portal"
              className="w-full px-3 py-2 rounded-lg bg-muted border border-border-strong text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-border-strong transition-colors" />
            {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">Category</label>
            <input type="text" value={subcategory} onChange={e => setSub(e.target.value)}
              placeholder="e.g. cloud_storage, ai_tools, collaboration"
              className="w-full px-3 py-2 rounded-lg bg-muted border border-border-strong text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-border-strong transition-colors" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">Applications</label>
            <AppSearchInput selected={apps} onChange={setApps} />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Context, conditions, or restrictions…" rows={2}
              className="w-full px-3 py-2 rounded-lg bg-muted border border-border-strong text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-border-strong resize-none transition-colors" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">
              Definition
              <span className="text-muted-foreground/60 normal-case font-normal ml-1">— URLs, domains, IPs, RANGE: or CIDR: per line</span>
            </label>
            <textarea value={definition} onChange={e => setDef(e.target.value)}
              placeholder={"www.example.com\n*.example.com\nRANGE:1.1.1.1-1.1.1.10\nCIDR:1.1.1.0/24"}
              rows={4}
              className="w-full px-3 py-2 rounded-lg bg-muted border border-border-strong text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-border-strong resize-none transition-colors font-mono" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-50">
              {saving ? 'Adding…' : 'Add Destination'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Trust-tag section ────────────────────────────────────────────────────────

function TrustTagSection({
  tag, items, customItems, onToggle, onUpdate, onDeleteCustom, onAddCustom,
}: {
  tag:            TrustTag
  items:          EnrichedDestination[]
  customItems:    CustomDestination[]
  onToggle:       (id: string, name: string, tag: TrustTag, sub: string, inScope: boolean) => void
  onUpdate:       (id: string, fields: Partial<{ name: string; applications: string[]; notes: string | null; definition: string | null }>) => void
  onDeleteCustom: (id: string) => void
  onAddCustom:    (tag: TrustTag) => void
}) {
  // Layer 1: collapsed by default
  const [collapsed, setCollapsed] = useState(true)
  const meta = TRUST_TAGS[tag]
  const inScopeCount = items.filter(i => i.is_in_scope).length + customItems.length

  const bySubcategory = useMemo(() => {
    const map = new Map<string, EnrichedDestination[]>()
    for (const item of items) {
      if (!map.has(item.subcategory)) map.set(item.subcategory, [])
      map.get(item.subcategory)!.push(item)
    }
    return map
  }, [items])

  if (items.length === 0 && customItems.length === 0) return null

  return (
    <div className={cn('rounded-xl border overflow-hidden', meta.border, meta.bg)}>
      {/* Layer 1 header */}
      <button
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-muted/20 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className={cn('w-2 h-2 rounded-full shrink-0', meta.dot)} />
          <span className={cn('text-sm font-semibold', meta.text)}>{meta.label}</span>
          <span className="text-xs text-muted-foreground/60 hidden sm:block">{meta.tagline}</span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs text-muted-foreground/80">
            {inScopeCount} / {items.length + customItems.length} in scope
          </span>
          {collapsed
            ? <ChevronRight className="w-4 h-4 text-muted-foreground/80" />
            : <ChevronDown className="w-4 h-4 text-muted-foreground/80" />}
        </div>
      </button>

      {!collapsed && (
        <div className="border-t border-border/60">
          {/* Layer 2: subcategory groups, each collapsed by default */}
          {[...bySubcategory.entries()].map(([sub, subItems]) => (
            <SubcategoryGroup
              key={sub}
              sub={sub}
              subItems={subItems}
              onToggle={onToggle}
              onUpdate={onUpdate}
            />
          ))}
          {customItems.length > 0 && (
            <SubcategoryGroup
              sub="custom"
              subItems={[]}
              customItems={customItems}
              onToggle={onToggle}
              onUpdate={onUpdate}
              onDeleteCustom={onDeleteCustom}
            />
          )}
          <div className="px-5 py-3 border-t border-border/40">
            <button
              onClick={() => onAddCustom(tag)}
              className={cn('flex items-center gap-1.5 text-xs transition-colors opacity-70 hover:opacity-100', meta.text)}
            >
              <Plus className="w-3.5 h-3.5" />
              Add custom {meta.label.toLowerCase()} destination
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Layer 2: collapsible subcategory group ───────────────────────────────────

function SubcategoryGroup({
  sub,
  subItems,
  customItems = [],
  onToggle,
  onUpdate,
  onDeleteCustom,
}: {
  sub:             string
  subItems:        EnrichedDestination[]
  customItems?:    CustomDestination[]
  onToggle:        (id: string, name: string, tag: TrustTag, sub: string, inScope: boolean) => void
  onUpdate:        (id: string, fields: Partial<{ name: string; applications: string[]; notes: string | null; definition: string | null }>) => void
  onDeleteCustom?: (id: string) => void
}) {
  const [collapsed, setCollapsed] = useState(true)
  const inScopeItems    = subItems.filter(i => i.is_in_scope)
  const outOfScopeItems = subItems.filter(i => !i.is_in_scope)
  const inScopeCount    = inScopeItems.length + customItems.length
  const totalCount      = subItems.length + customItems.length

  function addAll(e: React.MouseEvent) {
    e.stopPropagation()
    outOfScopeItems.forEach(item =>
      onToggle(item.catalog_id, item.name, item.trust_tag, item.subcategory, false)
    )
  }

  function removeAll(e: React.MouseEvent) {
    e.stopPropagation()
    inScopeItems.forEach(item =>
      onToggle(item.catalog_id, item.name, item.trust_tag, item.subcategory, true)
    )
  }

  return (
    <div className="border-b border-border/40 last:border-0">
      {/* Layer 2 header — div not button, so we can nest buttons */}
      <div
        className="flex items-center justify-between px-4 py-2.5 bg-card/40 hover:bg-card/60 transition-colors cursor-pointer"
        onClick={() => setCollapsed(c => !c)}
      >
        {/* Left: chevron + name */}
        <div className="flex items-center gap-2 min-w-0">
          {collapsed
            ? <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
            : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />}
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider truncate">
            {sub.replace(/_/g, ' ')}
          </span>
        </div>

        {/* Right: count + Add all / Remove all */}
        <div className="flex items-center gap-3 shrink-0 ml-4" onClick={e => e.stopPropagation()}>
          <span className="text-xs text-muted-foreground/60">{inScopeCount}/{totalCount} in scope</span>
          {outOfScopeItems.length > 0 && (
            <button
              onClick={addAll}
              className="text-xs text-emerald-500 hover:text-emerald-400 transition-colors font-medium"
            >
              + Add all
            </button>
          )}
          {inScopeItems.length > 0 && (
            <button
              onClick={removeAll}
              className="text-xs text-red-500 hover:text-red-400 transition-colors font-medium"
            >
              − Remove all
            </button>
          )}
        </div>
      </div>

      {/* Layer 3: individual rows */}
      {!collapsed && (
        <div>
          {subItems.map(item => (
            <CatalogRow key={item.catalog_id} item={item} onToggle={onToggle} onUpdate={onUpdate} />
          ))}
          {customItems.map(item => (
            <CustomRow
              key={item.org_profile_id}
              item={item}
              onDelete={onDeleteCustom ?? (() => {})}
              onUpdate={onUpdate}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main client component ─────────────────────────────────────────────────────

type OptEnriched = EnrichedDestination & { _pending?: boolean }
type OptCustom   = CustomDestination   & { _pending?: boolean }

export function DestinationsClient({
  initialEnriched,
  initialCustom,
}: {
  initialEnriched: EnrichedDestination[]
  initialCustom:   CustomDestination[]
}) {
  const [, startTransition] = useTransition()

  type EnrichedAction =
    | { type: 'toggle'; id: string; inScope: boolean }
    | { type: 'update'; profileId: string; fields: Partial<{ name: string; applications: string[]; notes: string | null; definition: string | null }> }

  type CustomAction =
    | { type: 'add'; item: CustomDestination }
    | { type: 'delete'; id: string }
    | { type: 'update'; profileId: string; fields: Partial<{ name: string; applications: string[]; notes: string | null; definition: string | null }> }

  const [enrichedItems, setOptimisticEnriched] = useOptimistic(
    initialEnriched as OptEnriched[],
    (state: OptEnriched[], action: EnrichedAction) => {
      if (action.type === 'toggle') {
        return state.map(e =>
          e.catalog_id === action.id
            ? { ...e, is_in_scope: action.inScope, org_profile_id: null, _pending: action.inScope }
            : e,
        )
      }
      return state.map(e => e.org_profile_id === action.profileId ? { ...e, ...action.fields } : e)
    },
  )

  const [customItems, setOptimisticCustom] = useOptimistic(
    initialCustom as OptCustom[],
    (state: OptCustom[], action: CustomAction) => {
      if (action.type === 'add')    return [...state, { ...action.item, _pending: true }]
      if (action.type === 'delete') return state.filter(c => c.org_profile_id !== action.id)
      return state.map(c => c.org_profile_id === action.profileId ? { ...c, ...action.fields } : c)
    },
  )

  const [search, setSearch]           = useState('')
  const [filterTags, setFilterTags]   = useState<string[]>([])
  const [filterRisk, setFilterRisk]   = useState<string[]>([])
  const [filterSub, setFilterSub]     = useState('')
  const [filterScope, setFilterScope] = useState('')
  const [addModalTag, setAddModalTag] = useState<TrustTag | null>(null)

  const allSubcategories = useMemo(() => {
    const subs = new Set([
      ...initialEnriched.map(e => e.subcategory),
      ...initialCustom.map(c => c.subcategory),
    ])
    return [...subs].sort()
  }, [initialEnriched, initialCustom])

  const filteredEnriched = useMemo(() => enrichedItems.filter(e => {
    if (search && !e.name.toLowerCase().includes(search.toLowerCase())) return false
    if (filterTags.length && !filterTags.includes(e.trust_tag)) return false
    if (filterRisk.length && !filterRisk.includes(e.risk_level)) return false
    if (filterSub && e.subcategory !== filterSub) return false
    if (filterScope === 'in_scope' && !e.is_in_scope) return false
    if (filterScope === 'out_of_scope' && e.is_in_scope) return false
    return true
  }), [enrichedItems, search, filterTags, filterRisk, filterSub, filterScope])

  const filteredCustom = useMemo(() => customItems.filter(c => {
    if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false
    if (filterTags.length && !filterTags.includes(c.trust_tag)) return false
    if (filterSub && c.subcategory !== filterSub) return false
    return true
  }), [customItems, search, filterTags, filterSub])

  const totalCount      = enrichedItems.length + customItems.length
  const inScopeCount    = enrichedItems.filter(e => e.is_in_scope).length + customItems.length
  const enterpriseCount = enrichedItems.filter(e => e.trust_tag === 'enterprise_approved' && e.is_in_scope).length
  const prohibitedCount = enrichedItems.filter(e => e.trust_tag === 'prohibited').length + customItems.filter(c => c.trust_tag === 'prohibited').length

  function handleToggle(catalogId: string, name: string, tag: TrustTag, sub: string, inScope: boolean) {
    startTransition(async () => {
      setOptimisticEnriched({ type: 'toggle', id: catalogId, inScope: !inScope })
      await toggleDestinationInScope(catalogId, name, tag, sub, inScope)
    })
  }

  function handleUpdate(profileId: string, fields: Partial<{ name: string; applications: string[]; notes: string | null; definition: string | null }>) {
    startTransition(async () => {
      setOptimisticEnriched({ type: 'update', profileId, fields })
      setOptimisticCustom({ type: 'update', profileId, fields })
      await updateDestinationProfile(profileId, fields)
    })
  }

  function handleDeleteCustom(id: string) {
    startTransition(async () => {
      setOptimisticCustom({ type: 'delete', id })
      await deleteCustomDestination(id)
    })
  }

  async function handleAddCustom(fields: { name: string; subcategory: string; trust_tag: TrustTag; applications: string[]; notes: string; definition: string }) {
    const tempItem: CustomDestination = {
      org_profile_id: `temp_${Date.now()}`,
      name:           fields.name,
      trust_tag:      fields.trust_tag,
      subcategory:    fields.subcategory || 'custom',
      applications:   fields.applications,
      notes:          fields.notes || null,
      definition:     fields.definition || null,
      is_in_scope:    true,
      is_custom:      true,
      created_at:     new Date().toISOString(),
    }
    startTransition(async () => {
      setOptimisticCustom({ type: 'add', item: tempItem })
      await addCustomDestination(fields)
    })
  }

  function clearFilters() {
    setSearch(''); setFilterTags([]); setFilterRisk([]); setFilterSub(''); setFilterScope('')
  }

  const hasFilters = search || filterTags.length || filterRisk.length || filterSub || filterScope

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Destinations',              value: totalCount,      cls: 'text-foreground' },
          { label: 'In Scope',                        value: inScopeCount,    cls: 'text-emerald-400' },
          { label: 'Approved & Supported (in scope)', value: enterpriseCount, cls: 'text-emerald-400' },
          { label: 'Prohibited',                      value: prohibitedCount, cls: 'text-red-400' },
        ].map(stat => (
          <div key={stat.label} className="rounded-xl bg-card border border-border px-4 py-3 shadow-sm">
            <p className={cn('text-2xl font-bold', stat.cls)}>{stat.value}</p>
            <p className="text-xs text-muted-foreground/80 mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-48 px-3 py-2 rounded-lg bg-card border border-border focus-within:border-border-strong transition-colors">
          <Search className="w-3.5 h-3.5 text-muted-foreground/80 shrink-0" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search destinations…"
            className="flex-1 bg-transparent text-sm text-foreground/70 placeholder:text-muted-foreground/50 outline-none"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-muted-foreground/80 hover:text-foreground/70 transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <MultiFilterSelect
          placeholder="Trust Tag"
          value={filterTags}
          onChange={setFilterTags}
          options={TRUST_TAG_ORDER.map(t => ({ value: t, label: TRUST_TAGS[t].label }))}
        />
        <MultiFilterSelect
          placeholder="Risk Level"
          value={filterRisk}
          onChange={setFilterRisk}
          options={RISK_LEVEL_ORDER.map(r => ({ value: r, label: RISK_META[r].label }))}
        />
        <FilterSelect
          placeholder="Category"
          value={filterSub}
          onChange={setFilterSub}
          options={allSubcategories.map(s => ({ value: s, label: s.replace(/_/g, ' ') }))}
        />
        <FilterSelect
          placeholder="Scope"
          value={filterScope}
          onChange={setFilterScope}
          options={[
            { value: 'in_scope',     label: 'In Scope' },
            { value: 'out_of_scope', label: 'Out of Scope' },
          ]}
        />
        {hasFilters && (
          <button onClick={clearFilters} className="text-xs text-muted-foreground/80 hover:text-foreground/70 transition-colors flex items-center gap-1">
            <X className="w-3 h-3" /> Clear filters
          </button>
        )}
      </div>

      {/* Sections */}
      <div className="space-y-4">
        {TRUST_TAG_ORDER.map(tag => (
          <TrustTagSection
            key={tag}
            tag={tag}
            items={filteredEnriched.filter(e => e.trust_tag === tag)}
            customItems={filteredCustom.filter(c => c.trust_tag === tag)}
            onToggle={handleToggle}
            onUpdate={handleUpdate}
            onDeleteCustom={handleDeleteCustom}
            onAddCustom={t => setAddModalTag(t)}
          />
        ))}
      </div>

      {filteredEnriched.length === 0 && filteredCustom.length === 0 && (
        <div className="text-center py-16 text-muted-foreground/60">
          <p className="text-sm">No destinations match your filters.</p>
          {hasFilters && (
            <button onClick={clearFilters} className="text-xs text-muted-foreground/80 hover:text-foreground/70 mt-2 transition-colors">
              Clear filters
            </button>
          )}
        </div>
      )}

      {addModalTag && (
        <AddCustomModal
          defaultTrustTag={addModalTag}
          onClose={() => setAddModalTag(null)}
          onAdd={handleAddCustom}
        />
      )}
    </div>
  )
}
