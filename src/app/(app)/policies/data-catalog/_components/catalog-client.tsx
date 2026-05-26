'use client'

import { useState, useMemo, useTransition, useOptimistic, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { Search, X, Plus, ChevronDown, ChevronRight, Info, AlertTriangle, Wand2, FlaskConical, Check } from 'lucide-react'
import { toggleInScope, setClassification, addCustomDataType, batchToggleInScope } from '@/lib/data-catalog/actions'
import { colorClasses, SYSTEM_LEVEL_META } from '@/lib/data-catalog/types'
import type { OrgClassificationLabel, SystemLevel } from '@/lib/data-catalog/types'
import { FilterSelect, MultiFilterSelect } from '@/components/ui/filter-select'

// ─── Types ────────────────────────────────────────────────────────────────────

interface EnrichedCatalogType {
  id:                      string
  slug:                    string
  name:                    string
  system_level:            SystemLevel
  subcategory:             string | null
  description:             string | null
  examples:                string[]
  notes:                   string | null
  tags:                    string[]
  priority:                number
  org_data_type_id:        string | null
  is_in_scope:             boolean
  classification_label_id: string | null
  mapped_by:               string | null
}

interface CustomType {
  id:                      string
  name:                    string
  description:             string | null
  examples:                string[]
  is_custom:               boolean
  org_data_type_id:        string
  classification_label_id: string | null
  mapped_by:               string | null
}

// ─── Classification Rules panel ───────────────────────────────────────────────

const RULES = [
  { title: 'Highest-risk content wins',           body: 'If a file contains multiple data types, classify by the most sensitive type present.' },
  { title: 'Volume increases severity, not label', body: 'High volume stays at the same label — but incident priority and enforcement strength should increase.' },
  { title: 'Some types are always high risk',      body: 'Passwords, API keys, tokens, private keys, and privileged credentials always map to Secret, regardless of context.' },
  { title: 'Context can elevate classification',   body: 'Source code with hardcoded credentials → Secret. Customer list with PII → Highly Confidential. Public file with hidden SSN → Highly Confidential.' },
]

function RulesPanel() {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-xl border border-border bg-card/40 overflow-hidden shadow-sm">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Info className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          <span className="text-sm font-medium text-foreground">Classification Rules</span>
          <span className="text-xs text-muted-foreground/60 hidden sm:block">Data Type → Classification → Context → DLP Action</span>
        </div>
        {open ? <ChevronDown className="w-4 h-4 text-muted-foreground/80" /> : <ChevronRight className="w-4 h-4 text-muted-foreground/80" />}
      </button>
      {open && (
        <div className="border-t border-border px-5 py-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {RULES.map(r => (
            <div key={r.title} className="flex gap-2.5">
              <div className="w-1 h-full min-h-[32px] bg-blue-500/30 rounded-full shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-foreground/70 mb-0.5">{r.title}</p>
                <p className="text-xs text-muted-foreground/80 leading-relaxed">{r.body}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Add custom type modal ────────────────────────────────────────────────────

function AddCustomModal({ labels, onClose }: { labels: OrgClassificationLabel[]; onClose: () => void }) {
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
      <div className="bg-card border border-border rounded-xl p-6 w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold text-foreground">Add custom data type</h3>
          <button onClick={onClose} className="text-muted-foreground/60 hover:text-muted-foreground"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {[
            { key: 'name',        label: 'Name',                      required: true,  placeholder: 'e.g. Customer Contract Templates' },
            { key: 'description', label: 'Description',               required: false, placeholder: 'Brief description of this data type' },
            { key: 'examples',    label: 'Examples (comma-separated)', required: false, placeholder: 'e.g. Master Agreement, SOW, NDA' },
          ].map(f => (
            <div key={f.key}>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                {f.label} {f.required && <span className="text-red-400">*</span>}
              </label>
              <input
                value={form[f.key as keyof typeof form]}
                onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                className="w-full bg-muted border border-border-strong rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-blue-500"
              />
            </div>
          ))}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Classification</label>
            <select
              value={form.labelId}
              onChange={e => setForm(f => ({ ...f, labelId: e.target.value }))}
              className="w-full bg-muted border border-border-strong rounded-lg px-3 py-2.5 text-sm text-foreground/70 focus:outline-none focus:border-blue-500"
            >
              {labels.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground/70">Cancel</button>
            <button type="submit" disabled={isPending}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium disabled:opacity-50 transition-colors">
              {isPending ? 'Adding…' : 'Add data type'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Classification badge select ──────────────────────────────────────────────

function ClassificationSelect({
  value,
  labels,
  onChange,
}: {
  value:    string | null
  labels:   OrgClassificationLabel[]
  onChange: (labelId: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  const label = labels.find(l => l.id === value)
  const cc    = label ? colorClasses(label.color) : null

  return (
    <div ref={ref} className="relative w-full">
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen(o => !o)}
        onKeyDown={e => e.key === 'Enter' && setOpen(o => !o)}
        className={cn(
          'flex items-center justify-between gap-1.5 pl-2.5 pr-2 py-1.5 rounded-lg border text-xs font-medium cursor-pointer select-none transition-colors w-full',
          cc
            ? `${cc.text} ${cc.bg} ${cc.border} hover:opacity-90`
            : 'text-muted-foreground/60 bg-muted/60 border-border-strong hover:border-border-strong',
        )}
      >
        <span className="truncate">{label?.name ?? '— Select label —'}</span>
        <ChevronDown className="w-3 h-3 shrink-0 opacity-60" />
      </div>

      {open && (
        <div className="absolute top-full mt-1 right-0 z-50 w-52 bg-card border border-border rounded-xl shadow-2xl overflow-hidden">
          <button
            onClick={() => { onChange(''); setOpen(false) }}
            className={cn(
              'w-full flex items-center px-3 py-2.5 text-xs text-left transition-colors',
              !value ? 'bg-blue-600/20 text-blue-500' : 'text-muted-foreground/80 hover:bg-muted/80',
            )}
          >
            — No label —
          </button>
          {labels.map(l => {
            const lcc = colorClasses(l.color)
            return (
              <button
                key={l.id}
                onClick={() => { onChange(l.id); setOpen(false) }}
                className="w-full flex items-center justify-between px-3 py-2 text-left transition-colors hover:bg-muted/80"
              >
                <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded border', lcc.text, lcc.bg, lcc.border)}>
                  {l.name}
                </span>
                {l.id === value && <Check className="w-3 h-3 text-blue-400 shrink-0" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Compliance tag config ────────────────────────────────────────────────────

const COMPLIANCE_TAGS: Record<string, { label: string; className: string }> = {
  gdpr:               { label: 'GDPR',             className: 'text-blue-400 bg-blue-500/10 border-blue-500/25'   },
  hipaa:              { label: 'HIPAA',             className: 'text-green-400 bg-green-500/10 border-green-500/25' },
  pci:                { label: 'PCI-DSS',           className: 'text-purple-400 bg-purple-500/10 border-purple-500/25' },
  pii:                { label: 'Privacy / PII',     className: 'text-amber-400 bg-amber-500/10 border-amber-500/25'  },
  'special-category': { label: 'Special Category',  className: 'text-red-400 bg-red-500/10 border-red-500/25'       },
  regulated:          { label: 'SOX / Financial',   className: 'text-orange-400 bg-orange-500/10 border-orange-500/25' },
  'security-critical':{ label: 'NIS2 / DORA / CMMC', className: 'text-rose-400 bg-rose-500/10 border-rose-500/25'  },
  security:           { label: 'Security',          className: 'text-muted-foreground bg-muted/40 border-border-strong/25'    },
  credentials:        { label: 'Credentials',       className: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/25' },
}

// Filter options shown in the compliance dropdown — maps regulation names to catalog tags
const COMPLIANCE_FILTER_TAGS = [
  { value: 'gdpr',               label: 'GDPR / UK GDPR' },
  { value: 'hipaa',              label: 'HIPAA' },
  { value: 'pci',                label: 'PCI-DSS' },
  { value: 'pii',                label: 'Privacy / PII (CCPA, PIPL, DPDP…)' },
  { value: 'special-category',   label: 'GDPR Special Category (Art. 9)' },
  { value: 'security-critical',  label: 'NIS2 / DORA / CMMC' },
  { value: 'regulated',          label: 'SOX / GLBA / Financial' },
  { value: 'credentials',        label: 'Credentials & Secrets' },
]

const DLP_TREATMENT: Record<SystemLevel, string> = {
  secret:              'Block by default outside explicitly approved workflows. Inspect all traffic.',
  highly_confidential: 'Strongly restrict. Alert on any external movement. Coach users before upload.',
  confidential:        'Control external movement. Block high-risk destinations. Monitor cloud sharing.',
  internal:            'Monitor and guide. Alert on suspicious volume or unusual destinations.',
  public:              'Allow. Inspect for hidden sensitive content before release.',
}

function ComplianceBadges({ tags }: { tags: string[] }) {
  const relevant = tags.filter(t => COMPLIANCE_TAGS[t])
  if (!relevant.length) return null
  return (
    <div className="flex flex-wrap gap-1 mt-1.5">
      {relevant.map(t => (
        <span key={t} className={cn('text-[9px] font-semibold px-1.5 py-0.5 rounded border', COMPLIANCE_TAGS[t].className)}>
          {COMPLIANCE_TAGS[t].label}
        </span>
      ))}
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
  item:       EnrichedCatalogType
  labels:     OrgClassificationLabel[]
  onToggle:   (id: string, inScope: boolean) => void
  onClassify: (orgDataTypeId: string, labelId: string) => void
}) {
  const [expanded,         setExpanded]         = useState(false)
  const [selectedExample,  setSelectedExample]  = useState<string | null>(null)
  const hasTreatment = DLP_TREATMENT[item.system_level]

  return (
    <>
      <tr className={cn(
        'group border-b border-border/40 transition-colors cursor-pointer',
        expanded ? 'border-border-strong' : 'last:border-0',
        item.is_in_scope ? 'bg-card/20 hover:bg-card/40' : 'hover:bg-card/20',
      )}
        onClick={() => setExpanded(e => !e)}
      >
        {/* Name + examples + compliance badges */}
        <td className="px-5 py-3.5">
          <div className="flex items-start gap-2.5">
            <div className={cn(
              'w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 transition-colors',
              item.is_in_scope ? 'bg-blue-400' : 'bg-accent',
            )} />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className={cn('text-sm font-medium leading-tight', item.is_in_scope ? 'text-foreground' : 'text-muted-foreground')}>{item.name}</p>
                <ChevronRight className={cn('w-3 h-3 text-muted-foreground/40 transition-transform shrink-0', expanded && 'rotate-90')} />
              </div>
              {item.examples.length > 0 && (
                <p className="text-xs text-muted-foreground/60 mt-0.5 leading-relaxed">
                  {item.examples.slice(0, 3).join('  ·  ')}
                </p>
              )}
              <ComplianceBadges tags={item.tags ?? []} />
            </div>
          </div>
        </td>

        {/* Classification */}
        <td className="px-4 py-3.5 w-44" onClick={e => e.stopPropagation()}>
          {item.is_in_scope ? (
            <ClassificationSelect
              value={item.classification_label_id}
              labels={labels}
              onChange={labelId => item.org_data_type_id && !(item as EnrichedCatalogType & { _pending?: boolean })._pending && onClassify(item.org_data_type_id, labelId)}
            />
          ) : (
            <span className="text-xs text-muted-foreground/40">—</span>
          )}
        </td>

        {/* Scope toggle */}
        <td className="px-5 py-3.5 w-32 text-right" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => onToggle(item.id, item.is_in_scope)}
            className={cn(
              'text-xs px-3 py-1.5 rounded-lg border font-medium transition-all',
              item.is_in_scope
                ? 'text-blue-400 bg-blue-500/10 border-blue-500/25 hover:bg-blue-500/20'
                : 'text-muted-foreground/60 bg-transparent border-border hover:border-border-strong hover:text-muted-foreground',
            )}
          >
            {item.is_in_scope ? 'In scope ✓' : '+ Add'}
          </button>
        </td>
      </tr>

      {/* Expandable detail panel */}
      {expanded && (
        <tr className="border-b border-border-strong/50">
          <td colSpan={3} className="px-5 py-4 bg-background/60">
            <div className="pl-4 border-l-2 border-border-strong space-y-3">
              {/* Description */}
              {item.description && (
                <p className="text-xs text-muted-foreground leading-relaxed">{item.description}</p>
              )}

              {/* Examples — click to select, then create regex pattern */}
              {item.examples.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest">Examples</p>
                    <p className="text-[10px] text-muted-foreground/40">Select one to use the tools below</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {item.examples.map(ex => (
                      <button
                        key={ex}
                        type="button"
                        onClick={e => { e.stopPropagation(); setSelectedExample(selectedExample === ex ? null : ex) }}
                        className={cn(
                          'text-[10px] px-2 py-0.5 rounded border transition-all',
                          selectedExample === ex
                            ? 'text-blue-500 bg-blue-500/20 border-blue-500/50 shadow-[0_0_6px_rgba(59,130,246,0.35)]'
                            : 'text-muted-foreground bg-muted border-border-strong hover:border-blue-500/40 hover:text-blue-300 hover:bg-blue-500/8 hover:shadow-[0_0_4px_rgba(59,130,246,0.2)]',
                        )}
                      >
                        {ex}
                      </button>
                    ))}
                  </div>
                  {/* Regex + Data Lab CTAs — side by side, enabled only when an example is selected */}
                  <div className="mt-2 flex items-center gap-4 min-h-[22px]">
                    <div className="flex items-center gap-2">
                      <Wand2 className={cn('w-3 h-3 shrink-0 transition-colors', selectedExample ? 'text-blue-400' : 'text-muted-foreground/40')} />
                      {selectedExample ? (
                        <a
                          href={`/tools/regex-lab?` + new URLSearchParams({
                            name:   `${item.name} — ${selectedExample}`,
                            prompt: `Generate a DLP regex pattern to detect ${selectedExample}. This is a type of ${item.name}.`,
                          }).toString()}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="text-[11px] font-medium text-blue-400 hover:text-blue-300 transition-colors"
                        >
                          Create regex pattern for &ldquo;{selectedExample}&rdquo; →
                        </a>
                      ) : (
                        <span className="text-[11px] text-muted-foreground/40 select-none">Create regex pattern</span>
                      )}
                    </div>
                    <div className="w-px h-3 bg-muted shrink-0" />
                    <div className="flex items-center gap-2">
                      <FlaskConical className={cn('w-3 h-3 shrink-0 transition-colors', selectedExample ? 'text-violet-400' : 'text-muted-foreground/40')} />
                      {selectedExample ? (
                        <a
                          href={`/tools/test-data?` + new URLSearchParams({
                            name:   `${item.name} — ${selectedExample}`,
                            prompt: `Generate synthetic test data for DLP testing of ${selectedExample} (a type of ${item.name}). Each row should have a service or context field plus realistic-looking (but entirely fake) values.`,
                          }).toString()}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="text-[11px] font-medium text-violet-400 hover:text-violet-300 transition-colors"
                        >
                          Generate test data for &ldquo;{selectedExample}&rdquo; →
                        </a>
                      ) : (
                        <span className="text-[11px] text-muted-foreground/40 select-none">Generate test data</span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* DLP treatment */}
                {hasTreatment && (
                  <div className="bg-card/60 rounded-lg p-3 border border-border">
                    <p className="text-[10px] font-semibold text-muted-foreground/80 uppercase tracking-widest mb-1">DLP Treatment</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{DLP_TREATMENT[item.system_level]}</p>
                  </div>
                )}

                {/* Compliance relevance */}
                {(item.tags ?? []).some(t => COMPLIANCE_TAGS[t]) && (
                  <div className="bg-card/60 rounded-lg p-3 border border-border">
                    <p className="text-[10px] font-semibold text-muted-foreground/80 uppercase tracking-widest mb-2">Compliance Relevance</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(item.tags ?? []).filter(t => COMPLIANCE_TAGS[t]).map(t => (
                        <span key={t} className={cn('text-[10px] font-semibold px-2 py-1 rounded border', COMPLIANCE_TAGS[t].className)}>
                          {COMPLIANCE_TAGS[t].label}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Elevation note */}
              {item.notes && (
                <div className="flex items-start gap-2 bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-2.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500/70 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-amber-400/80 leading-relaxed">{item.notes}</p>
                </div>
              )}

            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ─── Subcategory group ────────────────────────────────────────────────────────

function SubcategoryGroup({
  subcat,
  items,
  labels,
  onToggle,
  onClassify,
  onBulkToggle,
  forceExpand,
}: {
  subcat:        string
  items:         EnrichedCatalogType[]
  labels:        OrgClassificationLabel[]
  onToggle:      (id: string, inScope: boolean) => void
  onClassify:    (orgDataTypeId: string, labelId: string) => void
  onBulkToggle:  (items: EnrichedCatalogType[], addToScope: boolean) => void
  forceExpand:   boolean
}) {
  const [collapsed, setCollapsed] = useState(true)

  useEffect(() => {
    setCollapsed(!forceExpand)
  }, [forceExpand])

  const inScopeCount  = items.filter(i => i.is_in_scope).length
  const allInScope    = inScopeCount === items.length
  const noneInScope   = inScopeCount === 0

  return (
    <div className="group/subcatrow">
      <div
        className="px-5 py-2.5 bg-background/50 flex items-center justify-between hover:bg-background/70 transition-colors cursor-pointer"
        onClick={() => setCollapsed(c => !c)}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {collapsed
            ? <ChevronRight className="w-3 h-3 text-muted-foreground/60 group-hover/subcatrow:text-muted-foreground transition-colors shrink-0" />
            : <ChevronDown  className="w-3 h-3 text-muted-foreground/60 group-hover/subcatrow:text-muted-foreground transition-colors shrink-0" />}
          <p className="text-[10px] font-semibold text-muted-foreground/80 uppercase tracking-widest group-hover/subcatrow:text-muted-foreground transition-colors truncate">{subcat}</p>
        </div>
        <div className="flex items-center gap-3 shrink-0 ml-4" onClick={e => e.stopPropagation()}>
          <p className="text-[10px] text-muted-foreground/40">{inScopeCount}/{items.length} in scope</p>
          {/* Bulk buttons — visible on hover */}
          <div className="flex items-center gap-1 opacity-0 group-hover/subcatrow:opacity-100 transition-opacity">
            {!allInScope && (
              <button
                onClick={e => { e.stopPropagation(); onBulkToggle(items.filter(i => !i.is_in_scope), true) }}
                className="text-[10px] px-2 py-0.5 rounded border border-border-strong text-muted-foreground/80 hover:text-blue-400 hover:border-blue-500/40 transition-colors"
              >
                + Add all
              </button>
            )}
            {!noneInScope && (
              <button
                onClick={e => { e.stopPropagation(); onBulkToggle(items.filter(i => i.is_in_scope), false) }}
                className="text-[10px] px-2 py-0.5 rounded border border-border-strong text-muted-foreground/80 hover:text-red-400 hover:border-red-500/40 transition-colors"
              >
                − Remove all
              </button>
            )}
          </div>
        </div>
      </div>
      {!collapsed && (
        <table className="w-full">
          <tbody>
            {items.map(item => (
              <DataTypeRow
                key={item.id}
                item={item}
                labels={labels}
                onToggle={onToggle}
                onClassify={onClassify}
              />
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

// ─── Classification section ───────────────────────────────────────────────────

function ClassificationSection({
  level,
  items,
  labels,
  onToggle,
  onClassify,
  onBulkToggle,
  forceExpand,
}: {
  level:        SystemLevel
  items:        EnrichedCatalogType[]
  labels:       OrgClassificationLabel[]
  onToggle:     (id: string, inScope: boolean) => void
  onClassify:   (orgDataTypeId: string, labelId: string) => void
  onBulkToggle: (items: EnrichedCatalogType[], addToScope: boolean) => void
  forceExpand:  boolean
}) {
  const [collapsed, setCollapsed] = useState(true)

  useEffect(() => {
    setCollapsed(!forceExpand)
  }, [forceExpand])

  const meta       = SYSTEM_LEVEL_META[level]
  const orgLabel   = labels.find(l => l.system_level === level)
  const cc         = orgLabel ? colorClasses(orgLabel.color) : colorClasses(meta.color)
  const inScope    = items.filter(i => i.is_in_scope).length
  const pct        = items.length > 0 ? Math.round((inScope / items.length) * 100) : 0
  const subcats    = [...new Set(items.map(i => i.subcategory ?? 'General'))]
  const labelName  = orgLabel?.name ?? meta.label

  if (items.length === 0) return null

  return (
    <div className={cn('rounded-xl border overflow-hidden transition-colors', collapsed ? 'border-border' : 'border-border-strong')}>
      {/* Section header */}
      <button
        onClick={() => setCollapsed(c => !c)}
        className={cn(
          'w-full flex items-center gap-4 px-5 py-4 text-left transition-colors',
          collapsed ? 'bg-card/50 hover:bg-card/80' : 'bg-card/80',
        )}
      >
        {/* Level dot */}
        <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', cc.dot)} />

        {/* Level info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-0.5">
            <span className={cn('text-sm font-bold tracking-wider', cc.text)}>{labelName.toUpperCase()}</span>
            <span className="text-xs text-muted-foreground/60">Priority {orgLabel?.priority ?? meta.priority}</span>
            <span className="text-muted-foreground/40 text-xs">·</span>
            <span className="text-xs text-muted-foreground/80">{items.length} types</span>
            {inScope > 0 && (
              <>
                <span className="text-muted-foreground/40 text-xs">·</span>
                <span className={cn('text-xs font-semibold', cc.text)}>{inScope} in scope</span>
              </>
            )}
          </div>
          {collapsed && <p className="text-xs text-muted-foreground/60 truncate">{meta.tagline}</p>}
        </div>

        {/* Progress bar (only when collapsed, shows scope coverage) */}
        {collapsed && inScope > 0 && (
          <div className="hidden sm:flex items-center gap-2 shrink-0">
            <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all', cc.dot)}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-[10px] text-muted-foreground/60 w-8">{pct}%</span>
          </div>
        )}

        {/* Expand/collapse icon */}
        {collapsed
          ? <ChevronRight className="w-4 h-4 text-muted-foreground/60 shrink-0" />
          : <ChevronDown className="w-4 h-4 text-muted-foreground/80 shrink-0" />}
      </button>

      {/* Expanded content */}
      {!collapsed && (
        <>
          {/* Table header */}
          <div className="grid grid-cols-[1fr_theme(spacing.44)_theme(spacing.32)] border-b border-border bg-background/60">
            {['Data Type', 'Your Classification', ''].map((h, i) => (
              <div key={i} className={cn('text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest py-2.5', i === 0 ? 'px-5' : 'px-4', i === 2 ? 'text-right pr-5' : '')}>{h}</div>
            ))}
          </div>

          {/* Subcategory groups */}
          <div className="divide-y divide-border/30">
            {subcats.map(subcat => (
              <SubcategoryGroup
                key={subcat}
                subcat={subcat}
                items={items.filter(i => (i.subcategory ?? 'General') === subcat)}
                labels={labels}
                onToggle={onToggle}
                onClassify={onClassify}
                onBulkToggle={onBulkToggle}
                forceExpand={forceExpand}
              />
            ))}
          </div>
        </>
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
  const [search,            setSearch]            = useState('')
  const [levelFilter,       setLevelFilter]       = useState<string[]>([])
  const [subcatFilter,      setSubcatFilter]      = useState<string>('')
  const [complianceFilter,  setComplianceFilter]  = useState<string[]>([])
  const [scopeFilter,       setScopeFilter]       = useState<string>('')
  const [showAddModal,      setShowAddModal]      = useState(false)
  const [customSectionOpen, setCustomSectionOpen] = useState(false)
  const [isPending,         startTransition]      = useTransition()

  type OptimisticAction =
    | { type: 'toggle';   catalogId: string;    inScope: boolean }
    | { type: 'classify'; orgDataTypeId: string; labelId: string }

  const [optimisticCatalog, setOptimisticCatalog] = useOptimistic(
    catalog,
    (state, action: OptimisticAction) => {
      if (action.type === 'toggle') {
        return state.map(item =>
          item.id === action.catalogId
            ? { ...item, is_in_scope: action.inScope, _pending: action.inScope && !item.org_data_type_id }
            : item,
        )
      }
      return state.map(item =>
        item.org_data_type_id === action.orgDataTypeId
          ? { ...item, classification_label_id: action.labelId }
          : item,
      )
    },
  )

  function handleToggle(catalogId: string, currentlyInScope: boolean) {
    const item = catalog.find(c => c.id === catalogId)
    if (!item) return
    setOptimisticCatalog({ type: 'toggle', catalogId, inScope: !currentlyInScope })
    startTransition(async () => { await toggleInScope(catalogId, currentlyInScope, item.system_level) })
  }

  function handleClassify(orgDataTypeId: string, labelId: string) {
    setOptimisticCatalog({ type: 'classify', orgDataTypeId, labelId })
    startTransition(async () => { await setClassification(orgDataTypeId, labelId) })
  }

  function handleBulkToggle(items: EnrichedCatalogType[], addToScope: boolean) {
    // Optimistic: flip all at once
    items.forEach(item => setOptimisticCatalog({ type: 'toggle', catalogId: item.id, inScope: addToScope }))
    startTransition(async () => {
      await batchToggleInScope(
        items.map(i => ({ catalogDataTypeId: i.id, systemLevel: i.system_level, name: i.name })),
        addToScope,
      )
    })
  }

  const levels: SystemLevel[] = ['secret', 'highly_confidential', 'confidential', 'internal', 'public']

  // Map label id → label for filter logic
  const labelById = useMemo(() => new Map(labels.map(l => [l.id, l])), [labels])

  // Filter options use label IDs so custom labels appear in the dropdown
  const levelFilterOptions = useMemo(() => [
    { value: 'all', label: 'All levels' },
    ...labels.map(l => ({ value: l.id, label: l.name })),
  ], [labels])

  // Unique subcategories from the full catalog (sorted alphabetically)
  const subcatOptions = useMemo(() => {
    const all = [...new Set(catalog.map(i => i.subcategory ?? 'General'))].sort()
    return [{ value: 'all', label: 'All categories' }, ...all.map(s => ({ value: s, label: s }))]
  }, [catalog])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return optimisticCatalog.filter(item => {
      // Level filter (multi) — OR logic across selected labels
      if (levelFilter.length > 0) {
        const matches = levelFilter.some(filterId => {
          const lbl = labelById.get(filterId)
          if (!lbl) return false
          return lbl.system_level ? item.system_level === lbl.system_level : item.classification_label_id === filterId
        })
        if (!matches) return false
      }
      if (subcatFilter && (item.subcategory ?? 'General') !== subcatFilter) return false
      // Compliance filter (multi) — OR logic: item must match at least one selected tag
      if (complianceFilter.length > 0 && !complianceFilter.some(t => (item.tags ?? []).includes(t))) return false
      if (scopeFilter === 'in_scope'     && !item.is_in_scope) return false
      if (scopeFilter === 'not_selected' &&  item.is_in_scope) return false
      if (!q) return true
      return (
        item.name.toLowerCase().includes(q) ||
        (item.subcategory?.toLowerCase().includes(q) ?? false) ||
        item.examples.some(e => e.toLowerCase().includes(q))
      )
    })
  }, [optimisticCatalog, search, levelFilter, subcatFilter, complianceFilter, scopeFilter, labelById])

  const totalInScope = optimisticCatalog.filter(i => i.is_in_scope).length + customTypes.length
  const totalMapped  = optimisticCatalog.filter(i => i.is_in_scope && i.classification_label_id).length

  return (
    <div className="space-y-5 pb-8">
      {showAddModal && <AddCustomModal labels={labels} onClose={() => setShowAddModal(false)} />}

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground/60 mb-2">
            <span>Policies</span><span>›</span><span className="text-muted-foreground">Data Catalog</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-1">Data Catalog</h1>
          <p className="text-muted-foreground/80 text-sm">Mark which data types your organisation handles and assign your classification labels.</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg transition-colors shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          Add custom type
        </button>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total types',     value: optimisticCatalog.length, sub: '5 classification levels' },
          { label: 'In scope',        value: totalInScope,              sub: 'marked by your org',       accent: 'text-blue-400' },
          { label: 'Classified',      value: totalMapped,               sub: `of ${totalInScope} in-scope types`, accent: totalMapped === totalInScope && totalInScope > 0 ? 'text-green-400' : 'text-amber-400' },
        ].map(s => (
          <div key={s.label} className="rounded-xl border border-border bg-card/40 px-5 py-3.5 shadow-sm">
            <p className={cn('text-2xl font-bold', s.accent ?? 'text-foreground')}>{s.value}</p>
            <p className="text-xs font-medium text-muted-foreground mt-0.5">{s.label}</p>
            <p className="text-[10px] text-muted-foreground/60 mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Rules panel */}
      <RulesPanel />

      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search data types, examples…"
            className="w-full bg-muted/60 border border-border-strong rounded-xl pl-8 pr-8 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-border-strong"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-muted-foreground">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        <MultiFilterSelect
          value={levelFilter}
          onChange={setLevelFilter}
          options={levelFilterOptions}
          placeholder="All levels"
        />

        <FilterSelect
          value={subcatFilter}
          onChange={setSubcatFilter}
          options={subcatOptions}
          placeholder="All categories"
        />

        <MultiFilterSelect
          value={complianceFilter}
          onChange={setComplianceFilter}
          options={COMPLIANCE_FILTER_TAGS}
          placeholder="All compliance"
        />

        <FilterSelect
          value={scopeFilter}
          onChange={setScopeFilter}
          options={[{ value: 'in_scope', label: 'In scope' }, { value: 'not_selected', label: 'Not selected' }]}
          placeholder="All types"
          searchable={false}
        />

        {(search || levelFilter.length > 0 || subcatFilter || complianceFilter.length > 0 || scopeFilter) && (
          <button
            onClick={() => { setSearch(''); setLevelFilter([]); setSubcatFilter(''); setComplianceFilter([]); setScopeFilter('') }}
            className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
          >
            Clear all
          </button>
        )}

        <span className="ml-auto text-sm text-muted-foreground/60 whitespace-nowrap">
          {filtered.length} of {optimisticCatalog.length} types
        </span>
      </div>

      {/* Classification sections */}
      <div className="space-y-2">
        {levels.map(level => {
          const sectionItems = filtered.filter(i => i.system_level === level)
          const anyFilterActive = search.length > 0 || subcatFilter !== '' || complianceFilter.length > 0 || levelFilter.length > 0 || scopeFilter !== ''
          const forceExpand = anyFilterActive && sectionItems.length > 0
          return (
          <ClassificationSection
            key={level}
            level={level}
            items={sectionItems}
            labels={labels}
            onToggle={handleToggle}
            onClassify={handleClassify}
            onBulkToggle={handleBulkToggle}
            forceExpand={forceExpand}
          />
          )
        })}

        {/* Custom types */}
        {customTypes.length > 0 && (
          <div className="rounded-xl border border-border overflow-hidden">
            <button
              onClick={() => setCustomSectionOpen(o => !o)}
              className="w-full px-5 py-3 bg-card/60 flex items-center justify-between hover:bg-card/80 transition-colors"
            >
              <p className="text-xs font-semibold text-muted-foreground/80 uppercase tracking-widest">Your custom types</p>
              <div className="flex items-center gap-2">
                <p className="text-xs text-muted-foreground/60">{customTypes.length} added</p>
                <ChevronDown className={cn('w-3.5 h-3.5 text-muted-foreground/40 transition-transform', customSectionOpen && 'rotate-180')} />
              </div>
            </button>
            {customSectionOpen && (
              <table className="w-full border-t border-border">
                <tbody className="divide-y divide-border/40">
                  {customTypes.map(t => (
                    <tr key={t.id} className="hover:bg-card/30 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-start gap-2.5">
                          <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 bg-blue-400" />
                          <div>
                            <p className="text-sm font-medium text-foreground">{t.name}</p>
                            {t.examples.length > 0 && <p className="text-xs text-muted-foreground/60 mt-0.5">{t.examples.slice(0, 3).join('  ·  ')}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 w-44">
                        <ClassificationSelect
                          value={t.classification_label_id}
                          labels={labels}
                          onChange={labelId => handleClassify(t.org_data_type_id, labelId)}
                        />
                      </td>
                      <td className="px-5 py-3.5 w-32 text-right">
                        <span className="text-[10px] text-muted-foreground/60 bg-muted px-2 py-1 rounded-lg border border-border-strong">Custom</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 text-muted-foreground/60 text-sm rounded-xl border border-border">
          No data types match your filters.
          <button onClick={() => { setSearch(''); setLevelFilter([]); setSubcatFilter(''); setComplianceFilter([]); setScopeFilter('') }} className="ml-2 text-blue-400 hover:underline">
            Clear filters
          </button>
        </div>
      )}
    </div>
  )
}
