'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ChevronLeft, AlertTriangle, CheckCircle2, RefreshCw, Loader2,
  Lock, ExternalLink, Copy, Check, Info,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { colorClasses, SYSTEM_LEVEL_META } from '@/lib/data-catalog/types'
import {
  upsertPolicy,
  generatePoliciesFromGovernance,
  getPolicyPackJobStatus,
  refreshPolicyFromMatrix,
  duplicatePolicyAsManual,
} from '../../../actions'
import { TAG_DISPLAY_NAMES } from '@/lib/genai/control-matrix-rows'
import type { ApprovalStatus } from '@/lib/genai/types'

// ── Types ─────────────────────────────────────────────────────────────────────

interface NpjCondition {
  type:             string
  sensitivity?:     string
  risk_family?:     string
  name?:            string
  confidence?:      string
  label_name?:      string
  label_source?:    string
  metadata_key?:    string | null
  metadata_value?:  string
  pattern?:         string
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
  effect: string
  reason: string
}

interface NeutralPolicyJson {
  schema_version?: string
  intent?:         string
  policy_family?:  string
  policy_key?:     string
  scope?: {
    users?:          string[]
    activities?:     string[]
    channels?:       string[]
    app_categories?: Array<{ id: string; system_tag: string | null; name: string }>
  }
  content?: {
    operator?:   string
    conditions?: NpjCondition[]
  }
  decision?:   NpjDecision
  exceptions?: NpjException[]
  provenance?: {
    generated_from?:    string
    source_cells?:      string[]
    compiler_version?:  string
    generated_at?:      string
    warnings?:          string[]
  }
}

export interface TranslationRow {
  id:                   string
  vendor_id:            string
  status:               string
  neutral_policy_hash:  string | null
}

export interface AppRow {
  app_id:      string
  app_name:    string
  vendor:      string
  app_type:    string
  logo_letter: string
  logo_bg:     string
}

export interface CategoryRow {
  id:         string
  system_tag: string | null
  name:       string
  color:      string
}

export interface CoachingTemplateRow {
  id:          string
  name:        string
  coach_label: string | null
}

export interface PolicyBrief {
  id:   string
  name: string
}

export interface ClassificationLabelRow {
  id:           string
  system_level: string | null
  name:         string
  color:        string
}

export interface PolicyIntentEditorProps {
  policy: {
    id:                        string
    name:                      string
    description:               string | null
    is_active:                 boolean
    approval_status:           string
    category_id:               string | null
    scope_app_ids:             string[]
    identity_context:          string[] | null
    policy_family:             string | null
    generated_from:            string | null
    data_classification_label: string | null
    fallback_action:           string | null
    coaching_template_id:      string | null
    vendor_translation_status: string
    required_dependencies:     string[]
    test_status:               string
    neutral_policy_json:       Record<string, unknown>
    policy_key:                string | null
    neutral_policy_hash:       string | null
    updated_at:                string
    policy_source:             'recommended' | 'manual'
    matrix_basis:              'default' | 'customized' | null
    last_synced_from_matrix_at: string | null
  }
  apps:                  AppRow[]
  categories:            CategoryRow[]
  classificationLabels:  ClassificationLabelRow[]
  coachingTemplates:     CoachingTemplateRow[]
  allPolicies:           PolicyBrief[]
  translations:          TranslationRow[]
  catalogDataTypes:      Array<{ id: string; name: string; risk_family: string | null }>
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ACTION_CHIP: Record<string, string> = {
  allow:      'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  monitor:    'bg-blue-500/10 text-blue-400 border-blue-500/20',
  alert:      'bg-amber-500/10 text-amber-400 border-amber-500/20',
  coach:      'bg-orange-500/10 text-orange-400 border-orange-500/20',
  'coach-ack':  'bg-orange-500/15 text-orange-300 border-orange-500/30',
  'coach-just': 'bg-amber-600/15 text-amber-300 border-amber-600/25',
  block:      'bg-red-500/10 text-red-400 border-red-500/20',
}

const INTENT_CHIP: Record<string, string> = {
  // legacy keys
  prevent_data_exfiltration:    'bg-red-500/10 text-red-400 border-red-500/20',
  monitor_and_alert:            'bg-blue-500/10 text-blue-400 border-blue-500/20',
  coach_user_behavior:          'bg-orange-500/10 text-orange-400 border-orange-500/20',
  detect_classification_label:  'bg-amber-500/10 text-amber-400 border-amber-500/20',
  // canonical NPJ keys
  prevent_exfiltration:         'bg-red-500/10 text-red-400 border-red-500/20',
  detect_only:                  'bg-blue-500/10 text-blue-400 border-blue-500/20',
  coach_user:                   'bg-orange-500/10 text-orange-400 border-orange-500/20',
  allow_approved_use:           'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  govern_app_access:            'bg-purple-500/10 text-purple-400 border-purple-500/20',
  label_or_classify:            'bg-amber-500/10 text-amber-400 border-amber-500/20',
  govern_data_at_rest:          'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
}

const TRANSLATION_CHIP: Record<string, string> = {
  pending:     'bg-amber-500/10 text-amber-400 border-amber-500/20',
  translated:  'bg-blue-500/10 text-blue-400 border-blue-500/20',
  verified:    'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  deferred:    'bg-muted/60 text-muted-foreground/60 border-border/50',
  'not-applicable': 'bg-muted/40 text-muted-foreground/50 border-border/40',
}

const NPJ_STATUS_CHIP: Record<string, string> = {
  current:  'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  outdated: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  legacy:   'bg-amber-500/10 text-amber-400 border-amber-500/20',
  invalid:  'bg-red-500/10 text-red-400 border-red-500/20',
}

const APPROVAL_OPTIONS: ApprovalStatus[] = ['draft', 'under-review', 'approved', 'rejected', 'expired']
const TEST_STATUS_OPTIONS = ['untested', 'in-progress', 'passed', 'failed'] as const

const INTENT_LABELS: Record<string, string> = {
  // legacy keys
  prevent_data_exfiltration:   'Prevent Data Exfiltration',
  monitor_and_alert:           'Monitor & Alert',
  coach_user_behavior:         'Coach User Behavior',
  detect_classification_label: 'Detect Classification Label',
  // canonical NPJ keys
  prevent_exfiltration:        'Prevent Exfiltration',
  detect_only:                 'Detect Only',
  coach_user:                  'Coach User',
  allow_approved_use:          'Allow Approved Use',
  govern_app_access:           'Govern App Access',
  label_or_classify:           'Label / Classify',
  govern_data_at_rest:         'Govern Data at Rest',
}

const POLICY_FAMILY_LABELS: Record<string, string> = {
  genai_content_detection: 'GenAI Content Detection',
  genai_app_access:        'GenAI App Access',
  genai_label_detection:   'GenAI Label Detection',
  genai_filename:          'Filename Detection',
  saas_data_protection:    'SaaS Data Protection',
}

const GENERATED_FROM_LABELS: Record<string, string> = {
  recommended: 'Recommended',
  manual:      'Manual',
}

const RF_DISPLAY_NAMES: Record<string, string> = {
  credentials_keys_secrets:     'Credentials, Keys & Secrets',
  regulated_data:               'Regulated Data',
  source_code:                  'Source Code',
  intellectual_property:        'Intellectual Property',
  customer_employee_data:       'Customer & Employee Data',
  financial_commercial_data:    'Financial & Commercial Data',
  legal_contractual_data:       'Legal & Contractual Data',
  security_infrastructure_data: 'Security & Infrastructure Data',
  public_low_risk_data:         'Public & Low-Risk Data',
  bulk_data:                    'Bulk Data / Large Dataset',
  large_file_upload:            'Large File Upload',
  general_usage_reminder:       'General Usage Reminder',
}

const ACTIVITY_DISPLAY: Record<string, string> = {
  prompt_submit: 'Prompt Submit', post_prompt: 'Prompt', upload: 'Upload',
  download: 'Download', response: 'Response', browse: 'Browse',
  login: 'Login', post: 'Post', share: 'Share', copy_paste: 'Copy / Paste',
  print: 'Print', email_send: 'Email Send',
}

const APPROVAL_CHIP_LABELS: Record<string, string> = {
  draft: 'Draft', 'under-review': 'Under Review', approved: 'Approved',
  rejected: 'Rejected', expired: 'Expired',
}

const NPJ_STATUS_LABELS: Record<string, string> = {
  current: 'Up to date', outdated: 'NPJ Outdated', legacy: 'Legacy', invalid: 'Invalid NPJ',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isValidNpj(npj: unknown): npj is NeutralPolicyJson {
  if (!npj || typeof npj !== 'object') return false
  const n = npj as Record<string, unknown>
  return n.schema_version === '1.0' && typeof n.intent === 'string' && typeof n.decision === 'object'
}

function npjStatus(npj: unknown, updatedAt: string): 'current' | 'outdated' | 'legacy' | 'invalid' {
  if (!npj || (typeof npj === 'object' && Object.keys(npj as object).length === 0)) return 'legacy'
  if (!isValidNpj(npj)) return 'invalid'
  const generatedAt = (npj as NeutralPolicyJson).provenance?.generated_at
  if (generatedAt && generatedAt < updatedAt) return 'outdated'
  return 'current'
}

// ── Sub-components ────────────────────────────────────────────────────────────

function NpjRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-0 px-5 py-3 border-b border-border/40 last:border-0">
      <span className="w-44 shrink-0 text-[11px] font-bold uppercase tracking-widest text-muted-foreground/40 pt-0.5">{label}</span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )
}

function SectionCard({ title, children, tooltip, readOnly, accent }: {
  title:     string
  children:  React.ReactNode
  tooltip?:  string
  readOnly?: boolean
  accent?:   string
}) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
      <div className={cn('flex items-center justify-between px-5 py-3.5 border-b border-border/50', accent ?? 'bg-muted/5')}>
        <div className="flex items-center gap-2.5">
          <span className="text-sm font-bold text-foreground">{title}</span>
          {readOnly && (
            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/40 font-medium">
              <Lock className="h-2.5 w-2.5" /> Compiler-managed
            </span>
          )}
          {tooltip && (
            <span title={tooltip} className="cursor-help">
              <Info className="h-3 w-3 text-muted-foreground/35" />
            </span>
          )}
        </div>
      </div>
      <div>{children}</div>
    </div>
  )
}

function DecisionFlags({ decision }: { decision: NpjDecision }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className={cn('inline-flex items-center px-3 py-1 rounded-lg border text-sm font-bold', ACTION_CHIP[decision.mode] ?? 'bg-muted/50 text-muted-foreground border-border')}>
        {decision.mode}
      </span>
      <div className="flex flex-wrap items-center gap-1.5 ml-1">
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted/40 border border-border/50 text-muted-foreground/70 font-mono">
          severity: <span className="text-foreground/80">{decision.severity}</span>
        </span>
        <span className={cn('text-[10px] px-1.5 py-0.5 rounded border font-mono',
          decision.preserve_evidence
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400/90'
            : 'bg-muted/40 border-border/40 text-muted-foreground/40'
        )}>evidence: {decision.preserve_evidence ? 'yes' : 'no'}</span>
        <span className={cn('text-[10px] px-1.5 py-0.5 rounded border font-mono',
          decision.create_incident
            ? 'bg-blue-500/10 border-blue-500/20 text-blue-400/90'
            : 'bg-muted/40 border-border/40 text-muted-foreground/40'
        )}>incident: {decision.create_incident ? 'yes' : 'no'}</span>
        {decision.require_acknowledgement && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded border border-orange-500/30 bg-orange-500/10 text-[10px] text-orange-400 font-medium">ack required</span>
        )}
        {decision.require_justification && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded border border-amber-500/30 bg-amber-500/10 text-[10px] text-amber-400 font-medium">justification required</span>
        )}
      </div>
    </div>
  )
}

function StatusChip({ label, chipClass }: { label: string; chipClass: string }) {
  return (
    <span className={cn('inline-flex items-center px-2.5 py-1 rounded-lg border text-xs font-medium', chipClass)}>
      {label}
    </span>
  )
}

function Chip({ label, color = 'zinc' }: { label: string; color?: string }) {
  const c = colorClasses(color)
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-md border text-xs font-medium', c.text, c.bg, c.border)}>
      {label}
    </span>
  )
}

function ReadOnlyTooltip({ children, tip }: { children: React.ReactNode; tip: string }) {
  return (
    <div className="relative group inline-flex items-center gap-1" title={tip}>
      {children}
      <Lock className="h-3 w-3 text-muted-foreground/30 group-hover:text-muted-foreground/60 cursor-help transition-colors" />
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export function PolicyIntentEditor({
  policy,
  apps,
  coachingTemplates,
  allPolicies,
  translations,
  catalogDataTypes,
}: PolicyIntentEditorProps) {
  const router        = useRouter()
  const npj           = isValidNpj(policy.neutral_policy_json) ? (policy.neutral_policy_json as NeutralPolicyJson) : null
  const rawNpj        = policy.neutral_policy_json
  const status        = npjStatus(rawNpj, policy.updated_at)
  const isRecommended = policy.policy_source === 'recommended'

  // ── form state (safe-field edits) ──────────────────────────────────────────
  const [formName,             setFormName]             = useState(policy.name)
  const [formDesc,             setFormDesc]             = useState(policy.description ?? '')
  const [formActive,           setFormActive]           = useState(policy.is_active)
  const [formApproval,         setFormApproval]         = useState<ApprovalStatus>(policy.approval_status as ApprovalStatus)
  const [formTestStatus,       setFormTestStatus]       = useState(policy.test_status)
  const [formCoachTemplate,    setFormCoachTemplate]    = useState(policy.coaching_template_id ?? '')
  const [formRelatedPolicies,  setFormRelatedPolicies]  = useState<string[]>(policy.required_dependencies)
  const [formAppIds,           setFormAppIds]           = useState<string[]>(policy.scope_app_ids)
  const [translationStatus,    setTranslationStatus]    = useState(policy.vendor_translation_status)
  const [saving,               setSaving]               = useState(false)
  const [saveError,            setSaveError]            = useState('')
  const [saveSuccess,          setSaveSuccess]          = useState(false)

  // ── compile state ──────────────────────────────────────────────────────────
  const [compiling,    setCompiling]    = useState(false)
  const [compileJobId, setCompileJobId] = useState<string | null>(null)

  // ── collapsible panels ─────────────────────────────────────────────────────
  const [sourceOpen,    setSourceOpen]    = useState(false)
  const [npjOpen,       setNpjOpen]       = useState(false)
  const [npjJsonOpen,   setNpjJsonOpen]   = useState(false)
  const [advancedOpen,  setAdvancedOpen]  = useState(false)
  const [jsonCopied,    setJsonCopied]    = useState(false)
  const [refreshing,    setRefreshing]    = useState(false)
  const [refreshError,  setRefreshError]  = useState('')
  const [duplicating,   setDuplicating]   = useState(false)

  // ── poll compile job ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!compileJobId || !compiling) return
    const interval = setInterval(async () => {
      try {
        const s = await getPolicyPackJobStatus(compileJobId)
        if (s.status === 'completed') {
          clearInterval(interval)
          setCompiling(false)
          setCompileJobId(null)
          router.refresh()
        } else if (s.status === 'failed') {
          clearInterval(interval)
          setCompiling(false)
          setSaveError(s.error ?? 'Compile job failed.')
        }
      } catch {
        // auth error (analyst can't poll admin-only endpoint) — stop polling, treat as success
        clearInterval(interval)
        setCompiling(false)
        setCompileJobId(null)
      }
    }, 2500)
    return () => clearInterval(interval)
  }, [compileJobId, compiling, router])

  // ── handlers ──────────────────────────────────────────────────────────────

  async function handleRefresh() {
    setRefreshing(true)
    setRefreshError('')
    const res = await refreshPolicyFromMatrix(policy.id)
    setRefreshing(false)
    if (res.error) { setRefreshError(res.error); return }
    router.refresh()
  }

  async function handleDuplicateAsManual() {
    setDuplicating(true)
    const res = await duplicatePolicyAsManual(policy.id)
    setDuplicating(false)
    if (res.error) { setSaveError(res.error); return }
    if (res.newPolicyId) router.push(`/genai-controls/policies/${res.newPolicyId}/edit`)
  }

  async function handleSave() {
    setSaving(true)
    setSaveError('')
    setSaveSuccess(false)
    const fields: Parameters<typeof upsertPolicy>[1] = {
      name:                 formName.trim() || policy.name,
      description:          formDesc.trim() || undefined,
      is_active:            formActive,
      approval_status:      formApproval,
      test_status:          formTestStatus as 'untested' | 'in-progress' | 'passed' | 'failed',
      coaching_template_id: formCoachTemplate || null,
      required_dependencies: formRelatedPolicies,
      scope_app_ids:        formAppIds,
    }
    // Auto-mark translation pending when user-visible fields change
    if (translationStatus !== 'not-applicable') {
      const nameChanged  = formName.trim() !== policy.name
      const descChanged  = (formDesc.trim() || null) !== policy.description
      const scopeChanged = JSON.stringify([...formAppIds].sort()) !== JSON.stringify([...policy.scope_app_ids].sort())
      if (nameChanged || descChanged || scopeChanged) {
        fields.vendor_translation_status = 'pending'
        setTranslationStatus('pending')
      }
    }
    const res = await upsertPolicy(policy.id, fields)
    setSaving(false)
    if (res.error) { setSaveError(res.error); return }
    setSaveSuccess(true)
    setTimeout(() => setSaveSuccess(false), 3000)
  }

  async function handleCompile() {
    setCompiling(true)
    const res = await generatePoliciesFromGovernance()
    if (res.error) {
      setSaveError(res.error)
      setCompiling(false)
      return
    }
    if (res.jobId) {
      setCompileJobId(res.jobId)
    } else {
      setCompiling(false)
      router.refresh()
    }
  }

  async function handleTranslationAction(action: 'verified' | 'deferred' | 'not-applicable') {
    if (action === 'not-applicable') {
      if (!window.confirm('Are you sure this policy does not need vendor translation?')) return
    }
    const res = await upsertPolicy(policy.id, { vendor_translation_status: action })
    if (!res.error) setTranslationStatus(action)
  }

  // ── computed ──────────────────────────────────────────────────────────────
  const verifiedTranslations = translations.filter(t => t.status === 'verified').length

  function toggleAppId(appId: string) {
    setFormAppIds(ids =>
      ids.includes(appId) ? ids.filter(i => i !== appId) : [...ids, appId]
    )
  }

  function toggleRelatedPolicy(id: string) {
    setFormRelatedPolicies(ids =>
      ids.includes(id) ? ids.filter(i => i !== id) : [...ids, id]
    )
  }

  // ── logic warnings ────────────────────────────────────────────────────────
  const warnings: string[] = []
  if (npj) {
    const acts  = npj.scope?.activities ?? []
    const conds = npj.content?.conditions ?? []
    if ((acts.includes('download') || acts.includes('response')) &&
      /pii|phi|secret|upload|prompt|credential/i.test(policy.name)) {
      warnings.push('Activities include Download or Response on a submission-prevention policy. Confirm this is intentional — these target AI output, not user input.')
    }
    if (conds.some(c => c.type === 'classification_label') &&
      (acts.includes('post') || acts.includes('prompt_submit'))) {
      warnings.push('Label detection applies to file metadata only. Prompt/Post is not recommended for label detection policies.')
    }
    if (npj.intent === 'allow_approved_use' &&
      !formAppIds.length && !(npj.scope?.app_categories?.length)) {
      warnings.push('Allow policy is not scoped to a specific app or user group. Tightly scope allow policies before enabling.')
    }
  } else if (status === 'legacy' || status === 'invalid') {
    warnings.push('No neutral policy data — vendor translation will use legacy fields only. Regenerate to compile structured neutral policy.')
  }

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* ── 1. Header ────────────────────────────────────────────────────── */}
      <div>
        <Link
          href="/genai-controls/policies"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground/80 hover:text-foreground/70 transition-colors mb-3"
        >
          <ChevronLeft className="h-3 w-3" /> Policy Library
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-foreground truncate">{policy.name}</h1>
              {policy.is_active ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400">
                  <span className="text-emerald-400">●</span> Active
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground/50">
                  <span>○</span> Inactive
                </span>
              )}
            </div>
            {policy.description && (
              <p className="text-sm text-muted-foreground/70 mt-0.5 line-clamp-2">{policy.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
            <StatusChip
              label={APPROVAL_CHIP_LABELS[policy.approval_status] ?? policy.approval_status}
              chipClass={
                policy.approval_status === 'approved' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                policy.approval_status === 'draft' ? 'bg-muted/60 text-muted-foreground/70 border-border/60' :
                'bg-amber-500/10 text-amber-400 border-amber-500/20'
              }
            />
            <StatusChip
              label={
                translationStatus === 'pending' ? 'Translation Pending' :
                translationStatus === 'translated' ? 'Translated' :
                translationStatus === 'verified' ? 'Translation Verified' :
                translationStatus === 'deferred' ? 'Translation Deferred' :
                translationStatus === 'not-applicable' ? 'N/A' :
                translationStatus
              }
              chipClass={TRANSLATION_CHIP[translationStatus] ?? 'bg-muted/60 text-muted-foreground/70 border-border/60'}
            />
            <StatusChip
              label={policy.test_status}
              chipClass={
                policy.test_status === 'passed' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                policy.test_status === 'failed' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                'bg-muted/60 text-muted-foreground/70 border-border/60'
              }
            />
            {status !== 'current' && (
              <StatusChip
                label={NPJ_STATUS_LABELS[status] ?? `NPJ ${status}`}
                chipClass={NPJ_STATUS_CHIP[status] ?? 'bg-muted/60 text-muted-foreground/70 border-border/60'}
              />
            )}
          </div>
        </div>
      </div>

      {/* ── Recommended Policy Banner ────────────────────────────────────── */}
      {isRecommended && (
        <div className="rounded-xl border border-blue-500/25 bg-blue-500/6 overflow-hidden">
          <div className="flex items-start justify-between gap-4 px-4 py-3.5">
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-foreground">Recommended Policy</span>
                {policy.matrix_basis === 'default' && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md border border-blue-500/30 bg-blue-500/10 text-[10px] font-medium text-blue-400">Default Matrix</span>
                )}
                {policy.matrix_basis === 'customized' && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md border border-amber-500/30 bg-amber-500/10 text-[10px] font-medium text-amber-400">Customized Matrix</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground/60">
                This policy is managed by the Control Matrix and updated automatically when you change detection settings.
                {policy.last_synced_from_matrix_at && (
                  <> Last synced {new Date(policy.last_synced_from_matrix_at).toLocaleString()}.</>
                )}
              </p>
              {refreshError && <p className="text-xs text-red-400 mt-1">{refreshError}</p>}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleRefresh}
                disabled={refreshing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 text-xs font-medium text-blue-400 hover:bg-blue-500/15 transition-colors disabled:opacity-50"
              >
                {refreshing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                Refresh from Matrix
              </button>
              <button
                type="button"
                onClick={handleDuplicateAsManual}
                disabled={duplicating}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-muted/30 text-xs font-medium text-muted-foreground/70 hover:bg-muted/50 hover:text-foreground/80 transition-colors disabled:opacity-50"
              >
                {duplicating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Copy className="h-3 w-3" />}
                Duplicate as Manual
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Logic Warnings ───────────────────────────────────────────────── */}
      {warnings.length > 0 && (
        <div className="space-y-2">
          {warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/8 px-4 py-2.5 text-xs text-amber-400">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── 2. Intent Summary Card ───────────────────────────────────────── */}
      {(status === 'legacy' || status === 'invalid') && (
        <div className="flex items-center justify-between rounded-xl border border-amber-500/25 bg-amber-500/8 px-4 py-3">
          <div className="flex items-center gap-2 text-xs text-amber-400">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>Legacy fields only — regenerate to compile structured neutral policy.</span>
          </div>
          <button
            type="button"
            onClick={handleCompile}
            disabled={compiling}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-xs font-medium text-amber-400 hover:bg-amber-500/15 transition-colors disabled:opacity-50"
          >
            {compiling ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            Regenerate
          </button>
        </div>
      )}

      {npj && (
        <SectionCard title="Intent" accent="bg-muted/8">
          <NpjRow label="Intent">
            <span className={cn('inline-flex items-center px-2.5 py-1 rounded-lg border text-xs font-semibold', INTENT_CHIP[npj.intent ?? ''] ?? 'bg-muted/50 text-muted-foreground border-border')}>
              {INTENT_LABELS[npj.intent ?? ''] ?? npj.intent ?? '—'}
            </span>
          </NpjRow>
          <NpjRow label="Policy Family">
            <span className="text-sm text-foreground/80">
              {(() => { const pf = npj.policy_family ?? policy.policy_family; return pf ? (POLICY_FAMILY_LABELS[pf] ?? pf) : '—' })()}
            </span>
          </NpjRow>
          {(npj.scope?.users?.length ?? 0) > 0 && (
            <NpjRow label="Users">
              <div className="flex flex-wrap gap-1.5">
                {(npj.scope!.users!).map((u, i) => (
                  <span key={i} className={cn(
                    'inline-flex items-center px-2 py-0.5 rounded-md border text-xs font-medium',
                    u === 'All Users'
                      ? 'border-border bg-muted/40 text-muted-foreground/70'
                      : 'border-blue-500/25 bg-blue-500/10 text-blue-400',
                  )}>
                    {u === 'All Users' ? 'All Users' : `${u} Users`}
                  </span>
                ))}
              </div>
            </NpjRow>
          )}
          <NpjRow label="Monitored Activities">
            <ReadOnlyTooltip tip="Activities are set by the compiler. Use Policy Change Assistant to change.">
              <div className="flex flex-wrap gap-1.5">
                {(npj.scope?.activities ?? []).map((a, i) => (
                  <span key={i} className="inline-flex items-center px-2.5 py-1 rounded-lg border border-blue-500/25 bg-blue-500/10 text-xs font-medium text-blue-400">{ACTIVITY_DISPLAY[a] ?? a}</span>
                ))}
                {!npj.scope?.activities?.length && <span className="text-xs text-muted-foreground/40 italic">—</span>}
              </div>
            </ReadOnlyTooltip>
          </NpjRow>
          <NpjRow label="Enforcement">
            {npj.decision ? (
              (() => {
                if (isRecommended) {
                  const abc = (rawNpj as Record<string, unknown>)?.actions_by_category as Record<string, string> | undefined
                  const unique = abc ? [...new Set(Object.values(abc))] : []
                  if (unique.length > 1) {
                    return (
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg border border-muted/50 bg-muted/20 text-xs font-semibold text-muted-foreground/70">
                          Varies by category
                        </span>
                        <span className="text-[10px] text-muted-foreground/40">See Actions by Category below</span>
                      </div>
                    )
                  }
                  if (unique.length === 1) {
                    return (
                      <span className={cn('inline-flex items-center px-2.5 py-1 rounded-lg border text-sm font-bold', ACTION_CHIP[unique[0]] ?? 'bg-muted/50 text-muted-foreground border-border')}>
                        {unique[0]}
                      </span>
                    )
                  }
                }
                return <DecisionFlags decision={npj.decision} />
              })()
            ) : (
              <span className="text-xs text-muted-foreground/40 italic">—</span>
            )}
          </NpjRow>
          <NpjRow label="Content Inspection">
            <div className="flex flex-wrap gap-1.5">
              {(npj.content?.conditions ?? []).map((c, i) => {
                if (c.type === 'data_type') {
                  if (c.sensitivity) {
                    const meta = SYSTEM_LEVEL_META[c.sensitivity as keyof typeof SYSTEM_LEVEL_META]
                    return <Chip key={i} label={meta?.label ?? c.sensitivity} color={meta?.color ?? 'zinc'} />
                  }
                  if (c.risk_family) {
                    return <Chip key={i} label={RF_DISPLAY_NAMES[c.risk_family] ?? c.risk_family} color="zinc" />
                  }
                }
                if (c.type === 'classification_label') {
                  if (npj.policy_family === 'genai_filename')
                    return <Chip key={i} label={`${c.label_name ?? ''} Filename`} color="zinc" />
                  return <Chip key={i} label={c.label_name ?? 'label'} color="amber" />
                }
                if (c.type === 'filename') return <Chip key={i} label="filename pattern" color="blue" />
                return null
              })}
              {!npj.content?.conditions?.length && <span className="text-xs text-muted-foreground/40 italic">App-level access control</span>}
            </div>
          </NpjRow>
          <NpjRow label="Source">
            <span className="text-xs text-muted-foreground/70">
              {(() => { const gf = npj.provenance?.generated_from ?? policy.generated_from; return gf ? (GENERATED_FROM_LABELS[gf] ?? gf) : '—' })()}
            </span>
          </NpjRow>
        </SectionCard>
      )}

      {!npj && (
        <div className="rounded-xl border border-border bg-card divide-y divide-border/40">
          <NpjRow label="Policy Family"><span className="text-xs text-foreground/80">{policy.policy_family ?? '—'}</span></NpjRow>
          <NpjRow label="Decision">
            {policy.data_classification_label && (
              <span className={cn('inline-flex items-center px-2 py-0.5 rounded-md border text-xs font-medium', ACTION_CHIP[policy.fallback_action ?? ''] ?? 'bg-muted/50 text-muted-foreground border-border')}>
                {policy.fallback_action ?? 'not-set'}
              </span>
            )}
          </NpjRow>
          <NpjRow label="Generated From"><span className="text-xs text-muted-foreground/70">{policy.generated_from ?? '—'}</span></NpjRow>
        </div>
      )}

      {/* ── 3. Source of Truth Panel ─────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <button
          type="button"
          onClick={() => setSourceOpen(o => !o)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-foreground hover:bg-muted/30 transition-colors text-left"
        >
          <span className="flex items-center gap-2">
            <span className="text-muted-foreground/60 text-xs">{sourceOpen ? '▼' : '▶'}</span>
            Source of Truth
          </span>
        </button>
        {sourceOpen && (
          <div className="border-t border-border divide-y divide-border/40">
            <NpjRow label="Source">
              <span className="text-xs text-foreground/80">{isRecommended ? 'Recommended (Control Matrix)' : 'Manual'}</span>
            </NpjRow>
            {isRecommended && (
              <>
                <NpjRow label="Decision Source"><span className="text-xs text-foreground/80">Control Matrix</span></NpjRow>
                <NpjRow label="Detection Source"><span className="text-xs text-foreground/80">Data Catalog</span></NpjRow>
                <NpjRow label="App Categories"><span className="text-xs text-foreground/80">App Governance</span></NpjRow>
                <NpjRow label="Matrix Basis">
                  <span className="text-xs text-foreground/80">{policy.matrix_basis === 'customized' ? 'Customized (org overrides applied)' : 'Default'}</span>
                </NpjRow>
                {policy.last_synced_from_matrix_at && (
                  <NpjRow label="Last Synced">
                    <span className="text-xs text-muted-foreground/60">{new Date(policy.last_synced_from_matrix_at).toLocaleString()}</span>
                  </NpjRow>
                )}
              </>
            )}
            {!isRecommended && (
              <NpjRow label="Note">
                <span className="text-xs text-muted-foreground/60">Direct edits allowed — this policy is not governed by the Control Matrix.</span>
              </NpjRow>
            )}
            {npj?.provenance?.compiler_version && (
              <NpjRow label="Compiler">
                <span className="text-xs text-muted-foreground/60 font-mono">v{npj.provenance.compiler_version} · compiled {npj.provenance.generated_at ? new Date(npj.provenance.generated_at).toLocaleString() : '—'}</span>
              </NpjRow>
            )}
          </div>
        )}
      </div>

      {/* ── 4. Scope Section ─────────────────────────────────────────────── */}
      <SectionCard
        title="Scope"
        tooltip={isRecommended ? 'App categories, channels, and activities are derived from the Control Matrix. Edit detection settings there to change them.' : undefined}
      >
        <div className="space-y-5 px-5 py-4">
          {npj?.scope?.app_categories && npj.scope.app_categories.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40 mb-2 flex items-center gap-1">
                App Categories <Lock className="h-2.5 w-2.5 text-muted-foreground/30" />
              </p>
              <div className="flex flex-wrap gap-1.5">
                {npj.scope.app_categories.map((cat, i) => (
                  <Chip key={i} label={cat.name} color="zinc" />
                ))}
              </div>
            </div>
          )}
          {npj?.scope?.channels && npj.scope.channels.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40 mb-2 flex items-center gap-1">
                Channels <Lock className="h-2.5 w-2.5 text-muted-foreground/30" />
              </p>
              <div className="flex flex-wrap gap-1.5">
                {npj.scope.channels.map((c, i) => (
                  <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-md border border-border bg-muted/40 text-xs text-muted-foreground/70">{c}</span>
                ))}
              </div>
            </div>
          )}
          {npj?.scope?.activities && npj.scope.activities.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40 mb-2 flex items-center gap-1">
                Activities <Lock className="h-2.5 w-2.5 text-muted-foreground/30" />
                <span title="Activities are set by the compiler based on policy family. To change activities, use Policy Change Assistant below." className="cursor-help">
                  <Info className="h-3 w-3 text-muted-foreground/30 ml-0.5" />
                </span>
              </p>
              <div className="flex flex-wrap gap-1.5">
                {npj.scope.activities.map((a, i) => (
                  <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-md border border-blue-500/25 bg-blue-500/10 text-xs text-blue-400">{ACTIVITY_DISPLAY[a] ?? a}</span>
                ))}
              </div>
            </div>
          )}
          {!isRecommended && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40 mb-2">Specific Apps (optional override)</p>
              <div className="flex flex-wrap gap-1.5">
                {formAppIds.map(id => {
                  const app = apps.find(a => a.app_id === id)
                  if (!app) return null
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => toggleAppId(id)}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-blue-500/30 bg-blue-500/10 text-xs text-blue-400 hover:bg-blue-500/15 transition-colors"
                    >
                      {app.app_name} <span className="text-blue-400/60 hover:text-blue-400">×</span>
                    </button>
                  )
                })}
                {formAppIds.length === 0 && <span className="text-xs text-muted-foreground/40 italic">All apps in category</span>}
              </div>
              {apps.length > 0 && (
                <details className="mt-2">
                  <summary className="text-xs text-muted-foreground/60 cursor-pointer hover:text-muted-foreground/80 transition-colors select-none">
                    + Add specific app
                  </summary>
                  <div className="mt-2 grid grid-cols-2 gap-1 max-h-40 overflow-y-auto border border-border rounded-lg p-2">
                    {apps.map(app => (
                      <label key={app.app_id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted/30 cursor-pointer text-xs text-foreground/80 transition-colors">
                        <input
                          type="checkbox"
                          checked={formAppIds.includes(app.app_id)}
                          onChange={() => toggleAppId(app.app_id)}
                          className="accent-blue-500 w-3 h-3"
                        />
                        {app.app_name}
                      </label>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}
          {(policy.identity_context ?? []).length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground/60 mb-2 flex items-center gap-1">
                Identity Context <Lock className="h-2.5 w-2.5 text-muted-foreground/30" />
              </p>
              <div className="flex flex-wrap gap-1.5">
                {(policy.identity_context ?? []).map((c, i) => (
                  <Chip key={i} label={c} color="zinc" />
                ))}
              </div>
            </div>
          )}
        </div>
      </SectionCard>

      {/* ── 5. Detection Section ─────────────────────────────────────────── */}
      <SectionCard
        title="Detection"
        readOnly={isRecommended}
        tooltip={isRecommended ? 'Detection conditions are generated from your Data Catalog and Customer Labels.' : undefined}
      >
        {npj?.content?.conditions && npj.content.conditions.length > 0 ? (
          <div className="space-y-2 px-5 py-4">
            {npj.content.conditions.map((cond, i) => (
              <div key={i} className="rounded-lg border border-border bg-muted/20 px-4 py-3">
                {cond.type === 'data_type' && (
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-mono text-muted-foreground/50 uppercase">data type</span>
                        {cond.sensitivity && (() => {
                          const meta = SYSTEM_LEVEL_META[cond.sensitivity as keyof typeof SYSTEM_LEVEL_META]
                          return <Chip label={meta?.label ?? cond.sensitivity} color={meta?.color ?? 'zinc'} />
                        })()}
                        {!cond.sensitivity && cond.risk_family && (
                          <span className="text-xs font-semibold text-foreground/80">
                            {RF_DISPLAY_NAMES[cond.risk_family] ?? cond.risk_family}
                          </span>
                        )}
                        {cond.confidence && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded border border-border bg-muted/30 text-muted-foreground/60 uppercase">{cond.confidence}</span>
                        )}
                      </div>
                      {cond.name && <p className="text-xs text-foreground/70">{cond.name}</p>}
                      {cond.risk_family && (() => {
                        const dbRfName = RF_DISPLAY_NAMES[cond.risk_family] ?? cond.risk_family
                        const types = catalogDataTypes.filter(t => t.risk_family === dbRfName)
                        if (types.length === 0) return null
                        return (
                          <div className="mt-2.5 flex flex-wrap gap-1.5">
                            {types.map(t => (
                              <span key={t.id} className="text-[10px] px-1.5 py-0.5 rounded border border-border/50 bg-muted/40 text-muted-foreground/60">
                                {t.name}
                              </span>
                            ))}
                          </div>
                        )
                      })()}
                    </div>
                  </div>
                )}
                {cond.type === 'classification_label' && (
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-mono text-muted-foreground/50 uppercase">
                        {npj?.policy_family === 'genai_filename' ? 'filename pattern' : 'label'}
                      </span>
                      <span className="text-xs font-medium text-foreground/80">{cond.label_name}</span>
                      {cond.label_source && <span className="text-[10px] px-1.5 py-0.5 rounded border border-border bg-muted/30 text-muted-foreground/60">{cond.label_source}</span>}
                    </div>
                    {npj?.policy_family === 'genai_filename' ? (
                      <p className="text-xs text-muted-foreground/60">
                        Matches uploads where the filename indicates {cond.label_name?.toLowerCase()} content
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground/60">
                        {cond.metadata_key
                          ? <span className="font-mono">{cond.metadata_key} = {cond.metadata_value}</span>
                          : <span className="italic">No key configured</span>
                        }
                      </p>
                    )}
                    <p className="text-[10px] text-muted-foreground/40 mt-1">Upload only</p>
                  </div>
                )}
                {cond.type === 'filename' && (
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-mono text-muted-foreground/50 uppercase">filename</span>
                    </div>
                    <p className="text-xs font-mono text-foreground/70">{cond.pattern}</p>
                    <p className="text-[10px] text-muted-foreground/40 mt-1">Upload only</p>
                  </div>
                )}
                {cond.type === 'govern_app_access' && (
                  <span className="text-xs text-muted-foreground/60 italic">No content inspection — app-level access control policy</span>
                )}
              </div>
            ))}
          </div>
        ) : npj?.content?.conditions?.length === 0 ? (
          <p className="px-5 py-4 text-xs text-muted-foreground/60 italic">No content conditions — app-level access control policy.</p>
        ) : (
          <div className="px-5 py-4 space-y-1">
            {policy.data_classification_label && (
              <div className="flex items-center gap-2">
                {(() => {
                  const meta = SYSTEM_LEVEL_META[policy.data_classification_label as keyof typeof SYSTEM_LEVEL_META]
                  return meta ? <Chip label={meta.label} color={meta.color} /> : <span className="text-xs text-foreground/70">{policy.data_classification_label}</span>
                })()}
                <span className="text-xs text-amber-400/70">(legacy field — regenerate for full conditions)</span>
              </div>
            )}
            {!policy.data_classification_label && <p className="text-xs text-muted-foreground/40 italic">No detection data — regenerate policies.</p>}
          </div>
        )}
      </SectionCard>

      {/* ── 6. Decision Section ──────────────────────────────────────────── */}
      <SectionCard
        title="Decision"
        readOnly={isRecommended}
        tooltip={isRecommended ? 'Decision is governed by the Control Matrix. Change detection settings in the Control Matrix to update.' : undefined}
      >
        <div className="px-5 py-4 space-y-4">
          {npj?.decision ? (
            <DecisionFlags decision={npj.decision} />
          ) : (
            <div className="flex items-center gap-2">
              <span className={cn('inline-flex items-center px-2.5 py-1 rounded-lg border text-xs font-semibold', ACTION_CHIP[policy.fallback_action ?? ''] ?? 'bg-muted/50 text-muted-foreground border-border')}>
                {policy.fallback_action ?? 'not-set'}
              </span>
              <span className="text-[10px] text-amber-400/70">(legacy field)</span>
            </div>
          )}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40 block mb-1.5">Coaching Template</label>
            <select
              value={formCoachTemplate}
              onChange={e => setFormCoachTemplate(e.target.value)}
              disabled={isRecommended}
              className="block w-full max-w-xs rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-border-strong disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">None</option>
              {coachingTemplates.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        </div>
      </SectionCard>

      {/* ── 7. Exceptions Section ────────────────────────────────────────── */}
      <SectionCard
        title="Exceptions"
        readOnly={isRecommended}
        tooltip={isRecommended ? 'Exceptions are not applicable to Recommended policies.' : undefined}
      >
        {npj?.exceptions && npj.exceptions.length > 0 ? (
          <div className="px-5 py-4 space-y-2">
            {npj.exceptions.map((ex, i) => (
              <div key={i} className="flex items-start gap-3 rounded-lg border border-border bg-muted/20 px-4 py-3">
                <span className={cn('inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] font-semibold shrink-0 mt-0.5', ACTION_CHIP[ex.effect] ?? 'bg-muted/50 text-muted-foreground border-border')}>
                  {ex.effect}
                </span>
                <span className="text-xs text-foreground/75">{ex.reason}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="px-5 py-4 text-xs text-muted-foreground/40 italic">None — no exceptions configured.</p>
        )}
      </SectionCard>

      {/* ── 8. Per-Category Actions (Recommended policies only) ──────────── */}
      {isRecommended && (() => {
        const actionsByCategory = (rawNpj as Record<string, unknown>)?.actions_by_category as Record<string, string> | undefined
        const coachingByCategory = (rawNpj as Record<string, unknown>)?.coaching_by_category as Record<string, string | null> | undefined
        if (!actionsByCategory || Object.keys(actionsByCategory).length === 0) return null
        return (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border/50 bg-muted/5 flex items-center gap-2">
              <span className="text-sm font-bold text-foreground">Actions by Category</span>
              <span className="text-[10px] px-2 py-0.5 rounded-md border border-blue-500/25 bg-blue-500/8 text-blue-400 font-medium">Control Matrix</span>
            </div>
            <div className="divide-y divide-border/40">
              {(() => {
                const ORDER = ['Approved & Supported', 'Approved with Conditions', 'Restricted', 'Prohibited']
                return Object.entries(actionsByCategory)
                  .sort(([a], [b]) => {
                    const nameA = TAG_DISPLAY_NAMES[a] ?? a
                    const nameB = TAG_DISPLAY_NAMES[b] ?? b
                    const ia = ORDER.findIndex(p => nameA.includes(p))
                    const ib = ORDER.findIndex(p => nameB.includes(p))
                    return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib)
                  })
                  .map(([cat, action]) => (
                    <div key={cat} className="flex items-center justify-between px-5 py-3">
                      <span className="text-xs text-foreground/70">{TAG_DISPLAY_NAMES[cat] ?? cat.replace(/_/g, ' ')}</span>
                      <div className="flex items-center gap-2">
                        <span className={cn('inline-flex items-center px-2.5 py-1 rounded-lg border text-xs font-semibold', ACTION_CHIP[action] ?? 'bg-muted/50 text-muted-foreground border-border')}>
                          {action}
                        </span>
                        {coachingByCategory?.[cat] && (() => {
                          const tpl = coachingTemplates.find(t => t.id === coachingByCategory[cat])
                          const coachName = tpl?.coach_label ?? tpl?.name ?? 'coaching set'
                          return <span className="text-[10px] text-muted-foreground/50">{coachName}</span>
                        })()}
                      </div>
                    </div>
                  ))
              })()}
            </div>
          </div>
        )
      })()}

      {/* ── 8b. Control Matrix link (Recommended) ───────────────────────── */}
      {isRecommended && (
        <div className="rounded-xl border border-border bg-card/50 px-4 py-3.5 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-foreground">Change detection settings</p>
            <p className="text-[10px] text-muted-foreground/50 mt-0.5">Edit actions in the Control Matrix to update this policy. Changes sync automatically.</p>
          </div>
          <Link
            href="/genai-controls/control-matrix"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-muted/30 text-xs font-medium text-foreground/80 hover:bg-muted/50 transition-colors shrink-0"
          >
            <ExternalLink className="h-3 w-3" /> Open Control Matrix
          </Link>
        </div>
      )}

      {/* ── 9. Neutral Policy Preview ────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <button
          type="button"
          onClick={() => setNpjOpen(o => !o)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-foreground hover:bg-muted/30 transition-colors text-left"
        >
          <span className="flex items-center gap-2">
            <span className="text-muted-foreground/60 text-xs">{npjOpen ? '▼' : '▶'}</span>
            Neutral Policy
            {!isValidNpj(rawNpj) && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-md border border-amber-500/30 bg-amber-500/10 text-[10px] text-amber-400">Legacy fields only</span>
            )}
          </span>
          {isValidNpj(rawNpj) && (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); setNpjJsonOpen(s => !s) }}
              className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors shrink-0"
            >
              {npjJsonOpen ? 'Hide JSON' : 'View JSON'}
            </button>
          )}
        </button>
        {npjOpen && (
          <div className="border-t border-border">
            {!isValidNpj(rawNpj) ? (
              <div className="px-4 py-3 text-xs text-amber-400/80 space-y-1">
                <p className="font-medium">Legacy fields only — regenerate policies for full accuracy.</p>
                <p className="text-muted-foreground/60">Click &quot;Regenerate&quot; in the banner above to compile structured neutral policy data.</p>
              </div>
            ) : (
              <div className="divide-y divide-border/40">
                <NpjRow label="Intent">
                  <span className={cn('inline-flex items-center px-2 py-0.5 rounded-md border text-xs font-medium', INTENT_CHIP[npj!.intent ?? ''] ?? 'bg-muted/50 text-muted-foreground border-border')}>
                    {INTENT_LABELS[npj!.intent ?? ''] ?? npj!.intent}
                  </span>
                </NpjRow>
                <NpjRow label="Family"><span className="text-xs text-foreground/80">{npj!.policy_family ?? '—'}</span></NpjRow>
                {npj!.scope?.activities && (
                  <NpjRow label="Activities">
                    <div className="flex flex-wrap gap-1.5">
                      {npj!.scope.activities.map((a, i) => (
                        <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-md border border-blue-500/25 bg-blue-500/10 text-xs text-blue-400">{ACTIVITY_DISPLAY[a] ?? a}</span>
                      ))}
                    </div>
                  </NpjRow>
                )}
                {npj!.scope?.channels && (
                  <NpjRow label="Channels">
                    <div className="flex flex-wrap gap-1.5">
                      {npj!.scope.channels.map((c, i) => (
                        <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-md border border-border bg-muted/40 text-xs text-muted-foreground/70">{c}</span>
                      ))}
                    </div>
                  </NpjRow>
                )}
                {npj!.decision && (
                  <NpjRow label="Decision">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn('inline-flex items-center px-2 py-0.5 rounded-md border text-xs font-medium', ACTION_CHIP[npj!.decision.mode] ?? 'bg-muted/50 text-muted-foreground border-border')}>
                        {npj!.decision.mode}
                      </span>
                      <span className="text-xs text-muted-foreground/60">severity: <span className="text-foreground/70">{npj!.decision.severity}</span></span>
                      {npj!.decision.require_acknowledgement && <span className="inline-flex items-center px-1.5 py-0.5 rounded border border-orange-500/30 bg-orange-500/10 text-[10px] text-orange-400">ack</span>}
                      {npj!.decision.require_justification && <span className="inline-flex items-center px-1.5 py-0.5 rounded border border-amber-500/30 bg-amber-500/10 text-[10px] text-amber-400">justification</span>}
                    </div>
                  </NpjRow>
                )}
                <NpjRow label="Exceptions">
                  {npj!.exceptions && npj!.exceptions.length > 0 ? (
                    <div className="space-y-1">
                      {npj!.exceptions.map((ex, i) => (
                        <div key={i} className="text-xs text-foreground/75"><span className="text-muted-foreground/50">{ex.effect}:</span> {ex.reason}</div>
                      ))}
                    </div>
                  ) : <span className="text-xs text-muted-foreground/40 italic">—</span>}
                </NpjRow>
                <NpjRow label="Generated From">
                  <span className="text-xs text-muted-foreground/70">{npj!.provenance?.generated_from ?? '—'}</span>
                </NpjRow>
                {npj!.provenance?.warnings && npj!.provenance.warnings.length > 0 && (
                  <NpjRow label="Warnings">
                    <div className="space-y-1">
                      {npj!.provenance.warnings.map((w, i) => <p key={i} className="text-xs text-amber-400/80">{w}</p>)}
                    </div>
                  </NpjRow>
                )}
              </div>
            )}
            {isValidNpj(rawNpj) && npjJsonOpen && (
              <div className="border-t border-border/40 px-4 py-3">
                <pre className="text-xs text-muted-foreground/70 bg-muted/30 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-words font-mono border border-border/40">
                  {JSON.stringify(rawNpj, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── 10. Lifecycle & Metadata ─────────────────────────────────────── */}
      <div className={!isRecommended ? 'grid grid-cols-1 lg:grid-cols-2 gap-5' : undefined}>

        {/* Policy Metadata (read-only) — hidden for recommended */}
        {!isRecommended && (
          <SectionCard title="Policy Metadata">
            <div>
              <NpjRow label="Policy Key">
                <span className="text-xs font-mono text-foreground/70">{policy.policy_key ?? '—'}</span>
              </NpjRow>
              <NpjRow label="Family">
                <span className="text-xs text-foreground/80">{policy.policy_family ?? '—'}</span>
              </NpjRow>
              <NpjRow label="Generated From">
                <span className="text-xs text-foreground/80">{policy.generated_from ?? '—'}</span>
              </NpjRow>
              {npj?.provenance?.generated_at && (
                <NpjRow label="Generated At">
                  <span className="text-xs text-muted-foreground/70">{new Date(npj.provenance.generated_at).toLocaleString()}</span>
                </NpjRow>
              )}
              {npj?.provenance?.compiler_version && (
                <NpjRow label="Compiler Version">
                  <span className="text-xs font-mono text-muted-foreground/70">{npj.provenance.compiler_version}</span>
                </NpjRow>
              )}
            </div>
          </SectionCard>
        )}

        {/* Translation Status (state machine) */}
        <SectionCard title="Translation Status">
          <div className="space-y-3 px-5 py-4">
            <div className="flex items-center gap-2">
              <StatusChip label={translationStatus} chipClass={TRANSLATION_CHIP[translationStatus] ?? 'bg-muted/60 text-muted-foreground/70 border-border/60'} />
              <span className="text-xs text-muted-foreground/50">
                {translations.length} vendor {translations.length === 1 ? 'translation' : 'translations'}
                {verifiedTranslations > 0 && ` · ${verifiedTranslations} verified`}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {(translationStatus === 'translated' || translationStatus === 'deferred') && (
                <button type="button" onClick={() => handleTranslationAction('verified')}
                  className="px-3 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-xs font-medium text-emerald-400 hover:bg-emerald-500/15 transition-colors">
                  Mark Verified
                </button>
              )}
              {(translationStatus === 'translated' || translationStatus === 'verified') && (
                <button type="button" onClick={() => handleTranslationAction('deferred')}
                  className="px-3 py-1.5 rounded-lg border border-border bg-muted/40 text-xs font-medium text-muted-foreground/70 hover:bg-muted/60 transition-colors">
                  Defer
                </button>
              )}
              {translationStatus !== 'not-applicable' && (
                <button type="button" onClick={() => handleTranslationAction('not-applicable')}
                  className="px-3 py-1.5 rounded-lg border border-border bg-muted/20 text-xs font-medium text-muted-foreground/60 hover:bg-muted/40 transition-colors">
                  Not Applicable
                </button>
              )}
              {translationStatus === 'not-applicable' && (
                <button type="button" onClick={() => handleTranslationAction('verified')}
                  className="px-3 py-1.5 rounded-lg border border-border bg-muted/20 text-xs font-medium text-muted-foreground/60 hover:bg-muted/40 transition-colors">
                  Mark Verified
                </button>
              )}
              {(translationStatus === 'pending' || translationStatus === 'translated') && (
                <Link
                  href={`/genai-controls/translation/${policy.id}`}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 text-xs font-medium text-blue-400 hover:bg-blue-500/15 transition-colors"
                >
                  <ExternalLink className="h-3 w-3" /> Review Translations
                </Link>
              )}
            </div>
            {translationStatus === 'pending' && (
              <p className="text-[10px] text-muted-foreground/50">Set by system after compile or policy edit.</p>
            )}
          </div>
        </SectionCard>
      </div>

      {/* Lifecycle (approval, test status) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SectionCard title="Lifecycle" readOnly={isRecommended}>
          <div className="space-y-4 px-5 py-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground/60 block mb-1.5">Approval Status</label>
              <select
                value={formApproval}
                onChange={e => setFormApproval(e.target.value as ApprovalStatus)}
                disabled={isRecommended}
                className="block w-full rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-border-strong disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {APPROVAL_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground/60 block mb-1.5">Test Status</label>
              <select
                value={formTestStatus}
                onChange={e => setFormTestStatus(e.target.value)}
                disabled={isRecommended}
                className="block w-full rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-border-strong disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {TEST_STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
        </SectionCard>

        {/* Related Policies */}
        <SectionCard title="Related Policies">
          <div className="space-y-2 px-5 py-4">
            <p className="text-[10px] text-muted-foreground/50">Recommended to enable together</p>
            <div className="flex flex-wrap gap-1.5">
              {formRelatedPolicies.map(id => {
                const pol = allPolicies.find(p => p.id === id)
                if (!pol) return null
                return (
                  <button key={id} type="button" onClick={() => toggleRelatedPolicy(id)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-border bg-muted/40 text-xs text-foreground/70 hover:bg-muted/60 transition-colors">
                    {pol.name} <span className="text-muted-foreground/50">×</span>
                  </button>
                )
              })}
              {formRelatedPolicies.length === 0 && <span className="text-xs text-muted-foreground/40 italic">None</span>}
            </div>
            <details className="mt-1">
              <summary className="text-xs text-muted-foreground/60 cursor-pointer hover:text-muted-foreground/80 transition-colors select-none">+ Add related policy</summary>
              <div className="mt-2 max-h-32 overflow-y-auto border border-border rounded-lg p-2 space-y-1">
                {allPolicies.filter(p => p.id !== policy.id).map(p => (
                  <label key={p.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted/30 cursor-pointer text-xs text-foreground/80 transition-colors">
                    <input type="checkbox" checked={formRelatedPolicies.includes(p.id)} onChange={() => toggleRelatedPolicy(p.id)} className="accent-blue-500 w-3 h-3" />
                    {p.name}
                  </label>
                ))}
              </div>
            </details>
          </div>
        </SectionCard>
      </div>

      {/* Basic Details — hidden for recommended (name/active shown in header; fields all read-only) */}
      {!isRecommended && <SectionCard title="Basic Details" readOnly={isRecommended}>
        <div className="space-y-3 px-5 py-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground/60 block mb-1.5">Policy Name</label>
              <input
                type="text"
                value={formName}
                onChange={e => setFormName(e.target.value)}
                disabled={isRecommended}
                className="block w-full rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-border-strong disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground/60 block mb-1.5">Active</label>
              <label className={cn('flex items-center gap-2', isRecommended ? 'cursor-default' : 'cursor-pointer')}>
                <input type="checkbox" checked={formActive} onChange={e => setFormActive(e.target.checked)} disabled={isRecommended} className="accent-blue-500 w-4 h-4 disabled:opacity-50" />
                <span className="text-xs text-foreground/80">{formActive ? 'Enabled' : 'Disabled'}</span>
              </label>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground/60 block mb-1.5">Description</label>
            <textarea
              value={formDesc}
              onChange={e => setFormDesc(e.target.value)}
              rows={2}
              disabled={isRecommended}
              className="block w-full rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-border-strong resize-none disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>
        </div>
      </SectionCard>}

      {/* ── Save Section — hidden for recommended ────────────────────────── */}
      {!isRecommended && (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card px-4 py-3">
          <div>
            <p className="text-xs font-medium text-foreground">Save Changes</p>
            <p className="text-[10px] text-muted-foreground/50 mt-0.5">Saves name, description, active toggle, approval status, test status, coaching template, scope apps, and related policies.</p>
          </div>
          <div className="flex items-center gap-2">
            {saveError && <p className="text-xs text-red-400">{saveError}</p>}
            {saveSuccess && (
              <span className="flex items-center gap-1 text-xs text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" /> Saved
              </span>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-foreground text-background text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
              Save
            </button>
          </div>
        </div>
      )}

      {/* ── 11. Advanced JSON — hidden for recommended ───────────────────── */}
      {!isRecommended && <div className="rounded-xl border border-border bg-card overflow-hidden">
        <button
          type="button"
          onClick={() => setAdvancedOpen(o => !o)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-foreground hover:bg-muted/30 transition-colors text-left"
        >
          <span className="flex items-center gap-2">
            <span className="text-muted-foreground/60 text-xs">{advancedOpen ? '▼' : '▶'}</span>
            Advanced
          </span>
        </button>
        {advancedOpen && (
          <div className="border-t border-border px-4 py-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-muted-foreground/50">Read-only — managed by the Effata compiler. Regenerate policies to update.</p>
              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(JSON.stringify(rawNpj, null, 2))
                  setJsonCopied(true)
                  setTimeout(() => setJsonCopied(false), 2000)
                }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-md border border-border bg-muted/30 text-xs text-muted-foreground/70 hover:text-foreground/80 transition-colors"
              >
                {jsonCopied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                {jsonCopied ? 'Copied' : 'Copy JSON'}
              </button>
            </div>
            <pre className="text-xs text-muted-foreground/60 bg-muted/20 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-words font-mono border border-border/40 max-h-96">
              {JSON.stringify(rawNpj, null, 2)}
            </pre>
          </div>
        )}
      </div>}

    </div>
  )
}
