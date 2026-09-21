# Concept Comparison Challenge Implementation Plan

> Agentic-worker sub-skill note: check work only after tests. - [ ] comparison API - [ ] canvas multi-select - [ ] evals/ops

**Goal:** turn two selected, authorized concepts into a source-grounded comparison and retrieval exercise.  
**Architecture:** two-node selection → source-snapshot artifact/rubric → attempt/feedback → optional branch.  
**Tech Stack:** FastAPI/SQLAlchemy/Alembic/Postgres, provider abstraction, React Flow/Next.js.  
**Spec:** `docs/FEATURE_RESEARCH.md §5.4`.

## Global Constraints

Use `AGENTS.md`, `URL_DESIGN.md`, `packages/ai-core`, Alembic and workspace RBAC. Components must use shared primitives/semantic tokens, dark mode and accessible roving-focus/table semantics. Never compare IDs before permission checking or hardcode navigation/history paths.

## Status and desired outcome

**Status: not built.** The canvas supports selection/focus of a single thread, `LearningActions` supports generic quiz prompts, and graph concepts/nodes are available; no multi-select comparison state, comparison artifact, fill-in exercise, or result scoring exists. Goal: select exactly two accessible nodes/concepts and receive an evidence-grounded comparison matrix plus retrieval blanks; learner submits answers and sees source-linked feedback. Non-goals: declare a universal winner, compare arbitrary inaccessible workspaces, or overwrite either node.

## UX flow

Canvas enters Compare mode; two selected node cards have visible ordinal labels and a persistent toolbar. “Compare these” opens a side-by-side `ComparisonChallenge` with dimensions (purpose, mechanism, strengths, limits, when to use), explicit “insufficient evidence” cells, and 3–5 typed fill blanks. Submit evaluates each blank against rubric/acceptable concepts, supplies feedback, then offers a `comparison` assistant child linked to both source IDs. Cancel clears selection. Roving focus applies to canvas selection; table has captions/header associations, responsive stacked mobile view, text labels beyond color.

## System design

Create `ComparisonChallengeModel(id,workspace_id,left_node_id,right_node_id,creator_id,dimensions_json,exercise_json,rubric_json,model_version,status,created_at)` and `ComparisonAttemptModel(id,challenge_id,user_id,answers_json,result_json,created_at)`. Add Alembic, relationships/imports, `schemas/comparison.py`, `services/comparison_service.py`, `routers/comparisons.py`, main; web `lib/comparisonApi.ts`, `components/canvas/ComparisonToolbar.tsx`, `components/chat/ComparisonChallenge.tsx`, modify `GraphCanvas.tsx`, `ThreadGraphNode.tsx`, `FocusDrawer.tsx`. APIs: `POST /workspaces/{wid}/comparisons {leftNodeId,rightNodeId}`, `GET /comparisons/{id}`, `POST /comparisons/{id}/attempts`, `POST /comparisons/{id}/materialize` (idempotent). Store `comparison_generated/submitted` events.

Prompt gathers canonical source snippets and says: “Compare only supplied evidence. Return JSON dimensions with `left_evidence_id`, `right_evidence_id`, tradeoffs, unknowns, and short blanks/rubric. Do not invent distinctions.” Server validates different nodes, same workspace, snippets/size, schema, citations. Deterministic keyword/concept rubric scores first; AI feedback may explain but not alter score without versioned rubric. Eval: swapped-node symmetry, missing evidence produces unknown, hallucinated claims rejected, 95% dimension-source linkage and human rubric agreement ≥.8.

## Security, edge conditions, performance, decisions

Authorize both source nodes against workspace, bound selection to two, rate-limit model work and input size, redact nodes deleted after generation, retain source snapshot hash/version for reproducibility, and allow creator delete. OWASP BOLA prevents attacker-selected node IDs from exposing content ([OWASP](https://api-security.owasp.org/editions/2023/en/0x00-header/)). Edge cases: same node twice, one no content, source changed/deleted, concurrent attempt, model timeout, extremely long nodes, conflicting/ambiguous concepts. Cache by ordered source content hashes/model/dimensions; p95 generate <6s, result <2s, monitor completion, wrong/unknown cells, selection abort, rubric disagreement. Flag beta; start same-workspace only. Decision: relational artifact plus immutable source snapshot over an ephemeral prompt so users can audit/correct comparisons; two-node only avoids an unreadable first release.

## Research questions answered

1. **Why require learner blanks?** Retrieval practice has stronger learning evidence than passive restudy ([Karpicke & Blunt](https://pubmed.ncbi.nlm.nih.gov/21252317/)).
2. **Should we mix unrelated topics?** No; interleaving evidence concerns meaningfully related concepts ([review](https://pmc.ncbi.nlm.nih.gov/articles/PMC5780548/)).
3. **Can a model use outside facts silently?** No; comparison is source-grounded and states unknown.
4. **Why preserve snapshot hashes?** Later source edits cannot make past grading irreproducible.
5. **What if both nodes are identical?** Client/server reject with actionable error.
6. **Can reviewer see hidden source?** no, enforce both-node RBAC.
7. **What scores it?** versioned deterministic rubric first, model explanatory feedback second.
8. **How keyboard-select graph nodes?** roving focus and announced selected count ([MDN](https://developer.mozilla.org/en-US/docs/Web/Accessibility/Guides/Keyboard-navigable_JavaScript_widgets)).

## Jira tickets, verification, DoD

1. **CMP-101 API/data:** migration/service/router/source snapshot. AC: different same-workspace nodes only, citations valid, idempotent materialization. `uv run pytest apps/api/tests/test_comparison_service.py apps/api/tests/test_comparison_endpoints.py`.
2. **CMP-102 canvas/UI:** multi-select toolbar/table/exercise. AC: mouse/keyboard parity, cancel clears, mobile table reads. `pnpm --filter @graphmind/web vitest run src/components/canvas/__tests__/comparison-challenge.test.tsx`.
3. **CMP-103 eval/ops:** source/hallucination/symmetry fixtures, metrics/flag. AC: unknown and swapped tests pass. `uv run ruff check apps/api/src apps/api/tests && uv run mypy apps/api/src && pnpm --filter @graphmind/web build`.

DoD: audit snapshot/citations visible, RBAC and accessibility tests pass, scoring validation/eval pass, feature flag and cleanup migration documented.

## Sources

[Retrieval practice](https://pubmed.ncbi.nlm.nih.gov/21252317/) · [Interleaving evidence](https://pmc.ncbi.nlm.nih.gov/articles/PMC5780548/) · [OWASP API](https://api-security.owasp.org/editions/2023/en/0x00-header/) · [MDN keyboard accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility/Guides/Understanding_WCAG/Keyboard)

## Execution addendum: edge cases, rollout, tickets

| Edge case | Required result | Test |
|---|---|---|
| same/foreign pair | reject before provider | `test_invalid_pair` |
| missing evidence | explicit unknown | `test_missing_evidence_is_unknown` |
| source edit | snapshot hash stays | `test_snapshot_reproducible` |
| duplicate attempt | one result/event | `test_attempt_idempotent` |
| mobile table | stacked headers | `comparison-challenge.test.tsx` |

No backfill. `comparison_challenge_enabled`: internal→5→25→100% after citation/rubric/p95 gates; off blocks generation but preserves artifacts.

### CMP-101 implementation card

**Objective:** cited two-node artifact/scoring API. **Dependencies:** graph/RBAC/provider. **Create:** `models/comparison.py`, `schemas/comparison.py`, `services/comparison_service.py`, `routers/comparisons.py`, `apps/api/alembic/versions/20260921_0021_add_comparison_challenges.py`, `tests/test_comparison_service.py`, `tests/test_comparison_endpoints.py`. **Modify:** `models/workspace.py`, `models/__init__.py`, `main.py`.

1. Model left/right IDs, source hashes, dimensions/exercise/rubric JSON, attempts/unique UUID. 2. Add migration/indexes. 3. Require two distinct readable same-workspace nodes. 4. Snapshot bounded evidence. 5. Validate cited/unknown provider output. 6. Score deterministic rubric then persist explanatory feedback.

**Acceptance:** cited dimensions; no foreign leak; reproducible score; one materialized branch; self-pair 422. **Commands:** `uv run pytest apps/api/tests/test_comparison_service.py apps/api/tests/test_comparison_endpoints.py && uv run ruff check apps/api/src apps/api/tests && uv run mypy apps/api/src`. **Rollback:** feature flag blocks writes.

### CMP-102 implementation card

**Objective:** accessible canvas selection/exercise. **Dependencies:** CMP-101. **Create:** `lib/comparisonApi.ts`, `components/canvas/ComparisonToolbar.tsx`, `components/chat/ComparisonChallenge.tsx`, test. **Modify:** `GraphCanvas.tsx`, `ThreadGraphNode.tsx`, `FocusDrawer.tsx`.

1. Track max two IDs. 2. Announce ordinal/count. 3. Render cited table/blanks. 4. Submit UUID answers. 5. Stack responsive headers/focus return. 6. Test cancel/error/dark/keyboard.

**Acceptance:** third selection explained; mouse/keyboard parity; unknown visible; URL helpers only. **Commands:** `pnpm --filter @graphmind/web vitest run src/components/canvas/__tests__/comparison-challenge.test.tsx && pnpm --filter @graphmind/web build`. **Rollback:** hide compare mode.

### CMP-103 implementation card

**Objective:** source quality operations. **Dependencies:** CMP-101/102. **Create:** eval fixtures/test/dashboard. **Modify:** metrics config.

1. Add swapped/missing/injection fixtures. 2. Assert citation/symmetry. 3. Emit completion/disagreement. 4. Alert errors/p95. 5. stage release.

**Acceptance:** ≥95% linkage; unknown test passes; zero source leak; rollback runbook. **Commands:** `uv run pytest apps/api/tests/test_comparison_evals.py`; full lint/type/build. **Rollback:** flag off, retain audit.

## Implementation handoff checks

1. Canonically order left/right source IDs only for cache; preserve user display order.
2. Store snapshot content hash and selected excerpts separately from live node body.
3. Limit dimensions to five and blanks to five at schema validation.
4. Require `unknown_reason` when a dimension has no evidence.
5. Keep rubric version in each attempt/result JSON.
6. Block materialization until attempt feedback or explicit learner override is defined.
7. Reauthorize both source nodes on every artifact read/materialize.
8. Never use cross-workspace source IDs in first release.
9. Test response serialization excludes source body not selected as evidence.
10. Add database index `(workspace_id,left_node_id,right_node_id,created_at)`.
11. Record model/citation validation failures as structured counters.
12. Manually validate table headers/stacked mobile announcement with screen reader.
