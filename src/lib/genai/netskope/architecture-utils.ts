// Netskope architecture helpers — used by both the GenAI Architecture Map
// and the Netskope Policy Flow diagram. Kept in lib/genai/netskope so both
// app routes can import without cross-folder dependency issues.

import type { NetskopeRecommendation } from './types'

// ── Slot status ───────────────────────────────────────────────────────────────

export const ISSUE_TO_KEY: Record<string, string> = {
  'PROHIBITED_TAG_MISSING':  'netskope:prohibited_access_block',
  'NO_ALWAYS_BLOCK_PROFILE': 'netskope:always_block_global_dlp',
  'RESTRICTED_BUCKET_EMPTY': 'netskope:restricted_unassessed',
}

export type SlotStatus = 'configured' | 'warning' | 'missing'

export function getSlotStatus(policyKey: string, rec: NetskopeRecommendation): SlotStatus {
  const found = rec.recommended_policies.find(p => p.policy_key === policyKey)
  if (!found) return 'missing'
  return rec.issues.some(i => ISSUE_TO_KEY[i.code] === policyKey) ? 'warning' : 'configured'
}

// ── Coverage derivation (Netskope view) ───────────────────────────────────────

export type CoverageLevel = 'full' | 'partial' | 'gap' | 'static'

export interface ChannelCoverage {
  label:      string
  level:      CoverageLevel
  note?:      string   // limitation chip text (shown for Gap rows)
  isStatic?:  boolean  // true = no live Netskope data available in V1
}

export function deriveChannelCoverage(rec: NetskopeRecommendation): ChannelCoverage[] {
  const policies = rec.recommended_policies

  // P300, P400, P900 configured?
  const p300 = getSlotStatus('netskope:approved_supported',       rec)
  const p400 = getSlotStatus('netskope:approved_with_conditions', rec)
  const p900 = getSlotStatus('netskope:restricted_unassessed',    rec)
  const p200 = getSlotStatus('netskope:always_block_global_dlp',  rec)

  const hasContentDetection = policies.some(p =>
    p.profiles.some(pr => pr.profile_type === 'content_detection')
  )
  const hasFilenameDetection = policies.some(p =>
    p.profiles.some(pr => pr.profile_type === 'filename_detection')
  )
  const hasLabelDetection = policies.some(p =>
    p.profiles.some(pr => pr.profile_type === 'classification_label')
  )

  // Web / Inline: Full if P300+P400+P900 all configured; Partial if some; Gap if none
  const webLevel: CoverageLevel =
    p300 === 'configured' && p400 === 'configured' && p900 === 'configured' ? 'full'
    : p300 !== 'missing' || p400 !== 'missing'                              ? 'partial'
    :                                                                          'gap'

  // Secrets: Full if P200 configured+no warning; Partial if warning; Gap if missing
  const secretsLevel: CoverageLevel =
    p200 === 'configured' ? 'full' :
    p200 === 'warning'    ? 'partial' :
                            'gap'

  // Content detection (prompts/files)
  const contentLevel: CoverageLevel = hasContentDetection ? 'full' : 'gap'

  // Filename detection (browser upload control)
  const filenameLevel: CoverageLevel = hasFilenameDetection ? 'full' : 'gap'

  // Label detection — gap (not partial) when none configured
  const labelLevel: CoverageLevel = hasLabelDetection ? 'full' : 'gap'

  return [
    { label: 'Web / Inline GenAI Control',      level: webLevel },
    { label: 'SaaS API Scan',                   level: 'partial', isStatic: true, note: 'API / At-rest scanning — V1 static' },
    { label: 'Endpoint DLP',                    level: 'partial', isStatic: true, note: 'Endpoint-only controls — V1 static' },
    { label: 'Browser Upload Control',          level: filenameLevel },
    { label: 'Prompt / File Inspection',        level: contentLevel },
    { label: 'Response Inspection',             level: 'gap',    note: 'Response-side inspection is not modeled in Effata V1' },
    { label: 'Secrets / Source-Code Detection', level: secretsLevel },
    { label: 'Classification-Label Checks',     level: labelLevel },
  ]
}
