# DLP Shield — TODO

Format: `[ ]` not started · `[~]` in progress · `[x]` done

---

## 🔴 Immediate (Phase 4)

- [ ] **topology.ts:259** — Replace hardcoded `['post', 'upload', 'prompt_submit']` with union of `scope.activities` from NPJ bucket profiles. Requires threading `source_activities` through `NpjInput` → `transposeNpjs` → `buildTopology`.
- [ ] **scoped.ts:288** — Same fix for scoped policies. Union `scope.activities` across all NPJs in each group. Requires adding `source_activities?: string[]` to `ScopedNpjInput` and populating it in `recommendation/page.tsx`.
- [ ] **Policy Editor Scope UI** — Add Source / Destination fields to `policy-intent-editor.tsx` so users can define AD group / app instance scope from the editor. Writes to `neutral_policy_json.scope.source` and `.destination`.

---

## 🟡 Soon (Phase 4 follow-up)

- [ ] **`FAMILY_TO_PROFILE_TYPE` per org** — `transpose.ts:24` — Create `org_netskope_profile_type_map` table. Fetch at recommendation compile time and merge with hardcoded defaults.
- [ ] **Activity scoping display** — In `NativePolicyCard`, show the derived activities instead of always showing `['post', 'upload', 'prompt_submit']`. Update the activities row display in the card.
- [ ] **Test: scoped.test.ts** — Add test cases for the new activity scoping logic once implemented.

---

## 🟠 Deferred (not blocking V1)

- [ ] **policy-list.tsx decomposition** — 1,600+ lines, 36 hooks. Phase 5 plan: extract `useFilterState`, `useSelectionState`, `useColumnVisibility` to a custom hook `use-policy-list.ts`. `BulkDeleteConfirmModal` + `NewPolicyModal` already in `policy-modals.tsx` — continue from there. Only after Phases 1–4 stable.
- [ ] **Compliance audit trail pagination** — Currently loads all records at once
- [ ] **Nil UUID in cron log** — Known issue in cron audit table
- [ ] **AI discovery review gate** — AI-generated content should go through admin review panel before surfacing to users (V1 spec, not yet implemented)
- [ ] **Notification on regulation update** — Alert users when a regulation they've mapped to gets updated
- [ ] **Vestigial DlpControl fields** — Some leftover fields from old schema in compliance pages
- [ ] **Auth token caching** — `requireRole()` creates a new Supabase client per call. Performance tradeoff: caching the token has security implications. Defer.
- [ ] **genai-refresh parallel AI calls** — Currently sequential per-app. Parallelising requires restructuring the logic (race condition risks). Defer.

---

## 🔵 V2+ Roadmap (out of scope for V1)

- [ ] White-label branding / consulting firm client-switching
- [ ] Netskope API integration (real log analysis, auto gap discovery)
- [ ] Endpoint DLP deep coverage
- [ ] Microsoft Purview adapter (`src/lib/genai/purview/` mirroring `netskope/`)
- [ ] Billing and payments

---

## ✅ Recently Completed

- [x] Netskope Phase 1: Hybrid category topology
- [x] Netskope Phase 2: Topology options (Hybrid / Consolidated / Per-RF)
- [x] Netskope Phase 3: Scoped NPJ detection + Strategy overrides
- [x] Exact Netskope Profile & Action UI rules
- [x] Manual policies in Netskope recommendation page
- [x] Translation Hub removed → Netskope Policies promoted as primary vendor page
- [x] Dynamic category names throughout (app governance renames propagate everywhere)
- [x] `syncRecommendedPolicies` batched: 30+ sequential upserts → 2 bulk ops
- [x] Security audit: requireRole everywhere, auth-check admin-gated, policy-chat analyst-gated
- [x] Type dedup: NpjCondition/NpjShape moved to canonical location
- [x] Control matrix error handling: sync failures return `{ warning }` not swallowed
- [x] `select('*')` replaced with explicit columns on policies page (audited 3 consumers)
- [x] Production UI: Sonner toasts, error.tsx boundary, loading.tsx skeletons, sidebar indicator
- [x] UI pass 2: FadeIn component, stat card icons, governance accordion animation, policy row hover
- [x] `alert()` removed from policy-list.tsx → toast.error
- [x] `matrix_basis` "Customized Matrix" label fixed (hasOverride logic)
- [x] Filename policies showing "Customer label" → fixed to "Filename pattern"
- [x] Reset Matrix to Defaults button added to control matrix
- [x] 3-dot menu items unclickable (mousedown closed menu before click fired) → fixed
