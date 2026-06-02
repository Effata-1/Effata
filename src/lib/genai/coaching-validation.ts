import type { ControlType } from './types'

// Maps UI action code → the only valid template control_type(s).
// allow/monitor/alert must have null template (no user-facing notification).
// 'coach' and 'not-set' are legacy/unresolved — treated as no template allowed.
export const COMPATIBLE_CONTROL_TYPES: Record<string, ControlType[]> = {
  'allow':      [],
  'monitor':    [],
  'alert':      [],
  'coach-ack':  ['coach_acknowledge'],
  'coach-just': ['coach_justification'],
  'block':      ['block'],
  'not-set':    [],
  'coach':      [],
}

export function validateActionTemplate(
  actionCode: string,
  controlType: ControlType | null | undefined,
): { valid: boolean; reason?: string } {
  const allowed = COMPATIBLE_CONTROL_TYPES[actionCode]
  if (!allowed) return { valid: false, reason: `Unknown action code: ${actionCode}` }

  if (allowed.length === 0) {
    if (controlType) {
      return { valid: false, reason: `Action '${actionCode}' must not have a coaching template.` }
    }
    return { valid: true }
  }

  if (!controlType) {
    return { valid: false, reason: `Action '${actionCode}' requires a coaching template (control_type: '${allowed[0]}').` }
  }

  if (!allowed.includes(controlType)) {
    return {
      valid:  false,
      reason: `Action '${actionCode}' requires control_type '${allowed[0]}', but template has '${controlType}'.`,
    }
  }

  return { valid: true }
}
