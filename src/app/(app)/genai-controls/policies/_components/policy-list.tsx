'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Pencil, Trash2, Plus, Loader2, X, ShieldAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import { colorClasses } from '@/lib/data-catalog/types'
import { upsertPolicy, deletePolicy, togglePolicyActive } from '../actions'
import type { PolicyFields } from '../actions'
import type { GenAIPolicy, ApprovalStatus, PolicyType } from '@/lib/genai/types'
import { lintAllPolicies, SEVERITY_STYLES, type LintIssue } from '@/lib/genai/lint'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Category {
  id: string
  system_tag: string | null
  name: string
  color: string
}

interface Props {
  policies:   GenAIPolicy[]
  categories: Category[]
}

// ── Constants ─────────────────────────────────────────────────────────────────

const APPROVAL_STYLES: Record<ApprovalStatus, string> = {
  approved:       'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  'under-review': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  draft:          'bg-muted/60 text-muted-foreground border-border',
  rejected:       'bg-red-500/10 text-red-400 border-red-500/20',
  expired:        'bg-amber-500/10 text-amber-400 border-amber-500/20',
}

const POLICY_TYPE_META: Record<PolicyType, { label: string; style: string }> = {
  'usage':          { label: 'Usage Policy',         style: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  'data-handling':  { label: 'Data Handling Policy', style: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
  'approved-use':   { label: 'Approved Use Policy',  style: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  'prohibited':     { label: 'Prohibited Use Policy',style: 'bg-red-500/10 text-red-400 border-red-500/20' },
}

const APPROVAL_STATUSES: ApprovalStatus[] = ['draft', 'under-review', 'approved', 'rejected', 'expired']
const POLICY_TYPES: PolicyType[] = ['usage', 'data-handling', 'approved-use', 'prohibited']

const EMPTY_FIELDS: PolicyFields = {
  name: '', description: '', policy_type: 'usage', category_id: null,
  approval_status: 'draft', policy_owner: '', technical_owner: '',
  effective_date: null, review_date: null, next_review_date: null, notes: '',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function reviewDateColor(date: string | null): string {
  if (!date) return 'text-muted-foreground/50'
  const today = new Date().toISOString().split('T')[0]
  if (date < today) return 'text-red-400'
  const thirtyDays = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]
  if (date <= thirtyDays) return 'text-yellow-400'
  return 'text-muted-foreground/70'
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function PolicyModal({
  policy,
  categories,
  onClose,
}: {
  policy: GenAIPolicy | null  // null = create
  categories: Category[]
  onClose: () => void
}) {
  const [fields, setFields] = useState<PolicyFields>(
    policy
      ? {
          name: policy.name, description: policy.description ?? '',
          policy_type: policy.policy_type, category_id: policy.category_id,
          approval_status: policy.approval_status, policy_owner: policy.policy_owner ?? '',
          technical_owner: policy.technical_owner ?? '', effective_date: policy.effective_date,
          review_date: policy.review_date, next_review_date: policy.next_review_date,
          notes: policy.notes ?? '',
        }
      : { ...EMPTY_FIELDS }
  )
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function set<K extends keyof PolicyFields>(key: K, value: PolicyFields[K]) {
    setFields(f => ({ ...f, [key]: value }))
  }

  function handleSave() {
    if (!fields.name?.trim()) { setError('Policy name is required.'); return }
    setError(null)
    startTransition(async () => {
      const res = await upsertPolicy(policy?.id ?? null, fields)
      if (res.error) { setError(res.error); return }
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-card z-10">
          <h2 className="text-sm font-semibold text-foreground">
            {policy ? 'Edit Policy' : 'New Policy'}
          </h2>
          <button onClick={onClose} className="text-muted-foreground/60 hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Name */}
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wide block mb-1">
              Policy Name <span className="text-red-400">*</span>
            </label>
            <input
              value={fields.name ?? ''}
              onChange={e => set('name', e.target.value)}
              placeholder="e.g. ChatGPT Enterprise Usage Policy"
              className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/30 border border-border/60 rounded-md px-3 py-2 focus:border-border focus:outline-none transition-colors"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wide block mb-1">Description</label>
            <textarea
              value={fields.description ?? ''}
              onChange={e => set('description', e.target.value)}
              placeholder="What does this policy govern?"
              rows={2}
              className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/30 border border-border/60 rounded-md px-3 py-2 focus:border-border focus:outline-none resize-none transition-colors"
            />
          </div>

          {/* Type + Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wide block mb-1">Policy Type</label>
              <select
                value={fields.policy_type}
                onChange={e => set('policy_type', e.target.value as PolicyType)}
                className="w-full bg-card text-sm text-foreground border border-border/60 rounded-md px-3 py-2 focus:border-border focus:outline-none appearance-none cursor-pointer"
              >
                {POLICY_TYPES.map(t => (
                  <option key={t} value={t}>{POLICY_TYPE_META[t].label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wide block mb-1">Approval Status</label>
              <select
                value={fields.approval_status}
                onChange={e => set('approval_status', e.target.value as ApprovalStatus)}
                className="w-full bg-card text-sm text-foreground border border-border/60 rounded-md px-3 py-2 focus:border-border focus:outline-none appearance-none cursor-pointer"
              >
                {APPROVAL_STATUSES.map(s => (
                  <option key={s} value={s}>{s.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Linked Category */}
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wide block mb-1">Linked Governance Category</label>
            <select
              value={fields.category_id ?? ''}
              onChange={e => set('category_id', e.target.value || null)}
              className="w-full bg-card text-sm text-foreground border border-border/60 rounded-md px-3 py-2 focus:border-border focus:outline-none appearance-none cursor-pointer"
            >
              <option value="">— None —</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Owners */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wide block mb-1">Policy Owner</label>
              <input
                value={fields.policy_owner ?? ''}
                onChange={e => set('policy_owner', e.target.value)}
                placeholder="e.g. IT Security"
                className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/30 border border-border/60 rounded-md px-3 py-2 focus:border-border focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wide block mb-1">Technical Owner</label>
              <input
                value={fields.technical_owner ?? ''}
                onChange={e => set('technical_owner', e.target.value)}
                placeholder="e.g. DLP Team"
                className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/30 border border-border/60 rounded-md px-3 py-2 focus:border-border focus:outline-none transition-colors"
              />
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-3 gap-3">
            {(
              [
                ['effective_date',    'Effective Date'],
                ['review_date',       'Review Date'],
                ['next_review_date',  'Next Review'],
              ] as [keyof PolicyFields, string][]
            ).map(([key, label]) => (
              <div key={key}>
                <label className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wide block mb-1">{label}</label>
                <input
                  type="date"
                  value={(fields[key] as string | null) ?? ''}
                  onChange={e => set(key, e.target.value || null)}
                  className="w-full bg-transparent text-sm text-foreground border border-border/60 rounded-md px-3 py-2 focus:border-border focus:outline-none transition-colors"
                />
              </div>
            ))}
          </div>

          {/* Notes */}
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wide block mb-1">Notes</label>
            <textarea
              value={fields.notes ?? ''}
              onChange={e => set('notes', e.target.value)}
              placeholder="Additional context or justification…"
              rows={2}
              className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/30 border border-border/60 rounded-md px-3 py-2 focus:border-border focus:outline-none resize-none transition-colors"
            />
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border sticky bottom-0 bg-card">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isPending}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-md bg-foreground text-background hover:bg-foreground/90 disabled:opacity-50 transition-colors"
          >
            {isPending && <Loader2 className="w-3 h-3 animate-spin" />}
            {policy ? 'Save Changes' : 'Create Policy'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function PolicyList({ policies: initialPolicies, categories }: Props) {
  const [policies, setPolicies] = useState<GenAIPolicy[]>(initialPolicies)
  const [filterStatus, setFilterStatus]  = useState<ApprovalStatus | 'all'>('all')
  const [filterType, setFilterType]      = useState<PolicyType | 'all'>('all')
  const [activeOnly, setActiveOnly]      = useState(false)
  const [editing, setEditing]            = useState<GenAIPolicy | null | 'new'>()
  const [lintResults, setLintResults]    = useState<LintIssue[] | null>(null)
  const [, startTransition]              = useTransition()

  const categoryMap = new Map(categories.map(c => [c.id, c]))

  const visible = policies.filter(p => {
    if (filterStatus !== 'all' && p.approval_status !== filterStatus) return false
    if (filterType   !== 'all' && p.policy_type    !== filterType)    return false
    if (activeOnly && !p.is_active) return false
    return true
  })

  function handleToggle(id: string, current: boolean) {
    setPolicies(ps => ps.map(p => p.id === id ? { ...p, is_active: !current } : p))
    startTransition(async () => {
      await togglePolicyActive(id, !current)
    })
  }

  function handleDelete(id: string) {
    if (!confirm('Delete this policy? This cannot be undone.')) return
    setPolicies(ps => ps.filter(p => p.id !== id))
    startTransition(async () => {
      await deletePolicy(id)
    })
  }

  function handleSaved() {
    setEditing(undefined)
    // Server revalidation will refresh the page data; local state is updated optimistically above
  }

  return (
    <>
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value as ApprovalStatus | 'all')}
          className="bg-card text-xs text-foreground border border-border/60 rounded-md px-2.5 py-1.5 focus:outline-none appearance-none cursor-pointer"
        >
          <option value="all">All statuses</option>
          {APPROVAL_STATUSES.map(s => (
            <option key={s} value={s}>{s.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
          ))}
        </select>
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value as PolicyType | 'all')}
          className="bg-card text-xs text-foreground border border-border/60 rounded-md px-2.5 py-1.5 focus:outline-none appearance-none cursor-pointer"
        >
          <option value="all">All types</option>
          {POLICY_TYPES.map(t => (
            <option key={t} value={t}>{POLICY_TYPE_META[t].label}</option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground/70 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={activeOnly}
            onChange={e => setActiveOnly(e.target.checked)}
            className="accent-foreground"
          />
          Active only
        </label>
        <div className="flex-1" />
        <button
          onClick={() => setLintResults(lintAllPolicies(policies))}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-border bg-muted/30 hover:bg-muted/60 text-muted-foreground transition-colors"
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          Lint Policies
          {lintResults !== null && lintResults.length > 0 && (
            <span className="ml-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/20">
              {lintResults.length}
            </span>
          )}
        </button>
        <Link
          href="/genai-controls/policies/new"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-foreground text-background hover:bg-foreground/90 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          New Policy
        </Link>
      </div>

      {/* Lint results panel */}
      {lintResults !== null && (
        <div className="rounded-xl border border-border bg-card/50 shadow-sm overflow-hidden mb-5">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-foreground/80">Lint Results</span>
              {(() => {
                const errors   = lintResults.filter(i => i.severity === 'error').length
                const warnings = lintResults.filter(i => i.severity === 'warning').length
                const infos    = lintResults.filter(i => i.severity === 'info').length
                return (
                  <>
                    {errors   > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">{errors} error{errors !== 1 ? 's' : ''}</span>}
                    {warnings > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">{warnings} warning{warnings !== 1 ? 's' : ''}</span>}
                    {infos    > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">{infos} suggestion{infos !== 1 ? 's' : ''}</span>}
                  </>
                )
              })()}
            </div>
            <button
              onClick={() => setLintResults(null)}
              className="text-muted-foreground/50 hover:text-foreground transition-colors"
              aria-label="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {lintResults.length === 0 ? (
            <div className="px-4 py-3 flex items-center gap-2 text-xs text-emerald-400">
              <span>✅</span>
              <span>No issues found — your policies look good.</span>
            </div>
          ) : (
            <ul className="divide-y divide-border/40">
              {lintResults.map(issue => {
                const s = SEVERITY_STYLES[issue.severity]
                const names = issue.policyIds
                  .map(id => policies.find(p => p.id === id)?.name)
                  .filter((n): n is string => Boolean(n))
                return (
                  <li key={issue.id} className="px-4 py-3 flex items-start gap-3">
                    <span className="text-xs shrink-0 mt-0.5">{s.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded border', s.bg, s.text, s.border)}>
                          {s.label}
                        </span>
                        <span className="text-xs font-semibold text-foreground/90">{issue.title}</span>
                      </div>
                      <p className="text-xs text-muted-foreground/70 mt-0.5 leading-relaxed">{issue.detail}</p>
                      {names.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {names.map(n => (
                            <span key={n} className="text-[10px] px-1.5 py-0.5 rounded bg-muted/40 text-muted-foreground/60 border border-border">
                              {n}
                            </span>
                          ))}
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
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm text-muted-foreground/60 mb-4">
            {policies.length === 0
              ? 'No policies yet. Create your first GenAI governance policy.'
              : 'No policies match the current filters.'}
          </p>
          {policies.length === 0 && (
            <Link
              href="/genai-controls/policies/new"
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-md bg-foreground text-background hover:bg-foreground/90 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Create Policy
            </Link>
          )}
        </div>
      )}

      {/* List */}
      {visible.length > 0 && (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-card">
                <th className="text-left text-[10px] text-muted-foreground/50 uppercase tracking-wide px-4 py-3 w-8">Active</th>
                <th className="text-left text-[10px] text-muted-foreground/50 uppercase tracking-wide px-4 py-3">Policy</th>
                <th className="text-left text-[10px] text-muted-foreground/50 uppercase tracking-wide px-4 py-3 hidden md:table-cell">Category</th>
                <th className="text-left text-[10px] text-muted-foreground/50 uppercase tracking-wide px-4 py-3">Status</th>
                <th className="text-left text-[10px] text-muted-foreground/50 uppercase tracking-wide px-4 py-3 hidden lg:table-cell">Owner</th>
                <th className="text-left text-[10px] text-muted-foreground/50 uppercase tracking-wide px-4 py-3 hidden lg:table-cell">Next Review</th>
                <th className="px-4 py-3 w-16" />
              </tr>
            </thead>
            <tbody>
              {visible.map((policy, i) => {
                const cat = policy.category_id ? categoryMap.get(policy.category_id) : null
                const catCc = cat ? colorClasses(cat.color) : null
                const typeMeta = POLICY_TYPE_META[policy.policy_type]
                const approvalStyle = APPROVAL_STYLES[policy.approval_status]

                return (
                  <tr
                    key={policy.id}
                    className={cn(
                      'border-b border-border/60 last:border-0',
                      !policy.is_active && 'opacity-50',
                      i % 2 === 0 ? 'bg-card/50' : 'bg-transparent',
                    )}
                  >
                    {/* Active toggle */}
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleToggle(policy.id, policy.is_active)}
                        className={cn(
                          'w-8 h-4.5 rounded-full transition-colors relative',
                          policy.is_active ? 'bg-emerald-500/70' : 'bg-muted',
                        )}
                        title={policy.is_active ? 'Deactivate' : 'Activate'}
                      >
                        <span className={cn(
                          'absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-all',
                          policy.is_active ? 'left-4' : 'left-0.5',
                        )} />
                      </button>
                    </td>

                    {/* Name + description + type badge */}
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground/90 leading-tight">{policy.name}</p>
                      {policy.description && (
                        <p className="text-muted-foreground/60 mt-0.5 line-clamp-1">{policy.description}</p>
                      )}
                      <span className={cn('inline-block mt-1 text-[10px] font-semibold px-1.5 py-0.5 rounded border', typeMeta.style)}>
                        {typeMeta.label}
                      </span>
                    </td>

                    {/* Category */}
                    <td className="px-4 py-3 hidden md:table-cell">
                      {cat && catCc ? (
                        <span className="flex items-center gap-1.5">
                          <span className={cn('w-2 h-2 rounded-full shrink-0', catCc.bg)} />
                          <span className="text-foreground/80">{cat.name}</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground/40">—</span>
                      )}
                    </td>

                    {/* Approval status */}
                    <td className="px-4 py-3">
                      <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded border', approvalStyle)}>
                        {policy.approval_status.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                      </span>
                    </td>

                    {/* Policy owner */}
                    <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground/70">
                      {policy.policy_owner ?? <span className="text-muted-foreground/30">—</span>}
                    </td>

                    {/* Next review date */}
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className={reviewDateColor(policy.next_review_date)}>
                        {policy.next_review_date ?? '—'}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={() => setEditing(policy)}
                          className="text-muted-foreground/50 hover:text-foreground transition-colors"
                          title="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(policy.id)}
                          className="text-muted-foreground/50 hover:text-red-400 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {editing !== undefined && (
        <PolicyModal
          policy={editing === 'new' ? null : editing}
          categories={categories}
          onClose={handleSaved}
        />
      )}
    </>
  )
}
