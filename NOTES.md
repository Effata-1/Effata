# DLP Shield — Decisions & Context

## Core Architecture Rules (non-negotiable)

### NPJ (Neutral Policy JSON)
Every policy has a `neutral_policy_json` field — a vendor-agnostic representation.
- AI explains context → database provides exact Netskope steps. Never mix.
- AI-generated content goes through admin review before surfacing to users.
- NPJ schema validated via `validateNeutralPolicy()` in `src/lib/genai/npj-schema.ts`.
- `policy_family` on NPJ: `genai_content_detection | genai_filename | genai_label_detection | genai_app_access`

### org_id on Everything
Every DB table has `org_id`. RLS enforced. `requireRole()` in `src/lib/auth.ts` returns `{ id, email, orgId, role }`.
Never manually decode JWT — use `requireRole('analyst')` in every server action.

### Control Matrix Constants — Single Source of Truth
`src/lib/genai/control-matrix-rows.ts` owns:
- `RF_DEFAULTS` — content detection defaults per (category × risk family)
- `UL_FN_DEFAULTS` — filename detection defaults
- `UL_DC_DEFAULTS` — data classification label detection defaults
- `UL_FN_COACHING_DEFAULTS`, `UL_DC_COACHING_DEFAULTS`

**Never redeclare these locally.** Import from the canonical file. Use `TAG_ALIAS[catTag] ?? catTag` before lookup (DB may store legacy keys like `'enterprise-approved'` instead of `'approved_supported'`).

### NpjCondition / NpjShape — Single Source of Truth
`src/lib/genai/types.ts` owns `NpjCondition`, `NpjCategory`, `NpjDecision`, `NpjShape`.
These were previously duplicated in 3 files. Never redeclare locally.

---

## Filter Components
**Always use `FilterSelect` / `MultiFilterSelect` from `src/components/ui/filter-select.tsx`.**
Never use native `<select>`. This was a hard decision made after inconsistency crept in.

---

## Real-time Updates
**All mutations must update instantly.** Use `useOptimistic` + `revalidatePath` together.
Never require a page refresh. Background: this was decided after users complained about
having to reload to see changes.

---

## Netskope Engine Architecture

```
NPJs (from org_genai_policies where policy_source='recommended')
  ↓ isScopedNpj() check
  ↓
  ├── Scoped NPJs → buildScopedPolicies() → P210–P290 (scoped.ts)
  └── Default NPJs → transposeNpjs() → CategoryBuckets (transpose.ts)
                         ↓
                    buildTopology() → recommended_policies (topology.ts)
                         ↓
               generateTopologyOptions() → 3 modes (options.ts)
```

### Policy Priority Ranges
- P10–P100: App access block policies (prohibited categories)
- P210–P290: Scoped policies (AD group / app instance targets)
- P300–P490: Category-based content/label/filename policies (Hybrid topology)
- P500+: Manual/AI-generated policies (shown separately, not in topology)
- P900: Restricted/Unassessed catch-all

### Netskope Profile & Action Rules (exact)
1. Multiple different actions across profiles → "Set action for each profile" checked → per-profile table
2. Single action across all profiles → unchecked → single dropdown
3. "Continue policy evaluation after match" checkbox → **only appears when action is Alert**
4. `no_match_action = null` → `+ ADD TRAFFIC ACTION` link (don't show "If none of profiles matches")
5. `no_match_action = value` → dashed separator + "If none of specified profiles matches" + dropdown

---

## UI Patterns

### Toast Feedback Rules (Sonner)
- Cell save success → **no toast** (optimistic update is enough)
- Cell save with sync warning → `toast.warning(msg)` + amber inline banner (banner persists)
- Mutation hard failure → `toast.error(...)`
- Reset / generate complete → `toast.success(...)`
- **Never use browser `alert()`**

### Animation
- Use `FadeIn` from `src/components/ui/fade-in.tsx` for page content entry
- All Framer Motion animations must check `useReducedMotion()` and skip if true
- `AnimatePresence initial={false}` — prevents animation on first render (only fires on user action)

### Cursor / Hover on Tables
- `cursor-pointer` only on the clickable element (e.g. the name `<Link>`), NOT the full `<tr>`
- Row hover: `hover:bg-muted/15` (not `hover:bg-card/40` which is nearly invisible)

---

## Performance Notes

### syncRecommendedPolicies
Was 30+ sequential DB upserts. Now:
1. `Promise.all([ensureDefaultCoachingTemplates, ensureClassificationLabels])` — parallel
2. 5 parallel fetches
3. Build all rows in memory
4. 1 bulk `.upsert(allRows)` + 1 bulk `.delete(staleKeys)` — 2 DB calls total

Called on every policies page load. Also called on each control matrix cell save.
Pass `preloadedLabels` from page.tsx to skip duplicate `ensureClassificationLabels` call.

### DB Query: Policies Page
`select('*')` replaced with explicit 25-column list.
Audited against all consumers: `policy-list.tsx`, `policy-chat-panel.tsx`, `lintAllPolicies`.
Critical fields that are easy to miss: `next_review_date` (lint check 5), `policy_owner` (lint check 4).

---

## Known Tech Debt

| Item | File | Note |
|---|---|---|
| `NODE_TLS_REJECT_UNAUTHORIZED=0` | `package.json` dev script | Dev only — remove before Vercel deploy |
| `policy-list.tsx` 1,600 lines / 36 hooks | `policies/_components/` | Phase 5 decomposition planned. `BulkDeleteConfirmModal` + `NewPolicyModal` extracted already to `policy-modals.tsx` — continue from there |
| `FAMILY_TO_PROFILE_TYPE` hardcoded | `netskope/transpose.ts:24` | Should be per-org. Low urgency. |
| Compliance audit trail pagination | `compliance/` | See original backlog |
| Nil UUID in cron log | `settings/` | Known but not blocking |
| `policy-list.tsx` uses `generateError` state removed — inline error banner dead code deleted | `policy-list.tsx` | ✅ Fixed |

---

## Security Fixes Applied (audit 2026-06-05)

1. `compliance/regulations/actions.ts` — was manually decoding JWT, now uses `requireRole('analyst')`
2. `api/auth-check/route.ts` — now requires `admin` role (was open to any authenticated user)
3. `api/policy-chat/route.ts` — now requires `analyst` role minimum
4. All server actions use `requireRole()` consistently

---

## V1 Scope Reminder
- Netskope only (Web, CASB, API, Endpoint)
- GenAI Security + SaaS Protection use cases
- GDPR + HIPAA compliance
- Manual input + policy file import
- No Microsoft Purview (V5-6), no Netskope API integration (V3), no white-label (V2)
