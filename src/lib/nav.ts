/**
 * nav.ts — single source of truth for application navigation configuration.
 *
 * Dependency-free (no React, no icons). Consumed by layouts, sidebars, and tests.
 * All routes use absolute paths with a leading slash.
 */

export type UserRole = 'admin' | 'analyst' | 'read_only'

export interface NavPage {
  id:            string
  label:         string
  route:         string        // absolute path with leading slash
  minRole?:      UserRole      // defaults to section.minRole, or 'analyst' if section has none
  step?:         number        // GenAI Controls engagement spine only
  badge?:        'deliverable'
  legacyRoutes?: string[]      // old paths that redirect to this page
}

export interface NavSection {
  id:       string
  label:    string
  minRole?: UserRole           // applies to the whole section; default: 'analyst'
  pages:    NavPage[]
}

// ── Navigation config ─────────────────────────────────────────────────────────

export const NAV: NavSection[] = [
  {
    id:      'home',
    label:   'Dashboard',
    minRole: 'read_only',
    pages: [
      { id: 'dashboard', label: 'Dashboard', route: '/dashboard', minRole: 'read_only' },
    ],
  },
  {
    id:    'architecture',
    label: 'Architecture',
    pages: [
      { id: 'arch-framework', label: 'Global Framework',  route: '/architecture/framework' },
      { id: 'arch-yours',     label: 'Your Architecture', route: '/architecture/yours' },
      { id: 'arch-gaps',      label: 'Gap Analysis',      route: '/architecture/gaps' },
    ],
  },
  {
    id:    'genai-controls',
    label: 'GenAI Controls',
    pages: [
      { id: 'app-catalog',          label: 'App Catalog',         route: '/genai-controls/apps',                                              step: 1 },
      { id: 'app-governance',       label: 'App Governance',      route: '/genai-controls/app-governance',                                    step: 2 },
      { id: 'control-matrix',       label: 'Control Matrix',      route: '/genai-controls/control-matrix',                                    step: 3 },
      { id: 'policy-library',       label: 'Policy Library',      route: '/genai-controls/policies',                                          step: 4 },
      { id: 'coaching-messages',    label: 'Coaching Messages',   route: '/genai-controls/coaching-messages', legacyRoutes: ['/policies/coaching-templates'], step: 5 },
      { id: 'netskope-policy-pack', label: 'Netskope Policy Pack',route: '/genai-controls/vendor-mapping/netskope/recommendation',             step: 6, badge: 'deliverable' },
      { id: 'executive-report',     label: 'Executive Report',    route: '/genai-controls/presentation',                                      step: 7, badge: 'deliverable' },
    ],
  },
  {
    id:    'foundation',
    label: 'Foundation',
    pages: [
      { id: 'data-catalog',       label: 'Data Catalog',       route: '/policies/data-catalog' },
      { id: 'labels',             label: 'Labels',             route: '/policies/classifications' },
      { id: 'sensitivity-labels', label: 'Sensitivity Labels', route: '/policies/sensitivity-labels' },
      { id: 'destinations',       label: 'Destinations',       route: '/policies/destinations' },
      { id: 'identity-context',   label: 'Identity Context',   route: '/policies/identity' },
    ],
  },
  {
    id:    'test-evidence',
    label: 'Test & Evidence',
    pages: [
      { id: 'control-validator', label: 'Control Validator', route: '/tools/control-validator' },
      { id: 'evidence-report',   label: 'Evidence Report',   route: '/tools/evidence-report', badge: 'deliverable' },
      { id: 'regex-lab',         label: 'Regex Lab',         route: '/tools/regex-lab' },
      { id: 'data-lab',          label: 'Data Lab',          route: '/tools/test-data' },
    ],
  },
  {
    id:    'dlp-tools',
    label: 'DLP Tools',
    pages: [
      { id: 'dlp-market',  label: 'Market Overview', route: '/dlp-tools/market' },
      { id: 'dlp-stack',   label: 'My Stack',        route: '/dlp-tools/my-stack' },
      { id: 'dlp-advisor', label: 'AI Advisor',      route: '/dlp-tools/advisor' },
    ],
  },
  {
    id:    'compliance',
    label: 'Compliance',
    pages: [
      { id: 'compliance-overview',    label: 'Overview',                 route: '/compliance' },
      { id: 'compliance-regulations', label: 'Regulations & Frameworks', route: '/compliance/regulations' },
      { id: 'compliance-gap-report',  label: 'Gap Report',               route: '/compliance/gap-report' },
      { id: 'compliance-audit-trail', label: 'Audit Trail',              route: '/compliance/audit-trail' },
    ],
  },
  {
    id:      'settings',
    label:   'Settings',
    minRole: 'admin',
    // No per-page minRole needed — section-level 'admin' is inherited by effectiveMinRole()
    pages: [
      { id: 'settings-tools',        label: 'Tools Connected', route: '/settings/tools'              },
      { id: 'settings-team',         label: 'Team',            route: '/settings/team'               },
      { id: 'settings-integrations', label: 'Integrations',    route: '/settings/integrations'       },
      { id: 'settings-appearance',   label: 'Appearance',      route: '/settings/appearance'         },
      { id: 'settings-audit-log',    label: 'Audit Log',       route: '/settings/admin/audit-log'    },
      { id: 'settings-refresh-logs', label: 'Refresh Logs',    route: '/settings/admin/refresh-logs' },
      { id: 'settings-cron-runs',    label: 'Cron Runs',       route: '/settings/admin/cron-runs'    },
      { id: 'settings-ai-logs',      label: 'AI Logs',         route: '/settings/admin/ai-logs'      },
    ],
  },
]

// ── Spine ─────────────────────────────────────────────────────────────────────
// GenAI Controls pages in engagement-spine order.
export const SPINE: NavPage[] = NAV
  .find(s => s.id === 'genai-controls')!
  .pages
  .filter((p): p is NavPage & { step: number } => p.step !== undefined)
  .sort((a, b) => a.step - b.step)

// ── Role utilities ────────────────────────────────────────────────────────────

const ROLE_RANK: Record<UserRole, number> = {
  read_only: 0,
  analyst:   1,
  admin:     2,
}

// Precomputed: page.id → its parent section (for section-level minRole lookup)
const PAGE_SECTION_MAP = new Map<string, NavSection>(
  NAV.flatMap(s => s.pages.map(p => [p.id, s] as [string, NavSection]))
)

/**
 * Returns the effective minimum role for a page, taking the stricter of:
 * - the section's minRole (e.g. `settings` section requires 'admin')
 * - the page's own minRole
 *
 * Falls back to 'analyst' when neither is set.
 */
export function effectiveMinRole(page: NavPage): UserRole {
  const section     = PAGE_SECTION_MAP.get(page.id)
  const sectionRole = section?.minRole
  const pageRole    = page.minRole
  if (!sectionRole) return pageRole ?? 'analyst'
  if (!pageRole)    return sectionRole
  return ROLE_RANK[sectionRole] >= ROLE_RANK[pageRole] ? sectionRole : pageRole
}

export function canSee(page: NavPage, role: UserRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[effectiveMinRole(page)]
}

// ── Lookup helpers ────────────────────────────────────────────────────────────

const ALL_PAGES: NavPage[] = NAV.flatMap(s => s.pages)

/** Returns the page with the given id, or throws if not found. */
export function pageById(id: string): NavPage {
  const page = ALL_PAGES.find(p => p.id === id)
  if (!page) throw new Error(`nav.ts: no page with id "${id}"`)
  return page
}

/** Returns the first page matching the predicate, or undefined. */
export function findPage(predicate: (p: NavPage) => boolean): NavPage | undefined {
  return ALL_PAGES.find(predicate)
}

/**
 * Returns the section and page whose route is the longest prefix of `pathname`.
 * Used for breadcrumbs and active-link highlighting.
 */
export function breadcrumbFor(
  pathname: string,
): { section: NavSection; page: NavPage } | null {
  let best: { section: NavSection; page: NavPage; matchLen: number } | null = null

  for (const section of NAV) {
    for (const page of section.pages) {
      const isMatch =
        pathname === page.route ||
        pathname.startsWith(page.route + '/')

      if (isMatch) {
        const matchLen = page.route.length
        if (!best || matchLen > best.matchLen) {
          best = { section, page, matchLen }
        }
      }
    }
  }

  return best ? { section: best.section, page: best.page } : null
}

// ── Legacy redirects ──────────────────────────────────────────────────────────
// Derived from legacyRoutes entries across all pages.
// next.config.ts can consume this array directly.
export const LEGACY_REDIRECTS: { source: string; destination: string }[] =
  ALL_PAGES.flatMap(p =>
    (p.legacyRoutes ?? []).map(src => ({ source: src, destination: p.route })),
  )
