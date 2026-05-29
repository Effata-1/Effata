'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  MessageSquare, Pencil, Plus, Search,
  ShieldAlert, ShieldCheck, Sparkles, Trash2, X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { deletePolicy, generatePoliciesFromGovernance, getPolicyPackJobStatus, togglePolicyActive } from '../actions'
import { PolicyChatPanel } from './policy-chat-panel'
import type { GenAIPolicy, ApprovalStatus, ActionCode, PolicyRule } from '@/lib/genai/types'
import { lintAllPolicies, SEVERITY_STYLES, type LintIssue } from '@/lib/genai/lint'
import type { RuleItem } from '../new/_components/policy-builder'

// ── Types ─────────────────────────────────────────────────────────────────────

type Activity = 'post_prompt' | 'upload' | 'download' | 'response'

interface IdentityOption { id: string; field_name: string; value_name: string; risk_level: string }
interface App { app_id: string; app_name: string; vendor: string; logo_letter: string; logo_bg: string }
interface Category { id: string; system_tag: string | null; name: string; color: string }
interface Classification { app_id: string; customer_classification: string }

interface Props {
  policies:        GenAIPolicy[]
  categories:      Category[]
  apps:            App[]
  classifications: Classification[]
  identityFields:  Record<string, IdentityOption[]>
  ruleItems:       RuleItem[]
}

// ── Constants ─────────────────────────────────────────────────────────────────

const APPROVAL_STYLES: Record<ApprovalStatus, string> = {
  approved:       'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  'under-review': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  draft:          'bg-muted/60 text-muted-foreground border-border',
  rejected:       'bg-red-500/10 text-red-400 border-red-500/20',
  expired:        'bg-amber-500/10 text-amber-400 border-amber-500/20',
}

const APPROVAL_STATUSES: ApprovalStatus[] = ['draft', 'under-review', 'approved', 'rejected', 'expired']

const ACTION_CODES: ActionCode[] = ['not-set', 'allow', 'monitor', 'alert', 'coach', 'coach-ack', 'coach-just', 'block']
const ACTION_LABELS: Record<ActionCode, string> = {
  'not-set':    '— Inherit from Control Matrix',
  'allow':      'Allow',
  'monitor':    'Monitor',
  'alert':      'Alert',
  'coach':      'Coach',
  'coach-ack':  'Coach + Acknowledge',
  'coach-just': 'Coach + Justify',
  'block':      'Block',
}
const ACTION_CHIP: Record<ActionCode, string> = {
  'allow':      'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  'monitor':    'bg-blue-500/10 text-blue-400 border-blue-500/20',
  'alert':      'bg-amber-500/10 text-amber-400 border-amber-500/20',
  'coach':      'bg-orange-500/10 text-orange-400 border-orange-500/20',
  'coach-ack':  'bg-orange-500/15 text-orange-300 border-orange-500/30',
  'coach-just': 'bg-amber-600/15 text-amber-300 border-amber-600/25',
  'block':      'bg-red-500/10 text-red-400 border-red-500/20',
  'not-set':    'bg-muted/30 text-muted-foreground/50 border-border/50',
}

const ACTIVITIES: { key: Activity; label: string }[] = [
  { key: 'post_prompt', label: 'Prompt'   },
  { key: 'upload',      label: 'Upload'   },
  { key: 'download',    label: 'Download' },
  { key: 'response',    label: 'Response' },
]

const TEST_CHIP: Record<string, string> = {
  'untested':    'bg-muted/60 text-muted-foreground/60 border-border/50',
  'in-progress': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  'passed':      'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  'failed':      'bg-red-500/10 text-red-400 border-red-500/20',
}
const TEST_LABELS: Record<string, string> = {
  'untested':    '—',
  'in-progress': 'Testing',
  'passed':      'Passed',
  'failed':      'Failed',
}

const VENDOR_CHIP: Record<string, string> = {
  'pending':        'bg-amber-500/10 text-amber-400 border-amber-500/20',
  'translated':     'bg-blue-500/10 text-blue-400 border-blue-500/20',
  'verified':       'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  'not-applicable': 'bg-muted/60 text-muted-foreground/60 border-border/50',
}
const VENDOR_LABELS: Record<string, string> = {
  'pending':        'Pending',
  'translated':     'Translated',
  'verified':       'Verified',
  'not-applicable': 'N/A',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const CAT_COLOR_CHIP: Record<string, string> = {
  emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  green:   'bg-green-500/10 text-green-400 border-green-500/20',
  blue:    'bg-blue-500/10 text-blue-400 border-blue-500/20',
  sky:     'bg-sky-500/10 text-sky-400 border-sky-500/20',
  amber:   'bg-amber-500/10 text-amber-400 border-amber-500/20',
  orange:  'bg-orange-500/10 text-orange-400 border-orange-500/20',
  red:     'bg-red-500/10 text-red-400 border-red-500/20',
  violet:  'bg-violet-500/10 text-violet-400 border-violet-500/20',
  purple:  'bg-purple-500/10 text-purple-400 border-purple-500/20',
  zinc:    'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
}

function getPolicyCategories(policy: GenAIPolicy, categories: Category[]): Category[] {
  const npj = (policy as unknown as Record<string, unknown>).neutral_policy_json
  if (!npj || typeof npj !== 'object') return []
  const scope = (npj as Record<string, unknown>).scope
  if (!scope || typeof scope !== 'object') return []
  const tags = (scope as Record<string, unknown>).app_categories
  if (!Array.isArray(tags)) return []
  return (tags as unknown[])
    .map(tag => categories.find(c => c.system_tag === tag))
    .filter((c): c is Category => Boolean(c))
}

function deriveFromRules(rules: PolicyRule[], ruleItems: RuleItem[]) {
  const validKeys = new Set(ruleItems.map(i => i.key))
  const selectedDataKeys = new Set(
    rules
      .filter(r => validKeys.has(r.data_type))
      .filter(r => r.post_prompt !== 'not-set' || r.upload !== 'not-set' || r.download !== 'not-set' || r.response !== 'not-set')
      .map(r => r.data_type),
  )
  const selectedActivities = new Set<Activity>()
  for (const r of rules) {
    if (r.post_prompt !== 'not-set') selectedActivities.add('post_prompt')
    if (r.upload      !== 'not-set') selectedActivities.add('upload')
    if (r.download    !== 'not-set') selectedActivities.add('download')
    if (r.response    !== 'not-set') selectedActivities.add('response')
  }
  if (selectedActivities.size === 0) {
    selectedActivities.add('post_prompt'); selectedActivities.add('upload')
    selectedActivities.add('download');    selectedActivities.add('response')
  }
  const counts: Record<string, number> = {}
  for (const r of rules)
    for (const a of ['post_prompt', 'upload', 'download', 'response'] as const)
      if (r[a] !== 'not-set') counts[r[a]] = (counts[r[a]] ?? 0) + 1
  const primaryAction = (Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] as ActionCode) ?? 'not-set'
  return { selectedDataKeys, selectedActivities, primaryAction }
}

// ── Row summary cells ─────────────────────────────────────────────────────────

function SourceCell({ policy, identityFields }: { policy: GenAIPolicy; identityFields: Record<string, IdentityOption[]> }) {
  const ids = policy.identity_context ?? []
  if (ids.length === 0) return <span className="text-[11px] text-muted-foreground/40 italic">Any user</span>
  const all = Object.values(identityFields).flat()
  const names = ids.map(id => all.find(v => v.id === id)?.value_name).filter(Boolean) as string[]
  if (names.length === 0) return <span className="text-[11px] text-muted-foreground/40 italic">Any user</span>
  return (
    <div className="space-y-0.5">
      <span className="text-[11px] text-foreground/80 truncate block max-w-[120px]">{names[0]}</span>
      {names.length > 1 && <span className="text-[10px] text-muted-foreground/50">+{names.length - 1} more</span>}
    </div>
  )
}

function DestCell({ policy, apps }: { policy: GenAIPolicy; apps: App[] }) {
  const ids = policy.scope_app_ids ?? []
  if (ids.length === 0) return <span className="text-[11px] text-muted-foreground/40 italic">All GenAI apps</span>
  const scoped = apps.filter(a => ids.includes(a.app_id))
  if (scoped.length === 0) return <span className="text-[11px] text-muted-foreground/40 italic">All GenAI apps</span>
  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-1.5">
        <span className="w-3.5 h-3.5 rounded flex items-center justify-center text-[8px] font-bold text-foreground shrink-0" style={{ backgroundColor: scoped[0].logo_bg }}>{scoped[0].logo_letter}</span>
        <span className="text-[11px] text-foreground/80 truncate max-w-[100px]">{scoped[0].app_name}</span>
      </div>
      {scoped.length > 1 && <span className="text-[10px] text-muted-foreground/50">+{scoped.length - 1} more</span>}
    </div>
  )
}

function DataCell({ policy, ruleItems }: { policy: GenAIPolicy; ruleItems: RuleItem[] }) {
  const rules = policy.rules ?? []
  const { selectedDataKeys, selectedActivities } = deriveFromRules(rules, ruleItems)
  const names = ruleItems.filter(i => selectedDataKeys.has(i.key)).map(i => i.name)
  const acts  = ACTIVITIES.filter(a => selectedActivities.has(a.key)).map(a => a.label)

  // If no rules but policy has a data_classification_label, show that instead
  if (names.length === 0 && policy.data_classification_label) {
    return (
      <span className="text-[11px] text-muted-foreground/60 capitalize italic">
        {policy.data_classification_label === 'all' ? 'All data' : policy.data_classification_label}
      </span>
    )
  }
  if (names.length === 0) {
    return (
      <div className="space-y-1">
        <span className="text-[11px] text-muted-foreground/40 italic">All data</span>
        <div className="flex gap-0.5 flex-wrap">
          {acts.map(l => <span key={l} className="text-[9px] px-1 py-0.5 rounded bg-muted/40 border border-border/40 text-muted-foreground/50">{l}</span>)}
        </div>
      </div>
    )
  }
  return (
    <div className="space-y-1">
      <span className="text-[11px] text-foreground/80 truncate block max-w-[140px]">
        {names[0]}{names.length > 1 ? ` +${names.length - 1}` : ''}
      </span>
      <div className="flex gap-0.5 flex-wrap">
        {acts.map(l => <span key={l} className="text-[9px] px-1 py-0.5 rounded bg-muted/40 border border-border/40 text-muted-foreground/50">{l}</span>)}
      </div>
    </div>
  )
}

function ActionCell({ policy, ruleItems }: { policy: GenAIPolicy; ruleItems: RuleItem[] }) {
  const hasRules = (policy.rules ?? []).length > 0
  const action: ActionCode = hasRules
    ? deriveFromRules(policy.rules ?? [], ruleItems).primaryAction
    : (policy.primary_action ?? 'not-set')
  const label = action === 'not-set' ? 'Inherited' : ACTION_LABELS[action]
  return (
    <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded border whitespace-nowrap', ACTION_CHIP[action])}>
      {label}
    </span>
  )
}

// ── Delete confirm modal ──────────────────────────────────────────────────────

function DeleteConfirmModal({
  policyName,
  onConfirm,
  onCancel,
}: {
  policyName: string
  onConfirm:  () => void
  onCancel:   () => void
}) {
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    cancelRef.current?.focus()
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onCancel() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-title"
        aria-describedby="delete-desc"
        className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm rounded-xl border border-border bg-card shadow-2xl p-6 space-y-4"
      >
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-9 h-9 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <Trash2 className="w-4 h-4 text-red-400" />
          </div>
          <div className="min-w-0">
            <p id="delete-title" className="text-sm font-semibold text-foreground">Delete policy?</p>
            <p id="delete-desc" className="text-xs text-muted-foreground/70 mt-1 leading-relaxed">
              <span className="font-medium text-foreground/80">&ldquo;{policyName}&rdquo;</span> will be permanently deleted.
              This cannot be undone — any references to this policy will be lost.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="px-3.5 py-1.5 text-xs font-medium rounded-md border border-border bg-muted/30 hover:bg-muted/60 text-foreground/70 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-3.5 py-1.5 text-xs font-semibold rounded-md bg-red-600 hover:bg-red-700 text-white transition-colors"
          >
            Delete policy
          </button>
        </div>
      </div>
    </>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function PolicyList({ policies: initialPolicies, categories, apps, classifications, identityFields, ruleItems }: Props) {
  const router = useRouter()
  const [policies, setPolicies]               = useState<GenAIPolicy[]>(initialPolicies)

  // Sync local state when server re-renders with fresh data (e.g. after generate)
  useEffect(() => { setPolicies(initialPolicies) }, [initialPolicies])
  const [filterStatus, setFilterStatus]       = useState<ApprovalStatus | 'all'>('all')
  const [activeOnly, setActiveOnly]           = useState(false)
  const [search, setSearch]                   = useState('')
  const [lintResults, setLintResults]         = useState<LintIssue[] | null>(null)
  const [isGenerating, setIsGenerating]       = useState(false)
  const [generateError, setGenerateError]     = useState<string | null>(null)
  const [, startTransition]                   = useTransition()
  const [chatOpen, setChatOpen]               = useState(false)
  const [chatPolicyId, setChatPolicyId]       = useState<string | undefined>(undefined)
  const [deleteTarget, setDeleteTarget]       = useState<{ id: string; name: string } | null>(null)

  void classifications
  void ACTION_CODES

  function openChat(policyId?: string) {
    setChatPolicyId(policyId)
    setChatOpen(true)
  }

  const visible = policies.filter(p => {
    if (filterStatus !== 'all' && p.approval_status !== filterStatus) return false
    if (activeOnly && !p.is_active) return false
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  function handleToggle(id: string, current: boolean) {
    setPolicies(ps => ps.map(p => p.id === id ? { ...p, is_active: !current } : p))
    startTransition(async () => { await togglePolicyActive(id, !current) })
  }

  function handleDelete(id: string, name: string) {
    setDeleteTarget({ id, name })
  }

  function confirmDelete() {
    if (!deleteTarget) return
    const { id } = deleteTarget
    setDeleteTarget(null)
    setPolicies(ps => ps.filter(p => p.id !== id))
    startTransition(async () => { await deletePolicy(id) })
  }

  async function handleGenerate() {
    setIsGenerating(true)
    setGenerateError(null)
    const result = await generatePoliciesFromGovernance()
    if (result.error) {
      setGenerateError(result.error)
      setIsGenerating(false)
      return
    }
    // Poll until the compile job completes, then refresh to show generated policies
    const jobId = result.jobId
    if (!jobId) {
      router.refresh()
      setIsGenerating(false)
      return
    }
    let attempts = 0
    const poll = setInterval(async () => {
      attempts++
      try {
        const status = await getPolicyPackJobStatus(jobId)
        if (status.status === 'completed' || status.status === 'failed') {
          clearInterval(poll)
          setIsGenerating(false)
          if (status.status === 'failed') {
            setGenerateError(status.error ?? 'Policy generation failed.')
          } else {
            router.refresh()
          }
        }
      } catch {
        // getPolicyPackJobStatus requires admin — fall back to timed refresh
        clearInterval(poll)
        setTimeout(() => { router.refresh(); setIsGenerating(false) }, 4000)
      }
      if (attempts >= 30) {
        clearInterval(poll)
        setIsGenerating(false)
        router.refresh()
      }
    }, 2000)
  }

  return (
    <>
      {/* Delete confirm modal */}
      {deleteTarget && (
        <DeleteConfirmModal
          policyName={deleteTarget.name}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* AI Chat Panel */}
      {chatOpen && (
        <PolicyChatPanel
          policies={policies}
          initialPolicyId={chatPolicyId}
          onClose={() => setChatOpen(false)}
        />
      )}

      {/* Floating "Refine with AI" button */}
      {policies.length > 0 && !chatOpen && (
        <button
          type="button"
          onClick={() => openChat()}
          className="fixed bottom-6 right-6 z-30 flex items-center gap-2 px-4 py-2.5 rounded-full bg-blue-600 text-white text-xs font-semibold shadow-lg hover:bg-blue-700 transition-colors"
        >
          <MessageSquare className="w-4 h-4" />
          Refine with AI
        </button>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/30" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search policies…"
            className="bg-card text-xs text-foreground placeholder:text-muted-foreground/30 border border-border/60 rounded-md pl-8 pr-3 py-1.5 w-52 focus:outline-none focus:border-border transition-colors"
          />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as ApprovalStatus | 'all')}
          className="bg-card text-xs text-foreground border border-border/60 rounded-md px-2.5 py-1.5 focus:outline-none appearance-none cursor-pointer"
        >
          <option value="all">All statuses</option>
          {APPROVAL_STATUSES.map(s => <option key={s} value={s}>{s.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground/70 cursor-pointer select-none">
          <input type="checkbox" checked={activeOnly} onChange={e => setActiveOnly(e.target.checked)} className="accent-foreground" />
          Active only
        </label>
        <div className="flex-1" />
        <button onClick={() => setLintResults(lintAllPolicies(policies))}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-border bg-muted/30 hover:bg-muted/60 text-muted-foreground transition-colors"
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          Lint Policies
          {lintResults !== null && lintResults.length > 0 && (
            <span className="ml-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/20">{lintResults.length}</span>
          )}
        </button>
        {policies.length === 0 && (
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border border-border bg-muted/30 hover:bg-muted/60 text-foreground/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {isGenerating ? 'Generating…' : 'Generate Policies'}
          </button>
        )}
        <Link
          href="/genai-controls/policies/new"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-foreground text-background hover:bg-foreground/90 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          New Policy
        </Link>
      </div>

      {/* Generating progress banner */}
      {isGenerating && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-blue-500/8 border border-blue-500/20 text-blue-400 text-xs mb-4">
          <svg className="animate-spin w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          Compiling policies from your Governance Matrix… this takes a few seconds.
        </div>
      )}

      {/* Generate error */}
      {generateError && (
        <div className="flex items-center justify-between px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs mb-4">
          <span>{generateError}</span>
          <button onClick={() => setGenerateError(null)} className="text-red-400/60 hover:text-red-400 transition-colors"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* Lint panel */}
      {lintResults !== null && (
        <div className="rounded-xl border border-border bg-card/50 shadow-sm overflow-hidden mb-4">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-foreground/80">Lint Results</span>
              {(() => {
                const errors = lintResults.filter(i => i.severity === 'error').length
                const warns  = lintResults.filter(i => i.severity === 'warning').length
                const infos  = lintResults.filter(i => i.severity === 'info').length
                return (<>
                  {errors > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">{errors} error{errors !== 1 ? 's' : ''}</span>}
                  {warns  > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">{warns} warning{warns !== 1 ? 's' : ''}</span>}
                  {infos  > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">{infos} suggestion{infos !== 1 ? 's' : ''}</span>}
                </>)
              })()}
            </div>
            <button onClick={() => setLintResults(null)} className="text-muted-foreground/50 hover:text-foreground transition-colors"><X className="w-3.5 h-3.5" /></button>
          </div>
          {lintResults.length === 0 ? (
            <div className="px-4 py-3 flex items-center gap-2 text-xs text-emerald-400"><span>✅</span><span>No issues found.</span></div>
          ) : (
            <ul className="divide-y divide-border/40">
              {lintResults.map(issue => {
                const s     = SEVERITY_STYLES[issue.severity]
                const names = issue.policyIds.map(id => policies.find(p => p.id === id)?.name).filter((n): n is string => Boolean(n))
                return (
                  <li key={issue.id} className="px-4 py-3 flex items-start gap-3">
                    <span className="text-xs shrink-0 mt-0.5">{s.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded border', s.bg, s.text, s.border)}>{s.label}</span>
                        <span className="text-xs font-semibold text-foreground/90">{issue.title}</span>
                      </div>
                      <p className="text-xs text-muted-foreground/70 mt-0.5 leading-relaxed">{issue.detail}</p>
                      {names.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {names.map(n => <span key={n} className="text-[10px] px-1.5 py-0.5 rounded bg-muted/40 text-muted-foreground/60 border border-border">{n}</span>)}
                        </div>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}

      {/* Empty state */}
      {visible.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          {policies.length === 0 ? (
            <>
              <div className="w-12 h-12 rounded-xl bg-card border border-border flex items-center justify-center mb-4 shadow-sm">
                <ShieldCheck className="w-6 h-6 text-muted-foreground/40" />
              </div>
              <p className="text-sm font-semibold text-foreground/70 mb-1">No policies yet</p>
              <p className="text-xs text-muted-foreground/50 mb-6 max-w-xs">
                Generate the recommended GenAI policy set from your App Governance control matrix, or create one manually.
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-md bg-foreground text-background hover:bg-foreground/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {isGenerating ? 'Generating…' : 'Generate Policies'}
                </button>
                <Link
                  href="/genai-controls/policies/new"
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-md border border-border bg-card hover:bg-muted/40 text-foreground/70 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> New Policy
                </Link>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground/60">No policies match the current filters.</p>
          )}
        </div>
      )}

      {/* Policy table */}
      {visible.length > 0 && (
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-card/80">
                  <th className="w-10 px-3 py-2.5" />
                  <th className="text-left text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wide px-3 py-2.5">
                    Name
                    <span className="ml-2 text-[10px] font-normal text-muted-foreground/30 normal-case tracking-normal">{visible.length} {visible.length === 1 ? 'policy' : 'policies'}</span>
                  </th>
                  <th className="text-left text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wide px-3 py-2.5 hidden md:table-cell">Source</th>
                  <th className="text-left text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wide px-3 py-2.5 hidden md:table-cell">Destination</th>
                  <th className="text-left text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wide px-3 py-2.5 hidden lg:table-cell">Data / Activities</th>
                  <th className="text-left text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wide px-3 py-2.5">Action</th>
                  <th className="text-left text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wide px-3 py-2.5">Status</th>
                  <th className="text-left text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wide px-3 py-2.5 hidden xl:table-cell">Family</th>
                  <th className="text-left text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wide px-3 py-2.5 hidden xl:table-cell">Test</th>
                  <th className="text-left text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wide px-3 py-2.5 hidden xl:table-cell">Vendor</th>
                  <th className="w-16 px-3 py-2.5" />
                </tr>
              </thead>

              <tbody>
                {visible.map(policy => (
                  <tr key={policy.id}
                    className={cn('border-b border-border/40 last:border-0 hover:bg-card/40 transition-colors', !policy.is_active && 'opacity-50')}
                  >
                    <td className="px-3 py-2.5 align-middle">
                      <button
                        onClick={() => handleToggle(policy.id, policy.is_active)}
                        className={cn('w-7 h-4 rounded-full transition-colors relative shrink-0', policy.is_active ? 'bg-emerald-500/70' : 'bg-muted')}
                        title={policy.is_active ? 'Deactivate' : 'Activate'}
                      >
                        <span className={cn('absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-all', policy.is_active ? 'left-3.5' : 'left-0.5')} />
                      </button>
                    </td>

                    <td className="px-3 py-2.5 align-middle max-w-[220px]">
                      <p className="font-semibold text-foreground/90 leading-tight truncate">{policy.name}</p>
                      {policy.description && (
                        <p className="text-muted-foreground/50 mt-0.5 truncate text-[10px]">{policy.description}</p>
                      )}
                      {(() => {
                        const cats = getPolicyCategories(policy, categories)
                        if (cats.length === 0) return null
                        return (
                          <div className="flex gap-1 flex-wrap mt-1">
                            {cats.map(cat => (
                              <span
                                key={cat.id}
                                className={cn('text-[9px] px-1.5 py-0.5 rounded border font-medium', CAT_COLOR_CHIP[cat.color] ?? CAT_COLOR_CHIP.zinc)}
                              >
                                {cat.name}
                              </span>
                            ))}
                          </div>
                        )
                      })()}
                    </td>

                    <td className="px-3 py-2.5 align-middle hidden md:table-cell">
                      <SourceCell policy={policy} identityFields={identityFields} />
                    </td>

                    <td className="px-3 py-2.5 align-middle hidden md:table-cell">
                      <DestCell policy={policy} apps={apps} />
                    </td>

                    <td className="px-3 py-2.5 align-middle hidden lg:table-cell">
                      <DataCell policy={policy} ruleItems={ruleItems} />
                    </td>

                    <td className="px-3 py-2.5 align-middle">
                      <ActionCell policy={policy} ruleItems={ruleItems} />
                    </td>

                    <td className="px-3 py-2.5 align-middle">
                      <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded border', APPROVAL_STYLES[policy.approval_status])}>
                        {policy.approval_status.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                      </span>
                    </td>

                    <td className="px-3 py-2.5 align-middle hidden xl:table-cell">
                      {policy.policy_family ? (
                        <span className="text-[10px] text-muted-foreground/70 truncate block max-w-[120px]">{policy.policy_family}</span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground/30 italic">—</span>
                      )}
                    </td>

                    <td className="px-3 py-2.5 align-middle hidden xl:table-cell">
                      <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded border whitespace-nowrap', TEST_CHIP[policy.test_status ?? 'untested'])}>
                        {TEST_LABELS[policy.test_status ?? 'untested']}
                      </span>
                    </td>

                    <td className="px-3 py-2.5 align-middle hidden xl:table-cell">
                      <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded border whitespace-nowrap', VENDOR_CHIP[policy.vendor_translation_status ?? 'pending'])}>
                        {VENDOR_LABELS[policy.vendor_translation_status ?? 'pending']}
                      </span>
                    </td>

                    <td className="px-3 py-2.5 align-middle">
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          type="button"
                          onClick={() => openChat(policy.id)}
                          className="text-muted-foreground/50 hover:text-blue-400 transition-colors"
                          title="Refine with AI"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </button>
                        <Link
                          href={`/genai-controls/policies/${policy.id}/edit`}
                          className="text-muted-foreground/50 hover:text-foreground transition-colors"
                          title="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Link>
                        <button onClick={() => handleDelete(policy.id, policy.name)} className="text-muted-foreground/50 hover:text-red-400 transition-colors" title="Delete">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  )
}
