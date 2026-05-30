'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { colorClasses, SYSTEM_LEVEL_META } from '@/lib/data-catalog/types'
import {
  VALID_INTENTS, INTENT_LABELS, INTENT_CHIP,
  VALID_DECISION_MODES,
  ACTIVITY_LABELS, GENAI_ACTIVITIES,
  UI_ACTION_CODES,
  uiActionToNpjMode, uiActionToFlags,
  validateNeutralPolicy,
  type NpjIntent, type NpjActivity, type UiActionCode,
} from '@/lib/genai/npj-schema'
import { upsertPolicy } from '../../actions'
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Loader2, Lock, Plus, X } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

export type RuleItemKind = 'label' | 'type' | 'catalog'

export interface RuleItem {
  key:        string
  name:       string
  kind:       RuleItemKind
  color:      string
  layer:      1 | 2 | 3
  layerLabel: string | undefined
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

export interface PolicyBriefRow {
  id:   string
  name: string
}

interface Props {
  apps:                 AppRow[]
  categories:           CategoryRow[]
  ruleItems:            RuleItem[]
  coachingTemplates:    CoachingTemplateRow[]
}

interface NpjException {
  effect: string
  reason: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ACTION_CHIP: Record<string, string> = {
  allow:        'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  monitor:      'bg-blue-500/10 text-blue-400 border-blue-500/20',
  alert:        'bg-amber-500/10 text-amber-400 border-amber-500/20',
  coach:        'bg-orange-500/10 text-orange-400 border-orange-500/20',
  'coach-ack':  'bg-orange-500/15 text-orange-300 border-orange-500/30',
  'coach-just': 'bg-amber-600/15 text-amber-300 border-amber-600/25',
  block:        'bg-red-500/10 text-red-400 border-red-500/20',
}

const ACTION_DESCRIPTIONS: Record<string, string> = {
  allow:        'Permit without restriction',
  monitor:      'Log silently — no user notification',
  alert:        'Log and notify security team',
  coach:        'Show guidance message to user',
  'coach-ack':  'Coach + user must acknowledge',
  'coach-just': 'Coach + user must justify',
  block:        'Prevent the action entirely',
}

const SEVERITY_OPTIONS = ['low', 'medium', 'high', 'critical'] as const
type Severity = typeof SEVERITY_OPTIONS[number]

const SEVERITY_CHIP: Record<Severity, string> = {
  low:      'bg-muted/40 text-muted-foreground/60 border-border/50',
  medium:   'bg-amber-500/10 text-amber-400 border-amber-500/20',
  high:     'bg-orange-500/10 text-orange-400 border-orange-500/20',
  critical: 'bg-red-500/10 text-red-400 border-red-500/20',
}

function defaultSeverity(action: UiActionCode): Severity {
  if (action === 'block') return 'high'
  if (action === 'coach-just' || action === 'coach-ack') return 'medium'
  if (action === 'coach' || action === 'alert') return 'medium'
  return 'low'
}

function defaultFlags(action: UiActionCode): { ack: boolean; just: boolean; evidence: boolean; incident: boolean } {
  const flags = uiActionToFlags(action)
  return {
    ack:      flags.require_acknowledgement,
    just:     flags.require_justification,
    evidence: action === 'block' || action.startsWith('coach'),
    incident: action === 'block',
  }
}

const FAMILY_SUGGESTIONS = ['Content Detection', 'App Governance', 'PII Protection', 'Secret / Credentials', 'Classification Labels']

const STEPS = [
  'Intent & Family',
  'Scope',
  'Detection',
  'Decision',
  'Exceptions',
  'Review & Create',
] as const

// ── Sub-components ────────────────────────────────────────────────────────────

function StepHeader({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-1 mb-6">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'h-1 rounded-full flex-1 transition-colors',
            i < current ? 'bg-foreground/70' : i === current ? 'bg-foreground/40' : 'bg-border/50',
          )}
        />
      ))}
    </div>
  )
}

function WizardCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      {children}
    </div>
  )
}

function WizardSection({ title, children, note }: { title: string; children: React.ReactNode; note?: string }) {
  return (
    <div className="space-y-2.5">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">{title}</p>
      {children}
      {note && <p className="text-[10px] text-muted-foreground/40">{note}</p>}
    </div>
  )
}

function ChipToggle({ active, label, color, onClick }: { active: boolean; label: string; color?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors',
        active
          ? color ?? 'bg-foreground/10 border-foreground/30 text-foreground'
          : 'bg-muted/20 border-border/50 text-muted-foreground/60 hover:bg-muted/40 hover:text-foreground/80',
      )}
    >
      {label}
    </button>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildConditions(keys: string[], ruleItems: RuleItem[]) {
  return keys.map(key => {
    const item = ruleItems.find(r => r.key === key)!
    const sensitivity = key.startsWith('label:')
      ? key.replace('label:', '')
      : (item.layerLabel ?? 'unknown').toLowerCase().replace(/\s+/g, '_')
    return {
      type:        'data_type' as const,
      sensitivity,
      name:        item.name,
      ...(key.startsWith('dt:')  ? { confidence: 'high' }   : {}),
      ...(key.startsWith('cat:') ? { confidence: 'medium' } : {}),
    }
  })
}

function buildNpj(state: WizardState, categories: CategoryRow[]) {
  const { require_acknowledgement: ack, require_justification: just } = uiActionToFlags(state.action)
  return {
    schema_version: '1.0',
    intent:         state.intent,
    policy_family:  state.policyFamily,
    scope: {
      activities:     [...state.activities],
      channels:       ['genai'],
      app_categories: [...state.categoryIds].map(id => {
        const c = categories.find(x => x.id === id)!
        return { id: c.id, system_tag: c.system_tag, name: c.name }
      }),
    },
    content: {
      operator:   state.operator,
      conditions: state.intent === 'govern_app_access'
        ? []
        : buildConditions([...state.dataKeys], state.ruleItems),
    },
    decision: {
      mode:                    uiActionToNpjMode(state.action),
      severity:                state.severity,
      require_acknowledgement: state.requireAck || ack,
      require_justification:   state.requireJust || just,
      preserve_evidence:       state.preserveEvidence,
      create_incident:         state.createIncident,
    },
    exceptions: state.exceptions,
    provenance: {
      generated_from:   'manual',
      source_model:     'manual-policy-intent',
      generated_at:     new Date().toISOString(),
      compiler_version: '1.0.0',
      warnings:         [] as string[],
    },
  }
}

interface WizardState {
  ruleItems:       RuleItem[]
  // step 1
  intent:          NpjIntent | ''
  policyFamily:    string
  policyName:      string
  description:     string
  // step 2
  categoryIds:     Set<string>
  specificAppIds:  Set<string>
  activities:      Set<NpjActivity>
  // step 3
  dataKeys:        Set<string>
  operator:        'OR' | 'AND'
  // step 4
  action:          UiActionCode
  severity:        Severity
  requireAck:      boolean
  requireJust:     boolean
  preserveEvidence: boolean
  createIncident:  boolean
  coachTemplateId: string
  // step 5
  exceptions:      NpjException[]
}

// ── Main Component ────────────────────────────────────────────────────────────

export function BlankPolicyWizard({ apps, categories, ruleItems, coachingTemplates }: Props) {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  const [state, setState] = useState<WizardState>({
    ruleItems,
    intent:          '',
    policyFamily:    '',
    policyName:      '',
    description:     '',
    categoryIds:     new Set(),
    specificAppIds:  new Set(),
    activities:      new Set<NpjActivity>(['prompt_submit', 'upload']),
    dataKeys:        new Set(),
    operator:        'OR',
    action:          'block',
    severity:        'high',
    requireAck:      false,
    requireJust:     false,
    preserveEvidence: true,
    createIncident:  true,
    coachTemplateId: '',
    exceptions:      [],
  })

  // derived
  const npj = state.intent ? buildNpj(state, categories) : null
  const validation = npj ? validateNeutralPolicy(npj) : { valid: false, errors: ['Select an intent to continue'] }

  // step guards
  const canProceed: boolean[] = [
    Boolean(state.intent && state.policyName.trim()),   // step 1
    true,                                                // step 2 — scope is optional
    true,                                                // step 3 — detection optional (app-access)
    Boolean(state.action),                               // step 4
    true,                                                // step 5
    validation.valid,                                    // step 6
  ]

  function update(partial: Partial<WizardState>) {
    setState(s => ({ ...s, ...partial }))
  }

  function toggleSet<T>(set: Set<T>, value: T): Set<T> {
    const next = new Set(set)
    if (next.has(value)) { next.delete(value) } else { next.add(value) }
    return next
  }

  // ── Step 1 ─────────────────────────────────────────────────────────────────

  function renderStep1() {
    return (
      <div className="space-y-6">
        <WizardSection title="Intent">
          <div className="flex flex-wrap gap-1.5">
            {VALID_INTENTS.map(intent => (
              <button
                key={intent}
                type="button"
                onClick={() => update({ intent })}
                className={cn(
                  'inline-flex items-center px-2.5 py-1 rounded-lg border text-xs font-semibold transition-colors',
                  state.intent === intent
                    ? cn(INTENT_CHIP[intent], 'ring-1 ring-offset-1 ring-offset-card ring-current/30')
                    : 'bg-muted/20 border-border/50 text-muted-foreground/60 hover:bg-muted/40 hover:text-foreground/80',
                )}
              >
                {INTENT_LABELS[intent]}
              </button>
            ))}
          </div>
        </WizardSection>

        <WizardSection title="Policy Family" note="Optional — groups related policies together">
          <input
            type="text"
            value={state.policyFamily}
            onChange={e => update({ policyFamily: e.target.value })}
            placeholder="e.g. Content Detection"
            className="block w-full max-w-sm rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-border-strong"
          />
          <div className="flex flex-wrap gap-1.5 mt-2">
            {FAMILY_SUGGESTIONS.map(s => (
              <button
                key={s}
                type="button"
                onClick={() => update({ policyFamily: s })}
                className="text-[10px] px-2 py-0.5 rounded-md border border-border/50 bg-muted/20 text-muted-foreground/60 hover:bg-muted/40 transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        </WizardSection>

        <WizardSection title="Policy Name *">
          <input
            type="text"
            value={state.policyName}
            onChange={e => update({ policyName: e.target.value })}
            placeholder="e.g. Block Confidential Data — Unapproved GenAI"
            className="block w-full rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-border-strong"
          />
        </WizardSection>

        <WizardSection title="Description">
          <textarea
            value={state.description}
            onChange={e => update({ description: e.target.value })}
            rows={2}
            placeholder="Optional — briefly describe this policy's purpose"
            className="block w-full rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-border-strong resize-none"
          />
        </WizardSection>
      </div>
    )
  }

  // ── Step 2 ─────────────────────────────────────────────────────────────────

  function renderStep2() {
    return (
      <div className="space-y-6">
        <WizardSection title="App Categories" note="Leave empty to apply to all app categories">
          <div className="flex flex-wrap gap-1.5">
            {categories.map(cat => {
              const active = state.categoryIds.has(cat.id)
              const c = colorClasses(cat.color)
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => update({ categoryIds: toggleSet(state.categoryIds, cat.id) })}
                  className={cn(
                    'inline-flex items-center px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors',
                    active
                      ? cn(c.text, c.bg, c.border)
                      : 'bg-muted/20 border-border/50 text-muted-foreground/60 hover:bg-muted/40',
                  )}
                >
                  {cat.name}
                </button>
              )
            })}
          </div>
        </WizardSection>

        <WizardSection title="Activities" note="Which GenAI actions this policy monitors">
          <div className="flex flex-wrap gap-1.5">
            {GENAI_ACTIVITIES.map(act => (
              <ChipToggle
                key={act}
                active={state.activities.has(act)}
                label={ACTIVITY_LABELS[act]}
                color="bg-blue-500/10 text-blue-400 border-blue-500/20"
                onClick={() => update({ activities: toggleSet(state.activities, act) })}
              />
            ))}
          </div>
        </WizardSection>

        <WizardSection title="Specific Apps" note="Optional — limits this policy to specific apps instead of all apps in the selected categories">
          {state.specificAppIds.size > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {[...state.specificAppIds].map(id => {
                const app = apps.find(a => a.app_id === id)
                if (!app) return null
                return (
                  <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-blue-500/30 bg-blue-500/10 text-xs text-blue-400">
                    {app.app_name}
                    <button type="button" onClick={() => update({ specificAppIds: toggleSet(state.specificAppIds, id) })}>
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )
              })}
            </div>
          )}
          <details>
            <summary className="text-xs text-muted-foreground/60 cursor-pointer hover:text-muted-foreground/80 select-none">
              + Add specific app
            </summary>
            <div className="mt-2 max-h-36 overflow-y-auto border border-border rounded-lg p-2 grid grid-cols-2 gap-1">
              {apps.map(app => (
                <label key={app.app_id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted/30 cursor-pointer text-xs text-foreground/80 transition-colors">
                  <input
                    type="checkbox"
                    checked={state.specificAppIds.has(app.app_id)}
                    onChange={() => update({ specificAppIds: toggleSet(state.specificAppIds, app.app_id) })}
                    className="accent-blue-500 w-3 h-3"
                  />
                  {app.app_name}
                </label>
              ))}
            </div>
          </details>
        </WizardSection>
      </div>
    )
  }

  // ── Step 3 ─────────────────────────────────────────────────────────────────

  function renderStep3() {
    if (state.intent === 'govern_app_access') {
      return (
        <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 px-5 py-4 text-xs text-purple-400/80 space-y-1">
          <p className="font-semibold">App Governance intent — no content detection needed</p>
          <p className="text-muted-foreground/60">This policy controls application access, not data content. The NPJ will have <span className="font-mono">content.conditions: []</span>.</p>
        </div>
      )
    }

    const layers = [1, 2, 3] as const
    const layerLabels = { 1: 'Classification Labels', 2: 'Your Data Types', 3: 'Catalog Reference' }

    return (
      <div className="space-y-5">
        <div className="flex flex-wrap gap-3 items-center">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">Data to Detect</p>
          {state.dataKeys.size >= 2 && (
            <div className="flex items-center gap-1.5 ml-auto">
              <span className="text-[10px] text-muted-foreground/50">Operator:</span>
              {(['OR', 'AND'] as const).map(op => (
                <button
                  key={op}
                  type="button"
                  onClick={() => update({ operator: op })}
                  className={cn(
                    'text-[10px] px-2 py-0.5 rounded border font-mono transition-colors',
                    state.operator === op
                      ? 'bg-foreground/10 border-foreground/30 text-foreground'
                      : 'bg-muted/20 border-border/50 text-muted-foreground/50 hover:bg-muted/40',
                  )}
                >
                  {op}
                </button>
              ))}
            </div>
          )}
        </div>

        {layers.map(layer => {
          const items = ruleItems.filter(r => r.layer === layer)
          if (!items.length) return null
          return (
            <div key={layer}>
              <p className="text-[10px] text-muted-foreground/40 mb-1.5">{layerLabels[layer]}</p>
              <div className="flex flex-wrap gap-1.5">
                {items.map(item => {
                  const active = state.dataKeys.has(item.key)
                  const c = colorClasses(item.color)
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => update({ dataKeys: toggleSet(state.dataKeys, item.key) })}
                      className={cn(
                        'inline-flex items-center px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors',
                        active
                          ? cn(c.text, c.bg, c.border)
                          : 'bg-muted/20 border-border/50 text-muted-foreground/60 hover:bg-muted/40',
                      )}
                    >
                      {item.name}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}

        {state.dataKeys.size === 0 && (
          <p className="text-[10px] text-amber-400/70">No detection conditions selected — this policy will have empty content conditions.</p>
        )}
      </div>
    )
  }

  // ── Step 4 ─────────────────────────────────────────────────────────────────

  function renderStep4() {
    const isCoach = state.action.startsWith('coach')
    return (
      <div className="space-y-6">
        <WizardSection title="Action">
          <div className="space-y-2">
            {UI_ACTION_CODES.map(code => (
              <button
                key={code}
                type="button"
                onClick={() => {
                  const defs = defaultFlags(code)
                  update({
                    action:          code,
                    severity:        defaultSeverity(code),
                    requireAck:      defs.ack,
                    requireJust:     defs.just,
                    preserveEvidence: defs.evidence,
                    createIncident:  defs.incident,
                  })
                }}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2 rounded-lg border text-left transition-colors',
                  state.action === code
                    ? cn(ACTION_CHIP[code], 'ring-1 ring-current/30 ring-offset-1 ring-offset-card')
                    : 'bg-muted/10 border-border/40 hover:bg-muted/30',
                )}
              >
                <span className={cn(
                  'text-xs font-semibold w-20 shrink-0',
                  state.action === code ? '' : 'text-muted-foreground/60',
                )}>
                  {code}
                </span>
                <span className="text-xs text-muted-foreground/50">{ACTION_DESCRIPTIONS[code]}</span>
              </button>
            ))}
          </div>
        </WizardSection>

        <WizardSection title="Severity">
          <div className="flex gap-1.5">
            {SEVERITY_OPTIONS.map(s => (
              <button
                key={s}
                type="button"
                onClick={() => update({ severity: s })}
                className={cn(
                  'px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors',
                  state.severity === s
                    ? SEVERITY_CHIP[s]
                    : 'bg-muted/20 border-border/50 text-muted-foreground/60 hover:bg-muted/40',
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </WizardSection>

        <WizardSection title="Flags">
          <div className="space-y-2">
            {[
              { key: 'preserveEvidence', label: 'Preserve Evidence',    desc: 'Capture content for incident review' },
              { key: 'createIncident',   label: 'Create Incident',      desc: 'Open an incident in the SIEM/SOC queue' },
              { key: 'requireAck',       label: 'Require Acknowledgement', desc: 'User must acknowledge the coaching message' },
              { key: 'requireJust',      label: 'Require Justification', desc: 'User must provide a justification text' },
            ].map(({ key, label, desc }) => {
              const val = state[key as keyof WizardState] as boolean
              const disabled = (key === 'requireAck' || key === 'requireJust') && !isCoach
              return (
                <label
                  key={key}
                  className={cn('flex items-center gap-3 cursor-pointer group', disabled && 'opacity-40 cursor-not-allowed')}
                >
                  <input
                    type="checkbox"
                    checked={val}
                    disabled={disabled}
                    onChange={e => update({ [key]: e.target.checked } as Partial<WizardState>)}
                    className="accent-blue-500 w-3.5 h-3.5 mt-0.5"
                  />
                  <div>
                    <p className="text-xs font-medium text-foreground/80">{label}</p>
                    <p className="text-[10px] text-muted-foreground/50">{desc}</p>
                  </div>
                </label>
              )
            })}
          </div>
        </WizardSection>

        {isCoach && coachingTemplates.length > 0 && (
          <WizardSection title="Coaching Template">
            <select
              value={state.coachTemplateId}
              onChange={e => update({ coachTemplateId: e.target.value })}
              className="block w-full max-w-xs rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-xs text-foreground focus:outline-none"
            >
              <option value="">None</option>
              {coachingTemplates.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </WizardSection>
        )}
      </div>
    )
  }

  // ── Step 5 ─────────────────────────────────────────────────────────────────

  const [exEffect, setExEffect] = useState('allow')
  const [exReason, setExReason] = useState('')

  function renderStep5() {
    return (
      <div className="space-y-5">
        <WizardSection title="Exceptions" note="Exceptions allow specific conditions to bypass this policy">
          {state.exceptions.length === 0 && (
            <p className="text-xs text-muted-foreground/40 italic">No exceptions — all matching content will be enforced.</p>
          )}
          <div className="space-y-2">
            {state.exceptions.map((ex, i) => (
              <div key={i} className="flex items-start gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2">
                <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded border shrink-0', ACTION_CHIP[ex.effect] ?? 'bg-muted/40 border-border text-muted-foreground')}>
                  {ex.effect}
                </span>
                <span className="text-xs text-foreground/70 flex-1">{ex.reason}</span>
                <button
                  type="button"
                  onClick={() => update({ exceptions: state.exceptions.filter((_, j) => j !== i) })}
                  className="text-muted-foreground/40 hover:text-foreground/70 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex items-end gap-2 mt-3">
            <div className="space-y-1">
              <p className="text-[10px] text-muted-foreground/40">Effect</p>
              <div className="flex gap-1">
                {(['allow', 'monitor', 'coach'] as const).map(e => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setExEffect(e)}
                    className={cn(
                      'px-2 py-0.5 rounded border text-[10px] font-medium transition-colors',
                      exEffect === e ? ACTION_CHIP[e] : 'bg-muted/20 border-border/50 text-muted-foreground/50',
                    )}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 space-y-1">
              <p className="text-[10px] text-muted-foreground/40">Reason</p>
              <input
                type="text"
                value={exReason}
                onChange={e => setExReason(e.target.value)}
                placeholder="e.g. Approved security scanning tool"
                className="block w-full rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-xs text-foreground focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                if (!exReason.trim()) return
                update({ exceptions: [...state.exceptions, { effect: exEffect, reason: exReason.trim() }] })
                setExReason('')
              }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border bg-muted/30 text-xs font-medium text-foreground/70 hover:bg-muted/50 transition-colors shrink-0"
            >
              <Plus className="h-3 w-3" /> Add
            </button>
          </div>
        </WizardSection>
      </div>
    )
  }

  // ── Step 6 ─────────────────────────────────────────────────────────────────

  const [jsonOpen, setJsonOpen] = useState(false)

  function renderStep6() {
    if (!npj) return <p className="text-xs text-muted-foreground/40">Return to Step 1 to select an intent.</p>
    const valid = validateNeutralPolicy(npj)
    return (
      <div className="space-y-4">
        {!valid.valid && (
          <div className="rounded-lg border border-red-500/25 bg-red-500/8 px-4 py-3 text-xs text-red-400 space-y-1">
            <p className="font-semibold flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5" /> Policy cannot be created — fix these issues:</p>
            <ul className="list-disc list-inside space-y-0.5 text-red-400/80">
              {valid.errors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          </div>
        )}

        {/* Summary rows */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {[
            { label: 'Name',        value: state.policyName },
            { label: 'Intent',      value: INTENT_LABELS[state.intent as NpjIntent] ?? state.intent },
            { label: 'Family',      value: state.policyFamily || '—' },
            { label: 'Activities',  value: [...state.activities].map(a => ACTIVITY_LABELS[a]).join(', ') || '—' },
            { label: 'Detection',   value: state.intent === 'govern_app_access' ? 'App-level only' : (state.dataKeys.size ? `${state.dataKeys.size} condition(s)` : 'None') },
            { label: 'Decision',    value: `${state.action} · ${state.severity} severity` },
            { label: 'Exceptions',  value: state.exceptions.length ? `${state.exceptions.length}` : 'None' },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-start gap-0 px-5 py-2.5 border-b border-border/40 last:border-0">
              <span className="w-28 shrink-0 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40 pt-0.5">{label}</span>
              <span className="text-xs text-foreground/80">{value}</span>
            </div>
          ))}
        </div>

        {/* JSON preview */}
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

        {saveError && (
          <div className="flex items-center gap-2 rounded-lg border border-red-500/25 bg-red-500/8 px-4 py-2.5 text-xs text-red-400">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {saveError}
          </div>
        )}
      </div>
    )
  }

  // ── Navigation ────────────────────────────────────────────────────────────

  async function handleCreate() {
    if (!npj || !validation.valid) return
    setSaving(true)
    setSaveError('')
    const res = await upsertPolicy(null, {
      name:                   state.policyName.trim(),
      description:            state.description.trim() || undefined,
      is_active:              true,
      approval_status:        'draft',
      vendor_translation_status: 'pending',
      generated_from:         'manual',
      policy_family:          state.policyFamily || null,
      coaching_template_id:   state.coachTemplateId || null,
      scope_app_ids:          [...state.specificAppIds],
      neutral_policy_json:    npj as Record<string, unknown>,
    })
    setSaving(false)
    if (res.error) { setSaveError(res.error); return }
    if (res.id) {
      router.push(`/genai-controls/policies/${res.id}/edit`)
    } else {
      router.push('/genai-controls/policies')
    }
  }

  const stepRenderers = [renderStep1, renderStep2, renderStep3, renderStep4, renderStep5, renderStep6]
  const isLastStep = step === STEPS.length - 1
  const isGovernAppAccess = state.intent === 'govern_app_access'

  return (
    <WizardCard>
      <div className="px-6 py-5 border-b border-border/50 bg-muted/5">
        <StepHeader current={step} total={STEPS.length} />
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40 mb-0.5">
              Step {step + 1} of {STEPS.length}
            </p>
            <h2 className="text-base font-bold text-foreground">{STEPS[step]}</h2>
          </div>
          {step === 2 && isGovernAppAccess && (
            <span className="inline-flex items-center gap-1 text-[10px] text-purple-400/70">
              <Lock className="h-2.5 w-2.5" /> App governance — no content detection
            </span>
          )}
        </div>
      </div>

      <div className="px-6 py-5">
        {stepRenderers[step]()}
      </div>

      <div className="flex items-center justify-between px-6 py-4 border-t border-border/40 bg-muted/5">
        <button
          type="button"
          onClick={() => step > 0 ? setStep(s => s - 1) : router.push('/genai-controls/policies')}
          className="flex items-center gap-1 text-xs font-medium text-muted-foreground/70 hover:text-foreground/80 transition-colors"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          {step === 0 ? 'Cancel' : 'Back'}
        </button>

        <div className="flex items-center gap-2">
          {step === 4 && (
            <button
              type="button"
              onClick={() => setStep(5)}
              className="text-xs text-muted-foreground/60 hover:text-foreground/70 transition-colors"
            >
              Skip — no exceptions
            </button>
          )}
          {!isLastStep ? (
            <button
              type="button"
              onClick={() => setStep(s => s + 1)}
              disabled={!canProceed[step]}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-foreground text-background text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              Next <ChevronRight className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleCreate}
              disabled={saving || !validation.valid}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-foreground text-background text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
              Create Policy
            </button>
          )}
        </div>
      </div>
    </WizardCard>
  )
}
