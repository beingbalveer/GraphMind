# Explain It Again Differently Implementation Plan

> Agentic-worker sub-skill note: check through verified work. - [ ] provenance service - [ ] modal/stream UI - [ ] evals/ops

**Goal:** make an alternate explanation a auditable sibling rather than replacing source knowledge.  
**Architecture:** source-bound generation artifact → constrained provider output → explicit sibling materialization edge.  
**Tech Stack:** FastAPI/SQLAlchemy/Alembic/Postgres/SSE, `packages/ai-core`, Next.js.  
**Spec:** `docs/FEATURE_RESEARCH.md §6.3`.

## Global Constraints

Obey `AGENTS.md` and `URL_DESIGN.md`; keep provider use abstracted, schema changes in Alembic and object access under RBAC. Use standard semantic components/tokens, dark-mode and keyboard/screen-reader accessible modal/stream UI. Never overwrite source nodes, use untrusted source text as instructions, or hand-build navigation.

## Status and objective

**Status: partially supported.** `LearningActions` already supplies prompt text for simple, example, deep, real-world and production angles, and normal chat branching preserves original messages. There is no node-menu action with a fixed set of modes, structured provenance, source-level safety/evaluation, or guarantee that each re-explanation is a sibling. Goal: generate a user-selected alternative representation—simpler, technical, code example, visual-description, or step tutorial—as a sibling node, retaining original and visible mode/source relation. Non-goals: replace/correct original silently, generate inaccessible image-only content, or claim the alternate form increases mastery automatically.

## Flow, contract, and files

In `FocusDrawer`/node menu, **Explain differently** opens modal mode picker and optional audience level. Preview streams into a draft; learner accepts to create exactly one sibling under source’s parent with `metadata={node_type:"reexplanation", source_node_id, representation_mode, prompt_version, model}` and an `EdgeModel` `relation_type="alternative_explanation"`. Existing `CreateSubnodeTool` is insufficient because it always parents to selected node; create a protected `ReexplanationService`.

Add migration only if a separate `ReexplanationArtifactModel(id,workspace_id,source_node_id,generated_node_id,mode,requester_id,prompt_version,model,source_hash,status,created_at)` is needed for evaluation/audit (recommended); create `schemas/reexplanation.py`, service/router/main, modify `models/workspace.py`. Web: `lib/reexplanationApi.ts`, `components/chat/ReexplanationModal.tsx`, modify `FocusDrawer.tsx`, `ThreadGraphNode.tsx`, `ChatContainer.tsx`, `LearningActions.tsx`; add tests. `POST /workspaces/{wid}/nodes/{nid}/reexplanations {mode,level}` returns draft/stream ID; `POST .../{id}/materialize` returns sibling node, idempotently; `GET` records provenance. Emit `reexplanation_requested/materialized`.

## Prompt/evals, safety, operations

System prompt includes source text as untrusted data: “Preserve factual meaning; say when evidence is insufficient; comply with requested representation; for visual mode return alt-text-ready diagram description, never imagery only; code must be labelled illustrative/not executed. JSON `{content, assumptions, key_claims}`.” Validate mode enum/output, cite source-node segment IDs for claims, cap generation and do not inherit tool permissions. Eval 50 representative nodes/modes: factual entailment reviewed against source ≥.9, mode compliance ≥.95, no unsupported claims, code syntax fixtures, visual descriptions meaningful without picture. NIST calls for lifecycle risk management for GenAI ([NIST](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf)); model failure returns current LearningActions prompt path/no draft.

RBAC source/read + write branch, rate/cost cap, hash source not full body in logs, user delete removes artifact/child as requested, no use of private annotations without explicit attachment. Handle root node (sibling parent null but new edge), source deletion, stale draft, concurrent materialize, long code, stream disconnect, provider timeout. Cache draft only per user/content-hash/mode; p95 stream start <2s, materialize <300ms; monitor modes, acceptance, hallucination reports, duplicate retries. Flag gradual rollout. Decision: sibling retains multiple representations and avoids corruption; overwriting source destroys lineage; raw generic chat prompts lack provenance/eval.

## Research questions answered

1. **Why sibling not replacement?** Preserve the original and graph lineage for comparison/recovery.
2. **Can “simple” omit caveats?** It may simplify vocabulary, not factual qualifiers.
3. **What makes visual mode accessible?** a textual diagram description/alt-ready explanation, not color/image only.
4. **Can generated code run?** No; it is illustrative unless separately submitted to 5.1 runner.
5. **Does multiple representation prove mastery?** No, user still needs retrieval/practice ([Karpicke & Blunt](https://pubmed.ncbi.nlm.nih.gov/21252317/)).
6. **Can source text become instructions?** No, classify it as untrusted data against injection ([OWASP LLM01](https://owasp.org/www-project-top-10-for-large-language-model-applications/assets/PDF/OWASP-Top-10-for-LLMs-v2025.pdf)).
7. **How avoid duplicates?** idempotency and user/content/mode cache.
8. **Why model/version stored?** reproducible quality/error investigation.

## Tickets, verification, DoD

1. **REX-101 service/API:** artifact migration, sibling creation/edge/RBAC/idempotency. AC: source unchanged, root works, duplicate materialize yields one node. `uv run pytest apps/api/tests/test_reexplanation_service.py apps/api/tests/test_reexplanation_endpoints.py`.
2. **REX-102 UI:** picker/preview/source badges/error states. AC: all five modes visible; keyboard modal/stream cancel passes. `pnpm --filter @graphmind/web vitest run src/components/chat/__tests__/reexplanation-modal.test.tsx`.
3. **REX-103 quality/ops:** entailment/mode/injection suite, metrics/flag. AC: evaluation thresholds published. Run `uv run ruff check apps/api/src apps/api/tests && uv run mypy apps/api/src && pnpm --filter @graphmind/web build`.

DoD: sibling/edge/provenance verified, source preservation/RBAC/a11y/evals pass, cancellation and rollback work.

## Sources

[NIST GAI Profile](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf) · [OWASP LLM01](https://owasp.org/www-project-top-10-for-large-language-model-applications/assets/PDF/OWASP-Top-10-for-LLMs-v2025.pdf) · [Retrieval evidence](https://pubmed.ncbi.nlm.nih.gov/21252317/) · [MDN keyboard](https://developer.mozilla.org/en-US/docs/Web/Accessibility/Guides/Understanding_WCAG/Keyboard)

## Execution addendum: edge cases, rollout, tickets

| Condition | Behaviour | Test |
|---|---|---|
| root source | sibling parent null plus alternative edge | `test_root_reexplanation` |
| stale draft | materialize validates source hash/version | `test_stale_draft_rejected` |
| duplicate materialize | one generated node | `test_materialize_idempotent` |
| visual mode | text diagram/alt-ready output | `test_visual_mode_is_textual` |
| model bad JSON | no node; fallback/error | `test_invalid_output_not_materialized` |

No backfill. `reexplanation_enabled` internal→5→25→100% after entailment/mode/p95 gates. Flag blocks draft/materialize while existing siblings/provenance stay visible; rollback is non-destructive.

### REX-101 implementation card

**Objective:** create auditable source-bound drafts and sibling materialization. **Dependencies:** nodes/edges/auth/provider. **Create:** `models/reexplanation.py`, `schemas/reexplanation.py`, `services/reexplanation_service.py`, `routers/reexplanations.py`, migration `apps/api/alembic/versions/20260921_0024_add_reexplanations.py`, `apps/api/tests/test_reexplanation_service.py`, `apps/api/tests/test_reexplanation_endpoints.py`. **Modify:** `models/workspace.py`, `models/__init__.py`, `main.py`.

1. Add artifact columns source/generated IDs, mode enum, hash/model/prompt/status and unique requester/source/hash/mode request key. 2. Add migration/indexes. 3. Validate source RBAC/length/mode. 4. prompt provider with source as untrusted data/JSON claims. 5. validate draft then create sibling/`alternative_explanation` edge once. 6. test root/source delete/race/foreign IDs.

**Acceptance:** source never overwritten; all modes enum validated; root works; duplicate key yields one node; artifact RBAC enforced. **Commands:** `uv run pytest apps/api/tests/test_reexplanation_service.py apps/api/tests/test_reexplanation_endpoints.py && uv run ruff check apps/api/src apps/api/tests && uv run mypy apps/api/src`. **Rollback:** flag blocks writes, retains graph.

### REX-102 implementation card

**Objective:** present mode picker/draft stream/source provenance accessibly. **Dependencies:** REX-101. **Create:** `lib/reexplanationApi.ts`, `components/chat/ReexplanationModal.tsx`, modal test. **Modify:** `FocusDrawer.tsx`, `ThreadGraphNode.tsx`, `ChatContainer.tsx`, `LearningActions.tsx`.

1. Add action/mode enum. 2. Use Modal/Buttons, level selector and preview states. 3. stream/poll draft with cancel. 4. materialize UUID then refresh/focus sibling. 5. display original/mode/version badge. 6. test focus/Escape/error/dark/text visual mode.

**Acceptance:** all five modes visible; no source replacement; keyboard modal works; provider failure leaves original usable. **Commands:** `pnpm --filter @graphmind/web vitest run src/components/chat/__tests__/reexplanation-modal.test.tsx && pnpm --filter @graphmind/web build`. **Rollback:** hide action.

### REX-103 implementation card

**Objective:** evaluate factual/mode safety and operate rollout. **Dependencies:** REX-101/102. **Create:** `tests/evals/reexplanation_cases.json`, `tests/test_reexplanation_evals.py`, dashboard/runbook. **Modify:** prompt/metrics config.

1. Build simple/technical/code/visual/tutorial fixtures. 2. score entailment against source. 3. assert injection/unsupported claim rejection. 4. emit latency/accept/report metrics. 5. alert failure/hallucination reports and stage flag.

**Acceptance:** entailment ≥.90; mode compliance ≥.95; injection safe; rollback drill passes. **Commands:** `uv run pytest apps/api/tests/test_reexplanation_evals.py`; full lint/type/build. **Rollback:** disable provider draft path.

## Implementation handoff checks

1. Validate source node’s workspace matches route before draft creation.
2. Preserve original provider/model fields untouched on source node.
3. Use a distinct generated node metadata `node_type` and stable source ID.
4. Create edge and sibling in one transaction.
5. Validate no self-loop/duplicate alternative edge.
6. Apply output content/claim/assumption length caps.
7. Treat code mode content as display-only, never invoke a runner.
8. Require visual mode textual diagram and alt-ready explanation fields.
9. Permit draft cancellation before any graph mutation.
10. Mark source hash mismatch to learner instead of silently updating draft.
11. Exclude private annotations from default source bundle.
12. Reauthorize source on materialization, not only draft creation.
13. Maintain cleanup job for expired unmaterialized drafts.
14. Test generated sibling appears in timeline with alternative relation label.
