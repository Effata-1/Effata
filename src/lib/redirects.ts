/**
 * redirects.ts — single source of truth for all HTTP redirects.
 *
 * Consumed by:
 *   - next.config.ts  (relative import: './src/lib/redirects')
 *   - nav.test.ts     (@ alias: '@/lib/redirects')
 *
 * CONSTRAINT: no imports from @/, next/*, nav.ts, or any other app code.
 * This file must be config-safe (loaded at Next.js startup).
 *
 * Redirect types:
 *   - Section roots   — not NAV pages; manually listed
 *   - Non-NAV pages   — moved routes with no nav.ts entry; manually listed
 *   - NAV-backed      — must stay in sync with legacyRoutes in nav.ts (enforced by sync test)
 */

export const REDIRECT_RULES: { source: string; destination: string }[] = [
  // ── Section roots (not NAV pages) ──────────────────────────────────────────
  { source: '/policies',         destination: '/foundation'              },
  { source: '/policies/library', destination: '/genai-controls/policies' },

  // ── Non-NAV pages (moved routes with no nav.ts entry) ────────────────────────
  { source: '/genai-controls/vendor-mapping/netskope/architecture', destination: '/genai-controls/netskope-pack/flow' },
  // vendor-mapping root 404s; /netskope sub-page stays live (linked as "Netskope Mapping")
  { source: '/genai-controls/vendor-mapping', destination: '/genai-controls/netskope-pack' },

  // ── NAV-backed redirects (must match LEGACY_REDIRECTS from nav.ts) ─────────
  { source: '/policies/coaching-templates',                            destination: '/genai-controls/coaching-messages'    },
  { source: '/policies/data-catalog',                                  destination: '/foundation/data-catalog'              },
  { source: '/policies/classifications',                               destination: '/foundation/labels'                    },
  { source: '/policies/sensitivity-labels',                            destination: '/foundation/sensitivity-labels'        },
  { source: '/policies/destinations',                                  destination: '/foundation/destinations'              },
  { source: '/policies/identity',                                      destination: '/foundation/identity'                  },
  { source: '/genai-controls/presentation',                            destination: '/genai-controls/executive-report'      },
  { source: '/genai-controls/vendor-mapping/netskope/recommendation', destination: '/genai-controls/netskope-pack'         },
  { source: '/policies/channels',                                      destination: '/foundation/channels'                  },

  // ── Non-NAV wildcards and legacy /channels tree ────────────────────────────
  { source: '/policies/channels/:channel',  destination: '/foundation/channels/:channel' },
  { source: '/channels',                    destination: '/foundation/channels'           },
  { source: '/channels/:channel',           destination: '/foundation/channels/:channel'  },
]
// Total: 16 redirects (7 non-NAV-backed + 9 NAV-backed)
