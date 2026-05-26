'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { upsertPolicy } from '../../actions'
import type { PolicyRule, ActionCode, GenAIPolicy } from '@/lib/genai/types'
import { lintPolicy, SEVERITY_STYLES } from '@/lib/genai/lint'

// ── Local types ───────────────────────────────────────────────────────────────

type IdentityFieldName =
  | 'business_function'
  | 'privilege_level'
  | 'employment_type'
  | 'user_lifecycle_status'

type RiskLevel = 'critical' | 'high' | 'medium' | 'low'

interface IdentityOption {
  id:         string
  field_name: string
  value_name: string
  risk_level: string
}

interface App {
  app_id:      string
  app_name:    string
  vendor:      string
  app_type:    string
  logo_letter: string
  logo_bg:     string
}

interface Category {
  id:         string
  system_tag: string | null
  name:       string
  color:      string
}

interface Classification {
  app_id:                  string
  customer_classification: string
}

interface Props {
  apps:            App[]
  categories:      Category[]
  classifications: Classification[]
  identityFields:  Record<string, IdentityOption[]>
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STEPS = ['Details', 'App Scope', 'DLP Rules', 'Review'] as const
type Step = 0 | 1 | 2 | 3

const IDENTITY_FIELD_ORDER: IdentityFieldName[] = [
  'business_function',
  'privilege_level',
  'employment_type',
  'user_lifecycle_status',
]

const IDENTITY_FIELD_LABELS: Record<IdentityFieldName, string> = {
  business_function:     'Business Function',
  privilege_level:       'Privilege Level',
  employment_type:       'Employment Type',
  user_lifecycle_status: 'User Lifecycle Status',
}

const RISK_DOT: Record<string, string> = {
  critical: 'bg-red-400',
  high:     'bg-amber-400',
  medium:   'bg-blue-400',
  low:      'bg-emerald-400',
}

const ACTION_CODES: ActionCode[] = ['not-set', 'allow', 'monitor', 'alert', 'coach', 'coach-ack', 'coach-just', 'block']

const ACTION_LABELS: Record<ActionCode, string> = {
  'not-set':    '—',
  'allow':      'Allow',
  'monitor':    'Monitor',
  'alert':      'Alert',
  'coach':      'Coach',
  'coach-ack':  'Coach + Ack',
  'coach-just': 'Coach + Justify',
  'block':      'Block',
}

const ACTION_CELL: Record<ActionCode, string> = {
  'allow':      'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  'monitor':    'bg-blue-500/10 text-blue-400 border-blue-500/20',
  'alert':      'bg-amber-500/10 text-amber-400 border-amber-500/20',
  'coach':      'bg-orange-500/10 text-orange-400 border-orange-500/20',
  'coach-ack':  'bg-orange-500/15 text-orange-300 border-orange-500/30',
  'coach-just': 'bg-amber-600/15 text-amber-300 border-amber-600/25',
  'block':      'bg-red-500/10 text-red-400 border-red-500/20',
  'not-set':    'bg-transparent text-muted-foreground/30 border-border',
}

const DATA_TYPES: { key: string; label: string }[] = [
  { key: 'public',              label: 'Public' },
  { key: 'internal',            label: 'Internal' },
  { key: 'confidential',        label: 'Confidential' },
  { key: 'highly-confidential', label: 'Highly Confidential' },
  { key: 'secret',              label: 'Secret' },
  { key: 'credentials',         label: 'Credentials / Secrets' },
  { key: 'pci',                 label: 'PCI Data' },
  { key: 'pii-low',             label: 'Low-volume PII' },
  { key: 'pii-bulk',            label: 'Bulk PII' },
  { key: 'source-code',         label: 'Source Code' },
]

type Activity = 'post_prompt' | 'upload' | 'download' | 'response'
const ACTIVITIES: { key: Activity; label: string }[] = [
  { key: 'post_prompt', label: 'Post / Prompt' },
  { key: 'upload',      label: 'Upload' },
  { key: 'download',    label: 'Download' },
  { key: 'response',    label: 'Response' },
]

const defaultRules = (): PolicyRule[] =>
  DATA_TYPES.map(dt => ({
    data_type:   dt.key,
    post_prompt: 'not-set',
    upload:      'not-set',
    download:    'not-set',
    response:    'not-set',
  }))

// ── Step 1: Details ───────────────────────────────────────────────────────────

function StepDetails({
  name, setName, description, setDescription,
  identityContext, setIdentityContext, identityFields,
}: {
  name: string; setName: (v: string) => void
  description: string; setDescription: (v: string) => void
  identityContext: Set<string>; setIdentityContext: (v: Set<string>) => void
  identityFields: Record<string, IdentityOption[]>
}) {
  const inputCls = 'w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/30 border border-border/60 rounded-md px-3 py-2 focus:border-border focus:outline-none transition-colors'
  const labelCls = 'text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wide block mb-1'

  function toggle(id: string) {
    const next = new Set(identityContext)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setIdentityContext(next)
  }

  const hasAnyIdentity = IDENTITY_FIELD_ORDER.some(f => (identityFields[f]?.length ?? 0) > 0)

  return (
    <div className="space-y-5">
      <div>
        <label className={labelCls}>Policy Name <span className="text-red-400">*</span></label>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. ChatGPT Enterprise Usage Policy"
          className={inputCls}
        />
      </div>

      <div>
        <label className={labelCls}>Description</label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="What does this policy govern?"
          rows={2}
          className={`${inputCls} resize-none`}
        />
      </div>

      <div>
        <label className={labelCls}>Identity Context</label>
        <p className="text-xs text-muted-foreground/60 mb-3">
          Optionally restrict this policy to specific user groups. Leave empty to apply to all users.
        </p>

        {!hasAnyIdentity ? (
          <p className="text-xs text-muted-foreground/40 italic">
            No identity values configured yet. Set them up in{' '}
            <a href="/policies/identity" className="underline hover:text-muted-foreground/60 transition-colors">
              Policies → Identity
            </a>.
          </p>
        ) : (
          <div className="space-y-4">
            {IDENTITY_FIELD_ORDER.map(field => {
              const values = identityFields[field] ?? []
              if (!values.length) return null
              return (
                <div key={field}>
                  <p className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wide mb-2">
                    {IDENTITY_FIELD_LABELS[field]}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {values.map(v => {
                      const selected = identityContext.has(v.id)
                      return (
                        <button
                          key={v.id}
                          onClick={() => toggle(v.id)}
                          className={cn(
                            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all',
                            selected
                              ? 'bg-foreground/10 border-foreground/30 text-foreground'
                              : 'border-border text-muted-foreground/70 hover:border-border-strong',
                          )}
                        >
                          <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', RISK_DOT[v.risk_level] ?? 'bg-muted')} />
                          {v.value_name}
                          {selected && <Check className="w-3 h-3 ml-0.5 shrink-0" />}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {identityContext.size > 0 && (
          <p className="text-[10px] text-muted-foreground/50 mt-3">
            {identityContext.size} group{identityContext.size !== 1 ? 's' : ''} selected — policy applies only to matching users.
          </p>
        )}
      </div>
    </div>
  )
}

// ── Step 2: App Scope ─────────────────────────────────────────────────────────

type ScopeMode = 'category' | 'specific'

function StepScope({
  scopeMode, setScopeMode, scopeCategoryId, setScopeCategoryId,
  selectedAppIds, setSelectedAppIds, categories, apps, classifications,
}: {
  scopeMode: ScopeMode | null
  setScopeMode: (v: ScopeMode) => void
  scopeCategoryId: string | null
  setScopeCategoryId: (v: string | null) => void
  selectedAppIds: Set<string>
  setSelectedAppIds: (v: Set<string>) => void
  categories: Category[]
  apps: App[]
  classifications: Classification[]
}) {
  const [search, setSearch] = useState('')

  const filtered = apps.filter(a =>
    a.app_name.toLowerCase().includes(search.toLowerCase()) ||
    a.vendor.toLowerCase().includes(search.toLowerCase())
  )

  function appCountForCategory(cat: Category): number {
    if (!cat.system_tag) return 0
    return classifications.filter(c => c.customer_classification === cat.system_tag).length
  }

  function toggle(appId: string) {
    const next = new Set(selectedAppIds)
    if (next.has(appId)) next.delete(appId)
    else next.add(appId)
    setSelectedAppIds(next)
  }

  function selectCategory(catId: string) {
    setScopeMode('category')
    setScopeCategoryId(catId)
  }

  function selectSpecific() {
    setScopeMode('specific')
    setScopeCategoryId(null)
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground/70">
        Choose which apps this policy applies to — by governance category or by selecting specific apps.
      </p>

      <div className="grid grid-cols-2 gap-3">
        {categories.map(cat => {
          const isSelected = scopeMode === 'category' && scopeCategoryId === cat.id
          const count = appCountForCategory(cat)
          return (
            <button
              key={cat.id}
              onClick={() => selectCategory(cat.id)}
              className={cn(
                'px-4 py-3 rounded-lg border text-sm font-semibold transition-all text-left',
                isSelected
                  ? 'bg-foreground/10 border-foreground/30 text-foreground'
                  : 'border-border text-muted-foreground hover:border-border-strong',
              )}
            >
              {cat.name}
              <p className="text-xs font-normal text-muted-foreground/70 mt-0.5">
                {count} classified app{count !== 1 ? 's' : ''}
              </p>
            </button>
          )
        })}

        <button
          onClick={selectSpecific}
          className={cn(
            'px-4 py-3 rounded-lg border text-sm font-semibold transition-all text-left',
            scopeMode === 'specific'
              ? 'bg-foreground/10 border-foreground/30 text-foreground'
              : 'border-border text-muted-foreground hover:border-border-strong',
          )}
        >
          Specific Apps
          {scopeMode === 'specific' && selectedAppIds.size > 0 && (
            <span className="ml-2 text-xs font-semibold text-foreground/70 bg-muted px-1.5 py-0.5 rounded">
              {selectedAppIds.size} selected
            </span>
          )}
          <p className="text-xs font-normal text-muted-foreground/70 mt-0.5">Pick individual apps from the catalog</p>
        </button>
      </div>

      {scopeMode === 'specific' && (
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search apps…"
              className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/30 border border-border/60 rounded-md pl-8 pr-3 py-2 focus:border-border focus:outline-none transition-colors"
            />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-72 overflow-y-auto pr-1">
            {filtered.map(app => {
              const checked = selectedAppIds.has(app.app_id)
              return (
                <button
                  key={app.app_id}
                  onClick={() => toggle(app.app_id)}
                  className={cn(
                    'flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-left transition-all',
                    checked
                      ? 'border-foreground/30 bg-foreground/10'
                      : 'border-border hover:border-border-strong',
                  )}
                >
                  <div
                    className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold text-foreground shrink-0"
                    style={{ backgroundColor: app.logo_bg }}
                  >
                    {app.logo_letter}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-foreground truncate">{app.app_name}</p>
                    <p className="text-[10px] text-muted-foreground/60 truncate">{app.vendor}</p>
                  </div>
                  {checked && <Check className="w-3.5 h-3.5 text-foreground/70 shrink-0" />}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Step 3: DLP Rules ─────────────────────────────────────────────────────────

function StepRules({ rules, setRules }: { rules: PolicyRule[]; setRules: (r: PolicyRule[]) => void }) {
  function setCell(dataType: string, activity: Activity, value: ActionCode) {
    setRules(rules.map(r => r.data_type === dataType ? { ...r, [activity]: value } : r))
  }

  function fillColumn(activity: Activity, value: ActionCode) {
    setRules(rules.map(r => ({ ...r, [activity]: value })))
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground/70">
        Define what DLP action to apply when each type of data is sent to a GenAI app covered by this policy.
        Leave cells as <span className="font-medium text-muted-foreground">—</span> to inherit from the Control Matrix.
      </p>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-card">
              <th className="text-left text-[10px] text-muted-foreground/50 uppercase tracking-wide px-4 py-3 w-40">Data Type</th>
              {ACTIVITIES.map(act => (
                <th key={act.key} className="text-center text-[10px] text-muted-foreground/50 uppercase tracking-wide px-2 py-3">
                  <div>{act.label}</div>
                  <div className="flex justify-center mt-1.5">
                    <select
                      onChange={e => fillColumn(act.key, e.target.value as ActionCode)}
                      defaultValue=""
                      className="bg-muted/60 text-[9px] text-muted-foreground/70 border border-border/60 rounded px-1 py-0.5 cursor-pointer appearance-none focus:outline-none"
                    >
                      <option value="" disabled>fill all</option>
                      {ACTION_CODES.map(ac => <option key={ac} value={ac}>{ACTION_LABELS[ac]}</option>)}
                    </select>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DATA_TYPES.map((dt, i) => {
              const rule = rules.find(r => r.data_type === dt.key)!
              return (
                <tr key={dt.key} className={cn('border-b border-border/60 last:border-0', i % 2 === 0 ? 'bg-card/40' : '')}>
                  <td className="px-4 py-2.5 text-foreground/80 font-medium">{dt.label}</td>
                  {ACTIVITIES.map(act => {
                    const val = rule[act.key]
                    return (
                      <td key={act.key} className="px-2 py-2.5 text-center">
                        <select
                          value={val}
                          onChange={e => setCell(dt.key, act.key, e.target.value as ActionCode)}
                          className={cn(
                            'text-xs font-semibold px-2 py-1 rounded-md border cursor-pointer appearance-none focus:outline-none text-center',
                            ACTION_CELL[val],
                          )}
                        >
                          {ACTION_CODES.map(ac => (
                            <option key={ac} value={ac} className="bg-card text-foreground">{ACTION_LABELS[ac]}</option>
                          ))}
                        </select>
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Step 4: Review ────────────────────────────────────────────────────────────

function StepReview({
  name, description, scopeMode, scopeCategoryId, selectedAppIds,
  identityContext, identityFields, rules, categories, apps, classifications,
}: {
  name: string
  description: string
  scopeMode: ScopeMode | null
  scopeCategoryId: string | null
  selectedAppIds: Set<string>
  identityContext: Set<string>
  identityFields: Record<string, IdentityOption[]>
  rules: PolicyRule[]
  categories: Category[]
  apps: App[]
  classifications: Classification[]
}) {
  const configuredRules = rules.filter(r =>
    r.post_prompt !== 'not-set' || r.upload !== 'not-set' ||
    r.download !== 'not-set' || r.response !== 'not-set'
  )

  const selectedCategory = categories.find(c => c.id === scopeCategoryId)

  function appScopeLabel(): string {
    if (scopeMode === 'category' && selectedCategory) {
      const count = selectedCategory.system_tag
        ? classifications.filter(c => c.customer_classification === selectedCategory.system_tag).length
        : 0
      return `${selectedCategory.name} (${count} app${count !== 1 ? 's' : ''})`
    }
    if (scopeMode === 'specific') {
      return `${selectedAppIds.size} specific app${selectedAppIds.size !== 1 ? 's' : ''}`
    }
    return 'Not selected'
  }

  function identityLabel(): string {
    if (identityContext.size === 0) return 'All users'
    const allValues = IDENTITY_FIELD_ORDER.flatMap(f => identityFields[f] ?? [])
    const selected = allValues.filter(v => identityContext.has(v.id))
    if (selected.length <= 3) return selected.map(v => v.value_name).join(', ')
    return `${selected.slice(0, 2).map(v => v.value_name).join(', ')} +${selected.length - 2} more`
  }

  // Minimal draft for linting
  const draft: GenAIPolicy = {
    id: 'draft', org_id: '', name, description,
    policy_type: 'usage', category_id: null, approval_status: 'draft',
    policy_owner: null, technical_owner: null,
    effective_date: null, review_date: null, next_review_date: null,
    notes: null, is_active: true, priority: 99,
    scope_all_apps: false,
    scope_app_ids: scopeMode === 'specific' ? [...selectedAppIds] : [],
    rules,
    identity_context: identityContext.size > 0 ? [...identityContext] : null,
    created_at: '', updated_at: '',
  }
  const lintIssues = lintPolicy(draft)

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card/50 divide-y divide-border/60">
        <Row label="Name" value={name || '—'} />
        <Row label="Description" value={description || '—'} />
        <Row label="App Scope" value={appScopeLabel()} />
        <Row label="Identity Context" value={identityLabel()} />
        <Row label="Rules Configured" value={
          configuredRules.length > 0
            ? `${configuredRules.length} of 10 data types have DLP actions`
            : 'No rules configured (inherits from Control Matrix)'
        } />
      </div>

      {lintIssues.length === 0 ? (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-xs text-emerald-400">
          <span>✅</span>
          <span>No issues detected with this policy.</span>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card/50 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border flex items-center gap-2">
            <span className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest">Policy Check</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
              {lintIssues.length} issue{lintIssues.length !== 1 ? 's' : ''}
            </span>
          </div>
          <ul className="divide-y divide-border/40">
            {lintIssues.map(issue => {
              const s = SEVERITY_STYLES[issue.severity]
              return (
                <li key={issue.id} className="px-4 py-3 flex items-start gap-3">
                  <span className="text-xs shrink-0 mt-0.5">{s.icon}</span>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded border', s.bg, s.text, s.border)}>
                        {s.label}
                      </span>
                      <span className="text-xs font-semibold text-foreground/90">{issue.title}</span>
                    </div>
                    <p className="text-xs text-muted-foreground/70 mt-0.5 leading-relaxed">{issue.detail}</p>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4 px-5 py-3">
      <span className="text-xs text-muted-foreground/60 w-36 shrink-0">{label}</span>
      <span className="text-xs text-foreground/90">{value}</span>
    </div>
  )
}

// ── Main wizard ───────────────────────────────────────────────────────────────

export function PolicyBuilder({ apps, categories, classifications, identityFields }: Props) {
  const router = useRouter()
  const [step, setStep]   = useState<Step>(0)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Step 1 state
  const [name, setName]               = useState('')
  const [description, setDescription] = useState('')
  const [identityContext, setIdentityContext] = useState<Set<string>>(new Set())

  // Step 2 state
  const [scopeMode, setScopeMode]           = useState<ScopeMode | null>(null)
  const [scopeCategoryId, setScopeCategoryId] = useState<string | null>(null)
  const [selectedAppIds, setSelectedAppIds]   = useState<Set<string>>(new Set())

  // Step 3 state
  const [rules, setRules] = useState<PolicyRule[]>(defaultRules())

  function canAdvance(): boolean {
    if (step === 0) return name.trim().length > 0
    return true
  }

  function handleNext() {
    if (!canAdvance()) { setError('Policy name is required.'); return }
    setError(null)
    setStep(s => Math.min(s + 1, 3) as Step)
  }

  function handleBack() {
    setError(null)
    setStep(s => Math.max(s - 1, 0) as Step)
  }

  function handleSave(submitForReview: boolean) {
    if (!name.trim()) { setError('Policy name is required.'); return }
    setError(null)

    // Expand category scope to app IDs
    let saveAppIds: string[] = []
    if (scopeMode === 'category' && scopeCategoryId) {
      const cat = categories.find(c => c.id === scopeCategoryId)
      if (cat?.system_tag) {
        saveAppIds = classifications
          .filter(c => c.customer_classification === cat.system_tag)
          .map(c => c.app_id)
      }
    } else if (scopeMode === 'specific') {
      saveAppIds = Array.from(selectedAppIds)
    }

    startTransition(async () => {
      const result = await upsertPolicy(null, {
        name:             name.trim(),
        description:      description || undefined,
        policy_type:      'usage',
        approval_status:  submitForReview ? 'under-review' : 'draft',
        scope_all_apps:   false,
        scope_app_ids:    saveAppIds,
        rules:            rules.filter(r =>
          r.post_prompt !== 'not-set' || r.upload !== 'not-set' ||
          r.download !== 'not-set'   || r.response !== 'not-set'
        ),
        identity_context: identityContext.size > 0 ? [...identityContext] : null,
      })
      if (result.error) { setError(result.error); return }
      router.push('/genai-controls/policies')
    })
  }

  const completedSteps = new Set<number>()
  if (name.trim()) completedSteps.add(0)
  if (step > 1) completedSteps.add(1)
  if (step > 2) completedSteps.add(2)

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="flex items-center gap-0">
        {STEPS.map((label, i) => {
          const isCurrent   = step === i
          const isCompleted = completedSteps.has(i)
          const isReachable = i <= step || isCompleted
          return (
            <div key={i} className="flex items-center flex-1 last:flex-none">
              <button
                onClick={() => isReachable ? setStep(i as Step) : undefined}
                disabled={!isReachable}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all',
                  isCurrent   ? 'bg-foreground/10 text-foreground' :
                  isCompleted ? 'text-emerald-400 hover:bg-emerald-500/10' :
                  'text-muted-foreground/40 cursor-default',
                )}
              >
                <span className={cn(
                  'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border',
                  isCurrent   ? 'bg-foreground text-background border-foreground' :
                  isCompleted ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                  'border-border text-muted-foreground/40',
                )}>
                  {isCompleted && !isCurrent ? <Check className="w-2.5 h-2.5" /> : i + 1}
                </span>
                {label}
              </button>
              {i < STEPS.length - 1 && (
                <div className="flex-1 h-px bg-border/60 mx-1" />
              )}
            </div>
          )
        })}
      </div>

      {/* Step content */}
      <div className="rounded-xl border border-border bg-card/50 shadow-sm p-6">
        {step === 0 && (
          <StepDetails
            name={name} setName={setName}
            description={description} setDescription={setDescription}
            identityContext={identityContext} setIdentityContext={setIdentityContext}
            identityFields={identityFields}
          />
        )}
        {step === 1 && (
          <StepScope
            scopeMode={scopeMode} setScopeMode={setScopeMode}
            scopeCategoryId={scopeCategoryId} setScopeCategoryId={setScopeCategoryId}
            selectedAppIds={selectedAppIds} setSelectedAppIds={setSelectedAppIds}
            categories={categories} apps={apps} classifications={classifications}
          />
        )}
        {step === 2 && (
          <StepRules rules={rules} setRules={setRules} />
        )}
        {step === 3 && (
          <StepReview
            name={name} description={description}
            scopeMode={scopeMode} scopeCategoryId={scopeCategoryId}
            selectedAppIds={selectedAppIds} identityContext={identityContext}
            identityFields={identityFields} rules={rules}
            categories={categories} apps={apps} classifications={classifications}
          />
        )}
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={handleBack}
          disabled={step === 0}
          className="px-4 py-2 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-default transition-colors"
        >
          ← Back
        </button>

        <div className="flex items-center gap-2">
          {step < 3 ? (
            <button
              onClick={handleNext}
              className="flex items-center gap-1.5 px-5 py-2 text-xs font-semibold rounded-md bg-foreground text-background hover:bg-foreground/90 transition-colors"
            >
              Next →
            </button>
          ) : (
            <>
              <button
                onClick={() => handleSave(false)}
                disabled={isPending}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-md border border-border hover:bg-card/80 transition-colors disabled:opacity-50"
              >
                {isPending && <Loader2 className="w-3 h-3 animate-spin" />}
                Save as Draft
              </button>
              <button
                onClick={() => handleSave(true)}
                disabled={isPending}
                className="flex items-center gap-1.5 px-5 py-2 text-xs font-semibold rounded-md bg-foreground text-background hover:bg-foreground/90 transition-colors disabled:opacity-50"
              >
                {isPending && <Loader2 className="w-3 h-3 animate-spin" />}
                Submit for Review
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
