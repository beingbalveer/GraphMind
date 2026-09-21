# Code Challenge Node Type Implementation Plan

> Agentic-worker sub-skill note: implement one checked workstream at a time. - [ ] data/API - [ ] isolated runner - [ ] UI/review - [ ] evals/ops

**Goal:** attach safe, runnable technical practice to the knowledge graph with deterministic feedback.  
**Architecture:** typed challenge/attempt records → networkless runner job → deterministic result + formative AI review.  
**Tech Stack:** FastAPI/SQLAlchemy/Alembic/Postgres, provider abstraction, Next.js/TypeScript.  
**Spec:** `docs/FEATURE_RESEARCH.md §5.1`.

## Global Constraints

Follow `AGENTS.md` and URL contract; use `packages/ai-core` for generation only, Alembic for all persistence and `require_workspace_*` RBAC. Use semantic UI primitives/tokens/dark mode/accessible controls. No API-process execution, no raw `<button>`, no unvalidated code/run action, and no cross-workspace attempt exposure.

## Status, objective, and exclusions

**Status: not built.** Existing `NodeModel.role` is free-form message role; its metadata supports node typing (roadmap nodes already use it), `LearningActions` can launch prompts, and `CodeViewerModal` only displays code. There is no executable sandbox, submission model, challenge visual, or review endpoint. Goal: a technical-topic branch can contain an authorable, assessable `challenge` node with a problem, constraints, starter code, safe test results, and AI coaching. Do not execute untrusted code in the FastAPI process, promise security certification, or score hidden proprietary tests through an LLM.

## Learner flow

From a technical assistant node choose **Create code challenge**. Preview/edit topic, language, difficulty and time budget; generated challenge is reviewed then persisted. The amber-but-tokenized ChallengeCard has problem, constraints, editor, Run tests, Submit for review and “open source” link. Run sends code to an isolated runner; submit yields deterministic test outcome first, then an AI review that separates correctness, style, reasoning, and next hint. Every attempt is a child/related artifact, but only accepted final solution may be summarized into a graph node. Keyboard editor remains accessible with textual instructions and copy/download fallback; never encode pass/fail by color alone.

## Architecture, data, APIs, exact files

Create `apps/api/src/models/challenge.py` with `CodeChallengeModel(id,workspace_id,source_node_id,language,statement,starter_code,public_tests,hidden_tests_encrypted,reference_solution_encrypted,rubric_json,status,created_at)` and `ChallengeAttemptModel(id,challenge_id,user_id,sequence,code,runner_status,test_result_json,ai_review_json,created_at)`. Add relationships in `apps/api/src/models/workspace.py` and imports in `apps/api/src/models/__init__.py`; create `apps/api/alembic/versions/20260921_0018_add_code_challenges.py`, `apps/api/src/schemas/challenge.py`, `apps/api/src/services/challenge_service.py`, `apps/api/src/services/challenge_generation_service.py`, `apps/api/src/services/challenge_runner.py`, `apps/api/src/routers/challenges.py`; register the router in `apps/api/src/main.py`.

Add `apps/web/src/lib/challengeApi.ts`, `apps/web/src/components/challenges/ChallengeNode.tsx`, `apps/web/src/components/challenges/ChallengeWorkspace.tsx`, `apps/web/src/components/challenges/ChallengeReview.tsx`, and `apps/web/src/components/challenges/__tests__/challenge-workspace.test.tsx`; modify `apps/web/src/components/canvas/ThreadGraphNode.tsx`, `apps/web/src/components/chat/FocusDrawer.tsx`, `apps/web/src/components/canvas/GraphCanvas.tsx`, and `apps/web/src/components/chat/LearningActions.tsx`. APIs: `POST /workspaces/{wid}/nodes/{nid}/challenges` (202 generated draft), `POST /challenges/{id}/publish`, `POST /challenges/{id}/attempts {code, idempotencyKey}`, `GET /challenges/{id}`, `GET /attempts/{id}`. Emit `challenge_created`, `challenge_attempted`, `challenge_evaluated` learning events and `challenge_status` SSE after commit.

Runner contract: service sends immutable `{language, code, publicTests, resourceLimits}` to a separate, networkless ephemeral job runtime; job receives no DB/auth secrets, read-only root, non-root UID, CPU/memory/wall limits, output cap and per-user queue quota. Results are signed/correlated. Make generation structured JSON: “Create one solvable challenge, starter, public assertions, rubric and non-sensitive reference; return JSON only; do not claim code ran.” Validate language allowlist/schema and test syntax before publishing. Evals: fixture tasks verify schema/compilation; red-team fork bomb/network/file escape; human rubric agreement ≥0.8; model review must cite test output and never say a failed solution passed.

## Privacy, edge cases, reliability, and decisions

Write RBAC per challenge/attempt; students may see public tests but not hidden tests/reference. Encrypt stored solutions if retention requires it, permit delete/export, scrub code from logs, redact stack paths, and rate-limit expensive runs. OWASP identifies unrestricted resource consumption and object-level authorization as API risks ([OWASP](https://api-security.owasp.org/editions/2023/en/0x00-header/)). Handle compile timeout, queue full, unsupported language, cancelled job, lost callback (poll durable attempt), duplicate submit, malicious output, model unavailable (deterministic result only), and deleted source node (retain challenge provenance or archive). SLO queue+run p95 <20s for small tests; monitor queue age, sandbox violations, timeout, pass rate, review disagreement, cost. Roll out one language/worker pool behind flag; migrate drafts only after runner hardening.

Decision: external isolated runner, not `eval`/Docker spawned by API. Challenge as a typed node plus relational record, not markdown-only metadata, because attempts/tests require queryable history. AI review is formative; deterministic tests are the correctness authority. Practice with feedback is aligned with retrieval/active learning evidence ([Karpicke & Blunt](https://pubmed.ncbi.nlm.nih.gov/21252317/)).

## Research questions answered

1. **May API execute code directly?** No; resource isolation is required to contain untrusted code.
2. **Can AI be the sole grader?** No; use deterministic tests/rubric first.
3. **Why hide tests?** Prevent overfitting while exposing enough diagnostic public tests.
4. **Is code input safe to log?** No; secrets may be pasted, so redact/minimize logs.
5. **What handles retry?** Idempotency key bound to user/challenge/code hash.
6. **Can challenges auto-run on generation?** No; validate generated test syntax offline, run only user action.
7. **How control cost?** quotas, concurrency, output/resource caps; OWASP flags unrestricted consumption.
8. **Does practice help learning?** Retrieval/practice improves meaningful learning ([study](https://pubmed.ncbi.nlm.nih.gov/21252317/)).

## Jira tickets, tests, DoD

1. **CHAL-101 Data/API (depends migration):** models, schemas, RBAC router, event writes. AC: tenant cannot read attempts, publish validates language/tests, idempotent attempt is single row. `uv run pytest apps/api/tests/test_challenge_endpoints.py apps/api/tests/test_challenge_service.py`.
2. **CHAL-102 Runner (depends CHAL-101):** isolated job adapter, signed callback, limits. AC: network/filesystem escape and timeout fixtures fail safely; no API secret reaches job. `uv run pytest apps/api/tests/test_challenge_runner.py`.
3. **CHAL-103 UI/review (depends 101):** typed card/editor/results, accessible fallback. AC: source/attempt link works, failed run has actionable text. `pnpm --filter @graphmind/web vitest run src/components/challenges/__tests__/challenge-workspace.test.tsx`.
4. **CHAL-104 AI/evals/ops (depends 102/103):** evaluator fixtures/flag/metrics. AC: output schema and sandbox dashboards pass. Run `uv run ruff check apps/api/src apps/api/tests && uv run mypy apps/api/src && pnpm --filter @graphmind/web build`.

DoD: security review approves runner threat model, tests/telemetry/retention policy pass, no dead Run button, failure/cancel UI works, and kill switch stops new jobs.

## Sources

[OWASP API Security](https://api-security.owasp.org/editions/2023/en/0x00-header/) · [NIST GAI Profile](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf) · [Retrieval practice](https://pubmed.ncbi.nlm.nih.gov/21252317/) · [MDN keyboard](https://developer.mozilla.org/en-US/docs/Web/Accessibility/Guides/Understanding_WCAG/Keyboard)

## Edge-case matrix and rollout/backfill

| Condition | Behaviour | Test |
|---|---|---|
| runner timeout/output flood | terminate job, redact/truncate result | `test_runner_enforces_limits` |
| sandbox callback replay | signature/idempotency accepts once | `test_signed_callback_is_idempotent` |
| hidden test requested | never serialize test/reference | `test_hidden_test_is_not_exposed` |
| source deleted | archive challenge provenance, no new attempt | `test_deleted_source_archives_challenge` |
| unsupported language | 422 before job enqueue | `test_language_allowlist` |

No attempt backfill. Add schema disabled, deploy runner with canary language/Python only, run security escape suite, employee/1/10/50/100% after sandbox/queue/cost guardrails. `code_challenges_enabled=false` stops generation/submission but lets existing attempts/results read; do not rollback rows.

## Expanded Jira execution cards

### CHAL-101 — challenge/attempt persistence and API

**Objective:** persist typed challenges and RBAC-protected attempts. **Dependencies:** workspace nodes/auth. **Create:** `apps/api/src/models/challenge.py`, `apps/api/src/schemas/challenge.py`, `apps/api/src/services/challenge_service.py`, `apps/api/src/routers/challenges.py`, `apps/api/alembic/versions/20260921_0018_add_code_challenges.py`, `apps/api/tests/test_challenge_service.py`, `apps/api/tests/test_challenge_endpoints.py`. **Modify:** `apps/api/src/models/workspace.py`, `apps/api/src/models/__init__.py`, `apps/api/src/main.py`.

1. Define challenge/attempt columns listed above, FK cascades/indexes and unique `(challenge_id,user_id,sequence)`.
2. Write migration/downgrade; encrypt reference/hidden test fields with key reference, not plaintext logs.
3. Add schemas for create/publish/attempt/status with language enum, code/output caps and idempotency key.
4. Check source node/workspace write/read authorization and challenge state transition draft→published.
5. Persist attempt pending before runner enqueue and return 202; reject hidden fields from all learner responses.
6. Test member/foreign IDs, validation, publish, idempotency and source deletion.

**Acceptance criteria:** (a) no hidden test/reference JSON leaves API; (b) attempt belongs to actor; (c) unsupported language rejected; (d) duplicate key creates one attempt; (e) migration reverses. **Commands:** `uv run pytest apps/api/tests/test_challenge_service.py apps/api/tests/test_challenge_endpoints.py`; `uv run ruff check apps/api/src apps/api/tests`; `uv run mypy apps/api/src`. **Rollback:** feature flag blocks writes/read preserved.

### CHAL-102 — isolated runner adapter

**Objective:** execute user code outside the API trust boundary. **Dependencies:** CHAL-101, approved runner infrastructure. **Create:** `apps/api/src/services/challenge_runner.py`, `apps/api/src/workers/challenge_worker.py`, `apps/api/tests/test_challenge_runner.py`. **Modify:** `apps/api/src/services/challenge_service.py`, `apps/api/src/config.py`.

1. Define signed `RunnerJob(language,code,tests,cpu_ms,memory_mb,output_bytes)` and result schema; 2. dispatch to non-root, networkless, read-only ephemeral runtime; 3. enforce wall/CPU/memory/file/output limits; 4. verify callback signature/correlation; 5. store sanitized deterministic result; 6. retry only transient queue errors.

**Acceptance criteria:** (a) no DB/auth secret in job env; (b) network/file escape fixture fails; (c) time/output limits work; (d) replay callback is single update. **Commands:** `uv run pytest apps/api/tests/test_challenge_runner.py`; security fixture suite. **Rollback:** pause worker/flag; pending attempts become cancelled with retry explanation.

### CHAL-103/104 — accessible UI, AI review and operations

**Objective:** expose real run/submit feedback and evaluate formative review. **Dependencies:** CHAL-101/102. **Create:** `apps/web/src/lib/challengeApi.ts`, `apps/web/src/components/challenges/ChallengeWorkspace.tsx`, `apps/web/src/components/challenges/ChallengeReview.tsx`, `apps/web/src/components/challenges/__tests__/challenge-workspace.test.tsx`, `apps/api/tests/test_challenge_evals.py`. **Modify:** `apps/web/src/components/canvas/ThreadGraphNode.tsx`, `apps/web/src/components/chat/FocusDrawer.tsx`, `apps/web/src/components/canvas/GraphCanvas.tsx`, `apps/web/src/components/chat/LearningActions.tsx`.

1. Render typed challenge/editor/results with native fallback; 2. call attempt API and poll/SSE status; 3. display deterministic result before AI feedback; 4. constrain review JSON to test-result-grounded claims; 5. test keyboard/error/cancel; 6. add queue/timeout/pass/cost dashboard.

**Acceptance criteria:** (a) Run always performs real API action; (b) failed test cannot be called pass by AI; (c) no color-only result; (d) model outage still shows runner result. **Commands:** `pnpm --filter @graphmind/web vitest run src/components/challenges/__tests__/challenge-workspace.test.tsx`; `uv run pytest apps/api/tests/test_challenge_evals.py`; web build. **Rollback:** hide create/run, leave historic feedback.
