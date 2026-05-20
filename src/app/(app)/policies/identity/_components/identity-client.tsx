'use client'

import { useState, useTransition, useOptimistic } from 'react'
import { cn } from '@/lib/utils'
import { ChevronDown, ChevronRight, Plus, Pencil, Trash2, Check, X } from 'lucide-react'
import {
  addIdentityMapping,
  updateIdentityMapping,
  deleteIdentityMapping,
  toggleIdentityValueInScope,
} from '../actions'
import type {
  IdentityFieldName,
  IdentitySourceType,
  RiskLevel,
  EnrichedIdentityValue,
  OrgIdentityMapping,
} from '../actions'
import {
  FIELD_LABELS,
  FIELD_DESCRIPTIONS,
  SOURCE_TYPE_LABELS,
} from '../constants'

// ─── Risk badge metadata ───────────────────────────────────────────────────────

const RISK_META: Record<RiskLevel, { label: string; text: string; bg: string; gapBorder: string }> = {
  critical: { label: 'CRITICAL', text: 'text-red-400',    bg: 'bg-red-500/15',    gapBorder: 'border-red-500/40' },
  high:     { label: 'HIGH',     text: 'text-orange-400', bg: 'bg-orange-500/15', gapBorder: 'border-orange-500/40' },
  medium:   { label: 'MEDIUM',   text: 'text-amber-400',  bg: 'bg-amber-500/15',  gapBorder: 'border-border-strong' },
  low:      { label: 'LOW',      text: 'text-green-400',  bg: 'bg-green-500/15',  gapBorder: 'border-border-strong' },
}

const SOURCE_TYPE_OPTIONS: { value: IdentitySourceType; label: string }[] = [
  { value: 'ad_group',     label: 'AD Group' },
  { value: 'ou',           label: 'OU' },
  { value: 'hr_attribute', label: 'HR Attribute' },
  { value: 'okta_group',   label: 'Okta Group' },
  { value: 'google_group', label: 'Google Group' },
  { value: 'custom',       label: 'Custom' },
]

// ─── Optimistic action types ───────────────────────────────────────────────────

type OptAction =
  | { type: 'add';    catalogValueId: string; mapping: OrgIdentityMapping }
  | { type: 'update'; catalogValueId: string; mappingId: string; fields: Partial<OrgIdentityMapping> }
  | { type: 'delete'; catalogValueId: string; mappingId: string }
  | { type: 'toggle'; catalogValueId: string; inScope: boolean }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function applyAction(
  state: Record<IdentityFieldName, EnrichedIdentityValue[]>,
  action: OptAction,
): Record<IdentityFieldName, EnrichedIdentityValue[]> {
  const next = { ...state }
  for (const field of Object.keys(next) as IdentityFieldName[]) {
    next[field] = next[field].map(v => {
      if (v.id !== action.catalogValueId) return v
      switch (action.type) {
        case 'add':
          return { ...v, mappings: [...v.mappings, action.mapping] }
        case 'update':
          return {
            ...v,
            mappings: v.mappings.map(m =>
              m.id === action.mappingId ? { ...m, ...action.fields } : m,
            ),
          }
        case 'delete':
          return { ...v, mappings: v.mappings.filter(m => m.id !== action.mappingId) }
        case 'toggle':
          return { ...v, is_in_scope: action.inScope }
      }
    })
  }
  return next
}

// ─── Add mapping form ─────────────────────────────────────────────────────────

function AddMappingForm({
  catalogValueId,
  onAdd,
  onCancel,
}: {
  catalogValueId: string
  onAdd: (mapping: OrgIdentityMapping) => void
  onCancel: () => void
}) {
  const [sourceName, setSourceName] = useState('')
  const [sourceType, setSourceType] = useState<IdentitySourceType>('ad_group')
  const [notes, setNotes]           = useState('')
  const [saving, setSaving]         = useState(false)
  const [err, setErr]               = useState('')

  async function handleSave() {
    if (!sourceName.trim()) { setErr('Name is required'); return }
    setSaving(true)
    const result = await addIdentityMapping(catalogValueId, sourceName.trim(), sourceType, notes)
    setSaving(false)
    if (result.error) { setErr(result.error); return }
    onAdd({
      id:               result.id!,
      org_id:           '',
      catalog_value_id: catalogValueId,
      source_name:      sourceName.trim(),
      source_type:      sourceType,
      notes:            notes.trim() || null,
      created_at:       new Date().toISOString(),
    })
  }

  return (
    <div className="mt-2 p-3 rounded-lg bg-muted/50 border border-border-strong space-y-2">
      <div className="flex gap-2">
        <input
          value={sourceName}
          onChange={e => { setSourceName(e.target.value); setErr('') }}
          placeholder="e.g. Domain Admins, HR Department OU"
          className="flex-1 px-3 py-1.5 rounded-lg bg-card border border-border-strong text-sm text-foreground/90 placeholder:text-muted-foreground/50 outline-none focus:border-border-strong"
          onKeyDown={e => e.key === 'Enter' && handleSave()}
          autoFocus
        />
        <select
          value={sourceType}
          onChange={e => setSourceType(e.target.value as IdentitySourceType)}
          className="px-3 py-1.5 rounded-lg bg-card border border-border-strong text-sm text-foreground/90 outline-none focus:border-border-strong cursor-pointer"
        >
          {SOURCE_TYPE_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
      <input
        value={notes}
        onChange={e => setNotes(e.target.value)}
        placeholder="Notes (optional)"
        className="w-full px-3 py-1.5 rounded-lg bg-card border border-border-strong text-sm text-foreground/90 placeholder:text-muted-foreground/50 outline-none focus:border-border-strong"
      />
      {err && <p className="text-xs text-red-400">{err}</p>}
      <div className="flex items-center gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-accent hover:bg-accent text-xs text-foreground transition-colors disabled:opacity-50"
        >
          <Check className="w-3 h-3" />
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          onClick={onCancel}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground/90 transition-colors"
        >
          <X className="w-3 h-3" />
          Cancel
        </button>
      </div>
    </div>
  )
}

// ─── Mapping item (view + inline edit) ───────────────────────────────────────

function MappingItem({
  mapping,
  onUpdate,
  onDelete,
}: {
  mapping: OrgIdentityMapping
  onUpdate: (fields: Partial<OrgIdentityMapping>) => void
  onDelete: () => void
}) {
  const [editing, setEditing]       = useState(false)
  const [sourceName, setSourceName] = useState(mapping.source_name)
  const [sourceType, setSourceType] = useState<IdentitySourceType>(mapping.source_type)
  const [notes, setNotes]           = useState(mapping.notes ?? '')
  const [saving, setSaving]         = useState(false)
  const [err, setErr]               = useState('')
  const [, startTransition]         = useTransition()

  async function handleSave() {
    setSaving(true)
    setErr('')
    const result = await updateIdentityMapping(mapping.id, {
      source_name: sourceName.trim(),
      source_type: sourceType,
      notes:       notes.trim() || null,
    })
    setSaving(false)
    if (result.error) { setErr(result.error); return }
    onUpdate({ source_name: sourceName.trim(), source_type: sourceType, notes: notes.trim() || null })
    setEditing(false)
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteIdentityMapping(mapping.id)
      if (!result.error) onDelete()
      else setErr(result.error)
    })
  }

  if (editing) {
    return (
      <div className="p-2.5 rounded-lg bg-muted/50 border border-border-strong space-y-2">
        <div className="flex gap-2">
          <input
            value={sourceName}
            onChange={e => setSourceName(e.target.value)}
            className="flex-1 px-3 py-1.5 rounded-lg bg-card border border-border-strong text-sm text-foreground/90 outline-none focus:border-border-strong"
            onKeyDown={e => e.key === 'Enter' && handleSave()}
            autoFocus
          />
          <select
            value={sourceType}
            onChange={e => setSourceType(e.target.value as IdentitySourceType)}
            className="px-3 py-1.5 rounded-lg bg-card border border-border-strong text-sm text-foreground/90 outline-none focus:border-border-strong cursor-pointer"
          >
            {SOURCE_TYPE_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <input
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Notes (optional)"
          className="w-full px-3 py-1.5 rounded-lg bg-card border border-border-strong text-sm text-foreground/90 placeholder:text-muted-foreground/50 outline-none focus:border-border-strong"
        />
        {err && <p className="text-xs text-red-400">{err}</p>}
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-accent hover:bg-accent text-xs text-foreground transition-colors disabled:opacity-50"
          >
            <Check className="w-3 h-3" />
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            onClick={() => setEditing(false)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground/90 transition-colors"
          >
            <X className="w-3 h-3" />
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-3 px-2.5 py-2 rounded-lg hover:bg-muted/40 group">
      <div className="flex-1 min-w-0">
        <span className="text-sm text-foreground/90 font-medium">{mapping.source_name}</span>
        <span className="ml-2 text-xs text-muted-foreground/80 bg-muted px-1.5 py-0.5 rounded">
          {SOURCE_TYPE_LABELS[mapping.source_type]}
        </span>
        {mapping.notes && (
          <p className="text-xs text-muted-foreground/80 mt-0.5 truncate">{mapping.notes}</p>
        )}
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button
          onClick={() => setEditing(true)}
          className="p-1 rounded hover:bg-accent text-muted-foreground/80 hover:text-foreground/70 transition-colors"
          title="Edit"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handleDelete}
          className="p-1 rounded hover:bg-red-500/20 text-muted-foreground/80 hover:text-red-400 transition-colors"
          title="Delete"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

// ─── Value row ────────────────────────────────────────────────────────────────

function ValueRow({
  value,
  onAdd,
  onUpdate,
  onDelete,
  onToggle,
}: {
  value:    EnrichedIdentityValue
  onAdd:    (mapping: OrgIdentityMapping) => void
  onUpdate: (mappingId: string, fields: Partial<OrgIdentityMapping>) => void
  onDelete: (mappingId: string) => void
  onToggle: (inScope: boolean) => void
}) {
  const [expanded, setExpanded]   = useState(false)
  const [addOpen, setAddOpen]     = useState(false)
  const risk                      = RISK_META[value.risk_level]
  const isGap                     = (value.risk_level === 'critical' || value.risk_level === 'high') && value.mappings.length === 0
  const count                     = value.mappings.length

  function handleAdd(mapping: OrgIdentityMapping) {
    onAdd(mapping)
    setAddOpen(false)
    setExpanded(true)
  }

  return (
    <div className={cn(
      'rounded-lg border transition-colors',
      isGap ? risk.gapBorder : 'border-border',
      expanded ? 'bg-card/60' : 'bg-transparent hover:bg-card/30',
    )}>
      {/* Value header row */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
      >
        {expanded
          ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/80 shrink-0" />
          : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/80 shrink-0" />
        }
        <span className={cn('flex-1 text-sm font-medium', value.is_in_scope ? 'text-foreground/90' : 'text-muted-foreground/80')}>
          {value.value_name}
        </span>
        <span className={cn('text-xs font-semibold px-1.5 py-0.5 rounded shrink-0', risk.text, risk.bg)}>
          {risk.label}
        </span>
        <button
          onClick={e => { e.stopPropagation(); onToggle(!value.is_in_scope) }}
          className={cn(
            'text-xs px-2.5 py-1 rounded-lg border font-medium transition-all shrink-0',
            value.is_in_scope
              ? 'text-blue-400 bg-blue-500/10 border-blue-500/25 hover:bg-blue-500/20'
              : 'text-muted-foreground/60 bg-transparent border-border hover:border-border-strong hover:text-muted-foreground',
          )}
        >
          {value.is_in_scope ? 'In scope ✓' : '+ Add'}
        </button>
        {count > 0 && (
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full shrink-0">
            {count} {count === 1 ? 'mapping' : 'mappings'}
          </span>
        )}
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-3 pb-3 pt-0 space-y-1">
          {value.description && (
            <p className="text-xs text-muted-foreground/80 mb-2 ml-6">{value.description}</p>
          )}
          {value.mappings.length > 0 && (
            <div className="space-y-0.5">
              {value.mappings.map(m => (
                <MappingItem
                  key={m.id}
                  mapping={m}
                  onUpdate={fields => onUpdate(m.id, fields)}
                  onDelete={() => onDelete(m.id)}
                />
              ))}
            </div>
          )}
          {addOpen ? (
            <AddMappingForm
              catalogValueId={value.id}
              onAdd={handleAdd}
              onCancel={() => setAddOpen(false)}
            />
          ) : (
            <button
              onClick={e => { e.stopPropagation(); setAddOpen(true) }}
              className="flex items-center gap-1.5 ml-2 mt-1 text-xs text-muted-foreground/80 hover:text-foreground/70 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add mapping
            </button>
          )}
          {value.risk_note && (
            <p className="text-xs text-muted-foreground/60 italic ml-2 mt-2 border-t border-border pt-2">
              {value.risk_note}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Field card ───────────────────────────────────────────────────────────────

function FieldCard({
  fieldName,
  values,
  onAdd,
  onUpdate,
  onDelete,
  onToggle,
}: {
  fieldName: IdentityFieldName
  values:    EnrichedIdentityValue[]
  onAdd:    (catalogValueId: string, mapping: OrgIdentityMapping) => void
  onUpdate: (catalogValueId: string, mappingId: string, fields: Partial<OrgIdentityMapping>) => void
  onDelete: (catalogValueId: string, mappingId: string) => void
  onToggle: (catalogValueId: string, inScope: boolean) => void
}) {
  const [collapsed, setCollapsed] = useState(true)

  const inScopeCount = values.filter(v => v.is_in_scope).length
  const gapCount     = values.filter(
    v => (v.risk_level === 'critical' || v.risk_level === 'high') && v.mappings.length === 0
  ).length

  return (
    <div className="rounded-xl border border-border bg-card/30 overflow-hidden shadow-sm">
      {/* Card header */}
      <button
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-muted/30 transition-colors"
      >
        {collapsed
          ? <ChevronRight className="w-4 h-4 text-muted-foreground/80 shrink-0" />
          : <ChevronDown className="w-4 h-4 text-muted-foreground/80 shrink-0" />
        }
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-semibold text-foreground">{FIELD_LABELS[fieldName]}</h2>
          <p className="text-xs text-muted-foreground/80 mt-0.5 line-clamp-1">{FIELD_DESCRIPTIONS[fieldName]}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {gapCount > 0 && (
            <span className="text-xs text-amber-500 bg-amber-500/10 border border-amber-500/25 px-2 py-0.5 rounded-full">
              {gapCount} gap{gapCount > 1 ? 's' : ''}
            </span>
          )}
          <span className="text-xs text-muted-foreground">
            {inScopeCount} / {values.length} in scope
          </span>
        </div>
      </button>

      {/* Values list */}
      {!collapsed && (
        <div className="px-4 pb-4 space-y-1.5 border-t border-border">
          <div className="pt-3 space-y-1">
            {values.map(v => (
              <ValueRow
                key={v.id}
                value={v}
                onAdd={mapping => onAdd(v.id, mapping)}
                onUpdate={(mappingId, fields) => onUpdate(v.id, mappingId, fields)}
                onDelete={mappingId => onDelete(v.id, mappingId)}
                onToggle={inScope => onToggle(v.id, inScope)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main client component ────────────────────────────────────────────────────

export function IdentityClient({
  initialFields,
  fieldOrder,
}: {
  initialFields: Record<IdentityFieldName, EnrichedIdentityValue[]>
  fieldOrder:    IdentityFieldName[]
}) {
  const [fields, dispatch] = useOptimistic(
    initialFields,
    (state: Record<IdentityFieldName, EnrichedIdentityValue[]>, action: OptAction) =>
      applyAction(state, action),
  )

  const totalValues    = fieldOrder.reduce((sum, f) => sum + fields[f].length, 0)
  const totalMapped    = fieldOrder.reduce((sum, f) => sum + fields[f].filter(v => v.mappings.length > 0).length, 0)
  const criticalGaps   = fieldOrder.reduce((sum, f) => sum + fields[f].filter(v => v.risk_level === 'critical' && v.mappings.length === 0).length, 0)
  const inScopeTotal   = fieldOrder.reduce((sum, f) => sum + fields[f].filter(v => v.is_in_scope).length, 0)

  const [, startToggleTransition] = useTransition()

  function handleAdd(catalogValueId: string, mapping: OrgIdentityMapping) {
    dispatch({ type: 'add', catalogValueId, mapping })
  }

  function handleUpdate(catalogValueId: string, mappingId: string, upFields: Partial<OrgIdentityMapping>) {
    dispatch({ type: 'update', catalogValueId, mappingId, fields: upFields })
  }

  function handleDelete(catalogValueId: string, mappingId: string) {
    dispatch({ type: 'delete', catalogValueId, mappingId })
  }

  function handleToggle(catalogValueId: string, inScope: boolean) {
    dispatch({ type: 'toggle', catalogValueId, inScope })
    startToggleTransition(async () => {
      const result = await toggleIdentityValueInScope(catalogValueId, !inScope)
      if (result.error) dispatch({ type: 'toggle', catalogValueId, inScope: !inScope })
    })
  }

  return (
    <div>
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total Values',  value: totalValues,  cls: 'text-foreground' },
          { label: 'Mapped',        value: totalMapped,  cls: 'text-emerald-400' },
          { label: 'Critical Gaps', value: criticalGaps, cls: criticalGaps > 0 ? 'text-red-400' : 'text-muted-foreground/80' },
          { label: 'In Scope',      value: inScopeTotal, cls: inScopeTotal > 0 ? 'text-blue-400' : 'text-muted-foreground/80' },
        ].map(stat => (
          <div key={stat.label} className="rounded-xl bg-card border border-border px-4 py-3 shadow-sm">
            <p className={cn('text-2xl font-bold', stat.cls)}>{stat.value}</p>
            <p className="text-xs text-muted-foreground/80 mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground/60 mb-5">
        Mappings are added manually — enter your AD groups, OUs, or HR attributes for each category.
        Automatic sync from Active Directory, Okta, and Entra ID is on the roadmap.
      </p>

      {/* Field cards */}
      <div className="space-y-4">
        {fieldOrder.map(fieldName => (
          <FieldCard
            key={fieldName}
            fieldName={fieldName}
            values={fields[fieldName]}
            onAdd={handleAdd}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
            onToggle={handleToggle}
          />
        ))}
      </div>
    </div>
  )
}
