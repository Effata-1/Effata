import { test } from 'node:test'
import assert from 'node:assert/strict'
import { NAV, SPINE, canSee, effectiveMinRole, pageById, breadcrumbFor, LEGACY_REDIRECTS } from '../nav'
import { REDIRECT_RULES } from '../redirects'

test('pageById returns the correct page', () => {
  const page = pageById('app-catalog')
  assert.equal(page.label, 'App Catalog')
  assert.equal(page.route, '/genai-controls/apps')
  assert.equal(page.step, 1)
})

test('pageById throws for an unknown id', () => {
  assert.throws(() => pageById('nonexistent'), /nonexistent/)
})

test('SPINE: sorted by step, no duplicates, all entries have step defined', () => {
  assert.ok(SPINE.length > 0, 'SPINE must not be empty')

  for (const p of SPINE) {
    assert.ok(p.step !== undefined, `${p.id} must have step defined`)
  }

  for (let i = 1; i < SPINE.length; i++) {
    assert.ok(
      SPINE[i].step! > SPINE[i - 1].step!,
      `Step ${SPINE[i].step} must be greater than ${SPINE[i - 1].step}`,
    )
  }

  const steps = SPINE.map(p => p.step!)
  assert.equal(new Set(steps).size, steps.length, 'No duplicate step numbers')
})

test('canSee: read_only sees only minRole:read_only pages', () => {
  const allPages = NAV.flatMap(s => s.pages)
  for (const page of allPages) {
    if (page.minRole === 'read_only') {
      assert.ok(canSee(page, 'read_only'), `read_only should see ${page.id}`)
    } else {
      assert.ok(!canSee(page, 'read_only'), `read_only should NOT see ${page.id}`)
    }
  }
})

test('canSee: analyst sees analyst + read_only pages, not admin-only', () => {
  const allPages = NAV.flatMap(s => s.pages)
  for (const page of allPages) {
    if (effectiveMinRole(page) === 'admin') {
      assert.ok(!canSee(page, 'analyst'), `analyst should NOT see ${page.id} (effective: admin)`)
    } else {
      assert.ok(canSee(page, 'analyst'), `analyst should see ${page.id}`)
    }
  }
})

test('canSee: admin sees all pages', () => {
  const allPages = NAV.flatMap(s => s.pages)
  for (const page of allPages) {
    assert.ok(canSee(page, 'admin'), `admin should see ${page.id}`)
  }
})

test('effectiveMinRole: section-level minRole propagates to pages without explicit minRole', () => {
  const settings = NAV.find(s => s.id === 'settings')!
  assert.equal(settings.minRole, 'admin', 'settings section must have minRole:admin')

  for (const page of settings.pages) {
    // Pages intentionally have no per-page minRole — section level must carry it
    assert.equal(page.minRole, undefined, `${page.id} should not repeat minRole on the page`)
    assert.equal(effectiveMinRole(page), 'admin', `effectiveMinRole(${page.id}) must be 'admin'`)
  }
})

test('all settings pages require admin — analyst and read_only cannot see them', () => {
  const settings = NAV.find(s => s.id === 'settings')!
  for (const page of settings.pages) {
    assert.ok(!canSee(page, 'analyst'),   `analyst must not see ${page.id}`)
    assert.ok(!canSee(page, 'read_only'), `read_only must not see ${page.id}`)
    assert.ok( canSee(page, 'admin'),     `admin must see ${page.id}`)
  }
})

test('no duplicate route values across NAV', () => {
  const routes = NAV.flatMap(s => s.pages).map(p => p.route)
  assert.equal(
    new Set(routes).size,
    routes.length,
    `Duplicate routes found: ${routes.filter((r, i) => routes.indexOf(r) !== i).join(', ')}`,
  )
})

test('breadcrumbFor: longest prefix wins for deep paths', () => {
  const result = breadcrumbFor('/genai-controls/apps/some-detail-id')
  assert.ok(result !== null)
  assert.equal(result!.page.id, 'app-catalog')
  assert.equal(result!.section.id, 'genai-controls')
})

test('breadcrumbFor: architecture/framework resolves to arch-framework', () => {
  const result = breadcrumbFor('/architecture/framework')
  assert.ok(result !== null, 'breadcrumb must resolve for /architecture/framework')
  assert.equal(result!.section.id, 'architecture')
  assert.equal(result!.page.id, 'arch-framework')
})

test('breadcrumbFor: /dlp-tools/market resolves to dlp-market', () => {
  const result = breadcrumbFor('/dlp-tools/market')
  assert.ok(result !== null, 'breadcrumb must resolve for /dlp-tools/market')
  assert.equal(result!.section.id, 'dlp-tools')
  assert.equal(result!.page.id, 'dlp-market')
})

test('breadcrumbFor: unknown path returns null', () => {
  const result = breadcrumbFor('/unknown/path/that/does/not/exist')
  assert.equal(result, null)
})

test('LEGACY_REDIRECTS: 8 entries after Phase 3 (1 coaching + 5 foundation + 2 genai)', () => {
  assert.equal(LEGACY_REDIRECTS.length, 8, 'Phase 3: 8 legacy redirects from NAV legacyRoutes')
  assert.ok(LEGACY_REDIRECTS.some(r => r.source === '/policies/coaching-templates'),           'coaching-templates redirect present')
  assert.ok(LEGACY_REDIRECTS.some(r => r.source === '/policies/data-catalog'),                 'data-catalog redirect present')
  assert.ok(LEGACY_REDIRECTS.some(r => r.source === '/genai-controls/presentation'),           'executive-report redirect present')
  assert.ok(LEGACY_REDIRECTS.some(r => r.source === '/genai-controls/vendor-mapping/netskope/recommendation'), 'netskope-pack redirect present')
})

test('every LEGACY_REDIRECTS entry matches a REDIRECT_RULES entry (source + destination)', () => {
  for (const entry of LEGACY_REDIRECTS) {
    const match = REDIRECT_RULES.find(
      r => r.source === entry.source && r.destination === entry.destination,
    )
    assert.ok(
      match,
      `LEGACY_REDIRECTS entry { source: "${entry.source}", destination: "${entry.destination}" } ` +
      `is missing or has a drifted destination in redirects.ts`,
    )
  }
})

test('3 non-NAV manual redirects are present in REDIRECT_RULES', () => {
  const sources = REDIRECT_RULES.map(r => r.source)
  assert.ok(sources.includes('/policies'),         '/policies section root missing from REDIRECT_RULES')
  assert.ok(sources.includes('/policies/library'), '/policies/library stub redirect missing')
  assert.ok(sources.includes('/genai-controls/vendor-mapping/netskope/architecture'), 'Policy Flow redirect missing')
})
