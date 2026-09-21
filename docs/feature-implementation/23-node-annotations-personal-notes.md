# Node Annotation and Personal Notes Implementation Plan

> Agentic-worker sub-skill note: maintain checked work. - [ ] private schema/API - [ ] editor/list UI - [ ] privacy/retention ops

**Goal:** preserve a learner’s private notes, insights and confusion independently from AI content.  
**Architecture:** author-scoped normalized annotation records → RBAC API → node/focus-drawer UI.  
**Tech Stack:** FastAPI/SQLAlchemy/Alembic/Postgres, Next.js/TypeScript.  
**Spec:** `docs/FEATURE_RESEARCH.md §6.2`.

## Global Constraints

Use `AGENTS.md` workflow, canonical URL helpers, provider abstraction (only opt-in note attachment), Alembic and strict author/workspace RBAC. Build with shared primitives/tokens for dark mode and accessible focus/labels; never embed/index/send private annotation bodies by default or use raw navigation APIs.

## Status and purpose

**Status: not built.** Nodes retain AI/user content and generic JSON metadata only; `FocusDrawer`, `ChatMessage`, and canvas have no annotation UI/data model, highlights, personal-insight/confusion/mastery types or personal visibility boundary. Goal: a learner can add/edit/delete a personal note, insight, confusion flag, or self-assessed mastery mark linked to a node, preserving their words independently from AI content. Non-goals: collaborative comments, automatic AI reading of notes, rich-document editing, or treating a mastery mark as verified mastery.

## UX

Node menu/Focusing drawer → **Add note** selects type and opens labelled textarea with character counter/save/cancel. Node shows an icon/count; drawer lists annotations in time order, type label and “private to you.” The author can edit/delete; a confusion flag offers “Ask a clarifying question” but does not auto-call the model. A mastery mark shows “self-assessed”; it is not merged into `ConceptModel.mastery_level`. Use `Textarea`, `Button`, `Badge`, `ConfirmDialog`; focus returns to invoking control and text never relies on icon/color alone.

## Model/API/files

Create `NodeAnnotationModel(id,workspace_id,node_id,author_id,kind(note|insight|confusion|self_mastery),body,created_at,updated_at,deleted_at)` and `AnnotationRevisionModel` only if audit/history product requirement is approved; default soft-delete 30-day restore. Add migration, `models/workspace.py`, `models/__init__.py`, `schemas/annotations.py`, `services/annotation_service.py`, `routers/annotations.py`, main. Frontend creates `lib/annotationApi.ts`, `components/annotations/AnnotationList.tsx`, `AnnotationEditor.tsx`; modify `FocusDrawer.tsx`, `ChatMessage.tsx`, `ThreadGraphNode.tsx`, `GraphCanvas.tsx`. APIs: list/create `.../nodes/{nid}/annotations`, patch/delete `.../annotations/{id}`. Events `annotation_created/updated/deleted`; only `confusion_created` optionally prioritizes planner after user consent.

## Privacy/security/reliability

Annotations are author-private even in a shared workspace—queries require both workspace read and `author_id == current_user`; do not include body in canvas bulk response, exports, embeddings, AI prompts, semantic index, or staff telemetry. This is explicit because object ID manipulation is a BOLA risk ([OWASP](https://api-security.owasp.org/editions/2023/en/0x00-header/)). Enforce size/type validation, HTML/Markdown sanitization, CSRF/auth pattern used by API, per-user rate limits, structured logs with IDs only, deletion/export. Cache counts only, invalidate after write; p95 list <150ms. Edge cases: deleted node/workspace, membership revoke, duplicate offline save (ETag/updated_at conflict UI), empty body, concurrent edit, restored note. Rollout private notes flag, migration has no backfill, audit abusive text only through opt-in report workflow.

Decision: normalized table rather than metadata JSON supports author ACL, indexing, pagination, retention and counts. Preserve notes outside the AI prompt by default; user may explicitly attach one to a future prompt. Notes promote generative learning, but personal text is not a mastery signal.

## Research questions answered

1. **Are annotations shared by workspace membership?** No; default personal privacy is safer.
2. **Should self-marked mastery change heatmap?** No; label as self-assessment until independent evidence.
3. **Can annotation text be embedded?** No; that violates the intended privacy boundary.
4. **Why normalized row?** ACL/lifecycle/query needs exceed JSON metadata.
5. **Can conflicting edits overwrite silently?** No; use version/ETag conflict resolution (HTTP conditional semantics support lost-update prevention [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110)).
6. **Do notes replace retrieval practice?** No; retrieval has stronger evidence for retention ([Karpicke & Blunt](https://pubmed.ncbi.nlm.nih.gov/21252317/)).
7. **How keyboard accessible?** Native textarea/buttons, labelled errors, focus return.
8. **What event is emitted?** IDs/type only; body remains private.

## Jira tickets and DoD

1. **ANN-101 backend:** migration/models/service/router with author ACL/versioning. AC: member cannot list/read another author’s note, patch conflict returns 409, soft delete removes from list. `uv run pytest apps/api/tests/test_annotation_service.py apps/api/tests/test_annotation_endpoints.py`.
2. **ANN-102 UI:** editor/list/count/status integrations. AC: create/edit/delete/focus restoration work; self-mastery has text label. `pnpm --filter @graphmind/web vitest run src/components/annotations/__tests__/annotation-editor.test.tsx`.
3. **ANN-103 privacy/ops:** export/delete, log scan, caching metrics/flag. AC: annotation body absent from semantic/LLM payload fixtures. Run `uv run ruff check apps/api/src apps/api/tests && uv run mypy apps/api/src && pnpm --filter @graphmind/web build`.

DoD: privacy boundary documented/tested, retention/export works, XSS/authorization/conflict/accessibility tests pass, and feature rollback only hides UI—not data loss.

## Sources

[OWASP API Top 10](https://api-security.owasp.org/editions/2023/en/0x00-header/) · [RFC 9110 conditional requests](https://www.rfc-editor.org/rfc/rfc9110) · [Retrieval practice](https://pubmed.ncbi.nlm.nih.gov/21252317/) · [MDN keyboard accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility/Guides/Understanding_WCAG/Keyboard)

## Execution addendum: edge cases, rollout, tickets

| Condition | Behaviour | Test |
|---|---|---|
| foreign annotation ID | 404/no body | `test_author_isolation` |
| concurrent edit | 409 version conflict | `test_annotation_etag_conflict` |
| deleted node | soft note hidden/cascade policy | `test_deleted_node_annotation` |
| offline duplicate save | one record by UUID | `test_create_idempotent` |
| XSS markdown | sanitize/no script | `test_annotation_sanitization` |

No backfill. `personal_annotations_enabled` internal→10→100% after ACL/XSS/error gates. Off hides editor/list, never sends note bodies to embeddings/model and preserves private data.

### ANN-101 implementation card

**Objective:** private normalized annotations with conflict safety. **Dependencies:** user/workspace/node RBAC. **Create:** `models/annotation.py`, `schemas/annotations.py`, `services/annotation_service.py`, `routers/annotations.py`, migration `apps/api/alembic/versions/20260921_0023_add_node_annotations.py`, `apps/api/tests/test_annotation_service.py`, `apps/api/tests/test_annotation_endpoints.py`. **Modify:** `models/workspace.py`, `models/__init__.py`, `main.py`.

1. Add author/node/workspace/kind/body/version/deleted fields and author/node indexes. 2. Migrate additive. 3. Enforce author plus workspace RBAC on all actions. 4. sanitize/size/type validate. 5. PATCH with `If-Match`/409. 6. soft delete/export and ID-only events.

**Acceptance:** foreign user cannot read/list/edit; body excluded from semantic/LLM payload; conflict non-destructive; self-mastery not concept mastery; deletion works. **Commands:** `uv run pytest apps/api/tests/test_annotation_service.py apps/api/tests/test_annotation_endpoints.py && uv run ruff check apps/api/src apps/api/tests && uv run mypy apps/api/src`. **Rollback:** flag off, retain data.

### ANN-102 implementation card

**Objective:** accessible note editor/list/count. **Dependencies:** ANN-101. **Create:** `lib/annotationApi.ts`, `components/annotations/AnnotationList.tsx`, `AnnotationEditor.tsx`, tests. **Modify:** `FocusDrawer.tsx`, `ChatMessage.tsx`, `ThreadGraphNode.tsx`, `GraphCanvas.tsx`.

1. Add typed API. 2. Use Textarea/Modal/ConfirmDialog. 3. Render private type labels/count. 4. Edit/delete UUID/version. 5. Return focus/live errors. 6. test no color-only/keyboard/dark.

**Acceptance:** editor uses primitives; private label clear; error/retry works; no raw navigation. **Commands:** `pnpm --filter @graphmind/web vitest run src/components/annotations/__tests__/annotation-editor.test.tsx && pnpm --filter @graphmind/web build`. **Rollback:** hide UI.

### ANN-103 implementation card

**Objective:** privacy retention/export operations. **Dependencies:** ANN-101/102. **Create:** privacy tests/runbook. **Modify:** export/delete job/log filters.

1. Verify body log redaction. 2. Exclude embeddings/prompts. 3. implement export/delete. 4. add retention purge. 5. audit ACL metrics.

**Acceptance:** export author-only; purge works; audit contains no body; flag drill passes. **Commands:** `uv run pytest apps/api/tests/test_annotation_privacy.py`; full lint/type/build. **Rollback:** disable purge until review.

## Implementation handoff checks

1. Scope list query by `author_id` in SQL, not post-filtered Python.
2. Use HTML sanitization before render and a safe Markdown subset if enabled.
3. Reject empty/whitespace-only annotation body.
4. Cap body length and page list results.
5. Return `ETag`/version on GET/list detail used by PATCH.
6. Make delete idempotent for the original author only.
7. Count endpoint returns numbers only, never preview text.
8. Ensure workspace export excludes annotations unless explicitly selected by author.
9. Ensure account deletion removes note/revision rows and caches.
10. Do not include notes in `SemanticService.compute_and_save_node_embedding` inputs.
11. Do not append notes to default Chat/agent lineage prompts.
12. Test audit logs contain IDs/kind but not `body`.
