'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle, Circle, XCircle, AlertTriangle, ChevronDown, ChevronRight, Save, Trash2 } from 'lucide-react'
import { upsertVendorMapping, deleteVendorMapping, toggleMappingVerified, markMappingNotApplicable } from '../../actions'
import type { OrgVendorObjectMappingRow, ReadinessCheckResult } from '../_lib/readiness'

interface Category {
  id:         string
  name:       string
  system_tag: string | null
}

interface OrgLabel {
  id:           string
  display_name: string
  label_key:    string
  label_source: string
}

interface Props {
  mappings:         OrgVendorObjectMappingRow[]
  categories:       Category[]
  sensitivityLevels: string[]
  orgLabels:        OrgLabel[]
  readiness:        ReadinessCheckResult
}

type MappingPurpose = 'destination_scope' | 'detection_profile' | 'notification' | 'exception' | 'evidence' | 'policy_order'
type MappingQuality = 'exact' | 'lossy' | 'customer_verified' | 'unverified'

const SENSITIVITY_DISPLAY: Record<string, string> = {
  'secret':             'Secret',
  'highly-confidential': 'Highly Confidential',
  'confidential':       'Confidential',
  'internal':           'Internal',
  'public':             'Public',
}

function MappingRow({
  label,
  hint,
  neutral_object_type,
  neutral_object_key,
  vendor_object_type,
  mapping_purpose,
  existingMapping,
  onSaved,
}: {
  label:               string
  hint:                string
  neutral_object_type: string
  neutral_object_key:  string
  vendor_object_type:  string
  mapping_purpose:     MappingPurpose
  existingMapping?:    OrgVendorObjectMappingRow
  onSaved:             () => void
}) {
  const [vendorName, setVendorName]         = useState(existingMapping?.vendor_object_name ?? '')
  const [vendorId, setVendorId]             = useState(existingMapping?.vendor_object_id ?? '')
  const [quality, setQuality]               = useState<MappingQuality>((existingMapping?.mapping_quality as MappingQuality) ?? 'unverified')
  const [verificationNote, setVerNote]      = useState(existingMapping?.verification_note ?? '')
  const [showNoteField, setShowNoteField]   = useState(false)
  const [isPending, startTransition]        = useTransition()
  const [error, setError]                   = useState<string | null>(null)

  const isVerified    = existingMapping?.verified ?? false
  const isNotApplicable = existingMapping?.not_applicable ?? false

  function handleSave() {
    if (!vendorName.trim()) return
    setError(null)
    startTransition(async () => {
      const result = await upsertVendorMapping({
        vendor_id:           'netskope',
        neutral_object_type,
        neutral_object_key,
        neutral_object_display_name: label,
        vendor_object_type,
        vendor_object_name:  vendorName.trim(),
        vendor_object_id:    vendorId.trim() || undefined,
        mapping_quality:     quality,
        mapping_purpose,
        verification_note:   verificationNote.trim() || undefined,
      })
      if (result.error) setError(result.error)
      else onSaved()
    })
  }

  function handleDelete() {
    if (!existingMapping) return
    setError(null)
    startTransition(async () => {
      const result = await deleteVendorMapping(existingMapping.id)
      if (result.error) setError(result.error)
      else {
        setVendorName('')
        setVendorId('')
        onSaved()
      }
    })
  }

  function handleToggleVerify() {
    if (!existingMapping) return
    const newVerified = !isVerified
    if (newVerified && quality === 'lossy' && !verificationNote.trim()) {
      setShowNoteField(true)
      setError('A verification note is required for lossy mappings.')
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await toggleMappingVerified(existingMapping.id, newVerified, verificationNote.trim() || undefined)
      if (result.error) setError(result.error)
      else onSaved()
    })
  }

  function handleToggleNotApplicable() {
    if (!existingMapping) {
      // No row yet — create one then immediately mark it not_applicable so the boolean is set.
      setError(null)
      startTransition(async () => {
        const upsertResult = await upsertVendorMapping({
          vendor_id:           'netskope',
          neutral_object_type,
          neutral_object_key,
          neutral_object_display_name: label,
          vendor_object_type,
          vendor_object_name:  'N/A',
          mapping_quality:     'unverified',
          mapping_purpose,
        })
        if (upsertResult.error) { setError(upsertResult.error); return }
        const naResult = await markMappingNotApplicable(upsertResult.id!, true)
        if (naResult.error) setError(naResult.error)
        else onSaved()
      })
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await markMappingNotApplicable(existingMapping.id, !isNotApplicable)
      if (result.error) setError(result.error)
      else onSaved()
    })
  }

  const statusIcon = isNotApplicable   ? <XCircle className="h-4 w-4 text-muted-foreground/50" />
    : isVerified                       ? <CheckCircle className="h-4 w-4 text-green-500" />
    : existingMapping                  ? <AlertTriangle className="h-4 w-4 text-amber-500" />
    :                                    <Circle className="h-4 w-4 text-muted-foreground/30" />

  return (
    <div className={`rounded-md border p-3 space-y-2 text-sm ${isNotApplicable ? 'opacity-50' : ''}`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0">{statusIcon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium">{label}</span>
            <span className="text-xs text-muted-foreground/60">{hint}</span>
          </div>

          {!isNotApplicable && (
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <input
                type="text"
                value={vendorName}
                onChange={e => setVendorName(e.target.value)}
                placeholder="Netskope object name"
                disabled={isPending}
                className="h-7 flex-1 min-w-36 rounded border bg-background px-2 text-xs placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <input
                type="text"
                value={vendorId}
                onChange={e => setVendorId(e.target.value)}
                placeholder="Object ID (optional)"
                disabled={isPending}
                className="h-7 w-40 rounded border bg-background px-2 text-xs placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <select
                value={quality}
                onChange={e => setQuality(e.target.value as MappingQuality)}
                disabled={isPending}
                className="h-7 rounded border bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="exact">Exact</option>
                <option value="customer_verified">Customer verified</option>
                <option value="lossy">Lossy</option>
                <option value="unverified">Unverified</option>
              </select>
              <button
                onClick={handleSave}
                disabled={isPending || !vendorName.trim()}
                className="h-7 inline-flex items-center gap-1 rounded border bg-primary px-2 text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                <Save className="h-3 w-3" />
                Save
              </button>
              {existingMapping && (
                <>
                  <button
                    onClick={handleToggleVerify}
                    disabled={isPending}
                    className={`h-7 inline-flex items-center gap-1 rounded border px-2 text-xs disabled:opacity-50 ${
                      isVerified ? 'bg-green-50 text-green-700 border-green-200' : 'bg-background hover:bg-muted'
                    }`}
                  >
                    {isVerified ? 'Verified' : 'Mark verified'}
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={isPending}
                    className="h-7 inline-flex items-center gap-1 rounded border px-2 text-xs text-destructive hover:bg-destructive/10 disabled:opacity-50"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </>
              )}
            </div>
          )}

          {(showNoteField || (quality === 'lossy' && existingMapping)) && !isNotApplicable && (
            <input
              type="text"
              value={verificationNote}
              onChange={e => setVerNote(e.target.value)}
              placeholder="Verification note (required for lossy mappings)"
              className="mt-1.5 h-7 w-full rounded border bg-background px-2 text-xs placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring"
            />
          )}

          {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
        </div>

        <button
          onClick={handleToggleNotApplicable}
          disabled={isPending}
          className="shrink-0 text-xs text-muted-foreground/60 hover:text-muted-foreground disabled:opacity-50 whitespace-nowrap"
          title={isNotApplicable ? 'Mark as required' : 'Mark not applicable'}
        >
          {isNotApplicable ? 'Required' : 'N/A'}
        </button>
      </div>
    </div>
  )
}

function Section({
  title,
  children,
  defaultOpen = true,
}: {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="rounded-lg border bg-card">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold hover:bg-muted/50"
      >
        {title}
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>
      {open && <div className="px-4 pb-4 space-y-2">{children}</div>}
    </div>
  )
}

export function NetskopeVendorMappingClient({
  mappings: initialMappings,
  categories,
  sensitivityLevels,
  orgLabels,
  readiness,
}: Props) {
  const [mappings]          = useState(initialMappings)
  const [, startTransition] = useTransition()
  const router              = useRouter()

  function findMapping(
    neutral_object_type: string,
    neutral_object_key: string,
  ): OrgVendorObjectMappingRow | undefined {
    return mappings.find(
      m => m.neutral_object_type === neutral_object_type && m.neutral_object_key === neutral_object_key,
    )
  }

  function handleSaved() {
    startTransition(() => { router.refresh() })
  }

  return (
    <div className="space-y-4">
      {/* Readiness summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {([
          ['App Categories', readiness.mapping_summary.app_categories],
          ['DLP Profiles',   readiness.mapping_summary.dlp_profiles],
          ['Labels',         readiness.mapping_summary.labels],
          ['Notifications',  readiness.mapping_summary.notification_templates],
        ] as const).map(([label, summary]) => (
          <div key={label} className="rounded-md border bg-card p-3 text-center">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 text-lg font-bold">
              {summary.mapped + summary.not_applicable}/{summary.total}
            </p>
            <p className="text-xs text-muted-foreground/60">
              {summary.not_applicable > 0 ? `(${summary.not_applicable} N/A)` : 'configured'}
            </p>
          </div>
        ))}
      </div>

      {/* App Category Mappings */}
      <Section title="App Category Mappings">
        <p className="text-xs text-muted-foreground/70 mb-3">
          Map each governance category to a Netskope app category (or custom app category) in your tenant.
          Used as the destination in Netskope Real-time Protection policies.
        </p>
        {categories.map(cat => (
          <MappingRow
            key={cat.id}
            label={cat.name}
            hint={cat.system_tag ? `system_tag: ${cat.system_tag}` : `id: ${cat.id}`}
            neutral_object_type="app_category"
            neutral_object_key={cat.system_tag ?? cat.id}
            vendor_object_type="app_category"
            mapping_purpose="destination_scope"
            existingMapping={findMapping('app_category', cat.system_tag ?? cat.id)}
            onSaved={handleSaved}
          />
        ))}
        {categories.length === 0 && (
          <p className="text-xs text-muted-foreground/60 italic">No governance categories configured yet.</p>
        )}
      </Section>

      {/* DLP Profile Mappings */}
      <Section title="DLP Profile Mappings">
        <p className="text-xs text-muted-foreground/70 mb-3">
          Map each Effata sensitivity level to the exact DLP profile name in your Netskope tenant
          (Policies → DLP Profiles). Used in Real-time Protection policy conditions.
        </p>
        {sensitivityLevels.map(level => (
          <MappingRow
            key={level}
            label={SENSITIVITY_DISPLAY[level] ?? level}
            hint={`sensitivity: ${level}`}
            neutral_object_type="sensitivity_level"
            neutral_object_key={level}
            vendor_object_type="dlp_profile"
            mapping_purpose="detection_profile"
            existingMapping={findMapping('sensitivity_level', level)}
            onSaved={handleSaved}
          />
        ))}
      </Section>

      {/* Classification Label Mappings */}
      {orgLabels.length > 0 && (
        <Section title="Classification Label Mappings">
          <p className="text-xs text-muted-foreground/70 mb-3">
            Map each organisation sensitivity label to an enterprise classification profile in Netskope.
          </p>
          {orgLabels.map(label => (
            <MappingRow
              key={label.id}
              label={label.display_name}
              hint={`source: ${label.label_source}, key: ${label.label_key}`}
              neutral_object_type="classification_label"
              neutral_object_key={label.id}
              vendor_object_type="enterprise_classification_profile"
              mapping_purpose="detection_profile"
              existingMapping={findMapping('classification_label', label.id)}
              onSaved={handleSaved}
            />
          ))}
        </Section>
      )}

      {/* Coaching Template Mappings */}
      <Section title="Coaching Template Mappings" defaultOpen={false}>
        <p className="text-xs text-muted-foreground/70 mb-3">
          Map the default coaching notification template to a Netskope user notification template
          (Policies → User Notifications). Required for coach/coach-ack/coach-just actions.
        </p>
        <MappingRow
          label="Default coach notification"
          hint="neutral_key: default-coach"
          neutral_object_type="notification_template"
          neutral_object_key="default-coach"
          vendor_object_type="user_notification_template"
          mapping_purpose="notification"
          existingMapping={findMapping('notification_template', 'default-coach')}
          onSaved={handleSaved}
        />
      </Section>

      {/* Mapping Gaps */}
      {(readiness.critical_gaps.length > 0 || readiness.warnings.length > 0) && (
        <Section title="Mapping Gaps" defaultOpen={true}>
          {readiness.critical_gaps.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-destructive">Critical gaps:</p>
              {readiness.critical_gaps.map((gap, i) => (
                <p key={i} className="text-xs text-destructive/80">{gap}</p>
              ))}
            </div>
          )}
          {readiness.warnings.length > 0 && (
            <div className="space-y-1 mt-2">
              <p className="text-xs font-semibold text-amber-600">Warnings:</p>
              {readiness.warnings.map((w, i) => (
                <p key={i} className="text-xs text-amber-700">{w}</p>
              ))}
            </div>
          )}
          {readiness.recommendations.length > 0 && (
            <div className="space-y-1 mt-2">
              <p className="text-xs font-semibold text-muted-foreground">Recommendations:</p>
              {readiness.recommendations.map((r, i) => (
                <p key={i} className="text-xs text-muted-foreground/80">{r}</p>
              ))}
            </div>
          )}
        </Section>
      )}
    </div>
  )
}
