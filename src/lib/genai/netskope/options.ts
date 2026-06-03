// Phase 2: Netskope Topology Option Generator
// Produces Consolidated and Per-Risk-Family alternatives from the same
// category buckets used by the Hybrid (Phase 1) builder.

import { RISK_FAMILIES } from '@/lib/shared/risk-families'
import {
  collectRequiredObjects,
  buildContinuePolicyEvaluation,
  type BuildTopologyInput,
} from './topology'
import type {
  NetskopePolicy, NetskopeProfileEntry, NetskopeRecommendation,
  TopologyMode, TopologyOptionSummary, RequiredObjects, RecommendationIssue,
} from './types'
import type { TransposedProfile } from './types'

// ── Action priority — block is strictest ─────────────────────────────────────

export const ACTION_PRIORITY: Record<string, number> = {
  allow:        1,
  monitor:      2,
  alert:        3,
  coach:        4,
  'coach-ack':  5,
  'coach-just': 6,
  block:        7,
}

export function resolveStrictestAction(actions: string[]): string {
  if (actions.length === 0) return 'alert'
  return actions.reduce((strictest, current) =>
    (ACTION_PRIORITY[current] ?? 0) > (ACTION_PRIORITY[strictest] ?? 0) ? current : strictest
  )
}

// ── Confidence threshold (same as Phase 1) ───────────────────────────────────

function toConfidence(score: number): 'high' | 'medium' | 'low' {
  return score >= 85 ? 'high' : score >= 70 ? 'medium' : 'low'
}

// ── Collect all distinct profile_type:risk_family_key pairs from buckets ─────
// Dedup key is profile_type + risk_family_key to preserve separate entries for
// content_detection vs classification_label even when labels match.

interface DeduplicatedProfile {
  dedup_key:         string
  risk_family_key:   string
  risk_family_label: string
  profile_type:      TransposedProfile['profile_type']
  actions:           string[]
  coaching:          string | null
}

function collectDedupedProfiles(
  buckets: BuildTopologyInput['buckets'],
): DeduplicatedProfile[] {
  const map = new Map<string, DeduplicatedProfile>()

  for (const profiles of Object.values(buckets)) {
    for (const p of profiles) {
      const key = `${p.profile_type}:${p.risk_family_key}`
      const existing = map.get(key)
      if (existing) {
        existing.actions.push(p.action)
      } else {
        map.set(key, {
          dedup_key:         key,
          risk_family_key:   p.risk_family_key,
          risk_family_label: p.risk_family_label,
          profile_type:      p.profile_type,
          actions:           [p.action],
          coaching:          p.coaching_template_id,
        })
      }
    }
  }

  return [...map.values()]
}

// ── Sort by canonical RISK_FAMILIES order, unknowns appended alphabetically ──

const RF_ORDER = new Map<string, number>(RISK_FAMILIES.map((rf, i) => [rf.id, i]))

function sortDedupedProfiles(profiles: DeduplicatedProfile[]): DeduplicatedProfile[] {
  return [...profiles].sort((a, b) => {
    const ia = RF_ORDER.get(a.risk_family_key) ?? 999
    const ib = RF_ORDER.get(b.risk_family_key) ?? 999
    if (ia !== ib) return ia - ib
    return a.dedup_key.localeCompare(b.dedup_key)
  })
}

// ── Extract P100 and P200 from hybrid policies ───────────────────────────────

function extractBaselinePolicies(hybridPolicies: NetskopePolicy[]): NetskopePolicy[] {
  return hybridPolicies.filter(p => p.priority === 100 || p.priority === 200)
}

// ── Consolidated topology builder ────────────────────────────────────────────

function buildConsolidatedTopology(
  input: BuildTopologyInput,
  hybridPolicies: NetskopePolicy[],
): { policies: NetskopePolicy[]; issues: RecommendationIssue[] } {
  const baseline = extractBaselinePolicies(hybridPolicies)
  const issues: RecommendationIssue[] = []

  const deduped = sortDedupedProfiles(collectDedupedProfiles(input.buckets))

  if (deduped.length === 0) {
    issues.push({
      code:        'NO_DLP_PROFILES_FOR_TOPOLOGY',
      severity:    'warning',
      description: 'No DLP profiles available for consolidated topology — all actions are Allow.',
      fix:         'Review the Control Matrix and ensure at least one risk family has a non-Allow action.',
    })
    return { policies: baseline, issues }
  }

  const profiles: NetskopeProfileEntry[] = deduped.map(d => ({
    profile:           d.risk_family_label,
    profile_type:      d.profile_type,
    profile_action:    resolveStrictestAction(d.actions),
    coaching_template: d.coaching ?? null,
  }))

  const consolidated: NetskopePolicy = {
    priority:    500,
    policy_key:  'netskope:consolidated_all_categories',
    name:        'GenAI — All Categories — Consolidated DLP',
    policy_type: 'realtime_protection',
    destination: {
      strategy:        'app_category',
      tag_or_category: 'Generative AI',
      note:            'Covers all GenAI categories — strictest action per risk family applied globally',
    },
    source:          { type: 'all_users', value: null },
    activities:      ['post', 'upload', 'prompt_submit'],
    profiles,
    no_match_action: 'alert',
    continue_policy_evaluation: null,
    notification:    null,
  }

  return { policies: [...baseline, consolidated], issues }
}

// ── Per-risk-family topology builder ─────────────────────────────────────────

function buildPerRiskFamilyTopology(
  input: BuildTopologyInput,
  hybridPolicies: NetskopePolicy[],
): { policies: NetskopePolicy[]; issues: RecommendationIssue[] } {
  const baseline = extractBaselinePolicies(hybridPolicies)
  const issues: RecommendationIssue[] = []

  const deduped = sortDedupedProfiles(collectDedupedProfiles(input.buckets))

  if (deduped.length === 0) {
    issues.push({
      code:        'NO_DLP_PROFILES_FOR_TOPOLOGY',
      severity:    'warning',
      description: 'No DLP profiles available for per-risk-family topology — all actions are Allow.',
      fix:         'Review the Control Matrix and ensure at least one risk family has a non-Allow action.',
    })
    return { policies: baseline, issues }
  }

  const rfPolicies: NetskopePolicy[] = deduped.map((d, i) => {
    const action  = resolveStrictestAction(d.actions)
    const profile: NetskopeProfileEntry = {
      profile:           d.risk_family_label,
      profile_type:      d.profile_type,
      profile_action:    action,
      coaching_template: d.coaching ?? null,
    }
    return {
      priority:    300 + i * 10,
      policy_key:  `netskope:rf:${d.profile_type}:${d.risk_family_key}`,
      name:        `GenAI — ${d.risk_family_label} — Global`,
      policy_type: 'realtime_protection',
      destination: {
        strategy:        'app_category',
        tag_or_category: 'Generative AI',
        note:            null,
      },
      source:          { type: 'all_users', value: null },
      activities:      ['post', 'upload', 'prompt_submit'],
      profiles:        [profile],
      no_match_action: null,
      continue_policy_evaluation: {
        recommended:  false,
        applies_when: 'No match for this risk family — continue to next policy.',
        limitation:   'No match on this policy = no decision / pass-through to next risk-family policy.',
      },
      notification: null,
    }
  })

  // P900 fallback — pure visibility catch-all after all per-family policies
  const fallback: NetskopePolicy = {
    priority:    900,
    policy_key:  'netskope:per_rf_fallback',
    name:        'GenAI — General Fallback Visibility',
    policy_type: 'realtime_protection',
    destination: {
      strategy:        'app_category',
      tag_or_category: 'Generative AI',
      note:            'Catch-all — alerts on any GenAI traffic not matched by a risk-family policy above',
    },
    source:          { type: 'all_users', value: null },
    activities:      ['post', 'upload', 'prompt_submit'],
    profiles:        [],
    no_match_action: 'alert',
    continue_policy_evaluation: null,
    notification:    null,
  }

  return { policies: [...baseline, ...rfPolicies, fallback], issues }
}

// ── Static trade-offs ─────────────────────────────────────────────────────────

const TRADE_OFFS: Record<TopologyMode, { pro: string; con: string }[]> = {
  hybrid_category_based: [
    { pro: 'Per-category control — tune Approved & Supported vs Restricted independently', con: 'More Netskope policies to configure and maintain' },
  ],
  consolidated: [
    { pro: 'Fewest policies — simplest Netskope configuration', con: 'No per-category differentiation — strictest action applied to all app categories' },
  ],
  per_risk_family: [
    { pro: 'Best incident reporting — each Netskope alert shows the triggering risk family', con: 'Most policies to manage — correct ordering is critical' },
  ],
}

// ── Main generator ────────────────────────────────────────────────────────────

export function generateTopologyOptions(
  input: BuildTopologyInput,
  hybridResult: Omit<NetskopeRecommendation, 'skipped_policies' | 'limitations' | 'inline_file_size_limit_mb' | 'topology_options'>,
): TopologyOptionSummary[] {
  // Option 1: Hybrid — zero recomputation, reuse Phase 1 output directly
  const hybridOption: TopologyOptionSummary = {
    mode:             'hybrid_category_based',
    label:            'Hybrid Category-Based',
    score:            hybridResult.score,
    confidence:       hybridResult.confidence,
    policy_count:     hybridResult.recommended_policies.length,
    trade_offs:       TRADE_OFFS.hybrid_category_based,
    recommended:      false,
    policies:         hybridResult.recommended_policies,
    required_objects: hybridResult.required_objects,
  }

  // Option 2: Consolidated
  const { policies: consolidatedPolicies } = buildConsolidatedTopology(input, hybridResult.recommended_policies)
  const consolidatedScore = Math.max(50, hybridResult.score - 10)
  const consolidatedOption: TopologyOptionSummary = {
    mode:             'consolidated',
    label:            'Consolidated',
    score:            consolidatedScore,
    confidence:       toConfidence(consolidatedScore),
    policy_count:     consolidatedPolicies.length,
    trade_offs:       TRADE_OFFS.consolidated,
    recommended:      false,
    policies:         consolidatedPolicies,
    required_objects: collectRequiredObjects(consolidatedPolicies),
  }

  // Option 3: Per-Risk-Family
  const { policies: perRfPolicies } = buildPerRiskFamilyTopology(input, hybridResult.recommended_policies)
  const perRfScore = Math.max(50, hybridResult.score - 5)
  const perRfOption: TopologyOptionSummary = {
    mode:             'per_risk_family',
    label:            'Per Risk Family',
    score:            perRfScore,
    confidence:       toConfidence(perRfScore),
    policy_count:     perRfPolicies.length,
    trade_offs:       TRADE_OFFS.per_risk_family,
    recommended:      false,
    policies:         perRfPolicies,
    required_objects: collectRequiredObjects(perRfPolicies),
  }

  const options = [hybridOption, consolidatedOption, perRfOption]

  // Mark the highest-scoring option as recommended; ties go to hybrid (first)
  const maxScore = Math.max(...options.map(o => o.score))
  const recommended = options.find(o => o.score === maxScore) ?? options[0]
  recommended.recommended = true

  return options
}
