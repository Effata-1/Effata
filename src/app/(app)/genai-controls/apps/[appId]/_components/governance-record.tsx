'use client'

import { useState, useTransition } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { upsertGovernanceRecord } from '../actions'
import type { GovernanceFields } from '../actions'
import type { ApprovalStatus, ContractStatus, DpaStatus, SecurityReviewStatus, DlpCoverage } from '@/lib/genai/types'

// ── Approval status colours ───────────────────────────────────────────────────

const APPROVAL_STYLES: Record<ApprovalStatus, string> = {
  approved:     'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  'under-review': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  draft:        'bg-muted/60 text-muted-foreground border-border',
  rejected:     'bg-red-500/10 text-red-400 border-red-500/20',
  expired:      'bg-amber-500/10 text-amber-400 border-amber-500/20',
}

// ── Shared field components ───────────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wide mb-0.5">{children}</p>
}

function TextField({ label, value, onChange }: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  const [local, setLocal] = useState(value)
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <input
        value={local}
        onChange={e => setLocal(e.target.value)}
        onBlur={() => { if (local !== value) onChange(local) }}
        placeholder="—"
        className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground/30 border-b border-border/50 focus:border-border focus:outline-none py-0.5 transition-colors"
      />
    </div>
  )
}

function DateField({ label, value, onChange }: {
  label: string
  value: string
  onChange: (v: string | null) => void
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <input
        type="date"
        value={value}
        onChange={e => onChange(e.target.value || null)}
        className="w-full bg-transparent text-xs text-foreground border-b border-border/50 focus:border-border focus:outline-none py-0.5 transition-colors"
      />
    </div>
  )
}

function SelectField<T extends string>({ label, value, options, onChange }: {
  label: string
  value: string
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <select
        value={value}
        onChange={e => onChange(e.target.value as T)}
        className="w-full bg-transparent text-xs text-foreground border-b border-border/50 focus:border-border focus:outline-none py-0.5 transition-colors appearance-none cursor-pointer"
      >
        {options.map(o => (
          <option key={o.value} value={o.value} className="bg-card text-foreground">{o.label}</option>
        ))}
      </select>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface GovernanceInitial {
  business_owner:          string | null
  technical_owner:         string | null
  approval_status:         ApprovalStatus | null
  review_date:             string | null
  next_review_date:        string | null
  contract_status:         ContractStatus | null
  dpa_status:              DpaStatus | null
  security_review_status:  SecurityReviewStatus | null
  tenant_instance_id:      string | null
  dlp_coverage:            DlpCoverage | null
  notes:                   string | null
}

interface Props {
  appId:   string
  initial: GovernanceInitial
}

export function GovernanceRecord({ appId, initial }: Props) {
  const [open, setOpen]   = useState(false)
  const [data, setData]   = useState<GovernanceInitial>(initial)
  const [, startTransition] = useTransition()

  function save(fields: Partial<GovernanceFields>) {
    const merged = { ...data, ...fields }
    setData(merged as typeof data)
    startTransition(async () => {
      await upsertGovernanceRecord(appId, fields)
    })
  }

  const approvalStatus = (data.approval_status ?? 'draft') as ApprovalStatus
  const approvalStyle  = APPROVAL_STYLES[approvalStatus]

  return (
    <div className="rounded-xl border border-border bg-card/50 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-card/80 transition-colors text-left"
      >
        {open
          ? <ChevronDown className="w-4 h-4 text-muted-foreground/50 shrink-0" />
          : <ChevronRight className="w-4 h-4 text-muted-foreground/50 shrink-0" />}
        <h2 className="text-sm font-semibold text-foreground flex-1">Governance Record</h2>
        <span className={cn('text-[10px] font-bold px-2.5 py-0.5 rounded border', approvalStyle)}>
          {approvalStatus.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase())}
        </span>
      </button>

      {open && (
        <div className="border-t border-border/60 px-5 pb-5 pt-4 space-y-5">

          {/* Ownership */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground/70 mb-3">Ownership</p>
            <div className="grid grid-cols-2 gap-4">
              <TextField
                label="Business Owner"
                value={data.business_owner ?? ''}
                onChange={v => save({ business_owner: v })}
              />
              <TextField
                label="Technical Owner"
                value={data.technical_owner ?? ''}
                onChange={v => save({ technical_owner: v })}
              />
            </div>
          </div>

          {/* Approval & Review */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground/70 mb-3">Approval & Review</p>
            <div className="grid grid-cols-3 gap-4">
              <SelectField<ApprovalStatus>
                label="Approval Status"
                value={approvalStatus}
                options={[
                  { value: 'draft',        label: 'Draft' },
                  { value: 'under-review', label: 'Under Review' },
                  { value: 'approved',     label: 'Approved' },
                  { value: 'rejected',     label: 'Rejected' },
                  { value: 'expired',      label: 'Expired' },
                ]}
                onChange={v => save({ approval_status: v })}
              />
              <DateField
                label="Review Date"
                value={data.review_date ?? ''}
                onChange={v => save({ review_date: v })}
              />
              <DateField
                label="Next Review Date"
                value={data.next_review_date ?? ''}
                onChange={v => save({ next_review_date: v })}
              />
            </div>
          </div>

          {/* Contract & Compliance */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground/70 mb-3">Contract & Compliance</p>
            <div className="grid grid-cols-3 gap-4">
              <SelectField<ContractStatus>
                label="Contract Status"
                value={data.contract_status ?? 'unknown'}
                options={[
                  { value: 'enterprise',    label: 'Enterprise' },
                  { value: 'free-tier',     label: 'Free Tier' },
                  { value: 'user-managed',  label: 'User Managed' },
                  { value: 'unknown',       label: 'Unknown' },
                ]}
                onChange={v => save({ contract_status: v })}
              />
              <SelectField<DpaStatus>
                label="DPA / Privacy Review"
                value={data.dpa_status ?? 'unknown'}
                options={[
                  { value: 'approved',     label: 'Approved' },
                  { value: 'pending',      label: 'Pending' },
                  { value: 'not-required', label: 'Not Required' },
                  { value: 'failed',       label: 'Failed' },
                  { value: 'unknown',      label: 'Unknown' },
                ]}
                onChange={v => save({ dpa_status: v })}
              />
              <SelectField<SecurityReviewStatus>
                label="Security Review"
                value={data.security_review_status ?? 'unknown'}
                options={[
                  { value: 'approved', label: 'Approved' },
                  { value: 'pending',  label: 'Pending' },
                  { value: 'failed',   label: 'Failed' },
                  { value: 'unknown',  label: 'Unknown' },
                ]}
                onChange={v => save({ security_review_status: v })}
              />
            </div>
          </div>

          {/* DLP & Access */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground/70 mb-3">DLP & Access</p>
            <div className="grid grid-cols-2 gap-4">
              <TextField
                label="Tenant / Instance ID"
                value={data.tenant_instance_id ?? ''}
                onChange={v => save({ tenant_instance_id: v })}
              />
              <SelectField<DlpCoverage>
                label="DLP Coverage"
                value={data.dlp_coverage ?? 'requires-validation'}
                options={[
                  { value: 'supported',             label: 'Supported' },
                  { value: 'partial',               label: 'Partial' },
                  { value: 'not-supported',         label: 'Not Supported' },
                  { value: 'requires-validation',   label: 'Requires Validation' },
                ]}
                onChange={v => save({ dlp_coverage: v })}
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <FieldLabel>Notes</FieldLabel>
            <NoteField value={data.notes ?? ''} onSave={v => save({ notes: v })} />
          </div>

        </div>
      )}
    </div>
  )
}

// Textarea with save-on-blur to avoid re-render on every keystroke
function NoteField({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [local, setLocal] = useState(value)
  return (
    <textarea
      value={local}
      onChange={e => setLocal(e.target.value)}
      onBlur={() => { if (local !== value) onSave(local) }}
      placeholder="Add notes…"
      rows={2}
      className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground/30 border border-border/50 rounded-md px-2 py-1.5 focus:border-border focus:outline-none resize-none transition-colors"
    />
  )
}
