import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { isScopedNpj, resolveNpjScope, buildScopedPolicies } from './scoped'
import type { ScopedNpjInput } from './types'

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

  test('returns true for scope.destination.type = url_list', () => {
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

  test('scope.destination.type = url_list resolves correctly', () => {
    const result = resolveNpjScope(makeNpj({
      users:       ['Finance Team'],
      destination: { type: 'url_list', value: 'personal-genai-urls' },
    }))
    assert.ok(result)
    assert.equal(result.destination.type, 'url_list')
    assert.equal(result.destination.value, 'personal-genai-urls')
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

  test('required_objects.url_lists populated for url_list destination', () => {
    const result = buildScopedPolicies([makeScopedNpj({
      source:      { type: 'user_group', value: 'Legal' },
      destination: { type: 'url_list', value: 'blocked-genai-sites' },
    })])
    assert.ok(result.required_objects.url_lists.includes('blocked-genai-sites'))
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
