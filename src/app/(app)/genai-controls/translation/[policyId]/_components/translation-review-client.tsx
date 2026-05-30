'use client'

import { useState, useOptimistic, useTransition, useRef } from 'react'
import Link from 'next/link'
import { ArrowLeft, CheckCircle, Clock, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  markTranslationVerified,
  markTranslationDeferred,
  retranslatePolicy,
  getTranslationJobStatus,
} from '../../actions'

// ── Types ─────────────────────────────────────────────────────────────────────

interface PolicyRule {
  data_type:   string
  post_prompt: string
  upload:      string
  download:    string
  response:    string
}

interface NpjCondition {
  type:        string
  name?:       string
  sensitivity?: string
  confidence?: string
  label_name?: string
  label_source?: string
  pattern?:    string
}

interface NpjDecision {
  mode:                    string
  severity:                string
  require_acknowledgement: boolean
  require_justification:   boolean
  preserve_evidence:       boolean
  create_incident:         boolean
}

interface NpjException {
  effect:  string
  reason:  string
}

interface NeutralPolicyJson {
  schema_version?: string
  intent?:         string
  policy_family?:  string
  scope?: {
    activities?: string[]
    channels?:   string[]
    app_categories?: Array<{ id: string; system_tag: string | null; name: string }>
  }
  content?: {
    operator?:   string
    conditions?: NpjCondition[]
  }
  decision?:   NpjDecision
  exceptions?: NpjException[]
  provenance?: {
    generated_from?: string
    compiler_version?: string
    generated_at?: string
    warnings?: string[]
  }
}

interface Policy {
  id:                        string
  name:                      string
  description:               string | null
  policy_type:               string
  policy_family:             string | null
  primary_action:            string | null
  approval_status:           string
  vendor_translation_status: string | null
  priority:                  number
  scope_all_apps:            boolean
  scope_app_ids:             string[]
  rules:                     PolicyRule[]
  data_classification_label: string | null
  neutral_policy_json?:      NeutralPolicyJson | null
}

interface MappingReport {
  exact_mappings:            string[]
  lossy_mappings:            string[]
  unsupported_intent:        string[]
  unverified_vendor_areas:   string[]
  tests_required:            string[]
  customer_mapping_required: string[]  // missing tenant mappings blocking exact translation
}

interface Translation {
  id:                          string
  vendor_id:                   string
  status:                      string
  native_policies:             object[]
  mapping_report:              MappingReport
  adapter_version:             string | null
  capability_registry_version: string | null
  customer_mapping_version:    string | null
  neutral_policy_hash:         string | null
  reviewed_by:                 string | null
  reviewed_at:                 string | null
  exported_at:                 string | null
  created_at:                  string
  updated_at:                  string
}

interface Props {
  policy:       Policy
  translations: Translation[]
  vendorTools:  string[]
}

// ── Constants ─────────────────────────────────────────────────────────────────

const VENDOR_DISPLAY: Record<string, string> = {
  'netskope':          'Netskope',
  'microsoft-purview': 'Microsoft Purview',
  'forcepoint-dlp':    'Forcepoint DLP',
  'skyhigh-security':  'Skyhigh Security',
}

const TOOL_TO_VENDOR_ID: Record<string, string> = {
  'netskope':            'netskope',
  'microsoft-purview':   'microsoft-purview',
  'microsoft purview':   'microsoft-purview',
  'purview':             'microsoft-purview',
  'forcepoint-dlp':      'forcepoint-dlp',
  'forcepoint':          'forcepoint-dlp',
  'skyhigh-security':    'skyhigh-security',
  'skyhigh security':    'skyhigh-security',
  'skyhigh':             'skyhigh-security',
}

const FIRST_WAVE = new Set(['netskope', 'microsoft-purview', 'forcepoint-dlp', 'skyhigh-security'])

const TRANSLATION_CHIP: Record<string, string> = {
  'pending':        'bg-amber-500/10 text-amber-400 border-amber-500/20',
  'translating':    'bg-blue-500/15 text-blue-300 border-blue-500/20',
  'translated':     'bg-blue-500/10 text-blue-400 border-blue-500/20',
  'partial':        'bg-amber-500/15 text-amber-300 border-amber-500/25',
  'verified':       'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  'deferred':       'bg-muted/60 text-muted-foreground/60 border-border/50',
  'error':          'bg-red-500/10 text-red-400 border-red-500/20',
}
const TRANSLATION_LABEL: Record<string, string> = {
  'pending':        'Pending',
  'translating':    'Running',
  'translated':     'Translated',
  'partial':        'Partial',
  'verified':       'Verified',
  'deferred':       'Deferred',
  'error':          'Error',
}

const READINESS_LABEL: Record<string, string> = {
  'pending':     'Not translated',
  'translating': 'Translating…',
  'translated':  'Verify before deploying',
  'partial':     'Review required',
  'verified':    'Ready to deploy',
  'deferred':    'Deferred — revisit later',
  'error':       'Translation error',
}

const ACTION_CHIP: Record<string, string> = {
  'allow':      'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  'monitor':    'bg-blue-500/10 text-blue-400 border-blue-500/20',
  'alert':      'bg-amber-500/10 text-amber-400 border-amber-500/20',
  'coach':      'bg-orange-500/10 text-orange-400 border-orange-500/20',
  'coach-ack':  'bg-orange-500/15 text-orange-300 border-orange-500/30',
  'coach-just': 'bg-amber-600/15 text-amber-300 border-amber-600/25',
  'block':      'bg-red-500/10 text-red-400 border-red-500/20',
}

// ── Component ─────────────────────────────────────────────────────────────────

export function TranslationReviewClient({ policy, translations, vendorTools }: Props) {
  const vendorIds = vendorTools
    .map(t => TOOL_TO_VENDOR_ID[t.toLowerCase().trim()])
    .filter((v): v is string => !!v && FIRST_WAVE.has(v))
  const uniqueVendors = [...new Set(vendorIds)]

  const translationByVendor = new Map(translations.map(t => [t.vendor_id, t]))

  const [activeTab, setActiveTab] = useState<string>(uniqueVendors[0] ?? '')

  const activeTranslation = activeTab ? translationByVendor.get(activeTab) : undefined

  return (
    <div className="space-y-6">
      {/* Back + title */}
      <div className="flex items-start gap-4">
        <Link
          href="/genai-controls/translation"
          className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Translation Hub
        </Link>
      </div>

      {/* Policy summary card */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs text-muted-foreground/60 mb-1">Priority {policy.priority}</p>
            <h1 className="text-lg font-bold text-foreground">{policy.name}</h1>
            {policy.description && (
              <p className="text-sm text-muted-foreground/70 mt-1">{policy.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {policy.primary_action && (
              <span className={cn(
                'inline-flex items-center px-2 py-0.5 rounded-md border text-xs font-medium',
                ACTION_CHIP[policy.primary_action] ?? 'bg-muted/30 text-muted-foreground/50 border-border/50',
              )}>
                {policy.primary_action}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground/60">
          {policy.policy_family && <span>{policy.policy_family}</span>}
          {policy.policy_family && policy.data_classification_label && <span>·</span>}
          {policy.data_classification_label && <span>{policy.data_classification_label}</span>}
          {policy.scope_all_apps ? (
            <><span>·</span><span>All GenAI apps</span></>
          ) : policy.scope_app_ids.length > 0 ? (
            <><span>·</span><span>{policy.scope_app_ids.length} apps scoped</span></>
          ) : null}
          {policy.rules.length > 0 && (
            <><span>·</span><span>{policy.rules.length} rule{policy.rules.length !== 1 ? 's' : ''}</span></>
          )}
        </div>
      </div>

      {/* Neutral policy structured preview */}
      <NeutralPolicyPreview npj={policy.neutral_policy_json} />

      {uniqueVendors.length === 0 && (
        <div className="rounded-xl border border-border bg-card/50 p-6 text-center">
          <p className="text-sm text-muted-foreground">
            No supported DLP tools configured. Add vendors in your onboarding profile.
          </p>
        </div>
      )}

      {uniqueVendors.length > 0 && (
        <div className="space-y-4">
          {/* Vendor tabs */}
          <div className="flex items-center gap-1 border-b border-border">
            {uniqueVendors.map(vendorId => {
              const t = translationByVendor.get(vendorId)
              const status = t?.status ?? 'pending'
              return (
                <button
                  key={vendorId}
                  onClick={() => setActiveTab(vendorId)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px',
                    activeTab === vendorId
                      ? 'border-blue-500 text-blue-400'
                      : 'border-transparent text-muted-foreground hover:text-foreground',
                  )}
                >
                  {VENDOR_DISPLAY[vendorId] ?? vendorId}
                  <span className={cn(
                    'inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-medium',
                    TRANSLATION_CHIP[status] ?? TRANSLATION_CHIP['pending'],
                  )}>
                    {TRANSLATION_LABEL[status] ?? status}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Tab content */}
          {activeTab && (
            <VendorTabContent
              vendorId={activeTab}
              translation={activeTranslation ?? null}
              policyId={policy.id}
            />
          )}
        </div>
      )}
    </div>
  )
}

// ── Vendor Tab Content ─────────────────────────────────────────────────────────

interface VendorTabProps {
  vendorId:    string
  translation: Translation | null
  policyId:    string
}

function VendorTabContent({ vendorId, translation, policyId }: VendorTabProps) {
  const [isPending, startTransition] = useTransition()
  const [actionError, setActionError] = useState<string | null>(null)
  const [retranslateJobId, setRetranslateJobId] = useState<string | null>(null)
  const [retranslating, setRetranslating] = useState(false)
  const [expandedPolicies, setExpandedPolicies] = useState<Set<number>>(new Set([0]))
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const inflightRef = useRef(false)

  const [optimisticStatus, applyOptimistic] = useOptimistic(
    translation?.status ?? 'pending',
    (_: string, next: string) => next,
  )

  function handleVerify() {
    if (!translation) return
    setActionError(null)
    applyOptimistic('verified')
    startTransition(async () => {
      const result = await markTranslationVerified(translation.id)
      if (result.error) setActionError(result.error)
    })
  }

  function handleDefer() {
    if (!translation) return
    setActionError(null)
    applyOptimistic('deferred')
    startTransition(async () => {
      const result = await markTranslationDeferred(translation.id)
      if (result.error) setActionError(result.error)
    })
  }

  function handleRetranslate() {
    setActionError(null)
    setRetranslating(true)
    startTransition(async () => {
      const result = await retranslatePolicy(policyId)
      if ('error' in result) {
        setActionError(result.error)
        setRetranslating(false)
      } else {
        setRetranslateJobId(result.jobId)
        startPollingRetranslate(result.jobId)
      }
    })
  }

  function stopPolling() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }

  function startPollingRetranslate(jobId: string) {
    intervalRef.current = setInterval(async () => {
      if (inflightRef.current) return
      inflightRef.current = true
      try {
        const job = await getTranslationJobStatus(jobId)
        if (job.status === 'completed') {
          stopPolling()
          setRetranslating(false)
          window.location.reload()
        } else if (job.status === 'failed') {
          stopPolling()
          setRetranslating(false)
          setActionError(job.error ?? 'Re-translation failed.')
        }
      } catch {
        stopPolling()
        setRetranslating(false)
        setActionError('Could not check retranslation status. Please refresh.')
      } finally {
        inflightRef.current = false
      }
    }, 3000)
  }

  const report = translation?.mapping_report
  const hasMissingMappings = (report?.customer_mapping_required?.length ?? 0) > 0
  const canVerify = translation && ['translated', 'partial'].includes(optimisticStatus) && !hasMissingMappings
  const canDefer  = translation && ['translated', 'partial'].includes(optimisticStatus)
  const isVerified = optimisticStatus === 'verified'
  const isDeferred = optimisticStatus === 'deferred'

  if (!translation || translation.status === 'pending') {
    return (
      <div className="rounded-xl border border-border bg-card/50 p-8 text-center space-y-3">
        <p className="text-sm text-muted-foreground">Not translated yet for {VENDOR_DISPLAY[vendorId] ?? vendorId}.</p>
        <button
          type="button"
          onClick={handleRetranslate}
          disabled={retranslating || isPending}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {retranslating && <span className="inline-block w-2.5 h-2.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />}
          Translate Now
        </button>
        {actionError && <p className="text-xs text-red-400">{actionError}</p>}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Status bar + actions */}
      <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex flex-col gap-0.5">
            <span className={cn(
              'inline-flex items-center px-2.5 py-1 rounded-lg border text-xs font-medium',
              TRANSLATION_CHIP[optimisticStatus] ?? TRANSLATION_CHIP['pending'],
            )}>
              {TRANSLATION_LABEL[optimisticStatus] ?? optimisticStatus}
            </span>
            {optimisticStatus === 'partial' && report && (
              <span className="text-[10px] text-amber-400/70 px-0.5">
                {report.lossy_mappings.length > 0 && `${report.lossy_mappings.length} lossy`}
                {report.lossy_mappings.length > 0 && report.tests_required.length > 0 && ' · '}
                {report.tests_required.length > 0 && `${report.tests_required.length} test${report.tests_required.length !== 1 ? 's' : ''} required`}
              </span>
            )}
          </div>
          {translation.adapter_version && (
            <span className="text-xs text-muted-foreground/50">adapter v{translation.adapter_version}</span>
          )}
          {translation.capability_registry_version && (
            <span className="text-xs text-muted-foreground/50">catalog {translation.capability_registry_version}</span>
          )}
          {translation.customer_mapping_version && (
            <span className="text-xs text-muted-foreground/50">mappings {translation.customer_mapping_version.slice(0, 8)}</span>
          )}
          {translation.reviewed_at && (
            <span className="text-xs text-muted-foreground/60 flex items-center gap-1">
              <CheckCircle className="w-3 h-3" />
              Reviewed {new Date(translation.reviewed_at).toLocaleDateString()}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRetranslate}
            disabled={retranslating || isPending}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md border border-border text-muted-foreground hover:text-foreground hover:border-border-strong transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={cn('w-3 h-3', retranslating && 'animate-spin')} />
            Re-translate
          </button>
          {canDefer && !isDeferred && (
            <button
              type="button"
              onClick={handleDefer}
              disabled={isPending}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md border border-border text-muted-foreground hover:text-foreground hover:border-border-strong transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Clock className="w-3 h-3" />
              Defer
            </button>
          )}
          {!isVerified && ['translated', 'partial'].includes(optimisticStatus) && (
            hasMissingMappings ? (
              <span
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md bg-muted/50 text-muted-foreground/50 border border-border/50 cursor-not-allowed"
                title="Configure required mappings before marking verified"
              >
                <CheckCircle className="w-3 h-3" />
                Mark Verified
              </span>
            ) : (
              <button
                type="button"
                onClick={handleVerify}
                disabled={isPending}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md bg-emerald-600/80 text-white hover:bg-emerald-600 border border-emerald-600/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CheckCircle className="w-3 h-3" />
                Mark Verified
              </button>
            )
          )}
          {isVerified && (
            <span className="flex items-center gap-1 text-xs text-emerald-400">
              <CheckCircle className="w-3.5 h-3.5" />
              Verified
            </span>
          )}
        </div>
      </div>
      {actionError && <p className="text-xs text-red-400">{actionError}</p>}

      {/* Mapping quality chips */}
      {report && (
        <div className="flex flex-wrap items-center gap-2">
          {report.exact_mappings.length > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-emerald-500/25 bg-emerald-500/10 text-xs text-emerald-400">
              <span className="font-semibold">{report.exact_mappings.length}</span> exact
            </span>
          )}
          {report.lossy_mappings.length > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-amber-500/25 bg-amber-500/10 text-xs text-amber-400">
              <span className="font-semibold">{report.lossy_mappings.length}</span> lossy
            </span>
          )}
          {report.unsupported_intent.length > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-red-500/25 bg-red-500/10 text-xs text-red-400">
              <span className="font-semibold">{report.unsupported_intent.length}</span> unsupported
            </span>
          )}
          {report.unverified_vendor_areas.length > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-blue-500/25 bg-blue-500/10 text-xs text-blue-400">
              <span className="font-semibold">{report.unverified_vendor_areas.length}</span> unverified
            </span>
          )}
          {report.tests_required.length > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-orange-500/25 bg-orange-500/10 text-xs text-orange-400">
              <span className="font-semibold">{report.tests_required.length}</span> tests required
            </span>
          )}
        </div>
      )}

      {/* Implementation readiness summary */}
      {report && (
        <div className="rounded-xl border border-border bg-card/60 p-4">
          <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider mb-3">Translation Summary</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2.5 text-xs">
            <SummaryRow label="Vendor" value={VENDOR_DISPLAY[vendorId] ?? vendorId} />
            <SummaryRow
              label="Status"
              value={READINESS_LABEL[optimisticStatus] ?? optimisticStatus}
              valueClass={
                optimisticStatus === 'verified'   ? 'text-emerald-400' :
                optimisticStatus === 'partial'     ? 'text-amber-400'   :
                optimisticStatus === 'translated'  ? 'text-blue-400'    :
                'text-muted-foreground/70'
              }
            />
            <SummaryRow label="Native Policies" value={String(translation.native_policies.length)} />
            <SummaryRow label="Exact Mappings"  value={String(report.exact_mappings.length)}   valueClass="text-emerald-400" />
            <SummaryRow label="Lossy Mappings"  value={String(report.lossy_mappings.length)}   valueClass={report.lossy_mappings.length > 0 ? 'text-amber-400' : 'text-muted-foreground/70'} />
            <SummaryRow label="Tests Required"  value={String(report.tests_required.length)}   valueClass={report.tests_required.length > 0 ? 'text-orange-400' : 'text-muted-foreground/70'} />
          </div>
        </div>
      )}

      {/* Customer Mapping Required — must be resolved before marking verified */}
      {report && report.customer_mapping_required.length > 0 && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold text-red-400">Customer Mapping Required</p>
            <a
              href="/genai-controls/vendor-mapping/netskope"
              className="text-xs text-red-400 hover:text-red-300 underline shrink-0"
            >
              Add mapping →
            </a>
          </div>
          <p className="text-xs text-red-400/80">
            These mappings are missing in your Netskope tenant configuration. The translation output contains
            placeholders — do not deploy until all gaps are resolved.
          </p>
          <ul className="space-y-1">
            {report.customer_mapping_required.map((item, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                <span className="text-xs text-red-400/80 leading-relaxed">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Native Policies — placeholder banner when not deployment-ready */}
      {translation.native_policies.some(np => (np as Record<string, unknown>)._deployment_ready === false) && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3">
          <p className="text-xs font-semibold text-amber-400">
            ⚠ Placeholder output only — do not implement until required Netskope mappings are configured.
          </p>
          <p className="text-xs text-amber-400/70 mt-1">
            One or more native policies contain placeholder destination values. Configure app category mappings
            in <a href="/genai-controls/vendor-mapping/netskope" className="underline hover:text-amber-300">Vendor Mapping</a>, then re-translate.
          </p>
        </div>
      )}

      {/* Native Policies */}
      <div className="space-y-2">
        <h2 className="text-xs font-semibold text-muted-foreground/80 uppercase tracking-wider">Native Policies</h2>
        {translation.native_policies.length === 0 && (
          <p className="text-sm text-muted-foreground/60">No native policies generated.</p>
        )}
        {translation.native_policies.map((np, i) => {
          const isExpanded = expandedPolicies.has(i)
          const npRecord = np as Record<string, unknown>
          const policyName = (npRecord.name ?? npRecord.policy_name ?? `Policy ${i + 1}`) as string
          return (
            <div key={i} className="rounded-xl border border-border bg-card overflow-hidden">
              <button
                type="button"
                onClick={() => {
                  setExpandedPolicies(prev => {
                    const next = new Set(prev)
                    if (next.has(i)) next.delete(i)
                    else next.add(i)
                    return next
                  })
                }}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-foreground hover:bg-muted/30 transition-colors text-left"
              >
                <span>{policyName}</span>
                <span className="text-muted-foreground/50 text-xs">{isExpanded ? '▲' : '▼'}</span>
              </button>
              {isExpanded && (
                <div className="border-t border-border">
                  <NativePolicyCard policy={npRecord} />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Mapping Report */}
      {report && (
        <div className="space-y-4">
          <h2 className="text-xs font-semibold text-muted-foreground/80 uppercase tracking-wider">Mapping Report</h2>

          <MappingList
            title="Exact Mappings"
            items={report.exact_mappings}
            chipClass="bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
          />
          <MappingList
            title="Lossy Mappings"
            items={report.lossy_mappings}
            chipClass="bg-amber-500/10 text-amber-400 border-amber-500/20"
          />
          <MappingList
            title="Unsupported Intent"
            items={report.unsupported_intent}
            chipClass="bg-red-500/10 text-red-400 border-red-500/20"
          />
          <MappingList
            title="Unverified Vendor Areas"
            items={report.unverified_vendor_areas}
            chipClass="bg-blue-500/10 text-blue-400 border-blue-500/20"
          />
          {report.tests_required.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-foreground/70">Tests Required</p>
              <div className="rounded-lg border border-orange-500/25 bg-orange-500/5 p-3 space-y-2.5">
                {report.tests_required.map((item, i) => (
                  <label key={i} className="flex items-start gap-2.5 cursor-pointer group">
                    <input type="checkbox" className="mt-0.5 rounded border-orange-500/40 accent-orange-500 shrink-0" />
                    <span className="text-xs text-foreground/75 leading-relaxed">{item}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Native Policy Card ─────────────────────────────────────────────────────────

const ACTION_CHIP_MAP: Record<string, string> = {
  'Block':  'bg-red-500/10 text-red-400 border-red-500/20',
  'Alert':  'bg-amber-500/10 text-amber-400 border-amber-500/20',
  'Coach':  'bg-orange-500/10 text-orange-400 border-orange-500/20',
  'Allow':  'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  'Monitor':'bg-blue-500/10 text-blue-400 border-blue-500/20',
  'UserNotification': 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  'GenerateIncidentReport': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
}

const SEVERITY_CHIP_MAP: Record<string, string> = {
  'Critical': 'bg-red-500/10 text-red-400 border-red-500/20',
  'High':     'bg-orange-500/10 text-orange-400 border-orange-500/20',
  'Medium':   'bg-amber-500/10 text-amber-400 border-amber-500/20',
  'Low':      'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
}

// Fields rendered explicitly — excluded from the generic extra-entries table
const HEADER_FIELDS = new Set([
  'name', 'policy_name', 'description', 'status', 'action', 'severity',
  'source', 'destination', 'activities', 'dlp_profile',
  'alert', 'save_evidence', 'notification_template',
  'policy_type', 'policy_family',
  // Netskope v3
  'profile_action', 'traffic_action', 'fallback_action', 'group',
  // Skyhigh / Purview
  'mode', 'location', 'scope', 'rule_groups', 'content_conditions',
  // Forcepoint
  'source_resources', 'destination_resources', 'classifiers',
])

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3 py-2.5 border-b border-border/40 last:border-0 items-start">
      <span className="text-xs text-muted-foreground/60 pt-0.5 uppercase tracking-wide font-medium">{label}</span>
      <div>{children}</div>
    </div>
  )
}

function SummaryRow({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground/60">{label}</span>
      <span className={cn('font-medium', valueClass ?? 'text-foreground/80')}>{value}</span>
    </div>
  )
}

function StringChips({ values, colorClass }: { values: string[]; colorClass?: string }) {
  const cls = colorClass ?? 'bg-muted/50 text-foreground/70 border-border/50'
  return (
    <div className="flex flex-wrap gap-1.5">
      {values.map((v, i) => (
        <span key={i} className={cn('inline-flex items-center px-2 py-0.5 rounded-md border text-xs font-medium', cls)}>
          {v}
        </span>
      ))}
    </div>
  )
}

function renderValue(key: string, value: unknown): React.ReactNode {
  if (value === null || value === undefined) {
    return <span className="text-xs text-muted-foreground/40 italic">Not configured</span>
  }
  if (typeof value === 'boolean') {
    return (
      <span className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-md border text-xs font-medium',
        value ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-muted/50 text-muted-foreground/60 border-border/50',
      )}>
        {value ? 'Yes' : 'No'}
      </span>
    )
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-xs text-muted-foreground/40 italic">None</span>
    return <StringChips values={value.map(v => String(v))} />
  }
  if (typeof value === 'object') {
    // Render object as nested key-value rows
    const entries = Object.entries(value as Record<string, unknown>)
    if (entries.length === 0) return <span className="text-xs text-muted-foreground/40 italic">—</span>
    return (
      <div className="space-y-1">
        {entries.map(([k, v]) => (
          <div key={k} className="flex items-start gap-2">
            <span className="text-xs text-muted-foreground/50 min-w-[80px]">{k}:</span>
            <div className="text-xs">{renderValue(k, v)}</div>
          </div>
        ))}
      </div>
    )
  }
  // For action/severity use color chips
  if (key === 'action') {
    return (
      <span className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-md border text-xs font-medium',
        ACTION_CHIP_MAP[String(value)] ?? 'bg-muted/50 text-foreground/70 border-border/50',
      )}>
        {String(value)}
      </span>
    )
  }
  if (key === 'severity') {
    return (
      <span className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-md border text-xs font-medium',
        SEVERITY_CHIP_MAP[String(value)] ?? 'bg-muted/50 text-foreground/70 border-border/50',
      )}>
        {String(value)}
      </span>
    )
  }
  return <span className="text-xs text-foreground/80">{String(value)}</span>
}

function ActionChip({ action }: { action: string }) {
  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded-md border text-xs font-medium',
      ACTION_CHIP_MAP[action] ?? 'bg-muted/50 text-foreground/70 border-border/50',
    )}>
      {action}
    </span>
  )
}

// ── Netskope-specific card — mirrors the Netskope RT policy UI exactly ─────────

function NetskopeCard({ policy }: { policy: Record<string, unknown> }) {
  const [showRaw, setShowRaw] = useState(false)

  const source        = policy.source as Record<string, string[]> | undefined
  const destination   = policy.destination as Record<string, unknown> | undefined
  const profileAction = policy.profile_action as { dlp_profiles: string[]; action: string; notification_template: string | null } | null | undefined
  // action field is always present on every native policy (profile_action.action mirrors it when profiles exist)
  const policyAction  = (profileAction?.action ?? policy.action) as string | undefined
  const trafficAction = policy.traffic_action as string | undefined
  const group         = policy.group as string | undefined
  const status        = policy.status as string | undefined
  const description   = policy.description as string | undefined

  const activities    = (destination?.activities ?? []) as string[]
  const usersOrGroups = source?.users_or_groups ?? ['All Users']
  const dlpProfiles   = profileAction?.dlp_profiles ?? []

  return (
    <div className="divide-y divide-border/40">

      {/* Source */}
      <div className="grid grid-cols-[160px_1fr] gap-4 px-5 py-3.5 items-start">
        <span className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wide pt-0.5">Source</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground/50">User =</span>
          <StringChips values={usersOrGroups} />
        </div>
      </div>

      {/* Destination */}
      <div className="grid grid-cols-[160px_1fr] gap-4 px-5 py-3.5 items-start">
        <span className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wide pt-0.5">Destination</span>
        <div className="space-y-2">
          {destination?.category ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground/50">Category =</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-md border border-border bg-muted/40 text-xs text-foreground/80">
                {String(destination.category)}
              </span>
            </div>
          ) : destination?.specific_apps ? (
            <div className="flex items-start gap-2">
              <span className="text-xs text-muted-foreground/50 pt-0.5 shrink-0">Apps =</span>
              <StringChips values={destination.specific_apps as string[]} />
            </div>
          ) : null}
          {activities.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground/50">Activities =</span>
              <StringChips values={activities} colorClass="bg-blue-500/10 text-blue-400 border-blue-500/20" />
            </div>
          )}
        </div>
      </div>

      {/* Profile & Action */}
      <div className="grid grid-cols-[160px_1fr] gap-4 px-5 py-3.5 items-start">
        <span className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wide pt-0.5">Profile &amp; Action</span>
        <div className="space-y-2.5">

          {profileAction ? (
            <>
              {/* DLP Profile chips */}
              {dlpProfiles.length > 0 && (
                <div className="flex items-start gap-2 flex-wrap">
                  <span className="text-xs text-muted-foreground/50 shrink-0 pt-0.5">DLP Profile =</span>
                  <div className="flex flex-wrap gap-1.5">
                    {dlpProfiles.map((name, i) => (
                      <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-md border border-border bg-muted/40 text-xs font-mono text-foreground/80">
                        {name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Single action for all profiles — simple form (no per-profile table) */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground/50">Action:</span>
                  <ActionChip action={profileAction.action} />
                </div>
                {profileAction.notification_template && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground/50">Template:</span>
                    <span className="text-xs font-mono text-foreground/70 bg-muted/30 px-2 py-0.5 rounded border border-border/50">
                      {profileAction.notification_template}
                    </span>
                  </div>
                )}
              </div>
            </>
          ) : policyAction ? (
            /* No DLP profile — action applies to all content matching activities */
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground/50">Action:</span>
                <ActionChip action={policyAction} />
              </div>
              <p className="text-[10px] text-muted-foreground/50 italic">No DLP profile — action applies to all content</p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground/50 italic">No profile or action configured</p>
          )}

          {/* Traffic Action — only shown when explicitly set (not a default) */}
          {trafficAction && (
            <div className="rounded-lg border border-dashed border-border/60 bg-muted/10 px-3 py-2.5 space-y-1.5">
              <p className="text-[10px] text-muted-foreground/60">If none of the specified profiles matches</p>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground/60">Action:</span>
                <ActionChip action={trafficAction} />
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Policy Name + Group + Description */}
      <div className="grid grid-cols-[160px_1fr] gap-4 px-5 py-3.5 items-start">
        <span className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wide pt-0.5">Policy Name</span>
        <div className="space-y-1.5">
          <span className="text-xs text-foreground/80">{String(policy.name ?? '—')}</span>
          {group && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground/50">Group =</span>
              <span className="text-xs text-muted-foreground/70">{group}</span>
            </div>
          )}
          {description && (
            <div className="pt-1.5 mt-1 border-t border-border/30 space-y-1">
              <p className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wider">Policy Description</p>
              <p className="text-xs text-muted-foreground/70 leading-relaxed">{description}</p>
            </div>
          )}
        </div>
      </div>

      {/* Status */}
      <div className="grid grid-cols-[160px_1fr] gap-4 px-5 py-3.5 items-start">
        <span className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wide pt-0.5">Status</span>
        <div className="space-y-1">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-400">
            <span className="w-2 h-2 rounded-full bg-blue-400/70" />
            Draft — Not Deployed
          </span>
          <p className="text-[10px] text-muted-foreground/50">
            Configure in Netskope console. Set to{' '}
            <span className="font-mono">{status ?? 'enabled'}</span> when deploying.
          </p>
        </div>
      </div>

      {/* Raw JSON toggle */}
      <div className="px-5 py-3">
        <button
          type="button"
          onClick={() => setShowRaw(r => !r)}
          className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors"
        >
          {showRaw ? '▲ Hide raw JSON' : '▼ View raw JSON'}
        </button>
        {showRaw && (
          <pre className="mt-2 text-xs text-muted-foreground/70 bg-muted/30 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-words font-mono border border-border/40">
            {JSON.stringify(policy, null, 2)}
          </pre>
        )}
      </div>

    </div>
  )
}

// ── Generic card — fallback for Purview / Forcepoint / Skyhigh ─────────────────

function NativePolicyCard({ policy }: { policy: Record<string, unknown> }) {
  // Detect Netskope v2 format by presence of profile_action
  if ('profile_action' in policy) return <NetskopeCard policy={policy} />

  const [showRaw, setShowRaw] = useState(false)

  const action      = policy.action as string | undefined
  const severity    = policy.severity as string | undefined
  const status      = policy.status as string | undefined
  const activities  = policy.activities as string[] | undefined
  const source      = policy.source as Record<string, unknown> | undefined
  const destination = policy.destination as Record<string, unknown> | undefined
  const dlpProfile  = 'dlp_profile' in policy ? policy.dlp_profile : undefined
  const notification= policy.notification_template as string | null | undefined
  const mode        = policy.mode as string | undefined
  const location         = policy.location as string | undefined
  const scope            = policy.scope as Record<string, unknown> | undefined
  const ruleGroups       = policy.rule_groups as unknown[] | undefined
  const contentConditions= policy.content_conditions as string[] | undefined
  const sourceResources  = policy.source_resources as string[] | undefined
  const destResources    = policy.destination_resources as string[] | undefined
  const classifiers      = policy.classifiers as string[] | undefined
  const extraEntries = Object.entries(policy).filter(([k]) => !HEADER_FIELDS.has(k) && k !== 'name' && k !== 'policy_name')

  return (
    <div className="p-4">
      {status && (
        <div className="pb-3 mb-1 border-b border-border/40">
          <span className={cn(
            'inline-flex items-center px-2 py-0.5 rounded-md border text-xs font-medium',
            status === 'enabled' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-muted/50 text-muted-foreground border-border',
          )}>{status}</span>
        </div>
      )}
      <div>
        {source          && <FieldRow label="Source">{renderValue('source', source)}</FieldRow>}
        {sourceResources && sourceResources.length > 0 && <FieldRow label="Source"><StringChips values={sourceResources} /></FieldRow>}
        {destination     && <FieldRow label="Destination">{renderValue('destination', destination)}</FieldRow>}
        {destResources   && destResources.length > 0 && <FieldRow label="Destination"><StringChips values={destResources} /></FieldRow>}
        {location        && <FieldRow label="Location"><span className="text-xs text-foreground/80">{location}</span></FieldRow>}
        {activities      && <FieldRow label="Activities"><StringChips values={activities} colorClass="bg-blue-500/10 text-blue-400 border-blue-500/20" /></FieldRow>}
        {action          && <FieldRow label="Action"><ActionChip action={action} /></FieldRow>}
        {severity        && <FieldRow label="Severity"><span className={cn('inline-flex items-center px-2 py-0.5 rounded-md border text-xs font-medium', SEVERITY_CHIP_MAP[severity] ?? 'bg-muted/50 text-foreground/70 border-border/50')}>{severity}</span></FieldRow>}
        {mode            && <FieldRow label="Mode"><ActionChip action={mode} /></FieldRow>}
        {scope           && <FieldRow label="Scope">{renderValue('scope', scope)}</FieldRow>}
        {'dlp_profile' in policy && (
          <FieldRow label="DLP Profile">
            {dlpProfile
              ? <span className="text-xs font-mono text-foreground/80 bg-muted/50 px-2 py-0.5 rounded border border-border">{String(dlpProfile)}</span>
              : <span className="text-xs text-amber-400/80 italic">None — matches all content</span>}
          </FieldRow>
        )}
        {classifiers     && classifiers.length > 0 && <FieldRow label="Classifiers"><StringChips values={classifiers} colorClass="bg-purple-500/10 text-purple-400 border-purple-500/20" /></FieldRow>}
        {contentConditions && contentConditions.length > 0 && <FieldRow label="Content Conditions"><StringChips values={contentConditions} colorClass="bg-purple-500/10 text-purple-400 border-purple-500/20" /></FieldRow>}
        {ruleGroups && ruleGroups.length > 0 && (
          <FieldRow label="Rule Groups">
            <div className="space-y-2">
              {ruleGroups.map((rg, i) => (
                <div key={i} className="rounded-lg border border-border/50 bg-muted/20 p-2.5 text-xs space-y-1">
                  {Object.entries(rg as Record<string, unknown>).map(([k, v]) => (
                    <div key={k} className="flex items-start gap-2">
                      <span className="text-muted-foreground/50 min-w-[80px]">{k}:</span>
                      <div>{renderValue(k, v)}</div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </FieldRow>
        )}
        {notification !== undefined && (
          <FieldRow label="Notification">
            {notification ? <span className="text-xs font-mono text-foreground/80">{notification}</span> : <span className="text-xs text-muted-foreground/40 italic">None</span>}
          </FieldRow>
        )}
        {extraEntries.map(([k, v]) => <FieldRow key={k} label={k.replace(/_/g, ' ')}>{renderValue(k, v)}</FieldRow>)}
        {!!(policy.policy_type || policy.policy_family) && (
          <FieldRow label="Type / Family">
            <span className="text-xs text-muted-foreground/60">
              {[policy.policy_type as string | undefined, policy.policy_family as string | undefined].filter(Boolean).join(' · ')}
            </span>
          </FieldRow>
        )}
      </div>
      <div className="pt-3">
        <button type="button" onClick={() => setShowRaw(r => !r)} className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors">
          {showRaw ? '▲ Hide raw JSON' : '▼ View raw JSON'}
        </button>
        {showRaw && (
          <pre className="mt-2 text-xs text-muted-foreground/70 bg-muted/30 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-words font-mono border border-border/40">
            {JSON.stringify(policy, null, 2)}
          </pre>
        )}
      </div>
    </div>
  )
}

// ── Neutral Policy Preview ─────────────────────────────────────────────────────

const INTENT_CHIP: Record<string, string> = {
  'prevent_exfiltration': 'bg-red-500/10 text-red-400 border-red-500/20',
  'detect_only':          'bg-blue-500/10 text-blue-400 border-blue-500/20',
  'coach_user':           'bg-orange-500/10 text-orange-400 border-orange-500/20',
  'allow_approved_use':   'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  'govern_app_access':    'bg-purple-500/10 text-purple-400 border-purple-500/20',
}

function isValidNpj(npj: NeutralPolicyJson | null | undefined): npj is NeutralPolicyJson {
  return !!(npj && npj.schema_version === '1.0' && npj.intent && npj.decision)
}

function NeutralPolicyPreview({ npj }: { npj: NeutralPolicyJson | null | undefined }) {
  const [expanded, setExpanded]    = useState(false)
  const [showJson, setShowJson]     = useState(false)
  const valid = isValidNpj(npj)

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-foreground hover:bg-muted/30 transition-colors text-left"
      >
        <span className="flex items-center gap-2">
          <span className="text-muted-foreground/60 text-xs">{expanded ? '▼' : '▶'}</span>
          Neutral Policy
          {!valid && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-md border border-amber-500/30 bg-amber-500/10 text-[10px] text-amber-400">
              Legacy fields only
            </span>
          )}
        </span>
        {valid && (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); setShowJson(s => !s) }}
            className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors shrink-0"
          >
            {showJson ? 'Hide JSON' : 'View JSON'}
          </button>
        )}
      </button>

      {expanded && (
        <div className="border-t border-border">
          {!valid ? (
            <div className="px-4 py-3 text-xs text-amber-400/80 space-y-1">
              <p className="font-medium">Legacy fields only — re-generate policies for full translation accuracy.</p>
              <p className="text-muted-foreground/60">Click &quot;Generate Policies&quot; on the policies page to compile structured neutral policy data.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              <NpjRow label="Intent">
                <span className={cn(
                  'inline-flex items-center px-2 py-0.5 rounded-md border text-xs font-medium',
                  INTENT_CHIP[npj.intent ?? ''] ?? 'bg-muted/50 text-muted-foreground border-border',
                )}>
                  {npj.intent}
                </span>
              </NpjRow>

              <NpjRow label="Family">
                <span className="text-xs text-foreground/80">{npj.policy_family ?? '—'}</span>
              </NpjRow>

              {npj.scope?.activities && (
                <NpjRow label="Activities">
                  <div className="flex flex-wrap gap-1.5">
                    {npj.scope.activities.map((a, i) => (
                      <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-md border border-blue-500/25 bg-blue-500/10 text-xs text-blue-400">
                        {a}
                      </span>
                    ))}
                  </div>
                </NpjRow>
              )}

              {npj.scope?.channels && (
                <NpjRow label="Channels">
                  <div className="flex flex-wrap gap-1.5">
                    {npj.scope.channels.map((c, i) => (
                      <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-md border border-border bg-muted/40 text-xs text-muted-foreground/70">
                        {c}
                      </span>
                    ))}
                  </div>
                </NpjRow>
              )}

              {npj.content?.conditions && npj.content.conditions.length > 0 && (
                <NpjRow label="Detection">
                  <div className="space-y-1.5">
                    {npj.content.conditions.slice(0, 3).map((cond, i) => (
                      <div key={i} className="text-xs text-foreground/75">
                        {cond.type === 'data_type' && (
                          <span>
                            <span className="text-muted-foreground/50">data_type:</span>{' '}
                            <span className="font-medium">{cond.sensitivity}</span>
                            {cond.name ? ` — ${cond.name}` : ''}
                            {cond.confidence ? (
                              <span className="ml-1.5 text-[10px] px-1 py-0.5 rounded border border-border bg-muted/30 text-muted-foreground/60 uppercase">
                                {cond.confidence}
                              </span>
                            ) : null}
                          </span>
                        )}
                        {cond.type === 'classification_label' && (
                          <span>
                            <span className="text-muted-foreground/50">label:</span>{' '}
                            <span className="font-medium">{cond.label_name}</span>
                            {cond.label_source ? ` (${cond.label_source})` : ''}
                          </span>
                        )}
                        {cond.type === 'filename' && (
                          <span>
                            <span className="text-muted-foreground/50">filename:</span>{' '}
                            <span className="font-mono text-[10px] text-foreground/70">{cond.pattern}</span>
                          </span>
                        )}
                      </div>
                    ))}
                    {npj.content.conditions.length > 3 && (
                      <p className="text-[10px] text-muted-foreground/50">+{npj.content.conditions.length - 3} more conditions</p>
                    )}
                  </div>
                </NpjRow>
              )}

              {npj.content?.conditions?.length === 0 && (
                <NpjRow label="Detection">
                  <span className="text-xs text-muted-foreground/50 italic">No content conditions — app-level access control</span>
                </NpjRow>
              )}

              {npj.decision && (
                <NpjRow label="Decision">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn(
                      'inline-flex items-center px-2 py-0.5 rounded-md border text-xs font-medium',
                      ACTION_CHIP[npj.decision.mode] ?? 'bg-muted/50 text-muted-foreground border-border',
                    )}>
                      {npj.decision.mode}
                    </span>
                    <span className="text-xs text-muted-foreground/60">severity: <span className="text-foreground/70">{npj.decision.severity}</span></span>
                    <span className="text-xs text-muted-foreground/60">evidence: <span className={npj.decision.preserve_evidence ? 'text-emerald-400' : 'text-muted-foreground/50'}>{npj.decision.preserve_evidence ? 'yes' : 'no'}</span></span>
                    <span className="text-xs text-muted-foreground/60">incident: <span className={npj.decision.create_incident ? 'text-blue-400' : 'text-muted-foreground/50'}>{npj.decision.create_incident ? 'yes' : 'no'}</span></span>
                    {npj.decision.require_acknowledgement && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded border border-orange-500/30 bg-orange-500/10 text-[10px] text-orange-400">ack required</span>
                    )}
                    {npj.decision.require_justification && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded border border-amber-500/30 bg-amber-500/10 text-[10px] text-amber-400">justification required</span>
                    )}
                  </div>
                </NpjRow>
              )}

              {npj.exceptions && npj.exceptions.length > 0 ? (
                <NpjRow label="Exceptions">
                  <div className="space-y-1">
                    {npj.exceptions.map((ex, i) => (
                      <div key={i} className="text-xs text-foreground/75">
                        <span className="text-muted-foreground/50">{ex.effect}:</span> {ex.reason}
                      </div>
                    ))}
                  </div>
                </NpjRow>
              ) : (
                <NpjRow label="Exceptions">
                  <span className="text-xs text-muted-foreground/40 italic">—</span>
                </NpjRow>
              )}

              <NpjRow label="Generated from">
                <span className="text-xs text-muted-foreground/70">{npj.provenance?.generated_from ?? '—'}</span>
              </NpjRow>

              {npj.provenance?.warnings && npj.provenance.warnings.length > 0 ? (
                <NpjRow label="Warnings">
                  <div className="space-y-1">
                    {npj.provenance.warnings.map((w, i) => (
                      <p key={i} className="text-xs text-amber-400/80">{w}</p>
                    ))}
                  </div>
                </NpjRow>
              ) : (
                <NpjRow label="Warnings">
                  <span className="text-xs text-muted-foreground/40 italic">—</span>
                </NpjRow>
              )}
            </div>
          )}

          {valid && showJson && (
            <div className="border-t border-border/40 px-4 py-3">
              <pre className="text-xs text-muted-foreground/70 bg-muted/30 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-words font-mono border border-border/40">
                {JSON.stringify(npj, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function NpjRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-3 px-4 py-2.5 items-start">
      <span className="text-xs text-muted-foreground/55 pt-0.5 font-medium">{label}</span>
      <div>{children}</div>
    </div>
  )
}

// ── Mapping List ───────────────────────────────────────────────────────────────

function MappingList({ title, items, chipClass }: { title: string; items: string[]; chipClass: string }) {
  if (items.length === 0) return null
  // Extract the left-border color from chipClass to use as the dot/bar accent
  const accentBorder = chipClass.split(' ').find(c => c.startsWith('border-')) ?? 'border-border'
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold text-foreground/70">{title}</p>
      <div className={cn('rounded-lg border p-3 space-y-2', accentBorder, 'bg-muted/10')}>
        {items.map((item, i) => (
          <div key={i} className="flex items-start gap-2">
            <span className={cn('mt-1.5 w-1.5 h-1.5 rounded-full shrink-0', chipClass.split(' ').find(c => c.startsWith('bg-')) ?? 'bg-muted')} />
            <span className="text-xs text-foreground/75 leading-relaxed">{item}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
