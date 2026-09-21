# Explore Related Concepts — Ghost Nodes Implementation Plan

> Agentic-worker sub-skill note: execute tickets one at a time; track each checkbox in the implementation PR. - [ ] schema/API - [ ] UI - [ ] evals/ops

**Goal:** surface 3–5 consent-safe, unexplored adjacent concepts without persisting dead graph nodes.  
**Architecture:** semantic/curator retrieval → server ranking → ephemeral ghosts → explicit branch acceptance.  
**Tech Stack:** FastAPI, SQLAlchemy/Alembic/PostgreSQL+pgvector, provider-agnostic `packages/ai-core`, Next.js/TypeScript/React Flow.  
**Spec:** `docs/FEATURE_RESEARCH.md §4.1`.

## Global Constraints

Follow `AGENTS.md`: one approved task, production verification, no dead UI. Follow `docs/URL_DESIGN.md`: URL helpers/router only. Keep LLM use behind `packages/ai-core`; use additive Alembic migrations and `require_workspace_read/write` RBAC. Use `@/components/ui` primitives, semantic tokens, dark mode, keyboard/screen-reader support, and no raw history API. The detailed plan below is the implementation authority.

## Status, goal, and boundary

**Status: not built.** `SemanticService.search_workspace_nodes` searches only existing nodes in the current workspace; `GraphCanvas.tsx` renders persisted conversation threads and `ThreadGraphNode.tsx` has no suggestion state. `NodeModel.embedding` is a 768-dimensional pgvector and `FetchUrlTool` exists, so the retrieval substrate is present. This feature adds *ephemeral* 3–5 adjacent, unexplored concepts; it does not create graph nodes, alter mastery, or call the model until the learner accepts one.

Goal: after a completed assistant turn, offer useful next concepts without turning the canvas into a recommendation feed. Retrieval practice supports active learning over passive rereading ([Karpicke & Blunt](https://pubmed.ncbi.nlm.nih.gov/21252317/)); recommendations are navigation, not evidence that a learner knows a topic.

## User flow and UX

1. A streamed answer reaches `message_end`; the selected node is the anchor.
2. Canvas requests suggestions; show a small “Related directions” panel and dashed, non-interactive-until-focused ghost cards at the edge. Loading/error never blocks chat.
3. A card exposes title, one-line reason, source (`workspace`, `official web`, or `ontology`), and “Explore”. Accept creates a normal assistant branch with `metadata.origin="related_concept"`; dismiss hides it for 30 days. “Why?” reveals the evidence, never the raw user text of another node.
4. Keyboard: suggestions are a labelled list after canvas controls; Enter accepts, Escape dismisses. Do not put decorative ghosts in the tab order. Respect reduced motion and contrast.

Use `Button`, `Badge`, `Drawer`/`Tooltip`, semantic tokens, `buildNodeUrl`, and roving focus where a graph-local list is used; MDN describes roving `tabindex` and focus restoration for complex widgets ([MDN](https://developer.mozilla.org/en-US/docs/Web/Accessibility/Guides/Keyboard-navigable_JavaScript_widgets)).

## Architecture and data flow

`ChatContainer → post-message hook → GET /workspaces/{id}/nodes/{node}/related-concepts → RelatedConceptService`.

The service validates workspace read access, embeds the anchor’s topic/content, then fuses: (a) workspace `NodeModel`/`ConceptModel` cosine candidates, (b) `CuratorService` prerequisite/frontier candidates, and (c) opt-in cached trusted-web candidates from 4.4. Exclude exact source node, ancestors/children, dismissed IDs, already-linked concepts, score below calibrated threshold, and near-duplicate titles. Diversify with max one per concept cluster. Return candidates only; client acceptance uses existing chat/branch action, then records an event. Never run the O(n²) `discover_cross_branch_links` request path for this feature.

pgvector warns that approximate HNSW plus tenant filtering may yield too few results; add the workspace filter index and use iterative scans or a materialized CTE after benchmark ([pgvector](https://github.com/pgvector/pgvector#filtering)).

## Contract and persistence

Create migration and `RelatedConceptSuggestionModel`: `id`, `workspace_id`, nullable `anchor_node_id`, `canonical_key`, `title`, `reason`, `source_kind`, `score`, `status(presented|accepted|dismissed|expired)`, `expires_at`, `created_at`, unique `(workspace_id,anchor_node_id,canonical_key)`. Add immutable `learning_events` (see decisions) with `related_suggestion_presented/accepted/dismissed`.

`GET .../related-concepts?limit=5` → `{anchorNodeId, generatedAt, suggestions:[{id,title,reason,score,sourceKind,sourceRef}]}`. `POST .../related-concepts/{id}/accept` accepts idempotency key and returns `{nodeId, suggestionId}`; `POST .../dismiss` records reason enum. Pydantic schemas belong in `schemas/related_concepts.py`; TS types/API in `relatedConceptApi.ts`. Emit SSE/event-bus `related_suggestions_ready` only after commit.

## AI, security, reliability, and metrics

For sparse local evidence, an LLM may normalize *candidate labels only*: “Return JSON `{title, rationale, prerequisite_relation}`; do not make factual claims; use supplied evidence; reject duplicates.” Validate JSON, cap 120/240 characters, and retain model/version/evidence IDs. Offline deterministic fallback is curator candidates or no suggestions. Eval set: 100 anchors with human relevance/novelty labels; require Precision@5 ≥0.70, duplicate rate <2%, unsafe/unsupported claim rate 0%; compare diversified RRF with vector-only.

Every object lookup uses `require_workspace_read`; OWASP lists BOLA, unrestricted consumption, SSRF, and unsafe third-party APIs as core API risks ([OWASP API Top 10](https://api-security.owasp.org/editions/2023/en/0x00-header/)). Rate-limit generation (10/min/user), do not expose cross-workspace content, hash analytics IDs, and treat web text as untrusted because RAG does not remove prompt injection ([OWASP LLM01](https://owasp.org/www-project-top-10-for-large-language-model-applications/assets/PDF/OWASP-Top-10-for-LLMs-v2025.pdf)). Instrument latency, candidate source/score, accept/dismiss, branch depth after acceptance, and no-result rate; SLO p95 <400 ms cached/<1.5 s fresh, availability 99.5%.

## Edge cases, migration, rollout, and decisions

Empty/short anchor, missing embedding, all candidates explored, duplicate concurrent refresh, deleted anchor, no web consent, and a stale source must return a valid empty array. Backfill only embeddings already missing through a bounded worker; never re-embed synchronously. Ship disabled by feature flag, internal workspace first, then 10/50/100% after relevance/error dashboards; delete expired suggestions nightly.

Decision: persist suggestion outcomes (not ghosts) for explainability, dedupe, and learning-event analytics. Alternatives rejected: client-only cosine (leaks ranking rules/no feedback), unconditional LLM brainstorming (hallucinates/expensive), and persisting ghosts as `NodeModel` (dead UI and graph pollution).

## Research questions answered

1. **Can HNSW return too few workspace-filtered matches?** Yes; filtering happens after approximate scan, so enable iterative scans/index the filter ([pgvector](https://github.com/pgvector/pgvector#iterative-index-scans)).
2. **Are null vectors searchable?** No; pgvector excludes null (and cosine zero) vectors, hence an empty fallback is required ([pgvector FAQ](https://github.com/pgvector/pgvector#why-are-there-less-results-for-a-query-after-adding-an-hnsw-index)).
3. **Should related topics be random?** No; interleave related material only after basic understanding, not unrelated subjects ([science-of-learning review](https://pmc.ncbi.nlm.nih.gov/articles/PMC5780548/)).
4. **Should acceptance auto-create a node?** No; it needs an explicit learner action to avoid graph clutter.
5. **Can an LLM decide authorization?** No; authorization is enforced before retrieval.
6. **May web text issue instructions?** No; label it data and isolate it from tool instructions per OWASP LLM01.
7. **How many cards?** Five maximum preserves choice without canvas overload; validate with completion metrics.
8. **Can cross-workspace matches enter here?** No; that is 4.2 and requires separate opt-in.

## Tickets, tests, and DoD

**REL-1 data/service (depends: migration):** create model, Alembic revision, schemas, service, router, RBAC and structured logs. AC: same workspace receives ≤5 deduped candidates; another member cannot read outcomes; no candidate mutates graph. Tests: `uv run pytest apps/api/tests/test_related_concept_service.py apps/api/tests/test_related_concept_endpoints.py`; add tenant, empty, race/idempotency, threshold tests.

**REL-2 UI (depends REL-1):** add `relatedConceptApi.ts`, `RelatedConceptSuggestions.tsx`, hook in chat/canvas, semantic token styling and focus behavior. AC: loading/empty/error states, accepting creates one normal branch, dismiss remains hidden after refresh. Test `pnpm --filter @graphmind/web vitest run src/components/related-concepts/__tests__/related-concept-suggestions.test.tsx`.

**REL-3 quality/ops (depends REL-1/2):** write fixture/eval runner and dashboards/flag. AC: threshold report saved, p95 and acceptance measured, kill switch hides feature without migration rollback. Test `uv run ruff check apps/api/src apps/api/tests && uv run mypy apps/api/src` and `pnpm --filter @graphmind/web build`.

Definition of Done: reviewed migration, RBAC and prompt-injection tests pass, accessibility keyboard test passes, no ghost is persisted as a node, observability dashboard and rollback flag exist, and product signs off on relevance sample.

## Sources

[pgvector](https://github.com/pgvector/pgvector) · [Karpicke & Blunt](https://pubmed.ncbi.nlm.nih.gov/21252317/) · [MDN keyboard widgets](https://developer.mozilla.org/en-US/docs/Web/Accessibility/Guides/Keyboard-navigable_JavaScript_widgets) · [OWASP API Top 10](https://api-security.owasp.org/editions/2023/en/0x00-header/) · [OWASP LLM01](https://owasp.org/www-project-top-10-for-large-language-model-applications/assets/PDF/OWASP-Top-10-for-LLMs-v2025.pdf)

## Edge-case matrix

| Condition | Behaviour | Named test |
|---|---|---|
| anchor has no content/vector | return `suggestions: []`, no provider call | `test_empty_anchor_returns_empty` |
| every candidate was dismissed/explored | return empty, never repeat suppressed key | `test_dismissed_candidate_excluded` |
| accept retried | one branch/event by idempotency key | `test_accept_is_idempotent` |
| anchor deleted after fetch | materialize returns 404 without source leak | `test_accept_rechecks_anchor` |
| HNSW has filtered shortfall | iterate/fallback curator candidates, label source | `test_iterative_search_fallback` |

## Rollout, migration, and backfill

The migration is additive; create no historical suggestions. Backfill only missing node embeddings through a throttled worker, checkpointing node IDs and never in a request transaction. Deploy database → disabled API → internal flag → 5%/25%/100% after P@5, p95 and error gates. `related_concepts_enabled=false` suppresses generation/materialization while existing rows remain auditable; rollback is feature disable, not row deletion. Nightly expiry removes presented/dismissed rows per retention policy.

## Expanded Jira execution cards

### REL-1 — data, ranking service, and router

**Objective:** persist explainable suggestion outcomes and return only authorized, deduplicated candidates. **Dependencies:** existing `SemanticService`, `CuratorService`, workspace RBAC. **Create:** `apps/api/src/models/related_concept.py`, `schemas/related_concepts.py`, `services/related_concept_service.py`, `routers/related_concepts.py`, `apps/api/alembic/versions/20260921_0014_add_related_concepts.py`, `tests/test_related_concept_service.py`, `tests/test_related_concept_endpoints.py`. **Modify:** `models/workspace.py`, `models/__init__.py`, `main.py`.

1. Define `RelatedConceptSuggestionModel` with the fields/unique key in this plan, `status` check constraint and `(workspace_id, anchor_node_id, status)` index.
2. Write an additive upgrade/downgrade Alembic revision; use UTC `expires_at` and no runtime DDL.
3. Implement `rank(db, workspace_id, anchor_node_id, user_id, limit=5)` with `require_workspace_read` route dependency, anchor ownership check, embedding/candidate queries and cluster dedupe.
4. Query local semantic candidates first, curator frontier second, optional approved cached source third; exclude lineage, concept links and dismissed canonical keys.
5. Persist `presented` rows in one transaction, return Pydantic `RelatedConceptResponse`, and write event after commit; log IDs/source/latency only.
6. Implement GET/accept/dismiss with UUID idempotency header, `require_workspace_write` on mutation and 404 for foreign IDs.

**Acceptance criteria:** (a) maximum five unique canonical keys; (b) other workspace/user gets 404/no content; (c) empty vector never calls provider; (d) accept creates exactly one normal branch; (e) downgrade removes only new tables/indexes. **Commands:** `uv run pytest apps/api/tests/test_related_concept_service.py apps/api/tests/test_related_concept_endpoints.py`; `uv run ruff check apps/api/src apps/api/tests`; `uv run mypy apps/api/src`. **Rollback:** server flag disables endpoint actions; keep migration/rows for audit.

### REL-2 — canvas and chat suggestion surface

**Objective:** render non-persistent ghost choices with keyboard-equivalent acceptance/dismissal. **Dependencies:** REL-1. **Create:** `apps/web/src/lib/relatedConceptApi.ts`, `components/canvas/RelatedConceptSuggestions.tsx`, `components/canvas/__tests__/related-concept-suggestions.test.tsx`. **Modify:** `GraphCanvas.tsx`, `FocusDrawer.tsx`, `ThreadGraphNode.tsx`, `apps/web/src/lib/treeToGraph.ts`.

1. Define strict `RelatedConceptSuggestion`/response interfaces and central API calls; no component endpoint strings.
2. On assistant completion/selected anchor, fetch once with abort controller; render loading, empty and recoverable error states.
3. Render dashed visual ghosts from transient component state only; do not insert them into `ConversationTree`/React Flow persisted node list.
4. Use `Button` controls/list semantics, visible reason/source, Enter acceptance, Escape dismissal and live “suggestions ready” status.
5. On accept call API with UUID, refresh graph snapshot, focus new branch; on dismissal immediately remove local item and retain server outcome.
6. Add reduced-motion/dark token tests and verify no raw URL/history navigation.

**Acceptance criteria:** (a) ghosts disappear on reload unless fetched; (b) mouse and keyboard actions call identical code; (c) accepting one suggestion creates one branch; (d) all-empty/error views are understandable; (e) 100 candidates still issue one bulk request. **Commands:** `pnpm --filter @graphmind/web vitest run src/components/canvas/__tests__/related-concept-suggestions.test.tsx`; `pnpm --filter @graphmind/web build`. **Rollback:** flag hides surface and cancels fetch; accepted branches remain normal nodes.

### REL-3 — evaluation, telemetry, and release controls

**Objective:** prove relevance/safety and operate ranking safely. **Dependencies:** REL-1/REL-2. **Create:** `apps/api/tests/evals/related_concepts.json`, `apps/api/tests/test_related_concept_evals.py`, dashboard/alert definition under repository observability convention. **Modify:** service configuration/metrics.

1. Label 100 anchors with relevant, duplicate, explored, unsafe and empty expected outcomes.
2. Run vector-only and diversified ranking; calculate Precision@5, novelty and duplicate rate in test output.
3. Add prompt-normalizer injection fixtures and assert no tool instruction/source content is executed.
4. Emit counters/histograms for source, score bucket, p95, no-result, accept/dismiss and failures without node content.
5. Configure alert on p95/5xx and document flag kill/rebuild procedure; stage internal/5/25/100 percent.

**Acceptance criteria:** (a) P@5 ≥.70; (b) duplicate <2%; (c) unsafe/injection fixture never materializes; (d) dashboard has error/latency/accept metrics. **Commands:** `uv run pytest apps/api/tests/test_related_concept_evals.py`; full backend tests and web build. **Rollback:** set flag false, stop workers, preserve metrics/rows.
