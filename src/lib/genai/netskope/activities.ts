// Phase 4: Activity scoping helpers for the Netskope recommendation engine.
// Single source of truth for the realtime-inspectable activity constant.
// Import from here — never copy the inline literal.

/**
 * Netskope realtime-inspectable activities for GenAI content policies.
 * Ordered canonically (matches Netskope UI ordering convention).
 *
 * Deliberately excludes: browse, login (access control only),
 * download / response (output inspection — not yet modelled).
 * Add output-inspection activities in a future phase when the engine models them.
 */
export const NETSKOPE_REALTIME_ACTIVITIES = ['post', 'upload', 'prompt_submit'] as const
export type NetskopeRealtimeActivity = (typeof NETSKOPE_REALTIME_ACTIVITIES)[number]

/**
 * Union of activities from all contributing NPJ profiles for a given policy,
 * filtered to the realtime-inspectable set and preserved in canonical order.
 *
 * - `lists`: each element is the `scope.activities` from one contributing NPJ.
 *   Pass `undefined` for NPJs that pre-date Phase 4 (no activities field set).
 *
 * **Conservative fallback rule**: if ANY element is `undefined` or an empty
 * array, the full `NETSKOPE_REALTIME_ACTIVITIES` set is returned. This is
 * intentional — an `undefined` entry means "activities unknown" (pre-Phase 4
 * NPJ), so narrowing would silently drop coverage for `post`/`prompt_submit`
 * traffic that the NPJ may have previously matched.
 *
 * Activity scoping (narrowing) is only applied when ALL contributing NPJs have
 * explicit, non-empty `scope.activities` arrays.
 *
 * Additional guarantees:
 * - Non-realtime activities (browse, login, response, etc.) are always filtered out.
 * - Result is never an empty array.
 * - Canonical ordering is always preserved regardless of input order.
 */
export function unionActivities(lists: (string[] | undefined)[]): string[] {
  // Conservative: any unknown entry (undefined or empty) → full fallback.
  // "Unknown" means we cannot safely narrow — use maximum coverage.
  if (lists.length === 0 || lists.some(l => l === undefined || l.length === 0)) {
    return [...NETSKOPE_REALTIME_ACTIVITIES]
  }
  const set = new Set(lists.flat())
  const filtered = NETSKOPE_REALTIME_ACTIVITIES.filter(a => set.has(a))
  // If every activity was non-realtime (e.g. all browse/login), fall back to full set.
  return filtered.length ? [...filtered] : [...NETSKOPE_REALTIME_ACTIVITIES]
}
