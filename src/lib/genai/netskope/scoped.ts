// Phase 3: Scoped NPJ Detection and Policy Builder
// Detects NPJs with custom source/destination scope and builds Netskope policies
// at P210–P290 (before the broad category policies at P300+).

import { collectRequiredObjects, buildContinuePolicyEvaluation } from './topology'
import { resolveStrictestAction } from './options'
import type {
  NetskopePolicy, NetskopeProfileEntry, NpjProfileType,
  RequiredObjects, RecommendationIssue,
  ScopedNpjInput, ScopedPoliciesResult,
  NpjScopeSource, NpjScopeDestination,
} from './types'

// ── Constants ─────────────────────────────────────────────────────────────────

const SCOPED_POLICY_MAX    = 8
const SCOPED_PRIORITY_START = 210
const SCOPED_PRIORITY_STEP  = 10

// Mirrors FAMILY_TO_PROFILE_TYPE in transpose.ts — kept local to avoid circular imports.
const FAMILY_TO_PROFILE_TYPE: Record<string, NpjProfileType> = {
  genai_content_detection: 'content_detection',
  genai_label_detection:   'classification_label',
  genai_filename:          'filename_detection',
  genai_filetype:          'filetype_detection',
}

// ── Detection ─────────────────────────────────────────────────────────────────

interface RawScope {
  users?:          unknown
  groups?:         unknown
  activities?:     unknown
  app_instances?:  unknown
  source?: {
    type?:  unknown
    value?: unknown
  }
  destination?: {
    type?:      unknown
    value?:     unknown
    app?:       unknown
    instance?:  unknown
  }
}

function getRawScope(rawNpj: Record<string, unknown>): RawScope {
  return (rawNpj.scope ?? {}) as RawScope
}

function isScoped(s: RawScope): boolean {
  const srcType = s.source?.type
  if (srcType === 'ad_group' || srcType === 'user_group') return true

  const users = s.users
  if (Array.isArray(users) && users.length > 0 && users[0] !== 'All Users') return true

  const destType = s.destination?.type
  if (destType === 'app_instance' || destType === 'url_list') return true

  const instances = s.app_instances
  if (Array.isArray(instances) && instances.length > 0) return true

  return false
}

export function isScopedNpj(rawNpj: Record<string, unknown>): boolean {
  return isScoped(getRawScope(rawNpj))
}

// ── Scope resolution ──────────────────────────────────────────────────────────

interface ResolvedScope {
  source:               NpjScopeSource
  destination:          NpjScopeDestination
  destinationDefaulted: boolean
}

export function resolveNpjScope(rawNpj: Record<string, unknown>): ResolvedScope | null {
  const s = getRawScope(rawNpj)

  // ── Source ──
  let source: NpjScopeSource

  const srcType = s.source?.type
  const srcValue = typeof s.source?.value === 'string' ? s.source.value : null

  if (srcType === 'ad_group' || srcType === 'user_group') {
    source = { type: srcType as 'ad_group' | 'user_group', value: srcValue }
  } else {
    const users = s.users
    if (Array.isArray(users) && users.length > 0 && users[0] !== 'All Users') {
      source = { type: 'user_group', value: String(users[0]) }
    } else {
      source = { type: 'all_users', value: null }
    }
  }

  // ── Destination ──
  const destType = s.destination?.type
  const destValue = typeof s.destination?.value === 'string' ? s.destination.value : null
  const destApp = typeof s.destination?.app === 'string' ? s.destination.app : undefined
  const destInstance = typeof s.destination?.instance === 'string' ? s.destination.instance : undefined

  let destination: NpjScopeDestination
  let destinationDefaulted = false

  if (destType === 'app_instance' && destValue) {
    destination = { type: 'app_instance', value: destValue, app: destApp, instance: destInstance }
  } else if (destType === 'url_list' && destValue) {
    destination = { type: 'url_list', value: destValue }
  } else {
    const instances = s.app_instances
    if (Array.isArray(instances) && instances.length > 0) {
      destination = { type: 'app_instance', value: String(instances[0]) }
    } else if (source.type !== 'all_users') {
      // Source-only scoped NPJ: default destination to broad Generative AI category.
      destination = { type: 'app_category', value: 'Generative AI' }
      destinationDefaulted = true
    } else {
      // No meaningful scope — fall back to default category path.
      return null
    }
  }

  return { source, destination, destinationDefaulted }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function slugify(s: string | null): string {
  if (!s) return 'all'
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'all'
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// Destination sort order: app_instance first (most specific), then url_list, then app_tag, then app_category.
const DEST_SORT_ORDER: Record<string, number> = {
  app_instance: 0,
  url_list:     1,
  app_tag:      2,
  app_category: 3,
}

// ── Scoped policy builder ─────────────────────────────────────────────────────

interface PolicyGroup {
  key:         string
  source:      NpjScopeSource
  destination: NpjScopeDestination
  npjs:        ScopedNpjInput[]
  anyDefaultedDestination: boolean
}

export function buildScopedPolicies(scopedNpjs: ScopedNpjInput[]): ScopedPoliciesResult {
  if (scopedNpjs.length === 0) {
    return {
      policies:         [],
      required_objects: emptyRequiredObjects(),
      issues:           [],
      overflow_count:   0,
    }
  }

  // ── Group by (source, destination) ──
  const groupMap = new Map<string, PolicyGroup>()
  for (const npj of scopedNpjs) {
    const key = `${npj.source.type}:${npj.source.value ?? ''}:${npj.destination.type}:${npj.destination.value}`
    const existing = groupMap.get(key)
    if (existing) {
      existing.npjs.push(npj)
      if (npj.destination_defaulted) existing.anyDefaultedDestination = true
    } else {
      groupMap.set(key, {
        key,
        source:      npj.source,
        destination: npj.destination,
        npjs:        [npj],
        anyDefaultedDestination: !!npj.destination_defaulted,
      })
    }
  }

  // ── Sort: most specific destination type first ──
  const sortedGroups = [...groupMap.values()].sort((a, b) => {
    const oa = DEST_SORT_ORDER[a.destination.type] ?? 9
    const ob = DEST_SORT_ORDER[b.destination.type] ?? 9
    return oa - ob
  })

  // ── Overflow guard ──
  const issues: RecommendationIssue[] = []
  let overflow_count = 0

  if (sortedGroups.length > SCOPED_POLICY_MAX) {
    overflow_count = sortedGroups.length - SCOPED_POLICY_MAX
    issues.push({
      code:        'SCOPED_POLICY_OVERFLOW',
      severity:    'warning',
      description: `${overflow_count} scoped ${overflow_count === 1 ? 'policy group' : 'policy groups'} could not be assigned a priority slot — the P210–P290 range supports a maximum of ${SCOPED_POLICY_MAX} scoped policies.`,
      fix:         'Reduce the number of scoped NPJs or manually adjust priorities in the Netskope console.',
    })
    sortedGroups.splice(SCOPED_POLICY_MAX)
  }

  // ── Build policies ──
  const policies: NetskopePolicy[] = []

  for (let i = 0; i < sortedGroups.length; i++) {
    const group = sortedGroups[i]
    const priority = SCOPED_PRIORITY_START + i * SCOPED_PRIORITY_STEP

    // Emit info issue when destination was defaulted to Generative AI category.
    if (group.anyDefaultedDestination) {
      issues.push({
        code:        'SCOPED_DESTINATION_DEFAULTED',
        severity:    'info',
        description: `Scoped policy "${group.source.value ?? 'Scoped Users'}" has no explicit destination scope — destination defaulted to "Generative AI" category.`,
        fix:         'Add scope.destination to the NPJ to target a specific app instance or URL list.',
      })
    }

    // Build profiles — one per NPJ in the group.
    const profiles: NetskopeProfileEntry[] = []
    for (const npj of group.npjs) {
      const profileType = FAMILY_TO_PROFILE_TYPE[npj.policy_family]
      if (!profileType) {
        issues.push({
          code:        'SCOPED_PROFILE_TYPE_UNKNOWN',
          severity:    'info',
          description: `Scoped NPJ "${npj.policy_name}" has an unsupported policy_family "${npj.policy_family}" — its DLP profile entry was skipped.`,
          fix:         `Ensure policy_family is one of: ${Object.keys(FAMILY_TO_PROFILE_TYPE).join(', ')}.`,
        })
        continue
      }

      // Correct action resolution: strictest across ALL categories, then match coaching.
      const resolvedAction = resolveStrictestAction(Object.values(npj.actions_by_category))
      const matchingCategory = Object.entries(npj.actions_by_category)
        .find(([, action]) => action === resolvedAction)?.[0]
      const coachingTemplate = matchingCategory
        ? (npj.coaching_by_category?.[matchingCategory] ?? null)
        : null

      profiles.push({
        profile:           npj.risk_family_label,
        profile_type:      profileType,
        profile_action:    resolvedAction,
        coaching_template: coachingTemplate,
      })
    }

    if (profiles.length === 0) {
      issues.push({
        code:        'SCOPED_POLICY_NO_PROFILES',
        severity:    'warning',
        description: `Scoped policy group "${group.source.value ?? 'Scoped Users'} → ${group.destination.value}" has no valid DLP profiles — policy was not generated.`,
        fix:         'Ensure all NPJs in this scoped group have a supported policy_family.',
      })
      continue
    }

    // Determine name parts.
    const sourceGroup = group.source.value ?? 'Scoped Users'
    const destName    = group.destination.app && group.destination.instance
      ? `${group.destination.app} — ${group.destination.instance}`
      : group.destination.value
    const strictestAction = resolveStrictestAction(profiles.map(p => p.profile_action))

    let contentLabel: string
    if (group.npjs.length === 1) {
      contentLabel = group.npjs[0].risk_family_label
    } else {
      const strictestNpj = group.npjs.find(npj =>
        resolveStrictestAction(Object.values(npj.actions_by_category)) === strictestAction
      )
      contentLabel = strictestNpj?.risk_family_label ?? 'Multiple Controls'
    }

    // Destination for the Netskope policy.
    const destNote = group.destination.app && group.destination.instance
      ? `${group.destination.app} — ${group.destination.instance} instance`
      : null

    // Activities: union across NPJs in the group; fallback to standard set.
    const activityUnion = new Set<string>()
    for (const npj of group.npjs) {
      const rawNpjActivities = (npj as unknown as Record<string, unknown>).activities
      if (Array.isArray(rawNpjActivities)) {
        rawNpjActivities.forEach(a => activityUnion.add(String(a)))
      }
    }
    const activities = activityUnion.size > 0
      ? [...activityUnion]
      : ['post', 'upload', 'prompt_submit']

    const policy: NetskopePolicy = {
      priority:    priority,
      policy_key:  `netskope:scoped:${slugify(group.source.value)}-${slugify(group.destination.value)}`,
      name:        `GenAI — ${sourceGroup} — ${contentLabel} ${capitalise(strictestAction)} — ${destName}`,
      policy_type: 'realtime_protection',
      destination: {
        strategy:        group.destination.type,
        tag_or_category: group.destination.value,
        note:            destNote,
      },
      source:      { type: group.source.type, value: group.source.value },
      activities,
      profiles,
      no_match_action:            null,
      continue_policy_evaluation: buildContinuePolicyEvaluation(profiles),
      notification:               null,
    }
    policies.push(policy)
  }

  // ── Required objects ──
  const base = collectRequiredObjects(policies)

  const appInstances  = new Set<string>()
  const urlLists      = new Set<string>()
  const userGroups    = new Set<string>()
  const adGroups      = new Set<string>()

  for (const group of sortedGroups) {
    if (group.destination.type === 'app_instance' && group.destination.value) {
      appInstances.add(group.destination.value)
    }
    if (group.destination.type === 'url_list' && group.destination.value) {
      urlLists.add(group.destination.value)
    }
    if (group.source.type === 'user_group' && group.source.value) {
      userGroups.add(group.source.value)
    }
    if (group.source.type === 'ad_group' && group.source.value) {
      adGroups.add(group.source.value)
    }
  }

  const required_objects: RequiredObjects = {
    ...base,
    app_instances: [...appInstances],
    url_lists:     [...urlLists],
    user_groups:   [...userGroups],
    ad_groups:     [...adGroups],
  }

  return { policies, required_objects, issues, overflow_count }
}

// ── Empty required objects ────────────────────────────────────────────────────

function emptyRequiredObjects(): RequiredObjects {
  return {
    dlp_profiles:                  [],
    classification_label_profiles: [],
    filename_profiles:             [],
    filetype_profiles:             [],
    notification_templates:        [],
    cci_app_tags:                  [],
    app_categories:                [],
    app_instances:                 [],
    app_instance_tags:             [],
    url_lists:                     [],
    user_groups:                   [],
    ad_groups:                     [],
    policy_order:                  [],
  }
}
