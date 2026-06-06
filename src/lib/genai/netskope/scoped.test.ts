import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { isScopedNpj, resolveNpjScope, buildScopedPolicies } from './scoped'
import { unionActivities, NETSKOPE_REALTIME_ACTIVITIES } from './activities'
import { buildTopology } from './topology'
import { generateTopologyOptions } from './options'
import { transposeNpjs, extractAlwaysBlockProfiles } from './transpose'
import type { ScopedNpjInput, NpjScopeExclusion } from './types'
import type { NpjInput } from './transpose'

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeNpj(scopeOverride: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schema_version: '1.0',
    intent:         'prevent_exfiltration',
    scope:          scopeOverride,
    content:        { operator: 'any', conditions: [] },
    decision:       { mode: 'block', severity: 'high', require_acknowledgement: false, require_justification: false, preserve_evidence: false, create_incident: true },
    provenance:     { generated_from: 'ai-assisted', generated_at: new Date().toISOString() },
  }
}

function makeScopedNpj(overrides: Partial<ScopedNpjInput> = {}): ScopedNpjInput {
  return {
    policy_id:           'pol-1',
    policy_name:         'HR Users Upload Block',
    policy_family:       'genai_content_detection',
    risk_family_key:     'regulated_data',
    risk_family_label:   'Regulated Data',
    actions_by_category: {
      approved_supported:       'block',
      approved_with_conditions: 'block',
      restricted_unassessed:    'block',
    },
    coaching_by_category: {
      approved_supported:       'template-block',
      approved_with_conditions: 'template-block',
      restricted_unassessed:    null,
    },
    source:      { type: 'user_group', value: 'HR Users' },
    destination: { type: 'app_instance', value: 'Microsoft Copilot — Personal' },
    ...overrides,
  }
}

// ── isScopedNpj ───────────────────────────────────────────────────────────────

describe('isScopedNpj', () => {

  test('returns false for empty scope', () => {
    assert.equal(isScopedNpj(makeNpj({})), false)
  })

  test('returns false for scope.users = All Users', () => {
    assert.equal(isScopedNpj(makeNpj({ users: ['All Users'] })), false)
  })

  test('returns false when scope is absent', () => {
    assert.equal(isScopedNpj({ schema_version: '1.0' }), false)
  })

  test('returns true for scope.users with custom group (legacy)', () => {
    assert.equal(isScopedNpj(makeNpj({ users: ['HR Users'] })), true)
  })

  test('returns true for scope.source.type = ad_group', () => {
    assert.equal(isScopedNpj(makeNpj({ source: { type: 'ad_group', value: 'Finance' } })), true)
  })

  test('returns true for scope.source.type = user_group', () => {
    assert.equal(isScopedNpj(makeNpj({ source: { type: 'user_group', value: 'HR' } })), true)
  })

  test('returns false for scope.source.type = all_users', () => {
    assert.equal(isScopedNpj(makeNpj({ source: { type: 'all_users', value: null } })), false)
  })

  test('returns true for scope.destination.type = app_instance', () => {
    assert.equal(isScopedNpj(makeNpj({ destination: { type: 'app_instance', value: 'MS Copilot Personal' } })), true)
  })

  test('returns true for scope.destination.type = destination_profile (canonical)', () => {
    assert.equal(isScopedNpj(makeNpj({ destination: { type: 'destination_profile', value: 'blocked-genai-urls' } })), true)
  })

  test('returns true for legacy scope.destination.type = url_list (alias)', () => {
    assert.equal(isScopedNpj(makeNpj({ destination: { type: 'url_list', value: 'blocked-genai-urls' } })), true)
  })

  test('returns true for non-empty scope.app_instances', () => {
    assert.equal(isScopedNpj(makeNpj({ app_instances: ['ms-copilot-personal'] })), true)
  })

  test('returns false for empty scope.app_instances', () => {
    assert.equal(isScopedNpj(makeNpj({ app_instances: [] })), false)
  })
})

// ── resolveNpjScope ───────────────────────────────────────────────────────────

describe('resolveNpjScope', () => {

  test('legacy users field resolves as user_group', () => {
    const result = resolveNpjScope(makeNpj({ users: ['HR Users'] }))
    assert.ok(result)
    assert.equal(result.source.type, 'user_group')
    assert.equal(result.source.value, 'HR Users')
    // No destination in scope → defaults to Generative AI
    assert.equal(result.destination.type, 'app_category')
    assert.equal(result.destination.value, 'Generative AI')
    assert.equal(result.destinationDefaulted, true)
  })

  test('scope.source.type = ad_group resolves correctly', () => {
    const result = resolveNpjScope(makeNpj({ source: { type: 'ad_group', value: 'Finance' } }))
    assert.ok(result)
    assert.equal(result.source.type, 'ad_group')
    assert.equal(result.source.value, 'Finance')
    assert.equal(result.destinationDefaulted, true)
  })

  test('scope.destination.type = app_instance resolves correctly', () => {
    const result = resolveNpjScope(makeNpj({
      source:      { type: 'user_group', value: 'HR' },
      destination: { type: 'app_instance', value: 'Copilot Personal', app: 'Microsoft Copilot', instance: 'Personal' },
    }))
    assert.ok(result)
    assert.equal(result.destination.type, 'app_instance')
    assert.equal(result.destination.value, 'Copilot Personal')
    assert.equal(result.destination.app, 'Microsoft Copilot')
    assert.equal(result.destination.instance, 'Personal')
    assert.equal(result.destinationDefaulted, false)
  })

  test('scope.destination.type = destination_profile resolves correctly (canonical)', () => {
    const result = resolveNpjScope(makeNpj({
      users:       ['Finance Team'],
      destination: { type: 'destination_profile', value: 'personal-genai-urls' },
    }))
    assert.ok(result)
    assert.equal(result.destination.type, 'destination_profile')
    assert.equal(result.destination.value, 'personal-genai-urls')
    assert.equal(result.destinationDefaulted, false)
  })

  test('legacy url_list resolves as destination_profile (alias)', () => {
    const result = resolveNpjScope(makeNpj({
      users:       ['Finance Team'],
      destination: { type: 'url_list', value: 'personal-genai-urls' },
    }))
    assert.ok(result)
    assert.equal(result.destination.type, 'destination_profile')
    assert.equal(result.destination.value, 'personal-genai-urls')
    assert.equal(result.destinationDefaulted, false)
  })

  test('legacy app_tag resolves as app_category with cci_app_tag (alias)', () => {
    // app_tag value becomes cci_app_tag; primary category is always 'Generative AI'
    const result = resolveNpjScope(makeNpj({
      users:       ['Engineering'],
      destination: { type: 'app_tag', value: 'My Custom Tag' },
    }))
    assert.ok(result)
    assert.equal(result.destination.type, 'app_category')
    assert.equal(result.destination.value, 'Generative AI')      // primary category, not the tag name
    assert.equal(result.destination.cci_app_tag, 'My Custom Tag') // tag name → constraint
    assert.equal(result.destinationDefaulted, false)
  })

  test('scope.app_instances resolves to app_instance destination', () => {
    const result = resolveNpjScope(makeNpj({ users: ['Devs'], app_instances: ['github-copilot-personal'] }))
    assert.ok(result)
    assert.equal(result.destination.type, 'app_instance')
    assert.equal(result.destination.value, 'github-copilot-personal')
    assert.equal(result.destinationDefaulted, false)
  })

  test('returns null when both source and destination are unresolvable (all_users, no dest)', () => {
    // all_users + no scoped destination → not actionable as scoped
    const result = resolveNpjScope(makeNpj({ destination: { type: 'app_category', value: 'Generative AI' } }))
    // This is NOT scoped (destination = app_category is default), so resolveNpjScope returns null
    // because source = all_users and destination type is not app_instance/url_list
    assert.equal(result, null)
  })

  test('source-only NPJ (user_group, no explicit destination) defaults destination', () => {
    const result = resolveNpjScope(makeNpj({ source: { type: 'user_group', value: 'Legal' } }))
    assert.ok(result)
    assert.equal(result.source.type, 'user_group')
    assert.equal(result.source.value, 'Legal')
    assert.equal(result.destination.type, 'app_category')
    assert.equal(result.destination.value, 'Generative AI')
    assert.equal(result.destinationDefaulted, true)
  })
})

// ── buildScopedPolicies ───────────────────────────────────────────────────────

describe('buildScopedPolicies', () => {

  test('returns empty result for empty input', () => {
    const result = buildScopedPolicies([])
    assert.equal(result.policies.length, 0)
    assert.equal(result.overflow_count, 0)
    assert.equal(result.issues.length, 0)
  })

  test('single scoped NPJ produces one policy at P210', () => {
    const result = buildScopedPolicies([makeScopedNpj()])
    assert.equal(result.policies.length, 1)
    assert.equal(result.policies[0].priority, 210)
    assert.equal(result.policies[0].policy_type, 'realtime_protection')
    assert.ok(result.policies[0].policy_key.startsWith('netskope:scoped:'))
  })

  test('policy source matches NPJ source', () => {
    const result = buildScopedPolicies([makeScopedNpj({ source: { type: 'ad_group', value: 'Finance' } })])
    assert.equal(result.policies[0].source.type, 'ad_group')
    assert.equal(result.policies[0].source.value, 'Finance')
  })

  test('policy destination matches NPJ destination', () => {
    const result = buildScopedPolicies([makeScopedNpj({
      destination: { type: 'app_instance', value: 'Copilot Personal', app: 'MS Copilot', instance: 'Personal' },
    })])
    assert.equal(result.policies[0].destination.strategy, 'app_instance')
    assert.equal(result.policies[0].destination.tag_or_category, 'Copilot Personal')
    assert.equal(result.policies[0].destination.note, 'MS Copilot — Personal instance')
  })

  test('action resolution: uses strictest action across all categories', () => {
    const npj = makeScopedNpj({
      actions_by_category: {
        approved_supported:       'alert',
        approved_with_conditions: 'block',   // strictest
        restricted_unassessed:    'monitor',
      },
      coaching_by_category: {
        approved_supported:       'tmpl-alert',
        approved_with_conditions: 'tmpl-block',  // coaching for the winning action
        restricted_unassessed:    null,
      },
    })
    const result = buildScopedPolicies([npj])
    const profile = result.policies[0].profiles[0]
    assert.equal(profile.profile_action, 'block')
    assert.equal(profile.coaching_template, 'tmpl-block')
  })

  test('coaching template matches the resolved action category — not always approved_supported', () => {
    const npj = makeScopedNpj({
      actions_by_category: {
        approved_supported:       'allow',   // should NOT be picked
        approved_with_conditions: 'block',   // strictest
        restricted_unassessed:    'alert',
      },
      coaching_by_category: {
        approved_supported:       'tmpl-for-allow',
        approved_with_conditions: 'tmpl-for-block',  // should be picked
        restricted_unassessed:    'tmpl-for-alert',
      },
    })
    const result = buildScopedPolicies([npj])
    const profile = result.policies[0].profiles[0]
    assert.equal(profile.profile_action, 'block')
    assert.equal(profile.coaching_template, 'tmpl-for-block')
    // Verify it did NOT pick approved_supported's coaching
    assert.notEqual(profile.coaching_template, 'tmpl-for-allow')
  })

  test('two NPJs with same source+destination are grouped into one policy with two profiles', () => {
    const npj1 = makeScopedNpj({
      policy_id:         'pol-1',
      risk_family_key:   'regulated_data',
      risk_family_label: 'Regulated Data',
    })
    const npj2 = makeScopedNpj({
      policy_id:         'pol-2',
      risk_family_key:   'credentials_keys_secrets',
      risk_family_label: 'Credentials',
    })
    const result = buildScopedPolicies([npj1, npj2])
    assert.equal(result.policies.length, 1, 'Same source+dest → grouped into 1 policy')
    assert.equal(result.policies[0].profiles.length, 2)
  })

  test('two NPJs with different sources produce two policies at P210 and P220', () => {
    const npj1 = makeScopedNpj({ source: { type: 'user_group', value: 'HR' } })
    const npj2 = makeScopedNpj({ source: { type: 'user_group', value: 'Finance' } })
    const result = buildScopedPolicies([npj1, npj2])
    assert.equal(result.policies.length, 2)
    const priorities = result.policies.map(p => p.priority).sort((a, b) => a - b)
    assert.deepEqual(priorities, [210, 220])
  })

  test('app_instance destination sorts before app_category (more specific first)', () => {
    const npjAppCat = makeScopedNpj({
      source:      { type: 'user_group', value: 'HR' },
      destination: { type: 'app_category', value: 'Generative AI' },
      destination_defaulted: true,
    })
    const npjInstance = makeScopedNpj({
      source:      { type: 'user_group', value: 'Finance' },
      destination: { type: 'app_instance', value: 'Copilot Personal' },
    })
    const result = buildScopedPolicies([npjAppCat, npjInstance])
    // app_instance should get P210 (lower priority number = higher Netskope precedence)
    assert.equal(result.policies[0].destination.strategy, 'app_instance')
    assert.equal(result.policies[0].priority, 210)
  })

  test('overflow guard: 9 distinct scoped NPJs → 8 policies + SCOPED_POLICY_OVERFLOW issue', () => {
    const npjs: ScopedNpjInput[] = Array.from({ length: 9 }, (_, i) =>
      makeScopedNpj({
        policy_id:   `pol-${i}`,
        source:      { type: 'user_group', value: `Group${i}` },
        destination: { type: 'app_instance', value: `Instance${i}` },
      })
    )
    const result = buildScopedPolicies(npjs)
    assert.equal(result.policies.length, 8)
    assert.equal(result.overflow_count, 1)
    const overflowIssue = result.issues.find(i => i.code === 'SCOPED_POLICY_OVERFLOW')
    assert.ok(overflowIssue, 'SCOPED_POLICY_OVERFLOW issue should be present')
    assert.equal(overflowIssue?.severity, 'warning')
  })

  test('destination_defaulted emits SCOPED_DESTINATION_DEFAULTED info issue', () => {
    const result = buildScopedPolicies([makeScopedNpj({
      destination:           { type: 'app_category', value: 'Generative AI' },
      destination_defaulted: true,
    })])
    const issue = result.issues.find(i => i.code === 'SCOPED_DESTINATION_DEFAULTED')
    assert.ok(issue)
    assert.equal(issue?.severity, 'info')
  })

  test('unknown policy_family emits SCOPED_PROFILE_TYPE_UNKNOWN and skips that profile', () => {
    const npj1 = makeScopedNpj({ policy_family: 'unsupported_family', risk_family_label: 'Unknown' })
    const npj2 = makeScopedNpj({ policy_id: 'pol-valid' }) // valid
    // group same source+dest
    const result = buildScopedPolicies([npj1, npj2])
    const issue = result.issues.find(i => i.code === 'SCOPED_PROFILE_TYPE_UNKNOWN')
    assert.ok(issue)
    // The valid NPJ still produces a profile
    assert.equal(result.policies[0].profiles.length, 1)
  })

  test('group with no valid profiles is omitted (SCOPED_POLICY_NO_PROFILES issue)', () => {
    const npj = makeScopedNpj({ policy_family: 'completely_invalid' })
    const result = buildScopedPolicies([npj])
    assert.equal(result.policies.length, 0)
    const issue = result.issues.find(i => i.code === 'SCOPED_POLICY_NO_PROFILES')
    assert.ok(issue)
  })

  test('required_objects.app_instances populated for app_instance destination', () => {
    const result = buildScopedPolicies([makeScopedNpj({
      destination: { type: 'app_instance', value: 'Copilot Personal' },
    })])
    assert.ok(result.required_objects.app_instances.includes('Copilot Personal'))
  })

  test('required_objects.destination_profiles populated for destination_profile destination', () => {
    const result = buildScopedPolicies([makeScopedNpj({
      source:      { type: 'user_group', value: 'Legal' },
      destination: { type: 'destination_profile', value: 'blocked-genai-sites' },
    })])
    assert.ok(result.required_objects.destination_profiles.includes('blocked-genai-sites'))
  })

  test('required_objects.user_groups populated for user_group source', () => {
    const result = buildScopedPolicies([makeScopedNpj({ source: { type: 'user_group', value: 'HR Users' } })])
    assert.ok(result.required_objects.user_groups.includes('HR Users'))
  })

  test('required_objects.ad_groups populated for ad_group source', () => {
    const result = buildScopedPolicies([makeScopedNpj({ source: { type: 'ad_group', value: 'CN=Finance,DC=corp' } })])
    assert.ok(result.required_objects.ad_groups.includes('CN=Finance,DC=corp'))
  })

  test('no_match_action is null for scoped policies', () => {
    const result = buildScopedPolicies([makeScopedNpj()])
    assert.equal(result.policies[0].no_match_action, null)
  })

  test('policy name follows GenAI — Source — Label Action — Dest pattern', () => {
    const result = buildScopedPolicies([makeScopedNpj({
      risk_family_label:   'Customer PII',
      source:              { type: 'user_group', value: 'HR Users' },
      destination:         { type: 'app_instance', value: 'Microsoft Personal Instance' },
      actions_by_category: {
        approved_supported:       'block',
        approved_with_conditions: 'block',
        restricted_unassessed:    'block',
      },
    })])
    const name = result.policies[0].name
    assert.ok(name.includes('HR Users'),              `Name should contain source: "${name}"`)
    assert.ok(name.includes('Customer PII'),          `Name should contain label: "${name}"`)
    assert.ok(name.includes('Block'),                 `Name should contain action: "${name}"`)
    assert.ok(name.includes('Microsoft Personal Instance'), `Name should contain dest: "${name}"`)
  })

  test('policy_key starts with netskope:scoped:', () => {
    const result = buildScopedPolicies([makeScopedNpj()])
    assert.ok(result.policies[0].policy_key.startsWith('netskope:scoped:'))
  })

  test('policy_order contains scoped policy names', () => {
    const result = buildScopedPolicies([makeScopedNpj()])
    assert.ok(result.required_objects.policy_order.length > 0)
    assert.ok(result.required_objects.policy_order.includes(result.policies[0].name))
  })
})

// ── Phase 4: unionActivities helper ──────────────────────────────────────────

describe('unionActivities', () => {

  test('returns full fallback for empty input', () => {
    assert.deepEqual(unionActivities([]), [...NETSKOPE_REALTIME_ACTIVITIES])
  })

  test('returns full fallback for all-undefined input', () => {
    assert.deepEqual(unionActivities([undefined, undefined]), [...NETSKOPE_REALTIME_ACTIVITIES])
  })

  test('returns full fallback for empty arrays', () => {
    assert.deepEqual(unionActivities([[], []]), [...NETSKOPE_REALTIME_ACTIVITIES])
  })

  test('filters non-realtime activities (browse, login, response)', () => {
    // browse/login are access-control only; response is output inspection (not yet modelled)
    const result = unionActivities([['browse', 'login', 'response']])
    assert.deepEqual(result, [...NETSKOPE_REALTIME_ACTIVITIES])  // all filtered → fallback
  })

  test('mixed undefined + defined falls back to full set (the key edge case)', () => {
    // One pre-Phase 4 NPJ (undefined) co-grouped with a Phase 4 NPJ (['upload']).
    // Cannot narrow — undefined means "unknown coverage" — must return full set.
    assert.deepEqual(
      unionActivities([undefined, ['upload']]),
      [...NETSKOPE_REALTIME_ACTIVITIES],
    )
  })

  test('mixed empty array + defined also falls back to full set', () => {
    assert.deepEqual(
      unionActivities([[], ['upload']]),
      [...NETSKOPE_REALTIME_ACTIVITIES],
    )
  })

  test('upload-only NPJ produces [upload] only', () => {
    const result = unionActivities([['upload']])
    assert.deepEqual(result, ['upload'])
  })

  test('content detection NPJ produces all three activities', () => {
    const result = unionActivities([['prompt_submit', 'upload', 'post']])
    // canonical order: post, upload, prompt_submit
    assert.deepEqual(result, ['post', 'upload', 'prompt_submit'])
  })

  test('canonical order preserved regardless of input order', () => {
    const result = unionActivities([['prompt_submit', 'post', 'upload']])
    assert.deepEqual(result, ['post', 'upload', 'prompt_submit'])
  })

  test('union of upload-only + prompt_submit-only = [upload, prompt_submit]', () => {
    const result = unionActivities([['upload'], ['prompt_submit']])
    assert.deepEqual(result, ['upload', 'prompt_submit'])
  })

  test('union of filename (upload) + content detection (all 3) = all 3', () => {
    const result = unionActivities([['upload'], ['post', 'upload', 'prompt_submit']])
    assert.deepEqual(result, ['post', 'upload', 'prompt_submit'])
  })

  test('deduplicates repeated entries across lists', () => {
    const result = unionActivities([['upload', 'post'], ['upload', 'post']])
    assert.deepEqual(result, ['post', 'upload'])
  })
})

// ── Phase 4: activity scoping in buildScopedPolicies ─────────────────────────

describe('buildScopedPolicies — Phase 4 activity scoping', () => {

  test('upload-only NPJ produces policy with activities = [upload]', () => {
    const npj = makeScopedNpj({ source_activities: ['upload'] })
    const result = buildScopedPolicies([npj])
    assert.deepEqual(result.policies[0].activities, ['upload'])
  })

  test('content detection NPJ (all 3 activities) produces full activity set in canonical order', () => {
    const npj = makeScopedNpj({ source_activities: ['prompt_submit', 'upload', 'post'] })
    const result = buildScopedPolicies([npj])
    assert.deepEqual(result.policies[0].activities, ['post', 'upload', 'prompt_submit'])
  })

  test('no source_activities falls back to full realtime set (backward compat)', () => {
    const npj = makeScopedNpj()  // no source_activities — pre-Phase 4 NPJ
    const result = buildScopedPolicies([npj])
    assert.deepEqual(result.policies[0].activities, [...NETSKOPE_REALTIME_ACTIVITIES])
  })

  test('two grouped NPJs with different activities produce union', () => {
    // filename NPJ (upload only) + content detection NPJ (all 3) grouped together
    const npj1 = makeScopedNpj({
      policy_id:         'pol-1',
      policy_family:     'genai_filename',
      risk_family_key:   'data_with_filename_pattern',
      risk_family_label: 'File by Name',
      source_activities: ['upload'],
    })
    const npj2 = makeScopedNpj({
      policy_id:         'pol-2',
      policy_family:     'genai_content_detection',
      risk_family_key:   'regulated_data',
      risk_family_label: 'Regulated Data',
      source_activities: ['post', 'upload', 'prompt_submit'],
    })
    const result = buildScopedPolicies([npj1, npj2])
    assert.equal(result.policies.length, 1, 'Same source+dest → grouped into 1 policy')
    assert.deepEqual(result.policies[0].activities, ['post', 'upload', 'prompt_submit'])
  })

  test('two grouped NPJs both upload-only stay upload-only after union', () => {
    const npj1 = makeScopedNpj({ policy_id: 'pol-1', source_activities: ['upload'] })
    const npj2 = makeScopedNpj({ policy_id: 'pol-2', risk_family_key: 'credentials_keys_secrets', risk_family_label: 'Credentials', source_activities: ['upload'] })
    const result = buildScopedPolicies([npj1, npj2])
    assert.equal(result.policies.length, 1)
    assert.deepEqual(result.policies[0].activities, ['upload'])
  })

  test('non-realtime activities in source_activities are filtered out', () => {
    const npj = makeScopedNpj({ source_activities: ['browse', 'login', 'upload'] })
    const result = buildScopedPolicies([npj])
    // browse/login filtered; only upload survives
    assert.deepEqual(result.policies[0].activities, ['upload'])
  })

  test('grouped pre-Phase 4 NPJ (undefined) + Phase 4 NPJ falls back to full set', () => {
    // The exact backward-compat edge case: one NPJ has no source_activities (pre-Phase 4),
    // the other has ['upload']. The unknown NPJ's coverage must not be silently dropped.
    const prePhase4 = makeScopedNpj({
      policy_id:         'pol-old',
      risk_family_key:   'regulated_data',
      risk_family_label: 'Regulated Data',
      // no source_activities — pre-Phase 4 NPJ
    })
    const phase4 = makeScopedNpj({
      policy_id:         'pol-new',
      risk_family_key:   'credentials_keys_secrets',
      risk_family_label: 'Credentials',
      source_activities: ['upload'],
    })
    const result = buildScopedPolicies([prePhase4, phase4])
    assert.equal(result.policies.length, 1, 'Same source+dest → grouped')
    assert.deepEqual(result.policies[0].activities, [...NETSKOPE_REALTIME_ACTIVITIES])
  })
})

// ── Phase 4: activity scoping in generateTopologyOptions ─────────────────────
// Covers the collectDedupedProfiles() merge path (consolidated + per-risk-family).

function makeNpjInput(overrides: Partial<NpjInput> & { source_activities?: string[] } = {}): NpjInput {
  return {
    policy_id:           overrides.policy_id           ?? 'pol-1',
    policy_name:         overrides.policy_name         ?? 'Test Policy',
    policy_family:       overrides.policy_family       ?? 'genai_content_detection',
    risk_family_key:     overrides.risk_family_key     ?? 'regulated_data',
    risk_family_label:   overrides.risk_family_label   ?? 'Regulated Data',
    actions_by_category: overrides.actions_by_category ?? {
      approved_supported:       'block',
      approved_with_conditions: 'alert',
      restricted_unassessed:    'alert',
    },
    coaching_by_category: overrides.coaching_by_category,
    source_activities:   overrides.source_activities,
  }
}

describe('generateTopologyOptions — Phase 4 activity scoping', () => {

  // Helper: build the full input pipeline (transpose + topology) from a list of NpjInputs.
  function buildOptionsInput(npjs: NpjInput[]) {
    const alwaysBlockNpjs = extractAlwaysBlockProfiles(npjs)
    const alwaysBlockKeys = new Set(alwaysBlockNpjs.map(n => n.risk_family_key))
    const buckets = transposeNpjs(npjs, alwaysBlockKeys)
    const topologyInput = { buckets, alwaysBlockNpjs, prohibitedCategory: null, skippedCount: 0 }
    const hybridResult = buildTopology(topologyInput)
    return { topologyInput, hybridResult }
  }

  test('per-risk-family: upload-only NPJ produces [upload] in its RF policy', () => {
    const { topologyInput, hybridResult } = buildOptionsInput([
      makeNpjInput({ source_activities: ['upload'] }),
    ])
    const options = generateTopologyOptions(topologyInput, hybridResult)
    const perRf = options.find(o => o.mode === 'per_risk_family')!
    const rfPolicy = perRf.policies.find(p => p.policy_key.includes('regulated_data'))
    assert.ok(rfPolicy, 'RF policy should exist')
    assert.deepEqual(rfPolicy!.activities, ['upload'])
  })

  test('consolidated: upload-only NPJ produces [upload] in the consolidated policy', () => {
    const { topologyInput, hybridResult } = buildOptionsInput([
      makeNpjInput({ source_activities: ['upload'] }),
    ])
    const options = generateTopologyOptions(topologyInput, hybridResult)
    const consolidated = options.find(o => o.mode === 'consolidated')!
    const consPolicy = consolidated.policies.find(p => p.policy_key === 'netskope:consolidated_all_categories')
    assert.ok(consPolicy)
    assert.deepEqual(consPolicy!.activities, ['upload'])
  })

  test('per-risk-family: legacy (undefined) + upload-only same RF → conservative full fallback', () => {
    // The exact case reported: same RF key, one legacy profile (undefined activities)
    // + one upload-only profile. collectDedupedProfiles must not narrow to ['upload'].
    const legacyNpj = makeNpjInput({
      policy_id:           'pol-legacy',
      risk_family_key:     'regulated_data',
      // no source_activities — simulates a pre-Phase 4 NPJ (TransposedProfile.source_activities = undefined)
    })
    const uploadOnlyNpj = makeNpjInput({
      policy_id:           'pol-upload',
      risk_family_key:     'regulated_data',
      source_activities:   ['upload'],
      // different category so both end up in the same dedup key but from different buckets
      actions_by_category: { approved_supported: 'alert', approved_with_conditions: 'block', restricted_unassessed: 'block' },
    })
    const { topologyInput, hybridResult } = buildOptionsInput([legacyNpj, uploadOnlyNpj])
    const options = generateTopologyOptions(topologyInput, hybridResult)
    const perRf = options.find(o => o.mode === 'per_risk_family')!
    const rfPolicy = perRf.policies.find(p => p.policy_key.includes('regulated_data'))
    assert.ok(rfPolicy, 'RF policy for regulated_data should exist')
    assert.deepEqual(rfPolicy!.activities, [...NETSKOPE_REALTIME_ACTIVITIES],
      'Mixed legacy+upload profile must fall back to full activity set')
  })

  test('consolidated: legacy + upload-only same RF → conservative full fallback', () => {
    const legacyNpj = makeNpjInput({ policy_id: 'pol-legacy', risk_family_key: 'regulated_data' })
    const uploadOnlyNpj = makeNpjInput({
      policy_id:           'pol-upload',
      risk_family_key:     'regulated_data',
      source_activities:   ['upload'],
      actions_by_category: { approved_supported: 'alert', approved_with_conditions: 'block', restricted_unassessed: 'block' },
    })
    const { topologyInput, hybridResult } = buildOptionsInput([legacyNpj, uploadOnlyNpj])
    const options = generateTopologyOptions(topologyInput, hybridResult)
    const consolidated = options.find(o => o.mode === 'consolidated')!
    const consPolicy = consolidated.policies.find(p => p.policy_key === 'netskope:consolidated_all_categories')
    assert.ok(consPolicy)
    assert.deepEqual(consPolicy!.activities, [...NETSKOPE_REALTIME_ACTIVITIES],
      'Mixed legacy+upload dedup must fall back to full activity set in consolidated topology')
  })

  test('per-risk-family: two upload-only profiles for same RF stay [upload]', () => {
    // Both Phase 4 with same scoped activity → safe to narrow
    const npj1 = makeNpjInput({ policy_id: 'pol-1', source_activities: ['upload'] })
    const npj2 = makeNpjInput({
      policy_id:           'pol-2',
      source_activities:   ['upload'],
      actions_by_category: { approved_supported: 'alert', approved_with_conditions: 'block', restricted_unassessed: 'block' },
    })
    const { topologyInput, hybridResult } = buildOptionsInput([npj1, npj2])
    const options = generateTopologyOptions(topologyInput, hybridResult)
    const perRf = options.find(o => o.mode === 'per_risk_family')!
    const rfPolicy = perRf.policies.find(p => p.policy_key.includes('regulated_data'))
    assert.ok(rfPolicy)
    assert.deepEqual(rfPolicy!.activities, ['upload'], 'Both upload-only → stays narrowed')
  })

  test('per-risk-family fallback policy always has full activity set', () => {
    const { topologyInput, hybridResult } = buildOptionsInput([
      makeNpjInput({ source_activities: ['upload'] }),
    ])
    const options = generateTopologyOptions(topologyInput, hybridResult)
    const perRf = options.find(o => o.mode === 'per_risk_family')!
    const fallback = perRf.policies.find(p => p.policy_key === 'netskope:per_rf_fallback')
    assert.ok(fallback, 'Fallback policy should exist')
    assert.deepEqual(fallback!.activities, [...NETSKOPE_REALTIME_ACTIVITIES],
      'P900 catch-all must always cover all realtime activities')
  })
})

// ── Phase 4.5: source types, exclusions, required objects ─────────────────────

// Helper: make a makeNpj() with a given scope for isScopedNpj / resolveNpjScope tests.
function makeNpjWithScope(scopeOverride: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schema_version: '1.0',
    intent:         'prevent_exfiltration',
    scope:          scopeOverride,
    content:        { operator: 'any', conditions: [] },
    decision:       { mode: 'block' },
    provenance:     { generated_from: 'manual' },
  }
}

function makeScopedNpjWith(overrides: Partial<ScopedNpjInput> = {}): ScopedNpjInput {
  return {
    policy_id:           'pol-1',
    policy_name:         'Test Policy',
    policy_family:       'genai_content_detection',
    risk_family_key:     'regulated_data',
    risk_family_label:   'Regulated Data',
    actions_by_category: { approved_supported: 'block', approved_with_conditions: 'block', restricted_unassessed: 'block' },
    source:      { type: 'user_group', value: 'HR Users' },
    destination: { type: 'app_instance', value: 'Microsoft Copilot — Personal' },
    ...overrides,
  }
}

describe('Phase 4.5 — isScopedNpj: new source types', () => {

  test('source.type = user is scoped', () => {
    assert.equal(isScopedNpj(makeNpjWithScope({ source: { type: 'user', value: 'alice@company.com' } })), true)
  })

  test('source.type = organizational_unit is scoped', () => {
    assert.equal(isScopedNpj(makeNpjWithScope({ source: { type: 'organizational_unit', value: 'OU=Sales,DC=corp' } })), true)
  })

  test('source.type = all_users is NOT scoped (no destination)', () => {
    assert.equal(isScopedNpj(makeNpjWithScope({ source: { type: 'all_users', value: null } })), false)
  })

  test('legacy scope.users still triggers scoped detection', () => {
    assert.equal(isScopedNpj(makeNpjWithScope({ users: ['LegacyGroup'] })), true)
  })
})

describe('Phase 4.5 — resolveNpjScope: new source types + exclusion parsing', () => {

  test('source.type = user resolves correctly', () => {
    const result = resolveNpjScope(makeNpjWithScope({ source: { type: 'user', value: 'alice@company.com' } }))
    assert.ok(result)
    assert.equal(result.source.type, 'user')
    assert.equal(result.source.value, 'alice@company.com')
    assert.equal(result.exclusions.length, 0)
  })

  test('source.type = organizational_unit resolves correctly', () => {
    const result = resolveNpjScope(makeNpjWithScope({ source: { type: 'organizational_unit', value: 'OU=Sales,DC=corp' } }))
    assert.ok(result)
    assert.equal(result.source.type, 'organizational_unit')
    assert.equal(result.source.value, 'OU=Sales,DC=corp')
  })

  test('valid exclusion is parsed and returned', () => {
    const result = resolveNpjScope(makeNpjWithScope({
      source:     { type: 'user_group', value: 'Engineering' },
      exclusions: [{ type: 'user', value: 'contractor@company.com' }],
    }))
    assert.ok(result)
    assert.equal(result.exclusions.length, 1)
    assert.equal(result.exclusions[0].type,  'user')
    assert.equal(result.exclusions[0].value, 'contractor@company.com')
  })

  test('multiple exclusions of different types are all parsed', () => {
    const result = resolveNpjScope(makeNpjWithScope({
      source: { type: 'organizational_unit', value: 'OU=Sales,DC=corp' },
      exclusions: [
        { type: 'user',               value: 'intern@company.com' },
        { type: 'user_group',         value: 'Sales-Interns' },
        { type: 'organizational_unit', value: 'OU=Contractors,DC=corp' },
      ],
    }))
    assert.ok(result)
    assert.equal(result.exclusions.length, 3)
  })

  test('ad_group in exclusions is silently dropped (not a verified Netskope exclusion type)', () => {
    const result = resolveNpjScope(makeNpjWithScope({
      source:     { type: 'user_group', value: 'Engineering' },
      exclusions: [{ type: 'ad_group', value: 'CN=Admins,DC=corp' }],
    }))
    assert.ok(result)
    assert.equal(result.exclusions.length, 0, 'ad_group must be dropped from exclusions')
  })

  test('exclusion with empty value is dropped', () => {
    const result = resolveNpjScope(makeNpjWithScope({
      source:     { type: 'user_group', value: 'Engineering' },
      exclusions: [{ type: 'user', value: '   ' }],
    }))
    assert.ok(result)
    assert.equal(result.exclusions.length, 0)
  })

  test('exclusion with invalid type is dropped', () => {
    const result = resolveNpjScope(makeNpjWithScope({
      source:     { type: 'user_group', value: 'Engineering' },
      exclusions: [{ type: 'unknown_type', value: 'something' }],
    }))
    assert.ok(result)
    assert.equal(result.exclusions.length, 0)
  })

  test('non-array exclusions field is ignored gracefully', () => {
    const result = resolveNpjScope(makeNpjWithScope({
      source:     { type: 'user_group', value: 'Engineering' },
      exclusions: 'not-an-array',
    }))
    assert.ok(result)
    assert.equal(result.exclusions.length, 0)
  })
})

describe('Phase 4.5 — buildScopedPolicies: exclusions, group key, required objects', () => {

  test('exclusions are preserved on policy source', () => {
    const exclusions: NpjScopeExclusion[] = [{ type: 'user', value: 'contractor@company.com' }]
    const npj = makeScopedNpjWith({ source_exclusions: exclusions })
    const result = buildScopedPolicies([npj])
    assert.deepEqual(result.policies[0].source.exclusions, exclusions)
  })

  test('policy source has no exclusions field when source_exclusions is empty', () => {
    const npj = makeScopedNpjWith()  // no exclusions
    const result = buildScopedPolicies([npj])
    assert.equal(result.policies[0].source.exclusions, undefined)
  })

  test('different exclusions on same source+dest produce separate policies (not collapsed)', () => {
    const npj1 = makeScopedNpjWith({
      policy_id:        'pol-1',
      source_exclusions: [{ type: 'user', value: 'alice@company.com' }],
    })
    const npj2 = makeScopedNpjWith({
      policy_id:        'pol-2',
      source_exclusions: [{ type: 'user', value: 'bob@company.com' }],
    })
    const result = buildScopedPolicies([npj1, npj2])
    assert.equal(result.policies.length, 2, 'Different exclusions must produce separate policies')
  })

  test('same exclusions on same source+dest are grouped into one policy', () => {
    const excl: NpjScopeExclusion[] = [{ type: 'user', value: 'shared@company.com' }]
    const npj1 = makeScopedNpjWith({ policy_id: 'pol-1', source_exclusions: excl })
    const npj2 = makeScopedNpjWith({ policy_id: 'pol-2', risk_family_key: 'credentials_keys_secrets', risk_family_label: 'Credentials', source_exclusions: excl })
    const result = buildScopedPolicies([npj1, npj2])
    assert.equal(result.policies.length, 1, 'Same source+dest+exclusions must be grouped')
    assert.equal(result.policies[0].profiles.length, 2)
  })

  test('source.type = user populates required_objects.users', () => {
    const npj = makeScopedNpjWith({ source: { type: 'user', value: 'alice@company.com' } })
    const result = buildScopedPolicies([npj])
    assert.ok(result.required_objects.users.includes('alice@company.com'))
  })

  test('source.type = organizational_unit populates required_objects.organizational_units', () => {
    const npj = makeScopedNpjWith({ source: { type: 'organizational_unit', value: 'OU=Sales,DC=corp' } })
    const result = buildScopedPolicies([npj])
    assert.ok(result.required_objects.organizational_units.includes('OU=Sales,DC=corp'))
  })

  test('exclusion targets are collected into required_objects', () => {
    const npj = makeScopedNpjWith({
      source: { type: 'user_group', value: 'Engineering' },
      source_exclusions: [
        { type: 'user',               value: 'contractor@company.com' },
        { type: 'organizational_unit', value: 'OU=Contractors,DC=corp' },
      ],
    })
    const result = buildScopedPolicies([npj])
    assert.ok(result.required_objects.users.includes('contractor@company.com'),
      'exclusion user must appear in required_objects.users')
    assert.ok(result.required_objects.organizational_units.includes('OU=Contractors,DC=corp'),
      'exclusion OU must appear in required_objects.organizational_units')
    // source still tracked too
    assert.ok(result.required_objects.user_groups.includes('Engineering'))
  })

  test('user_group in exclusions appears in required_objects.user_groups', () => {
    const npj = makeScopedNpjWith({
      source: { type: 'organizational_unit', value: 'OU=Sales,DC=corp' },
      source_exclusions: [{ type: 'user_group', value: 'Sales-Interns' }],
    })
    const result = buildScopedPolicies([npj])
    assert.ok(result.required_objects.user_groups.includes('Sales-Interns'))
  })

  test('empty required_objects.users and .organizational_units when no user/OU scoped policies', () => {
    const npj = makeScopedNpjWith()  // user_group source, no exclusions
    const result = buildScopedPolicies([npj])
    assert.deepEqual(result.required_objects.users, [])
    assert.deepEqual(result.required_objects.organizational_units, [])
  })
})

// ── Destination model correction tests ───────────────────────────────────────

function makeBaseInput(overrides: Partial<NpjInput> = {}): NpjInput {
  return {
    policy_id:           'p1',
    policy_name:         'Test Policy',
    policy_family:       'genai_content_detection',
    risk_family_key:     'rf:test',
    risk_family_label:   'Test RF',
    actions_by_category: { approved_supported: 'block', approved_with_conditions: 'block', restricted_unassessed: 'alert' },
    ...overrides,
  }
}

describe('Destination model — topology outputs', () => {
  const input = makeBaseInput()
  const buckets = transposeNpjs([input], new Set(), new Set(['approved_supported', 'approved_with_conditions', 'restricted_unassessed']))
  const topology = buildTopology({ buckets, alwaysBlockNpjs: [], prohibitedCategory: null, skippedCount: 0 })
  const policies = topology.recommended_policies

  test('P300 (approved_supported) — strategy app_category, tag_or_category Generative AI, cci_app_tag set', () => {
    const p = policies.find(p => p.policy_key === 'netskope:approved_supported')
    assert.ok(p)
    assert.equal(p.destination.strategy, 'app_category')
    assert.equal(p.destination.tag_or_category, 'Generative AI')
    assert.equal(p.destination.cci_app_tag, 'Approved & Supported GenAI')
  })

  test('P400 (approved_with_conditions) — strategy app_category, cci_app_tag set', () => {
    const p = policies.find(p => p.policy_key === 'netskope:approved_with_conditions')
    assert.ok(p)
    assert.equal(p.destination.strategy, 'app_category')
    assert.equal(p.destination.tag_or_category, 'Generative AI')
    assert.equal(p.destination.cci_app_tag, 'Approved with Conditions GenAI')
  })

  test('P900 (restricted_unassessed) — strategy app_category, no cci_app_tag', () => {
    const p = policies.find(p => p.policy_key === 'netskope:restricted_unassessed')
    assert.ok(p)
    assert.equal(p.destination.strategy, 'app_category')
    assert.equal(p.destination.tag_or_category, 'Generative AI')
    assert.ok(!p.destination.cci_app_tag)
  })

  test('P200 (always-block) — strategy app_category, no cci_app_tag', () => {
    // Must use a risk_family_key in ALWAYS_BLOCK_PROFILE_KEYS ('credentials_keys_secrets')
    const abNpj = makeBaseInput({
      risk_family_key:     'credentials_keys_secrets',
      actions_by_category: { approved_supported: 'block', approved_with_conditions: 'block', restricted_unassessed: 'block' },
    })
    const ab = extractAlwaysBlockProfiles([abNpj])
    assert.equal(ab.length, 1, 'extractAlwaysBlockProfiles should return 1 entry')
    const t2   = buildTopology({ buckets, alwaysBlockNpjs: ab, prohibitedCategory: null, skippedCount: 0 })
    const p200 = t2.recommended_policies.find(p => p.policy_key === 'netskope:always_block_global_dlp')
    assert.ok(p200)
    assert.equal(p200.destination.strategy, 'app_category')
    assert.equal(p200.destination.tag_or_category, 'Generative AI')
    assert.ok(!p200.destination.cci_app_tag)
  })

  test('P100 (prohibited) — strategy app_category, cci_app_tag = prohibited category name', () => {
    const t3 = buildTopology({
      buckets,
      alwaysBlockNpjs:    [],
      prohibitedCategory: { id: 'cat-1', name: 'Prohibited GenAI', system_tag: 'prohibited' },
      skippedCount:       0,
    })
    const p100 = t3.recommended_policies.find(p => p.policy_key === 'netskope:prohibited_access_block')
    assert.ok(p100)
    assert.equal(p100.destination.strategy, 'app_category')
    assert.equal(p100.destination.tag_or_category, 'Generative AI')
    assert.equal(p100.destination.cci_app_tag, 'Prohibited GenAI')
  })

  test('required_objects: cci_app_tags collected from cci_app_tag field, not tag_or_category', () => {
    const t4 = buildTopology({ buckets, alwaysBlockNpjs: [], prohibitedCategory: null, skippedCount: 0 })
    const tags = t4.required_objects.cci_app_tags
    assert.ok(tags.includes('Approved & Supported GenAI'))
    assert.ok(tags.includes('Approved with Conditions GenAI'))
    // "Generative AI" (the category) must NOT appear in cci_app_tags
    assert.ok(!tags.includes('Generative AI'))
    // "Generative AI" should appear in app_categories
    assert.ok(t4.required_objects.app_categories.includes('Generative AI'))
  })
})
