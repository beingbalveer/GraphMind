# Import & Export Ecosystem Implementation Plan

**Spec:** `docs/FEATURE_RESEARCH.md §7.5`  
**Agentic-worker sub-skill checklist:** `[ ]` read plan/AGENTS.md; `[ ]` threat-model adapters; `[ ]` implement tickets in sequence; `[ ]` run hostile-input tests; `[ ]` render-verify artifacts; `[ ]` request review.  
**Goal:** safe, attributed movement of a learner’s authorized sources and knowledge snapshots.  
**Architecture:** durable import/export jobs, SSRF-safe adapters, review-before-create, snapshot exporters.  
**Tech stack:** FastAPI/SQLAlchemy/Alembic/PostgreSQL/Redis, existing file/RAG services, Next.js/TypeScript.  
**Global constraints:** Follow AGENTS.md; preserve URL_DESIGN with central helpers; provider calls only via ai-core; migrations with Alembic; workspace RBAC on every resource; semantic primitives/tokens/dark mode; WCAG keyboard/focus/error status; no dead UI.

**Status:** partial export only. `apps/web/src/lib/exportUtils.ts` downloads Graph JSON and Obsidian-style Markdown from an in-memory tree. File ingestion already supports PDF/code/tabular assets through `routers/files.py` and `file_service.py`; there is no URL/article/README import job, study-guide PDF, Mermaid export, or Anki `.apkg` export.

## Goal and non-goals

Let an authorized learner bring a permitted source (upload, article URL, YouTube URL, GitHub README) into a workspace as traceable source material and export **their** graph as Markdown, JSON, Mermaid, PDF study guide, or interoperable flashcards. Every import/export is explicit, scoped to one workspace, cancellable, provenance-labelled, and auditable. It is not a general web scraper, DRM/copyright bypasser, background crawler, or export of another member's private workspace.

## UX and architecture

`ImportExportModal` uses existing `Modal`, `Input`, `Button`, and `ConfirmDialog`: choose source → rights/preview → import mode (source library only or proposed roadmap) → review extracted concepts → create. URL jobs display status and source URL; failure offers retry or save source only. Export starts from workspace actions, offers format/selection and a data preview, then produces a signed short-lived download. The canvas import controls have keyboard/pointer parity and no dead buttons.

Create an asynchronous `ImportExportJob` ledger: `id, workspace_id, requester_id, kind, status, source_url?, source_file_id?, options JSONB, output_file_id?, failure_code?, created_at, expires_at`. `ImportService` validates URL and file ownership, fetches only HTTP(S) via a SSRF-safe egress client (DNS/IP revalidation; deny loopback/private/link-local, redirects revalidated, content/byte/time caps), parses in a worker, stores a source file plus immutable provenance, proposes nodes, and requires explicit create. `ExportService` builds a snapshot at request time, writes an owned generated file, and deletes after TTL. Reuse `WorkspaceFile`/RAG pipeline; never let an LLM fetch arbitrary URLs.

## Contracts/files

Create migration `apps/api/alembic/versions/20260921_0030_add_import_export_jobs.py`, `models/import_export.py`, `schemas/import_export.py`, `services/import_service.py`, `services/export_service.py`, `routers/import_export.py`, `tests/test_import_export_service.py`, `tests/test_import_export_endpoints.py`, `apps/web/src/lib/importExportApi.ts`, `components/workspace/ImportExportModal.tsx`, and `components/workspace/__tests__/import-export-modal.test.tsx`. Modify `models/__init__.py`, `main.py`, `routers/files.py`, `services/file_service.py`, `components/layout/WorkspaceShell.tsx`, `components/canvas/GraphCanvas.tsx`, `lib/exportUtils.ts`, and `packages/shared/src/index.ts`. API: `POST /workspaces/{id}/imports`, `GET|DELETE /.../import-export-jobs/{job_id}`, `POST /workspaces/{id}/exports`; read/write authorization applies respectively, and response includes opaque job id/status—not storage path. Use `GET /.../exports/{job}/download` with a one-time signed URL.

For Anki, generate standard CSV first in v1 and `.apkg` only through a maintained, tested package with a reproducible version; Anki's [export documentation](https://docs.ankiweb.net/exporting.html) distinguishes collection/package exports, so do not reverse-engineer an archive format. Mermaid output escapes label text and provides plain Markdown fallback. PDF uses the repository's PDF render/verify workflow when implemented.

## Security, accessibility, operations

Apply OWASP [file-upload guidance](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html): allowlist content, verify bytes not extension/MIME alone, random server names, size/quota/AV scan, non-executable object storage. Require user confirmation that they may import the URL/content; retain only source/attribution fields necessary for provenance. Strip scripts/trackers, preserve copyright attribution/link, avoid redistributing full paywalled content. Rate-limit jobs per user/workspace; queue idempotency key; quarantine parser failures; status poll/backoff; emit `import.requested/completed/failed` and `export.*` with bytes/duration/error only. Provide progress text plus not-colour-only status and accessible downloads.

## Edge cases, rollout, metrics

Reject SSRF, unsupported MIME, invalid YouTube/private GitHub URLs, password-protected PDFs, redirect loops, oversized pages, no extractable text, and URL content changing mid-job (record fetch timestamp/hash). Duplicate import dedupes on normalized URL/content hash with “import again” override. Roll out format-by-format: existing Markdown/JSON refactor → PDF/Mermaid → uploads → URL import → optional `.apkg`; migration is additive; existing exports remain working. Metrics: job success by source/format, P95 parse/export latency, queue age, rejected-SSRF rate, output download rate, parser crash count, and support tickets.

## Tickets, acceptance and tests

1. **API-751 Job/provenance schema** — migration, ownership, lifecycle and TTL cleanup. Accept: cross-workspace job lookup is 404; cancellation is safe/idempotent.
2. **API-752 Secure import pipeline** — egress policy, parser adapters, review-only proposals. Accept: private IP/redirect tests fail closed and no graph nodes are created before confirmation.
3. **API-753 Snapshot exporters** — Markdown/JSON regression parity, Mermaid/PDF/Anki adapters. Accept: emitted Mermaid parses; exports contain only chosen workspace data.
4. **WEB-751 Accessible modal/status** — no raw input controls, keyboard/retry/cancel/download support. Accept: screen-reader names/status and error recovery pass.
5. **QA-751** — run `uv run pytest apps/api/tests/test_import_export*.py`, `uv run ruff check apps/api`, `uv run mypy apps/api/src`, `pnpm --filter @graphmind/web test`, `pnpm --filter @graphmind/web build`; add fixture tests for hostile files/URLs and render PDF QA.

Definition of Done: all artifacts retain provenance, sandbox/SSRF/authorization tests pass, output is deterministic for a snapshot, every shown action works, and retention/expiry is documented.

## Research questions answered

1. **Should import create nodes immediately?** No; preview and explicit confirmation prevent polluted graphs.
2. **Can a URL fetch private infrastructure?** Never; enforce SSRF egress/DNS/redirect checks.
3. **Trust browser MIME?** No; inspect content server-side.
4. **Export live mutable data?** No; export a timestamped snapshot.
5. **Is `.apkg` a hand-built zip?** No; use a maintained format library or ship CSV first.
6. **Can any member export?** Only users with workspace read/export authorization; default owner/editor policy is explicit.
7. **How is source credited?** Store canonical URL, retrieval time/hash and show attribution.
8. **Why jobs rather than request threads?** Extraction/rendering needs cancellation, retries, progress and bounded web-request latency.

Sources: [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html), [Anki exporting](https://docs.ankiweb.net/exporting.html), [FastAPI background tasks caveats](https://fastapi.tiangolo.com/tutorial/background-tasks/), [GraphMind architecture](../ARCHITECTURE.md).

## Detailed ticket execution

### API-751 — durable job/provenance foundation

**Objective:** model auditable asynchronous work before adapters. **Create:** migration/model/schema/router/job tests. **Modify:** model exports/main/file relationships. **Dependencies:** workspace/file service. **Flag/rollback:** `import_export_jobs_v1`; disable creation and drain/cancel queued jobs.

1. Create `import_export_jobs` with FK, status/check constraint, option JSON, idempotency key, TTL and indexes `(workspace,status,created_at)`.
2. Define request/status schemas with source kind enum and a 64-character idempotency key.
3. Check owner/editor write access and source file ownership in every job creator/get/delete query.
4. Add state machine guards `queued→running→ready|failed|cancelled`; cancellation is idempotent and blocks output attachment.
5. Write upgrade/downgrade, cleanup task and audit telemetry.

Acceptance: (1) other workspace job is 404; (2) duplicate request yields same job; (3) invalid transition rejects; (4) expired output cannot download; (5) cancellation has no orphan object. Tests `test_import_export_jobs.py`, `test_job_authorization.py`; run `uv run pytest apps/api/tests/test_import_export_jobs.py apps/api/tests/test_job_authorization.py`.

### API-752 — secure import adapters

**Objective:** turn authorized source into reviewable proposal safely. **Create:** import service/SSRF/parser tests. **Modify:** files/file service. **Dependencies:** API-751 and worker queue. **Rollback:** disable URL source type; retain upload/export.

1. Allowlist source type/scheme/content size/time, resolve DNS and reject private/loopback/link-local IP before and after redirects.
2. Verify server bytes/magic/MIME, randomize storage name and send scanner/quarantine result through job status.
3. Parse bounded plain text; sanitize/strip active content; record original/canonical URL/hash/retrieval time.
4. Extract concepts into proposal JSON only; require user accept endpoint before graph persistence.
5. Rate-limit and test redirect chains, zip bombs, PDF password, bad MIME and parser crash.

Acceptance: (1) SSRF never connects; (2) hostile upload never becomes executable/download-served inline; (3) no proposal auto-creates nodes; (4) source provenance shown; (5) retry is safe. Run `uv run pytest apps/api/tests/test_import_export_security.py apps/api/tests/test_import_service.py`.

### API-753/WEB-751/QA-751 — export, UI and release

**Objective:** deliver deterministic formats and clear progress/error. **Create:** exporter adapters/modal/API/Vitest/PDF render tests. **Modify:** export utils, dashboard/canvas actions. **Dependencies:** API-751 and PDF/doc skill verification for generated PDF. **Rollback:** disable individual format flags.

1. Refactor current Markdown/JSON into server snapshot serializers with fixture-parity hashes.
2. Add Mermaid escaping/parse test, PDF renderer visual QA and Anki CSV before optional maintained `.apkg` adapter.
3. Build modal using shared primitives, source rights confirmation, accessible job status/retry/cancel/download.
4. Use one-time signed output download; test wrong user/expired URL/format failure.
5. Ramp format flags and monitor parser/export success/cost/storage TTL.

Acceptance: (1) exports contain selected workspace only; (2) output snapshot is reproducible; (3) modal is keyboard/screen-reader/dark-mode usable; (4) cancel/error has recovery; (5) all new actions do work. Run `uv run pytest apps/api/tests/test_import_export*.py`, `pnpm --filter @graphmind/web test`, `pnpm --filter @graphmind/web build`.

## Edge-case/rollout/backfill matrix

| Case | Handling | Test |
|---|---|---|
| SSRF redirect | revalidate each hop | `test_redirect_ssrf` |
| duplicate URL | hash/dedupe, explicit import-again | `test_duplicate_source` |
| content changes | store hash/retrieval timestamp | `test_provenance_hash` |
| worker dies | lease/retry then fail with retry UI | `test_job_recovery` |
| export expires | one-time/TTL URL rejects | `test_expired_download` |
| unsupported format | no visible unsupported button | `import-export-modal.test.tsx` |

Roll out existing format refactor first, then each adapter behind individual flags. Existing in-browser exports remain until server parity passes; no import backfill. Rollback disables format/source, retains job audit/output cleanup data without destructive migration.
