# Daily & Weekly Learning Dashboard Implementation Plan
## Plan protocol

- [ ] Read this plan, `AGENTS.md`, `docs/URL_DESIGN.md`, and the cited feature research before coding.
- [ ] Use the agentic-worker sub-skill protocol: one ticket at a time; inspect changed files; run its exact verification; report evidence before starting the next ticket.
- [ ] Record a reviewer checkpoint after each ticket and do not silently widen scope.

**Goal:** Deliver the feature’s learning outcome with explainable, private, production-grade behaviour.

**Architecture:** FastAPI service/router/schema/model layers; provider-agnostic AI through `packages/ai-core`; typed shared contracts; Next.js App Router surface; PostgreSQL persistence and asynchronous projections where specified.

**Tech Stack:** Python 3.12/FastAPI/async SQLAlchemy/Alembic/Pydantic v2/pytest/ruff/mypy; Next.js 15/TypeScript strict/Tailwind/shadcn primitives/vitest; PostgreSQL/Redis.

**Spec:** `docs/FEATURE_RESEARCH.md §3.2`.

**Global Constraints:** Obey `AGENTS.md`: obtain approval before implementation, one roadmap task at a time, and no dead UI. Read `docs/URL_DESIGN.md` before route work; use `@/lib/urls` and Next router, never browser history or primary-ID query parameters. Keep LLMs behind provider abstractions in `packages/ai-core`; make schema changes through reversible Alembic migrations; enforce workspace RBAC on every read/write. Use only `@/components/ui` primitives and semantic tokens, support dark mode, and meet WCAG keyboard, focus, contrast, status-message and non-colour requirements.


# 3.2 Daily & Weekly Learning Dashboard
### Ticket-specific test cases to add before code review

- Happy path: authenticate an owner/editor, execute the ticket action, reload and assert exact persisted response.
- Authorization: repeat as viewer and unrelated workspace member; assert safe 403/404 and no event emitted.
- Validation: submit empty, over-boundary and malformed payloads; assert 422 field detail and no write.
- Retry: send same mutation/idempotency key twice and assert one row/event and same response.
- Failure: force provider/database/worker error; assert rollback, redacted log and accessible retry state.
- Concurrency: issue two compatible/conflicting requests; assert invariant/unique constraint remains true.
- Accessibility: tab/Enter/Escape through UI, inspect role/status/focus and dark-mode semantic classes.
- Performance: seed stated large fixture, measure query/render budget and assert bounded page size.
- Migration: upgrade, create data, downgrade in isolated database and confirm documented rollback outcome.

## Mandatory ticket execution matrix

The ticket list below is ordered. A fresher completes one ticket, obtains review evidence, then starts its dependent ticket. Use the exact files named in the feature architecture; do not add alternate persistence or routing paths.

### Required procedure for every listed LEARN ticket

**Objective/dependency:** the ticket title is its sole objective; stated dependencies are hard start conditions. If none is stated, establish a passing baseline first.

1. Read each named service/model/router/component and nearest existing test; record current input/output contract.
2. Create the named Pydantic schema and shared TypeScript type first, with bounds, enum and nullable validation.
3. When persistence is required, add only the named model/migration, query indexes and reversible Alembic downgrade.
4. Implement one service method with ownership/RBAC check, typed errors, redacted structured logs and transaction boundary.
5. Wire API/client/UI behind the feature flag, using UI primitives/tokens and canonical URL helpers.
6. Add unit, integration and interaction tests below; run all commands before review.
7. Test retry/idempotency/concurrency and migration upgrade/downgrade in an isolated database.
8. Enable internally, observe for one business day, then advance rollout.

**API/type evidence:** each request has Pydantic validation; every response has a shared TypeScript interface; retryable mutations use idempotency keys; event payloads contain event type, entity id, UTC occurred_at and schema version.

**Acceptance criteria (all tickets):**
1. Owner/editor completes happy path and result survives refresh.
2. Viewer/cross-workspace access cannot read/mutate or learn resource existence.
3. Invalid schema, provider failure and duplicate retry preserve integrity and show useful feedback.
4. Keyboard/screen-reader, dark theme and non-colour state pass component tests.
5. Feature p95 target is met or UI shows a safe stale/degraded state.

**Verification:** run the ticket-specific pytest/vitest command in the ticket list, then 'uv run ruff check apps/api', 'uv run mypy apps/api/src', 'pnpm --filter @graphmind/web vitest run', and 'pnpm --filter @graphmind/web build'. For migrations run 'uv run alembic upgrade head', inspect indexes in PostgreSQL, then 'uv run alembic downgrade -1' in an isolated test database.

**Rollback/flags:** use server flag 'LEARNING_<FEATURE>_V1' and UI flag 'NEXT_PUBLIC_LEARNING_<FEATURE>_V1'. Disable UI, then writes/jobs, drain workers, and retain audit records. Additive migrations are not dropped in incident rollback.

### Edge cases, backfill, and rollout

| Case | Required behaviour | Test |
|---|---|---|
| Retry/double click | One logical mutation through idempotency/unique constraint | concurrent POST |
| Delete source/card/concept | Documented cascade/tombstone; projection remains valid | deletion/replay |
| Duplicate/out-of-order event | Version/checkpoint keeps projection deterministic | worker replay |
| Large workspace | Pagination/index/cache; no unbounded query | 2k-node/10k-event benchmark |
| Malformed/injected AI output | Strict schema rejects; persist nothing | adversarial fixture |
| Provider/worker outage | Timeout, retry/DLQ, stale status | timeout/replay |
| Timezone/DST/deletion | UTC storage/local display; export/delete honoured | timezone/privacy |

Deploy additive migration with flag off; reader code; ascending workspace/id idempotent backfill with checkpoints/rate limit; compare counts/checksums; dual-read to parity; internal → 5% → 25% → 100% after seven-day error/latency/quality gates. Stop jobs and disable flags on parity drift, privacy leak, p95 breach or critical evaluation failure.


## Status and target

There is no dedicated stats page. `MasteryPanel` has aggregate mastery and recommendations; `TimelineReplayBar` has event history; flashcard review state arrives in 2.2. Add a private dashboard that answers “what did I do, what is due, and what changed?” with evidence and actions—not engagement theatre or a leaderboard.

## UX and data model

Route `/w/{workspaceId}/learning` via a new URL helper and `app/w/[workspaceId]/learning/page.tsx` (add it to URL contract only after ADR update). Header selects timezone/week; cards show today’s meaningful activity (new concepts, completed retrieval attempts, reviewed cards), due/overdue queue, mastery band movements, and a calendar with text table equivalent. Clicking any measure drills to source nodes/reviews; empty state offers first learning action. Metrics use inclusive days/UTC-boundary-safe account timezone and label partial days.

Create materialized `learning_daily_rollups(user_id,workspace_id,local_date,new_nodes,retrieval_attempts,reviewed_cards,minutes_active,mastery_moves JSON,computed_at)` and `learning_weekly_rollups`; derive them from normalized ledger, never scrape UI. API `GET /workspaces/{id}/learning/dashboard?from=&to=&tz=` returns raw daily series + definitions; cache ETag. Create models/schemas/service/router/migration/backfill/tests; modify `urls.ts`, `WorkspaceShell.tsx`, `ContextRail.tsx`, shared types, `workspaceApi.ts`, and add `components/learning/LearningDashboard.tsx` plus tests.

## Reliability, safety, and decisions

Incremental upsert is triggered by events; nightly reconciliation detects drift. p95 90-day read <250 ms, data freshness <5 minutes; dashboard degrades by showing last refresh. Privacy: default private, no raw prompts/answers in aggregate, user export/delete, strict workspace RBAC ([U.S. ED](https://studentprivacy.ed.gov/privacy-and-education-technology)). Present counts as self-reflection, not merit. Keyboard/table alternative, 4.5:1 contrast, non-colour chart labels and announced date changes meet [WCAG](https://www.w3.org/TR/WCAG22/). Track dashboard usefulness (drill-through/review completion), freshness/drift and query SLO; do not optimise time-on-dashboard.

## Questions answered

1. **Why rollups?** Fast, stable reads. 2. **Source of truth?** Event ledger. 3. **What is active time?** Bounded meaningful interaction, clearly defined. 4. **Does opening count?** No. 5. **How timezone-safe?** User-local bucketing. 6. **Can user inspect counts?** Yes, drill-down. 7. **What if data late?** Timestamp/refresh. 8. **Can teams compare?** Not in this feature. 9. **Are charts accessible?** Table/text equivalent. 10. **Can old data change?** Reconciliation may correct it with audit.

## Jira implementation tickets

### LEARN-311 — Daily/weekly rollup projection and backfill

**Objective:** aggregate meaningful learning events into user-local daily and weekly summaries without request-time scans.

**Dependencies:** learning-event ledger and projection runner.

**Files:**
- Create: `apps/api/src/models/learning_rollup.py`, `apps/api/src/services/learning_rollup_service.py`, `apps/api/alembic/versions/20260921_0011_add_learning_rollups.py`, `apps/api/tests/test_learning_rollup_worker.py`.
- Modify: model exports and event-consumer registration.
- Test: `apps/api/tests/test_learning_rollup_service.py`, `apps/api/tests/test_learning_rollup_backfill.py`

**Owned contract:** `DailyLearningRollup(user_id,workspace_id,local_date,timezone,event_counts,active_minutes,review_due,review_completed,mastery_movements,projection_version)`; weekly response composes seven daily rows.

1. Define qualifying event taxonomy and duration rules; do not count login, page open, or passive tab dwell as learning.
2. Add table/index `(user_id,workspace_id,local_date)` and migration; store timezone/version used for day bucketing.
3. Consume events idempotently and update the affected local date, handling late/corrected events and timezone changes through rebuild.
4. Compute mastery movements from projection version changes and review due/completed from review events, not duplicated counters.
5. Implement checkpointed historical backfill with count/checksum reconciliation and a shadow version.
6. Test DST, midnight boundary, duplicated/out-of-order events, deletion/voiding, sparse week, and multiple workspaces.

**Acceptance criteria:** event replay yields identical totals; local dates are correct across DST; passive activity is excluded; corrections recalculate affected days; backfill resumes safely.

**Verification:** `uv run pytest apps/api/tests/test_learning_rollup_service.py apps/api/tests/test_learning_rollup_backfill.py -q`; `uv run ruff check apps/api`; `uv run mypy apps/api/src`.

**Rollback:** stop `LEARNING_DASHBOARD_V1` consumer and read the previous projection version; do not delete ledger events.

### LEARN-312 — Dashboard summary API and canonical route

**Objective:** expose bounded, authorized dashboard ranges with freshness and comparison semantics.

**Dependencies:** LEARN-311 and URL design approval for the selected workspace surface.

**Files:**
- Create: `apps/api/src/schemas/learning_dashboard.py`, `apps/api/src/routers/learning_dashboard.py`, `apps/api/tests/test_learning_dashboard_endpoints.py`
- Modify: `apps/api/src/main.py`, `apps/web/src/lib/urls.ts` only if a new canonical path is approved.

1. Define `GET /api/v1/workspaces/{id}/learning-dashboard?from=&to=&timezone=` with maximum 13-week range and Pydantic date/timezone validation.
2. Authorize workspace membership and scope data to current user; never expose other members' learning metrics by default.
3. Return daily series, current/previous-week comparison, mastery movements, due/overdue review, projection freshness/version, and empty-state reason.
4. Use ETag/cache keyed by user/workspace/range/version and avoid unbounded joins or per-day queries.
5. Add safe 404/403 behavior, range/timezone validation, empty/partial/stale projection, and p95 performance tests.
6. Document whether the UI is a dashboard section or canonical path; all navigation uses `@/lib/urls`.

**Acceptance criteria:** 13-week response is bounded and indexed; comparison windows are explicit; stale status is returned; no teammate metrics leak; ETag changes with projection version.

**Verification:** `uv run pytest apps/api/tests/test_learning_dashboard_endpoints.py -q`.

**Rollback:** disable endpoint/route with `LEARNING_DASHBOARD_V1=false` while continuing shadow rollups.

### LEARN-313 — Accessible dashboard UI

**Objective:** make daily/weekly progress understandable as text and tables as well as charts.

**Dependencies:** LEARN-312.

**Files:**
- Create: `apps/web/src/lib/learningDashboardApi.ts`, `apps/web/src/components/learning-dashboard/LearningDashboard.tsx`, `ConsistencyChart.tsx`, tests.
- Modify: `WorkspaceDashboard.tsx`, navigation component, shared types.

1. Fetch a default seven-day range and render skeleton, empty, stale, partial, error, and populated states.
2. Show today's topics/questions/reviews, weekly consistency, mastery movements, and due/overdue counts using semantic cards.
3. Build any chart with an equivalent accessible table/summary, labelled axes, non-colour series, and keyboard focus/tooltip parity.
4. Add range/workspace controls that update through approved URL/state helpers without primary IDs in query parameters.
5. Display projection timestamp and previous-period comparison without shaming or implying causality.
6. Test keyboard/screen reader, small screens, dark/high contrast, large values, locale dates, retry, and ETag refresh.

**Acceptance criteria:** all chart information is available without vision/pointer; empty weeks are honest; no raw/hardcoded controls; due links open real review flow; layout works at mobile width.

**Verification:** `pnpm --filter @graphmind/web vitest run LearningDashboard ConsistencyChart`; `pnpm --filter @graphmind/web build`.

**Rollback:** hide navigation/surface with `NEXT_PUBLIC_LEARNING_DASHBOARD_V1=false`; existing workspace dashboard remains functional.

### LEARN-314 — Dashboard observability and privacy review

**Objective:** operate rollups and analytics without turning learner progress into shared surveillance.

**Dependencies:** LEARN-311–313.

**Files:**
- Create: `docs/runbooks/learning-dashboard.md`, `apps/api/tests/test_learning_dashboard_privacy.py`
- Modify: observability and data-retention configuration.

1. Instrument projection lag/failure, endpoint p95/cache hit, dashboard load/error, range use, and review navigation using content-free labels.
2. Add deletion/export tests that remove personal rollups and rebuild aggregates from permitted events.
3. Run privacy review for shared workspaces; confirm dashboard is private-by-default and aggregation thresholds precede any future team view.
4. Alert on lag, count drift, cross-user rows, cache authorization errors, and endpoint regression.
5. Stage internal → 5% → 25% → 100% with performance, accessibility, privacy, and support gates.
6. Drill projection rebuild and kill-switch runbook.

**Acceptance criteria:** no other-member data appears; deletion SLA is verified; lag/drift alerts fire; rollout gates are recorded; disabling reads does not stop event capture.

**Verification:** `uv run pytest apps/api/tests/test_learning_dashboard_privacy.py -q` plus all rollup/API/UI suites.

**Rollback:** disable UI/API, keep ledger and consumer in shadow mode or stop safely, and switch back to the prior projection version.

## Definition of Done

The dashboard uses event-backed local-date rollups, bounded private APIs, accessible chart equivalents, freshness labels, resilient backfill, privacy/delete controls, and verified performance/observability.

## Sources

- [ADL xAPI data specification](https://github.com/adlnet/xAPI-Spec/blob/master/xAPI-Data.md)
- [PostgreSQL materialized-view documentation](https://www.postgresql.org/docs/18/rules-materializedviews.html)
- [U.S. Department of Education privacy and education technology guidance](https://studentprivacy.ed.gov/privacy-and-education-technology)
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/)
