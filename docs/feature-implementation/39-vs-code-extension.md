# VS Code Extension Implementation Plan

**Spec:** `docs/FEATURE_RESEARCH.md §10.2`  
**Agentic-worker sub-skill checklist:** `[ ]` read plan/AGENTS.md; `[ ]` prototype VS Code contract; `[ ]` complete auth threat model; `[ ]` implement tickets in order; `[ ]` run extension/API tests; `[ ]` request review.  
**Goal:** from an explicit editor selection, create a private GraphMind explanation node with minimal source context and a safe deep link.  
**Architecture:** separate `apps/vscode-extension` client using VS Code commands/context contributions and GraphMind OAuth device/PKCE authorization; API accepts a bounded capture DTO and creates a provenance-labelled node through existing services.  
**Tech stack:** VS Code Extension API/TypeScript/esbuild/Vitest, FastAPI/Pydantic/SQLAlchemy/Alembic, Next.js deep links; no provider SDK in extension.  
**Global constraints:** Obey AGENTS.md approval/verify/commit workflow; retain URL_DESIGN and central helpers; model providers stay behind ai-core; durable DB changes use Alembic; every capture endpoint applies RBAC; product UI uses semantic primitives/tokens/dark mode; extension and web UI require keyboard/focus/accessibility support; no mock/dead commands.

## Status/current evidence

There is no `apps/vscode-extension` package, no extension manifest, OAuth device flow, capture schema, source-location model, or API. Existing `NodeModel` has `content`, metadata JSON and workspace ownership; `WorkspaceService` creates nodes. `apiClient.ts` uses browser HttpOnly cookies, which a desktop extension cannot reuse. The request must not send a developer’s whole repository or background editor contents.

## Scope/non-goals/user flow

Scope: a selected range/context-menu command **Explain in GraphMind**, workspace selection, preview of exactly what will be sent, capture creation, progress/error, and “Open in GraphMind.” The user selects code, invokes command, signs in once, chooses an authorised workspace, sees file display name/language/line range and truncated selection, confirms, then opens `buildNodeUrl` in browser after server returns node id. Non-goals: running code, reading all files, sending repo telemetry, modifying the editor, persistent sync, IDE chat panel, proprietary settings leak, or arbitrary machine path upload.

VS Code's official [commands guide](https://code.visualstudio.com/api/extension-guides/command) and [contribution points](https://code.visualstudio.com/api/references/contribution-points) support commands and `editor/context` menus; command/menu enablement must use `editorHasSelection`/language conditions. Context menus pass the selected document/line context, so only read selection after user invokes the command. Use a native `window.showInformationMessage`/QuickPick for simple confirmation; reserve a webview only if the future rich preview actually needs it, because webviews have separate security context.

## Data/API/auth contract

Add `NodeSourceReference` (separate table, not overloaded JSON indefinitely): `id,node_id,kind='vscode',origin_hash,display_path,language,start_line,start_column,end_line,end_column,content_sha256,created_at`. `origin_hash = SHA-256(normalized workspace URI host/root salt)` is optional for dedupe and must not permit recovery of local path. `display_path` defaults to basename or user-approved repo-relative path; absolute local paths are forbidden. `CaptureCreateInput`:

```json
{"workspaceId":"ws","content":"<=12000 chars","language":"typescript","displayPath":"src/x.ts","range":{"startLine":10,"startColumn":2,"endLine":25,"endColumn":1},"titleHint":"optional <=120","clientCaptureId":"uuid"}
```

`POST /workspaces/{workspace_id}/captures/vscode` verifies token/user, workspace write role, max bytes/rate limits/schema, then transactionally creates a user capture node with metadata `{source:'vscode', status:'pending_explanation'}` and source reference; it returns `{nodeId, chatId, captureId}`. Explanation launches through the existing chat/node creation path only after capture confirmation; v1 may create the source node then route browser to a prefixed prompt, rather than duplicate streaming semantics. Unique `(user_id,client_capture_id)` makes retries safe. Add OAuth 2.1 Authorization Code + PKCE loopback/device flow issued for extension public clients; access tokens go in VS Code `SecretStorage`, never settings/globalState/plain logs. No client secret in extension.

## Exact files

**Create:** `apps/vscode-extension/package.json`, `tsconfig.json`, `esbuild.js`, `src/extension.ts`, `src/auth.ts`, `src/api.ts`, `src/capture.ts`, `src/workspacePicker.ts`, `src/__tests__/capture.test.ts`, `README.md`; `apps/api/alembic/versions/20260921_0039_add_vscode_captures.py`, `src/models/capture.py`, `schemas/capture.py`, `services/capture_service.py`, `routers/captures.py`, `tests/test_vscode_captures.py`, `tests/test_capture_authorization.py`.

**Modify:** root `pnpm-workspace.yaml`, `package.json` scripts/CI, `apps/api/src/models/__init__.py`, `models/workspace.py` relationships, `main.py`, `services/workspace_service.py`, `routers/auth.py`/`auth_service.py` to register public extension OAuth client, `packages/shared/src/index.ts`, `apps/web/src/lib/urls.ts` only if a dedicated source link is introduced. Do not modify editor code or reuse browser `apiClient.ts` in the extension.

## Privacy/security/abuse/accessibility

The preview is the consent boundary: show exact characters/count, path redaction, selected workspace, and “GraphMind will store this selection.” Default cap 12k chars/64KiB; reject binary, secrets detected by conservative patterns, private keys/tokens, and unsupported `untitled:`/remote URI unless user exports text explicitly. Allow a user to disable line/path storage. TLS only, PKCE state/nonce validation, secure token rotation/revocation/logout, no unrestricted CORS, no absolute path, no raw code in telemetry. Rate-limit capture and explanation separately; audit capture id, bytes, outcome, not content. OWASP's [OAuth guidance](https://cheatsheetseries.owasp.org/cheatsheets/OAuth2_Cheat_Sheet.html) supports PKCE/state protections for public clients.

Use VS Code native commands/QuickPick for keyboard/screen-reader parity; a contributed command needs a clear title and only appears/enables for selection. Respect VS Code theme/icons; no custom inaccessible webview. The companion browser link uses `vscode.env.openExternal` with a server-generated canonical HTTPS URL, not `file:`/arbitrary callback URLs.

## Edge-case matrix

| Condition | Handling | Test |
|---|---|---|
| no selection | command hidden/disabled; explain why in command palette | `capture.test.ts` |
| 100k selection | preview offers truncate/cancel; server hard rejects over cap | `test_capture_size_limit` |
| secret-like selection | block with local warning; do not upload/log | `test_secret_rejection` |
| expired auth | refresh interactively; preserve unsent capture in memory only | `test_refresh_and_retry` |
| viewer workspace | picker marks read-only; server returns 403 | `test_capture_viewer_forbidden` |
| duplicate click/network retry | same client UUID returns original node | `test_capture_idempotency` |
| remote/untitled document | omit path/deny unsafe URI, require explicit text capture | `test_unsafe_uri` |
| workspace deleted after picker | return 404 and reload picker, no leaked title | `test_missing_workspace` |

## Performance/reliability/observability

Extension activation is `onCommand`, no file watcher; bundle/minimize dependencies; selection validation runs locally in <10ms. Server P95 capture <500ms excluding optional AI stream. Use request timeout/retry only for safe idempotent capture; one response drives deep-link opening. Emit `ide.capture.requested|blocked|created|failed` with language, byte bucket, outcome and trace id. Monitor auth failure, secret block false positives, capture success, duplicate rate, latency, token refresh failure, and privacy complaints; never source text/path.

## Rollout/migration/backfill/rollback

Add migration/API behind `vscode_capture_v1`; publish internal VSIX signed/reviewed; test on macOS/Windows/Linux and remote workspaces; private marketplace pilot; then Open VSX/Marketplace after privacy/security review. No historical code backfill. Disable flag to return 404 and hide command; revoke OAuth client grants if compromise; retain existing private captures but allow deletion. Downgrade migration only before production data; later forward-fix and delete according to retention policy.

## Jira tickets — implementation-ready

### IDE-1021 — Extension scaffold and accessible command

**Objective:** create a lean, non-networked VS Code command shell. **Dependencies:** decision to publish extension, Node toolchain. **Create:** all extension scaffold files and capture unit test. **Modify:** pnpm/CI scripts.

1. Add package manifest with `engines.vscode`, `activationEvents:onCommand:graphmind.explainSelection`, command and `editor/context` contribution with `editorHasSelection` `when` clause.
2. Configure esbuild output and TypeScript strict/no implicit any; add lint/test scripts and VSIX packaging validation.
3. Register command; get `window.activeTextEditor`, reject missing/binary/oversize/unsafe scheme before any network call.
4. Build native confirmation/QuickPick flow and cancellation handling; do not add webview.
5. Add tests for command registration, range calculation, cap and cancellation; document manual VS Code command palette test.

Acceptance: (a) command only acts after explicit invocation; (b) no file watcher/host permission; (c) selection/path never logged; (d) command works keyboard-only; (e) `vsce package` succeeds. Commands: `pnpm --filter @graphmind/vscode-extension test`, `pnpm --filter @graphmind/vscode-extension package`.

### IDE-1022 — Public-client authentication and workspace picker

**Objective:** authorize the extension without browser cookies or shipped secrets. **Dependencies:** IDE-1021, auth owner approval. **Create:** `auth.ts`, picker tests. **Modify:** auth service/router OAuth configuration.

1. Register extension redirect/device identifiers and allowed scopes (`workspace:read`, `workspace:write`) server-side.
2. Implement PKCE verifier/challenge/state/nonce and external browser authorization; validate callback host/state before exchanging code.
3. Store refresh token only in `context.secrets`; store non-sensitive workspace selection in workspace state keyed by account.
4. Fetch authorized workspace list; label viewer role unavailable and require user selection, never default to a guessed workspace.
5. Implement logout/revoke and refresh error recovery.

Acceptance: (a) no client secret appears in VSIX/source/settings; (b) state mismatch rejects; (c) token is SecretStorage-only; (d) viewer cannot select capture; (e) logout removes credentials. Tests: `auth.test.ts`, `apps/api/tests/test_extension_oauth.py`; commands `pnpm --filter @graphmind/vscode-extension test`, `uv run pytest apps/api/tests/test_extension_oauth.py`.

### API-1022 — Capture persistence and RBAC endpoint

**Objective:** persist minimal provenance and safely create one source node. **Dependencies:** IDE-1022, existing workspace service. **Create:** `apps/api/alembic/versions/20260921_0039_add_vscode_captures.py`, `apps/api/src/models/capture.py`, `apps/api/src/schemas/capture.py`, `apps/api/src/services/capture_service.py`, `apps/api/src/routers/captures.py`, `apps/api/tests/test_vscode_captures.py`, `apps/api/tests/test_capture_authorization.py`. **Modify:** `apps/api/src/services/workspace_service.py`, `apps/api/src/models/__init__.py`, `apps/api/src/models/workspace.py`, `apps/api/src/main.py`.

1. Write upgrade/downgrade for source-reference table/indexes and add relationship with cascade policy.
2. Define bounded Pydantic payload and normalize/display-path validation; reject NUL/binary/absolute path/secrets.
3. Implement RBAC ownership lookup and idempotent transaction; write source reference and node metadata only after validation.
4. Return typed canonical IDs, with no DB storage path/local URI in response.
5. Add structured logs/feature flag/rate limiter and OpenAPI docs.

Acceptance: (a) cross-workspace and viewer attempts fail; (b) duplicate UUID creates one node; (c) malformed/binary/secret input never persists; (d) source path is never absolute; (e) migration tests upgrade/downgrade. Run `uv run pytest apps/api/tests/test_vscode_captures.py apps/api/tests/test_capture_authorization.py`, `uv run ruff check apps/api`, `uv run mypy apps/api/src`.

### IDE-1023 — Explain handoff, privacy QA and release

**Objective:** connect capture result to existing GraphMind learning flow and operate safely. **Dependencies:** IDE-1021/1022/API-1022, URL helper. **Create:** `apps/vscode-extension/src/__tests__/capture-integration.test.ts`, `apps/vscode-extension/src/__tests__/privacy.test.ts`, `docs/runbooks/vscode-extension-release.md`. **Modify:** `apps/vscode-extension/src/capture.ts`, `apps/vscode-extension/src/api.ts`, `.github/workflows/ci.yml`.

1. On success create canonical `buildNodeUrl` path server/client-side and open it only after confirmation.
2. Offer “Copy link”/“Open GraphMind”; handle browser unavailable without losing stored node.
3. Test offline, expired auth, duplicate request and revoked workspace via mock server.
4. Perform secret scanner fixture/red-team and manual VoiceOver/NVDA/VS Code theme check.
5. Stage VSIX pilot/telemetry dashboard and document flag/client revoke rollback.

Acceptance: (a) handoff URL is canonical; (b) no source text is telemetry; (c) retries are idempotent; (d) native UI works in dark/high-contrast theme; (e) rollback hides command and disables API. Run all above plus `pnpm --filter @graphmind/vscode-extension test` and `pnpm --filter @graphmind/web build`.

## Definition of Done

The extension sends only user-confirmed bounded selection, uses public-client OAuth safely, verifies workspace write permission server-side, stores auditable but minimal provenance, provides canonical browser handoff, has tested secret/URI/retry/accessibility paths, and passes all package/API/extension commands before flagged rollout.

## Research questions answered

1. **Can the command access selection through a context menu?** Yes; VS Code supports editor context command contributions, but invoke only after user action.
2. **Should a webview be default?** No; native QuickPick is safer/accessibly cheaper for this simple confirmation.
3. **Can extension reuse HttpOnly cookies?** No; it needs an extension public-client OAuth flow.
4. **Can it store tokens in settings?** No; use VS Code SecretStorage.
5. **Should absolute paths be stored?** No; basename/approved relative path only.
6. **Can it upload whole files/repositories?** No; selected bounded text only.
7. **How handle duplicate click?** Client UUID plus server uniqueness/idempotency.
8. **Can a viewer capture?** No; server enforces workspace write role.

Sources: [VS Code commands](https://code.visualstudio.com/api/extension-guides/command), [VS Code contribution points](https://code.visualstudio.com/api/references/contribution-points), [VS Code extension capabilities](https://code.visualstudio.com/api/extension-capabilities/common-capabilities), [OWASP OAuth2](https://cheatsheetseries.owasp.org/cheatsheets/OAuth2_Cheat_Sheet.html), [GraphMind URL design](../URL_DESIGN.md).
