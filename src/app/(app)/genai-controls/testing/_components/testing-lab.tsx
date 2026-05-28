'use client'

import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { FilterSelect } from '@/components/ui/filter-select'
import type { GenAIPolicy, CoachingNotification, ActionCode, CoachingTone } from '@/lib/genai/types'

// ─── Constants ────────────────────────────────────────────────────────────────

const ACTIVITIES = [
  { key: 'post_prompt', label: 'Post / Prompt' },
  { key: 'upload',      label: 'Upload' },
  { key: 'download',    label: 'Download' },
  { key: 'response',    label: 'Response' },
]

const ACTION_PRIORITY: ActionCode[] = [
  'block', 'coach-just', 'coach-ack', 'coach', 'alert', 'monitor', 'allow', 'not-set',
]

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

const ACTION_HERO: Record<ActionCode, string> = {
  'allow':      'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
  'monitor':    'bg-blue-500/10 border-blue-500/30 text-blue-400',
  'alert':      'bg-amber-500/10 border-amber-500/30 text-amber-400',
  'coach':      'bg-orange-500/10 border-orange-500/30 text-orange-400',
  'coach-ack':  'bg-orange-500/10 border-orange-500/30 text-orange-300',
  'coach-just': 'bg-amber-600/10 border-amber-600/30 text-amber-300',
  'block':      'bg-red-500/10 border-red-500/30 text-red-400',
  'not-set':    'bg-muted/20 border-border text-muted-foreground/40',
}

const ACTION_LABELS: Record<ActionCode, string> = {
  'allow':      'Allow',
  'monitor':    'Monitor',
  'alert':      'Alert',
  'coach':      'Coach',
  'coach-ack':  'Coach + Acknowledge',
  'coach-just': 'Coach + Justify',
  'block':      'Block',
  'not-set':    'Not Set',
}

const ACTION_ICONS: Record<ActionCode, string> = {
  'allow':      '✅',
  'monitor':    '👁',
  'alert':      '⚠️',
  'coach':      '💬',
  'coach-ack':  '💬',
  'coach-just': '💬',
  'block':      '🚫',
  'not-set':    '—',
}

const ACTION_DESC: Record<ActionCode, string> = {
  'allow':      'The action is permitted without restriction.',
  'monitor':    'The action is permitted and logged silently.',
  'alert':      'The action is permitted but an alert is raised for review.',
  'coach':      'The user sees a coaching message and may proceed.',
  'coach-ack':  'The user must acknowledge the coaching message before proceeding.',
  'coach-just': 'The user must provide a written justification before proceeding.',
  'block':      'The action is prevented entirely.',
  'not-set':    'No policy covers this scenario.',
}

const TONE_STYLES: Record<CoachingTone, { preview: string; border: string; icon: string }> = {
  informational: { preview: 'border-blue-500/30 bg-blue-500/5',   border: 'border-blue-500/30',   icon: '💡' },
  warning:       { preview: 'border-amber-500/30 bg-amber-500/5', border: 'border-amber-500/30',  icon: '⚠️' },
  urgent:        { preview: 'border-red-500/30 bg-red-500/5',     border: 'border-red-500/30',    icon: '🚫' },
}

// ─── Resolution engine ────────────────────────────────────────────────────────

type Activity = 'post_prompt' | 'upload' | 'download' | 'response'

interface SimMatch {
  policy: GenAIPolicy
  action:  ActionCode
}

interface SimResult {
  resolvedAction:   ActionCode
  winningPolicy:    GenAIPolicy | null
  matchingPolicies: SimMatch[]
  noRule:           GenAIPolicy[]
  outOfScope:       GenAIPolicy[]
  coachingTemplate: CoachingNotification | null
}

function simulate(
  policies: GenAIPolicy[],
  notifications: CoachingNotification[],
  appId: string,
  dataType: string,
  activity: Activity,
): SimResult {
  const inScope    = policies.filter(p => p.scope_all_apps || (p.scope_app_ids ?? []).includes(appId))
  const outOfScope = policies.filter(p => !p.scope_all_apps && !(p.scope_app_ids ?? []).includes(appId))

  const matchingPolicies: SimMatch[] = []
  const noRule: GenAIPolicy[] = []

  for (const p of inScope) {
    const rule   = (p.rules ?? []).find(r => r.data_type === dataType)
    const action = (rule?.[activity] ?? 'not-set') as ActionCode
    if (action !== 'not-set') {
      matchingPolicies.push({ policy: p, action })
    } else {
      noRule.push(p)
    }
  }

  if (matchingPolicies.length === 0) {
    return { resolvedAction: 'allow', winningPolicy: null, matchingPolicies, outOfScope, noRule, coachingTemplate: null }
  }

  const sorted = [...matchingPolicies].sort(
    (a, b) => ACTION_PRIORITY.indexOf(a.action) - ACTION_PRIORITY.indexOf(b.action),
  )
  const { policy: winningPolicy, action: resolvedAction } = sorted[0]

  let coachingTemplate: CoachingNotification | null = null
  if (['coach', 'coach-ack', 'coach-just'].includes(resolvedAction)) {
    const code = resolvedAction as 'coach' | 'coach-ack' | 'coach-just'
    coachingTemplate =
      notifications.find(n => n.action_code === code && n.linked_policy_id === winningPolicy.id) ??
      notifications.find(n => n.action_code === code && n.is_default) ??
      notifications.find(n => n.action_code === code) ??
      null
  }

  return { resolvedAction, winningPolicy, matchingPolicies: sorted, outOfScope, noRule, coachingTemplate }
}

// ─── Coaching preview ─────────────────────────────────────────────────────────

function CoachingPreview({
  notification,
  varValues,
}: {
  notification: CoachingNotification
  varValues: Record<string, string>
}) {
  function sub(text: string): string {
    return Object.entries(varValues).reduce((t, [k, v]) => t.replaceAll(k, v), text)
  }
  const ts = TONE_STYLES[notification.tone]
  const title   = sub(notification.title)
  const message = sub(notification.message)

  return (
    <div className={`rounded-xl border p-4 ${ts.preview}`}>
      <p className="text-[10px] font-medium text-muted-foreground/50 uppercase tracking-widest mb-3">
        User would see
      </p>
      <div className={`rounded-lg border bg-card p-4 shadow-sm ${ts.border}`}>
        <div className="flex items-start gap-2 mb-2">
          <span className="text-base leading-none mt-0.5">{ts.icon}</span>
          <p className="text-sm font-semibold text-foreground leading-snug">{title}</p>
        </div>
        <p className="text-xs text-muted-foreground/80 leading-relaxed mb-4">{message}</p>

        {notification.action_code === 'coach-ack' && (
          <label className="flex items-center gap-2 text-xs text-muted-foreground/70 mb-3 cursor-default">
            <input type="checkbox" className="rounded" readOnly />
            I acknowledge I have read the policy
          </label>
        )}
        {notification.action_code === 'coach-just' && (
          <textarea
            readOnly
            placeholder="Enter your justification…"
            className="w-full text-xs border border-border rounded-md bg-background/60 px-3 py-2 h-16 resize-none mb-3 text-muted-foreground/50"
          />
        )}

        <div className="flex justify-end gap-2">
          <button className="px-3 py-1.5 text-xs rounded-md bg-muted/40 text-muted-foreground/70 border border-border cursor-default">
            Stop
          </button>
          <button className="px-3 py-1.5 text-xs rounded-md bg-primary/10 text-primary border border-primary/20 cursor-default">
            {notification.action_code === 'coach-ack'  ? 'Acknowledge & Proceed' :
             notification.action_code === 'coach-just' ? 'Submit & Proceed' : 'Proceed'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export function TestingLab({
  policies,
  apps,
  notifications,
  dataTypeOptions,
}: {
  policies:         GenAIPolicy[]
  apps:             Array<{ app_id: string; app_name: string; vendor: string; domain: string; logo_letter: string; logo_bg: string; logo_url: string | null }>
  notifications:    CoachingNotification[]
  dataTypeOptions:  Array<{ key: string; label: string; group: string }>
}) {
  const [appId,    setAppId]    = useState('')
  const [dataType, setDataType] = useState('')
  const [activity, setActivity] = useState('')
  const [userName, setUserName] = useState('')
  const [showNoRule, setShowNoRule]       = useState(false)
  const [showOutOfScope, setShowOutOfScope] = useState(false)

  const ready = !!appId && !!dataType && !!activity
  const selectedApp = apps.find(a => a.app_id === appId)

  const result = useMemo<SimResult | null>(() => {
    if (!ready) return null
    try {
      return simulate(policies, notifications, appId, dataType, activity as Activity)
    } catch {
      return null
    }
  }, [ready, policies, notifications, appId, dataType, activity])

  const dataTypeLabel = dataTypeOptions.find(d => d.key === dataType)?.label ?? dataType
  const activityLabel = ACTIVITIES.find(a => a.key === activity)?.label ?? activity

  const varValues = {
    '{{app_name}}':    selectedApp?.app_name ?? 'this app',
    '{{policy_name}}': result?.winningPolicy?.name ?? 'your policy',
    '{{data_type}}':   dataTypeLabel,
    '{{user_name}}':   userName || 'User',
  }

  const appOptions = apps.map(a => ({ value: a.app_id, label: `${a.app_name} — ${a.vendor}` }))
  const dtOptions  = dataTypeOptions.map(d => ({ value: d.key, label: d.label }))
  const actOptions = ACTIVITIES.map(a => ({ value: a.key, label: a.label }))

  return (
    <div className="flex gap-6 items-start">
      {/* ── Left: Inputs ── */}
      <div className="w-72 shrink-0 space-y-4">
        <div className="rounded-xl border border-border bg-card/50 shadow-sm p-5 space-y-4">
          <p className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-widest">Scenario</p>

          <div>
            <label className="block text-xs font-medium text-muted-foreground/70 mb-1.5">GenAI App</label>
            <FilterSelect
              options={appOptions}
              value={appId}
              onChange={setAppId}
              placeholder="Select app…"
              searchable
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground/70 mb-1.5">Data Type</label>
            <FilterSelect
              options={dtOptions}
              value={dataType}
              onChange={setDataType}
              placeholder="Select data type…"
              searchable={false}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground/70 mb-1.5">Activity</label>
            <FilterSelect
              options={actOptions}
              value={activity}
              onChange={setActivity}
              placeholder="Select activity…"
              searchable={false}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground/70 mb-1.5">
              User name <span className="text-muted-foreground/40 font-normal">(optional)</span>
            </label>
            <input
              value={userName}
              onChange={e => setUserName(e.target.value)}
              placeholder="e.g. Alex"
              className="w-full text-sm border border-border rounded-lg bg-background/60 px-3 py-2 text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>

        {/* Policy count hint */}
        <p className="text-[11px] text-muted-foreground/40 text-center">
          {policies.length === 0
            ? 'No active policies — create one in Policy Library.'
            : `${policies.length} active polic${policies.length === 1 ? 'y' : 'ies'} loaded`}
        </p>
      </div>

      {/* ── Right: Results ── */}
      <div className="flex-1 min-w-0 space-y-4">
        {!ready ? (
          <div className="rounded-xl border border-dashed border-border/40 py-20 flex flex-col items-center gap-2">
            <p className="text-sm text-muted-foreground/40">
              Select an app, data type, and activity to simulate a policy decision.
            </p>
          </div>
        ) : (
          <>
            {/* ── Hero: Resolved Action ── */}
            <div className={`rounded-xl border p-6 ${ACTION_HERO[result!.resolvedAction]}`}>
              <div className="flex items-center gap-4">
                <span className="text-4xl leading-none">{ACTION_ICONS[result!.resolvedAction]}</span>
                <div>
                  <p className="text-2xl font-bold tracking-tight">
                    {ACTION_LABELS[result!.resolvedAction]}
                  </p>
                  <p className="text-xs text-muted-foreground/70 mt-0.5">
                    {selectedApp?.app_name} · {dataTypeLabel} · {activityLabel}
                  </p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground/70 mt-3">
                {ACTION_DESC[result!.resolvedAction]}
              </p>
              {result!.winningPolicy && (
                <p className="text-xs text-muted-foreground/50 mt-2">
                  Decided by: <span className="font-medium text-foreground/60">{result!.winningPolicy.name}</span>
                </p>
              )}
              {!result!.winningPolicy && policies.length > 0 && (
                <p className="text-xs text-muted-foreground/50 mt-2">
                  No active policy covers this scenario — defaulting to Allow.
                </p>
              )}
            </div>

            {/* ── Matching Policies ── */}
            {result!.matchingPolicies.length > 0 && (
              <div className="rounded-xl border border-border bg-card/50 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-border">
                  <p className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-widest">
                    Matching Policies ({result!.matchingPolicies.length})
                  </p>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50">
                      <th className="text-left text-[10px] font-medium text-muted-foreground/50 uppercase tracking-wide px-5 py-2">Policy</th>
                      <th className="text-left text-[10px] font-medium text-muted-foreground/50 uppercase tracking-wide px-5 py-2">Action</th>
                      <th className="text-left text-[10px] font-medium text-muted-foreground/50 uppercase tracking-wide px-5 py-2">Scope</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result!.matchingPolicies.map(({ policy, action }, i) => (
                      <tr key={policy.id} className={`border-b border-border/30 ${i === 0 ? 'bg-muted/10' : ''}`}>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            {i === 0 && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 font-medium">
                                wins
                              </span>
                            )}
                            <span className={`font-medium ${i === 0 ? 'text-foreground' : 'text-muted-foreground/70'}`}>
                              {policy.name}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${ACTION_CELL[action]}`}>
                            {ACTION_LABELS[action]}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-xs text-muted-foreground/50">
                          {policy.scope_all_apps
                            ? 'All apps'
                            : `${(policy.scope_app_ids ?? []).length} app${(policy.scope_app_ids ?? []).length === 1 ? '' : 's'}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* ── Coaching Template ── */}
            {result!.coachingTemplate && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-widest px-1">
                  Coaching Template
                </p>
                <CoachingPreview
                  notification={result!.coachingTemplate}
                  varValues={varValues}
                />
              </div>
            )}

            {/* ── No-rule policies (collapsible) ── */}
            {result!.noRule.length > 0 && (
              <div className="rounded-xl border border-border/40 overflow-hidden">
                <button
                  onClick={() => setShowNoRule(v => !v)}
                  className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-muted/20 transition-colors"
                >
                  <p className="text-xs font-medium text-muted-foreground/50">
                    In-scope but no rule for this cell ({result!.noRule.length})
                  </p>
                  <span className="text-muted-foreground/30 text-xs">{showNoRule ? '▲' : '▼'}</span>
                </button>
                {showNoRule && (
                  <ul className="border-t border-border/30 divide-y divide-border/20">
                    {result!.noRule.map(p => (
                      <li key={p.id} className="px-5 py-2.5 text-xs text-muted-foreground/50">
                        {p.name}
                        <span className="ml-2 text-muted-foreground/30">— no rule set for {dataTypeLabel}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* ── Out-of-scope policies (collapsible) ── */}
            {result!.outOfScope.length > 0 && (
              <div className="rounded-xl border border-border/40 overflow-hidden">
                <button
                  onClick={() => setShowOutOfScope(v => !v)}
                  className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-muted/20 transition-colors"
                >
                  <p className="text-xs font-medium text-muted-foreground/50">
                    Out-of-scope policies — don&apos;t cover {selectedApp?.app_name} ({result!.outOfScope.length})
                  </p>
                  <span className="text-muted-foreground/30 text-xs">{showOutOfScope ? '▲' : '▼'}</span>
                </button>
                {showOutOfScope && (
                  <ul className="border-t border-border/30 divide-y divide-border/20">
                    {result!.outOfScope.map(p => (
                      <li key={p.id} className="px-5 py-2.5 text-xs text-muted-foreground/50">
                        {p.name}
                        <span className="ml-2 text-muted-foreground/30">— scoped to {(p.scope_app_ids ?? []).length} specific app{(p.scope_app_ids ?? []).length === 1 ? '' : 's'}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
