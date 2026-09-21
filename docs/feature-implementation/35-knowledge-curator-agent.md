# Knowledge Curator Agent Implementation Plan

**Spec:** `docs/FEATURE_RESEARCH.md §9.2`  
**Agentic-worker sub-skill checklist:** `[ ]` read plan/AGENTS.md; `[ ]` inspect curator baseline; `[ ]` implement tickets in sequence; `[ ]` run evidence/injection evals; `[ ]` verify UI/audit; `[ ]` request review.  
**Goal:** opt-in, evidence-backed curator reports whose changes always require learner approval.  
**Architecture:** snapshot-based queued runs and immutable findings/feedback, with validated command execution.  
**Tech stack:** FastAPI/SQLAlchemy/Alembic/PostgreSQL/Redis, ai-core, Next.js/TypeScript.  
**Global constraints:** AGENTS.md governs approval/verification; preserve URL_DESIGN and helper URLs; provider boundary is ai-core; Alembic for persistence; RBAC; semantic primitives/tokens/dark mode; WCAG support; no dead UI.

**Status:** partial. `curator_service.py` exposes a hand-curated ontology, gap analysis, next topics and timeline; `routers/curator.py` and `MasteryPanel.tsx` surface it. The requested periodic agent, isolated-node detection, candidate links, weekly report, approval workflow, schedules, provenance and quality controls do not exist.

## Goal/non-goals and flow

Turn the existing curator from a request-time recommender into an opt-in, explainable assistant. Weekly or user-triggered run: analyze an authorized workspace snapshot → create a **draft report** of isolated concepts, likely links, stale/shallow areas and recommended next actions → learner reviews evidence and accepts/rejects individual proposals. Accepted graph connections/roadmap changes are performed through existing authorised services and recorded with curator provenance. No autonomous destructive edits, hidden LLM graph changes, cross-workspace analysis, unsolicited email, or claiming semantic similarity is fact.

## Architecture/contracts/prompts

`CuratorRun(id,workspace_id,requested_by,status,input_snapshot_hash,skill_version,model,prompt_version,started_at,finished_at,error_code)`, `CuratorFinding(id,run_id,kind,severity,subject_refs JSONB,evidence JSONB,recommendation,confidence,status)`, and `CuratorFeedback(finding_id,user_id,decision,reason)` form an auditable proposal queue. Snapshot builder uses existing concepts/edges/lineage/mastery and excludes raw unrelated message text. Deterministic candidates (no inbound/outbound edges, low evidence, unsatisfied curator prerequisites) precede semantic candidates. Provider sees only candidate IDs/labels/evidence and returns schema-valid findings; it cannot issue graph tools or mutate DB. Prompt: “cite supplied evidence IDs; make no claims beyond them; recommend no action when evidence is insufficient; return JSON.”

`POST /workspaces/{id}/curator/runs`, `GET /.../curator/reports/latest`, `GET /.../curator/runs/{run}`, `POST /.../findings/{id}/decision`; worker executes, server validates subject references, and acceptance dispatches an idempotent command. Weekly scheduling remains off until notification consent exists. UI creates `CuratorReportCard` and `CuratorFindingList` in the existing `MasteryPanel`; status is readable without colour and decisions are reversible where possible.

## Exact files and quality

Modify `apps/api/src/services/curator_service.py`, `schemas/curator.py`, `routers/curator.py`, `models/workspace.py` only for relationships, `main.py`, `components/chat/MasteryPanel.tsx`, `lib/workspaceApi.ts`, and shared types. Create migration `apps/api/alembic/versions/20260921_0035_add_curator_runs.py`, `models/curator_run.py`, `services/curator_agent_service.py`, `services/curator_projection_service.py`, queue worker integration, tests, `lib/curatorApi.ts`, `components/curator/*` and Vitest tests.

Eval set: labelled synthetic graphs for true missing prerequisite, false semantic neighbour, duplicate concept, stale-but-mastered, sensitive topic, contradictory source, and provider malformed JSON. Gate on precision of accepted links, false-positive rate, unsupported-evidence rate, schema-valid rate and user override rate. Protect against prompt injection embedded in node content by treating it as data, delimit/quote it, prohibit tool calls, validate output, limit size, and use provider data controls. Use `require_workspace_read` for generation and write authority plus user confirmation for accepted mutations. Store no raw report/node content in telemetry; implement retention/deletion and rate limits.

## Reliability/rollout/tickets/DoD

Use jobs/outbox, dedupe `(workspace,snapshot_hash,skill_version)`, cap one active run, preserve last successful report on failure, retry transient provider faults, and expose source/evidence. Monitor queue lag, success, cost/tokens, confidence distribution, accept/reject, evidence validation failures, and unsafe-output blocks. Roll out on-demand staff → on-demand users → opt-in weekly digest; no automatic mutation ever.

1. **DATA-921** run/finding/feedback models/migration; accept cascade/retention and workspace isolation.
2. **AI-921** candidate builder/prompt/parser/evals; accept cited-evidence validation and malformed/injection fixtures.
3. **API-921** job/report/decision endpoints; accept idempotency, approval requirement and failed-run recovery.
4. **WEB-921** report evidence/decision UI; accept keyboard, focus, rationale and no-colour-only severity.
5. **QA-921** `uv run pytest apps/api/tests/test_curator_agent*.py`, `uv run ruff check apps/api`, `uv run mypy apps/api/src`, `pnpm --filter @graphmind/web test`, `pnpm --filter @graphmind/web build`.

Definition of Done: every recommendation identifies its evidence, no agent directly edits user knowledge, eval/audit/retention gates pass, and users can safely reject/undo accepted actions.

## Research questions answered

1. **Should a curator directly add links?** No; draft/approval prevents semantic false positives changing knowledge truth.
2. **How detect isolation?** Deterministic graph degree plus evidence, not an LLM hunch alone.
3. **Can raw nodes prompt the agent?** Treat them as untrusted data with no instruction authority.
4. **Why snapshot hash?** Reproducibility/deduplication and clear staleness.
5. **Can weekly reports email users?** Only after explicit notification consent; start in-app.
6. **What validates an AI finding?** IDs/evidence must resolve to its authorized snapshot.
7. **What if the agent fails?** Preserve previous report and surface retry; do not erase progress.
8. **What quality metric matters?** Accepted evidence-supported recommendations, not volume.

Sources: [OpenAI evals](https://platform.openai.com/docs/guides/evals), [OpenAI structured outputs](https://platform.openai.com/docs/guides/structured-outputs), [OWASP LLM Prompt Injection Prevention](https://genai.owasp.org/llmrisk/llm01-prompt-injection/), [GraphMind curator architecture](../ARCHITECTURE.md).

## Detailed ticket execution

### DATA-921 — auditable run/finding persistence

**Objective:** record reproducible curator drafts, never autonomous edits. **Create:** migration/models/schemas/tests. **Modify:** model exports/main. **Dependencies:** curator baseline, job runner. **Flag/rollback:** `curator_agent_v1`; off leaves previous report intact.

1. Add `curator_runs`, `curator_findings`, feedback tables with workspace/snapshot/skill/prompt/model versions, states, timestamps and evidence JSON.
2. Index one active run per workspace/snapshot/skill and use FK cascade/retention dates.
3. Validate finding kind/severity/subject IDs/evidence shape with Pydantic; prohibit raw private node dumps.
4. Add feedback decision/reason limit and audit actor/time.
5. Test migration, cross-workspace isolation, snapshot dedupe, retention/delete and status transitions.

Acceptance: (1) run references immutable snapshot hash; (2) findings cannot point cross-workspace; (3) no model output directly creates graph relation; (4) feedback is attributable; (5) old report survives failed new run. Run `uv run pytest apps/api/tests/test_curator_agent_models.py`.

### AI-921/API-921 — candidate evidence and approved commands

**Objective:** produce grounded recommendations and execute only learner-approved effects. **Create:** agent/projection/router/eval/API tests. **Modify:** curator service/router/main. **Dependencies:** DATA-921, ai-core. **Rollback:** disable run/decision endpoints and queue consumers.

1. Build deterministic isolation/prerequisite/shallow candidates from authorized snapshot before provider invocation.
2. Delimit untrusted node text, forbid tools/mutation, require strict JSON with supplied evidence IDs and “insufficient evidence” option.
3. Validate output ID/evidence membership, discard invalid items and log no raw content.
4. Queue idempotent run, preserve last report on transient failure, and make decision endpoint issue explicit command only after write auth.
5. Evaluate labelled true/false gaps, injection, malformed JSON, duplicate/contradictory concepts and sensitive topics.

Acceptance: (1) every finding evidence resolves; (2) unsupported output is not displayed; (3) repeat run does not duplicate; (4) rejection mutates nothing; (5) accepted command has audit/provenance. Run `uv run pytest apps/api/tests/test_curator_agent*.py`, `uv run ruff check apps/api`, `uv run mypy apps/api/src`.

### WEB-921/QA-921 — explainable report/release

**Objective:** make report review accessible and optional. **Create:** curator components/API/Vitest/manual runbook. **Modify:** `MasteryPanel.tsx`, workspace API/types. **Dependencies:** API-921. **Rollback:** hide report entry by flag.

1. Add report status/last-generated/evidence/rationale/uncertainty and accept/reject controls with shared primitives.
2. Require confirmation when an accepted finding will create a link/node; offer undo only where command supports it.
3. Implement empty/failed/stale/retry states, keyboard focus return and no-colour severity labels.
4. Add telemetry dashboards/cost/queue/error/acceptance review threshold and on-demand rollout checks.
5. Test keyboard/reader/dark/reduced motion and evidence link integrity.

Acceptance: (1) evidence readable before action; (2) no automatic graph edits; (3) errors preserve previous report; (4) all controls functional keyboard-only; (5) flag safely disables new runs. Run `pnpm --filter @graphmind/web test`, `pnpm --filter @graphmind/web build`.

| Edge case | Handling | Test |
|---|---|---|
| same snapshot requested | return/dedupe run | `test_run_dedupe` |
| injected node text | treated data, schema output rejected | `test_injection` |
| provider timeout | failed status/last report preserved | `test_timeout_preserves_report` |
| subject deleted | finding marked stale, no action | `test_deleted_subject` |
| conflicting decisions | optimistic finding version/first terminal decision | `test_decision_race` |
| high cost | cap/token budget and fail closed | `test_budget_cap` |

Rollout on-demand internal → on-demand opt-in → optional weekly after consent. No backfill. Rollback disables job creation/consumer, retains audit/results subject to retention policy.
