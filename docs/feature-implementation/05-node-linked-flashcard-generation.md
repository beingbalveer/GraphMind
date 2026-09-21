# Node-Linked Flashcard Generation Implementation Plan
## Plan protocol

- [ ] Read this plan, `AGENTS.md`, `docs/URL_DESIGN.md`, and the cited feature research before coding.
- [ ] Use the agentic-worker sub-skill protocol: one ticket at a time; inspect changed files; run its exact verification; report evidence before starting the next ticket.
- [ ] Record a reviewer checkpoint after each ticket and do not silently widen scope.

**Goal:** Deliver the feature’s learning outcome with explainable, private, production-grade behaviour.

**Architecture:** FastAPI service/router/schema/model layers; provider-agnostic AI through `packages/ai-core`; typed shared contracts; Next.js App Router surface; PostgreSQL persistence and asynchronous projections where specified.

**Tech Stack:** Python 3.12/FastAPI/async SQLAlchemy/Alembic/Pydantic v2/pytest/ruff/mypy; Next.js 15/TypeScript strict/Tailwind/shadcn primitives/vitest; PostgreSQL/Redis.

**Spec:** `docs/FEATURE_RESEARCH.md §2.1`.

**Global Constraints:** Obey `AGENTS.md`: obtain approval before implementation, one roadmap task at a time, and no dead UI. Read `docs/URL_DESIGN.md` before route work; use `@/lib/urls` and Next router, never browser history or primary-ID query parameters. Keep LLMs behind provider abstractions in `packages/ai-core`; make schema changes through reversible Alembic migrations; enforce workspace RBAC on every read/write. Use only `@/components/ui` primitives and semantic tokens, support dark mode, and meet WCAG keyboard, focus, contrast, status-message and non-colour requirements.


# 2.1 Node-Linked Flashcard Generation — Existing Implementation and Gaps
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


## What is implemented

This feature is **shipped**: `FlashcardModel` (`workspace_id`, `source_node_id`, Q/A, position, timestamps) cascades with workspace/node; Alembic `20260911_0001_add_flashcards.py` creates the table/indexes. `FlashcardService` validates an assistant response, prompts a provider-agnostic model for 1–10 strict JSON cards, de-duplicates questions, and supports list/generate/update/delete through `routers/flashcards.py`. `flashcardApi.ts`, `FlashcardModal.tsx`, `FlashcardItem.tsx`, chat actions and side-peek integration let editors generate, view, flip, edit, delete, regenerate; viewers can view but not generate. Tests cover schemas, model, service, endpoints, API and modal/item UI.

It fulfils source linkage but **not review scheduling, review outcomes, source revisions, generation provenance, quality evaluation, bulk source selection, or a source deep-link in review mode**. Feature 2.2 owns scheduling; this document limits 2.1 to reliable authoring and traceability.

## Learning/UX rationale

Retrieval practice has stronger long-term retention effects than restudy and feedback improves it ([Roediger & Butler](https://pubmed.ncbi.nlm.nih.gov/20951630/)); cards must therefore ask one answerable, self-contained question rather than paraphrase a response. Flow: node action → choose count/language → preview drafts with edit/delete → save → source badge/card count → review link opens canvas/chat using `buildNodeUrl`. Never auto-generate merely on viewing a node; current modal auto-generates when empty, so change to an explicit Generate action with clear cost/loading state. No cards from user messages by default; allow selected learner-authored notes only after explicit consent.

## Required design

Add `FlashcardGenerationModel(card_id, source_content_hash, prompt_version, provider, model, generated_at, safety_flags)` and `FlashcardSourceRevisionModel`; retain content hash, not duplicate source text. Extend `FlashcardResponse`/shared `Flashcard` with `sourceNodeId`, `sourceChanged`, provenance. Add `POST .../flashcards/preview`, `POST .../commit`, and `GET /flashcards/{id}/source`, maintaining existing generate endpoint during migration. Create `schemas/flashcard_generation.py`, migration and tests; modify `models/flashcard.py`, `flashcard_service.py`, `routers/flashcards.py`, `flashcardApi.ts`, `FlashcardModal.tsx`, `FlashcardItem.tsx`, `ChatMessage.tsx`, `FocusDrawer.tsx`, and `urls.ts` consumer surfaces.

Prompt: “Use only source facts; one atomic recall target/card; include answer rubric; decline unsafe/high-stakes instructions; return JSON.” Validate Pydantic schema, length, duplicate semantic similarity and source-entailment verifier. Eval 300 source slices: schema 100%, answer supported ≥98%, duplicate rate <2%, human atomicity ≥90%; route failures to review, not persistence. Version prompt/model.

## Safety, reliability, and questions

Authorize both workspace and source node; cap source to current `MAX_SOURCE_CHARS`, card count and requests; treat source content as data to resist prompt injection; never send cards to analytics. Use `aria-live="polite"` for generation state, keyboard flip/edit/delete and non-colour errors ([WCAG status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages)). Provider timeout/retry must never duplicate cards: idempotency key + unique request record. Metrics: preview→commit, edit rate, source-change rate, supported-card eval and p95 generation.

1. **Why link source?** Context and correction. 2. **Why explicit generate?** Avoid surprise cost/data sharing. 3. **Can cards become stale?** Yes, compare hash. 4. **Can AI cite outside facts?** No. 5. **What is a good card?** One recoverable fact/relationship. 6. **Can viewers edit?** No. 7. **Can cards duplicate?** Block lexical/semantic duplicates. 8. **Do flips prove recall?** No; 2.2 records rating. 9. **Can user text be source?** Opt-in only. 10. **What if generation fails?** Preserve source/form and retry safely.

## Jira implementation tickets

### LEARN-201 — Flashcard provenance and source-revision schema

**Objective:** extend the shipped flashcard model with auditable generation provenance and source-change detection without losing existing cards.

**Dependencies:** existing flashcard migration/model/service/endpoints.

**Files:**
- Create: `apps/api/src/models/flashcard_generation.py`, `apps/api/src/schemas/flashcard_generation.py`, `apps/api/alembic/versions/20260921_0005_add_flashcard_provenance.py`
- Modify: `apps/api/src/models/flashcard.py`, `apps/api/src/models/workspace.py`, `apps/api/src/schemas/flashcard.py`
- Test: `apps/api/tests/test_flashcard_provenance.py`, `apps/api/tests/test_flashcard_model.py`

**Owned contract:** `FlashcardGeneration(id,source_node_id,source_content_hash,prompt_version,provider,model,status,safety_flags,created_at)`; cards reference `generation_id`; API adds `sourceChanged` and provenance summary.

1. Write migration tests against databases containing existing cards; generate one legacy provenance row per source node without copying source text.
2. Add generation/source-revision relationships, indexes, and cascade behavior; hashes use normalized source content and a versioned algorithm.
3. Extend response schemas while keeping old fields compatible; never expose provider secrets or internal prompts.
4. Compute `sourceChanged` by comparing current hash with the committed generation hash, not by timestamp.
5. Add service helpers to fetch authorized source provenance and mark a generation superseded after explicit regeneration.
6. Verify workspace/node deletion cascades and export/delete includes provenance.

**Acceptance criteria:** existing cards survive upgrade; unchanged content is not falsely stale; changed source is visible; provenance never duplicates source body; migration downgrade behavior is documented/tested.

**Verification:** `uv run pytest apps/api/tests/test_flashcard_provenance.py apps/api/tests/test_flashcard_model.py -q`; `uv run ruff check apps/api`; `uv run mypy apps/api/src`.

**Rollback:** disable provenance reads with `FLASHCARD_PROVENANCE_V1=false`; keep additive columns/tables and existing card operations.

### LEARN-202 — Preview, grounding validation, and commit API

**Objective:** generate editable drafts, validate that every answer is supported by the source, and persist only an explicit learner-approved set.

**Dependencies:** LEARN-201 and provider abstraction in `packages/ai-core`.

**Files:**
- Create: `apps/api/src/services/flashcard_quality_service.py`, `apps/api/tests/test_flashcard_preview.py`, `apps/api/tests/evals/flashcard_generation_cases.json`
- Modify: `apps/api/src/services/flashcard_service.py`, `apps/api/src/routers/flashcards.py`, `apps/api/src/schemas/flashcard.py`

1. Add `POST .../flashcards/preview` returning bounded draft IDs, atomic question/answer/rubric fields, warnings, and expiry without database card creation.
2. Prompt the provider with source text in a clearly delimited data block; require strict JSON and reject unknown fields, outside facts, duplicate questions, and unsafe/high-stakes instructions.
3. Implement deterministic lexical bounds plus a versioned grounding evaluator; route uncertain drafts to warnings rather than silently committing.
4. Add idempotent `POST .../flashcards/commit` accepting edited draft IDs and creating cards plus one generation record transactionally.
5. Preserve current list/update/delete endpoints; keep the old generate endpoint as a temporary adapter that calls preview+commit only for compatible clients.
6. Add timeout, malformed JSON, prompt injection, duplicate, unsupported answer, source mutation between preview/commit, and double-commit tests.

**Acceptance criteria:** preview writes no cards; commit creates exactly the selected edited cards once; source mutation yields 409/re-preview; every persisted AI card passes schema/grounding checks; provider failure preserves existing cards.

**Verification:** `uv run pytest apps/api/tests/test_flashcard_preview.py apps/api/tests/test_flashcard_generation.py -q` and the eval threshold report.

**Rollback:** disable preview/commit v2 and route UI to existing explicit generation endpoint; never delete cards committed under v2.

### LEARN-203 — Explicit generation, edit, and source navigation UI

**Objective:** replace empty-modal auto-generation with a consent-first preview/edit/commit flow linked back to its source.

**Dependencies:** LEARN-201 and LEARN-202.

**Files:**
- Create: `apps/web/src/components/flashcards/FlashcardDraftReview.tsx` and tests.
- Modify: `apps/web/src/components/flashcards/FlashcardModal.tsx`, `FlashcardItem.tsx`, `apps/web/src/lib/flashcardApi.ts`, `apps/web/src/components/chat/ChatMessage.tsx`, `packages/shared/src/index.ts`

1. Split modal states into list, consent, generating, draft review, committing, and error; opening an empty modal performs no provider call.
2. Show exact source node preview, requested count/language, cost/data notice, and an explicit Generate action.
3. Render drafts with editable question/answer, delete control, grounding warning, and keyboard reorder using UI primitives.
4. Commit once with UUID idempotency key; keep edits after recoverable failure and refetch cards after success.
5. Show source-changed status and “Go to source” using `buildNodeUrl`; viewers may inspect but cannot generate/edit/delete.
6. Test focus management, answer reveal, cancel-without-write, retry, double-click, stale source conflict, mobile/dark mode, and screen-reader status.

**Acceptance criteria:** no surprise generation; all draft edits are reviewed before persistence; permissions match backend; source navigation is canonical; loading/error/success states are accessible.

**Verification:** `pnpm --filter @graphmind/web vitest run src/components/flashcards/__tests__/flashcard-modal.test.tsx src/components/flashcards/__tests__/flashcard-draft-review.test.tsx`; `pnpm --filter @graphmind/web build`.

**Rollback:** `NEXT_PUBLIC_FLASHCARD_DRAFTS_V2=false` restores the current modal while backend v2 records remain readable.

### LEARN-204 — Quality evaluation and operations

**Objective:** maintain card quality, latency, cost, and failure safety after rollout.

**Dependencies:** LEARN-202 and LEARN-203.

**Files:**
- Create: `apps/api/tests/test_flashcard_quality_evals.py`, `docs/runbooks/flashcard-generation.md`
- Modify: flashcard metrics/configuration and scheduled evaluation job.

1. Curate 300 consent-free source slices with supported atomic cards, duplicates, adversarial instructions, and unanswerable content.
2. Measure JSON validity, source support, atomicity, duplicate rate, edit rate, discard rate, latency, and cost by prompt/model version.
3. Add dashboards/alerts for provider errors, commit conflicts, grounding failures, generation p95, and abnormal regeneration/deletion.
4. Sample only redacted/consented evaluation artifacts; never send learner card text to product analytics.
5. Stage internal → 5% → 25% → 100% and block promotion when grounding or accessibility gates fail.
6. Test kill switch, provider fallback, and regeneration rollback without deleting learner edits.

**Acceptance criteria:** schema validity 100%; supported-answer target and duplicate threshold meet the plan; alerts and prompt version are queryable; rollback preserves all committed/edited cards.

**Verification:** `uv run pytest apps/api/tests/test_flashcard_quality_evals.py -q` plus all existing flashcard backend/frontend suites.

**Rollback:** disable new AI generation, retain list/edit/review access, pin the last passing prompt/model version, and reprocess only explicitly requested drafts.

## Definition of Done

The shipped flashcard feature gains source provenance, explicit consent, preview/edit/commit, source-change detection, grounding evaluation, idempotency, accessible UI, and operational gates while retaining existing cards and permissions.

## Sources

- [Roediger and Butler — retrieval practice and feedback review](https://pubmed.ncbi.nlm.nih.gov/20951630/)
- [OWASP LLM Prompt Injection Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html)
- [NIST AI Risk Management Framework — Generative AI Profile](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf)
- [WCAG 2.2 status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages)
