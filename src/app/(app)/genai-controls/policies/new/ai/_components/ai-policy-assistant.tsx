'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { colorClasses } from '@/lib/data-catalog/types'
import {
  VALID_INTENTS, INTENT_LABELS, INTENT_CHIP, ACTIVITY_LABELS,
  validateNeutralPolicy,
  type NpjIntent, type NpjActivity,
} from '@/lib/genai/npj-schema'
import { upsertPolicy } from '../../../actions'
import type { RuleItem, AppRow, CategoryRow } from '../../_components/blank-policy-wizard'
import {
  AlertTriangle, CheckCircle2, Loader2, RefreshCw, Sparkles, X,
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
  name:             string
  description:      string
  npj:              NeutralPolicyJson
  sourceImpact:     SourceImpactItem[]
  translationImpact: TranslationImpactItem[]
}

interface PolicyCreationContext {
  intents:    string[]
  categories: { id: string; name: string; system_tag: string | null }[]
  dataTypes:  { key: string; name: string; sensitivity: string }[]
  actions:    string[]
  activities: string[]
}

interface Props {
  apps:       AppRow[]
  categories: CategoryRow[]
  ruleItems:  RuleItem[]
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ACTION_CHIP: Record<string, string> = {
  allow:        'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  monitor:      'bg-blue-500/10 text-blue-400 border-blue-500/20',
  alert:        'bg-amber-500/10 text-amber-400 border-amber-500/20',
  coach:        'bg-orange-500/10 text-orange-400 border-orange-500/20',
  block:        'bg-red-500/10 text-red-400 border-red-500/20',
}

const EXAMPLE_PROMPTS = [
  'Block upload of credit card data to ChatGPT and other unapproved AI tools',
  'Coach users when they post confidential documents to any GenAI app',
  'Monitor all downloads from AI tools for security review',
  'Block access to prohibited AI tools for all users',
  'Allow enterprise Copilot for all users with evidence logging',
  'Alert security team when secrets or API keys are uploaded to any AI',
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function parsePolicyProposal(text: string): PolicyProposal | null {
  const match = text.match(/<policyProposal>\s*([\s\S]*?)\s*<\/policyProposal>/)
  if (!match) return null
  try { return JSON.parse(match[1]) as PolicyProposal } catch { return null }
}

function displayText(text: string): string {
  return text.replace(/<policyProposal>[\s\S]*?<\/policyProposal>/g, '').trim()
}

// ── NpjRow (same visual pattern as policy-intent-editor) ──────────────────────

function NpjRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-0 px-5 py-3 border-b border-border/40 last:border-0">
      <span className="w-44 shrink-0 text-[11px] font-bold uppercase tracking-widest text-muted-foreground/40 pt-0.5">{label}</span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )
}

// ── PolicyProposalCard ────────────────────────────────────────────────────────

function PolicyProposalCard({ proposal }: { proposal: PolicyProposal }) {
  const npj = proposal.npj
  const [jsonOpen, setJsonOpen] = useState(false)

  return (
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
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export function AiPolicyAssistant({ apps: _apps, categories, ruleItems }: Props) {
  const router = useRouter()
  const [input, setInput]             = useState('')
  const [streaming, setStreaming]     = useState(false)
  const [streamText, setStreamText]   = useState('')
  const [proposal, setProposal]       = useState<PolicyProposal | null>(null)
  const [parseError, setParseError]   = useState('')
  const [validErrors, setValidErrors] = useState<string[]>([])
  const [creating, setCreating]       = useState(false)
  const [createError, setCreateError] = useState('')
  const abortRef = useRef<AbortController | null>(null)

  function buildContext(): PolicyCreationContext {
    return {
      intents:    [...VALID_INTENTS],
      categories: categories.map(c => ({ id: c.id, name: c.name, system_tag: c.system_tag })),
      dataTypes:  ruleItems.map(r => ({
        key:         r.key,
        name:        r.name,
        sensitivity: r.layerLabel ?? r.name,
      })),
      actions:    ['allow', 'monitor', 'alert', 'coach', 'block'],
      activities: ['browse', 'post', 'prompt_submit', 'upload', 'download', 'response'],
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
        full += decoder.decode(value)
        setStreamText(full)
      }

      setStreaming(false)

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
  }

  // ── Input phase ─────────────────────────────────────────────────────────────

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

          {/* Example chips */}
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
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/8 px-5 py-4 space-y-1.5">
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
        <div className="rounded-xl border border-red-500/25 bg-red-500/8 px-5 py-4 space-y-2">
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
          <div className="px-5 py-3.5 border-b border-blue-500/15 bg-blue-500/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-blue-400" />
              <span className="text-sm font-bold text-foreground">Policy Proposal</span>
              <span className="text-[10px] px-2 py-0.5 rounded-md border border-blue-500/30 bg-blue-500/10 text-blue-400">Review before creating</span>
            </div>
            <button type="button" onClick={handleReset} className="text-muted-foreground/40 hover:text-foreground/70 transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="px-5 py-5">
            <PolicyProposalCard proposal={proposal} />
          </div>
          <div className="flex items-center justify-between px-5 py-4 border-t border-border/40 bg-muted/5">
            <div>
              <p className="text-[10px] text-muted-foreground/50">Policy will be created as <span className="font-mono">draft · inactive</span> — requires review before enabling.</p>
            </div>
            <div className="flex items-center gap-2">
              {createError && (
                <p className="text-xs text-red-400">{createError}</p>
              )}
              <button
                type="button"
                onClick={handleCreate}
                disabled={creating}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-foreground text-background text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
              >
                {creating ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                Approve & Create
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
