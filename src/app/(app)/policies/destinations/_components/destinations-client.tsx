'use client'

import { useState, useMemo, useTransition, useOptimistic } from 'react'
import { cn } from '@/lib/utils'
import { Search, X, Plus, ChevronDown, ChevronRight, Trash2, AlertTriangle } from 'lucide-react'
import { FilterSelect, MultiFilterSelect } from '@/components/ui/filter-select'
import { addDestination, updateDestination, deleteDestination } from '../actions'
import type { OrgDestination, TrustTag, RiskLevel } from '../actions'

// ─── Trust tag config ─────────────────────────────────────────────────────────

const TRUST_TAGS: Record<TrustTag, {
  label:       string
  tagline:     string
  dot:         string
  text:        string
  bg:          string
  border:      string
  riskDefault: RiskLevel
}> = {
  enterprise_approved: {
    label:       'Enterprise Approved',
    tagline:     'Officially approved and governed for enterprise business use.',
    dot:         'bg-green-400',
    text:        'text-green-400',
    bg:          'bg-green-500/10',
    border:      'border-green-500/30',
    riskDefault: 'medium',
  },
  approved_with_conditions: {
    label:       'Approved with Conditions',
    tagline:     'Formally approved, but only under defined conditions or scope.',
    dot:         'bg-blue-400',
    text:        'text-blue-400',
    bg:          'bg-blue-500/10',
    border:      'border-blue-500/30',
    riskDefault: 'medium',
  },
  permitted_with_restriction: {
    label:       'Permitted with Restriction',
    tagline:     'Known and allowed in a limited way — not fully enterprise governed.',
    dot:         'bg-amber-400',
    text:        'text-amber-400',
    bg:          'bg-amber-500/10',
    border:      'border-amber-500/30',
    riskDefault: 'medium',
  },
  personal: {
    label:       'Personal',
    tagline:     'Controlled by an individual user, not the organisation.',
    dot:         'bg-orange-400',
    text:        'text-orange-400',
    bg:          'bg-orange-500/10',
    border:      'border-orange-500/30',
    riskDefault: 'high',
  },
  public: {
    label:       'Public',
    tagline:     'Accessible to anyone or a broad uncontrolled audience.',
    dot:         'bg-red-400',
    text:        'text-red-400',
    bg:          'bg-red-500/10',
    border:      'border-red-500/30',
    riskDefault: 'high',
  },
  unknown: {
    label:       'Unknown',
    tagline:     'Not yet assessed or mapped to a trust category.',
    dot:         'bg-zinc-500',
    text:        'text-zinc-400',
    bg:          'bg-zinc-500/10',
    border:      'border-zinc-500/30',
    riskDefault: 'high',
  },
  prohibited: {
    label:       'Prohibited',
    tagline:     'Explicitly not allowed for business use.',
    dot:         'bg-rose-400',
    text:        'text-rose-400',
    bg:          'bg-rose-500/10',
    border:      'border-rose-500/30',
    riskDefault: 'critical',
  },
}

const TRUST_TAG_ORDER: TrustTag[] = [
  'enterprise_approved',
  'approved_with_conditions',
  'permitted_with_restriction',
  'personal',
  'public',
  'unknown',
  'prohibited',
]

// ─── Destination types per trust tag (from taxonomy doc) ─────────────────────

const DESTINATION_TYPES: Record<TrustTag, string[]> = {
  enterprise_approved: [
    'Corporate Email Domain', 'Corporate SaaS Application', 'Corporate Cloud Storage',
    'Corporate Collaboration Platform', 'Corporate Repository', 'Enterprise HR System',
    'Enterprise Finance System', 'Enterprise CRM', 'Enterprise ITSM Platform',
    'Enterprise BI Platform', 'Enterprise Data Warehouse', 'Enterprise Secure Transfer Platform',
    'Enterprise AI Platform', 'Enterprise Cloud Platform', 'Enterprise Security Platform',
  ],
  approved_with_conditions: [
    'Approved Customer Domain', 'Approved Vendor Domain', 'Approved Partner Workspace',
    'Approved Regulator Destination', 'Approved Legal Counsel', 'Approved Payment Processor',
    'Approved Payroll Vendor', 'Approved Support Portal', 'Restricted Enterprise AI',
    'Restricted Vendor Portal', 'Restricted Customer Portal', 'Restricted Collaboration Workspace',
    'Restricted Secure Transfer', 'Restricted Developer Platform', 'Restricted Regional Platform',
    'Restricted Data Processing Platform',
  ],
  permitted_with_restriction: [
    'Department-Level Tool', 'Trial or Pilot SaaS Application', 'Temporary Vendor Portal',
    'Transitional Platform', 'Regional Business Tool', 'Low-Risk Collaboration Tool',
    'Business-Accepted SaaS', 'Local Business Application', 'Temporary File Exchange Location',
    'Pilot AI Tool', 'Legacy Business Tool',
  ],
  personal: [
    'Personal Email', 'Personal Cloud Storage', 'Personal SaaS Account',
    'Personal Repository', 'Personal Messaging App', 'Personal Device Storage',
    'Personal AI Account', 'Personal File Transfer', 'Personal Collaboration Workspace',
    'Personal Developer Tool',
  ],
  public: [
    'Public Website', 'Public Link', 'Public Repository', 'Public Forum',
    'Social Media', 'Public Cloud Bucket', 'Anonymous File Share',
    'Public Paste Site', 'Public AI Output', 'Public Package Registry',
    'Public Document Portal',
  ],
  unknown: [
    'Unknown Web Domain', 'Unknown SaaS Application', 'Unknown External Domain',
    'Unknown Internal Destination', 'Unknown API Endpoint', 'Unknown IP or Host',
    'Unknown File Transfer Destination', 'Unknown AI Tool', 'Unknown Repository Destination',
    'Unknown Support or Business Portal', 'Unknown Collaboration Workspace',
  ],
  prohibited: [
    'Blocklisted SaaS Application', 'Prohibited AI Tool', 'Prohibited File Transfer Site',
    'Prohibited Cloud Storage', 'Prohibited Domain', 'Prohibited Country or Region',
    'Malware or Phishing Destination', 'Anonymous Sharing Site', 'Prohibited Repository',
    'Prohibited Integration Endpoint', 'Prohibited Messaging Platform',
    'Prohibited Public Posting Platform',
  ],
}

const RISK_LEVELS: Record<RiskLevel, { label: string; className: string }> = {
  low:      { label: 'Low',      className: 'text-green-400 bg-green-500/10 border-green-500/25'  },
  medium:   { label: 'Medium',   className: 'text-amber-400 bg-amber-500/10 border-amber-500/25'  },
  high:     { label: 'High',     className: 'text-orange-400 bg-orange-500/10 border-orange-500/25' },
  critical: { label: 'Critical', className: 'text-rose-400 bg-rose-500/10 border-rose-500/25'    },
}

// ─── Add Destination modal ────────────────────────────────────────────────────

function AddDestinationModal({
  onClose,
  onAdd,
}: {
  onClose: () => void
  onAdd:   (d: OrgDestination) => void
}) {
  const [tag,        setTag]        = useState<TrustTag>('enterprise_approved')
  const [name,       setName]       = useState('')
  const [destType,   setDestType]   = useState(DESTINATION_TYPES.enterprise_approved[0])
  const [riskLevel,  setRiskLevel]  = useState<RiskLevel>(TRUST_TAGS.enterprise_approved.riskDefault)
  const [riskNotes,  setRiskNotes]  = useState('')
  const [notes,      setNotes]      = useState('')
  const [error,      setError]      = useState<string | null>(null)
  const [isPending,  startTransition] = useTransition()

  function handleTagChange(t: TrustTag) {
    setTag(t)
    setDestType(DESTINATION_TYPES[t][0])
    setRiskLevel(TRUST_TAGS[t].riskDefault)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Name is required.'); return }
    startTransition(async () => {
      const result = await addDestination({ name, destination_type: destType, trust_tag: tag, risk_level: riskLevel, risk_notes: riskNotes, notes })
      if (result.error) { setError(result.error); return }
      if (result.destination) onAdd(result.destination)
      onClose()
    })
  }

  const tt = TRUST_TAGS[tag]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold text-white">Add destination</h3>
          <button onClick={onClose} className="text-zinc-600 hover:text-zinc-400"><X className="w-4 h-4" /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">
              Name <span className="text-red-400">*</span>
            </label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Corporate SharePoint, Personal Gmail, Banned AI Tool"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Trust tag */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Trust Tag</label>
            <div className="grid grid-cols-2 gap-1.5">
              {TRUST_TAG_ORDER.map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => handleTagChange(t)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all text-left',
                    tag === t
                      ? `${TRUST_TAGS[t].text} ${TRUST_TAGS[t].bg} ${TRUST_TAGS[t].border}`
                      : 'text-zinc-500 bg-zinc-800/40 border-zinc-700 hover:border-zinc-600',
                  )}
                >
                  <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', TRUST_TAGS[t].dot)} />
                  {TRUST_TAGS[t].label}
                </button>
              ))}
            </div>
          </div>

          {/* Destination type */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Destination Type</label>
            <select
              value={destType}
              onChange={e => setDestType(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-300 focus:outline-none focus:border-blue-500"
            >
              {DESTINATION_TYPES[tag].map(dt => (
                <option key={dt} value={dt}>{dt}</option>
              ))}
            </select>
          </div>

          {/* Risk level */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Risk Level</label>
            <div className="flex gap-2">
              {(['low', 'medium', 'high', 'critical'] as RiskLevel[]).map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRiskLevel(r)}
                  className={cn(
                    'flex-1 py-1.5 rounded-lg border text-xs font-medium transition-all capitalize',
                    riskLevel === r
                      ? RISK_LEVELS[r].className
                      : 'text-zinc-600 bg-zinc-800/40 border-zinc-700 hover:border-zinc-600',
                  )}
                >
                  {RISK_LEVELS[r].label}
                </button>
              ))}
            </div>
          </div>

          {/* Risk notes */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Risk Notes <span className="text-zinc-600">(optional)</span></label>
            <textarea
              value={riskNotes}
              onChange={e => setRiskNotes(e.target.value)}
              rows={2}
              placeholder="Why is this the risk level? Any specific conditions or controls?"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Notes <span className="text-zinc-600">(optional)</span></label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Any additional context, owner, review date, etc."
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-300">Cancel</button>
            <button
              type="submit"
              disabled={isPending}
              className={cn(
                'px-4 py-2 text-sm font-medium rounded-lg disabled:opacity-50 transition-colors',
                tt.text, tt.bg, tt.border, 'border hover:opacity-90',
              )}
            >
              {isPending ? 'Adding…' : 'Add destination'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Destination row ──────────────────────────────────────────────────────────

function DestinationRow({
  item,
  onDelete,
}: {
  item:     OrgDestination
  onDelete: (id: string) => void
}) {
  const [expanded,  setExpanded]  = useState(false)
  const [deleting,  setDeleting]  = useState(false)
  const [isPending, startTransition] = useTransition()

  const tt = TRUST_TAGS[item.trust_tag]
  const rl = item.risk_level ? RISK_LEVELS[item.risk_level] : null

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation()
    setDeleting(true)
  }

  function confirmDelete() {
    startTransition(async () => {
      await deleteDestination(item.id)
      onDelete(item.id)
    })
  }

  return (
    <>
      <tr
        className="group border-b border-zinc-800/40 transition-colors cursor-pointer hover:bg-zinc-900/30 last:border-0"
        onClick={() => setExpanded(e => !e)}
      >
        <td className="px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', tt.dot)} />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-medium text-white leading-tight">{item.name}</p>
                <ChevronRight className={cn('w-3 h-3 text-zinc-700 transition-transform shrink-0', expanded && 'rotate-90')} />
              </div>
              <p className="text-xs text-zinc-600 mt-0.5">{item.destination_type}</p>
            </div>
          </div>
        </td>

        <td className="px-4 py-3.5 w-52">
          <span className={cn('text-[10px] font-semibold px-2 py-1 rounded-lg border', tt.text, tt.bg, tt.border)}>
            {tt.label}
          </span>
        </td>

        <td className="px-4 py-3.5 w-28">
          {rl && (
            <span className={cn('text-[10px] font-semibold px-2 py-1 rounded-lg border', rl.className)}>
              {rl.label}
            </span>
          )}
        </td>

        <td className="px-5 py-3.5 w-14 text-right" onClick={e => e.stopPropagation()}>
          {deleting ? (
            <div className="flex items-center gap-1.5 justify-end">
              <button onClick={() => setDeleting(false)} className="text-[10px] text-zinc-600 hover:text-zinc-400">Cancel</button>
              <button
                onClick={confirmDelete}
                disabled={isPending}
                className="text-[10px] text-rose-400 hover:text-rose-300 font-medium disabled:opacity-50"
              >
                {isPending ? '…' : 'Delete'}
              </button>
            </div>
          ) : (
            <button
              onClick={handleDelete}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-700 hover:text-rose-400"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </td>
      </tr>

      {expanded && (
        <tr className="border-b border-zinc-700/50">
          <td colSpan={4} className="px-5 py-4 bg-zinc-950/60">
            <div className="pl-4 border-l-2 border-zinc-700 space-y-2.5">
              {item.risk_notes && (
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500/70 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-400/80 leading-relaxed">{item.risk_notes}</p>
                </div>
              )}
              {item.notes && (
                <p className="text-xs text-zinc-400 leading-relaxed">{item.notes}</p>
              )}
              {!item.risk_notes && !item.notes && (
                <p className="text-xs text-zinc-700 italic">No notes added.</p>
              )}
              <p className="text-[10px] text-zinc-700">
                Added {new Date(item.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ─── Trust tag section ────────────────────────────────────────────────────────

function TrustTagSection({
  tag,
  items,
  onDelete,
  forceExpand,
}: {
  tag:         TrustTag
  items:       OrgDestination[]
  onDelete:    (id: string) => void
  forceExpand: boolean
}) {
  const [collapsed, setCollapsed] = useState(items.length === 0)
  const tt = TRUST_TAGS[tag]

  // Auto-expand when forceExpand changes
  if (forceExpand && collapsed) setCollapsed(false)

  if (items.length === 0) return null

  return (
    <div className={cn('rounded-xl border overflow-hidden transition-colors', collapsed ? 'border-zinc-800' : 'border-zinc-700')}>
      <button
        onClick={() => setCollapsed(c => !c)}
        className={cn(
          'w-full flex items-center gap-4 px-5 py-4 text-left transition-colors',
          collapsed ? 'bg-zinc-900/50 hover:bg-zinc-900/80' : 'bg-zinc-900/80',
        )}
      >
        <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', tt.dot)} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-0.5">
            <span className={cn('text-sm font-bold tracking-wider', tt.text)}>{tt.label.toUpperCase()}</span>
            <span className="text-xs text-zinc-500">{items.length} {items.length === 1 ? 'destination' : 'destinations'}</span>
          </div>
          {collapsed && <p className="text-xs text-zinc-600 truncate">{tt.tagline}</p>}
        </div>
        {collapsed
          ? <ChevronRight className="w-4 h-4 text-zinc-600 shrink-0" />
          : <ChevronDown  className="w-4 h-4 text-zinc-500 shrink-0" />}
      </button>

      {!collapsed && (
        <>
          <div className="grid grid-cols-[1fr_theme(spacing.52)_theme(spacing.28)_theme(spacing.14)] border-b border-zinc-800 bg-zinc-950/60">
            {['Destination', 'Trust Tag', 'Risk', ''].map((h, i) => (
              <div key={i} className={cn('text-[10px] font-semibold text-zinc-600 uppercase tracking-widest py-2.5', i === 0 ? 'px-5' : 'px-4', i === 3 ? 'pr-5' : '')}>{h}</div>
            ))}
          </div>
          <table className="w-full">
            <tbody>
              {items.map(item => (
                <DestinationRow key={item.id} item={item} onDelete={onDelete} />
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function DestinationsClient({ initialDestinations }: { initialDestinations: OrgDestination[] }) {
  const [search,     setSearch]     = useState('')
  const [tagFilter,  setTagFilter]  = useState<string[]>([])
  const [riskFilter, setRiskFilter] = useState<string>('')
  const [showModal,  setShowModal]  = useState(false)

  type OptimisticAction =
    | { type: 'add';    item: OrgDestination }
    | { type: 'delete'; id:   string         }

  const [optimistic, setOptimistic] = useOptimistic(
    initialDestinations,
    (state, action: OptimisticAction) => {
      if (action.type === 'add')    return [...state, action.item]
      if (action.type === 'delete') return state.filter(d => d.id !== action.id)
      return state
    },
  )

  const [, startTransition] = useTransition()

  function handleAdd(dest: OrgDestination) {
    startTransition(() => {
      setOptimistic({ type: 'add', item: dest })
    })
  }

  function handleDelete(id: string) {
    startTransition(() => {
      setOptimistic({ type: 'delete', id })
    })
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return optimistic.filter(d => {
      if (tagFilter.length > 0 && !tagFilter.includes(d.trust_tag)) return false
      if (riskFilter && d.risk_level !== riskFilter) return false
      if (!q) return true
      return (
        d.name.toLowerCase().includes(q) ||
        d.destination_type.toLowerCase().includes(q)
      )
    })
  }, [optimistic, search, tagFilter, riskFilter])

  const total            = optimistic.length
  const approvedCount    = optimistic.filter(d => d.trust_tag === 'enterprise_approved').length
  const unknownCount     = optimistic.filter(d => d.trust_tag === 'unknown').length
  const prohibitedCount  = optimistic.filter(d => d.trust_tag === 'prohibited').length

  const anyFilterActive = search.length > 0 || tagFilter.length > 0 || riskFilter !== ''

  const tagFilterOptions = TRUST_TAG_ORDER.map(t => ({ value: t, label: TRUST_TAGS[t].label }))
  const riskFilterOptions = [
    { value: 'low',      label: 'Low'      },
    { value: 'medium',   label: 'Medium'   },
    { value: 'high',     label: 'High'     },
    { value: 'critical', label: 'Critical' },
  ]

  return (
    <div className="space-y-5 pb-8">
      {showModal && (
        <AddDestinationModal
          onClose={() => setShowModal(false)}
          onAdd={handleAdd}
        />
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div />
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg transition-colors shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          Add destination
        </button>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total mapped',        value: total,          sub: '7 trust levels',          accent: 'text-white'         },
          { label: 'Enterprise Approved', value: approvedCount,  sub: 'fully sanctioned',         accent: 'text-green-400'     },
          { label: 'Unknown',             value: unknownCount,   sub: 'awaiting assessment',      accent: unknownCount > 0  ? 'text-amber-400' : 'text-zinc-600' },
          { label: 'Prohibited',          value: prohibitedCount,sub: 'explicitly not allowed',   accent: prohibitedCount > 0 ? 'text-rose-400'  : 'text-zinc-600' },
        ].map(s => (
          <div key={s.label} className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-5 py-3.5">
            <p className={cn('text-2xl font-bold', s.accent)}>{s.value}</p>
            <p className="text-xs font-medium text-zinc-400 mt-0.5">{s.label}</p>
            <p className="text-[10px] text-zinc-600 mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search destinations…"
            className="w-full bg-zinc-800/60 border border-zinc-700 rounded-xl pl-8 pr-8 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        <MultiFilterSelect
          value={tagFilter}
          onChange={setTagFilter}
          options={tagFilterOptions}
          placeholder="All trust tags"
        />

        <FilterSelect
          value={riskFilter}
          onChange={setRiskFilter}
          options={riskFilterOptions}
          placeholder="All risk levels"
          searchable={false}
        />

        {anyFilterActive && (
          <button
            onClick={() => { setSearch(''); setTagFilter([]); setRiskFilter('') }}
            className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            Clear all
          </button>
        )}

        <span className="ml-auto text-sm text-zinc-600 whitespace-nowrap">
          {filtered.length} of {total} destinations
        </span>
      </div>

      {/* Trust tag sections */}
      <div className="space-y-2">
        {TRUST_TAG_ORDER.map(tag => (
          <TrustTagSection
            key={tag}
            tag={tag}
            items={filtered.filter(d => d.trust_tag === tag)}
            onDelete={handleDelete}
            forceExpand={anyFilterActive}
          />
        ))}
      </div>

      {/* Empty state */}
      {total === 0 && (
        <div className="text-center py-16 rounded-xl border border-zinc-800 border-dashed">
          <p className="text-zinc-500 text-sm mb-1">No destinations mapped yet</p>
          <p className="text-zinc-700 text-xs mb-4">Add your apps, domains, AI tools, and cloud storage to build your destination trust inventory.</p>
          <button
            onClick={() => setShowModal(true)}
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            Add your first destination →
          </button>
        </div>
      )}

      {total > 0 && filtered.length === 0 && (
        <div className="text-center py-16 text-zinc-600 text-sm rounded-xl border border-zinc-800">
          No destinations match your filters.
          <button onClick={() => { setSearch(''); setTagFilter([]); setRiskFilter('') }} className="ml-2 text-blue-400 hover:underline">
            Clear filters
          </button>
        </div>
      )}
    </div>
  )
}
