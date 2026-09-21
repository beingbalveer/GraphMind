# Streak & Consistency Tracker Implementation Plan
## Plan protocol

- [ ] Read this plan, `AGENTS.md`, `docs/URL_DESIGN.md`, and the cited feature research before coding.
- [ ] Use the agentic-worker sub-skill protocol: one ticket at a time; inspect changed files; run its exact verification; report evidence before starting the next ticket.
- [ ] Record a reviewer checkpoint after each ticket and do not silently widen scope.

**Goal:** Deliver the feature’s learning outcome with explainable, private, production-grade behaviour.

**Architecture:** FastAPI service/router/schema/model layers; provider-agnostic AI through `packages/ai-core`; typed shared contracts; Next.js App Router surface; PostgreSQL persistence and asynchronous projections where specified.

**Tech Stack:** Python 3.12/FastAPI/async SQLAlchemy/Alembic/Pydantic v2/pytest/ruff/mypy; Next.js 15/TypeScript strict/Tailwind/shadcn primitives/vitest; PostgreSQL/Redis.

**Spec:** `docs/FEATURE_RESEARCH.md §3.3`.

**Global Constraints:** Obey `AGENTS.md`: obtain approval before implementation, one roadmap task at a time, and no dead UI. Read `docs/URL_DESIGN.md` before route work; use `@/lib/urls` and Next router, never browser history or primary-ID query parameters. Keep LLMs behind provider abstractions in `packages/ai-core`; make schema changes through reversible Alembic migrations; enforce workspace RBAC on every read/write. Use only `@/components/ui` primitives and semantic tokens, support dark mode, and meet WCAG keyboard, focus, contrast, status-message and non-colour requirements.


# 3.3 Streak & Consistency Tracker
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


## Goal and limits

No streak exists. Build a private consistency signal based on learner-defined meaningful actions: at least one completed retrieval activity, one due review, or one new/explored topic; make criterion visible and configurable. A streak is a habit reflection, not a performance score. No public comparison, coercive prompts, deceptive “freeze” scarcity, or treating login as learning.

## Contract and flow

Account-level `learning_day_status(user_id,local_date,qualified_reason,qualified_at,freeze_used,computed_at)` is derived from ledger events, with unique `(user_id, local_date)`; `streak_state(user_id,current_count,longest_count,last_qualified_date,freeze_balance,updated_at)` is a projection. Start with **one free recovery per rolling seven days** only after a user enables streaks; it marks `freeze_used`, does not create a fake action. Context rail badge opens an explanation/history, goal settings and pause/disable. API: `GET /learning/streak`, `POST /learning/streak/pause`, `POST /learning/streak/freeze`; workspace dashboard reads a scoped summary.

Create models/schemas/service/router/migration/tests; modify learning ledger/projector, account settings, `ContextRail.tsx`, `LearningDashboard.tsx`, shared types/API client. Calculate in account timezone with a 24-hour day, handle DST by calendar date; deterministic recompute/backfill prevents duplicated tabs from incrementing. SLO p95 projection <100 ms; event replay reconciles state, alerts on negative/multiple freezes.

## Evidence and protections

The instructional evidence supports spaced retrieval ([IES](https://ies.ed.gov/ncee/wwc/PracticeGuide/1)), not streaks themselves; use A/B research with informed product review and success defined by voluntary return/retrieval success, not longer sessions. Provide quiet mode, no loss-message/push by default, no negative colouring, and clear calendar/table; controls work by keyboard and announce state per [WCAG](https://www.w3.org/TR/WCAG22/). Streak data is sensitive behavioural data: minimize, RBAC it, export/delete it ([U.S. ED](https://studentprivacy.ed.gov/privacy-and-education-technology)).

## Questions answered

1. **What qualifies?** Meaningful action, never login. 2. **Why optional?** Motivation differs. 3. **Does a freeze lie?** It is visibly a recovery, not activity. 4. **Can learners set goal?** Yes. 5. **What about travel?** Account timezone. 6. **DST?** Calendar days. 7. **Can it be public?** Not now. 8. **Can it gate content?** No. 9. **What metric matters?** Later recall/voluntary use. 10. **Can it be disabled?** Immediately.

## Jira implementation tickets

### LEARN-321 — Meaningful-action streak projector

**Objective:** derive daily consistency from completed learning actions rather than logins, page opens, or notification clicks.

**Dependencies:** learning-event ledger and account timezone.

**Files:**
- Create: `apps/api/src/models/streak.py`, `apps/api/src/services/streak_service.py`, `apps/api/alembic/versions/20260921_0012_add_streaks.py`.
- Modify: event consumer registration and user relationships.
- Test: `apps/api/tests/test_streak_service.py`, `apps/api/tests/test_streak_projection.py`

**Owned contract:** qualifying-day predicate, `StreakState(current_days,longest_days,last_qualified_date,freeze_balance,freeze_period,timezone,projection_version)`, and append-only freeze-consumed event.

1. Define qualifying events (completed review, submitted quiz, meaningful node exploration) and explicitly exclude login/open/generation-only events.
2. Add per-user state and daily qualification projection with unique `(user_id,local_date,event_type,subject_id)` evidence dedupe.
3. Project in the user's IANA timezone, rebuilding affected dates on late/voided events or timezone change.
4. Calculate current/longest streak from qualified days and one weekly freeze according to documented period boundary; never mutate learning events.
5. Make consumer idempotent/checkpointed and test duplicate/out-of-order events, DST, travel/timezone change, missed days, and freeze exhaustion.
6. Expose a pure explanation method returning why a day qualified and which event did it.

**Acceptance criteria:** login alone never qualifies; duplicate events count once; DST/timezone cases are deterministic; freeze protects at most the allowed day; state rebuild matches incremental output.

**Verification:** `uv run pytest apps/api/tests/test_streak_service.py apps/api/tests/test_streak_projection.py -q`; `uv run ruff check apps/api`; `uv run mypy apps/api/src`.

**Rollback:** stop `STREAKS_V1` projector and hide state; never rewrite/delete qualifying events.

### LEARN-322 — Preferences and private streak API

**Objective:** let learners opt out, choose timezone, and inspect the evidence behind their private consistency state.

**Dependencies:** LEARN-321.

**Files:**
- Create: `apps/api/src/schemas/streak.py`, `apps/api/src/routers/streaks.py`, endpoint tests.
- Modify: settings model/service and `main.py`.

1. Add `streaks_enabled`, timezone, and freeze preference with strict validation and privacy-default false for any social sharing.
2. Expose current state, recent qualified days/evidence summary, and idempotent freeze-use endpoint scoped to current user.
3. Reauthorize referenced workspace/subject and return privacy-safe labels when a source was deleted or membership revoked.
4. On timezone change enqueue bounded rebuild and return `recalculating=true` rather than showing inconsistent state.
5. Make opt-out stop projection/display while preserving required event retention; export/delete includes streak rows/preferences.
6. Test cross-user access, opt-out, duplicate freeze, invalid timezone, concurrent freeze, deleted evidence, and rebuild state.

**Acceptance criteria:** streak is private by default; opt-out is immediate; freeze cannot be double-spent; no source title leaks; timezone changes are explicit/rebuilt.

**Verification:** `uv run pytest apps/api/tests/test_streak_endpoints.py apps/api/tests/test_streak_preferences.py -q`.

**Rollback:** disable API/new freeze mutations and keep preferences/export accessible.

### LEARN-323 — Non-coercive accessible streak UI

**Objective:** show consistency as supportive context without shame, pressure, or dead rewards.

**Dependencies:** LEARN-322.

**Files:**
- Create: `apps/web/src/lib/streakApi.ts`, `apps/web/src/components/learning/StreakCard.tsx`, and tests.
- Modify: `ContextRail.tsx`, learning dashboard, settings UI, shared types.

1. Render current/longest streak, today's qualification status, freeze balance, and “what counts” explanation with semantic text/icon.
2. Use neutral copy (“3 learning days”) and never countdown pressure, loss aversion, celebratory dark patterns, or public leaderboard.
3. Link the suggested action to an actual due review/quiz/exploration flow; opening the app does not update state.
4. Provide opt-out/timezone controls through shared settings primitives and announce recalculation/status changes.
5. Render missed-day/recovery/freeze states without red failure colour and respect reduced motion/dark/high contrast.
6. Test keyboard, screen reader, opt-out, freeze confirmation, source deletion, mobile layout, and no action on render.

**Acceptance criteria:** rendering makes no mutation; loss copy is non-shaming; controls are accessible; opt-out hides all streak surfaces; meaningful action updates after projection refresh.

**Verification:** `pnpm --filter @graphmind/web vitest run StreakCard ContextRail`; `pnpm --filter @graphmind/web build`.

**Rollback:** `NEXT_PUBLIC_STREAKS_V1=false` removes all streak UI without affecting learning features.

### LEARN-324 — Experiment, fairness, and monitoring

**Objective:** verify that streaks support learning rather than superficial engagement or harm.

**Dependencies:** LEARN-321–323.

**Files:**
- Create: `apps/api/tests/test_streak_invariants.py`, `docs/runbooks/streaks.md`
- Modify: experiment/observability configuration.

1. Define success as meaningful-action completion and later retention, with opt-out, distress/support signals, and shallow-action substitution as guardrails.
2. Run an opt-in or ethically reviewed experiment comparing supportive consistency display with no display; never withhold core review functionality.
3. Instrument qualified days, action mix, freeze use, opt-out, projector lag, and invariant failures without topic/content labels.
4. Audit effects across timezone, usage frequency, accessibility preferences, and new/returning learners.
5. Alert on login qualification, duplicate freeze, cross-user rows, projection lag, opt-out failure, and abnormal minimal-action spikes.
6. Roll out only while learning and well-being guardrails hold; drill global kill switch.

**Acceptance criteria:** experiment measures learning, not DAU alone; invariants have automated tests/alerts; opt-out remains available; no public comparison is introduced; kill switch is verified.

**Verification:** `uv run pytest apps/api/tests/test_streak_invariants.py -q` plus projector/API/UI tests.

**Rollback:** hide UI, stop projector/experiments, retain preferences and events, and publish no misleading historical streak.

## Definition of Done

Streaks count only meaningful evidence, are timezone-correct, private, opt-out capable, non-coercive, explainable, rebuildable, accessible, and governed by learning/well-being metrics rather than engagement alone.
