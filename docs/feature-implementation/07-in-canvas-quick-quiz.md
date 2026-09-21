# In-Canvas Quick Quiz Mode Implementation Plan
## Plan protocol

- [ ] Read this plan, `AGENTS.md`, `docs/URL_DESIGN.md`, and the cited feature research before coding.
- [ ] Use the agentic-worker sub-skill protocol: one ticket at a time; inspect changed files; run its exact verification; report evidence before starting the next ticket.
- [ ] Record a reviewer checkpoint after each ticket and do not silently widen scope.

**Goal:** Deliver the feature’s learning outcome with explainable, private, production-grade behaviour.

**Architecture:** FastAPI service/router/schema/model layers; provider-agnostic AI through `packages/ai-core`; typed shared contracts; Next.js App Router surface; PostgreSQL persistence and asynchronous projections where specified.

**Tech Stack:** Python 3.12/FastAPI/async SQLAlchemy/Alembic/Pydantic v2/pytest/ruff/mypy; Next.js 15/TypeScript strict/Tailwind/shadcn primitives/vitest; PostgreSQL/Redis.

**Spec:** `docs/FEATURE_RESEARCH.md §2.3`.

**Global Constraints:** Obey `AGENTS.md`: obtain approval before implementation, one roadmap task at a time, and no dead UI. Read `docs/URL_DESIGN.md` before route work; use `@/lib/urls` and Next router, never browser history or primary-ID query parameters. Keep LLMs behind provider abstractions in `packages/ai-core`; make schema changes through reversible Alembic migrations; enforce workspace RBAC on every read/write. Use only `@/components/ui` primitives and semantic tokens, support dark mode, and meet WCAG keyboard, focus, contrast, status-message and non-colour requirements.


# 2.3 In-Canvas Quick Quiz Mode
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

`LearningActions.tsx` already sends a “Quiz me” prompt, `QuizCard.tsx` exists, and the `quiz_master` skill plus `MasteryService.update_concept` can record a boolean result. There is no durable quiz attempt/question model, reliable per-question grading, or purposeful interleaving. Build a 3–5 question retrieval session tied to a node/concept; do not confuse multiple-choice recognition with proven mastery.

## Flow and contract

Node menu/keyboard action → choose format (default open response; MCQ/fill/true-false as accessible alternatives) and optional related concepts → receive a generated `QuizSession` → answer one item at a time before feedback → rubric feedback and confidence → finish summary with sources and next action. Interleave only prerequisites/siblings selected by graph rules; label unfamiliar items. Retry creates a new session, not an overwrite.

Tables: `quiz_sessions(id, workspace_id,user_id,anchor_node_id,status,question_count,skill_version,created_at,completed_at)` and `quiz_attempts(id,session_id,concept_id,question JSON,answer_encrypted,expected_rubric JSON,score 0..1,grade_source,feedback,answered_at)`. API: `POST /workspaces/{id}/quizzes`, `POST /quizzes/{id}/attempts/{id}/answer`, `GET /quizzes/{id}`. Add schema/service/router/migration/tests; modify `mastery_service.py` to ingest weighted score only after session completion, shared types, `workspaceApi.ts`, `QuizCard.tsx`, `LearningActions.tsx`, `GraphCanvas.tsx`, `ThreadGraphNode.tsx`.

## AI/evaluation and safeguards

Prompt uses only anchor/approved surrounding content; returns typed JSON with answer rubric, evidence spans, cognitive level, and no trick questions. Grader must quote evidence/rubric and return uncertainty; low confidence asks a clarifying question or routes to learner self-grade. Eval with 250 expert-labelled answers: JSON 100%, source grounded ≥98%, score agreement ≥0.85 weighted kappa, harmful/biased feedback 0 critical. Retrieval with feedback is supported by [Roediger & Butler](https://pubmed.ncbi.nlm.nih.gov/20951630/) and spacing/interleaving guidance by [IES](https://ies.ed.gov/ncee/wwc/PracticeGuide/1).

Rate-limit generation/answer grading, redact answers in logs, preserve user export/delete rights, and never expose answers to collaborators. Timer is optional; all formats keyboard usable, answer reveal is explicit, feedback uses `role=status` and pattern/text alongside colour ([WCAG](https://www.w3.org/TR/WCAG22/)). Queue model jobs, timeout safely, idempotent answer posts and observe generation/grade latency, abandonment, calibration and appeal rates.

## Questions answered

1. **Why open-ended default?** It requires recall. 2. **Can MCQ exist?** Yes, as a lower-evidence format. 3. **Who grades?** AI rubric plus user appeal/self-correction. 4. **Are neighbours always included?** No, only pedagogically related/opt-in. 5. **Does one score master a topic?** No. 6. **Can feedback reveal early?** Only after attempt. 7. **Can a question be wrong?** Flag and exclude it. 8. **What if model uncertain?** Ask/review, do not penalize. 9. **How persistent?** Immutable attempts. 10. **How tied to FSRS?** Aggregate evidence, not direct interval command.

## Jira implementation tickets

### LEARN-221 — Quiz session, question, and attempt persistence

**Objective:** replace ephemeral quiz JSON with resumable, auditable quiz sessions and immutable attempts tied to authorized source nodes/concepts.

**Dependencies:** learning-event ledger and existing `QuizCard`/mastery feedback path.

**Files:**
- Create: `apps/api/src/models/quiz.py`, `apps/api/src/schemas/quiz.py`, `apps/api/src/services/quiz_service.py`, `apps/api/src/routers/quizzes.py`, `apps/api/alembic/versions/20260921_0007_add_quiz_sessions.py`
- Modify: `apps/api/src/models/workspace.py`, `apps/api/src/main.py`
- Test: `apps/api/tests/test_quiz_service.py`, `apps/api/tests/test_quiz_endpoints.py`

**Owned contract:** `QuizSession(status,source_node_ids,mode,question_count,prompt_version)`; immutable `QuizAttempt(question_id,response,score,rubric_version,feedback,submitted_at)`; idempotent start/submit/finish endpoints.

1. Write failing tests for node, parent/sibling interleaving, MCQ, fill, true/false, open response, resume, duplicate submit, and cross-workspace access.
2. Add models/indexes/migration; snapshot question/rubric/source references so later node edits do not rewrite an attempt.
3. Implement session creation that authorizes every source, caps 3–5 questions, and prevents answer/rubric leakage in the learner question DTO.
4. Implement idempotent answer submission; deterministic formats score in code, while open responses call a versioned grader and preserve uncertainty.
5. Finish transactionally, append `quiz.completed` evidence, and update mastery through the projector rather than direct client counters.
6. Expose resume/detail endpoints with learner-only answers and safe 404 behavior.

**Acceptance criteria:** answers are hidden until submit; retries create one attempt; session resumes exactly; other users/workspaces cannot read questions or attempts; completion evidence equals persisted attempts.

**Verification:** `uv run pytest apps/api/tests/test_quiz_service.py apps/api/tests/test_quiz_endpoints.py -q`; `uv run ruff check apps/api`; `uv run mypy apps/api/src`.

**Rollback:** `QUIZ_SESSIONS_V1=false` blocks new sessions but leaves existing sessions readable/completable.

### LEARN-222 — Grounded generation, grading, and evaluation

**Objective:** ensure generated questions and open-answer grades are source-grounded, unambiguous, and calibrated.

**Dependencies:** LEARN-221 and provider abstraction.

**Files:**
- Create: `apps/api/src/services/quiz_generation_service.py`, `apps/api/src/services/quiz_grading_service.py`, `apps/api/tests/evals/quiz_cases.json`, `apps/api/tests/test_quiz_evals.py`
- Modify: `packages/ai-core` structured-generation interface only if an existing abstraction cannot carry the schema.

1. Define strict generation DTOs with question, options, correct option/rubric, source spans, difficulty, and concept IDs.
2. Delimit source content as untrusted data; reject outside facts, duplicate concepts, multiple correct MCQ options, and unsupported source spans.
3. Score closed formats deterministically; grade open answers against a bounded rubric returning score, matched criteria, missing criteria, uncertainty, and feedback.
4. Assemble educator-labelled generation/grading cases including paraphrases, partially correct answers, adversarial source text, and “cannot grade” cases.
5. Set launch gates for schema validity, source support, ambiguity, grading agreement/calibration, harmful feedback, latency, and cost.
6. Persist prompt/model/rubric versions and deterministic fallbacks; never invent a score after provider failure.

**Acceptance criteria:** invalid output persists nothing; closed-format scoring is model-independent; open-grade uncertainty is visible; eval thresholds are reproducible; prompt injection fixtures cannot change format/tools.

**Verification:** `uv run pytest apps/api/tests/test_quiz_evals.py -q` and save the versioned eval report.

**Rollback:** pin the last passing prompt/rubric, disable open-ended grading, and retain deterministic formats.

### LEARN-223 — Accessible in-canvas quiz session UI

**Objective:** provide a complete question-by-question retrieval flow from chat and canvas with truthful progress and feedback.

**Dependencies:** LEARN-221/222.

**Files:**
- Create: `apps/web/src/lib/quizApi.ts`, `apps/web/src/components/quiz/QuizSessionDrawer.tsx`, `QuizQuestion.tsx`, and tests.
- Modify: `apps/web/src/components/chat/QuizCard.tsx`, `LearningActions.tsx`, `apps/web/src/components/canvas/FocusDrawer.tsx`, `packages/shared/src/index.ts`

1. Replace prompt-only launch with session creation using the selected node and explicit format/interleaving options.
2. Render one question at a time; require submission before feedback and never include hidden answer fields in DOM/accessibility text.
3. Support radio group, text, boolean, and open response with visible labels, validation, keyboard operation, and focus on feedback heading.
4. Save each answer with an idempotency key, display pending/retry state without clearing input, and resume unfinished sessions.
5. Finish with score breakdown, uncertainty, source navigation, and recommended review—not celebratory mastery claims.
6. Test keyboard/screen reader, duplicate submit, offline retry, close/resume, mobile layout, dark mode, and reduced motion.

**Acceptance criteria:** no answer leakage; progress survives refresh; all formats are keyboard accessible; errors preserve input; completion refreshes mastery projection once.

**Verification:** `pnpm --filter @graphmind/web vitest run src/components/quiz/__tests__/quiz-session-drawer.test.tsx src/components/chat/__tests__/cross-surface-learning.test.tsx`; `pnpm --filter @graphmind/web build`.

**Rollback:** hide new launcher via `NEXT_PUBLIC_QUIZ_SESSIONS_V1`; retain current read-only historical QuizCard rendering.

### LEARN-224 — Mastery ingestion and quiz operations

**Objective:** convert quiz results into bounded learning evidence and operate the feature safely.

**Dependencies:** LEARN-221–223 and mastery projection.

**Files:**
- Create: `apps/api/tests/test_quiz_mastery_projection.py`, `docs/runbooks/quiz-sessions.md`
- Modify: quiz event consumer and observability configuration.

1. Map completion into per-question evidence with rubric/version and cap its contribution to mastery.
2. Make the consumer idempotent by event ID and replay it into a shadow mastery projection.
3. Instrument start/completion/abandonment, format, grading uncertainty, score distribution, projection lag, latency, and provider cost without responses.
4. Add alerts for answer leakage regression, grading failures, event lag, anomalous perfect scores, and cross-tenant invariant failure.
5. Roll out closed formats first, then open grading to a small cohort after agreement gates pass.
6. Exercise feature kill switch, consumer replay, and DLQ recovery.

**Acceptance criteria:** one completion changes projection once; score alone never marks mastery; dashboards expose version/lag/uncertainty; rollback does not lose attempts.

**Verification:** `uv run pytest apps/api/tests/test_quiz_mastery_projection.py -q` plus all quiz API/UI/eval suites.

**Rollback:** stop new sessions/grading, drain committed attempts, replay after repair, and keep history readable.

## Definition of Done

Quiz sessions are durable, grounded, answer-safe, idempotent, accessible, resumable, calibrated, and projection-backed; exact migrations, API, eval, UI, mastery, replay, and production-build checks pass.
