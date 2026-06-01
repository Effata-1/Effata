'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { colorClasses, COLOR_OPTIONS, SYSTEM_LEVEL_META } from '@/lib/data-catalog/types'
import type { SystemLevel } from '@/lib/data-catalog/types'
import { Pencil, Plus, Check, X, Tag } from 'lucide-react'
import { upsertCustomerLabel, deactivateCustomerLabel } from '../actions'

export interface CustomerSensitivityLabel {
  id:           string
  display_name: string
  label_key:    string | null
  label_value:  string
  label_source: string
  color:        string
  system_level: string | null
  priority:     number
}

const SOURCE_OPTIONS = [
  { value: 'mip',          label: 'Microsoft Purview / MIP' },
  { value: 'titus',        label: 'TITUS' },
  { value: 'boldon-james', label: 'Boldon James' },
  { value: 'custom',       label: 'Custom' },
]

const SOURCE_BADGE: Record<string, string> = {
  'mip':          'bg-blue-500/10 text-blue-400 border-blue-500/20',
  'titus':        'bg-purple-500/10 text-purple-400 border-purple-500/20',
  'boldon-james': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  'custom':       'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
}

const SYSTEM_LEVEL_OPTIONS: { value: SystemLevel | ''; label: string }[] = [
  { value: '',                  label: '— Not mapped —' },
  { value: 'secret',            label: 'Secret' },
  { value: 'highly_confidential', label: 'Highly Confidential' },
  { value: 'confidential',      label: 'Confidential' },
  { value: 'internal',          label: 'Internal' },
  { value: 'public',            label: 'Public' },
]

// ── Inline label form ─────────────────────────────────────────────────────────

interface LabelFormFields {
  display_name: string; label_key: string | null; label_value: string
  label_source: string; color: string; system_level: string | null
}

interface LabelFormProps {
  initial:  LabelFormFields
  onSave:   (fields: LabelFormFields) => Promise<string | undefined>
  onCancel: () => void
}

function LabelForm({ initial, onSave, onCancel }: LabelFormProps) {
  const [displayName,  setDisplayName]  = useState(initial.display_name)
  const [labelKey,     setLabelKey]     = useState(initial.label_key ?? '')
  const [labelValue,   setLabelValue]   = useState(initial.label_value)
  const [labelSource,  setLabelSource]  = useState(initial.label_source)
  const [color,        setColor]        = useState(initial.color)
  const [systemLevel,  setSystemLevel]  = useState(initial.system_level ?? '')
  const [formError,    setFormError]    = useState<string | null>(null)

  async function submit() {
    if (!displayName.trim()) { setFormError('Display name is required.'); return }
    setFormError(null)
    const serverError = await onSave({
      display_name: displayName.trim(),
      label_key:    labelKey.trim() || null,
      label_value:  labelValue.trim() || 'True',
      label_source: labelSource,
      color,
      system_level: systemLevel || null,
    })
    if (serverError) setFormError(serverError)
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Display name */}
        <div>
          <label className="block text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wide mb-1">Display Name</label>
          <input
            autoFocus
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onCancel() }}
            placeholder="e.g. Highly Confidential"
            className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        {/* Source */}
        <div>
          <label className="block text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wide mb-1">Source</label>
          <select
            value={labelSource}
            onChange={e => setLabelSource(e.target.value)}
            className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {SOURCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {/* Label key */}
        <div>
          <label className="block text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wide mb-1">Metadata Key</label>
          <input
            value={labelKey ?? ''}
            onChange={e => setLabelKey(e.target.value)}
            placeholder="e.g. MSIP_Label_xxx_Enabled"
            className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring font-mono text-xs"
          />
        </div>

        {/* Label value */}
        <div>
          <label className="block text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wide mb-1">Metadata Value</label>
          <input
            value={labelValue}
            onChange={e => setLabelValue(e.target.value)}
            placeholder="True"
            className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring font-mono text-xs"
          />
        </div>

        {/* Effata level mapping */}
        <div>
          <label className="block text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wide mb-1">Maps to Effata Level</label>
          <select
            value={systemLevel}
            onChange={e => setSystemLevel(e.target.value)}
            className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {SYSTEM_LEVEL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {/* Color */}
        <div>
          <label className="block text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wide mb-1">Color</label>
          <div className="flex gap-1.5 flex-wrap pt-1">
            {COLOR_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setColor(opt.value)}
                className={cn('w-4 h-4 rounded-full transition-transform', opt.class, color === opt.value ? 'ring-2 ring-offset-1 ring-offset-card ring-white/40 scale-125' : 'opacity-60 hover:opacity-100')}
                title={opt.label}
              />
            ))}
          </div>
        </div>
      </div>

      {formError && (
        <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{formError}</p>
      )}

      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={submit}
          disabled={!displayName.trim()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20 text-xs font-medium hover:bg-primary/20 transition-colors disabled:opacity-40"
        >
          <Check className="w-3.5 h-3.5" /> Save
        </button>
        <button
          onClick={onCancel}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-muted-foreground/70 hover:text-foreground/70 transition-colors"
        >
          <X className="w-3.5 h-3.5" /> Cancel
        </button>
      </div>
    </div>
  )
}

// ── Label row (display mode) ──────────────────────────────────────────────────

function LabelRow({ label, onEdit, onDeactivate }: {
  label:        CustomerSensitivityLabel
  onEdit:       () => void
  onDeactivate: () => void
}) {
  const cc          = colorClasses(label.color)
  const sourceMeta  = SOURCE_OPTIONS.find(s => s.value === label.label_source)
  const levelMeta   = label.system_level ? SYSTEM_LEVEL_META[label.system_level as SystemLevel] : null

  return (
    <tr className="border-b border-border/40 last:border-0 hover:bg-muted/10 transition-colors group">
      <td className="px-5 py-3">
        <div className="flex items-center gap-2">
          <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', cc.dot)} />
          <span className={cn('text-sm font-semibold', cc.text)}>{label.display_name}</span>
        </div>
      </td>
      <td className="px-5 py-3">
        {label.label_key ? (
          <>
            <span className="font-mono text-xs text-muted-foreground/70 break-all">{label.label_key}</span>
            <span className="ml-2 text-[10px] text-muted-foreground/40 font-mono">= {label.label_value}</span>
          </>
        ) : (
          <span className="text-xs text-muted-foreground/30 italic">No key configured</span>
        )}
      </td>
      <td className="px-4 py-3">
        <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded border', SOURCE_BADGE[label.label_source] ?? SOURCE_BADGE['custom'])}>
          {sourceMeta?.label ?? label.label_source}
        </span>
      </td>
      <td className="px-4 py-3">
        {levelMeta ? (
          <span className="text-xs font-medium text-muted-foreground/70">{levelMeta.label}</span>
        ) : (
          <span className="text-xs text-muted-foreground/30 italic">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={onEdit} className="text-muted-foreground/40 hover:text-muted-foreground/80 transition-colors">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={onDeactivate} className="text-muted-foreground/30 hover:text-red-400 transition-colors" title="Remove label">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
    </tr>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function SensitivityLabelsClient({ initialLabels }: { initialLabels: CustomerSensitivityLabel[] }) {
  const [labels,    setLabels]    = useState<CustomerSensitivityLabel[]>(initialLabels)
  const [editingId, setEditingId] = useState<string | 'new' | null>(null)

  async function handleSave(id: string | null, fields: LabelFormFields): Promise<string | undefined> {
    const priority = id ? (labels.find(l => l.id === id)?.priority ?? labels.length + 1) : labels.length + 1
    const result = await upsertCustomerLabel(id, { ...fields, priority })
    if (result.error) {
      // Surface duplicate key constraint as a readable message
      const msg = result.error.includes('unique') || result.error.includes('duplicate')
        ? `A label with Metadata Key "${fields.label_key}" already exists. Each label must have a unique key.`
        : result.error
      return msg
    }
    if (id) {
      setLabels(prev => prev.map(l => l.id === id ? { ...l, ...fields } : l))
    } else {
      setLabels(prev => [...prev, { id: crypto.randomUUID(), ...fields, priority }])
    }
    setEditingId(null)
    return undefined
  }

  function handleDeactivate(id: string) {
    setLabels(prev => prev.filter(l => l.id !== id))
    void deactivateCustomerLabel(id)
  }

  return (
    <div className="space-y-4">
      {/* Table */}
      <div className="rounded-xl border border-border bg-card/50 overflow-hidden shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-card/80">
              <th className="text-left text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wide px-5 py-3">Display Name</th>
              <th className="text-left text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wide px-5 py-3">Metadata Key = Value</th>
              <th className="text-left text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wide px-4 py-3">Source</th>
              <th className="text-left text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wide px-4 py-3">Effata Level</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {labels.length === 0 && editingId !== 'new' && (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center">
                  <p className="text-sm text-muted-foreground/40">No sensitivity labels added yet.</p>
                  <p className="text-xs text-muted-foreground/30 mt-1">Add your MIP or custom labels to enable label-based detection in the Control Matrix.</p>
                </td>
              </tr>
            )}

            {labels.map(label =>
              editingId === label.id ? (
                <tr key={label.id}>
                  <td colSpan={5} className="px-5 py-3">
                    <LabelForm
                      initial={{ display_name: label.display_name, label_key: label.label_key, label_value: label.label_value, label_source: label.label_source, color: label.color, system_level: label.system_level }}
                      onSave={fields => handleSave(label.id, fields)}
                      onCancel={() => setEditingId(null)}
                    />
                  </td>
                </tr>
              ) : (
                <LabelRow
                  key={label.id}
                  label={label}
                  onEdit={() => setEditingId(label.id)}
                  onDeactivate={() => handleDeactivate(label.id)}
                />
              )
            )}

            {editingId === 'new' && (
              <tr>
                <td colSpan={5} className="px-5 py-3">
                  <LabelForm
                    initial={{ display_name: '', label_key: '', label_value: 'True', label_source: 'mip', color: 'zinc', system_level: null }}
                    onSave={fields => handleSave(null, fields)}
                    onCancel={() => setEditingId(null)}
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add button */}
      {editingId !== 'new' && (
        <button
          onClick={() => setEditingId('new')}
          className="flex items-center gap-1.5 text-sm text-muted-foreground/60 hover:text-muted-foreground/90 transition-colors"
        >
          <Plus className="w-4 h-4" /> Add sensitivity label
        </button>
      )}

      {/* Help callout */}
      <div className="rounded-xl border border-border/40 bg-muted/10 p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Tag className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
          <p className="text-xs font-semibold text-muted-foreground/70">What are Metadata Key and Value?</p>
        </div>
        <p className="text-xs text-muted-foreground/60 leading-relaxed">
          <strong className="text-foreground/60">Metadata Key</strong> is the file property your DLP tool reads (e.g. <code className="font-mono text-[11px] bg-muted/30 px-1 rounded">MSIP_Label_xxxxxxxx_Enabled</code> for MIP). <strong className="text-foreground/60">Metadata Value</strong> is the value to match — usually <code className="font-mono text-[11px] bg-muted/30 px-1 rounded">True</code> or <code className="font-mono text-[11px] bg-muted/30 px-1 rounded">1</code>. Check with your Microsoft Purview or classification tool admin for the exact format your DLP solution reads.
        </p>
        <p className="text-xs text-muted-foreground/50">
          <strong className="text-foreground/50">Effata Level mapping</strong> links this label to an Effata sensitivity tier. This determines which Control Matrix defaults apply and how strictly the label is treated during policy generation.
          Sensitivity order (highest → lowest): <span className="font-mono text-[10px]">Secret → Highly Confidential → Confidential → Internal → Public</span>.
          Labels mapped to higher tiers get stricter default actions (block/coach vs monitor/allow).
        </p>
      </div>
    </div>
  )
}
