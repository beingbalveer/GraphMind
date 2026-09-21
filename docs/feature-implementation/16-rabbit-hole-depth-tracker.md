# Rabbit Hole Depth Tracker Implementation Plan

> Agentic-worker sub-skill note: check off only validated work. - [ ] ledger/read model - [ ] canvas badge - [ ] reconciliation/ops

**Goal:** show explainable engagement depth separate from verified mastery.  
**Architecture:** trusted learning-event ledger → asynchronous depth read model → bulk canvas API/badge.  
**Tech Stack:** FastAPI, SQLAlchemy/Alembic/Postgres, Next.js/React Flow/TypeScript.  
**Spec:** `docs/FEATURE_RESEARCH.md §4.3`.

## Global Constraints

Follow `AGENTS.md`, `docs/URL_DESIGN.md`, provider abstraction, Alembic-only schema evolution, workspace RBAC, and no dead UI. Use shared UI primitives and semantic theme tokens that work in dark mode; badge details need accessible text, keyboard focus and screen-reader semantics. No client-supplied mastery/depth score is trusted.

## Status and intent

**Status: partially supported, feature not built.** `ConceptModel` has `times_quizzed`, `times_correct`, confidence, `last_reviewed_at`; `MasteryService` and `GraphCanvas` calculate/display mastery. No durable exploration-depth definition, branches counter, or “surface/moderate/deep/mastered” indicator exists. Goal: explain *engagement depth* separately from mastery, preventing a learner from confusing a long chat with retained knowledge. Non-goals: grade a person, gate nodes, or count passive rendering/AI tokens as learning.

## UX and rules

Show an accessible compact depth badge on `ThreadGraphNode` and full breakdown in `MasteryPanel`: Surface = 1–2 meaningful events, Moderate = 3–5 or one branch, Deep = ≥5 with ≥2 branches or completed practice, Mastered = existing mastery `mastered` plus review evidence. Explain the rule and event dates; “not enough evidence” is valid. Clicking badge filters/focuses the branch, never changes content. Use `Badge`, semantic status tokens, text label plus icon (not color alone), and `aria-describedby`.

## Architecture, ledger, and contracts

Consume the append-only canonical `learning_events` envelope defined by `00-expert-panel-decisions.md` and Feature 3.4/LEARN-331; do not create a competing activity table or model. Depth-specific subject references use `subject_type='node'`, `subject_id=node_id`, and bounded `result_json`/`context_json` fields; derive `node_depth_read_model(node_id,user_id,level,score,event_counts,last_activity_at,version,updated_at)`. The projector updates after node creation, branch acceptance, quiz submission, review, annotation, and explicit node open (debounced; not every scroll). `GET /workspaces/{id}/depth?node_ids=` serves the read model; `GET .../nodes/{node}/depth/explain` returns authorized event references and thresholds. Add `depthApi.ts`, `DepthBadge.tsx`, modify thread conversion/node/canvas/mastery panels; add only the depth projection model/schema/router/service/migration and main registration.

## Quality, abuse, and operations

Count one node-view event/day/node, require a minimum dwell threshold only for analytics (not mastery), reject client-supplied score, and make write endpoint server-generated from trusted actions. Workspace RBAC is mandatory. Retain raw events 18 months then aggregate/delete per privacy setting; actor pseudonyms in metrics. Project asynchronously with outbox/retry, expose lag/read-model freshness, and recompute a workspace on repair. SLO: projection lag <60s p99, summary read p95 <150ms. Monitor event ingest, dedupe conflict, transition distribution, and unexplained “mastered.”

## Research questions answered

1. **Does more interaction mean knowledge?** No; retrieval practice, not elaborative activity alone, improves meaningful learning ([Karpicke & Blunt](https://pubmed.ncbi.nlm.nih.gov/21252317/)).
2. **Should a UI badge use only color?** No; keyboard/assistive users require text and semantics ([MDN](https://developer.mozilla.org/en-US/docs/Web/Accessibility/Guides/Understanding_WCAG/Keyboard)).
3. **Can one quiz promote mastery?** No; require repeated evidence; current service already has two-attempt threshold.
4. **Why immutable events?** Reproducible calculations, auditability, and safe recalculation after rubric changes.
5. **Why a read model?** Canvas needs fast bulk lookup; replaying all events on each request is unbounded.
6. **What creates fake depth?** reload/click bots; dedupe/rate-limit and server-originated events mitigate.
7. **Should descendants roll up?** Only explicit branch/practice events and preserve explainability; do not silently inherit mastery.
8. **Can a member see another learner’s depth?** Not unless a later social consent feature explicitly permits it.

## Delivery tickets and DoD

**DEP-1 depth projector:** depend on LEARN-331, create the depth projection migration/model/service, and add trusted event producers to existing actions. AC: duplicate canonical event changes score once; recompute equals projector result. `uv run pytest apps/api/tests/test_learning_activity_service.py apps/api/tests/test_depth_projector.py`.

**DEP-2 canvas:** add API/types/badge/explanation drawer. AC: no color-only status, 100-node view performs one bulk fetch, stale state is labelled. `pnpm --filter @graphmind/web vitest run src/components/canvas/__tests__/depth-badge.test.tsx`.

**DEP-3 ops:** outbox/retry/rebuild command and dashboard. AC: simulated failure retries without duplicate score. Run `uv run ruff check apps/api/src apps/api/tests && uv run mypy apps/api/src && pnpm --filter @graphmind/web build`.

DoD: event taxonomy approved, RBAC/privacy retention tests pass, projection lag alert exists, accessibility test passes, and thresholds are product-configured/versioned.

## Sources

[Retrieval-practice study](https://pubmed.ncbi.nlm.nih.gov/21252317/) · [MDN keyboard accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility/Guides/Understanding_WCAG/Keyboard) · [OWASP API risks](https://api-security.owasp.org/editions/2023/en/0x00-header/)

## Edge-case matrix and rollout/backfill

| Condition | Behaviour | Test |
|---|---|---|
| duplicate event | unique idempotency key projects once | `test_depth_event_deduplicates` |
| projector delayed | API returns freshness timestamp, no invented state | `test_stale_read_model_is_labelled` |
| rubric version changes | rebuild from ledger with versioned thresholds | `test_rebuild_matches_projection` |
| deleted node | cascade read model/events remain aggregate-only | `test_deleted_node_is_not_visible` |
| click spam | daily view cap prevents depth inflation | `test_view_cap_per_day` |

Add ledger/read-model tables without backfill, then seed projections by replaying existing safe quiz/node-created data in throttled workspace batches and tag `migration_v1`. Release `depth_tracker_enabled` internal/5/25/100 with projector-lag/score-distribution guardrails. Disable only hides calculation/UI; do not delete ledger.

## Expanded Jira execution cards

### DEP-1 — immutable events and depth projector

**Objective:** calculate reproducible depth from trusted activity. **Dependencies:** feature 3.4/LEARN-331 learning-event ledger plus existing concepts/quizzes/nodes. **Create:** `models/depth.py`, `schemas/depth.py`, `services/depth_projector.py`, `routers/depth.py`, migration `apps/api/alembic/versions/20260921_0016_add_depth_projections.py`, `tests/test_depth_projector.py`. **Modify:** `services/learning_event_service.py`, `models/workspace.py`, `models/__init__.py`, `main.py`, trusted quiz/branch handlers; do not create a second learning-event model.

1. Reuse LEARN-331's canonical event schema and registry; add only depth event-type validation and projection `(user_id,node_id)` unique/version index.
2. Add the depth projection migration and UTC/default constraints; record threshold/rubric version in projection.
3. Emit events only after successful server actions; enforce max one `node_viewed` per day/node/user.
4. Project deterministic counts/score/level and expose bulk/read/explain Pydantic responses.
5. Implement replay command/service that clears/rebuilds one workspace transactionally and reports lag.
6. Test idempotency, authorization, threshold transitions, replay equality and deleted source.

**Acceptance criteria:** (a) client cannot submit score; (b) same event changes projection once; (c) explain endpoint lists source events; (d) bulk query has no N+1; (e) replay equals live. **Commands:** `uv run pytest apps/api/tests/test_learning_activity_service.py apps/api/tests/test_depth_projector.py`; `uv run ruff check apps/api/src apps/api/tests`; `uv run mypy apps/api/src`. **Rollback:** set `depth_tracker_enabled=false`, pause projector, preserve events.

### DEP-2 — canvas depth badge and explanation

**Objective:** render depth without conflating it with mastery. **Dependencies:** DEP-1. **Create:** `lib/depthApi.ts`, `components/canvas/DepthBadge.tsx`, `components/canvas/__tests__/depth-badge.test.tsx`. **Modify:** `treeToGraph.ts`, `ThreadGraphNode.tsx`, `GraphCanvas.tsx`, `MasteryPanel.tsx`.

1. Add strict `DepthLevel`/bulk-response TS types and one workspace bulk fetch.
2. Map thread nodes to source node depth; retain unknown as “Not enough evidence.”
3. Render Badge with text label, score explanation drawer and semantic tokens; no color-only state.
4. Refresh after `learning-event-projected` event while showing stale/fresh timestamp.
5. Implement focus/keyboard and dark/reduced-motion states; add 100-node fetch assertion.

**Acceptance criteria:** (a) badge never says mastered without mastery evidence; (b) screen reader gets level/reason; (c) 100 nodes issue one query; (d) empty/error is graceful. **Commands:** `pnpm --filter @graphmind/web vitest run src/components/canvas/__tests__/depth-badge.test.tsx`; `pnpm --filter @graphmind/web build`. **Rollback:** UI flag hides badge only.

### DEP-3 — repair and metrics

**Objective:** operate eventual projection safely. **Dependencies:** DEP-1/2. **Create:** `tests/test_depth_reconciliation.py`, projector runbook/dashboard. **Modify:** worker/config/metrics.

1. Add outbox claim/retry and dead-letter counter; 2. run workspace replay comparison; 3. alert projection lag >60s; 4. emit dedupe/transition/lag counters; 5. stage flag with score review.

**Acceptance criteria:** (a) retry has no duplicate; (b) reconcile detects drift; (c) alert fires in fixture; (d) kill switch documented. **Commands:** `uv run pytest apps/api/tests/test_depth_reconciliation.py`; full lint/type/build. **Rollback:** pause consumers and retain outbox.
