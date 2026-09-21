# Analogy Builder Implementation Plan

> Agentic-worker sub-skill note: maintain ticket checkboxes. - [ ] artifact/API - [ ] chooser UI - [ ] eval/report/ops

**Goal:** provide optional learner-selected analogies with explicit limits and feedback.  
**Architecture:** source node evidence + opt-in domain → structured provider output → vote/materialize artifact.  
**Tech Stack:** FastAPI, SQLAlchemy/Alembic/Postgres, `packages/ai-core`, Next.js/TypeScript.  
**Spec:** `docs/FEATURE_RESEARCH.md §5.2`.

## Global Constraints

Comply with `AGENTS.md`, `URL_DESIGN.md`, provider abstraction, Alembic, RBAC, semantic shared primitives/tokens, dark mode and accessible focus. Do not infer personal background or send raw private profile/annotation data to a provider; no route strings/history API in UI.

## Status and goal

**Status: not built.** `LearningActions.tsx` has simple/example/deep/real-world/teach-back prompt helpers but no analogy action, learner-background preference, voting, structured analogy result, or evaluation. Goal: generate 2–3 explicitly limited analogies that map a selected concept to a learner-selected familiar domain; learner votes “helpful/not helpful” and may open a branch. Non-goals: assert analogies are proofs, infer sensitive background, or replace technical explanation.

## UX and architecture

Add `analogy` to `LearningActionId`, with an accessible `AnalogyBuilder.tsx` drawer: choose optional domains (cooking/music/construction/none), see a mapping table (**source concept / familiar analogue / where it breaks**), vote, save as branch, or regenerate. The prompt contains selected node evidence and: “Return JSON with 2–3 mappings, boundary/where analogy fails, no invented facts; avoid stereotypes.” No domain defaults based on profile. If model fails, offer existing simple/worked-example actions.

Create `AnalogyArtifactModel(id,workspace_id,source_node_id,user_id,domain,content_json,prompt_version,model,created_at)` and `AnalogyFeedbackModel(artifact_id,user_id,helpfulness,reason,created_at)` with unique artifact/user feedback; migration, `schemas/analogy.py`, `services/analogy_service.py`, `routers/analogies.py`, `main.py`. Modify `models/workspace.py`, `LearningActions.tsx`, `ChatContainer.tsx`, `FocusDrawer.tsx`, `lib/analogyApi.ts`; add `components/chat/AnalogyBuilder.tsx`. APIs: `POST /workspaces/{wid}/nodes/{nid}/analogies`, `POST /analogies/{id}/feedback`, `POST /analogies/{id}/materialize`; events `analogy_generated/voted/materialized`.

## Quality, safeguards, and measurement

Use provider interface in `packages/ai-core`, Pydantic JSON validation, input/output caps, request idempotency, and source node owner/read RBAC. Store only opt-in selected domain (not free-text biography), permit deletion, scrub raw prompt from logs, rate-limit generation. Prompt-injection text from node content is quoted as untrusted data; NIST recommends managing GenAI risks within documented processes ([NIST AI 600-1](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf)). Eval set covers technical concepts, culturally sensitive domains, misleading mappings and boundary requirement: ≥95% schema valid; 100% response contains a limitation; expert faithfulness ≥4/5. Metrics: generation failure/latency, vote distribution, save rate, later quiz change only as exploratory correlation.

Edge cases: no selected node, empty concept, repeated vote, source deletion, a harmful analogy report, concurrent materialize, model timeout. Use cache key source-content-hash/domain/model, but never reuse another user’s free-text context. Roll out behind action flag, start with “none”/generic domains, review adverse feedback weekly. Decision: structured, persisted artifacts give explainability and learning feedback; a one-shot chat prompt is cheaper but loses voting/audit/source boundary.

## Research questions answered

1. **Do analogies prove equivalence?** No; show the break explicitly.
2. **Should background be inferred?** No; sensitive profiling is unnecessary; ask optional choice.
3. **How many analogies?** Two or three permit choice without comparison overload.
4. **Can votes tune prompts?** Yes, aggregate opt-in feedback, never silently profile individuals.
5. **Does interleaving unrelated domains help?** Evidence supports related concepts, not arbitrary unrelated topics ([review](https://pmc.ncbi.nlm.nih.gov/articles/PMC5780548/)).
6. **May input node text direct the model?** No; treat as data against injection.
7. **Why save source/version?** Learner can revisit and quality team can reproduce errors.
8. **What if it is wrong?** report/hide and preserve original technical answer.

## Jira tickets and verification

1. **ANA-101 model/API:** migration, schemas/service/router/RBAC. AC: source-scoped artifact, one feedback/user, materialize is idempotent. `uv run pytest apps/api/tests/test_analogy_service.py apps/api/tests/test_analogy_endpoints.py`.
2. **ANA-102 UI:** action/drawer/mapping/boundary/vote. AC: keyboard flow, no forced profile, error fallback works. `pnpm --filter @graphmind/web vitest run src/components/chat/__tests__/analogy-builder.test.tsx`.
3. **ANA-103 eval/ops:** fixtures, report path, dashboard/flag. AC: boundary-field and injection fixtures pass. Run `uv run ruff check apps/api/src apps/api/tests && uv run mypy apps/api/src && pnpm --filter @graphmind/web build`.

DoD: explicit limitations always rendered, privacy deletion and RBAC tests pass, source link/version visible, quality evaluation published, and feature flag rollback validated.

## Sources

[NIST GAI Profile](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf) · [Interleaving review](https://pmc.ncbi.nlm.nih.gov/articles/PMC5780548/) · [OWASP LLM01](https://owasp.org/www-project-top-10-for-large-language-model-applications/assets/PDF/OWASP-Top-10-for-LLMs-v2025.pdf)

## Edge-case matrix and rollout/backfill

| Condition | Behaviour | Test |
|---|---|---|
| no selected domain | generic analogy only; no profile inference | `test_none_domain_is_generic` |
| harmful/cultural report | hide/report, preserve audit ID not content logs | `test_reported_artifact_hidden` |
| duplicate feedback | unique artifact/user replaces idempotently | `test_one_vote_per_user` |
| source changes | artifact retains source hash/version label | `test_source_hash_preserved` |
| bad model JSON | validated fallback/error, no materialization | `test_bad_json_not_saved` |

No backfill. Ship `analogy_builder_enabled` internally with generic domain first, then selected domains after harm eval; 5/25/100% gates are schema validity, reports and acceptance. Flag hides generation/UI, retains user artifacts/votes.

## Expanded Jira execution cards

### ANA-101 — artifacts, feedback, and provider service

**Objective:** generate source-bound, bounded analogies and private feedback. **Dependencies:** node RBAC/provider abstraction. **Create:** `models/analogy.py`, `schemas/analogy.py`, `services/analogy_service.py`, `routers/analogies.py`, migration `apps/api/alembic/versions/20260921_0019_add_analogy_sessions.py`, `tests/test_analogy_service.py`, `tests/test_analogy_endpoints.py`. **Modify:** `models/workspace.py`, `models/__init__.py`, `main.py`.

1. Add artifact/source hash/model/prompt/domain JSON fields and feedback unique `(artifact_id,user_id)`; 2. migrate/index actor/source; 3. validate optional domain enum and output `{mapping,boundary}` array 2–3; 4. quote node as untrusted data in provider prompt; 5. require RBAC/limits/idempotency; 6. materialize explicit branch only after write check.

**Acceptance criteria:** (a) every analogy has boundary; (b) no inferred domain is stored; (c) foreign artifact is 404; (d) one vote/user; (e) malformed output produces no artifact. **Commands:** `uv run pytest apps/api/tests/test_analogy_service.py apps/api/tests/test_analogy_endpoints.py`; ruff/mypy. **Rollback:** flag blocks create/materialize; keep own records.

### ANA-102 — chooser, vote, and source UI

**Objective:** make optional domain choice/limitation/vote accessible. **Dependencies:** ANA-101. **Create:** `lib/analogyApi.ts`, `components/chat/AnalogyBuilder.tsx`, `components/chat/__tests__/analogy-builder.test.tsx`. **Modify:** `LearningActions.tsx`, `ChatContainer.tsx`, `FocusDrawer.tsx`.

1. Add analogy action; 2. use modal controls with “none” default; 3. render mapping/boundary table; 4. implement helpful/not/report actions; 5. materialize with UUID; 6. focus return/loading/error/dark tests.

**Acceptance criteria:** (a) no domain choice required; (b) boundary visible before vote; (c) keyboard path works; (d) retry does not duplicate branch. **Commands:** `pnpm --filter @graphmind/web vitest run src/components/chat/__tests__/analogy-builder.test.tsx`; web build. **Rollback:** hide action only.

### ANA-103 — quality and harm operations

**Objective:** detect misleading/stereotyped analogies. **Dependencies:** ANA-101/102. **Create:** `tests/evals/analogy_cases.json`, `tests/test_analogy_evals.py`, report dashboard/runbook. **Modify:** metrics config.

1. Build technical/cultural/misleading fixtures; 2. score boundary/schema/faithfulness; 3. add injection test; 4. instrument report/vote/latency; 5. review beta reports before expansion.

**Acceptance criteria:** (a) ≥95% valid schema; (b) 100% limitation field; (c) report path hides artifact; (d) flag drill succeeds. **Commands:** `uv run pytest apps/api/tests/test_analogy_evals.py`; full lint/type/build. **Rollback:** disable flag and retain reports for review.

## Implementation handoff checks

1. Review migration SQL uses `ON DELETE CASCADE` only for artifact-owned feedback.
2. Confirm `domain` is nullable, never a derived user-profile field.
3. Pin prompt/model version in every output record.
4. Require `boundary` non-empty after whitespace normalization.
5. Limit each mapping and response character size before database write.
6. Verify report action has no raw artifact body in structured log.
7. Verify API accepts `Idempotency-Key` on generation/materialization.
8. Verify deleted source produces a readable provenance label, not a new generation.
9. Add response cache key scoped to requester/source hash/domain/model.
10. Record acceptance/report event after transaction commit only.
11. Include privacy deletion in account/workspace deletion integration tests.
12. Obtain product review of harm-report escalation owner before launch.
