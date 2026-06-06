// Phase 3: Scoped NPJ Detection and Policy Builder
// Detects NPJs with custom source/destination scope and builds Netskope policies
// at P210–P290 (before the broad category policies at P300+).

import { collectRequiredObjects, buildContinuePolicyEvaluation } from './topology'
import { resolveStrictestAction } from './options'
import { unionActivities } from './activities'
import type {
  NetskopePolicy, NetskopeProfileEntry, NpjProfileType,
  RequiredObjects, RecommendationIssue,
  ScopedNpjInput, ScopedPoliciesResult,
  NpjScopeSource, NpjScopeDestination,
  NpjScopeExclusion, NpjScopeExclusionType, NpjSourceType,
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
  /** Phase 4.5: source identity exclusions — array of { type, value } entries. */
  exclusions?:     unknown
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

// Phase 4.5: all source types that trigger scoped policy detection.
const SCOPED_SOURCE_TYPES = new Set<string>([
  'ad_group', 'user_group', 'user', 'organizational_unit',
])

function isScoped(s: RawScope): boolean {
  const srcType = s.source?.type
  if (typeof srcType === 'string' && SCOPED_SOURCE_TYPES.has(srcType)) return true

  const users = s.users
  if (Array.isArray(users) && users.length > 0 && users[0] !== 'All Users') return true

  const destType = s.destination?.type
  // Accept both canonical names and legacy aliases (url_list, app_tag).
  if (destType === 'app_instance' || destType === 'cloud_app' ||
      destType === 'url_list'     || destType === 'destination_profile') return true

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
  exclusions:           NpjScopeExclusion[]
}

// Allowed types in Netskope's Source Exclusion panel (User / User Group / OU).
// ad_group excluded until verified.
const VALID_EXCLUSION_TYPES = new Set<NpjScopeExclusionType>([
  'user', 'user_group', 'organizational_unit',
])

export function resolveNpjScope(rawNpj: Record<string, unknown>): ResolvedScope | null {
  const s = getRawScope(rawNpj)

  // ── Source ──
  let source: NpjScopeSource

  const srcType = s.source?.type
  const srcValue = typeof s.source?.value === 'string' ? s.source.value : null

  if (typeof srcType === 'string' && SCOPED_SOURCE_TYPES.has(srcType)) {
    source = { type: srcType as NpjSourceType, value: srcValue }
  } else {
    const users = s.users
    if (Array.isArray(users) && users.length > 0 && users[0] !== 'All Users') {
      source = { type: 'user_group', value: String(users[0]) }
    } else {
      source = { type: 'all_users', value: null }
    }
  }

  // ── Source exclusions (Phase 4.5) ──
  // Validates: must be an object with a string type in VALID_EXCLUSION_TYPES and a non-empty string value.
  const exclusions: NpjScopeExclusion[] = Array.isArray(s.exclusions)
    ? (s.exclusions as unknown[]).reduce<NpjScopeExclusion[]>((acc, e) => {
        if (e === null || typeof e !== 'object') return acc
        const entry = e as Record<string, unknown>
        const t = entry.type
        const v = entry.value
        if (
          typeof t === 'string' &&
          typeof v === 'string' &&
          v.trim().length > 0 &&
          VALID_EXCLUSION_TYPES.has(t as NpjScopeExclusionType)
        ) {
          acc.push({ type: t as NpjScopeExclusionType, value: v.trim() })
        }
        return acc
      }, [])
    : []

  // ── Destination ──
  const rawDestType = typeof s.destination?.type === 'string' ? s.destination.type : undefined
  const destValue   = typeof s.destination?.value === 'string' ? s.destination.value : null
  const destApp     = typeof s.destination?.app      === 'string' ? s.destination.app      : undefined
  const destInstance = typeof s.destination?.instance === 'string' ? s.destination.instance : undefined

  let destination: NpjScopeDestination
  let destinationDefaulted = false

  if (rawDestType === 'app_instance' && destValue) {
    destination = { type: 'app_instance', value: destValue, app: destApp, instance: destInstance }
  } else if (rawDestType === 'cloud_app' && destValue) {
    destination = { type: 'cloud_app', value: destValue }
  } else if ((rawDestType === 'destination_profile' || rawDestType === 'url_list') && destValue) {
    // url_list is a legacy alias → normalise to destination_profile
    destination = { type: 'destination_profile', value: destValue }
  } else if (rawDestType === 'app_tag' && destValue) {
    // Legacy app_tag alias: the tag name was the value → carry it as cci_app_tag
    // (in Netskope's real UI, CCI App Tag is a constraint on Category, not a destination type)
    destination = { type: 'app_category', value: destValue, cci_app_tag: destValue }
  } else {
    // No explicit scoped destination (includes plain app_category = default, omitted, or unrecognised).
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

  return { source, destination, destinationDefaulted, exclusions }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function slugify(s: string | null): string {
  if (!s) return 'all'
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'all'
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// Destination sort order: most-specific first, broad category last.
const DEST_SORT_ORDER: Record<string, number> = {
  app_instance:        0,
  cloud_app:           1,
  destination_profile: 2,
  app_category:        3,
}

// ── Scoped policy builder ─────────────────────────────────────────────────────

interface PolicyGroup {
  key:              string
  source:           NpjScopeSource
  source_exclusions: NpjScopeExclusion[]
  destination:      NpjScopeDestination
  npjs:             ScopedNpjInput[]
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

  // ── Group by (source, exclusions, destination) ──
  // Exclusions are included in the key so two NPJs with same source+dest but
  // different exclusions produce separate Netskope policies (different source selectors).
  const groupMap = new Map<string, PolicyGroup>()
  for (const npj of scopedNpjs) {
    const excKey = (npj.source_exclusions ?? [])
      .map(e => `${e.type}:${e.value}`)
      .sort()
      .join('|')
    const key = `${npj.source.type}:${npj.source.value ?? ''}:${npj.destination.type}:${npj.destination.value}:${excKey}`
    const existing = groupMap.get(key)
    if (existing) {
      existing.npjs.push(npj)
      if (npj.destination_defaulted) existing.anyDefaultedDestination = true
    } else {
      groupMap.set(key, {
        key,
        source:            npj.source,
        source_exclusions: npj.source_exclusions ?? [],
        destination:       npj.destination,
        npjs:              [npj],
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

    // Phase 4: derive activities from the union of source_activities across all NPJs in this group.
    // Falls back to the full realtime activity set for pre-Phase 4 NPJs (source_activities undefined).
    const activities = unionActivities(group.npjs.map(n => n.source_activities))

    const policy: NetskopePolicy = {
      priority:    priority,
      // Include priority in the key to prevent slug collisions between groups with similar source/dest names.
      policy_key:  `netskope:scoped:p${priority}-${slugify(group.source.value)}-${slugify(group.destination.value)}`,
      name:        `GenAI — ${sourceGroup} — ${contentLabel} ${capitalise(strictestAction)} — ${destName}`,
      policy_type: 'realtime_protection',
      destination: {
        strategy:        group.destination.type,
        tag_or_category: group.destination.value,
        // Carry CCI App Tag constraint when present (e.g. app_category with a tag filter).
        ...(group.destination.cci_app_tag != null && { cci_app_tag: group.destination.cci_app_tag }),
        note:            destNote,
      },
      source: {
        type:  group.source.type,
        value: group.source.value,
        // Phase 4.5: propagate source identity exclusions. Omit the field when empty.
        ...(group.source_exclusions.length > 0 && { exclusions: group.source_exclusions }),
      },
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
  const destProfiles  = new Set<string>()
  const cloudApps     = new Set<string>()
  const userGroups    = new Set<string>()
  const adGroups      = new Set<string>()
  const users         = new Set<string>()
  const ous           = new Set<string>()

  for (const group of sortedGroups) {
    // Destination objects — all aliases already normalised by resolveNpjScope
    if (group.destination.type === 'app_instance'        && group.destination.value) appInstances.add(group.destination.value)
    if (group.destination.type === 'destination_profile' && group.destination.value) destProfiles.add(group.destination.value)
    if (group.destination.type === 'cloud_app'           && group.destination.value) cloudApps.add(group.destination.value)

    // Source identity objects
    if (group.source.value) {
      if (group.source.type === 'user_group')          userGroups.add(group.source.value)
      if (group.source.type === 'ad_group')            adGroups.add(group.source.value)
      if (group.source.type === 'user')                users.add(group.source.value)
      if (group.source.type === 'organizational_unit') ous.add(group.source.value)
    }

    // Exclusion identity objects — collect same types as source
    for (const ex of group.source_exclusions) {
      if (ex.type === 'user')               users.add(ex.value)
      if (ex.type === 'user_group')         userGroups.add(ex.value)
      if (ex.type === 'organizational_unit') ous.add(ex.value)
    }
  }

  const required_objects: RequiredObjects = {
    ...base,
    app_instances:        [...appInstances],
    destination_profiles: [...destProfiles],
    cloud_apps:           [...cloudApps],
    user_groups:          [...userGroups],
    ad_groups:            [...adGroups],
    users:                [...users],
    organizational_units: [...ous],
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
    destination_profiles:          [],
    cloud_apps:                    [],
    user_groups:                   [],
    ad_groups:                     [],
    users:                         [],
    organizational_units:          [],
    policy_order:                  [],
  }
}
