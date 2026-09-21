# Dynamic Gap Analysis Implementation Plan
## Plan protocol

- [ ] Read this plan, `AGENTS.md`, `docs/URL_DESIGN.md`, and the cited feature research before coding.
- [ ] Use the agentic-worker sub-skill protocol: one ticket at a time; inspect changed files; run its exact verification; report evidence before starting the next ticket.
- [ ] Record a reviewer checkpoint after each ticket and do not silently widen scope.

**Goal:** Deliver the feature’s learning outcome with explainable, private, production-grade behaviour.

**Architecture:** FastAPI service/router/schema/model layers; provider-agnostic AI through `packages/ai-core`; typed shared contracts; Next.js App Router surface; PostgreSQL persistence and asynchronous projections where specified.

**Tech Stack:** Python 3.12/FastAPI/async SQLAlchemy/Alembic/Pydantic v2/pytest/ruff/mypy; Next.js 15/TypeScript strict/Tailwind/shadcn primitives/vitest; PostgreSQL/Redis.

**Spec:** `docs/FEATURE_RESEARCH.md §1.4`.

**Global Constraints:** Obey `AGENTS.md`: obtain approval before implementation, one roadmap task at a time, and no dead UI. Read `docs/URL_DESIGN.md` before route work; use `@/lib/urls` and Next router, never browser history or primary-ID query parameters. Keep LLMs behind provider abstractions in `packages/ai-core`; make schema changes through reversible Alembic migrations; enforce workspace RBAC on every read/write. Use only `@/components/ui` primitives and semantic tokens, support dark mode, and meet WCAG keyboard, focus, contrast, status-message and non-colour requirements.


# 1.4 Dynamic Gap Analysis
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


## Current state and intended result

**Partially shipped.** `curator_service.py` identifies knowledge gaps and next topics; `mastery_service.py` summarizes concepts; `MasteryPanel.tsx` displays both. Current signals are mostly heuristic concept confidence, quiz counts and staleness. Evolve this into an auditable, user-correctable gap model—not surveillance and not an assertion that a learner is deficient.

The outcome is a ranked, explained list and graph overlay: “this prerequisite has little retrieval evidence / is stale / is unconnected,” with direct actions. Tests and delayed retrieval are preferable evidence to re-reading ([retrieval review](https://pubmed.ncbi.nlm.nih.gov/20951630/)); the IES guide also recommends delayed quiz-guided allocation of study time ([source](https://ies.ed.gov/ncee/wwc/PracticeGuide/1)).

## Data, flow, and implementation

On `learning_event` append, queue a debounced workspace recompute. Feature inputs: graph prerequisite coverage, unique retrieval outcomes, FSRS retrievability when available, last meaningful interaction, and learner-dismissed recommendations. Produce `GapAssessment(workspace_id, concept_id, kind, score, evidence JSON, computed_at, model_version, dismissed_until)` with unique active assessment per `(workspace, concept, kind)`. Deterministic score and evidence are primary; optional AI only writes a concise explanation constrained to supplied evidence. API: `GET /workspaces/{id}/gaps`, `POST /.../gaps/{id}/dismiss`, `POST /.../gaps/recompute`; websocket/SSE event `gap.updated` invalidates UI cache.

Create `models/gap_projection.py`, `schemas/gap_projection.py`, `services/gap_projection_service.py`, `routers/gaps.py`, migration and tests. Modify `curator_service.py`, `mastery_service.py`, `GraphCanvas.tsx`, `MasteryPanel.tsx`, `workspaceApi.ts`, shared types and worker configuration. Backfill in paged, idempotent jobs; retain historical assessments only aggregated, otherwise 90 days. Index `(workspace_id, computed_at)`.

## AI, safeguards, metrics

Prompt forbids diagnoses or ability labels and outputs `{explanation, suggested_action}` tied to evidence ids; eval 200 synthetic graphs for evidence faithfulness (≥98%), ranking stability and no sensitive inference. Offer “wrong / not relevant” correction. Authorization remains workspace-scoped; limit recomputes; redact content from events; assess under [NIST’s Govern–Map–Measure–Manage model](https://www.nist.gov/itl/ai-risk-management-framework/nist-ai-rmf-playbook). Use patterns/text labels and keyboard toggle, respecting [WCAG](https://www.w3.org/TR/WCAG22/). SLO: incremental recompute p95 <2 s, batch <10 min/10k concepts; DLQ and replay. Metrics: action rate, dismissed-as-wrong rate, next-review success, false-positive audit rate—not “engagement” alone.

## Questions answered

1. **What is a gap?** Missing evidence, not low intelligence. 2. **Does chat volume count?** Weak signal only. 3. **Best evidence?** Delayed retrieval. 4. **Can users correct it?** Yes. 5. **Why store evidence?** Explainability/debugging. 6. **Can it infer demographics?** No. 7. **When recalculate?** Debounced events and manual request. 8. **Can AI rank alone?** No, deterministic score first. 9. **What if no concepts?** Say “insufficient evidence.” 10. **Can stale be a gap?** Yes, separately labelled.

## Jira implementation tickets

### LEARN-131 — Evidence-based gap projection

**Objective:** replace heuristic-only gap labels with a versioned, explainable projection derived from authorized learning evidence and prerequisite relationships.

**Dependencies:** shared learning-event ledger and current `CuratorService` ontology/gap APIs.

**Files:**
- Create: `apps/api/src/models/gap_projection.py`, `apps/api/src/schemas/gap_projection.py`, `apps/api/src/services/gap_projection_service.py`, `apps/api/src/routers/gaps.py`, `apps/api/alembic/versions/20260921_0004_add_gap_projections.py`
- Modify: `apps/api/src/services/curator_service.py`, `apps/api/src/main.py`
- Test: `apps/api/tests/test_gap_projection_service.py`, `apps/api/tests/test_gap_endpoints.py`

**Owned contract:** `GapProjection(concept_id,severity,confidence,reasons[],evidence_counts,dependent_concept_ids,projection_version,computed_at)`; unique `(user_id,workspace_id,concept_id,projection_version)`.

1. Write failing fixtures for missing prerequisite, low quiz accuracy, stale evidence, deep exploration, conflicting signals, and no evidence.
2. Add the projection model/index/migration; keep raw content out of `reasons` and store only event/concept references.
3. Implement deterministic scoring with capped contributions from exploration, quizzes, FSRS retrievability, and prerequisite reachability; return “insufficient evidence” instead of guessing.
4. Reuse curator ontology matching but persist canonical concept IDs and match confidence so label drift can be audited.
5. Update the projector idempotently from event/outbox checkpoints and expose paginated, RBAC-protected gaps ordered by severity/confidence.
6. Shadow-compare projected results with the current curator output before switching reads.

**Acceptance criteria:** identical events replay identically; one noisy signal cannot mark mastery or a severe gap alone; reasons sum to the displayed score; other-workspace evidence never participates; bulk query meets the stated p95.

**Verification:** `uv run pytest apps/api/tests/test_gap_projection_service.py apps/api/tests/test_gap_endpoints.py -q`; `uv run ruff check apps/api`; `uv run mypy apps/api/src`.

**Rollback:** set `GAP_PROJECTION_V2=false`, return the current curator response, and stop the projector without deleting checkpoints.

### LEARN-132 — Explain, correct, and act on a gap

**Objective:** show the learner why a gap was suggested and allow correction or a concrete next action.

**Dependencies:** LEARN-131.

**Files:**
- Create: `apps/web/src/lib/gapApi.ts`, `apps/web/src/components/learning/GapExplanationDrawer.tsx`, and tests.
- Modify: `apps/web/src/components/chat/MasteryPanel.tsx`, `apps/web/src/components/canvas/GraphCanvas.tsx`, `apps/web/src/lib/workspaceApi.ts`, `packages/shared/src/index.ts`

1. Add strict `GapProjection` types and fetch a compact list first; fetch full evidence summary only when the drawer opens.
2. Render severity with text/icon/pattern, confidence as an evidence statement, and an ordered list of privacy-safe reasons.
3. Wire “Review prerequisite,” “Take a quiz,” and “Explore concept” to existing real flows and canonical URL helpers.
4. Add “Not a gap” and “Wrong concept match” corrections that append feedback events without rewriting source evidence.
5. Refresh only the corrected projection and announce changes with a live region; retain the previous view on network failure.
6. Test keyboard navigation, focus return, low-confidence copy, no-evidence state, correction retry, and dark mode.

**Acceptance criteria:** the learner can distinguish observation from inference; corrections are idempotent and auditable; actions never point to inaccessible nodes; low confidence is not shown as fact; no colour-only semantics.

**Verification:** `pnpm --filter @graphmind/web vitest run GapExplanationDrawer MasteryPanel`; `pnpm --filter @graphmind/web build`.

**Rollback:** `NEXT_PUBLIC_GAP_PROJECTION_V2=false` hides explanations/corrections and preserves existing curator UI.

### LEARN-133 — Backfill, calibration, and monitoring

**Objective:** rebuild historical gap projections safely and measure whether recommendations predict useful learning outcomes.

**Dependencies:** LEARN-131 and LEARN-132.

**Files:**
- Create: `apps/api/tests/evals/gap_projection_cases.json`, `apps/api/tests/test_gap_projection_evals.py`, `docs/runbooks/gap-projection.md`
- Modify: projection worker and observability definitions.

1. Backfill by ascending workspace/concept ID with durable checkpoints, bounded batches, and per-tenant transaction limits.
2. Compare old/new gap counts, severity distribution, and sampled reason explanations before enabling reads.
3. Label an educator-reviewed corpus and calculate precision, false-gap rate, calibration, and correction rate by projection version.
4. Instrument lag, failures, insufficient-evidence rate, action completion, correction reasons, and p95 without learner text.
5. Add replay/DLQ commands and alerts for lag, projection drift, cross-tenant invariant failure, and correction spikes.
6. Roll out internal → 5% → 25% → 100% only after parity, latency, privacy, and quality gates pass.

**Acceptance criteria:** backfill resumes after interruption; counts/checksums reconcile; quality report is versioned; kill switch and replay are tested; no rollout on unexplained drift.

**Verification:** `uv run pytest apps/api/tests/test_gap_projection_evals.py -q` plus LEARN-131/132 suites.

**Rollback:** disable new reads/writes, retain projection rows for diagnosis, fix forward, and rebuild a new projection version.

## Definition of Done

Gap analysis is event-backed, calibrated, explainable, correctable, tenant-safe, incrementally projected, and connected to real learning actions; migrations, replay, API, accessibility, performance, and staged-rollout evidence pass.
