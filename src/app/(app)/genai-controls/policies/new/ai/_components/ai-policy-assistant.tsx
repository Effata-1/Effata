'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  VALID_INTENTS, INTENT_LABELS, INTENT_CHIP, ACTIVITY_LABELS,
  GENAI_ACTIVITIES, APP_ACCESS_ACTIVITIES,
  validateNeutralPolicy,
  type NpjIntent, type NpjActivity,
} from '@/lib/genai/npj-schema'
import { upsertPolicy, checkPolicyCoverage } from '../../../actions'
import type { CoverageResult } from '../../../actions'
import { PolicyCoverageWarning } from '../../../_components/policy-coverage-warning'
import type { RuleItem, AppRow, CategoryRow } from '../../_components/blank-policy-wizard'
import type { ActionCode, PolicyType } from '@/lib/genai/types'
import {
  AlertTriangle, CheckCircle2, Loader2, Pencil, RefreshCw, Sparkles, X,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface NpjCondition {
  type:         string
  sensitivity?: string
  name?:        string
  confidence?:  string
  label_name?:  string
  pattern?:     string
}

interface NpjDecision {
  mode:                    string
  severity:                string
  require_acknowledgement: boolean
  require_justification:   boolean
  preserve_evidence:       boolean
  create_incident:         boolean
}

interface NeutralPolicyJson {
  schema_version?: string
  intent?:         string
  policy_family?:  string
  scope?: {
    activities?:     string[]
    channels?:       string[]
    app_categories?: Array<{ id: string; system_tag: string | null; name: string }>
  }
  content?: {
    operator?:   string
    conditions?: NpjCondition[]
  }
  decision?:   NpjDecision
  exceptions?: Array<{ effect: string; reason: string }>
  provenance?: {
    generated_from?:   string
    source_model?:     string
    generated_at?:     string
    compiler_version?: string
    warnings?:         string[]
  }
}

interface SourceImpactItem {
  source_layer:    string
  impact:          string
  action_required: boolean
}

interface TranslationImpactItem {
  vendor_id?:           string
  impact:               string
  requires_translation: boolean
}

interface PolicyProposal {
  name:              string
  description:       string
  npj:               NeutralPolicyJson
  sourceImpact:      SourceImpactItem[]
  translationImpact: TranslationImpactItem[]
}

interface PolicyCreationContext {
  intents:    string[]
  categories: { id: string; name: string; system_tag: string | null; access_posture?: string }[]
  dataTypes:  { key: string; name: string; sensitivity: string }[]
  actions:    string[]
  activities: string[]
  vendors:    string[]
}

interface Props {
  apps:       AppRow[]
  categories: CategoryRow[]
  ruleItems:  RuleItem[]
  vendors?:   string[]
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ACTION_CHIP: Record<string, string> = {
  allow:   'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  monitor: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  alert:   'bg-amber-500/10 text-amber-400 border-amber-500/20',
  coach:   'bg-orange-500/10 text-orange-400 border-orange-500/20',
  block:   'bg-red-500/10 text-red-400 border-red-500/20',
}

const EXAMPLE_PROMPTS = [
  'Block upload of credit card data to ChatGPT and other unapproved AI tools',
  'Coach users when they post confidential documents to any GenAI app',
  'Monitor all downloads from AI tools for security review',
  'Block access to prohibited AI tools for all users',
  'Allow enterprise Copilot for all users with evidence logging',
  'Alert security team when secrets or API keys are uploaded to any AI',
]

const DECISION_MODES   = ['allow', 'monitor', 'alert', 'coach', 'block'] as const
const DECISION_SEVERITIES = ['low', 'medium', 'high', 'critical'] as const
type BoolDecisionKey   = 'preserve_evidence' | 'create_incident' | 'require_acknowledgement' | 'require_justification'
const DECISION_FLAGS: Array<[BoolDecisionKey, string]> = [
  ['preserve_evidence',      'Preserve Evidence'],
  ['create_incident',        'Create Incident'],
  ['require_acknowledgement','Require Ack.'],
  ['require_justification',  'Require Justification'],
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseProposalError(text: string): string[] | null {
  const m = text.match(/<policyProposalError>\s*([\s\S]*?)\s*<\/policyProposalError>/)
  if (!m) return null
  try { return (JSON.parse(m[1]) as { errors: string[] }).errors } catch { return null }
}

function parsePolicyProposal(text: string): PolicyProposal | null {
  const repairMatch = text.match(/<policyProposalRepair>\s*([\s\S]*?)\s*<\/policyProposalRepair>/)
  if (repairMatch) { try { return normalizeProposal(JSON.parse(repairMatch[1]) as PolicyProposal) } catch {} }
  const match = text.match(/<policyProposal>\s*([\s\S]*?)\s*<\/policyProposal>/)
  if (!match) return null
  try { return normalizeProposal(JSON.parse(match[1]) as PolicyProposal) } catch { return null }
}

function normalizeProposal(p: PolicyProposal): PolicyProposal {
  if (p.npj?.intent !== 'govern_app_access') return p
  return {
    ...p,
    npj: {
      ...p.npj,
      scope:   { ...p.npj.scope,   activities: ['browse', 'login'] },
      content: { operator: p.npj.content?.operator ?? 'any', conditions: [] },
    },
  }
}

function displayText(text: string): string {
  return text
    .replace(/<policyProposal>[\s\S]*?<\/policyProposal>/g, '')
    .replace(/<policyProposalRepair>[\s\S]*?<\/policyProposalRepair>/g, '')
    .replace(/<policyProposalError>[\s\S]*?<\/policyProposalError>/g, '')
    .trim()
}

function npjDecisionToPrimaryAction(
  d?: { mode?: string; require_acknowledgement?: boolean; require_justification?: boolean },
): string | null {
  if (!d?.mode) return null
  if (d.mode === 'coach' && d.require_justification)   return 'coach-just'
  if (d.mode === 'coach' && d.require_acknowledgement) return 'coach-ack'
  return d.mode
}

function npjIntentToPolicyType(intent?: string): string {
  switch (intent) {
    case 'prevent_exfiltration':
    case 'detect_only':
    case 'coach_user':
    case 'label_or_classify':
    case 'govern_data_at_rest': return 'data-handling'
    case 'allow_approved_use':  return 'approved-use'
    case 'govern_app_access':   return 'usage'
    default:                    return 'usage'
  }
}

// ── NpjRow ────────────────────────────────────────────────────────────────────

function NpjRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-0 px-5 py-3 border-b border-border/40 last:border-0">
      <span className="w-44 shrink-0 text-[11px] font-bold uppercase tracking-widest text-muted-foreground/40 pt-0.5">{label}</span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )
}

// ── PolicyProposalCard ────────────────────────────────────────────────────────

function PolicyProposalCard({
  proposal,
  categories,
  onProposalChange,
  onReset,
  onApprove,
  creating,
  createError,
  coverage,
  coverageLoading,
  onDiscard,
}: {
  proposal:         PolicyProposal
  categories:       CategoryRow[]
  onProposalChange: (p: PolicyProposal) => void
  onReset:          () => void
  onApprove:        () => void
  creating:         boolean
  createError:      string
  coverage:         CoverageResult | null
  coverageLoading:  boolean
  onDiscard:        () => void
}) {
  const [editing,     setEditing]    = useState(false)
  const [draft,       setDraft]      = useState<PolicyProposal>(proposal)
  const [editErrors,  setEditErrors] = useState<string[]>([])
  const [jsonOpen,    setJsonOpen]   = useState(false)
  const [forceCreate, setForceCreate] = useState(false)

  // When a new proposal arrives (re-generate), reset edit state and coverage override
  useEffect(() => {
    setDraft(proposal)
    setEditing(false)
    setEditErrors([])
    setForceCreate(false)
  }, [proposal])

  function handleSave() {
    if (!draft.name.trim()) { setEditErrors(['Policy name is required']); return }
    const v = validateNeutralPolicy(draft.npj)
    if (!v.valid) { setEditErrors(v.errors); return }
    setEditErrors([])
    setEditing(false)
    onProposalChange(draft)
  }

  function handleEditCancel() {
    setDraft(proposal)
    setEditErrors([])
    setEditing(false)
  }

  function toggleActivity(a: string) {
    setDraft(p => {
      const cur  = p.npj.scope?.activities ?? []
      const next = cur.includes(a) ? cur.filter(x => x !== a) : [...cur, a]
      return { ...p, npj: { ...p.npj, scope: { ...p.npj.scope, activities: next } } }
    })
  }

  function toggleCategory(cat: CategoryRow) {
    setDraft(p => {
      const cur    = p.npj.scope?.app_categories ?? []
      const exists = cur.some(c => c.id === cat.id)
      const next   = exists
        ? cur.filter(c => c.id !== cat.id)
        : [...cur, { id: cat.id, system_tag: cat.system_tag ?? null, name: cat.name }]
      return { ...p, npj: { ...p.npj, scope: { ...p.npj.scope, app_categories: next } } }
    })
  }

  function setDecisionValue(key: string, value: unknown) {
    setDraft(p => ({
      ...p,
      npj: { ...p.npj, decision: { ...(p.npj.decision ?? {} as NpjDecision), [key]: value } },
    }))
  }

  // ── Edit form ───────────────────────────────────────────────────────────────

  if (editing) {
    const dn = draft.npj
    return (
      <>
        <div className="px-5 py-3.5 border-b border-amber-500/20 bg-amber-500/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Pencil className="h-4 w-4 text-amber-400" />
            <span className="text-sm font-bold text-foreground">Edit Policy Proposal</span>
            <span className="text-[10px] px-2 py-0.5 rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-400">Editing</span>
          </div>
        </div>

        <div className="px-5 py-5 space-y-5 overflow-y-auto max-h-[60vh]">

          {/* Name + Description */}
          <div className="space-y-2">
            <input
              value={draft.name}
              onChange={e => setDraft(p => ({ ...p, name: e.target.value }))}
              className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500/50"
              placeholder="Policy name"
            />
            <textarea
              value={draft.description}
              onChange={e => setDraft(p => ({ ...p, description: e.target.value }))}
              rows={2}
              className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground/80 focus:outline-none focus:ring-1 focus:ring-blue-500/50 resize-none"
              placeholder="Description (optional)"
            />
          </div>

          {/* Intent */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/40 mb-2">Intent</p>
            <div className="flex flex-wrap gap-1.5">
              {VALID_INTENTS.map(intent => (
                <button
                  key={intent}
                  type="button"
                  onClick={() => setDraft(p => {
                    const newNpj: NeutralPolicyJson = { ...p.npj, intent }
                    if (intent === 'govern_app_access') {
                      // Lock activities to browse+login and clear content conditions — app access only
                      newNpj.content = { operator: newNpj.content?.operator ?? 'any', conditions: [] }
                      newNpj.scope   = { ...newNpj.scope, activities: [...APP_ACCESS_ACTIVITIES] }
                    } else if (p.npj.intent === 'govern_app_access') {
                      // Leaving govern_app_access: reset activities, strip prohibited categories
                      // (data policies don't apply to prohibited apps — blocked at access level)
                      newNpj.scope = {
                        ...newNpj.scope,
                        activities:     ['post', 'prompt_submit', 'upload'],
                        app_categories: (newNpj.scope?.app_categories ?? []).filter(c =>
                          c.system_tag !== 'prohibited' && c.name.toLowerCase() !== 'prohibited',
                        ),
                      }
                    }
                    return { ...p, npj: newNpj }
                  })}
                  className={cn(
                    'inline-flex items-center px-2.5 py-1 rounded-lg border text-xs font-semibold transition-colors',
                    dn.intent === intent
                      ? INTENT_CHIP[intent as NpjIntent]
                      : 'border-border/50 bg-muted/20 text-muted-foreground/50 hover:bg-muted/40 hover:text-foreground/70',
                  )}
                >
                  {INTENT_LABELS[intent as NpjIntent]}
                </button>
              ))}
            </div>
          </div>

          {/* Activities */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/40 mb-2">Activities</p>
            {dn.intent === 'govern_app_access' ? (
              <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 px-4 py-3 space-y-2">
                <p className="text-xs font-semibold text-purple-400">Fixed for app access control</p>
                <p className="text-xs text-muted-foreground/60">App access decisions happen at Browse and Login — no data-level activities apply.</p>
                <div className="flex gap-1.5">
                  {APP_ACCESS_ACTIVITIES.map(a => (
                    <span key={a} className="inline-flex items-center px-2 py-0.5 rounded-md border border-purple-500/25 bg-purple-500/10 text-xs text-purple-400">{ACTIVITY_LABELS[a]}</span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {GENAI_ACTIVITIES.map(a => {
                  const active = (dn.scope?.activities ?? []).includes(a)
                  return (
                    <button
                      key={a}
                      type="button"
                      onClick={() => toggleActivity(a)}
                      className={cn(
                        'inline-flex items-center px-2 py-0.5 rounded-md border text-xs transition-colors',
                        active
                          ? 'border-blue-500/25 bg-blue-500/10 text-blue-400'
                          : 'border-border/40 bg-muted/10 text-muted-foreground/40 hover:bg-muted/30 hover:text-foreground/60',
                      )}
                    >
                      {ACTIVITY_LABELS[a]}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* App Categories */}
          {categories.length > 0 && (() => {
            const prohibitedCat  = categories.find(c => c.system_tag === 'prohibited' || c.name.toLowerCase() === 'prohibited')
            const isAppAccess    = dn.intent === 'govern_app_access'
            // govern_app_access: all categories (allow/block/restrict any)
            // data intents: no prohibited — blocked at access level, data policy never triggers
            const visibleCats = isAppAccess
              ? categories
              : categories.filter(c => c.system_tag !== 'prohibited' && c.name.toLowerCase() !== 'prohibited')

            return (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/40 mb-2">App Categories</p>
                <div className="flex flex-wrap gap-1.5">
                  {visibleCats.map(cat => {
                    const active = (dn.scope?.app_categories ?? []).some(c => c.id === cat.id)
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => toggleCategory(cat)}
                        className={cn(
                          'inline-flex items-center px-2 py-0.5 rounded-md border text-xs transition-colors',
                          active
                            ? 'border-border bg-muted/50 text-foreground/80'
                            : 'border-border/40 bg-muted/10 text-muted-foreground/40 hover:bg-muted/30 hover:text-foreground/60',
                        )}
                      >
                        {cat.name}
                      </button>
                    )
                  })}
                </div>
                {!isAppAccess && prohibitedCat && (
                  <p className="text-[10px] text-muted-foreground/40 mt-1.5">
                    Prohibited apps are blocked at access level — data policies don&apos;t apply to them. Use <span className="font-medium text-muted-foreground/60">Govern App Access</span> to control prohibited app access.
                  </p>
                )}
              </div>
            )
          })()}

          {/* Decision */}
          {dn.decision && (
            <div className="space-y-3 rounded-xl border border-border bg-muted/10 px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/40">Decision</p>

              <div>
                <p className="text-[10px] text-muted-foreground/50 mb-1.5">Action</p>
                <div className="flex flex-wrap gap-1.5">
                  {DECISION_MODES.map(mode => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setDecisionValue('mode', mode)}
                      className={cn(
                        'inline-flex items-center px-3 py-1 rounded-lg border text-xs font-bold transition-colors',
                        dn.decision?.mode === mode
                          ? ACTION_CHIP[mode]
                          : 'border-border/40 bg-muted/10 text-muted-foreground/40 hover:bg-muted/30',
                      )}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[10px] text-muted-foreground/50 mb-1.5">Severity</p>
                <div className="flex flex-wrap gap-1.5">
                  {DECISION_SEVERITIES.map(sev => (
                    <button
                      key={sev}
                      type="button"
                      onClick={() => setDecisionValue('severity', sev)}
                      className={cn(
                        'inline-flex items-center px-2.5 py-0.5 rounded-md border text-xs font-medium transition-colors',
                        dn.decision?.severity === sev
                          ? 'border-foreground/40 bg-foreground/10 text-foreground/80'
                          : 'border-border/40 bg-muted/10 text-muted-foreground/40 hover:bg-muted/30',
                      )}
                    >
                      {sev}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[10px] text-muted-foreground/50 mb-1.5">Options</p>
                <div className="flex flex-wrap gap-x-5 gap-y-2">
                  {DECISION_FLAGS.map(([key, label]) => (
                    <label key={key} className="flex items-center gap-1.5 cursor-pointer group select-none">
                      <input
                        type="checkbox"
                        checked={Boolean(dn.decision?.[key])}
                        onChange={e => setDecisionValue(key, e.target.checked)}
                        className="w-3.5 h-3.5 rounded accent-blue-500 cursor-pointer"
                      />
                      <span className="text-xs text-muted-foreground/60 group-hover:text-foreground/70 transition-colors">{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Edit errors */}
          {editErrors.length > 0 && (
            <div className="rounded-lg border border-red-500/25 bg-red-500/5 px-4 py-3 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-red-400">
                <AlertTriangle className="h-3 w-3" />
                Fix before saving
              </div>
              <ul className="space-y-0.5">
                {editErrors.map((e, i) => <li key={i} className="text-xs text-red-400/80">{e}</li>)}
              </ul>
            </div>
          )}
        </div>

        {/* Edit footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border/40 bg-muted/5">
          <button
            type="button"
            onClick={handleEditCancel}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors"
          >
            <CheckCircle2 className="h-3 w-3" />
            Save Changes
          </button>
        </div>
      </>
    )
  }

  // ── Read-only view ──────────────────────────────────────────────────────────

  const npj = proposal.npj

  return (
    <>
      {/* Card header */}
      <div className="px-5 py-3.5 border-b border-blue-500/15 bg-blue-500/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-blue-400" />
          <span className="text-sm font-bold text-foreground">Policy Proposal</span>
          <span className="text-[10px] px-2 py-0.5 rounded-md border border-blue-500/30 bg-blue-500/10 text-blue-400">Review before creating</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => { setDraft(proposal); setEditing(true) }}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border/60 bg-muted/20 hover:bg-muted/40 text-muted-foreground/60 hover:text-foreground/80 text-xs font-medium transition-colors"
          >
            <Pencil className="h-3 w-3" />
            Edit
          </button>
          <button type="button" onClick={onReset} className="text-muted-foreground/40 hover:text-foreground/70 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Card body */}
      <div className="px-5 py-5">
        <div className="space-y-4">
          {/* Header row */}
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-bold text-foreground">{proposal.name}</h3>
              {proposal.description && <p className="text-xs text-muted-foreground/70 mt-0.5">{proposal.description}</p>}
            </div>
            {npj.intent && VALID_INTENTS.includes(npj.intent as NpjIntent) && (
              <span className={cn('inline-flex items-center px-2.5 py-1 rounded-lg border text-xs font-semibold shrink-0', INTENT_CHIP[npj.intent as NpjIntent])}>
                {INTENT_LABELS[npj.intent as NpjIntent]}
              </span>
            )}
          </div>

          {/* NPJ summary */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <NpjRow label="Policy Family">
              <span className="text-sm text-foreground/80">{npj.policy_family ?? '—'}</span>
            </NpjRow>
            <NpjRow label="Activities">
              <div className="flex flex-wrap gap-1.5">
                {(npj.scope?.activities ?? []).map((a, i) => (
                  <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-md border border-blue-500/25 bg-blue-500/10 text-xs text-blue-400">
                    {ACTIVITY_LABELS[a as NpjActivity] ?? a}
                  </span>
                ))}
                {!npj.scope?.activities?.length && <span className="text-xs text-muted-foreground/40 italic">—</span>}
              </div>
            </NpjRow>
            <NpjRow label="App Categories">
              <div className="flex flex-wrap gap-1.5">
                {(npj.scope?.app_categories ?? []).map((cat, i) => (
                  <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-md border border-border bg-muted/40 text-xs text-muted-foreground/70">
                    {cat.name}
                  </span>
                ))}
                {!npj.scope?.app_categories?.length && <span className="text-xs text-muted-foreground/40 italic">All categories</span>}
              </div>
            </NpjRow>
            <NpjRow label="Detection">
              <div className="flex flex-wrap gap-1.5">
                {(npj.content?.conditions ?? []).map((c, i) => (
                  <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-md border border-border bg-muted/40 text-xs text-muted-foreground/70">
                    {c.name ?? c.type}
                    {c.sensitivity && <span className="ml-1 text-[10px] text-muted-foreground/50">({c.sensitivity})</span>}
                  </span>
                ))}
                {npj.intent === 'govern_app_access' && (
                  <span className="text-xs text-muted-foreground/50 italic">No content detection — app-level access control</span>
                )}
                {!npj.content?.conditions?.length && npj.intent !== 'govern_app_access' && (
                  <span className="text-xs text-muted-foreground/40 italic">—</span>
                )}
              </div>
            </NpjRow>
            {npj.decision && (
              <NpjRow label="Decision">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn('inline-flex items-center px-3 py-1 rounded-lg border text-sm font-bold', ACTION_CHIP[npj.decision.mode] ?? 'bg-muted/50 text-muted-foreground border-border')}>
                    {npj.decision.mode}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted/40 border border-border/50 text-muted-foreground/70 font-mono">
                    severity: <span className="text-foreground/80">{npj.decision.severity}</span>
                  </span>
                  {npj.decision.preserve_evidence && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded border bg-emerald-500/10 border-emerald-500/20 text-emerald-400/90 font-mono">evidence: yes</span>
                  )}
                  {npj.decision.create_incident && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded border bg-blue-500/10 border-blue-500/20 text-blue-400/90 font-mono">incident: yes</span>
                  )}
                  {npj.decision.require_acknowledgement && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded border border-orange-500/30 bg-orange-500/10 text-[10px] text-orange-400 font-medium">ack required</span>
                  )}
                </div>
              </NpjRow>
            )}
            {npj.exceptions && npj.exceptions.length > 0 && (
              <NpjRow label="Exceptions">
                <div className="space-y-1">
                  {npj.exceptions.map((ex, i) => (
                    <div key={i} className="text-xs text-foreground/70">
                      <span className="text-muted-foreground/50">{ex.effect}:</span> {ex.reason}
                    </div>
                  ))}
                </div>
              </NpjRow>
            )}
          </div>

          {/* Source & Translation impact */}
          {(proposal.sourceImpact?.length > 0 || proposal.translationImpact?.length > 0) && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-5 py-4 space-y-3">
              {proposal.sourceImpact?.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400/60 mb-1.5">Source Impact</p>
                  <div className="space-y-1">
                    {proposal.sourceImpact.map((item, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs">
                        <span className="text-[10px] px-1.5 py-0.5 rounded border border-amber-500/30 bg-amber-500/10 text-amber-400 font-mono shrink-0">
                          {item.source_layer}
                        </span>
                        <span className="text-muted-foreground/70">{item.impact}</span>
                        {item.action_required && <span className="text-amber-400/70 shrink-0">⚠ action required</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {proposal.translationImpact?.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400/60 mb-1.5">Translation Impact</p>
                  <div className="space-y-1">
                    {proposal.translationImpact.map((item, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs">
                        <span className="text-muted-foreground/70">{item.impact}</span>
                        {item.requires_translation && <span className="text-blue-400/70 shrink-0">→ translation needed</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* JSON collapsible */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <button
              type="button"
              onClick={() => setJsonOpen(o => !o)}
              className="w-full flex items-center justify-between px-4 py-3 text-xs font-medium text-foreground hover:bg-muted/30 transition-colors text-left"
            >
              <span>{jsonOpen ? '▼' : '▶'} Neutral Policy JSON</span>
              <span className="text-[10px] text-muted-foreground/50">schema_version 1.0</span>
            </button>
            {jsonOpen && (
              <div className="border-t border-border px-4 py-3">
                <pre className="text-xs text-muted-foreground/60 bg-muted/20 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-words font-mono border border-border/40 max-h-64">
                  {JSON.stringify(npj, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Card footer */}
      <div className="px-5 py-4 border-t border-border/40 bg-muted/5 space-y-3">
        {/* Coverage warning — shown while loading or when coverage/conflict found and not overridden */}
        {(coverageLoading || ((coverage?.hasCoverage || coverage?.hasConflict) && !forceCreate)) && (
          <PolicyCoverageWarning
            result={coverage ?? { hasCoverage: false, hasConflict: false, matches: [] }}
            loading={coverageLoading}
            creating={creating}
            onCreateAnyway={() => setForceCreate(true)}
            onDiscard={onDiscard}
          />
        )}

        {/* Normal footer row — hidden when coverage warning is blocking */}
        {(!coverage || forceCreate || (!coverage.hasCoverage && !coverage.hasConflict)) && (
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-muted-foreground/50">
              Policy will be created as <span className="font-mono">draft · inactive</span> — requires review before enabling.
            </p>
            <div className="flex items-center gap-2">
              {createError && <p className="text-xs text-red-400">{createError}</p>}
              <button
                type="button"
                onClick={onApprove}
                disabled={creating}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-foreground text-background text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
              >
                {creating ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                Approve & Create
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export function AiPolicyAssistant({ apps: _apps, categories, ruleItems, vendors = [] }: Props) {
  const router = useRouter()
  const [input, setInput]                   = useState('')
  const [streaming, setStreaming]           = useState(false)
  const [streamText, setStreamText]         = useState('')
  const [proposal, setProposal]             = useState<PolicyProposal | null>(null)
  const [parseError, setParseError]         = useState('')
  const [validErrors, setValidErrors]       = useState<string[]>([])
  const [creating, setCreating]             = useState(false)
  const [createError, setCreateError]       = useState('')
  const [coverage, setCoverage]             = useState<CoverageResult | null>(null)
  const [coverageLoading, setCoverageLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => () => { abortRef.current?.abort() }, [])

  function buildContext(): PolicyCreationContext {
    return {
      intents:    [...VALID_INTENTS],
      categories: categories.map(c => ({ id: c.id, name: c.name, system_tag: c.system_tag, access_posture: c.access_posture })),
      dataTypes:  ruleItems.slice(0, 50).map(r => ({
        key:         r.key,
        name:        r.name,
        sensitivity: r.layerLabel ?? r.name,
      })),
      actions:    ['allow', 'monitor', 'alert', 'coach', 'block'],
      activities: ['browse', 'post', 'prompt_submit', 'upload', 'download', 'response'],
      vendors,
    }
  }

  async function handleGenerate() {
    if (!input.trim()) return
    setStreaming(true)
    setStreamText('')
    setProposal(null)
    setParseError('')
    setValidErrors([])

    abortRef.current?.abort()
    abortRef.current = new AbortController()

    try {
      const res = await fetch('/api/policy-new-ai', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ message: input, context: buildContext() }),
        signal:  abortRef.current.signal,
      })

      if (!res.ok) {
        const errText = await res.text()
        setParseError(errText || `Request failed (${res.status})`)
        setStreaming(false)
        return
      }

      const reader  = res.body!.getReader()
      const decoder = new TextDecoder()
      let full = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        full += decoder.decode(value, { stream: true })
        setStreamText(full)
      }
      full += decoder.decode()

      setStreaming(false)

      const backendErrors = parseProposalError(full)
      if (backendErrors) {
        setValidErrors(backendErrors)
        return
      }

      const parsed = parsePolicyProposal(full)
      if (!parsed) {
        setParseError('AI did not return a structured proposal. Please try rephrasing your request.')
        return
      }

      const validation = validateNeutralPolicy(parsed.npj)
      if (!validation.valid) {
        setValidErrors(validation.errors)
        return
      }

      setProposal(parsed)
      // Run coverage check asynchronously — don't block rendering
      setCoverageLoading(true)
      checkPolicyCoverage(parsed.npj as Record<string, unknown>)
        .then(result => setCoverage(result))
        .catch(() => setCoverage(null))
        .finally(() => setCoverageLoading(false))
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setParseError((err as Error).message || 'Network error')
      }
      setStreaming(false)
    }
  }

  async function handleCreate() {
    if (!proposal) return
    setCreating(true)
    setCreateError('')

    const res = await upsertPolicy(null, {
      name:                      proposal.name,
      description:               proposal.description || undefined,
      is_active:                 false,
      approval_status:           'draft',
      vendor_translation_status: 'pending',
      generated_from:            'ai-assisted',
      policy_family:             proposal.npj.policy_family ?? null,
      neutral_policy_json:       proposal.npj as Record<string, unknown>,
      scope_app_ids:             [],
      primary_action:            npjDecisionToPrimaryAction(proposal.npj.decision) as ActionCode | null,
      policy_type:               npjIntentToPolicyType(proposal.npj.intent) as PolicyType,
      scope_all_apps:            !proposal.npj.scope?.app_categories?.length,
    })

    setCreating(false)
    if (res.error) { setCreateError(res.error); return }
    router.push('/genai-controls/policies')
  }

  function handleReset() {
    abortRef.current?.abort()
    setStreaming(false)
    setStreamText('')
    setProposal(null)
    setParseError('')
    setValidErrors([])
    setCreateError('')
    setCoverage(null)
    setCoverageLoading(false)
  }

  const hasResult = Boolean(proposal || parseError || validErrors.length > 0)

  return (
    <div className="space-y-5">

      {/* Input card */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="px-5 py-3.5 border-b border-border/50 bg-muted/5">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-blue-400" />
            <span className="text-sm font-bold text-foreground">Describe your policy</span>
          </div>
          <p className="text-xs text-muted-foreground/60 mt-0.5">
            Explain what you want to enforce. The AI will draft a structured neutral policy proposal.
          </p>
        </div>
        <div className="px-5 py-4 space-y-3">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            rows={4}
            placeholder="e.g. Block upload of credit card data to ChatGPT and other unapproved AI tools. Show a coaching message to users explaining the policy."
            disabled={streaming}
            className="block w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground focus:outline-none focus:border-border-strong resize-none disabled:opacity-50"
          />

          <div className="flex flex-wrap gap-1.5">
            {EXAMPLE_PROMPTS.map(p => (
              <button
                key={p}
                type="button"
                disabled={streaming}
                onClick={() => setInput(p)}
                className="text-[10px] px-2 py-1 rounded-lg border border-border/60 bg-muted/20 text-muted-foreground/60 hover:bg-muted/40 hover:text-foreground/80 transition-colors disabled:opacity-40 text-left"
              >
                {p.length > 55 ? p.slice(0, 55) + '…' : p}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={hasResult ? handleReset : handleGenerate}
              disabled={streaming || (!input.trim() && !hasResult)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-foreground text-background text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              {streaming
                ? <><Loader2 className="h-3 w-3 animate-spin" /> Generating…</>
                : hasResult
                  ? <><RefreshCw className="h-3 w-3" /> Regenerate</>
                  : <><Sparkles className="h-3 w-3" /> Generate Policy</>}
            </button>
            {streaming && (
              <button
                type="button"
                onClick={handleReset}
                className="text-xs text-muted-foreground/60 hover:text-foreground/70 transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Streaming text */}
      {streaming && streamText && (
        <div className="rounded-xl border border-border bg-card px-5 py-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40 mb-2">Generating…</p>
          <pre className="text-xs text-muted-foreground/60 whitespace-pre-wrap break-words font-mono max-h-32 overflow-y-auto">
            {displayText(streamText) || '…'}
          </pre>
        </div>
      )}

      {/* Parse error */}
      {parseError && (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 px-5 py-4 space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            AI did not return a valid proposal
          </div>
          <p className="text-xs text-muted-foreground/70">{parseError}</p>
          <p className="text-xs text-muted-foreground/50">Try rephrasing your request or adding more detail.</p>
        </div>
      )}

      {/* Validation errors */}
      {validErrors.length > 0 && (
        <div className="rounded-xl border border-red-500/25 bg-red-500/5 px-5 py-4 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-red-400">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            AI proposal could not be validated — please regenerate
          </div>
          <ul className="list-disc list-inside space-y-0.5">
            {validErrors.map((e, i) => <li key={i} className="text-xs text-red-400/80">{e}</li>)}
          </ul>
        </div>
      )}

      {/* Proposal card */}
      {proposal && (
        <div className="rounded-xl border border-blue-500/20 bg-card overflow-hidden shadow-sm">
          <PolicyProposalCard
            proposal={proposal}
            categories={categories}
            onProposalChange={p => { setProposal(p); setCoverage(null) }}
            onReset={handleReset}
            onApprove={handleCreate}
            creating={creating}
            createError={createError}
            coverage={coverage}
            coverageLoading={coverageLoading}
            onDiscard={handleReset}
          />
        </div>
      )}

    </div>
  )
}
