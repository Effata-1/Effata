// Canonical Neutral Policy JSON schema — shared between client and server.
// This is the single source of truth for valid NPJ values.
// Import from here whenever you need to validate, display, or construct an NPJ.

// ── Canonical intent values ───────────────────────────────────────────────────

export const VALID_INTENTS = [
  'prevent_exfiltration',
  'detect_only',
  'coach_user',
  'allow_approved_use',
  'govern_app_access',
  'label_or_classify',
  'govern_data_at_rest',
] as const

export type NpjIntent = typeof VALID_INTENTS[number]

export const INTENT_LABELS: Record<NpjIntent, string> = {
  prevent_exfiltration: 'Prevent Exfiltration',
  detect_only:          'Detect Only',
  coach_user:           'Coach User',
  allow_approved_use:   'Allow Approved Use',
  govern_app_access:    'Govern App Access',
  label_or_classify:    'Label / Classify',
  govern_data_at_rest:  'Govern Data at Rest',
}

export const INTENT_CHIP: Record<NpjIntent, string> = {
  prevent_exfiltration: 'bg-red-500/10 text-red-400 border-red-500/20',
  detect_only:          'bg-blue-500/10 text-blue-400 border-blue-500/20',
  coach_user:           'bg-orange-500/10 text-orange-400 border-orange-500/20',
  allow_approved_use:   'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  govern_app_access:    'bg-purple-500/10 text-purple-400 border-purple-500/20',
  label_or_classify:    'bg-amber-500/10 text-amber-400 border-amber-500/20',
  govern_data_at_rest:  'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
}

// ── Canonical decision.mode values ────────────────────────────────────────────
// coach-ack and coach-just are UI-only codes; they decompose to mode:'coach' + flags.

export const VALID_DECISION_MODES = ['allow', 'monitor', 'alert', 'coach', 'block'] as const
export type NpjDecisionMode = typeof VALID_DECISION_MODES[number]

// UI action codes (superset — includes coach-ack / coach-just for display purposes)
export const UI_ACTION_CODES = ['allow', 'monitor', 'alert', 'coach', 'coach-ack', 'coach-just', 'block'] as const
export type UiActionCode = typeof UI_ACTION_CODES[number]

export function uiActionToNpjMode(code: UiActionCode): NpjDecisionMode {
  if (code === 'coach-ack' || code === 'coach-just') return 'coach'
  return code as NpjDecisionMode
}

export function uiActionToFlags(code: UiActionCode): {
  require_acknowledgement: boolean
  require_justification:   boolean
} {
  return {
    require_acknowledgement: code === 'coach-ack' || code === 'coach-just',
    require_justification:   code === 'coach-just',
  }
}

// ── Canonical activity values ─────────────────────────────────────────────────

export const VALID_ACTIVITIES = [
  'browse',
  'login',
  'post',
  'prompt_submit',
  'upload',
  'download',
  'response',
  'share',
  'copy_paste',
  'print',
  'email_send',
] as const

export type NpjActivity = typeof VALID_ACTIVITIES[number]

export const ACTIVITY_LABELS: Record<NpjActivity, string> = {
  browse:        'Browse',
  login:         'Login',
  post:          'Post',
  prompt_submit: 'Prompt Submit',
  upload:        'Upload',
  download:      'Download',
  response:      'Response',
  share:         'Share',
  copy_paste:    'Copy / Paste',
  print:         'Print',
  email_send:    'Email Send',
}

// Activities shown in GenAI policy controls — share/copy_paste/print/email_send are endpoint/email
// channel activities, not applicable to GenAI apps.
export const GENAI_ACTIVITIES: NpjActivity[] = [
  'browse', 'login', 'post', 'prompt_submit', 'upload', 'download', 'response',
]

// Activities for govern_app_access intent (app-level access block — no data detection)
export const APP_ACCESS_ACTIVITIES: NpjActivity[] = ['browse', 'login']

// ── Canonical condition types ─────────────────────────────────────────────────

export const VALID_CONDITION_TYPES = ['data_type', 'classification_label', 'filename'] as const
export type NpjConditionType = typeof VALID_CONDITION_TYPES[number]

// ── Canonical content.operator values ────────────────────────────────────────

export const VALID_OPERATORS = ['any', 'all'] as const
export type NpjOperator = typeof VALID_OPERATORS[number]

// ── Validation ─────────────────────────────────────────────────────────────────

export interface NpjValidationResult {
  valid:  boolean
  errors: string[]
}

export function validateNeutralPolicy(npj: unknown): NpjValidationResult {
  const errors: string[] = []

  if (!npj || typeof npj !== 'object') {
    return { valid: false, errors: ['NPJ is not an object'] }
  }

  const n = npj as Record<string, unknown>

  if (n.schema_version !== '1.0') {
    errors.push('schema_version must be "1.0"')
  }

  if (!VALID_INTENTS.includes(n.intent as NpjIntent)) {
    errors.push(`Invalid intent: "${n.intent}". Must be one of: ${VALID_INTENTS.join(', ')}`)
  }

  if (!n.decision || typeof n.decision !== 'object') {
    errors.push('Missing decision object')
  } else {
    const dec = n.decision as Record<string, unknown>
    if (!VALID_DECISION_MODES.includes(dec.mode as NpjDecisionMode)) {
      errors.push(`Invalid decision.mode: "${dec.mode}". Must be one of: ${VALID_DECISION_MODES.join(', ')}`)
    }
  }

  const scope = (n.scope ?? {}) as Record<string, unknown>
  for (const a of (scope.activities ?? []) as unknown[]) {
    if (!VALID_ACTIVITIES.includes(a as NpjActivity)) {
      errors.push(`Invalid activity: "${a}"`)
    }
  }

  const content = (n.content ?? {}) as Record<string, unknown>
  if (content.operator !== undefined && !VALID_OPERATORS.includes(content.operator as NpjOperator)) {
    errors.push(`Invalid content.operator: "${content.operator}". Must be 'any' or 'all'`)
  }
  for (const c of (content.conditions ?? []) as Array<Record<string, unknown>>) {
    if (!VALID_CONDITION_TYPES.includes(c.type as NpjConditionType)) {
      errors.push(`Invalid condition type: "${c.type}"`)
    }
  }

  return { valid: errors.length === 0, errors }
}

// ── Proposal validation (two-level: wrapper shape + deep NPJ) ────────────────

export interface ProposalValidationResult {
  valid:  boolean
  errors: string[]
}

export function validatePolicyProposal(proposal: unknown): ProposalValidationResult {
  const errors: string[] = []

  if (!proposal || typeof proposal !== 'object') {
    return { valid: false, errors: ['proposal is not an object'] }
  }

  const p = proposal as Record<string, unknown>

  if (!p.name || typeof p.name !== 'string' || !p.name.trim()) {
    errors.push('Missing proposal.name')
  }
  if (typeof p.description !== 'string') {
    errors.push('Missing proposal.description')
  }
  if (!p.npj || typeof p.npj !== 'object') {
    errors.push('Missing proposal.npj')
  }
  if (!Array.isArray(p.sourceImpact)) {
    errors.push('Missing proposal.sourceImpact array')
  }
  if (!Array.isArray(p.translationImpact)) {
    errors.push('Missing proposal.translationImpact array')
  }

  if (errors.length > 0) return { valid: false, errors }

  const npjResult = validateNeutralPolicy(p.npj)
  return { valid: npjResult.valid, errors: npjResult.errors }
}

// ── generated_from registry ────────────────────────────────────────────────────

export const GENERATED_FROM_LABELS: Record<string, string> = {
  'recommended': 'Recommended',
  'manual':      'Manual',
}
