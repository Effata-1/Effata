@AGENTS.md

# DLP Shield (Effata) — Project Context

## What This Is
A DLP Maturity Assessment SaaS for Netskope customers. It sits above Netskope and helps orgs understand their GenAI DLP posture, classify apps, configure policies, and get a Netskope-specific policy recommendation pack — all without touching Netskope directly.

---

## Current Status

### ✅ Working
- **Auth + Onboarding**: Supabase auth, 5-step wizard, role-gated routes (admin/analyst/read_only)
- **App Catalog + Governance**: Trust scoring, approval workflows, classification by category
- **Control Matrix**: 4-column governance grid, cell-level action overrides, sync warnings via toast
- **Policy Library**: NPJ-based recommended + manual policies, lint, AI chat, policy generation from matrix
- **Netskope Recommendation Engine (Phases 1–3)**:
  - Phase 1: Hybrid category-based topology
  - Phase 2: Topology options (Hybrid / Consolidated / Per-Risk-Family)
  - Phase 3: Scoped NPJ detection (P210–P290) + Strategy Override panel + Manual policy section
- **UI**: Sonner toasts, error boundary, loading skeletons, animated dashboard, accordion animations

### 🔄 In Progress
- **Phase 4 of Netskope engine**: Activity scoping (currently hardcoded `['post', 'upload', 'prompt_submit']` in `topology.ts:261` and `scoped.ts:290`). Planned but not started.

### ⚠️ Known Issues / Deferred
- `NODE_TLS_REJECT_UNAUTHORIZED=0` is in the dev script — **remove before Vercel deploy**
- `FAMILY_TO_PROFILE_TYPE` map in `transpose.ts` is hardcoded — should be configurable per org (deferred)
- Compliance audit trail pagination, nil UUID in cron log, AI discovery review gate — see memory backlog
- Phase 5 component decomposition (`policy-list.tsx` is 1,600+ lines) — deferred until stable

---

## Key Architecture Decisions

| Decision | Why |
|---|---|
| **Neutral Policy JSON (NPJ)** | Vendor-agnostic policy representation. Translates to Netskope today, Purview in V5. Never let AI write config steps directly. |
| `org_id` on every table + RLS | Multi-tenant isolation. Cannot be added later without rebuilding. |
| `syncRecommendedPolicies` batches upserts | Was 30+ sequential DB calls per page load. Now 2 bulk ops (delete + upsert). |
| `requireRole()` everywhere | After audit: compliance/regulations/actions.ts was manually decoding JWT. All server actions now use `requireRole`. |
| Toast via Sonner | `alert()` removed. `theme="system"` respects OS dark/light preference. |
| Framer Motion with `useReducedMotion` | All animations skip when OS "reduce motion" is enabled. |

---

## Important File Structure

```
src/
├── app/(app)/
│   ├── genai-controls/           ← Main working section
│   │   ├── layout.tsx            ← Section sidebar (9 nav items)
│   │   ├── dashboard/            ← Stat cards, category breakdown, trust scores
│   │   ├── apps/                 ← App catalog with trust scoring
│   │   ├── app-governance/       ← Classify apps per category
│   │   ├── control-matrix/       ← DLP action grid (data type × category)
│   │   ├── policies/             ← Policy Library (NPJ-based)
│   │   │   ├── actions.ts        ← syncRecommendedPolicies (batched), upsertPolicy
│   │   │   └── _components/      ← policy-list.tsx (1,600 lines), policy-chat-panel
│   │   ├── notifications/        ← Coaching message templates
│   │   └── vendor-mapping/netskope/recommendation/  ← Netskope policy engine UI
│   ├── compliance/               ← Regulations, gap report, audit trail
│   └── settings/                 ← Team, integrations, admin
├── lib/
│   ├── genai/
│   │   ├── types.ts              ← GenAIPolicy, NpjCondition, NpjShape (canonical)
│   │   ├── control-matrix-rows.ts ← RF_DEFAULTS, UL_FN_DEFAULTS, UL_DC_DEFAULTS (canonical)
│   │   └── netskope/             ← Recommendation engine
│   │       ├── types.ts          ← NetskopePolicy, NetskopeRecommendation
│   │       ├── topology.ts       ← buildTopology() — Phase 1/2 core
│   │       ├── transpose.ts      ← transposeNpjs() — NPJ → category buckets
│   │       ├── options.ts        ← generateTopologyOptions() — 3 topology modes
│   │       ├── scoped.ts         ← buildScopedPolicies(), isScopedNpj() — Phase 3
│   │       └── limitations.ts    ← LIMITATIONS, VALIDATION_CHECKLIST
│   ├── auth.ts                   ← requireRole() — JWT decode + role rank
│   └── supabase/                 ← server.ts, client.ts, service.ts
├── components/
│   ├── nav/section-sidebar.tsx   ← Section nav with blue active indicator
│   └── ui/
│       ├── fade-in.tsx           ← Framer Motion wrapper (respects reduced-motion)
│       └── filter-select.tsx     ← All filters must use this, not native select
└── app/layout.tsx                ← Toaster (sonner), ThemeProvider, TooltipProvider
```

---

## How to Run

```bash
cd "DLP App/effata"
npm run dev          # starts on localhost:3000
                     # ⚠️ NODE_TLS_REJECT_UNAUTHORIZED=0 is set — dev only
```

Requires `.env.local` with:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RAILWAY_API_BASE_URL`

---

## Next 3 Priorities

### 1. Phase 4 — Activity Scoping (Netskope Engine)
**File**: `src/lib/genai/netskope/topology.ts:259` and `src/lib/genai/netskope/scoped.ts:288`

Both have `TODO` comments. Currently all policies use a hardcoded `['post', 'upload', 'prompt_submit']`. Phase 4 derives activities from the **union of `scope.activities` across the NPJ bucket profiles** — so a policy only covering file uploads doesn't incorrectly generate `post`/`prompt_submit` enforcement in Netskope.

Fix in `topology.ts` — inside the per-category loop, collect activities from each `TransposedProfile`'s source NPJ and union them.
Fix in `scoped.ts` — inside `buildScopedPolicies`, union `scope.activities` across grouped NPJs.

### 2. Policy Editor Scope UI (Phase 4 part 2)
**File**: `src/app/(app)/genai-controls/policies/[id]/edit/_components/policy-intent-editor.tsx`

Add a "Scope" section to the NPJ editor so users can set:
- Source: All Users / AD Group (text input)
- Destination: App Tag / App Instance (text input)

When saved, these write to `neutral_policy_json.scope.source` and `scope.destination`, making the policy a scoped NPJ that Phase 3 will pick up as a P210–P290 scoped policy.

### 3. `FAMILY_TO_PROFILE_TYPE` Configurable Per Org
**File**: `src/lib/genai/netskope/transpose.ts:24`

Currently hardcoded. Org-specific custom policy families can't map to Netskope profile types. Low urgency but blocks any org that has non-standard policy families.
