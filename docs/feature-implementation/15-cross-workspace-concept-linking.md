# Cross-Workspace Concept Linking Implementation Plan

> Agentic-worker sub-skill note: complete/check tickets sequentially in the PR. - [ ] consent/schema - [ ] matching API - [ ] UI/eval/ops

**Goal:** show consented same-user concept connections without leaking another workspace.  
**Architecture:** membership-filtered concept identity candidates → bilateral user link → canonical deep link.  
**Tech Stack:** FastAPI, SQLAlchemy/Alembic/Postgres+pgvector, Next.js/TypeScript.  
**Spec:** `docs/FEATURE_RESEARCH.md §4.2`.

## Global Constraints

Obey `AGENTS.md` approval/verification and `docs/URL_DESIGN.md` helper-only navigation. Keep embeddings/provider calls behind `packages/ai-core`, schema changes in Alembic, and all object access behind `require_workspace_read/write`. Use shared UI primitives/tokens, light/dark semantic styling, and accessible keyboard/focus behavior; never create raw controls or cross-workspace `EdgeModel` shortcuts.

## Status, goal, and scope

**Status: not built.** Concepts are scoped by `workspace_id`; `SemanticService` only queries one workspace and `require_workspace_read` protects routes. Goal: surface a private, consented “You explored this in X” pointer when two workspaces owned/readable by the same user contain a canonical concept. It is a link card and deep link, not cross-workspace graph edges, shared content, or a search across collaborators’ private workspaces.

## UX flow

On a node/concept panel, show an unobtrusive “Also in JavaScript foundations” card only if the user has granted discovery consent for both workspaces. “View notes” opens canonical `buildNodeUrl(workspaceId, chatId, nodeId)` in the other workspace; “Connect” saves a personal conceptual link; “Hide this connection” creates a suppression. If target access disappears, display no card. Announce asynchronous results via polite live region; visible title, source workspace, and link reason are necessary for screen-reader users.

## Architecture, model, and API

Use a `ConceptIdentityService`: normalized lowercase Unicode casefolded label + embedding candidate retrieval, then deterministic similarity/high-confidence confirmation. Do **not** globally merge `ConceptModel`: same string can mean different things. Add `workspace_discovery_preferences(workspace_id, user_id, cross_workspace_enabled)` and `cross_workspace_concept_links(id,user_id,source_concept_id,target_concept_id,canonical_key,confidence,status,created_at)` with canonical pair ordering and unique user/source/target. Store `learning_events` `cross_workspace_link_viewed/accepted/hidden`.

`GET /workspaces/{id}/concepts/{conceptId}/cross-links` returns metadata the caller may see, never target node content. `POST .../cross-links/{id}/accept|hide` requires the signed-in user and target readability. Implement in `services/concept_identity_service.py`, `schemas/cross_workspace.py`, `routers/cross_workspace.py`, API client, `CrossWorkspaceLinks.tsx`, `MasteryPanel.tsx`, `GraphCanvas.tsx`; modify `models/workspace.py`, `models/__init__.py`, `main.py`, and an Alembic revision. Index target IDs and `(user_id, canonical_key)`.

## Privacy, security, resilience, and analytics

Consent defaults off. Query candidate workspace IDs from memberships first, then each authorization predicate; never infer the existence/name of a workspace without permission. PostgreSQL RLS can enforce per-row restrictions in addition to application checks ([PostgreSQL RLS](https://www.postgresql.org/docs/17/ddl-rowsecurity.html)); evaluate it once DB roles map safely to request identity, but keep `require_workspace_read` now. Encrypt no new fields beyond standard database encryption, minimize title metadata, support erasure cascading both ends, audit link views, rate-limit endpoint. p95 <500 ms for ≤100 accessible workspaces; batch/cache identity resolution; queue embedding backfill. Metrics: opted-in users, exposure, click-through, false-link hide rate, permission-denied attempts (zero leaks).

## AI/evals, edge cases, rollout, decisions

Use embeddings for candidate generation only. Optional verifier prompt: “Given two short labels/descriptions, output same/distinct/uncertain JSON; never use private text.” Human-labelled homonym benchmark requires precision ≥0.95 and false-positive workspace exposure 0. Edge cases: title rename, duplicate concepts, deleted/archived workspace, user leaves membership, one source has no embedding, and concurrent accept/hide; the last action is evented with idempotency key. Backfill canonical keys/embeddings asynchronously, flag at owner-only beta, then expand after hide rate <5%.

Decision: links are user-owned bilateral records, not `EdgeModel`, because `EdgeModel.workspace_id` encodes one graph and cross-tenant graph edges would violate deletion/ACL semantics. Alternate global concept catalog is deferred until ontology governance exists.

## Research questions answered

1. **Can RLS help?** Yes, policies restrict rows for normal reads/writes, but application RBAC remains necessary ([PostgreSQL](https://www.postgresql.org/docs/17/ddl-rowsecurity.html)).
2. **Does an embedding prove identity?** No; similarity supplies candidates, not a semantic guarantee.
3. **Should shared workspaces be included by default?** No; owner/user consent must be explicit.
4. **Can target content be returned to explain a match?** No; return a redacted rationale/title only after authorization.
5. **Is a global uniqueness constraint on name valid?** No; homonyms and contexts exist.
6. **How do filtered ANN queries behave?** benchmark iterative HNSW scanning because filtering can reduce returned results ([pgvector](https://github.com/pgvector/pgvector#filtering)).
7. **What if access changes after suggestion?** Re-authorize on click and return 404, not 403 details.
8. **Why log views?** Security audit and relevance measurement, with retention policy.

## Tickets, verification, DoD

**XWS-1 schema/RBAC:** migration and service candidate query. AC: only mutually opted-in, readable workspaces appear; pair uniqueness holds; delete/membership revoke removes links. Tests `uv run pytest apps/api/tests/test_cross_workspace_links.py`.

**XWS-2 UI/navigation:** card and API client using `@/lib/urls`. AC: no raw URL construction, hide persists, focus/live announcement works. Test `pnpm --filter @graphmind/web vitest run src/components/chat/__tests__/cross-workspace-links.test.tsx`.

**XWS-3 quality:** labelled matcher eval, audit logs, feature flag. AC: ≥.95 precision on fixture and zero content leak tests. Run `uv run ruff check apps/api/src apps/api/tests && uv run mypy apps/api/src && pnpm --filter @graphmind/web build`.

DoD: migration reversible, consent copy approved, authorization tested for owner/member/revoked user, accessibility and telemetry verified, and flag rollback tested.

## Sources

[PostgreSQL Row Security](https://www.postgresql.org/docs/17/ddl-rowsecurity.html) · [pgvector multitenancy/filtering](https://github.com/pgvector/pgvector#filtering) · [OWASP API Top 10](https://api-security.owasp.org/editions/2023/en/0x00-header/) · [MDN keyboard accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility/Guides/Understanding_WCAG/Keyboard)

## Edge-case matrix and rollout

| Condition | Behaviour | Test |
|---|---|---|
| target membership revoked | hide/404 target at read and click | `test_revoked_target_is_not_exposed` |
| homonym/low score | return no link, retain no target title | `test_homonym_is_rejected` |
| source/target same concept | reject self-pair | `test_self_pair_rejected` |
| concurrent accept/hide | idempotent latest event, unique pair | `test_pair_action_is_idempotent` |
| deleted workspace | cascade links/preference, no leak | `test_workspace_delete_cascades_links` |

No backfill of consent. Add canonical keys lazily, then throttle embedding repair. Ship database then owner-only opt-in flag, 1/10/50/100% with precision/hide-rate gate. Disabling `cross_workspace_links_enabled` hides results and blocks creation but preserves user-owned links; no destructive rollback.

## Expanded Jira execution cards

### XWS-1 — consent/link schema and authorized matching API

**Objective:** create bilateral, same-user links without a global concept graph. **Dependencies:** `WorkspaceMember`, mastery concepts, SemanticService. **Create:** `models/cross_workspace.py`, `schemas/cross_workspace.py`, `services/concept_identity_service.py`, `routers/cross_workspace.py`, migration `apps/api/alembic/versions/20260921_0015_add_cross_workspace_links.py`, `tests/test_cross_workspace_links.py`. **Modify:** `models/workspace.py`, `models/user.py`, `models/__init__.py`, `main.py`.

1. Add preference `(workspace_id,user_id,cross_workspace_enabled)` unique constraint and link fields with ordered source/target check plus unique `(user_id,source_concept_id,target_concept_id)`.
2. Create Alembic upgrade/downgrade/indexes for `(user_id,canonical_key)`; do not enable PostgreSQL RLS until request DB identity design is approved.
3. Resolve candidate workspace IDs from membership and consent before any concept/title query.
4. Normalize/casefold labels, retrieve embeddings only within those IDs, require threshold plus deterministic descriptions; return uncertain as no match.
5. Reauthorize both endpoints in GET/accept/hide, record immutable action and return target metadata only after passing checks.
6. Test ownership/member/revoked/foreign UUID/homonym/cascade cases.

**Acceptance criteria:** (a) consent false yields no candidate; (b) inaccessible title/content is never serialized; (c) self pair impossible; (d) repeated accept creates one pair; (e) user delete removes preference/links. **Commands:** `uv run pytest apps/api/tests/test_cross_workspace_links.py`; `uv run ruff check apps/api/src apps/api/tests`; `uv run mypy apps/api/src`. **Rollback:** disable API flag; retain consent records and links.

### XWS-2 — link card and canonical navigation

**Objective:** explain and navigate a permitted link without raw cross-workspace data. **Dependencies:** XWS-1. **Create:** `lib/crossWorkspaceApi.ts`, `components/chat/CrossWorkspaceLinks.tsx`, `components/chat/__tests__/cross-workspace-links.test.tsx`. **Modify:** `MasteryPanel.tsx`, `FocusDrawer.tsx`, `apps/web/src/lib/urls.ts` only if helper missing.

1. Define strict redacted target type and fetch only for selected source concept.
2. Render workspace/title/reason with `Badge` and Button controls; no preview of target body.
3. Make View use URL helper/router after server-provided authorized chat/node route data.
4. Add hide confirmation and optimistic removal with retry error recovery.
5. Implement loading/empty/revoked state that says unavailable without target identity.
6. Test keyboard focus, dark tokens, router helper call and hide persistence.

**Acceptance criteria:** (a) no raw `/w/` string; (b) revoked link never names target; (c) keyboard opens/hides; (d) error does not keep stale private card. **Commands:** `pnpm --filter @graphmind/web vitest run src/components/chat/__tests__/cross-workspace-links.test.tsx`; `pnpm --filter @graphmind/web build`. **Rollback:** hide component with feature flag; links remain private data.

### XWS-3 — matcher evaluation and audit operations

**Objective:** maintain precision and prove no access leak. **Dependencies:** XWS-1/2. **Create:** `tests/evals/cross_workspace_pairs.json`, `tests/test_cross_workspace_evals.py`, audit dashboard/runbook. **Modify:** identity service metrics/config.

1. Label same, distinct, homonym, consent-off and revoked candidate fixtures.
2. Score precision/false-positive leakage, fail test if any prohibited target field is returned.
3. Emit opaque audit events for view/accept/hide/access denial; exclude labels/content.
4. Alert on hide spike, authorization exception and matcher latency; document re-index repair.
5. Review opt-in beta weekly before percentage expansion.

**Acceptance criteria:** (a) ≥.95 precision; (b) zero unauthorized serialization; (c) audit event has actor/link/time; (d) rollback flag tested. **Commands:** `uv run pytest apps/api/tests/test_cross_workspace_evals.py`; backend lint/type checks; web build. **Rollback:** disable flag, do not batch-delete user links.
