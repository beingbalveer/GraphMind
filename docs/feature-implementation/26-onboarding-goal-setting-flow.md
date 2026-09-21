# Onboarding Goal Setting Flow Implementation Plan

> Agentic-worker sub-skill note: use and check the execution tickets in order. - [ ] secure state/API - [ ] accessible flow - [ ] AI eval/staged launch

**Goal:** voluntarily turn a first learner goal, level and minutes preference into one useful first roadmap workspace.  
**Architecture:** authenticated onboarding state → idempotent RoadmapService reuse → canonical workspace navigation.  
**Tech Stack:** FastAPI/SQLAlchemy/Alembic/Postgres, `packages/ai-core`, Next.js/TypeScript.  
**Spec:** `docs/FEATURE_RESEARCH.md §7.1`.

## Global Constraints

Implement under `AGENTS.md` approval/verification and `URL_DESIGN.md` canonical helpers. Keep LLM calls behind provider abstraction; use Alembic and authorization; build only with shared semantic primitives/tokens, dark mode and keyboard/screen-reader support. Never force onboarding, hardcode paths/use history APIs, accept spoofed user IDs, or create duplicate roadmaps.

## Status, current implementation evidence, goal, non-goals

**Status: partially supported by later pieces, flow absent.** Auth exists (`routers/auth.py`, `AuthContext.tsx`), workspaces exist, `RoadmapModal.tsx` and `RoadmapService.generate_roadmap` create a roadmap workspace from `goal`, `level`, `focus`; current roadmap request has no daily-time field, onboarding state, resume/skip semantics, or first-run route. `app/page.tsx` resolves workspace and `WorkspaceShell` is the authenticated shell. Goal: after first successful sign-in, offer a skippable three-step, <2-minute goal setup (goal/category, level, minutes/day) that creates one first roadmap workspace, starts on its canvas/chat, and records only necessary preferences. Non-goals: force onboarding, profile a learner, create duplicate workspaces on refresh, or expose onboarding answers to collaborators.

## User stories and flow

1. A new authenticated user lands on `/`; server/client reads `UserOnboardingModel` and routes to a modal/controlled `/onboarding` surface. Existing users never see it again unless launched from settings.
2. Step 1 asks “What do you want to learn?” free text plus optional category chips. Step 2 asks current level (beginner/intermediate/advanced). Step 3 asks 15/30/60 minutes/day. Each has Skip and Back; no field is required to exit.
3. Submit previews short roadmap creation state; request is idempotent. Success persists completion and `first_workspace_id`, then uses `router.replace(buildCanvasUrl(...))` or specified canonical workspace URL; failure preserves answers locally and offers retry/no-roadmap continuation.
4. Settings lets user edit learning preference later; it does not regenerate a roadmap without confirmation.

Accessibility: native labels/radiogroup semantics or existing `SegmentedTabs`, `Input`, `Button`, `Modal`; first invalid field receives focus, progress has text “Step 2 of 3”, no timer, skip is equally discoverable. Ensure keyboard operation/visible focus per MDN ([MDN](https://developer.mozilla.org/en-US/docs/Web/Accessibility/Guides/Understanding_WCAG/Keyboard)); use `@/lib/urls`, never `window.history` or raw path construction.

## Architecture/data flow

`Auth success → GET /me/onboarding → OnboardingGoalFlow → POST /me/onboarding/roadmap → OnboardingService transaction → RoadmapService.generate_roadmap → workspace/node/concept/edge commit → onboarding completed outbox event → route`.

Refactor RoadmapService call to accept an explicit authenticated `owner_id`, not the current default fallback except development seed path. Expand roadmap prompt/schema with `daily_minutes` as a constraint/metadata rather than a promise of exact pacing. Roadmap generator already materializes a new workspace, root node, topic nodes, concepts, prerequisite edges; reuse it rather than create a second roadmap implementation. A roadmap output must pass DAG validation: known prerequisite IDs, no self edge/cycle, 6–10 topics, bounded title/description/hours. If provider fails, current deterministic fallback still creates a truthful generic plan.

## Data model, APIs, events, exact repository impact

Create `UserOnboardingModel` in `apps/api/src/models/onboarding.py`:

```sql
user_onboarding(user_id varchar(64) primary key references users on delete cascade,
 status varchar(16) not null check(status in ('not_started','in_progress','skipped','completed')),
 goal varchar(280) null, goal_category varchar(64) null,
 self_reported_level varchar(16) null check(self_reported_level in ('beginner','intermediate','advanced')),
 daily_minutes smallint null check(daily_minutes in (15,30,60)),
 first_workspace_id varchar(64) null references workspaces on delete set null,
 roadmap_request_key varchar(128) null unique, prompt_version varchar(32) null,
 started_at timestamptz null, completed_at timestamptz null, updated_at timestamptz not null)
```

Create migration `apps/api/alembic/versions/20260921_0026_add_user_onboarding.py`; add export in `models/__init__.py`, relationship in `models/user.py`, `schemas/onboarding.py`, `services/onboarding_service.py`, `routers/onboarding.py`, registration `main.py`; modify `services/roadmap_service.py`, `schemas/roadmap.py`, `routers/roadmap.py` only to add authenticated/day-minutes-aware reuse, and relevant owner-id tests. Do not alter legacy redirects or routing contract.

Create `apps/web/src/lib/onboardingApi.ts`, `components/onboarding/OnboardingGoalFlow.tsx`, `OnboardingProgress.tsx`, tests; modify `context/AuthContext.tsx` (only after auth resolved), `app/page.tsx`/authenticated workspace entry point, `components/settings/SettingsPage.tsx`, `lib/roadmapApi.ts`, `lib/urls.ts` only if a new helper is genuinely needed. API: `GET /api/v1/me/onboarding` → redacted state; `PATCH ... {goal?,goalCategory?,level?,dailyMinutes?,status?}`; `POST .../generate-first-roadmap` with `Idempotency-Key` → `{workspaceId,rootNodeId,chatId?,status}`. Return existing successful workspace for repeated request key. Events `onboarding_started`, `onboarding_skipped`, `onboarding_roadmap_requested`, `onboarding_completed`; collect category/time only after user submits, never on keystroke.

## AI, security, privacy, reliability, observability

Prompt: “Create a prerequisite DAG for learner goal/level and daily time budget. JSON only. State approximate effort, do not promise employment/exam pass, no sensitive inference; 6–10 topics, all prerequisite IDs valid and acyclic.” Server owns topic count/DAG validation and fallback. Eval corpus has vague goals, unsafe/extreme goals, duplicate user retry, non-English text, advanced learner, and adversarial prompt text. Required: valid JSON/DAG or fallback 100%, no unsupported employment guarantee, correct owner 100%, duplicate workspace rate 0, human roadmap relevance ≥4/5.

Every endpoint uses authenticated current user; avoid owner spoofing/BOLA; never pass other workspace history or private annotations to model. Store goal/time as sensitive learning preference: minimise it, provide settings edit/delete/export, redact from logs/traces and forbid analytics raw text. OWASP flags object authorization, resource consumption, and unsafe external APIs ([OWASP](https://api-security.owasp.org/editions/2023/en/0x00-header/)); rate limit generator 3/day/user, goal 280 chars, provider timeout/cost cap, and use existing provider abstraction. Handle unauthenticated initial hydration, user who already owns workspace but has no state, skip/return later, expired session, network retry, model malformed JSON, roadmap commit failure after workspace creation (single transaction/cleanup), concurrent browser tabs, user deletes first workspace, and level/time changes mid-request. SLO onboarding-state p95 <150ms, draft completion p95 <5s with fallback, duplicate workspace rate 0; monitor funnel start/step/skip/generate/success, errors, latency, fallback, time-to-first-workspace (aggregated/consented).

## Edge-case matrix

| Condition | Required result | Named test |
|---|---|---|
| duplicate generate double click/tabs | one workspace/root response by request key | `test_generate_first_roadmap_is_idempotent` |
| model JSON invalid | validated fallback roadmap, completed state only after commit | `test_invalid_provider_output_uses_fallback` |
| roadmap has cyclic prereqs | reject/retry/fallback; never persist cycle | `test_roadmap_dag_validation_rejects_cycle` |
| user presses Skip | status skipped, no workspace/model call | `test_skip_does_not_generate_workspace` |
| auth unresolved/expired | no onboarding fetch/render of private state; redirect login | `onboarding-auth-guard.test.tsx` |
| first workspace deleted | completed remains, settings offers create another—not automatic | `test_deleted_first_workspace_is_safe` |
| stale browser update | ETag/version conflict, preserve newer server preference | `test_onboarding_preference_conflict` |

## Rollout, migration/backfill, decisions

Migration creates no rows. On first auth read, lazily return `not_started` for a missing row; background backfill marks existing users with an owned workspace as `skipped` only after product approves—not automatic, because it would hide onboarding retry. Launch behind `onboarding_goal_flow`: employee test, 1% new-account cohort, then 10/50/100 after no duplicate workspaces, auth errors <0.1%, and time-to-first-workspace improves. Kill switch bypasses modal and leaves existing preferences/roadmaps untouched; frontend route falls back to current root behavior. Add event retention policy and remove raw goal after configured account deletion.

Decision: persist a small onboarding record and idempotency key rather than localStorage; server state survives devices/retries and is authorization-auditable. Reuse RoadmapService rather than a parallel endpoint to avoid diverging DAG/materialization logic. Make all questions skippable; forced education profiling harms trust. Minutes/day is a preference for session planning (6.4), not a hard scheduler. Alternatives rejected: auto-generate from login (cost/consent), ask in one giant form (high cognitive load), and create demo workspace instead of stated goal (low relevance).

## Research questions answered

1. **Can onboarding create a roadmap with existing code?** Yes; `RoadmapService.generate_roadmap` already persists workspace/root/topics/concepts/prerequisite edges, but needs owner/idempotency integration.
2. **Should minutes/day be a schedule guarantee?** No; it is a planning constraint only.
3. **Why server idempotency?** Browser retries/multi-tabs can duplicate costly workspaces; client state cannot prevent it.
4. **Can model output define a graph?** Only after schema and cycle validation.
5. **Should onboarding block product use?** No; Skip makes it voluntary.
6. **May goal text be used for unrelated recommendations?** No; purpose limitation/explicit consent.
7. **How should navigation occur?** `router.replace` plus `buildCanvasUrl`/helpers, following repository URL contract.
8. **What makes custom form controls accessible?** keyboard semantics, focus state and equivalent interaction ([MDN](https://developer.mozilla.org/en-US/docs/Web/Accessibility/Guides/Understanding_WCAG/Keyboard)).

## Jira implementation tickets

### ONB-711 — Onboarding state and secure API

**Objective:** store optional preferences and reliably generate exactly one first roadmap. **Dependencies:** current auth/RoadmapService; no UI dependency. **Create:** `models/onboarding.py`, `schemas/onboarding.py`, `services/onboarding_service.py`, `routers/onboarding.py`, Alembic revision, `tests/test_onboarding_service.py`, `tests/test_onboarding_endpoints.py`. **Modify:** `models/user.py`, `models/__init__.py`, `main.py`, `services/roadmap_service.py`, `schemas/roadmap.py`.

1. Add exact schema/model constraints and user relationship; produce additive migration with index/unique request key and tested downgrade.
2. Implement `get_or_create_state` inside authenticated transaction; never accept `user_id` from body/path for `/me` endpoints.
3. Add Pydantic request validators (trim goal, enum level/minutes, forbid unknown fields) and `If-Match`/version conflict response for preferences.
4. Refactor roadmap call to require current authenticated owner ID and accept daily minutes metadata; validate generated plan topologically before any persistence.
5. In `generate_first_roadmap`, lock/read request key, reuse successful response, run workspace/materialization plus state completion atomically, then write outbox event.
6. Test owner/member isolation, skip path, duplicate keys, fallback, cycle rejection, commit failure cleanup and deleted workspace state.

**Acceptance criteria:** (a) unauthenticated request is rejected; (b) two identical keys yield one workspace; (c) roadmap belongs only to caller; (d) missing/invalid LLM plan never persists an invalid graph; (e) skip triggers no provider call; (f) preferences are editable/exportable/deletable. **Commands:** `uv run pytest apps/api/tests/test_onboarding_service.py apps/api/tests/test_onboarding_endpoints.py apps/api/tests/test_roadmap_service.py`; `uv run ruff check apps/api/src apps/api/tests`; `uv run mypy apps/api/src`.

**Rollback/flag:** route remains but returns feature-disabled when `onboarding_goal_flow=false`; do not delete rows/workspaces; rollback migration only before production records.

### ONB-712 — Accessible first-run frontend

**Objective:** implement skippable three-step flow and canonical navigation. **Dependencies:** ONB-711. **Create:** `lib/onboardingApi.ts`, `components/onboarding/OnboardingGoalFlow.tsx`, `OnboardingProgress.tsx`, `components/onboarding/__tests__/onboarding-goal-flow.test.tsx`. **Modify:** `AuthContext.tsx`, correct authenticated entry component (`app/page.tsx` or shell after code audit), `SettingsPage.tsx`, `roadmapApi.ts`.

1. Fetch onboarding only after auth hydration; represent loading/error/disabled/skipped/completed in strict TS state.
2. Build three steps using UI primitives; capture state locally, validate only selected inputs and never block Skip.
3. Send PATCH after intentional step continuation/submit, show retry-safe generation UI with one request idempotency key kept through retry.
4. On success use URL helper + `router.replace`, not string interpolation/history APIs; add failure action “Continue without roadmap.”
5. Implement semantic headings/progress, labelled controls, focus invalid/return, Escape/Back/Skip behavior and responsive design tokens.
6. Add tests for all paths, response errors, double submit, keyboard traversal and correct URL helper calls.

**Acceptance criteria:** (a) new user reaches working roadmap in a successful path; (b) skip reaches product with no generation; (c) refresh/retry does not duplicate roadmap; (d) keyboard and screen-reader status are usable; (e) no raw `/w/` strings in component. **Commands:** `pnpm --filter @graphmind/web vitest run src/components/onboarding/__tests__/onboarding-goal-flow.test.tsx src/components/layout/__tests__/routing-and-state.test.tsx`; `pnpm --filter @graphmind/web build`.

**Rollback/flag:** hide flow client-side when server flag off; route current workspace landing; preserve ability to open settings later.

### ONB-713 — AI evaluation, analytics, staged launch

**Objective:** prove roadmap quality/safety and measure time-to-first-value without collecting raw goals. **Dependencies:** ONB-711/712. **Create:** `apps/api/tests/evals/onboarding_roadmap_cases.json`, `tests/test_onboarding_roadmap_evals.py`, observability dashboard/runbook. **Modify:** service metrics/config.

1. Curate de-identified goal/level/time fixtures including vague, hostile and non-English input.
2. Assert response JSON/schema/DAG/fallback/cost constraints and manually score relevance/unsupported promises.
3. Emit funnel events with opaque user/session IDs and boolean/category only; document retention/consent.
4. Add alert for duplicate workspace, roadmap failure, auth error, p95 latency and provider fallback spike.
5. Run phased flag cohorts and require metrics gate before each expansion; rehearse kill switch.

**Acceptance criteria:** (a) evaluation has 100% valid persisted DAG/fallback; (b) dashboards exclude goal body; (c) duplicate workspace alert is tested; (d) staged release decision is documented. **Commands:** `uv run pytest apps/api/tests/test_onboarding_roadmap_evals.py`; full backend test suite; frontend build above.

## Definition of Done

All migration/API/UI/evaluation tests pass with `ruff`, `mypy`, and web build; onboarding is voluntary, accessible, canonical-route compliant and idempotent; generated graphs are validated/fallback safe; authorization/privacy/export/deletion are verified; metrics/alerts/feature flag/backfill and rollback runbook exist; no duplicate roadmap implementation, no dead UI, and product approves cohort results.

## Sources

[MDN keyboard accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility/Guides/Understanding_WCAG/Keyboard) · [OWASP API Top 10](https://api-security.owasp.org/editions/2023/en/0x00-header/) · [NIST Generative AI Profile](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf) · [HTTP semantics](https://www.rfc-editor.org/rfc/rfc9110)
