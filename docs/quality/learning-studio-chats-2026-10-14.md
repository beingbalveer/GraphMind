# Learning studio Chats and branches — 2026-10-14

## Implemented prototype behavior

The learner navigation exposes **Chats** independently of lesson selection. Its recent list combines existing enrollment/topic tutor histories with general chats and branch threads. Search keeps matching branches visible with their ancestor path; users can create chats, rename them, reopen them after refresh, and expand or collapse nested branches. General chats are scoped to the active enrollment when one is open, otherwise to a clearly labeled personal workspace. A general chat is not implicitly turned into a lesson session.

Conversation panes show workspace/topic context and branch ancestry. Selecting assistant text creates a child branch with stable thread ID, parent thread, source message, quote, and inherited workspace/topic context. A child can open as the main conversation beside its parent, and nested branches remain available in the tree. At mobile widths, the thread list and branch pane use drawers. Lesson-history rows link back to the existing lesson tutor, so the prototype continues using its current enrollment/topic history rather than copying it into a second message store.

Local scripted replies support a single active stream, stop, error, and retry. Leaving Chats, changing active conversation, closing a child pane, signing out, and unmounting stop pending timers. Drafts and branch trees persist in the existing `graphmind-studio-v2` store. Restore sanitizes malformed records, resolves branches independent of saved array order, and marks an unfinished stream retryable. Learner state remains hidden in guest mode and lesson progress stays separate from chat state.

## Verification performed

Using the bundled Node 24 runtime at `/Users/balveer/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node`:

- Prototype typecheck and final full frontend TypeScript check passed; final log: `/private/tmp/graphmind-chats-typecheck-ship.log`.
- Final full frontend Vitest run passed: 80 files, 414 tests, including 50 prototype tests across seven files. Used serial workers and `--retry=1`; final log: `/private/tmp/graphmind-chats-vitest-ship.log`. The log does not identify individual retry attempts.
- Final Vite prototype build passed: `/private/tmp/graphmind-chats-build-ship.log`. It retains non-blocking client-directive/sourcemap and bundle-size warnings.
- Isolated production Next.js build passed in `/private/tmp/graphmind-chats-next-a_0g0drc`, log `/private/tmp/graphmind-chats-next-final.log`. Production source was unchanged. The subsequent prototype-only mobile peek fix was verified by the final TypeScript, Vite, Vitest, and browser checks above.
- Added persistence coverage for reverse-ordered nested branches, stale/cross-workspace/non-tutor origins, interrupted stream recovery, late output after sign-out, and stop → retry → complete → refresh without a stale retry error.
- Added rendered journey coverage for projecting existing lesson history, returning to the lesson tutor, capturing selected assistant text as branch context, displaying nested ancestry, and preventing a covering parent drawer when opening a full mobile thread.
- Retry reuses the stopped assistant message ID; its regression checks one tutor response for the question and preserved branch source/quote identity.
- Independent read-only source review found no blocking issue within this static Chats scope. `git diff --check` passed.

Manual browser QA at 1440×960 and 390×844 verified visible Chats navigation, general chat creation, root/branch rename, nested branches and breadcrumbs, search retaining ancestor paths, empty-search feedback and clearing, selected-text branching (the quote contained only the selected word), existing lesson-history continuation, draft refresh recovery, midstream refresh/retry, stop/retry in the child pane, mobile Escape pausing a branch response, New chat closing its list drawer, full-thread navigation without a covering drawer, guest privacy, returning learner history, and light/dark rendering. Completed retries remain completed after refresh. Document width matched the viewport at both sizes.

Screenshots: `/private/tmp/graphmind-chats-desktop.png`, `/private/tmp/graphmind-chats-desktop-dark.png`, `/private/tmp/graphmind-chats-mobile.png`, and `/private/tmp/graphmind-chats-mobile-full.png`. All browser checks use local scripted replies and simulated authentication; they do not verify real provider or production authorization behavior.

## Backend boundary and migration direction

The user-selected sequence is to finish this prototype, wire it to the existing backend contracts, then replace the older UI only after a feature-parity gate. Existing canonical URLs in `docs/URL_DESIGN.md` remain unchanged. The handoff maps the prototype to existing chat root/list, graph, node, rename, stream, and topic-session APIs and distinguishes a branch thread ID from a production chat root ID. No production source, APIs, auth, or persistence schema were changed in this task.

Before retiring the older UI, parity work remains for canvas, files/attachments, learning actions and flashcards, roadmap revision workflows, provider/workspace management, plus any production gaps found while wiring the current chat and lesson-session contracts. This prototype is a static local experience and is not evidence that the old UI is ready for removal.
