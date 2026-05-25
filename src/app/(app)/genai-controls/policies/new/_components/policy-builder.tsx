'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { colorClasses } from '@/lib/data-catalog/types'
import { upsertPolicy } from '../../actions'
import type { ApprovalStatus, PolicyType, PolicyRule, ActionCode } from '@/lib/genai/types'

// ── Types ─────────────────────────────────────────────────────────────────────

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

interface Props {
  apps:       App[]
  categories: Category[]
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STEPS = ['Details', 'App Scope', 'DLP Rules', 'Review'] as const
type Step = 0 | 1 | 2 | 3

const APPROVAL_STATUSES: ApprovalStatus[] = ['draft', 'under-review', 'approved', 'rejected', 'expired']
const POLICY_TYPES: PolicyType[]          = ['usage', 'data-handling', 'approved-use', 'prohibited']

const POLICY_TYPE_LABELS: Record<PolicyType, string> = {
  'usage':         'Usage Policy',
  'data-handling': 'Data Handling Policy',
  'approved-use':  'Approved Use Policy',
  'prohibited':    'Prohibited Use Policy',
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
  { key: 'public',             label: 'Public' },
  { key: 'internal',           label: 'Internal' },
  { key: 'confidential',       label: 'Confidential' },
  { key: 'highly-confidential',label: 'Highly Confidential' },
  { key: 'secret',             label: 'Secret' },
  { key: 'credentials',        label: 'Credentials / Secrets' },
  { key: 'pci',                label: 'PCI Data' },
  { key: 'pii-low',            label: 'Low-volume PII' },
  { key: 'pii-bulk',           label: 'Bulk PII' },
  { key: 'source-code',        label: 'Source Code' },
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
    data_type: dt.key,
    post_prompt: 'not-set', upload: 'not-set', download: 'not-set', response: 'not-set',
  }))

// ── Step 1: Details ───────────────────────────────────────────────────────────

function StepDetails({
  name, setName, description, setDescription,
  policyType, setPolicyType, categoryId, setCategoryId,
  approvalStatus, setApprovalStatus, policyOwner, setPolicyOwner,
  technicalOwner, setTechnicalOwner, effectiveDate, setEffectiveDate,
  reviewDate, setReviewDate, nextReviewDate, setNextReviewDate,
  notes, setNotes, categories,
}: {
  name: string; setName: (v: string) => void
  description: string; setDescription: (v: string) => void
  policyType: PolicyType; setPolicyType: (v: PolicyType) => void
  categoryId: string | null; setCategoryId: (v: string | null) => void
  approvalStatus: ApprovalStatus; setApprovalStatus: (v: ApprovalStatus) => void
  policyOwner: string; setPolicyOwner: (v: string) => void
  technicalOwner: string; setTechnicalOwner: (v: string) => void
  effectiveDate: string; setEffectiveDate: (v: string) => void
  reviewDate: string; setReviewDate: (v: string) => void
  nextReviewDate: string; setNextReviewDate: (v: string) => void
  notes: string; setNotes: (v: string) => void
  categories: Category[]
}) {
  const inputCls = 'w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/30 border border-border/60 rounded-md px-3 py-2 focus:border-border focus:outline-none transition-colors'
  const selectCls = 'w-full bg-card text-sm text-foreground border border-border/60 rounded-md px-3 py-2 focus:border-border focus:outline-none appearance-none cursor-pointer'
  const labelCls = 'text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wide block mb-1'

  return (
    <div className="space-y-4">
      <div>
        <label className={labelCls}>Policy Name <span className="text-red-400">*</span></label>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. ChatGPT Enterprise Usage Policy" className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Description</label>
        <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="What does this policy govern?" rows={2} className={`${inputCls} resize-none`} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Policy Type</label>
          <select value={policyType} onChange={e => setPolicyType(e.target.value as PolicyType)} className={selectCls}>
            {POLICY_TYPES.map(t => <option key={t} value={t}>{POLICY_TYPE_LABELS[t]}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Approval Status</label>
          <select value={approvalStatus} onChange={e => setApprovalStatus(e.target.value as ApprovalStatus)} className={selectCls}>
            {APPROVAL_STATUSES.map(s => <option key={s} value={s}>{s.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className={labelCls}>Linked Governance Category</label>
        <select value={categoryId ?? ''} onChange={e => setCategoryId(e.target.value || null)} className={selectCls}>
          <option value="">— None —</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Policy Owner</label>
          <input value={policyOwner} onChange={e => setPolicyOwner(e.target.value)} placeholder="e.g. IT Security" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Technical Owner</label>
          <input value={technicalOwner} onChange={e => setTechnicalOwner(e.target.value)} placeholder="e.g. DLP Team" className={inputCls} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {([['effectiveDate', 'Effective Date', effectiveDate, setEffectiveDate], ['reviewDate', 'Review Date', reviewDate, setReviewDate], ['nextReviewDate', 'Next Review', nextReviewDate, setNextReviewDate]] as const).map(([, label, val, setter]) => (
          <div key={label}>
            <label className={labelCls}>{label}</label>
            <input type="date" value={val} onChange={e => setter(e.target.value)} className={inputCls} />
          </div>
        ))}
      </div>
      <div>
        <label className={labelCls}>Notes</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Additional context or justification…" rows={2} className={`${inputCls} resize-none`} />
      </div>
    </div>
  )
}

// ── Step 2: App Scope ─────────────────────────────────────────────────────────

function StepScope({
  scopeAllApps, setScopeAllApps, selectedAppIds, setSelectedAppIds, apps,
}: {
  scopeAllApps: boolean; setScopeAllApps: (v: boolean) => void
  selectedAppIds: Set<string>; setSelectedAppIds: (v: Set<string>) => void
  apps: App[]
}) {
  const [search, setSearch] = useState('')

  const filtered = apps.filter(a =>
    a.app_name.toLowerCase().includes(search.toLowerCase()) ||
    a.vendor.toLowerCase().includes(search.toLowerCase())
  )

  function toggle(appId: string) {
    const next = new Set(selectedAppIds)
    if (next.has(appId)) next.delete(appId)
    else next.add(appId)
    setSelectedAppIds(next)
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground/70">
        Choose whether this policy applies to all GenAI apps in the catalog, or only specific ones.
      </p>

      <div className="flex gap-3">
        <button
          onClick={() => setScopeAllApps(true)}
          className={cn(
            'flex-1 px-4 py-3 rounded-lg border text-sm font-semibold transition-all text-left',
            scopeAllApps
              ? 'bg-foreground/10 border-foreground/30 text-foreground'
              : 'border-border text-muted-foreground hover:border-border-strong',
          )}
        >
          All apps
          <p className="text-xs font-normal text-muted-foreground/70 mt-0.5">Applies to every GenAI app in the catalog</p>
        </button>
        <button
          onClick={() => setScopeAllApps(false)}
          className={cn(
            'flex-1 px-4 py-3 rounded-lg border text-sm font-semibold transition-all text-left',
            !scopeAllApps
              ? 'bg-foreground/10 border-foreground/30 text-foreground'
              : 'border-border text-muted-foreground hover:border-border-strong',
          )}
        >
          Specific apps
          {selectedAppIds.size > 0 && (
            <span className="ml-2 text-xs font-semibold text-foreground/70 bg-muted px-1.5 py-0.5 rounded">
              {selectedAppIds.size} selected
            </span>
          )}
          <p className="text-xs font-normal text-muted-foreground/70 mt-0.5">Select individual apps from the catalog</p>
        </button>
      </div>

      {!scopeAllApps && (
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
                    const cellCls = ACTION_CELL[val]
                    return (
                      <td key={act.key} className="px-2 py-2.5 text-center">
                        <select
                          value={val}
                          onChange={e => setCell(dt.key, act.key, e.target.value as ActionCode)}
                          className={cn(
                            'text-xs font-semibold px-2 py-1 rounded-md border cursor-pointer appearance-none focus:outline-none text-center',
                            cellCls,
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
  name, description, policyType, categoryId, approvalStatus,
  policyOwner, scopeAllApps, selectedAppIds, rules, categories, apps,
}: {
  name: string; description: string; policyType: PolicyType; categoryId: string | null
  approvalStatus: ApprovalStatus; policyOwner: string; scopeAllApps: boolean
  selectedAppIds: Set<string>; rules: PolicyRule[]; categories: Category[]; apps: App[]
}) {
  const category = categories.find(c => c.id === categoryId)
  const catCc = category ? colorClasses(category.color) : null
  const configuredRules = rules.filter(r =>
    r.post_prompt !== 'not-set' || r.upload !== 'not-set' || r.download !== 'not-set' || r.response !== 'not-set'
  )

  const APPROVAL_CHIP: Record<ApprovalStatus, string> = {
    approved:       'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    'under-review': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    draft:          'bg-muted/60 text-muted-foreground border-border',
    rejected:       'bg-red-500/10 text-red-400 border-red-500/20',
    expired:        'bg-amber-500/10 text-amber-400 border-amber-500/20',
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card/50 divide-y divide-border/60">
        <Row label="Name" value={name || '—'} />
        <Row label="Description" value={description || '—'} />
        <Row label="Type" value={POLICY_TYPE_LABELS[policyType]} />
        <Row label="Category" value={
          category && catCc
            ? <span className="flex items-center gap-1.5"><span className={cn('w-2 h-2 rounded-full', catCc.bg)} />{category.name}</span>
            : '—'
        } />
        <Row label="Status" value={
          <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded border', APPROVAL_CHIP[approvalStatus])}>
            {approvalStatus.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase())}
          </span>
        } />
        <Row label="Owner" value={policyOwner || '—'} />
        <Row label="App Scope" value={
          scopeAllApps
            ? `All apps (${apps.length} total)`
            : `${selectedAppIds.size} specific app${selectedAppIds.size !== 1 ? 's' : ''}`
        } />
        <Row label="Rules Configured" value={
          configuredRules.length > 0
            ? `${configuredRules.length} of 10 data types have DLP actions`
            : 'No rules configured (inherits from Control Matrix)'
        } />
      </div>
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

// ── Main wizard component ─────────────────────────────────────────────────────

export function PolicyBuilder({ apps, categories }: Props) {
  const router = useRouter()
  const [step, setStep]   = useState<Step>(0)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Step 1 state
  const [name, setName]                     = useState('')
  const [description, setDescription]       = useState('')
  const [policyType, setPolicyType]         = useState<PolicyType>('usage')
  const [categoryId, setCategoryId]         = useState<string | null>(null)
  const [approvalStatus, setApprovalStatus] = useState<ApprovalStatus>('draft')
  const [policyOwner, setPolicyOwner]       = useState('')
  const [technicalOwner, setTechnicalOwner] = useState('')
  const [effectiveDate, setEffectiveDate]   = useState('')
  const [reviewDate, setReviewDate]         = useState('')
  const [nextReviewDate, setNextReviewDate] = useState('')
  const [notes, setNotes]                   = useState('')

  // Step 2 state
  const [scopeAllApps, setScopeAllApps]       = useState(true)
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
    startTransition(async () => {
      const result = await upsertPolicy(null, {
        name: name.trim(),
        description:    description || undefined,
        policy_type:    policyType,
        category_id:    categoryId,
        approval_status: submitForReview ? 'under-review' : approvalStatus,
        policy_owner:    policyOwner || undefined,
        technical_owner: technicalOwner || undefined,
        effective_date:  effectiveDate || null,
        review_date:     reviewDate || null,
        next_review_date: nextReviewDate || null,
        notes:           notes || undefined,
        scope_all_apps:  scopeAllApps,
        scope_app_ids:   scopeAllApps ? [] : Array.from(selectedAppIds),
        rules:           rules.filter(r =>
          r.post_prompt !== 'not-set' || r.upload !== 'not-set' ||
          r.download !== 'not-set'   || r.response !== 'not-set'
        ),
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
            policyType={policyType} setPolicyType={setPolicyType}
            categoryId={categoryId} setCategoryId={setCategoryId}
            approvalStatus={approvalStatus} setApprovalStatus={setApprovalStatus}
            policyOwner={policyOwner} setPolicyOwner={setPolicyOwner}
            technicalOwner={technicalOwner} setTechnicalOwner={setTechnicalOwner}
            effectiveDate={effectiveDate} setEffectiveDate={setEffectiveDate}
            reviewDate={reviewDate} setReviewDate={setReviewDate}
            nextReviewDate={nextReviewDate} setNextReviewDate={setNextReviewDate}
            notes={notes} setNotes={setNotes}
            categories={categories}
          />
        )}
        {step === 1 && (
          <StepScope
            scopeAllApps={scopeAllApps} setScopeAllApps={setScopeAllApps}
            selectedAppIds={selectedAppIds} setSelectedAppIds={setSelectedAppIds}
            apps={apps}
          />
        )}
        {step === 2 && (
          <StepRules rules={rules} setRules={setRules} />
        )}
        {step === 3 && (
          <StepReview
            name={name} description={description} policyType={policyType}
            categoryId={categoryId} approvalStatus={approvalStatus}
            policyOwner={policyOwner} scopeAllApps={scopeAllApps}
            selectedAppIds={selectedAppIds} rules={rules}
            categories={categories} apps={apps}
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
