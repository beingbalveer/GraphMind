# FSRS-Powered Spaced Repetition Scheduler Implementation Plan
## Plan protocol

- [ ] Read this plan, `AGENTS.md`, `docs/URL_DESIGN.md`, and the cited feature research before coding.
- [ ] Use the agentic-worker sub-skill protocol: one ticket at a time; inspect changed files; run its exact verification; report evidence before starting the next ticket.
- [ ] Record a reviewer checkpoint after each ticket and do not silently widen scope.

**Goal:** Deliver the feature’s learning outcome with explainable, private, production-grade behaviour.

**Architecture:** FastAPI service/router/schema/model layers; provider-agnostic AI through `packages/ai-core`; typed shared contracts; Next.js App Router surface; PostgreSQL persistence and asynchronous projections where specified.

**Tech Stack:** Python 3.12/FastAPI/async SQLAlchemy/Alembic/Pydantic v2/pytest/ruff/mypy; Next.js 15/TypeScript strict/Tailwind/shadcn primitives/vitest; PostgreSQL/Redis.

**Spec:** `docs/FEATURE_RESEARCH.md §2.2`.

**Global Constraints:** Obey `AGENTS.md`: obtain approval before implementation, one roadmap task at a time, and no dead UI. Read `docs/URL_DESIGN.md` before route work; use `@/lib/urls` and Next router, never browser history or primary-ID query parameters. Keep LLMs behind provider abstractions in `packages/ai-core`; make schema changes through reversible Alembic migrations; enforce workspace RBAC on every read/write. Use only `@/components/ui` primitives and semantic tokens, support dark mode, and meet WCAG keyboard, focus, contrast, status-message and non-colour requirements.


# 2.2 FSRS-Powered Spaced Repetition Scheduler
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


## Goal and boundary

Flashcards persist but have no review state/queue. Add an independently testable FSRS-backed scheduler that schedules *card* reviews, exposes a daily queue, and feeds aggregate evidence to concepts. Do not reimplement an unverified formula from memory, claim a medical memory diagnosis, or allow LLMs to choose intervals. The open [FSRS algorithm documentation](https://github.com/open-spaced-repetition/fsrs4anki/wiki/The-Algorithm) defines difficulty, stability, retrievability and grades; its scheduler/optimizer distinction is documented by [FSRS4Anki](https://github.com/open-spaced-repetition/fsrs4anki).

## Architecture/data contract

Vendor/port a version-pinned, tested FSRS implementation behind `SpacedRepetitionScheduler` in `packages/ai-core` or `apps/api/src/services/fsrs_service.py`; verify license and golden vectors before adoption. Tables: `review_states(card_id PK, user_id, due_at, stability, difficulty, retrievability, reps, lapses, scheduler_version, desired_retention, updated_at)` and append-only `review_events(id, card_id, user_id, rating again|hard|good|easy, reviewed_at, elapsed_days, pre_state JSON, post_state JSON, idempotency_key UNIQUE)`. Index `(user_id,due_at)`. API: `GET /workspaces/{id}/reviews?due_before`, `POST /reviews/{card}/grade`, `GET /reviews/summary`; response returns predicted next intervals for all ratings before commitment.

Flow: sidebar “Review today” count → queue (due first; no answer revealed) → answer reveal → grade/optional “not a valid card” → atomic event + state update → next card/finish. A missed day does not punish or reset; timezone is account-configured and due times use UTC. Card deletion cascades state/events. Create schemas/router/migration/service/tests; modify `models/flashcard.py`, `mastery_service.py`, shared types, `flashcardApi.ts`, `ContextRail.tsx`, new `components/review/ReviewQueue.tsx`, and settings.

## Reliability, safety, evidence

Spaced learning and delayed quizzes are recommended by [IES](https://ies.ed.gov/ncee/wwc/PracticeGuide/1). Default desired retention is a visible, adjustable 0.90; do not promise fewer reviews without GraphMind-specific data. Golden test state transitions must match pinned FSRS vectors; transaction lock/card optimistic version prevents double grades; retry uses idempotency; queue query is paginated and p95 <200 ms. Nightly optimizer is opt-in only after a minimum review history and writes a new parameter-version, never overwrites raw events. Alert on queue lag/negative intervals/duplicate grade.

Encrypt review records, restrict to learner/workspace, minimize events in analytics, and offer export/delete. Grade controls must be keyboard operable, labelled and announce next due date ([WCAG](https://www.w3.org/TR/WCAG22/)). Metrics: due completion, forecast calibration (Brier score), interval anomalies, grade distribution, retention—not streak pressure.

## Questions answered

1. **Why FSRS?** Explicit D/S/R state and documented optimizer. 2. **Who selects interval?** Deterministic scheduler. 3. **Is 90% universal?** No, user setting. 4. **Does a flip count?** No, rating does. 5. **Can an LLM grade?** Only optional rubric aid, user confirms. 6. **What if offline?** Queue read cache; grade after reconnect with idempotency. 7. **Can state be recomputed?** Yes from immutable events. 8. **Can cards be shared?** Per-user review state. 9. **How handle timezones?** UTC storage/account display timezone. 10. **Can algorithm update?** Pinned version + replay validation.

## Tickets / DoD

### LEARN-211 — Scheduler adapter and golden vectors

**Objective:** provide a pinned, deterministic FSRS adapter without embedding scheduler equations in routers. **Dependencies:** none; confirm FSRS adapter license before merge. **Files:** create `apps/api/src/services/fsrs_service.py`, `apps/api/tests/test_fsrs_service.py`, `apps/api/tests/fixtures/fsrs_golden_vectors.json`; modify `apps/api/pyproject.toml`. **Contract:** `schedule(state: ReviewState, rating: Literal["again","hard","good","easy"], now: datetime) -> ScheduledReview`; `ReviewState` owns `stability`, `difficulty`, `due_at`, `reps`, `lapses`, `scheduler_version`.

1. Pin the chosen FSRS implementation/version and record license/commit in dependency metadata.
2. Define typed input/output dataclasses with UTC-only datetimes and Decimal-safe interval conversion.
3. Port only the adapter boundary; inject a clock rather than call `now()` inside scheduling.
4. Load published/golden state-transition vectors and compare every output field exactly/tolerantly as documented.
5. Reject unsupported rating/version/state values before scheduling and emit redacted structured diagnostics.

Acceptance: default state schedules each grade deterministically; adapter matches all pinned vectors; naive datetime/invalid rating raises typed 422-domain error; no HTTP/database import occurs in the service. Tests: `uv run pytest apps/api/tests/test_fsrs_service.py -q` including initial, lapse, same-day, long-delay, bad-version and DST-UTC cases. **Rollback/flag:** `LEARNING_FSRS_SCHEDULER_V1`; disabling selects no scheduler/legacy queue and retains no altered card state.

### LEARN-212 — Persistence and due-queue API

**Objective:** atomically save review evidence and expose only the caller’s due cards. **Dependencies:** LEARN-211. **Files:** create `apps/api/src/models/review.py`, `apps/api/src/schemas/review.py`, `apps/api/src/routers/reviews.py`, `apps/api/alembic/versions/20260921_0006_add_review_state.py`, `apps/api/tests/test_review_endpoints.py`; modify `apps/api/src/models/flashcard.py`, `apps/api/src/models/__init__.py`, `apps/api/src/main.py`, `apps/api/src/services/fsrs_service.py`. **Columns:** `review_states(card_id PK,user_id,due_at,stability,difficulty,retrievability,reps,lapses,scheduler_version,version)`; `review_events(id,card_id,user_id,rating,reviewed_at,pre_state,post_state,idempotency_key UNIQUE)`.

1. Add models/foreign keys/cascade rules and indexes `(user_id,due_at)` and `(card_id,reviewed_at)`.
2. Generate and inspect upgrade/downgrade migration on a disposable PostgreSQL database.
3. Implement queue query with user/workspace join, UTC cutoff, limit ≤100 and stable due/id order.
4. Implement grade transaction: authorize, lock/version state, insert unique event, schedule, update state, commit.
5. Expose `GET /workspaces/{id}/reviews` and `POST /reviews/{card_id}/grade` with idempotency header and typed 403/404/409/422 mapping.

Acceptance: due queue excludes other users/cards; repeated grade key makes one event/state change; concurrent grades yield one 200 and one 409/replay; deletion removes state/events; generated interval is never client supplied. Tests: `uv run pytest apps/api/tests/test_review_endpoints.py -q` for owner/viewer/cross-workspace, empty/overdue queue, duplicate key, transaction fault and card delete. **Rollback/flag:** `LEARNING_REVIEW_QUEUE_V1`; disable writes/queue, drain requests, leave additive tables for audit.

### LEARN-213 — Review queue and settings UI

**Objective:** allow a learner to recall before reveal and deliberately grade a due card. **Dependencies:** LEARN-212. **Files:** create `apps/web/src/components/review/ReviewQueue.tsx`, `apps/web/src/components/review/__tests__/review-queue.test.tsx`; modify `apps/web/src/lib/flashcardApi.ts`, `apps/web/src/components/layout/ContextRail.tsx`, `apps/web/src/components/settings/SettingsPage.tsx`, `packages/shared/src/index.ts`. **Types:** `DueReview {cardId,question,sourceNodeId,dueAt,predictedIntervals}` and `GradeReviewInput {rating,idempotencyKey}`.

1. Fetch a bounded queue and show question/source without answer content.
2. Require explicit Reveal before rendering answer and grading controls.
3. Generate one UUID key per grade attempt; disable controls while it is pending and reconcile response.
4. Add timezone/desired-retention settings with validation and explanatory text.
5. Use Button/Modal primitives, focus the next question, announce due/grade state, and navigate source via URL helpers.

Acceptance: answer is absent from DOM before Reveal; keyboard reaches reveal/grades/source/exit without trap; retry after network fault does not double-grade; viewer sees read-safe state/no grade; dark mode uses semantic tokens only. Tests: `pnpm --filter @graphmind/web vitest run ReviewQueue ContextRail`; cover reveal, all grades, pending retry, Escape, focus transfer, 403 and source deep link. **Rollback/flag:** `NEXT_PUBLIC_LEARNING_REVIEW_QUEUE_V1`; hide entry point without deleting queued states.

### LEARN-214 — Calibration and operations

**Objective:** make scheduler quality observable and safely version-updatable. **Dependencies:** LEARN-211–213 and 30 days of opted-in review events. **Files:** create `apps/api/src/services/review_calibration_service.py`, `apps/api/tests/test_review_calibration_service.py`; modify worker configuration, `apps/api/src/services/fsrs_service.py`, and observability dashboards. **Contract:** `replay(user_id, scheduler_version) -> CalibrationReport(brier_score, reviewed_count, anomaly_count)`; never mutate raw events.

1. Build a replay reader ordered by `reviewed_at,id` using immutable review events.
2. Calculate forecast calibration/Brier score and interval/anomaly counters by scheduler version.
3. Store candidate parameters/version separately; require opt-in and minimum event threshold before fitting.
4. Alert on negative interval, missing state, duplicate event, queue lag and calibration regression.
5. Run a dry replay, peer-review report, then canary one cohort with rollback-ready version selection.

Acceptance: replay is deterministic and write-free; metrics have no question/answer text; candidate version never silently changes existing state; alert fires for seeded anomaly; dashboard separates retention from engagement. Tests: `uv run pytest apps/api/tests/test_review_calibration_service.py -q`, `uv run ruff check apps/api`, `pnpm --filter @graphmind/web build`. **Rollback/flag:** `LEARNING_FSRS_CALIBRATION_V1`; stop fitter/canary, pin prior scheduler version, retain reports/events.

Done: vectors pass, state reconstructs exactly from events, duplicate POSTs change state once, migration rollback works, no review answer leaks before reveal, and calibration/queue SLO dashboards exist.

Sources: [FSRS algorithm](https://github.com/open-spaced-repetition/fsrs4anki/wiki/The-Algorithm) · [FSRS4Anki](https://github.com/open-spaced-repetition/fsrs4anki) · [IES](https://ies.ed.gov/ncee/wwc/PracticeGuide/1) · [WCAG](https://www.w3.org/TR/WCAG22/)
