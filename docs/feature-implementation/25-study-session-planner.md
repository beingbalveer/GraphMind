# Study Session Planner Implementation Plan

> Agentic-worker sub-skill note: tickets are intentionally execution-ready; check off only verified work. - [ ] selector/data - [ ] planner UI - [ ] AI quality/rollout

**Goal:** turn a learner’s available minutes into an editable, source-authorized and bounded study session.  
**Architecture:** unified review/curator candidates → deterministic allocator → persisted active plan → runner/events.  
**Tech Stack:** FastAPI/SQLAlchemy/Alembic/Postgres, provider abstraction, Next.js/TypeScript.  
**Spec:** `docs/FEATURE_RESEARCH.md §6.4`.

## Global Constraints

All work observes `AGENTS.md`, `docs/URL_DESIGN.md`, `packages/ai-core`, Alembic migration discipline, `require_workspace_*` RBAC, and the shared semantic design system. UI must be dark-mode, keyboard and screen-reader usable; no raw URL/history handling, client-selected unauthorized sources, or calendar scope expansion.

## Status, current evidence, goal, non-goals

**Status: not built.** `MasteryService` exposes concepts needing review; `CuratorService` supplies gaps/next topics; flashcards are node-linked but unscheduled; `GraphCanvas` has timeline/mastery data. There is no plan entity, time-budget input, prioritization policy, execution state, or route. Goal: given 15–120 minutes, generate an editable, bounded session using due review, an appropriate retrieval task, and one new/gap topic; it should reduce decision friction while preserving learner agency. Non-goals: calendar booking, background notification, false time estimates, automatic completion, or a day-by-day curriculum (future 9.1).

## User stories and UX flow

1. Learner opens **Plan my session**, selects 15/30/60/90 minutes, optional goal and energy level.
2. UI requests a draft; it shows total estimated minutes and 2–5 ordered items: review, practice/quiz, new exploration. Every item has why-now/source/duration and remove/reorder/add controls.
3. Learner starts. Only an explicit **Complete** action records completion; skipped/overrun is asked, not inferred. Source navigation uses `buildNodeUrl` and returns to plan state.
4. End screen compares planned/actual time and offers a concise reflection. No streak is awarded merely for generating/opening a plan.

`StudySessionPlanner.tsx` must use `Modal`, `Button`, `Input`, `Badge`, semantic tokens, labelled duration controls and live total updates. Keep ordinary tab sequence; status messages use polite live region, focus returns after modal close, and each item has textual type/status. MDN requires keyboard-operable custom widgets and visible focus ([MDN](https://developer.mozilla.org/en-US/docs/Web/Accessibility/Guides/Understanding_WCAG/Keyboard)).

## Architecture and prioritization

`Planner UI → POST /workspaces/{wid}/study-plans/draft → StudyPlannerService → ActivityReviewService + MasteryService + CuratorService + Flashcard query → deterministic candidate selector → optional LLM wording only → persisted plan → UI`.

Selector first reserves 40–60% of budget for due/overdue review, then one retrieval/quiz for a recently active concept, then one unlocked next topic; fill only if each item meets min 3 minutes and total ≤ budget. It must return an empty/partial plan honestly. Interleaving should mix meaningfully related content after initial understanding, not unrelated subjects ([science-of-learning review](https://pmc.ncbi.nlm.nih.gov/articles/PMC5780548/)). LLM receives only candidate IDs/titles/reasons and may phrase sequence; it cannot invent items, durations, completion, access, or prerequisite status.

## Data model, APIs, events and precise repository changes

Create `StudyPlanModel` in `apps/api/src/models/study_plan.py`:

```sql
study_plans(id varchar(64) primary key, workspace_id varchar(64) references workspaces on delete cascade,
 user_id varchar(64) references users on delete cascade, budget_minutes int check (budget_minutes between 15 and 120),
 goal varchar(280) null, status varchar(16) check (status in ('draft','active','completed','abandoned')),
 algorithm_version varchar(32) not null, estimated_minutes int not null, actual_minutes int null,
 created_at timestamptz not null, started_at timestamptz null, completed_at timestamptz null)
```

Create `StudyPlanItemModel(id, plan_id FK cascade, ordinal smallint, kind review|quiz|explore, source_kind card|concept|node, source_id, rationale text, estimated_minutes smallint, status pending|done|skipped, completed_at timestamptz, metadata jsonb)` with unique `(plan_id,ordinal)` and indexes `(user_id,status,created_at)`/`(plan_id,ordinal)`. Add relationships/imports in `models/workspace.py`/`models/__init__.py`; revision `apps/api/alembic/versions/20260921_0025_add_study_plans.py`; Pydantic models `schemas/study_plan.py`; `services/study_planner_service.py`; `routers/study_plans.py`; register in `main.py`.

Add TS contracts/API `apps/web/src/lib/studyPlanApi.ts`; components `apps/web/src/components/revision/StudySessionPlanner.tsx` and `StudyPlanRunner.tsx`; modify `apps/web/src/components/layout/MainHeader.tsx`, `apps/web/src/components/chat/MasteryPanel.tsx`, `apps/web/src/lib/workspaceApi.ts`; tests under matching `__tests__` folders. Do not add a primary route; modal launch is current-scope UI.

Endpoints: `POST /api/v1/workspaces/{wid}/study-plans/draft {budgetMinutes:15|30|60|90|120, goal?:string}` → 201 `StudyPlanResponse`; `PATCH .../{planId} {items?,status?}` with ETag/`version`; `POST .../{planId}/start`; `POST .../items/{itemId}/complete|skip {actualMinutes?}` idempotent; `POST .../complete {actualMinutes?}`. Event types: `study_plan_created`, `study_item_started`, `study_item_completed`, `study_item_skipped`, `study_plan_completed`, all emitted after transaction commit to the shared ledger. Pydantic rejects unknown fields, item foreign sources must belong to workspace/user, and writes use `require_workspace_write`.

## AI, evals, privacy, reliability, observability

Prompt: “You receive allowed candidate IDs, labels, reasons and fixed durations. Order them for a {budget}-minute session. Output JSON IDs only; total cannot exceed budget; do not manufacture sources/claims; explain choices with supplied reasons.” Validate every returned ID/duration then use deterministic ordering if invalid/unavailable. Benchmark 200 fixture workspaces: zero unauthorized/nonexistent source, plan duration ≤ budget 100%, overdue review prioritized according to configured policy ≥95%, LLM output schema valid ≥99%, and human usefulness ≥4/5. Keep algorithm version/candidate snapshot for evaluation.

Require user/workspace authorization on every source and plan, never send private annotations/source bodies to LLM, cap goal to 280 chars, scrub it from logs, rate-limit draft (5/min), and delete with workspace/user request. OWASP identifies broken object authorization and unrestricted resource consumption among principal API risks ([OWASP](https://api-security.owasp.org/editions/2023/en/0x00-header/)). Handle no candidates, deleted source after plan creation, stale due state, plan across midnight/DST, offline duplicate complete, two active plans, actual duration zero/over-budget, model timeout, and planner retry. Accept at most one active plan/user/workspace (transaction/partial unique index); stable GET rechecks source availability and labels unavailable. SLO draft p95 <800ms deterministic/<4s LLM, start/complete p95 <200ms; metrics include draft/start/completion, planned-vs-actual, unavailable items, source mix, no-candidate rate, errors/cost, and outcome cohort only consented/aggregated.

## Edge-case matrix

| Condition | Required behaviour | Test |
|---|---|---|
| no due/review/new candidates | return empty plan with explanation; no invented task | `test_empty_candidates_returns_empty_plan` |
| source deleted/revoked | item becomes unavailable; never reveals title/body | `test_plan_item_reauthorizes_source` |
| duplicate complete request | one completion event and stable response | `test_complete_is_idempotent` |
| 15-minute budget | select one/two bounded items, never negative remainder | `test_minimum_budget_is_bounded` |
| concurrent plans | second draft is draft; second start returns conflict | `test_single_active_plan` |
| LLM bad JSON/timeout | deterministic plan/fallback, no 500 | `test_planner_falls_back_deterministically` |

## Rollout, backfill, alternatives

No historical backfill: plans are prospective. Deploy migration first, then backend behind `study_session_planner` flag, internal test with deterministic selector, 5% beta with LLM phrasing disabled, 25% then 100% only after availability/over-budget/error guardrails. Kill switch hides entry point and makes draft endpoint 404/feature-disabled while existing plans remain readable/completable; migration is additive and rollback does not delete rows. Daily reconcile marks plans abandoned after 48h but never changes item events.

Decision: build on a unified activity/review service because digest, decays, queue and planner must make one consistent choice of “what next”; separate services create duplicate/contradictory priorities. Materialized active plan is preferable to recomputing each render, which would change a learner’s commitment mid-session. Alternatives rejected: purely LLM-generated plans (unreliable source/time), static checklist (not adaptive), calendar integration (scope expansion).

## Research questions answered

1. **Should planning mix random subjects?** No; interleave related concepts after initial understanding ([review](https://pmc.ncbi.nlm.nih.gov/articles/PMC5780548/)).
2. **Can `last_reviewed_at` alone choose FSRS reviews?** No; FSRS needs rating/history/memory state ([FSRS](https://github.com/open-spaced-repetition/fsrs4anki/wiki/The-Algorithm)).
3. **Can LLM select inaccessible nodes?** No; server candidate set/RBAC is authoritative.
4. **Does generating a plan count as study?** No; completion needs explicit meaningful action.
5. **Why persist a plan?** Repeatable execution, actual-vs-estimate learning, audit and resume.
6. **Can actual time be inferred from tab dwell?** No; ask/allow blank; passive time is unreliable.
7. **Why one active plan?** Avoid conflicting queues and accidental duplicate work.
8. **Should an empty plan be an error?** No; it is an honest successful outcome.

## Jira implementation tickets

### PLAN-641 — Schema, API, and deterministic selector

**Objective:** persist an authorized, bounded plan and expose draft/start/item-complete/finish operations. **Dependencies:** REV-101 learning event ledger/review candidates; no UI dependency. **Create:** `models/study_plan.py`, `schemas/study_plan.py`, `services/study_planner_service.py`, `routers/study_plans.py`, `apps/api/alembic/versions/20260921_0025_add_study_plans.py`, `tests/test_study_planner_service.py`, `tests/test_study_plan_endpoints.py`. **Modify:** `models/workspace.py`, `models/__init__.py`, `main.py`.

1. Define enum literals and SQLAlchemy models/relationships/indexes exactly above; use UTC timestamps and `version` integer for optimistic writes.
2. Generate an additive Alembic revision; inspect upgrade/downgrade locally and never put DDL in `main.py` lifespan.
3. Query candidate review/concept/node IDs through existing services after `require_workspace_read/write`; filter inaccessible/deleted sources before scoring.
4. Implement deterministic budget allocator with integer minutes, minimum 3-minute item, source snapshot and algorithm version; enforce one active plan transactionally.
5. Add Pydantic responses/request constraints and router error mapping (404 unavailable, 409 version/active-plan, 422 invalid). Write append-only events only after plan transaction succeeds.
6. Add service/endpoint fixtures for owner, member, other workspace, empty candidates, all limits and idempotency.

**Acceptance criteria:** (a) each item source belongs to workspace; (b) sum estimated minutes never exceeds request; (c) `complete` repeated with same idempotency key emits one event; (d) non-member obtains no plan/source information; (e) migration upgrade/downgrade succeeds. **Tests/commands:** `uv run pytest apps/api/tests/test_study_planner_service.py apps/api/tests/test_study_plan_endpoints.py`; `uv run ruff check apps/api/src apps/api/tests`; `uv run mypy apps/api/src`.

**Rollback/flag:** release behind backend config `study_session_planner=false`; disable router/returns feature-disabled without dropping tables; downgrade only before user data is accepted.

### PLAN-642 — Planner and runner UI

**Objective:** give keyboard-accessible draft editing and truthful execution state. **Dependencies:** PLAN-641. **Create:** `lib/studyPlanApi.ts`, `components/revision/StudySessionPlanner.tsx`, `StudyPlanRunner.tsx`, `components/revision/__tests__/study-session-planner.test.tsx`. **Modify:** `MainHeader.tsx`, `MasteryPanel.tsx`, `workspaceApi.ts`.

1. Define strict TS discriminated unions mirroring API `kind/status/sourceKind`; never use `any` or raw endpoint strings outside API client.
2. Launch a Modal with validated duration controls; submit draft and display skeleton/error/empty plan states.
3. Render editable ordered items with textual reasons/source deep links through URL helpers; calculate live total and prevent user edit over budget.
4. Implement start/complete/skip with disabled pending state and idempotency UUID; refresh only changed plan item after response.
5. Add focus trap/return, live status, button labels, reduced-motion-friendly progress and mobile layout; no raw buttons.
6. Test request payload, source navigation, keyboard completion, error/retry, empty plan and inaccessible source state.

**Acceptance criteria:** (a) duration input rejects invalid values; (b) total is announced and ≤ budget; (c) completion survives refresh; (d) tab/Enter/Escape and screen-reader labels work; (e) no mock action. **Commands:** `pnpm --filter @graphmind/web vitest run src/components/revision/__tests__/study-session-planner.test.tsx`; `pnpm --filter @graphmind/web build`.

**Rollback/flag:** client checks server flag and hides launch; existing runner remains available for active plans to avoid stranded work.

### PLAN-643 — AI quality, dashboards, staged release

**Objective:** make optional LLM wording measurable and reversible. **Dependencies:** PLAN-641/642. **Create:** `apps/api/tests/evals/study_planner_cases.json`, `tests/test_study_planner_evals.py`, dashboard/alert definitions under the project observability convention. **Modify:** service config/metrics.

1. Build fixtures for empty, overdue-heavy, novice, advanced, revoked and adversarial goal input cases.
2. Run deterministic baseline then optional model formatter, validate JSON/IDs/duration and compare outputs.
3. Emit structured counters/histograms with no goal/source content; add alerts for 5xx, duration overflow and access violation.
4. Run internal cohort, inspect support/relevance sample, then increment flag 5/25/100 with documented metrics gate.
5. Document runbook for stuck plan/reconcile and kill switch.

**Acceptance criteria:** (a) no eval plan exceeds budget; (b) fallback returns valid output for malformed model response; (c) dashboard reports p95/cost/abort; (d) flag rollback tested. **Commands:** `uv run pytest apps/api/tests/test_study_planner_evals.py`; full `uv run pytest apps/api/tests`; front-end build above.

## Definition of Done

Migration is reviewed/reversible; all named tests plus `ruff`, `mypy`, and web build pass; users can plan/start/complete/skip/resume with accessible UI; RBAC/idempotency/source reauthorization/privacy are verified; deterministic fallback, feature flag, alerts, reconcile runbook and staged metrics approval exist; no unnecessary calendar/email scope was added.

## Sources

[Interleaving review](https://pmc.ncbi.nlm.nih.gov/articles/PMC5780548/) · [FSRS algorithm](https://github.com/open-spaced-repetition/fsrs4anki/wiki/The-Algorithm) · [OWASP API Security](https://api-security.owasp.org/editions/2023/en/0x00-header/) · [MDN Keyboard](https://developer.mozilla.org/en-US/docs/Web/Accessibility/Guides/Understanding_WCAG/Keyboard)
