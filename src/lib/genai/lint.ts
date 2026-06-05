import type { GenAIPolicy, NpjShape } from '@/lib/genai/types'

export type LintSeverity = 'error' | 'warning' | 'info'

export interface LintIssue {
  id:        string
  severity:  LintSeverity
  title:     string
  detail:    string
  policyIds: string[]
}

export const SEVERITY_STYLES: Record<LintSeverity, { bg: string; border: string; text: string; icon: string; label: string }> = {
  error:   { bg: 'bg-red-500/10',   border: 'border-red-500/20',   text: 'text-red-400',   icon: '🔴', label: 'Error'      },
  warning: { bg: 'bg-amber-500/10', border: 'border-amber-500/20', text: 'text-amber-400', icon: '🟡', label: 'Warning'    },
  info:    { bg: 'bg-blue-500/10',  border: 'border-blue-500/20',  text: 'text-blue-400',  icon: '🔵', label: 'Suggestion' },
}

const HIGH_RISK = ['secret', 'credentials', 'pci', 'pii-bulk', 'highly-confidential']

type Activity = 'post_prompt' | 'upload' | 'download' | 'response'
const ACTIVITIES: Activity[] = ['post_prompt', 'upload', 'download', 'response']

const DATA_TYPE_LABELS: Record<string, string> = {
  'public':             'Public',
  'internal':           'Internal',
  'confidential':       'Confidential',
  'highly-confidential':'Highly Confidential',
  'secret':             'Secret',
  'credentials':        'Credentials / Secrets',
  'pci':                'PCI Data',
  'pii-low':            'Low-volume PII',
  'pii-bulk':           'Bulk PII',
  'source-code':        'Source Code',
}

const ACTIVITY_LABELS: Record<Activity, string> = {
  post_prompt: 'Post/Prompt',
  upload:      'Upload',
  download:    'Download',
  response:    'Response',
}

// ── NPJ helpers ───────────────────────────────────────────────────────────────

function getNpj(policy: GenAIPolicy): NpjShape | null {
  return policy.neutral_policy_json as NpjShape | null
}

function lintNpjPolicy(policy: GenAIPolicy, npj: NpjShape): LintIssue[] {
  const issues: LintIssue[] = []

  // 1. No decision configured — policy has no enforcement effect
  if (!npj.decision?.mode) {
    issues.push({
      id:        `${policy.id}-npj-no-decision`,
      severity:  'error',
      title:     'No decision configured',
      detail:    `"${policy.name}" has no decision mode set — it will have no enforcement effect.`,
      policyIds: [policy.id],
    })
  }

  // 2. No content conditions and no app scope — policy won't match any traffic
  const hasConditions = (npj.content?.conditions ?? []).length > 0
  const hasAppScope   = (npj.scope?.app_categories ?? []).length > 0
  if (!hasConditions && !hasAppScope) {
    issues.push({
      id:        `${policy.id}-npj-no-scope`,
      severity:  'warning',
      title:     'No content conditions or app scope',
      detail:    `"${policy.name}" has no content conditions and no app category scope — it may not match any traffic.`,
      policyIds: [policy.id],
    })
  }

  return issues
}

// ── Legacy rules-based checks (non-NPJ policies only) ─────────────────────────

function lintRulesPolicy(policy: GenAIPolicy): LintIssue[] {
  const issues: LintIssue[] = []

  // 1. No DLP rules configured
  const hasAnyRule = policy.rules.some(r =>
    ACTIVITIES.some(a => r[a] !== 'not-set'),
  )
  if (!hasAnyRule) {
    issues.push({
      id:        `${policy.id}-no-rules`,
      severity:  'warning',
      title:     'No DLP rules configured',
      detail:    `"${policy.name}" has no rules set — it has no enforcement effect.`,
      policyIds: [policy.id],
    })
  }

  // 2. Allow action on high-risk data types
  for (const rule of policy.rules) {
    if (!HIGH_RISK.includes(rule.data_type)) continue
    for (const act of ACTIVITIES) {
      if (rule[act] === 'allow') {
        issues.push({
          id:        `${policy.id}-allow-${rule.data_type}-${act}`,
          severity:  'warning',
          title:     'Allow action on sensitive data',
          detail:    `"${policy.name}" allows ${DATA_TYPE_LABELS[rule.data_type] ?? rule.data_type} via ${ACTIVITY_LABELS[act]} — consider monitoring or blocking instead.`,
          policyIds: [policy.id],
        })
      }
    }
  }

  // 3. Approved all-apps policy missing high-risk data type coverage
  if (policy.scope_all_apps && policy.approval_status === 'approved') {
    for (const dt of HIGH_RISK) {
      const rule    = policy.rules.find(r => r.data_type === dt)
      const covered = rule && ACTIVITIES.some(a => rule[a] !== 'not-set')
      if (!covered) {
        issues.push({
          id:        `${policy.id}-gap-${dt}`,
          severity:  'warning',
          title:     'High-risk data type not covered',
          detail:    `"${policy.name}" is an approved all-apps policy with no rules for ${DATA_TYPE_LABELS[dt] ?? dt}.`,
          policyIds: [policy.id],
        })
      }
    }
  }

  return issues
}

// ── Universal checks (apply to all policies regardless of model) ──────────────

function lintUniversal(policy: GenAIPolicy): LintIssue[] {
  const issues: LintIssue[] = []

  // 4. No policy owner
  if (!policy.policy_owner) {
    issues.push({
      id:        `${policy.id}-no-owner`,
      severity:  'info',
      title:     'No policy owner assigned',
      detail:    `"${policy.name}" has no designated policy owner.`,
      policyIds: [policy.id],
    })
  }

  // 5. Review date overdue
  if (policy.next_review_date) {
    const today = new Date().toISOString().split('T')[0]
    if (policy.next_review_date < today) {
      issues.push({
        id:        `${policy.id}-overdue`,
        severity:  'warning',
        title:     'Review date overdue',
        detail:    `"${policy.name}" was due for review on ${policy.next_review_date}.`,
        policyIds: [policy.id],
      })
    }
  }

  // 6. Approved but not active
  if (policy.approval_status === 'approved' && !policy.is_active) {
    issues.push({
      id:        `${policy.id}-inactive`,
      severity:  'info',
      title:     'Approved policy is inactive',
      detail:    `"${policy.name}" is approved but not active — it is not being enforced.`,
      policyIds: [policy.id],
    })
  }

  return issues
}

// ── Public API ────────────────────────────────────────────────────────────────

export function lintPolicy(policy: GenAIPolicy): LintIssue[] {
  const npj = getNpj(policy)
  return [
    ...(npj ? lintNpjPolicy(policy, npj) : lintRulesPolicy(policy)),
    ...lintUniversal(policy),
  ]
}

const SEVERITY_ORDER: Record<LintSeverity, number> = { error: 0, warning: 1, info: 2 }

export function lintAllPolicies(policies: GenAIPolicy[]): LintIssue[] {
  const issues: LintIssue[] = policies.flatMap(lintPolicy)

  // Cross-policy: allow vs block conflict on same app scope + data_type + activity
  // Only applies to legacy rules-based policies — NPJ policies have empty rules arrays
  // and conflict detection via NPJ structure requires deeper diffing (deferred).
  const active     = policies.filter(p => p.is_active)
  const rulesOnly  = active.filter(p => !getNpj(p))

  for (let i = 0; i < rulesOnly.length; i++) {
    for (let j = i + 1; j < rulesOnly.length; j++) {
      const pA = rulesOnly[i]
      const pB = rulesOnly[j]

      const overlap =
        pA.scope_all_apps ||
        pB.scope_all_apps ||
        pA.scope_app_ids.some(id => pB.scope_app_ids.includes(id))

      if (!overlap) continue

      for (const rA of pA.rules) {
        const rB = pB.rules.find(r => r.data_type === rA.data_type)
        if (!rB) continue

        for (const act of ACTIVITIES) {
          const aA = rA[act]
          const aB = rB[act]
          if (aA === 'not-set' || aB === 'not-set') continue

          if ((aA === 'allow' && aB === 'block') || (aA === 'block' && aB === 'allow')) {
            const conflictId = `conflict-${[pA.id, pB.id].sort().join('-')}-${rA.data_type}-${act}`
            if (!issues.find(x => x.id === conflictId)) {
              issues.push({
                id:        conflictId,
                severity:  'error',
                title:     'Conflicting Allow / Block actions',
                detail:    `"${pA.name}" (${aA}) and "${pB.name}" (${aB}) conflict on ${DATA_TYPE_LABELS[rA.data_type] ?? rA.data_type} → ${ACTIVITY_LABELS[act]}. Block wins by priority — this may be unintentional.`,
                policyIds: [pA.id, pB.id],
              })
            }
          }
        }
      }
    }
  }

  return issues.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
}
