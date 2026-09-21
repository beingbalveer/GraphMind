# Feynman Mode — Teach It Back Implementation Plan
## Plan protocol

- [ ] Read this plan, `AGENTS.md`, `docs/URL_DESIGN.md`, and the cited feature research before coding.
- [ ] Use the agentic-worker sub-skill protocol: one ticket at a time; inspect changed files; run its exact verification; report evidence before starting the next ticket.
- [ ] Record a reviewer checkpoint after each ticket and do not silently widen scope.

**Goal:** Deliver the feature’s learning outcome with explainable, private, production-grade behaviour.

**Architecture:** FastAPI service/router/schema/model layers; provider-agnostic AI through `packages/ai-core`; typed shared contracts; Next.js App Router surface; PostgreSQL persistence and asynchronous projections where specified.

**Tech Stack:** Python 3.12/FastAPI/async SQLAlchemy/Alembic/Pydantic v2/pytest/ruff/mypy; Next.js 15/TypeScript strict/Tailwind/shadcn primitives/vitest; PostgreSQL/Redis.

**Spec:** `docs/FEATURE_RESEARCH.md §2.4`.

**Global Constraints:** Obey `AGENTS.md`: obtain approval before implementation, one roadmap task at a time, and no dead UI. Read `docs/URL_DESIGN.md` before route work; use `@/lib/urls` and Next router, never browser history or primary-ID query parameters. Keep LLMs behind provider abstractions in `packages/ai-core`; make schema changes through reversible Alembic migrations; enforce workspace RBAC on every read/write. Use only `@/components/ui` primitives and semantic tokens, support dark mode, and meet WCAG keyboard, focus, contrast, status-message and non-colour requirements.


# 2.4 Feynman Mode — Teach It Back
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


## Status and objective

The existing `teach_back` learning action asks for an explanation and promises focused follow-up; it is a prompt-only interaction. Add a durable, learner-controlled explanation loop that compares an explanation against an approved concept rubric, identifies gaps/jargon, and asks one next question. It must not shame, overclaim understanding, or rewrite the learner’s voice.

## Experience and architecture

Select node → “Teach it back” → plain-language goal/audience selector → learner writes or dictates explanation → consent notice for AI analysis → response shows `accurate ideas`, `missing ideas`, `unclear terms`, evidence links, and one probing question → learner revises/ends → optional self-rating. The visible label is “evidence of current understanding,” never “AI-certified mastery.”

Add `teach_back_sessions` and immutable `teach_back_revisions(id,session_id,body_encrypted,analysis JSON,self_rating,created_at)`, encrypted at rest. API `POST /teach-back`, `POST /teach-back/{id}/revisions`, `GET /teach-back/{id}`. Create schemas/service/router/migration/tests; modify `LearningActions.tsx`, `ChatInput.tsx`, `ChatContainer.tsx`, `MasteryPanel.tsx`, `workspaceApi.ts`, shared types, and `mastery_service.py` so self-rating/analysis are weak evidence only.

Prompt accepts source excerpts and a concept checklist; returns strict JSON keyed to source spans, asks no more than one question, distinguishes uncertainty, flags jargon only when undefined, and never diagnoses. Evals: 150 paired explanations scored by educators; gap precision/recall ≥0.85, feedback usefulness ≥4/5, 0 patronizing/ability claims. The IES guide recommends deep explanatory questions ([source](https://ies.ed.gov/ncee/wwc/PracticeGuide/1)); use that rather than an unvalidated claim about a named technique.

## Controls and research questions

The learner explanation is sensitive authored content: authorize every read/write, encrypt stored bodies, exclude them from analytics, apply retention/export/delete, and never reuse them for model training without separate consent. Treat source and learner text as data, validate structured analysis, rate-limit revisions, and surface provider uncertainty.

1. **Does simple wording prove understanding?** No; it is one evidence source, not certification.
2. **Should AI rewrite the explanation?** No; preserve learner voice and provide targeted feedback.
3. **How many probing questions?** One per revision to keep the loop focused.
4. **Can jargon always indicate a gap?** No; flag only unexplained or misused terms against the rubric.
5. **Can this update mastery?** Only as weak, versioned evidence combined with retrieval outcomes.
6. **What if the rubric is incomplete?** Show uncertainty and allow the learner to end/correct.
7. **Can a viewer inspect a learner explanation?** No; private to its author unless explicit future sharing exists.
8. **What if the provider fails?** Preserve the draft/revision and retry; do not fabricate analysis.

## Jira implementation tickets

### LEARN-231 — Private teach-back session and revision API

**Objective:** persist an authorized sequence of learner explanations without exposing or overwriting prior revisions.

**Dependencies:** existing learning action and workspace RBAC.

**Files:**
- Create: `apps/api/src/models/teach_back.py`, `apps/api/src/schemas/teach_back.py`, `apps/api/src/services/teach_back_service.py`, `apps/api/src/routers/teach_back.py`, `apps/api/alembic/versions/20260921_0008_add_teach_back_sessions.py`.
- Modify: model exports, `main.py`, privacy/export/delete services.
- Test: `apps/api/tests/test_teach_back_service.py`, `apps/api/tests/test_teach_back_endpoints.py`

**Owned contract:** `TeachBackSession(user_id,node_id,audience,status,rubric_version)`; immutable encrypted `TeachBackRevision(body_ciphertext,analysis_json,self_rating,created_at)`; idempotent create/revise/finish.

1. Write tests for author-only access, node ownership, encrypted-at-rest body, revision ordering, resume, duplicate submit, deletion, and export.
2. Add tables/indexes/migration with separate body ciphertext and privacy-safe analysis summary; never store explanation in general event payloads.
3. Create a session only after workspace read access and explicit consent; snapshot authorized node/concept/rubric references.
4. Append revisions transactionally with optimistic session version and UUID idempotency; never update a previous revision.
5. Return decrypted content only to the author through authorized endpoints and redact all structured logs.
6. Append privacy-safe session/revision/completion events after commit.

**Acceptance criteria:** non-author receives safe 404; DB/log inspection reveals no plaintext; retries append once; export/delete covers every revision; concurrent revision conflict is explicit.

**Verification:** `uv run pytest apps/api/tests/test_teach_back_service.py apps/api/tests/test_teach_back_endpoints.py -q`; `uv run ruff check apps/api`; `uv run mypy apps/api/src`.

**Rollback:** disable `TEACH_BACK_V1` new writes, retain author read/export/delete, and preserve encrypted rows.

### LEARN-232 — Rubric-grounded analysis and evaluation

**Objective:** identify accurate ideas, gaps, and unclear terms against source evidence while asking one useful next question.

**Dependencies:** LEARN-231 and provider abstraction.

**Files:**
- Create: `apps/api/src/services/teach_back_analysis_service.py`, `apps/api/tests/evals/teach_back_cases.json`, `apps/api/tests/test_teach_back_evals.py`
- Modify: teach-back service and mastery event mapping.

1. Build a rubric from source-linked concept criteria with stable IDs and approved source spans.
2. Prompt with separated rubric/source/learner data and require JSON arrays for accurate, missing, unclear, uncertainty, evidence IDs, and one probe.
3. Validate all cited criterion/source IDs, bounds, tone rules, and exactly one question; fall back to “analysis unavailable” on invalid output.
4. Create educator-labelled explanations including correct, partial, jargon-heavy, misconception, off-topic, multilingual, and adversarial text.
5. Measure gap precision/recall, evidence validity, usefulness, tone violations, uncertainty calibration, latency, and cost by version.
6. Emit only bounded weak evidence to mastery after learner sees analysis; never treat model confirmation as mastery.

**Acceptance criteria:** unsupported feedback is rejected; exactly one probe is returned; uncertainty is visible; eval thresholds meet the plan; prompt injection cannot alter system/tool behavior.

**Verification:** `uv run pytest apps/api/tests/test_teach_back_evals.py -q` and persist the signed eval report.

**Rollback:** pin the last passing prompt/rubric or disable AI analysis while preserving authored revisions.

### LEARN-233 — Accessible revision loop UI

**Objective:** let the learner write, receive focused feedback, revise, and end the loop without losing work.

**Dependencies:** LEARN-231/232.

**Files:**
- Create: `apps/web/src/lib/teachBackApi.ts`, `apps/web/src/components/learning/TeachBackDrawer.tsx`, `TeachBackFeedback.tsx`, and tests.
- Modify: `LearningActions.tsx`, `ChatContainer.tsx`, `MasteryPanel.tsx`, shared types.

1. Launch from a real node action; show purpose/privacy notice and audience selector before accepting text.
2. Use `Textarea`, autosave locally only before submit, explicit Analyze action, character limit, and recoverable error state.
3. Render accurate/missing/unclear/uncertainty sections with evidence links and one probing question; avoid red/green judgment language.
4. Preserve revision history in-session, support “Revise” and “End,” and ask optional self-rating without forcing it.
5. Restore focus, announce analysis status, support keyboard-only operation, dark mode, reduced motion, and mobile layout.
6. Test cancel, provider timeout/retry, revision ordering, private access, screen reader labels, and no mastery-certification copy.

**Acceptance criteria:** draft is never silently submitted; feedback retains learner text; all sections are labelled/accessibly navigable; end/resume survive refresh; no raw button/URL/token violations.

**Verification:** `pnpm --filter @graphmind/web vitest run TeachBackDrawer TeachBackFeedback`; `pnpm --filter @graphmind/web build`.

**Rollback:** hide the action with `NEXT_PUBLIC_TEACH_BACK_V1=false`; keep author history/export accessible.

### LEARN-234 — Privacy, reliability, and outcome monitoring

**Objective:** operate the loop with strict authored-content privacy and evidence-based quality monitoring.

**Dependencies:** LEARN-231–233.

**Files:**
- Create: `docs/runbooks/teach-back.md`, `apps/api/tests/test_teach_back_privacy.py`
- Modify: retention jobs and observability configuration.

1. Verify encryption keys/rotation, log redaction, backup/export/delete, and retention expiration in staging.
2. Instrument start/revision/completion, opt-out, analysis failure, uncertainty, usefulness rating, latency, and cost—never bodies.
3. Add alerts for decrypt failure, plaintext leakage canary, provider error, tone-policy failure, and deletion backlog.
4. Review sampled synthetic/consented outputs for usefulness and bias; separate product analytics from content QA consent.
5. Roll out internal → 5% → 25% → 100% after privacy, eval, accessibility, and support gates.
6. Drill kill switch and deletion/recovery runbooks.

**Acceptance criteria:** no plaintext in logs/events/metrics; deletion SLA is tested; alerts fire in staging; rollout has explicit gates; disabling analysis preserves learner data access.

**Verification:** `uv run pytest apps/api/tests/test_teach_back_privacy.py -q` plus service/eval/UI suites.

**Rollback:** disable analysis/new sessions, retain private revisions for user control, and rotate/revoke keys if compromise is suspected.

## Definition of Done

Teach-back is private, revision-preserving, rubric-grounded, uncertainty-aware, non-shaming, accessible, weak-evidence-only, and covered by encryption, eval, deletion, API, UI, and operational tests.

## Sources

- [Chi et al. — Self-Explanations](https://doi.org/10.1207/s15516709cog1302_1)
- [IES Organizing Instruction and Study to Improve Student Learning](https://ies.ed.gov/ncee/wwc/PracticeGuide/1)
- [NIST AI Risk Management Framework — Generative AI Profile](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf)
- [U.S. Department of Education privacy and education technology guidance](https://studentprivacy.ed.gov/privacy-and-education-technology)
