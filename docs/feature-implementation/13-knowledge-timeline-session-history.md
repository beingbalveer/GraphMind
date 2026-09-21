# Knowledge Timeline / Session History Implementation Plan
## Plan protocol

- [ ] Read this plan, `AGENTS.md`, `docs/URL_DESIGN.md`, and the cited feature research before coding.
- [ ] Use the agentic-worker sub-skill protocol: one ticket at a time; inspect changed files; run its exact verification; report evidence before starting the next ticket.
- [ ] Record a reviewer checkpoint after each ticket and do not silently widen scope.

**Goal:** Deliver the feature’s learning outcome with explainable, private, production-grade behaviour.

**Architecture:** FastAPI service/router/schema/model layers; provider-agnostic AI through `packages/ai-core`; typed shared contracts; Next.js App Router surface; PostgreSQL persistence and asynchronous projections where specified.

**Tech Stack:** Python 3.12/FastAPI/async SQLAlchemy/Alembic/Pydantic v2/pytest/ruff/mypy; Next.js 15/TypeScript strict/Tailwind/shadcn primitives/vitest; PostgreSQL/Redis.

**Spec:** `docs/FEATURE_RESEARCH.md §3.4`.

**Global Constraints:** Obey `AGENTS.md`: obtain approval before implementation, one roadmap task at a time, and no dead UI. Read `docs/URL_DESIGN.md` before route work; use `@/lib/urls` and Next router, never browser history or primary-ID query parameters. Keep LLMs behind provider abstractions in `packages/ai-core`; make schema changes through reversible Alembic migrations; enforce workspace RBAC on every read/write. Use only `@/components/ui` primitives and semantic tokens, support dark mode, and meet WCAG keyboard, focus, contrast, status-message and non-colour requirements.


# 3.4 Knowledge Timeline / Session History
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


## Current state and proposed result

**Partial foundation exists.** `CuratorService.get_workspace_timeline` derives node/concept milestones; `/curator/timeline`, `getWorkspaceTimeline`, `GraphCanvas.tsx`, and `TimelineReplayBar.tsx` replay them. It does not preserve a normalized learning activity history, session boundaries, review/quiz events, user annotations, or correction/version semantics. Extend it into a private, chronological learning journal with a replayable, auditable event source.

## Experience and technical design

Canvas “Timeline” continues to replay graph evolution; new journal page/side panel groups events into sessions (“Sep 19: explored Event Loop; attempted two retrieval questions; reviewed Promises”) and offers filter, source link and hide/delete event where policy allows. Timeline items always say whether generated from system event, user action, or AI inference. No invisible inference, fabricated prose, or public activity feed.

Append the canonical panel-approved envelope: `learning_events(id UUID, schema_version int, event_type varchar, actor_user_id UUID, workspace_id UUID, subject_type varchar, subject_id UUID, occurred_at_utc timestamptz, recorded_at_utc timestamptz, result_json JSONB, context_json JSONB, idempotency_key UUID, correlation_id UUID, privacy_classification varchar, voided_by_event_id UUID NULL)` with unique `(actor_user_id,event_type,idempotency_key)`. Register low-cardinality types such as `node.created`, `roadmap.accepted`, `card.generated`, `review.graded`, `quiz.completed`, `teach_back.revised`, `mastery.changed`, and `alert.acted`; producer identity belongs in bounded context fields, not a competing envelope. Build `learning_sessions` projection using explicit start/end plus 30-minute inactivity boundary; events never mutate—corrections append a replacement and set `voided_by_event_id`. The current curator timeline becomes a projection/API consumer so the legacy endpoint continues. Add model/schema/service/router/migration/worker/tests; modify `curator_service.py`, `mastery_service.py`, flashcard/review/quiz services, `GraphCanvas.tsx`, `TimelineReplayBar.tsx`, `workspaceApi.ts`, `urls.ts`, shared types, and add `LearningJournal.tsx`.

API: `GET /workspaces/{id}/learning-events?cursor=&types=`, `GET /.../sessions`, `POST /.../events/{id}/hide`; `timeline.version` SSE only invalidates current workspace. Cursor pagination/partition-by-month strategy is required before large-scale retention. Backfill safe existing nodes/concept milestones as `actor_type=system_backfill` with provenance; never invent granular actions. p95 first 100 events <200 ms; use `(workspace_id,occurred_at DESC)` index; append transactionally through an outbox so database commit and event emission cannot diverge.

## Learning evidence, safeguards, questions

Visible history can support reflection; it is not proof of mastery. Delayed quizzing/retrieval are stronger learning evidence ([IES](https://ies.ed.gov/ncee/wwc/PracticeGuide/1); [Roediger & Butler](https://pubmed.ncbi.nlm.nih.gov/20951630/)). Keep raw answer payload encrypted/minimized, redact deleted content, honor export/delete/retention and workspace RBAC ([U.S. ED](https://studentprivacy.ed.gov/privacy-and-education-technology)). Feed/cards and replay must be keyboard navigable, use text labels/non-colour icons, announce filter/load state ([WCAG](https://www.w3.org/TR/WCAG22/)). Monitor append loss, projection lag, duplicate event, pagination latency and journal drill-through; audit AI summaries for event faithfulness.

1. **Why ledger?** One reconstructable source of history. 2. **Can events mutate?** No; append correction/redaction. 3. **What is a session?** Explicit activity plus inactivity heuristic, labelled. 4. **Can AI narrate?** Only evidence-bound summary. 5. **Can user hide items?** Yes where retention permits. 6. **Can a timeline prove mastery?** No. 7. **Why outbox?** Commit/event consistency. 8. **What is backfilled?** Coarse system provenance. 9. **Can it scale?** Cursor/index/partition plan. 10. **Can collaborators see it?** Not by default.

## Jira implementation tickets

### LEARN-331 — Normalized learning-event ledger and transactional outbox

**Objective:** establish the immutable, tenant-safe evidence foundation used by timeline, dashboard, mastery, streaks, and review orchestration.

**Dependencies:** accepted panel decision in `00-expert-panel-decisions.md`.

**Files:**
- Create: `apps/api/src/models/learning_event.py`, `apps/api/src/models/outbox.py`, `apps/api/src/schemas/learning_event.py`, `apps/api/src/services/learning_event_service.py`, `apps/api/alembic/versions/20260921_0013_add_learning_event_ledger.py`.
- Modify: model exports, workspace/user relationships, transaction helpers.
- Test: `apps/api/tests/test_learning_event_service.py`, `apps/api/tests/test_learning_event_outbox.py`

**Owned contract:** event envelope from the panel decision; immutable rows, `voided_by_event_id`, unique `(actor_user_id,idempotency_key,event_type)`; outbox delivery/checkpoint fields.

1. Define a low-cardinality versioned event registry for node explored, quiz attempted/completed, card reviewed, annotation created, roadmap accepted, and future extension.
2. Add ledger/outbox tables, tenant/time/type indexes, payload size/privacy classification constraints, and reversible migration.
3. Implement `append_event(session,event)` so domain mutation, event, and outbox insert share one transaction.
4. Reject unknown event versions/types, cross-workspace subjects, dynamic event names, raw sensitive bodies, and duplicate idempotency keys.
5. Build an outbox dispatcher with `FOR UPDATE SKIP LOCKED`, backoff, attempts, dead-letter state, and at-least-once delivery.
6. Test rollback, concurrency, duplicate retries, void/correction, ordering timestamps, delete/privacy behavior, dispatcher crash/replay, and tenant isolation.

**Acceptance criteria:** failed domain mutation leaves no event; committed mutation has one event/outbox row; retries are stable; consumers can replay; sensitive text is excluded; cross-tenant references fail.

**Verification:** `uv run pytest apps/api/tests/test_learning_event_service.py apps/api/tests/test_learning_event_outbox.py -q`; `uv run ruff check apps/api`; `uv run mypy apps/api/src`.

**Rollback:** stop new event-dependent features/dispatcher; do not drop ledger after production writes; existing domain paths remain available until dual-write migration completes.

### LEARN-332 — Sessionization and timeline projections

**Objective:** build a chronological, replayable view from ledger events without expensive request-time reconstruction.

**Dependencies:** LEARN-331.

**Files:**
- Create: `apps/api/src/models/timeline_projection.py`, `apps/api/src/services/timeline_projection_service.py`, `apps/api/src/workers/timeline_projection_worker.py`, `apps/api/alembic/versions/20260921_0013_add_learning_event_ledger.py` (same migration as LEARN-331; do not create a second revision).
- Modify: `apps/api/src/services/curator_service.py`, `apps/api/src/routers/curator.py`
- Test: `apps/api/tests/test_timeline_projection.py`, `apps/api/tests/test_timeline_endpoints.py`

**Owned contract:** `LearningSession(id,user_id,workspace_id,started_at,ended_at,event_count,projection_version)`; `TimelineItem(event_id,session_id,event_type,title_key,subject_ref,occurred_at,source_kind,metadata)`.

1. Define session boundary policy (for example 30 minutes of inactivity) and version it; keep original event timestamps authoritative.
2. Project events idempotently into sessions/items, reopening/rebuilding adjacent sessions for late/voided events.
3. Generate display title keys and bounded metadata from event type; resolve current authorized subject labels at read time.
4. Expose cursor-paginated timeline filters by date/event/source with freshness/version and safe 404/RBAC.
5. Keep existing graph timeline endpoint compatible during dual-read and compare ordering/counts before cutover.
6. Test same-time events, late events, voiding, deleted subjects, membership revoked, pagination stability, large history, and projector replay.

**Acceptance criteria:** ordering is deterministic; late events land in the correct session; deleted/private subjects do not leak; cursor pagination has no duplicates/gaps; projection p95 meets target.

**Verification:** `uv run pytest apps/api/tests/test_timeline_projection.py apps/api/tests/test_timeline_endpoints.py -q`.

**Rollback:** switch reads to current curator timeline and stop the new projector; retain ledger/projection for repair.

### LEARN-333 — Learning journal and graph replay UI

**Objective:** show an accessible narrative of real learning actions and preserve existing canvas replay.

**Dependencies:** LEARN-332.

**Files:**
- Create: `apps/web/src/lib/timelineApi.ts`, `apps/web/src/components/learning/KnowledgeJournal.tsx`, tests.
- Modify: `TimelineReplayBar.tsx`, `GraphCanvas.tsx`, workspace navigation, shared types.

1. Fetch paginated sessions and render semantic date/session groups with source-kind and event labels, not AI-fabricated prose.
2. Add filters for date, activity type, and source; keep them in approved UI/URL state without primary navigation IDs in query parameters.
3. Resolve source links through URL helpers and show unavailable/private tombstone when authorization changes.
4. Connect a journal item to existing graph replay timestamp/focus; preserve selected filters when returning.
5. Provide loading/empty/stale/error/retry, keyboard navigation, focus management, accessible table/list semantics, mobile/dark modes.
6. Test pagination, filters, same timestamps, unavailable source, canonical navigation, replay handoff, and screen-reader grouping.

**Acceptance criteria:** every item maps to a real event; graph replay remains functional; inaccessible content never leaks; all filters/actions work by keyboard; large history virtualizes/paginates.

**Verification:** `pnpm --filter @graphmind/web vitest run KnowledgeJournal TimelineReplayBar`; `pnpm --filter @graphmind/web build`.

**Rollback:** `NEXT_PUBLIC_KNOWLEDGE_JOURNAL_V1=false` hides journal and retains existing replay bar.

### LEARN-334 — Privacy, retention, replay, and operations

**Objective:** operate an auditable history while honoring deletion and preventing activity surveillance.

**Dependencies:** LEARN-331–333.

**Files:**
- Create: `docs/runbooks/learning-events-timeline.md`, `apps/api/tests/test_learning_event_privacy.py`
- Modify: export/delete/retention jobs and observability configuration.

1. Define retention by privacy classification; remove payload-bearing domain records and append privacy-safe void/tombstone where audit integrity requires it.
2. Include authorized ledger/timeline data in user export with schema/version glossary.
3. Add projection rebuild, checkpoint reset, DLQ replay, and count/checksum reconciliation commands.
4. Instrument append/outbox/projector lag, failures, DLQ, endpoint p95, unavailable subjects, and delete backlog without content.
5. Alert on cross-tenant reference, raw sensitive payload canary, lag, checksum drift, delete SLA, and cursor regression.
6. Run internal/5/25/100 rollout and disaster-recovery/replay exercise before full enablement.

**Acceptance criteria:** delete/export behavior is documented/tested; projection rebuild matches ledger; privacy payload rules are enforced; alerts fire in staging; journal can be disabled without losing core events.

**Verification:** `uv run pytest apps/api/tests/test_learning_event_privacy.py -q` plus ledger/projection/API/UI suites.

**Rollback:** disable journal/read model and stop consumers safely; keep ledger immutable, fix forward, and rebuild a new projection version.

## Definition of Done

The timeline is grounded in a transactional immutable ledger, incrementally sessionized, authorization-safe, paginated, accessible, replayable, export/delete aware, monitored, and backward-compatible with current graph replay.
