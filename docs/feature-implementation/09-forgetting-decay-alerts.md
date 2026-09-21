# What Have I Forgotten? — Decay Alerts Implementation Plan
## Plan protocol

- [ ] Read this plan, `AGENTS.md`, `docs/URL_DESIGN.md`, and the cited feature research before coding.
- [ ] Use the agentic-worker sub-skill protocol: one ticket at a time; inspect changed files; run its exact verification; report evidence before starting the next ticket.
- [ ] Record a reviewer checkpoint after each ticket and do not silently widen scope.

**Goal:** Deliver the feature’s learning outcome with explainable, private, production-grade behaviour.

**Architecture:** FastAPI service/router/schema/model layers; provider-agnostic AI through `packages/ai-core`; typed shared contracts; Next.js App Router surface; PostgreSQL persistence and asynchronous projections where specified.

**Tech Stack:** Python 3.12/FastAPI/async SQLAlchemy/Alembic/Pydantic v2/pytest/ruff/mypy; Next.js 15/TypeScript strict/Tailwind/shadcn primitives/vitest; PostgreSQL/Redis.

**Spec:** `docs/FEATURE_RESEARCH.md §2.5`.

**Global Constraints:** Obey `AGENTS.md`: obtain approval before implementation, one roadmap task at a time, and no dead UI. Read `docs/URL_DESIGN.md` before route work; use `@/lib/urls` and Next router, never browser history or primary-ID query parameters. Keep LLMs behind provider abstractions in `packages/ai-core`; make schema changes through reversible Alembic migrations; enforce workspace RBAC on every read/write. Use only `@/components/ui` primitives and semantic tokens, support dark mode, and meet WCAG keyboard, focus, contrast, status-message and non-colour requirements.


# 2.5 What Have I Forgotten? — Decay Alerts
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

No FSRS state or notification channel currently exists; `mastery_service.py` only marks concepts stale by elapsed days. After 2.2, surface a gentle, rate-limited alert when a card’s predicted retrievability crosses the learner’s chosen threshold (default 0.70), aggregating cards into a concept/node recommendation. Do not claim someone has forgotten, generate guilt-inducing streak pressure, or alert solely from inactivity.

## Contract and flow

Daily scheduler queries `review_states` due/at-risk by user timezone, groups by concept/source node, deduplicates and applies quiet hours/notification preference. It writes `decay_alerts(id,user_id,workspace_id,concept_id,threshold,predicted_retrievability,state,presented_at,acted_at,dismissed_until)` with active unique key. UI: Context Rail count + node pattern/badge → “review now”, “snooze 1/3/7 days”, “not relevant”; no email until an explicit notification preference exists. `GET /alerts`, `POST /alerts/{id}/act|dismiss|snooze` publish `alert.changed`.

Create model/schema/service/router/worker/migration/tests; modify FSRS service, `mastery_service.py`, `ContextRail.tsx`, `GraphCanvas.tsx`, settings, shared types and API client. Use deterministic state/version from 2.2, never an LLM. Index `(user_id,state,presented_at)` and batch page through users.

Spacing is evidence-supported ([IES](https://ies.ed.gov/ncee/wwc/PracticeGuide/1)); FSRS represents retrievability as a probability ([algorithm](https://github.com/open-spaced-repetition/fsrs4anki/wiki/The-Algorithm)), not certainty. Track alert→review conversion, opt-outs/snoozes, subsequent recall calibration, duplicate/late sends and delivery failures. Worker SLO: daily run completes by 06:00 local, exactly-once logical alert via DB uniqueness; retries/DLQ and no notification on uncertain scheduler state.

## Safeguards and research questions

Decay is a forecast, not a diagnosis. Use FSRS retrievability only when valid review state exists; otherwise label heuristic risk separately. Store UTC, honor learner timezone/quiet hours, suppress duplicates, minimize notification text, and provide per-channel opt-out.

1. **Is a fixed 14-day threshold sufficient?** No; prefer FSRS state where available.
2. **Is 70% a universal risk threshold?** No; make the target configurable and calibrate.
3. **Can unread alerts lower mastery?** No.
4. **Should every at-risk item notify?** No; rank, cap, and respect burden.
5. **What happens after dismissal?** Snooze/suppress without changing memory evidence.
6. **How handle no FSRS history?** Show a separately labelled heuristic review suggestion.
7. **Can alerts reveal private topics on lock screens/email?** Default to generic copy with opt-in detail.
8. **How are timezones handled?** UTC state and account-local delivery windows, with DST tests.

## Jira implementation tickets

### LEARN-241 — Risk projection and alert candidate worker

**Objective:** derive deduplicated, explainable “at risk” candidates from review state without sending notifications.

**Dependencies:** FSRS review state for calibrated cards and the learning-event ledger.

**Files:**
- Create: `apps/api/src/models/decay_alert.py`, `apps/api/src/schemas/decay_alert.py`, `apps/api/src/services/decay_risk_service.py`, `apps/api/src/workers/decay_alert_worker.py`, `apps/api/alembic/versions/20260921_0009_add_decay_alerts.py`.
- Modify: flashcard/concept relationships and worker registration.
- Test: `apps/api/tests/test_decay_risk_service.py`, `apps/api/tests/test_decay_alert_worker.py`

**Owned contract:** `DecayCandidate(subject_type,subject_id,risk_kind,retrievability,threshold,due_at,reasons,algorithm_version)`; alert lifecycle `pending|shown|snoozed|completed|expired`; unique active alert per user/subject/version.

1. Write deterministic-clock tests for due/not-due cards, no history, stale concepts, threshold boundaries, DST, deleted subjects, and duplicate worker runs.
2. Add alert/projection tables and indexes `(user_id,status,due_at)`; do not copy node/card content into alert rows.
3. Compute FSRS retrievability with the pinned scheduler; run heuristic candidates through a separate labelled path and never fabricate D/S/R values.
4. Rank by review urgency and learning-plan relevance, cap daily candidates, and suppress completed/snoozed/duplicate subjects.
5. Process users in checkpointed batches with tenant isolation, backoff, DLQ, and idempotent upsert.
6. Emit candidate-created/expired events only after commit and record algorithm version/lag.

**Acceptance criteria:** repeated jobs create one active alert; calibrated and heuristic risks are distinguishable; deleted/inaccessible subjects disappear; DST does not double a day; worker resumes from checkpoint.

**Verification:** `uv run pytest apps/api/tests/test_decay_risk_service.py apps/api/tests/test_decay_alert_worker.py -q`; `uv run ruff check apps/api`; `uv run mypy apps/api/src`.

**Rollback:** stop `DECAY_ALERTS_V1` worker and expire pending rows; FSRS review state remains untouched.

### LEARN-242 — Preferences and alert lifecycle API

**Objective:** let each learner control threshold, channels, quiet hours, daily cap, snooze, and dismissal.

**Dependencies:** LEARN-241.

**Files:**
- Create: `apps/api/src/routers/decay_alerts.py`, `apps/api/src/schemas/notification_preferences.py`, endpoint tests.
- Modify: user settings model/service, `main.py`.
- Test: `apps/api/tests/test_decay_alert_endpoints.py`, `apps/api/tests/test_notification_preferences.py`

1. Add account-level preferences with validated timezone, desired retention/risk threshold, enabled channels, quiet window, detail privacy, and daily cap.
2. Expose paginated due alert list and idempotent snooze/dismiss/complete endpoints with author-only access.
3. Reauthorize the source subject on every read/action; return unavailable without leaking deleted or revoked titles.
4. Convert local quiet-hour boundaries using IANA timezone data and define behavior for ambiguous/nonexistent DST times.
5. Make preference changes affect future delivery immediately without rewriting review history.
6. Test validation, cross-user access, idempotency, timezone changes, snooze expiry, and delete/export.

**Acceptance criteria:** opt-out stops future deliveries; snooze never changes FSRS state; other users cannot infer alerts; invalid timezone/window is rejected; duplicate lifecycle requests are stable.

**Verification:** `uv run pytest apps/api/tests/test_decay_alert_endpoints.py apps/api/tests/test_notification_preferences.py -q`.

**Rollback:** disable API mutations/new delivery while keeping preferences/export readable.

### LEARN-243 — Canvas and review-rail experience

**Objective:** surface a gentle, privacy-safe review suggestion that leads to a real review flow.

**Dependencies:** LEARN-241/242 and FSRS review queue.

**Files:**
- Create: `apps/web/src/lib/decayAlertApi.ts`, `apps/web/src/components/review/DecayAlertRail.tsx`, and tests.
- Modify: `ContextRail.tsx`, `ThreadGraphNode.tsx`, settings UI, shared types.

1. Fetch only due capped alerts and render generic summary first; reveal topic detail according to the learner's privacy setting.
2. Add a textual “Review suggested” badge/icon to affected nodes without changing persisted graph or mastery color.
3. Wire Review to the actual queue/source, Snooze to explicit duration choices, and Dismiss to confirmation; all actions use idempotency keys.
4. Announce counts/status politely, restore focus after actions, and use semantic tokens, reduced motion, dark mode, and mobile layout.
5. Preserve stale data with timestamp on refresh failure; never show a false zero as success.
6. Test keyboard operation, privacy-detail off, source deletion, double click, offline retry, quiet-hours summary, and canonical navigation.

**Acceptance criteria:** the badge is not colour-only; opening/dismissing never changes memory evidence; private titles stay hidden when configured; every action works; failure is recoverable.

**Verification:** `pnpm --filter @graphmind/web vitest run DecayAlertRail ContextRail`; `pnpm --filter @graphmind/web build`.

**Rollback:** `NEXT_PUBLIC_DECAY_ALERTS_V1=false` hides rail/badges while review queue remains available.

### LEARN-244 — Delivery operations and calibration

**Objective:** deliver no more than useful, consented alerts and validate forecast calibration.

**Dependencies:** LEARN-241–243 and notification infrastructure for non-in-app channels.

**Files:**
- Create: `apps/api/tests/evals/decay_calibration_cases.json`, `apps/api/tests/test_decay_calibration.py`, `docs/runbooks/decay-alerts.md`
- Modify: notification dispatcher and observability configuration.

1. Send in-app first; add email/push only after explicit channel consent, verified address/device, unsubscribe, and generic default copy.
2. Use transactional outbox/provider idempotency, retry/backoff, bounce/token cleanup, quiet hours, and daily cap.
3. Measure Brier/calibration curves against later review outcomes by algorithm version; do not infer recall from notification clicks.
4. Instrument candidate/delivered/opened/reviewed/snoozed/opt-out, burden per learner, lag, failures, and provider cost without topic text.
5. Add alerts for duplicate delivery, cap/quiet-hour breach, opt-out failure, backlog, and calibration regression.
6. Roll out internal → 5% → 25% → 100%; stop promotion on burden, privacy, calibration, or reliability breach.

**Acceptance criteria:** no delivery after opt-out; no duplicate for one outbox item; quiet hours/caps hold across DST; calibration report is versioned; kill switch stops sends immediately.

**Verification:** `uv run pytest apps/api/tests/test_decay_calibration.py -q` plus worker/API/UI tests and a sandbox provider delivery test.

**Rollback:** disable dispatcher then candidate creation, drain/void queued sends, retain preferences and review history, and forward-fix calibration.

## Definition of Done

Decay alerts are calibrated or clearly heuristic, capped, consented, privacy-safe, timezone-correct, idempotent, accessible, and connected to real reviews; worker, API, delivery, UI, calibration, and rollback evidence pass.

## Sources

- [Official FSRS algorithm documentation](https://github.com/open-spaced-repetition/awesome-fsrs/wiki/The-Algorithm)
- [IES Organizing Instruction and Study to Improve Student Learning](https://ies.ed.gov/ncee/wwc/PracticeGuide/1)
- [MDN Notifications API](https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API)
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/)
