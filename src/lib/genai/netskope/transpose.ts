// Matrix Transposition Engine
// Converts NPJ structure (risk_family × category → action)
// into Netskope structure (category → [profiles]).

import type {
  CategoryBuckets, NetskopeCategory, NpjProfileType, TransposedProfile,
} from './types'

const CATEGORIES: NetskopeCategory[] = [
  'approved_supported',
  'approved_with_conditions',
  'restricted_unassessed',
]

const FAMILY_TO_PROFILE_TYPE: Record<string, NpjProfileType> = {
  genai_content_detection: 'content_detection',
  genai_label_detection:   'classification_label',
  genai_filename:          'filename_detection',
  genai_filetype:          'filetype_detection',
}

// Risk family keys that go into the global always-block policy (Policy 200) when
// they are block on ALL non-prohibited categories.
// TODO: make this configurable per org in a future phase.
const ALWAYS_BLOCK_PROFILE_KEYS = new Set([
  'credentials_keys_secrets',
])

export interface NpjInput {
  policy_id:           string
  policy_name:         string
  policy_family:       string
  risk_family_key:     string
  risk_family_label:   string
  actions_by_category: Record<string, string>
  coaching_by_category?: Record<string, string | null>
}

// Returns NPJs that qualify for the global always-block policy:
// 1. action === 'block' for ALL three non-prohibited categories
// 2. AND risk_family_key is in ALWAYS_BLOCK_PROFILE_KEYS
export function extractAlwaysBlockProfiles(npjs: NpjInput[]): NpjInput[] {
  return npjs.filter(npj =>
    ALWAYS_BLOCK_PROFILE_KEYS.has(npj.risk_family_key) &&
    CATEGORIES.every(cat => npj.actions_by_category[cat] === 'block')
  )
}

// Transposes NPJs into category buckets, excluding always-block risk families.
// action === 'allow' profiles are skipped (no DLP enforcement profile needed).
export function transposeNpjs(
  npjs:            NpjInput[],
  alwaysBlockKeys: Set<string>,
): CategoryBuckets {
  const buckets: CategoryBuckets = {
    approved_supported:       [],
    approved_with_conditions: [],
    restricted_unassessed:    [],
  }

  for (const npj of npjs) {
    if (alwaysBlockKeys.has(npj.risk_family_key)) continue

    const profileType = FAMILY_TO_PROFILE_TYPE[npj.policy_family]
    if (!profileType) continue

    // All categories present in this NPJ: standard first (ordered), then custom.
    // Use a Set to guarantee no duplicates (standard cats might also appear in
    // actions_by_category keys, but the filter below handles that).
    const customKeys = Object.keys(npj.actions_by_category).filter(
      k => k && !(CATEGORIES as readonly string[]).includes(k) && k !== 'prohibited'
    )
    const allCats = [...CATEGORIES, ...customKeys]

    for (const cat of allCats) {
      const action = npj.actions_by_category[cat]
      if (!action || action === 'allow') continue

      if (!buckets[cat]) buckets[cat] = []

      const profile: TransposedProfile = {
        risk_family_key:      npj.risk_family_key,
        risk_family_label:    npj.risk_family_label,
        profile_type:         profileType,
        action,
        coaching_template_id: npj.coaching_by_category?.[cat] ?? null,
      }
      buckets[cat].push(profile)
    }
  }

  return buckets
}
