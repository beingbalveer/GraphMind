# Shared canvas verification — 2026-10-07

The approved shared canvas is implemented on `codex/roadmap-generator`.
The separate Roadmap Generator remains the next delivery.

## Verified behavior

Stable conversation segments and nested source origins, measured spine layout,
semantic light/dark cards, fit/pan/zoom/drag, advanced mastery/timeline controls,
branch confirmation, authenticated revision-checked layout storage, and recovery
of pending moves across navigation and offline refresh. Old message coordinates
and workspace viewport fields remain unchanged.

Browser checks used existing conversations without editing or deleting messages.
Test drags were restored through Auto layout. Real cancel does not change selection.

## Verification

- Focused backend: 13 passed (layout/RBAC/database guard).
- Shared tree utilities: 16 passed.
- Final canvas, persistence and adjacent learning/theme tests: 42 passed.
- Frontend typecheck; changed-module ruff/strict mypy; isolated Next production build: passed.
- Separate `graphmind_migration_test`: pre-canvas metadata bootstrap, upgrade/downgrade/upgrade; composite primary key and checks verified.
- Fresh whole-plan reviewer identified pending-draft loss on unmount; reproducing tests failed, then passed after the queue/draft recovery fix. No deferred minor findings.

The full repository suite is not globally green. API regression: 109 passed,
2 existing fixtures omit required owner_id. Full Node20 frontend: 260 passed,
6 failed (existing breadcrumb/flashcard failures plus timing-sensitive menu,
tooltip and canvas confirmation tests). Canvas confirmation event routing was
subsequently corrected and the entire focused 42-test gate passed. These are
recorded failures, not passing checks. Builds use isolated output to preserve
live `.next`; tests connect only to explicit guarded disposable databases.

## Implementation decisions and their costs

- Ruling: Native managed worktree cannot be written under this session sandbox; archived untouched worktree and use the requested codex/roadmap-generator branch in the writable checkout — all edits remain off main; cost if wrong: dev server reflects branch edits during development.
- Task 1: Ruling: Docker is absent, installed Postgres.app will supply a dedicated local *_test database or temporary cluster — same isolation contract; cost if wrong: local test setup requires explicit connection troubleshooting.
- Task 1: Ruling: Use UV_CACHE_DIR=/tmp/graphmind-uv-cache and uv run --no-sync because default uv cache is sandbox-restricted; installed dependencies are already present — cost if wrong: stale dependency environment would fail verification explicitly.
- Task 1: Ruling: Guard also checks PostgreSQL driver and cached engine URL to prevent malformed/non-Postgres/stale app configuration from bypassing isolation — same safety boundary; cost if wrong: non-Postgres test setups are rejected.
- Task 1: Ruling: Continue past recorded pre-existing baseline failures under user instruction to approve routine decisions automatically; do not loosen production owner constraints or hide failing tests — cost if wrong: unrelated baseline failures remain visible until relevant remediation.
- Task 2: Ruling: Export filterConversationByTime from conversationProjection and reuse it in legacy treeToGraph; this is needed before new renderer migration to preserve undated evidence and ancestor chains — cost if wrong: replay includes undated context rather than silently dropping it.
- Task 3: Ruling: Browser comparison of new card/dark palette occurs in Task 4 when the shared renderer first mounts; avoid a disposable product route solely for an unintegrated primitive — cost if wrong: visual adjustment may be needed during integration before shipping.
- Task 4: Ruling: Timeline has a separate ephemeral layout; read-only replay must never discard manual live positions. API-null mastery/timeline responses surface an error, not invented empty results — cost if wrong: extra local replay state/reset logic needs regression coverage.
- Task 4: Ruling: Existing app exposes no active theme toggle; dark visual QA renders real CanvasCard components with compiled CSS in a standalone artifact, alongside numeric contrast tests. Do not add an unrelated theme-settings feature — cost if wrong: full app dark activation remains outside this change.
- Task 4: Ruling: Use foreground-muted for 10px metadata on milestone surfaces: existing subtle role failed 4.5:1 in both themes; approved secondary palette improves readability without changing palette values — cost if wrong: metadata is slightly stronger than the illustrative preview.
- Task 5: Ruling: Extend the hook with ready/loadError/conflict/reload in addition to planned return fields — hydration and 409 recovery cannot safely be expressed through saveState alone — cost if wrong: a small additive hook API to maintain.
- Task 5: Ruling: Use PostgreSQL ON CONFLICT DO NOTHING for concurrent first saves, retaining atomic CAS for updates — avoids aborting the request transaction on expected first-write races — cost if wrong: PostgreSQL-specific insert implementation, already required stack.
- Task 5: Ruling: Keep mastery scores in original normalized 0–1 units in the compatibility renderer and show optional primary concept in the advanced badge — full regression exposed loss of existing mastery evidence; cost if wrong: optional badge carries one additional concept label.
- Task 5: Ruling: Expand existing static theme scan to cover shared canvas primitives and their semantic canvas roles/delegation — old scan did not recognize the new shared surface tokens — cost if wrong: source scan remains a heuristic, backed by real dark card and numeric contrast checks.
- Final: Ruling: Browser coordinate-only draft cache complements server persistence for abrupt page unload; use conflict-aware base revisions and size-bounded keepalive — HTTP debounce alone cannot survive navigation/unload — cost if wrong: local storage may be unavailable, leaving only best-effort server flush for abrupt unload.
- Final: Ruling: Use direct pointer-down/click events for canvas menu integration tests instead of repeated userEvent sequences — full-suite load caused timing-sensitive framework timeouts, while real menu/confirm/cancel behavior was verified in browser — cost if wrong: synthetic tests do not reproduce every pointer gesture; shared primitive tests still exercise keyboard/focus.
- Final: Ruling: Roadmap generator remains future work and is deliberately absent from this canvas release — it is the next linked plan — cost if wrong: user waits for remaining approved generator tasks.
- Final: Ruling: Existing missing-owner API fixtures and unrelated frontend breadcrumb/flashcard/menu/tooltip failures remain recorded baseline issues; no production invariants weakened — cost if wrong: full repository suite is not globally green despite green canvas gates.
- Final: Ruling: Global theme toggle remains outside scope; semantic dark tokens, real-card dark snapshot and contrast tests establish canvas dark styling — cost if wrong: app-wide theme activation remains an existing limitation.
- Final: Ruling: Branch integration/finishing is deferred until both linked plans are implemented; keep requested feature branch and continue under automatic routine approvals — no merge/push authorized — cost if wrong: branch remains local while the larger feature proceeds.
