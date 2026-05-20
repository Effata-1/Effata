'use client'

import { useState, useTransition, useOptimistic } from 'react'
import { cn } from '@/lib/utils'
import { ChevronDown, ChevronRight, Plus, Pencil, Trash2, Check, X } from 'lucide-react'
import {
  addIdentityMapping,
  updateIdentityMapping,
  deleteIdentityMapping,
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
import { FilterSelect } from '@/components/ui/filter-select'

// ─── Risk badge metadata ───────────────────────────────────────────────────────

const RISK_META: Record<RiskLevel, { label: string; text: string; bg: string; gapBorder: string }> = {
  critical: { label: 'CRITICAL', text: 'text-red-400',    bg: 'bg-red-500/15',    gapBorder: 'border-red-500/40' },
  high:     { label: 'HIGH',     text: 'text-orange-400', bg: 'bg-orange-500/15', gapBorder: 'border-orange-500/40' },
  medium:   { label: 'MEDIUM',   text: 'text-amber-400',  bg: 'bg-amber-500/15',  gapBorder: 'border-zinc-700' },
  low:      { label: 'LOW',      text: 'text-green-400',  bg: 'bg-green-500/15',  gapBorder: 'border-zinc-700' },
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
    <div className="mt-2 p-3 rounded-lg bg-zinc-800/50 border border-zinc-700 space-y-2">
      <div className="flex gap-2">
        <input
          value={sourceName}
          onChange={e => { setSourceName(e.target.value); setErr('') }}
          placeholder="e.g. Domain Admins, HR Department OU"
          className="flex-1 px-3 py-1.5 rounded-md bg-zinc-900 border border-zinc-700 text-sm text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-zinc-500"
          onKeyDown={e => e.key === 'Enter' && handleSave()}
          autoFocus
        />
        <div className="w-36">
          <FilterSelect
            placeholder="Source type"
            value={sourceType}
            onChange={v => setSourceType(v as IdentitySourceType)}
            options={SOURCE_TYPE_OPTIONS}
          />
        </div>
      </div>
      <input
        value={notes}
        onChange={e => setNotes(e.target.value)}
        placeholder="Notes (optional)"
        className="w-full px-3 py-1.5 rounded-md bg-zinc-900 border border-zinc-700 text-sm text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-zinc-500"
      />
      {err && <p className="text-xs text-red-400">{err}</p>}
      <div className="flex items-center gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-zinc-700 hover:bg-zinc-600 text-xs text-white transition-colors disabled:opacity-50"
        >
          <Check className="w-3 h-3" />
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          onClick={onCancel}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
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
  const [, startTransition]         = useTransition()

  async function handleSave() {
    setSaving(true)
    await updateIdentityMapping(mapping.id, {
      source_name: sourceName.trim(),
      source_type: sourceType,
      notes:       notes.trim() || null,
    })
    setSaving(false)
    onUpdate({ source_name: sourceName.trim(), source_type: sourceType, notes: notes.trim() || null })
    setEditing(false)
  }

  function handleDelete() {
    startTransition(() => {
      deleteIdentityMapping(mapping.id)
    })
    onDelete()
  }

  if (editing) {
    return (
      <div className="p-2.5 rounded-lg bg-zinc-800/50 border border-zinc-700 space-y-2">
        <div className="flex gap-2">
          <input
            value={sourceName}
            onChange={e => setSourceName(e.target.value)}
            className="flex-1 px-3 py-1.5 rounded-md bg-zinc-900 border border-zinc-700 text-sm text-zinc-200 outline-none focus:border-zinc-500"
            onKeyDown={e => e.key === 'Enter' && handleSave()}
            autoFocus
          />
          <div className="w-36">
            <FilterSelect
              placeholder="Source type"
              value={sourceType}
              onChange={v => setSourceType(v as IdentitySourceType)}
              options={SOURCE_TYPE_OPTIONS}
            />
          </div>
        </div>
        <input
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Notes (optional)"
          className="w-full px-3 py-1.5 rounded-md bg-zinc-900 border border-zinc-700 text-sm text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-zinc-500"
        />
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-zinc-700 hover:bg-zinc-600 text-xs text-white transition-colors disabled:opacity-50"
          >
            <Check className="w-3 h-3" />
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            onClick={() => setEditing(false)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <X className="w-3 h-3" />
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-3 px-2.5 py-2 rounded-lg hover:bg-zinc-800/40 group">
      <div className="flex-1 min-w-0">
        <span className="text-sm text-zinc-200 font-medium">{mapping.source_name}</span>
        <span className="ml-2 text-xs text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded">
          {SOURCE_TYPE_LABELS[mapping.source_type]}
        </span>
        {mapping.notes && (
          <p className="text-xs text-zinc-500 mt-0.5 truncate">{mapping.notes}</p>
        )}
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button
          onClick={() => setEditing(true)}
          className="p-1 rounded hover:bg-zinc-700 text-zinc-500 hover:text-zinc-300 transition-colors"
          title="Edit"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handleDelete}
          className="p-1 rounded hover:bg-red-500/20 text-zinc-500 hover:text-red-400 transition-colors"
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
}: {
  value: EnrichedIdentityValue
  onAdd:    (mapping: OrgIdentityMapping) => void
  onUpdate: (mappingId: string, fields: Partial<OrgIdentityMapping>) => void
  onDelete: (mappingId: string) => void
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
      isGap ? risk.gapBorder : 'border-zinc-800',
      expanded ? 'bg-zinc-900/60' : 'bg-transparent hover:bg-zinc-900/30',
    )}>
      {/* Value header row */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
      >
        {expanded
          ? <ChevronDown className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
          : <ChevronRight className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
        }
        <span className="flex-1 text-sm text-zinc-200 font-medium">{value.value_name}</span>
        {isGap && (
          <span className="text-xs text-amber-500 mr-2">no mappings</span>
        )}
        <span className={cn('text-xs font-semibold px-1.5 py-0.5 rounded shrink-0', risk.text, risk.bg)}>
          {risk.label}
        </span>
        {count > 0 && (
          <span className="text-xs text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded-full shrink-0 ml-1">
            {count} {count === 1 ? 'mapping' : 'mappings'}
          </span>
        )}
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-3 pb-3 pt-0 space-y-1">
          {value.description && (
            <p className="text-xs text-zinc-500 mb-2 ml-6">{value.description}</p>
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
              className="flex items-center gap-1.5 ml-2 mt-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add mapping
            </button>
          )}
          {value.risk_note && (
            <p className="text-xs text-zinc-600 italic ml-2 mt-2 border-t border-zinc-800 pt-2">
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
}: {
  fieldName: IdentityFieldName
  values:    EnrichedIdentityValue[]
  onAdd:    (catalogValueId: string, mapping: OrgIdentityMapping) => void
  onUpdate: (catalogValueId: string, mappingId: string, fields: Partial<OrgIdentityMapping>) => void
  onDelete: (catalogValueId: string, mappingId: string) => void
}) {
  const [collapsed, setCollapsed] = useState(false)

  const mappedCount = values.filter(v => v.mappings.length > 0).length
  const gapCount    = values.filter(
    v => (v.risk_level === 'critical' || v.risk_level === 'high') && v.mappings.length === 0
  ).length

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 overflow-hidden">
      {/* Card header */}
      <button
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-zinc-800/30 transition-colors"
      >
        {collapsed
          ? <ChevronRight className="w-4 h-4 text-zinc-500 shrink-0" />
          : <ChevronDown className="w-4 h-4 text-zinc-500 shrink-0" />
        }
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-semibold text-white">{FIELD_LABELS[fieldName]}</h2>
          <p className="text-xs text-zinc-500 mt-0.5 line-clamp-1">{FIELD_DESCRIPTIONS[fieldName]}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {gapCount > 0 && (
            <span className="text-xs text-amber-500 bg-amber-500/10 border border-amber-500/25 px-2 py-0.5 rounded-full">
              {gapCount} gap{gapCount > 1 ? 's' : ''}
            </span>
          )}
          <span className="text-xs text-zinc-400">
            {mappedCount} / {values.length} mapped
          </span>
        </div>
      </button>

      {/* Values list */}
      {!collapsed && (
        <div className="px-4 pb-4 space-y-1.5 border-t border-zinc-800">
          <div className="pt-3 space-y-1">
            {values.map(v => (
              <ValueRow
                key={v.id}
                value={v}
                onAdd={mapping => onAdd(v.id, mapping)}
                onUpdate={(mappingId, fields) => onUpdate(v.id, mappingId, fields)}
                onDelete={mappingId => onDelete(v.id, mappingId)}
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

  const totalMapped = fieldOrder.reduce(
    (sum, f) => sum + fields[f].filter(v => v.mappings.length > 0).length,
    0,
  )
  const totalValues = fieldOrder.reduce((sum, f) => sum + fields[f].length, 0)
  const totalGaps   = fieldOrder.reduce(
    (sum, f) => sum + fields[f].filter(
      v => (v.risk_level === 'critical' || v.risk_level === 'high') && v.mappings.length === 0
    ).length,
    0,
  )

  function handleAdd(catalogValueId: string, mapping: OrgIdentityMapping) {
    dispatch({ type: 'add', catalogValueId, mapping })
  }

  function handleUpdate(catalogValueId: string, mappingId: string, upFields: Partial<OrgIdentityMapping>) {
    dispatch({ type: 'update', catalogValueId, mappingId, fields: upFields })
  }

  function handleDelete(catalogValueId: string, mappingId: string) {
    dispatch({ type: 'delete', catalogValueId, mappingId })
  }

  return (
    <div>
      {/* Summary bar */}
      <div className="flex items-center gap-4 mb-6 px-1">
        <div className="text-sm text-zinc-400">
          <span className="text-white font-medium">{totalMapped}</span>
          <span className="text-zinc-600"> / </span>
          <span>{totalValues} values mapped</span>
        </div>
        {totalGaps > 0 && (
          <div className="flex items-center gap-1.5 text-sm text-amber-500">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
            {totalGaps} high-priority gap{totalGaps > 1 ? 's' : ''} — critical or high-risk values with no mappings
          </div>
        )}
      </div>

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
          />
        ))}
      </div>
    </div>
  )
}
