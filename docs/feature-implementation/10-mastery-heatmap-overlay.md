# Mastery Heatmap Overlay Implementation Plan
## Plan protocol

- [ ] Read this plan, `AGENTS.md`, `docs/URL_DESIGN.md`, and the cited feature research before coding.
- [ ] Use the agentic-worker sub-skill protocol: one ticket at a time; inspect changed files; run its exact verification; report evidence before starting the next ticket.
- [ ] Record a reviewer checkpoint after each ticket and do not silently widen scope.

**Goal:** Deliver the feature’s learning outcome with explainable, private, production-grade behaviour.

**Architecture:** FastAPI service/router/schema/model layers; provider-agnostic AI through `packages/ai-core`; typed shared contracts; Next.js App Router surface; PostgreSQL persistence and asynchronous projections where specified.

**Tech Stack:** Python 3.12/FastAPI/async SQLAlchemy/Alembic/Pydantic v2/pytest/ruff/mypy; Next.js 15/TypeScript strict/Tailwind/shadcn primitives/vitest; PostgreSQL/Redis.

**Spec:** `docs/FEATURE_RESEARCH.md §3.1`.

**Global Constraints:** Obey `AGENTS.md`: obtain approval before implementation, one roadmap task at a time, and no dead UI. Read `docs/URL_DESIGN.md` before route work; use `@/lib/urls` and Next router, never browser history or primary-ID query parameters. Keep LLMs behind provider abstractions in `packages/ai-core`; make schema changes through reversible Alembic migrations; enforce workspace RBAC on every read/write. Use only `@/components/ui` primitives and semantic tokens, support dark mode, and meet WCAG keyboard, focus, contrast, status-message and non-colour requirements.


# 3.1 Mastery Heatmap Overlay
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


## Existing implementation and goal

**Substantially shipped, but heuristic.** `GraphCanvas.tsx` fetches `WorkspaceMasterySummary`, maps concepts to graph nodes, and passes mastery information to `treeToGraph`/`ThreadGraphNode`; `MasteryPanel.tsx` exposes distributions. `ConceptModel` offers states and quiz-derived confidence. Build an explicit, explainable overlay that uses an auditable mastery read model and gives every colour a text/pattern equivalent. Do not portray a confidence estimate as a diagnosis or hide the normal graph semantics.

## Product/learning design

The overlay toggle has modes `off|evidence|retrievability`; legend explains that evidence combines retrieval, recency and exploration, while retrievability is available only when FSRS data exists. Tooltip/drawer shows exact contributing signals, score band, last update and “correct this” action. A blind/low-vision learner gets the same list/table mode. Delayed retrieval and quizzes support more reliable learning evidence than rereading ([Roediger & Butler](https://pubmed.ncbi.nlm.nih.gov/20951630/)); this informs weights, not a universal mastery threshold.

## Data, APIs, performance

Create a versioned `node_mastery_projection(workspace_id,node_id,evidence_score,retrievability,band,signal_breakdown JSON,computed_at,projection_version)` with `(workspace_id,node_id)` PK. Projection consumer reads normalized activity/review events and concept mappings; current `MasteryService` remains source-compatible during dual-read. API `GET /workspaces/{id}/mastery/heatmap?mode=` returns ETag/version and only nodes the caller can see; SSE `mastery.projection_updated` triggers invalidation. Create model/schema/projector/migration/tests; modify `mastery_service.py`, `curator_service.py`, `GraphCanvas.tsx`, `ThreadGraphNode.tsx`, `treeToGraph.ts`, `MasteryPanel.tsx`, `workspaceApi.ts`, shared types and UI tokens.

Recompute incrementally after a review/quiz/activity event and bulk backfill by workspace revision. Index by workspace; return compact map and virtualize canvas. Target p95 fetch <150 ms for 2k nodes; stale-while-revalidate cache; display timestamp and neutral state on failure. Log projection version/lag, coverage, band movements and correction rate—never node text.

## Accessibility, safety, questions

Use semantic tokens plus pattern/icon/text; contrast, keyboard toggle, focusable legend and status message comply with [WCAG 2.2](https://www.w3.org/TR/WCAG22/). Workspace RBAC and data minimization apply ([U.S. ED privacy guidance](https://studentprivacy.ed.gov/privacy-and-education-technology)); expose no learner performance in shared workspaces without a later consent model. Evaluate ranking against delayed quiz outcomes, calibration/Brier score and fairness across interaction styles; change weights only via versioned experiment and rollback.

1. **Why an overlay?** Spatially actionable evidence. 2. **Does red mean failure?** No; use neutral “needs evidence.” 3. **Can inactivity dominate?** No. 4. **Can chat count?** Minor signal only. 5. **Why two modes?** Evidence versus forecast are different. 6. **Can user correct it?** Yes. 7. **Are colours sufficient?** Never. 8. **What if FSRS unavailable?** Hide forecast. 9. **Can score be shared?** Not by default. 10. **How validate?** Delayed-recall calibration.

## Jira implementation tickets

### LEARN-301 — Versioned node-mastery projection

**Objective:** derive an explainable per-node evidence snapshot from immutable learning events for fast canvas reads.

**Dependencies:** shared event ledger and existing concept/node mappings.

**Files:**
- Create: `apps/api/src/models/mastery_projection.py`, `apps/api/src/schemas/mastery_projection.py`, `apps/api/src/services/mastery_projection_service.py`, `apps/api/alembic/versions/20260921_0010_add_mastery_projections.py`.
- Modify: `apps/api/src/services/mastery_service.py`, `apps/api/src/routers/mastery.py`, model exports.
- Test: `apps/api/tests/test_mastery_projection.py`, `apps/api/tests/test_mastery_heatmap_endpoints.py`

**Owned contract:** `NodeMasteryProjection(workspace_id,user_id,node_id,evidence_score,retrievability,band,signal_breakdown,projection_version,computed_at)`; bulk ETag response keyed by node ID.

1. Write fixtures for no evidence, exploration-only, correct/incorrect quiz, repeated review, stale review, corrected event, and two users.
2. Add table/index/migration with unique `(user_id,node_id,projection_version)`; store bounded signal values/references, not learner content.
3. Implement versioned weights with caps so passive interactions cannot dominate; keep evidence score and memory forecast separate.
4. Consume events idempotently by event ID/checkpoint and recalculate only affected nodes/concepts.
5. Expose authorized bulk heatmap endpoint with `projectionVersion`, `computedAt`, ETag, pagination/compact map, and stale flag.
6. Shadow-compare with current mastery summaries before switching canvas reads.

**Acceptance criteria:** replay is deterministic; signal breakdown recomposes the score; users never share projections; 2,000-node response meets p95 target; missing FSRS produces no fabricated retrievability.

**Verification:** `uv run pytest apps/api/tests/test_mastery_projection.py apps/api/tests/test_mastery_heatmap_endpoints.py -q`; `uv run ruff check apps/api`; `uv run mypy apps/api/src`.

**Rollback:** `MASTERY_PROJECTION_V2=false` reads current service output and stops the consumer while retaining projection rows.

### LEARN-302 — Accessible canvas overlay and legend

**Objective:** render evidence/forecast modes consistently across canvas LODs without encoding mastery by colour alone.

**Dependencies:** LEARN-301.

**Files:**
- Create: `apps/web/src/lib/masteryApi.ts`, `apps/web/src/components/canvas/MasteryHeatmapLegend.tsx`, and tests.
- Modify: `GraphCanvas.tsx`, `ThreadGraphNode.tsx`, `treeToGraph.ts`, `MasteryPanel.tsx`, shared types/tokens.

1. Decode the bulk projection and map it into transient React Flow node data without persisting style state.
2. Add explicit Off/Evidence/Forecast toggle using `SegmentedTabs`; disable Forecast when retrievability is unavailable.
3. Define semantic token classes plus icon/pattern/text for every band and consistent rules for galaxy, capsule, and detail views.
4. Add a focusable legend explaining score, freshness, and evidence breakdown; selecting a node exposes “Why this state?”.
5. Cache by ETag/version, abort stale requests, and show labelled stale/degraded state rather than clearing the overlay.
6. Test keyboard toggle, screen-reader labels, dark/high-contrast modes, reduced motion, 2,000 nodes, and projection updates.

**Acceptance criteria:** all bands are distinguishable without colour; modes never conflate evidence and forecast; overlay off restores base styling; stale data is labelled; render remains within frame budget.

**Verification:** `pnpm --filter @graphmind/web vitest run MasteryHeatmapLegend cross-surface-learning knowledge-canvas`; `pnpm --filter @graphmind/web build`.

**Rollback:** hide toggle with `NEXT_PUBLIC_MASTERY_HEATMAP_V2=false` and retain current node styling/mastery panel.

### LEARN-303 — Backfill, calibration, and projection operations

**Objective:** rebuild projections safely, validate them against later retrieval, and monitor freshness/quality.

**Dependencies:** LEARN-301/302.

**Files:**
- Create: `apps/api/tests/evals/mastery_projection_cases.json`, `apps/api/tests/test_mastery_projection_evals.py`, `docs/runbooks/mastery-projection.md`
- Modify: projection worker and observability definitions.

1. Backfill by workspace/event checkpoint into a shadow projection version with bounded batches and resumable progress.
2. Reconcile event counts, node coverage, score distributions, and sampled breakdowns before switching the read alias/version.
3. Evaluate calibration/Brier score against delayed quiz/review outcomes and track fairness across interaction styles.
4. Instrument lag, replay failures, coverage, band transitions, correction rate, endpoint p95, and canvas render metrics without content.
5. Alert on lag, cross-tenant invariant failure, large distribution shift, or endpoint/render regression.
6. Roll out internal → 5% → 25% → 100%, retaining the previous projection version for instant read rollback.

**Acceptance criteria:** backfill resumes safely; old/new parity report is signed; projection version switch is atomic; calibration report is reproducible; rollback is tested.

**Verification:** `uv run pytest apps/api/tests/test_mastery_projection_evals.py -q` plus API/UI/performance suites.

**Rollback:** switch reads to prior projection version, stop consumer, fix forward, and rebuild a new version.

## Definition of Done

The heatmap is projection-backed, explainable, calibrated, tenant-safe, fast at graph scale, accessible without colour, fresh/stale aware, and covered by migration, replay, API, UI, performance, and rollback evidence.
