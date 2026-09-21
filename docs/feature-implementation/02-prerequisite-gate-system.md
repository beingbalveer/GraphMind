# Prerequisite Gate System Implementation Plan
## Plan protocol

- [ ] Read this plan, `AGENTS.md`, `docs/URL_DESIGN.md`, and the cited feature research before coding.
- [ ] Use the agentic-worker sub-skill protocol: one ticket at a time; inspect changed files; run its exact verification; report evidence before starting the next ticket.
- [ ] Record a reviewer checkpoint after each ticket and do not silently widen scope.

**Goal:** Deliver the feature’s learning outcome with explainable, private, production-grade behaviour.

**Architecture:** FastAPI service/router/schema/model layers; provider-agnostic AI through `packages/ai-core`; typed shared contracts; Next.js App Router surface; PostgreSQL persistence and asynchronous projections where specified.

**Tech Stack:** Python 3.12/FastAPI/async SQLAlchemy/Alembic/Pydantic v2/pytest/ruff/mypy; Next.js 15/TypeScript strict/Tailwind/shadcn primitives/vitest; PostgreSQL/Redis.

**Spec:** `docs/FEATURE_RESEARCH.md §1.2`.

**Global Constraints:** Obey `AGENTS.md`: obtain approval before implementation, one roadmap task at a time, and no dead UI. Read `docs/URL_DESIGN.md` before route work; use `@/lib/urls` and Next router, never browser history or primary-ID query parameters. Keep LLMs behind provider abstractions in `packages/ai-core`; make schema changes through reversible Alembic migrations; enforce workspace RBAC on every read/write. Use only `@/components/ui` primitives and semantic tokens, support dark mode, and meet WCAG keyboard, focus, contrast, status-message and non-colour requirements.


# 1.2 Prerequisite Gate System
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


## Status, goal, and boundaries

**Foundation exists, gate does not.** `ConceptModel` records `mastery_level`, confidence, quiz counts and `last_reviewed_at`; `curator_service.py` returns readiness recommendations, while roadmap edges are not enforced as prerequisite gates. Build an explainable *soft gate*: show locked/recommended state and a learner-controlled “study anyway” escape. Do not make algorithmic confidence a punitive lock, credential, or accessibility barrier.

The IES guide recommends spacing, quizzes and deep explanation rather than passive completion ([source](https://ies.ed.gov/ncee/wwc/PracticeGuide/1)); retrieval practice strengthens long-term retention ([Roediger & Butler](https://pubmed.ncbi.nlm.nih.gov/20951630/)). Therefore, a prerequisite is satisfied by a transparent competency policy: ≥2 scored retrieval attempts with ≥0.8 rolling score, or an explicit self-attestation with lower-confidence provenance.

## UX and data flow

Canvas node states are `ready`, `recommended_prerequisite`, `locked`, `overridden`, never colour-only. Clicking locked opens “Why this is recommended,” prerequisite evidence, an accessible short quiz, “learn prerequisite,” and “continue anyway.” A passed attempt updates concepts; transactionally recompute descendants and publish `gate.changed`. Offline UI is read-only; retry follows idempotency keys.

Add `PrerequisiteGateModel(id, workspace_id, target_node_id, prerequisite_concept_id, minimum_evidence, override_reason, updated_at)` and `GateDecision` response, with unique `(target_node_id, prerequisite_concept_id)`. Add `models/prerequisite_gate.py`, `schemas/prerequisite_gate.py`, `services/prerequisite_gate_service.py`, `routers/prerequisite_gates.py`, migration and tests; modify `models/workspace.py`, `services/mastery_service.py`, `services/roadmap_service.py`, `packages/shared/src/index.ts`, `workspaceApi.ts`, `GraphCanvas.tsx`, `ThreadGraphNode.tsx`, and `LearningActions.tsx`. API: `GET /workspaces/{id}/gates`, `POST /.../gates/{node}/evaluate`, `POST /.../override`; workspace role authorization is mandatory.

## AI, risk, reliability

AI may propose gate mappings only from roadmap edges; deterministic service evaluates them. Prompt/eval requires direct-prerequisite rationale, no invented evidence, 100% acyclic mappings, and expert-sampled precision ≥90%. Record `gate_evaluated`, reason codes, override (no answer content), p95 evaluation <200 ms. Cache decisions per workspace revision and invalidate after review events. Make locks keyboard-reachable; use `aria-describedby` explanation and status announcements per [WCAG](https://www.w3.org/WAI/WCAG22/Understanding/status-messages). Minimize sensitive performance data and restrict it to the learner ([U.S. ED](https://studentprivacy.ed.gov/privacy-and-education-technology)).

## Questions answered

1. **Hard lock?** No—agency and uneven prior knowledge matter. 2. **What unlocks?** Evidence policy, not chat volume. 3. **Can self-assessment count?** Yes, marked lower confidence. 4. **Why not completion?** Exposure is not retrieval. 5. **Can one concept satisfy many nodes?** Yes, via gates. 6. **Can AI grade unverified facts?** It may assist, never silently decide. 7. **What after override?** Show a persistent prerequisite reminder. 8. **What if mappings cycle?** Reject at write time. 9. **What is mastery?** A provisional model, not a claim. 10. **What changes with disability accommodations?** Gate is always bypassable.

## Jira implementation tickets

### LEARN-111 — Gate persistence and deterministic evaluator

**Objective:** persist per-user readiness evidence and derive each roadmap node's gate state without asking an LLM to authorize access.

**Dependencies:** accepted roadmap prerequisite edges and the shared learning-event ledger.

**Files:**
- Create: `apps/api/src/models/prerequisite_gate.py`, `apps/api/src/schemas/prerequisite_gate.py`, `apps/api/src/services/prerequisite_gate_service.py`, `apps/api/src/routers/prerequisite_gates.py`, `apps/api/alembic/versions/20260921_0002_add_prerequisite_gates.py`
- Modify: `apps/api/src/models/workspace.py`, `apps/api/src/models/__init__.py`, `apps/api/src/main.py`
- Test: `apps/api/tests/test_prerequisite_gate_service.py`, `apps/api/tests/test_prerequisite_gate_endpoints.py`

**Owned contract:** `GateState = "locked" | "ready" | "completed" | "overridden"`; `PrerequisiteGateResponse(node_id, state, unmet_prerequisite_ids, evidence_summary, evaluated_at, evaluator_version)`; unique `(user_id,node_id)` projection and `(workspace_id,user_id,state)` index.

1. Write failing tests for a root topic, one unmet dependency, an all-met dependency set, a prerequisite cycle, and two users with different evidence.
2. Add the additive migration and relationships; store gate overrides separately with actor, reason, and timestamp so recalculation never erases audit history.
3. Implement a topological evaluator that reads prerequisite edges plus quiz/review events, treats missing evidence as `locked`, and returns `ready` only when every direct prerequisite meets the configured threshold.
4. Reject cross-workspace edges and cycles before evaluation; cap traversal to the workspace node count and log evaluator version/latency without node content.
5. Expose bulk `GET /api/v1/workspaces/{workspace_id}/prerequisite-gates` and idempotent override/revoke endpoints protected by workspace RBAC.
6. Emit `prerequisite_gate.changed` only when the derived state changes, then verify replay produces the same projection.

**Acceptance criteria:** root topics are ready; unmet IDs are exact and authorized; two users never share state; duplicate evidence or override requests do not duplicate events; a 2,000-node acyclic graph evaluates within the documented budget; migration upgrade/downgrade passes.

**Verification:** `uv run pytest apps/api/tests/test_prerequisite_gate_service.py apps/api/tests/test_prerequisite_gate_endpoints.py -q`; `uv run ruff check apps/api`; `uv run mypy apps/api/src`.

**Rollback:** disable `PREREQUISITE_GATES_V1`, stop the projector, and render all nodes navigable; retain gate/evidence rows for replay.

### LEARN-112 — Canvas lock states and assessment entry

**Objective:** explain why a node is locked and offer a real assessment or explicit override path without creating dead UI.

**Dependencies:** LEARN-111 and the existing canvas/node action components.

**Files:**
- Create: `apps/web/src/lib/prerequisiteGateApi.ts`, `apps/web/src/components/learning/PrerequisiteGateDrawer.tsx`, `apps/web/src/components/learning/__tests__/prerequisite-gate-drawer.test.tsx`
- Modify: `apps/web/src/components/canvas/GraphCanvas.tsx`, `apps/web/src/components/canvas/ThreadGraphNode.tsx`, `apps/web/src/components/canvas/FocusDrawer.tsx`, `packages/shared/src/index.ts`
- Test: `apps/web/src/components/canvas/__tests__/knowledge-canvas.test.tsx`

**Owned contract:** shared `PrerequisiteGate` and `GateEvidenceSummary` TypeScript types mirroring LEARN-111; one bulk fetch per graph snapshot.

1. Add strict API decoding and cache gates by `workspaceId:userId:evaluatorVersion`; abort stale requests when workspace or chat changes.
2. Map each gate state into node data without mutating the persisted graph; locked styling uses semantic tokens plus lock icon and text, never colour alone.
3. Make selecting a locked node open `PrerequisiteGateDrawer` listing unmet prerequisites, evidence requirements, and canonical links created with URL helpers.
4. Wire “Take readiness check” to the actual quiz session endpoint and “Override” only for the learner/authorized editor with reason confirmation.
5. Refresh only affected gate records after assessment completion and announce newly ready nodes through a polite live region; respect reduced motion.
6. Add keyboard, focus return, dark-mode, loading, stale-projection, and API failure tests.

**Acceptance criteria:** locked nodes remain readable but cannot start gated learning accidentally; every lock has an explanation; keyboard and pointer invoke the same actions; no raw button, hardcoded route, or colour-only status is added; API failure degrades to “readiness unavailable,” not a false lock.

**Verification:** `pnpm --filter @graphmind/web vitest run src/components/learning/__tests__/prerequisite-gate-drawer.test.tsx src/components/canvas/__tests__/knowledge-canvas.test.tsx`; `pnpm --filter @graphmind/web build`.

**Rollback:** `NEXT_PUBLIC_PREREQUISITE_GATES_V1=false` removes gate interception and restores current node navigation.

### LEARN-113 — Gate calibration, telemetry, and staged rollout

**Objective:** prove gate thresholds improve sequencing without blocking learners unfairly.

**Dependencies:** LEARN-111 and LEARN-112.

**Files:**
- Create: `apps/api/tests/evals/prerequisite_gate_cases.json`, `apps/api/tests/test_prerequisite_gate_evals.py`, `docs/runbooks/prerequisite-gates.md`
- Modify: `apps/api/src/services/prerequisite_gate_service.py` and the project observability configuration.

1. Build synthetic fixtures for novice, prior-expert, sparse-history, stale-review, overridden, and adversarial/cyclic roadmaps.
2. Compare derived readiness with educator labels; record false-lock and false-ready rates by evaluator version.
3. Instrument state transitions, override rate, assessment completion, unlock latency, projection lag, and traversal p95 using privacy-safe IDs.
4. Add alerts for projection backlog, cycle rejection spikes, and an override-rate threshold that indicates bad calibration.
5. Roll out internal → 5% → 25% → 100%, pausing when false-lock, latency, accessibility, or support thresholds fail.
6. Exercise the kill switch and projector replay from a clean checkpoint in staging.

**Acceptance criteria:** fixtures replay deterministically; no release with unresolved cycles or excessive false locks; dashboard exposes version/lag/overrides; kill switch restores navigation without data loss.

**Verification:** `uv run pytest apps/api/tests/test_prerequisite_gate_evals.py -q` plus the LEARN-111/112 suites and web build.

**Rollback:** freeze the evaluator version, disable enforcement while continuing shadow evaluation, and forward-fix thresholds before re-enabling.

## Definition of Done

Gate state is per-user, deterministic, explainable, replayable, and authorization-safe; the canvas exposes an accessible assessment/override flow; calibration and projection-lag dashboards exist; migrations, backend tests, frontend tests, type checks, and production build pass.
