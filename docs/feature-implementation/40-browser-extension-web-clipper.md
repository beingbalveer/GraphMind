# Browser Extension Web Clipper Implementation Plan

**Spec:** `docs/FEATURE_RESEARCH.md §10.3`  
**Agentic-worker sub-skill checklist:** `[ ]` read plan/AGENTS.md; `[ ]` inspect extension/security contracts; `[ ]` threat-model capture; `[ ]` implement tickets in order; `[ ]` run browser/API tests; `[ ]` request review.  
**Goal:** with one explicit user gesture, clip a bounded selection or page-derived outline into an authorized private GraphMind workspace with source provenance and a review-before-create flow.  
**Architecture:** Manifest V3 Chrome extension (portable browser-adapter boundary) with active-tab content capture, service worker, OAuth PKCE, popup/side-panel confirmation, and a GraphMind capture/job API; graph extraction is a server-side proposal job, never automatic remote-page browsing by an LLM.  
**Tech stack:** Chrome Extensions Manifest V3/TypeScript/Vitest/Playwright, FastAPI/Pydantic/SQLAlchemy/Alembic/PostgreSQL/Redis, existing file/RAG/roadmap services and ai-core behind API.  
**Global constraints:** Follow AGENTS.md approval/verify/commit workflow; preserve URL_DESIGN and `@/lib/urls`; use ai-core for all provider calls; Alembic for persistent schema; RBAC every endpoint; semantic UI primitives/tokens/dark mode for web app; keyboard/focus/accessibility across extension UI; no broad surveillance permissions or dead controls.

## Status/current implementation evidence

No browser-extension package, capture schema, extension OAuth, page extraction policy, source-reference model, clip review screen, or roadmap-from-page job exists. `FileService`/RAG handle uploaded files; `exportUtils.ts` is unrelated browser download code. Workspace auth is cookie-based browser app auth, not extension auth. `NodeModel.metadata_payload` can label source but should not become an unbounded provenance/permission bag.

## Scope/non-goals, stories and UX flows

Scope v1: Chrome/Chromium selection clip; source URL/title/retrieved time; private workspace selection; explicit preview; optional “extract outline/roadmap” asynchronous proposal; canonical source-node handoff. A learner highlights a paragraph → context menu “Add selection to GraphMind” → popup opens with exact text/URL/title and destination picker → confirms → sees success/Open. From the toolbar on the active tab they may choose “Generate roadmap from this page” → see a preview job/status → approve proposed nodes before creation.

Non-goals: always-on page reading, browser history collection, background scraping, cross-origin credential capture, automatically submitting pages to an LLM, copying DRM/paywalled content, native mobile browser support, Firefox/Safari launch, or public sharing. Clipper must work only when a tab is active and user clicked a command; it must not inject persistent scripts across all sites merely to observe selection.

Chrome’s [permission declaration documentation](https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions) says permissions/host intent must be declared; the [permissions API](https://developer.chrome.com/docs/extensions/reference/api/permissions) supports optional host access requests. Start with `activeTab`, `contextMenus`, `storage`, `identity` or web PKCE, and no `<all_urls>` host permission. `activeTab` grants temporary active-tab access after user invocation; optional host permission is requested only if a future feature genuinely needs it. Chrome’s [storage guidance](https://developer.chrome.com/docs/extensions/develop/concepts/storage-and-cookies) notes extension storage is persistent across browsing-data clearing, so do not store clip text, tokens, or raw pages there.

## Architecture/data flow/API/types

The context-menu click sends an explicit message to a programmatically injected content function that returns only `{selectionText,title,url,canonicalUrl?,language,selectionRect?}`. Service worker validates scheme (`http/https` only, deny `chrome:`, `file:`, internal pages), normalizes URL/removes known tracking query params while retaining original URL evidence, truncates client selection (12k chars), scans locally for obvious secrets, opens confirmation UI, then posts a capture.

Reuse generalized source reference from feature 10.2 with `kind='web'`: `id,node_id,canonical_url,origin_hash,display_title,content_sha256,captured_at,excerpt_length,license_hint?,metadata`. Add `WebClipCreateInput {content,title,url,canonicalUrl?,selectionKind:'selection'|'page_outline',workspaceId,clientCaptureId}` and `WebClipResponse {captureId,nodeId,chatId,reviewRequired,jobId?}`. `POST /workspaces/{id}/captures/web` validates bearer public-client auth, workspace write role, URL/length/HTML-free content/idempotency; writes a private source node/reference. `POST /.../web-clip-jobs` only accepts a user-confirmed source capture, queues extractor with source bytes/canonical URL; `GET /.../web-clip-jobs/{id}` returns proposed concept/roadmap JSON; `POST /.../accept` uses the same confirm-before-node-creation rule. Do **not** have API refetch arbitrary user URLs for v1; this prevents SSRF/copyright drift and ensures the reviewed source is exactly what is processed.

Types in `packages/shared/src/index.ts`: `WebClip`, `WebClipJob`, `WebClipProposal`, `ClipSourceReference`; all use ISO timestamps/opaque IDs and no extension-local filesystem information. Events: `clip.requested`, `clip.blocked`, `clip.created`, `clip.proposal_ready`, `clip.accepted`, `clip.failed`; attributes include byte bucket, URL host hash, outcome/version/duration—never URL path, content, title, token or user selection.

## Exact repository files

**Create extension:** `apps/browser-extension/package.json`, `tsconfig.json`, `vite.config.ts`, `manifest.json`, `src/service-worker.ts`, `src/content/captureSelection.ts`, `src/popup/App.tsx`, `src/popup/ConfirmClip.tsx`, `src/options/Options.tsx`, `src/auth/pkce.ts`, `src/api/client.ts`, `src/lib/redact.ts`, `src/__tests__/capture.test.ts`, `src/__tests__/permission.test.ts`, `README.md`.

**Create API:** `apps/api/alembic/versions/20260921_0040_add_web_clips.py`, `apps/api/src/models/web_clip.py`, `schemas/web_clip.py`, `services/web_clip_service.py`, `services/web_clip_job_service.py`, `routers/web_clips.py`, `tests/test_web_clips.py`, `tests/test_web_clip_jobs.py`, `tests/test_web_clip_security.py`. **Modify:** Feature 10.2's `apps/api/src/models/capture.py` to add the web source kind/relationship; Feature 10.2 is a hard dependency and this plan has no alternate competing capture model.

**Create web review:** `apps/web/src/lib/webClipApi.ts`, `apps/web/src/components/workspace/WebClipProposalModal.tsx`, `apps/web/src/components/workspace/__tests__/web-clip-proposal.test.tsx`.

**Modify:** root `pnpm-workspace.yaml`/CI, API `models/__init__.py`, `models/workspace.py`, `main.py`, `dependencies.py`/auth public-client registration, `services/workspace_service.py`, `services/roadmap_service.py`, `services/file_service.py` only for shared extraction adapters, `packages/shared/src/index.ts`, dashboard/source node UI and `lib/urls.ts` where source deep linking needs helper. Do not change existing browser auth redirects to service the extension.

## Privacy, security, copyright, abuse, accessibility

The extension must visibly show the exact selection, destination and origin before network transmission. Default source scope is selection, never full page; show and let users edit title/excerpt; strip/avoid cookies, DOM forms, hidden text, page session data and page scripts. Add content security policy, no `eval`, strict message sender/tab validation, `externally_connectable` absent unless later required, HTTPS allowlist to GraphMind API, PKCE/state/nonce, tokens in `chrome.storage.session` where possible (or encrypted extension storage backed by user reauth, not `local`), logout/wipe, and no capture retries that expose content to another account. Follow OWASP [authorization guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) server-side; extension permissions never substitute for RBAC.

Maintain provenance/citation: source URL, title, capture timestamp and user-selected excerpt. Ask user to confirm they have rights to save/import material; preserve link/attribution; impose source/output caps; never rehost an entire fetched article. Sanitize all page-derived text and disallow HTML/script/event handlers. Rate-limit clips/jobs, apply quotas and moderation for malicious content. Provide one clear report/delete route for captured data.

Popup must be keyboard usable with semantic form labels, an Escape cancel, focus order/return to browser page, visible focus/high contrast, 24px+ (prefer 44px) targets, no information by colour alone and a reduced-motion setting. Context menu remains pointer based, but toolbar/keyboard command offer an equivalent. Use native extension UI where possible; no inaccessible canvas.

## Edge-case matrix

| Condition | Required response | Exact test |
|---|---|---|
| no selected text | menu disabled; toolbar explains/select text action | `capture.test.ts:emptySelection` |
| `chrome://`, file, PDF viewer, extension page | do not inject/read; display supported-site reason | `test_disallowed_scheme` |
| selection exceeds cap | show character count and truncate only after explicit confirm; server caps too | `test_clip_size_limit` |
| page contains token/private key | local warning/block; no API request | `test_redact_secret` |
| tracker-heavy URL | normalize only known tracking params; display original/canonical | `test_url_normalization` |
| expired/revoked auth | prompt reauth; keep clip only in-memory until user re-confirms | `test_auth_resume` |
| workspace is viewer/deleted | server 403/404, refresh picker, do not leak workspace data | `test_rbac_and_deleted_workspace` |
| duplicate click/retry | same client UUID yields existing capture once | `test_clip_idempotency` |
| job extraction fails | source clip survives, job shows retry, no partial graph nodes | `test_job_failure_no_mutation` |
| malicious page prompt injection | extraction treats clip as quoted data; schema/evidence validator rejects instructions | `test_prompt_injection_fixture` |

## Performance/reliability/observability

No service-worker wakeup does capture; activation occurs only command/click. Selection extraction limits DOM text/cost and runs under 50ms for cap-size text. Clip API P95 <500ms; proposal job is queued/status-polling with exponential backoff. All state-changing calls include idempotency key; jobs have `queued|running|ready|failed|cancelled`, one active job per clip/option hash, retry only transient failures, and terminal failure preserves source. Emit the typed events above and traces with request IDs; dashboards track permission prompts, clip confirmation/conversion, blocked-secret/scheme counts, RBAC failures, job latency/success, provider schema failure, cost and delete requests—never titles/content/URL paths.

## Rollout, migration, backfill, rollback

Flags: `browser_clipper_v1`, `browser_clipper_roadmap_jobs`. Deploy additive generic capture migration/API behind false flags, internal unpacked-extension test, security review, 1% allowlisted Chrome users, 10%, then public Chrome store release after store/privacy review. Start selection clips only; enable outline job after red-team/evals. No historical web capture or URL fetching backfill. Disable both flags to hide popup actions/API routes; revoke extension OAuth client/grants if compromised. Keep source rows for account-controlled deletion; use forward migrations after beta rather than destructive rollback.

## Jira tickets — implementation-ready

### EXT-1031 — MV3 shell and least-privilege capture

**Objective:** create a signed/testable extension that can read one user-selected text range only after a command. **Dependencies:** Chrome target/browser review, IDE capture identity design if generic auth is shared. **Create:** all extension scaffold/content/service-worker/redaction/tests listed above. **Modify:** pnpm workspace/CI.

1. Define MV3 manifest with `activeTab`, `contextMenus`, `storage`, strict CSP and `host_permissions: []`; create menu/toolbar/optional keyboard command.
2. Register context menu and on-click handler; reject tab/url before `chrome.scripting.executeScript`.
3. Implement pure DOM selection extractor returning text/title/location only; cap/normalize and test it independently.
4. Implement local secret heuristics that stop before message/API call and native confirmation popup.
5. Add build/lint/test/package scripts and manual permission-prompt verification.

Acceptance: (a) manifest has no `<all_urls>`; (b) no content script runs until user action; (c) unsupported scheme reads zero page data; (d) no raw selection enters extension storage/logs; (e) command/popup works keyboard-only. Commands: `pnpm --filter @graphmind/browser-extension test`, `pnpm --filter @graphmind/browser-extension build`, `pnpm --filter @graphmind/browser-extension package`.

### EXT-1032 — Extension authentication and destination consent

**Objective:** attach the clip only to an account/workspace the user explicitly authorizes. **Dependencies:** EXT-1031 and extension public-client OAuth decision. **Create:** PKCE/auth/client/options tests. **Modify:** API auth client registration.

1. Implement PKCE verifier/challenge/state/nonce and browser auth launch; validate callback before code exchange.
2. Store only tokens in session/secure storage; expose account/logout and clear all clip state on account switch.
3. Fetch authorized workspaces/roles; require a user pick each first use and identify read-only options.
4. Render confirmation of source, text length, destination and terms; cancel removes in-memory payload.
5. Implement auth expiry/revoke and retry from confirmation—not automatic background replay.

Acceptance: (a) no secret/token in manifest/source/local storage; (b) state mismatch denied; (c) destination must be confirmed; (d) viewer cannot submit; (e) logout wipes credentials/pending clip. Tests: `auth/pkce.test.ts`, `permission.test.ts`; run extension test command.

### API-1032 — Capture and proposal-job service

**Objective:** enforce server authorization/provenance and create no graph content before confirmation. **Dependencies:** EXT-1032 and Feature 10.2/API-1022 generic capture model. **Create:** `apps/api/alembic/versions/20260921_0040_add_web_clips.py`, `apps/api/src/models/web_clip.py`, `apps/api/src/schemas/web_clip.py`, `apps/api/src/services/web_clip_service.py`, `apps/api/src/services/web_clip_job_service.py`, `apps/api/src/routers/web_clips.py`, `apps/api/tests/test_web_clips.py`, `apps/api/tests/test_web_clip_jobs.py`, `apps/api/tests/test_web_clip_security.py`. **Modify:** `apps/api/src/models/capture.py`, `apps/api/src/models/__init__.py`, `apps/api/src/models/workspace.py`, `apps/api/src/main.py`, `apps/api/src/dependencies.py`, `apps/api/src/services/workspace_service.py`, `apps/api/src/services/roadmap_service.py`, `packages/shared/src/index.ts`.

1. Write additive capture/source/job schema with foreign keys, `client_capture_id` uniqueness, status/check constraints and retention timestamps in Alembic.
2. Validate content, URL protocol/size, title length, no HTML, ID format, feature flag and `require_workspace_write` before persistence.
3. Transactionally create source node/reference and map idempotent repeats to same response.
4. Queue outline job only from a confirmed capture; isolate raw clip as data, use strict structured output and validate proposed refs/source attribution.
5. Implement accept/cancel/status endpoints so only accept calls roadmap/node services; add telemetry/errors/RBAC tests.

Acceptance: (a) cross-workspace/viewer capture fails before write; (b) exact retry writes one node; (c) failed job produces no graph nodes; (d) malformed/XSS/oversize input is rejected; (e) accept creates only reviewed proposals. Run `uv run pytest apps/api/tests/test_web_clips.py apps/api/tests/test_web_clip_jobs.py apps/api/tests/test_web_clip_security.py`, `uv run ruff check apps/api`, `uv run mypy apps/api/src`.

### WEB-1033 — Proposal review, AI evaluation and release controls

**Objective:** give learners an accessible, safe review before graph changes and make operational rollback real. **Dependencies:** API-1032, existing RoadmapModal patterns. **Create:** web API/modal tests, job eval fixtures, dashboard/runbook. **Modify:** dashboard/source UI, roadmap integration, flags/CI.

1. Build a modal with source attribution, outline/proposed nodes, per-item include/exclude, accept/cancel and status/error/retry using shared primitives.
2. Ensure source/source node link uses canonical URL helper and browser popup only shows success after source persistence.
3. Assemble fixtures for prompt injection, duplicate concepts, unsupported claims, copyrighted-long content, malformed provider JSON and unrelated page content.
4. Gate job enablement on schema validity, attribution coverage, no tool-call/mutation before accept, red-team pass and cost/latency budgets.
5. Exercise flags, Chrome profiles and deletion/rollback runbook; store manual accessibility/security evidence.

Acceptance: (a) every proposal has visible source/decision; (b) cancel leaves no graph mutation; (c) keyboard/screen-reader flow passes; (d) bad AI output becomes a failed job, not a node; (e) disabling flag blocks new capture/jobs safely. Commands: `pnpm --filter @graphmind/web test`, `pnpm --filter @graphmind/web build`, all API and extension commands above.

## Definition of Done

The MV3 package requests only active-tab capabilities, transmits no page content before clear consent, uses public-client auth and server-side RBAC, stores private clipped material with attribution and deletion, never automatically turns untrusted page text into graph changes, survives retry/job failure without duplicates, verifies accessibility/security/AI quality, and has tested flags/migration/rollback controls.

## Research questions answered

1. **Do we need `<all_urls>`?** No; `activeTab` permits command-triggered current-tab access without continuous global access.
2. **Should a content script run permanently?** No; inject/capture only after explicit action.
3. **Can the extension save arbitrary page HTML?** No; v1 saves a bounded plain-text selection only.
4. **Can an LLM fetch the page by URL?** No; process the confirmed captured bytes to avoid SSRF/content drift.
5. **Should it store tokens or clips in `chrome.storage.local`?** No; storage is persistent; keep tokens in secure/session storage and clips in memory until submit.
6. **How are page-derived roadmaps safe?** Queue proposal, strict schema/evidence validation, then human accept.
7. **Can extension permission replace GraphMind auth?** No; API RBAC independently verifies the account/workspace.
8. **What does provenance include?** Source URL/title/time/hash/excerpt length and attribution, never cookies/hidden DOM.

Sources: [Chrome permission declaration](https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions), [Chrome permissions API](https://developer.chrome.com/docs/extensions/reference/api/permissions), [Chrome storage and cookies](https://developer.chrome.com/docs/extensions/develop/concepts/storage-and-cookies), [OWASP authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html), [OpenAI structured outputs](https://platform.openai.com/docs/guides/structured-outputs), [WCAG 2.2](https://www.w3.org/TR/WCAG22/).
