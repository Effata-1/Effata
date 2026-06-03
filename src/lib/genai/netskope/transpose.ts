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
// validCategoryTags: set of system_tags that exist in org_genai_governance_categories.
// Custom keys in actions_by_category that are NOT in this set are silently dropped —
// this catches AI-assisted or blank policies whose category keys drifted after the
// policy was created (e.g. a category was renamed or deleted).
export function transposeNpjs(
  npjs:               NpjInput[],
  alwaysBlockKeys:    Set<string>,
  validCategoryTags?: Set<string>,
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

    // Standard categories first (ordered), then custom keys that:
    //   - are non-empty
    //   - are not 'prohibited'
    //   - are not one of the 3 standard keys (already included above)
    //   - exist as a real org category (if validCategoryTags was supplied)
    const customKeys = Object.keys(npj.actions_by_category).filter(k => {
      if (!k || k === 'prohibited') return false
      if ((CATEGORIES as readonly string[]).includes(k)) return false
      if (validCategoryTags && !validCategoryTags.has(k)) return false
      return true
    })
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
