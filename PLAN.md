# DLP Shield — Active Plan

## Current Phase: Phase 4 — Netskope Activity Scoping

### What Phase 4 Fixes
All Netskope policies currently use a hardcoded activity set `['post', 'upload', 'prompt_submit']`.
This means a policy that only covers file uploads gets incorrectly scoped to prompts too.
Phase 4 derives activities from the union of `scope.activities` across the actual NPJ bucket profiles.

### Phase 4 — Part 1: Fix hardcoded activities (2 files)

**`src/lib/genai/netskope/topology.ts:259`**
Inside the per-category policy build loop, replace:
```ts
activities: ['post', 'upload', 'prompt_submit'],
```
With: union of `scope.activities` from each `TransposedProfile`'s source NPJ.
The `buckets` object contains `TransposedProfile[]` per category. Each profile has a `risk_family_key`.
Map `risk_family_key` → NPJ `scope.activities` from the original `validNpjs` array (pass it through).

**`src/lib/genai/netskope/scoped.ts:288`**
Inside `buildScopedPolicies`, replace:
```ts
const activities = ['post', 'upload', 'prompt_submit']
```
With: union of `scope.activities` across all NPJs in the group:
```ts
const activities = [...new Set(
  group.npjs.flatMap(n => n.source_activities ?? ['post', 'upload', 'prompt_submit'])
)]
```
Pass `source_activities` through `ScopedNpjInput` from page.tsx where the NPJ `scope.activities` is available.

### Phase 4 — Part 2: Policy Editor Scope UI

**`src/app/(app)/genai-controls/policies/[id]/edit/_components/policy-intent-editor.tsx`**

Add a "Scope" card to the NPJ editor allowing users to define:
- **Source**: All Users (default) | AD Group (+ text input for group name)
- **Destination**: App Tag (default) | App Instance (+ text input for instance name)

When saved, write to `neutral_policy_json.scope.source` and `neutral_policy_json.scope.destination`.
This makes the policy a scoped NPJ → Phase 3 picks it up as a P210–P290 scoped policy automatically.

---

## Upcoming Phases (after Phase 4)

### Phase 5 — `FAMILY_TO_PROFILE_TYPE` Per-Org Configuration
**`src/lib/genai/netskope/transpose.ts:24`**
Currently hardcoded. Orgs with custom policy families can't map to Netskope profile types.
Add a DB table `org_netskope_profile_type_map` and fetch at compile time.

### Phase 6 — Netskope API Integration (V3 roadmap)
Real log analysis from Netskope API. Auto-discovers gaps from live policy events.
Requires Netskope OAuth setup per org. Major feature, defer until V3.

### Phase 7 — Multi-Tool Platform (V5-6 roadmap)
Microsoft Purview adapter. The NPJ model is already tool-agnostic — only a new
translator needed in `src/lib/genai/purview/` (mirrors the `netskope/` structure).

---

## Recently Completed

- ✅ Phase 1: Hybrid category-based topology
- ✅ Phase 2: Topology options (Hybrid / Consolidated / Per-Risk-Family)
- ✅ Phase 3: Scoped NPJ detection (P210–P290) + Strategy Override panel
- ✅ Manual policies section on Netskope recommendation page
- ✅ Exact Netskope Profile & Action rules (per-profile vs single action, alert-only continue checkbox, traffic action link)
- ✅ Production UI polish: Sonner toasts, error boundary, loading skeletons, sidebar indicator
- ✅ UI/UX pass 2: Framer Motion animations, stat card icons, governance accordion, policy row hover
- ✅ Security audit: requireRole everywhere, auth-check gated, JWT decode removed
- ✅ Perf: syncRecommendedPolicies batched to 2 DB calls (was 30+)
- ✅ Type dedup: NpjCondition/NpjShape canonical in lib/genai/types.ts
