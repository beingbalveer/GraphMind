# Learning Studio course workspace — completed 2026-10-15

The prototype now separates the outer learning app from a course workspace. The outer app contains Home, My learning, Browse, Create, and settings; a legacy Personal chats entry appears only when retained personal chats exist. Opening a public roadmap or enrollment enters a course context with a persistent course rail, complete topic outline, progress, and course conversations. The roadmap switches between List and Canvas over the same ordered topics. Guests can read a public snapshot and browse either roadmap view; private progress and conversation actions gate and resume the same course/topic after sign-in.

Course identity is persisted independently from the selected topic. Public guest state uses `public:<roadmapId>` and its published snapshot; private course views, layouts, tutor conversations, general chats, and branches use enrollment identity. Generated copies therefore remain isolated when they share a source template. Course chat lists filter by the active enrollment. Personal historical chats have a distinct outer view. Topic tutor history opens beside the lesson; topic branches replace the tutor pane, keep the lesson centered, support parent/sibling/nested navigation, and can expand into the center while preserving the course rail.

## Verification

- Frontend and prototype TypeScript checks — passed with the bundled Node 24 runtime.
- Full frontend Vitest run — 425 tests passed across 81 files (`vitest run --maxWorkers=1 --minWorkers=1 --retry=1`).
- `pnpm --filter @graphmind/web prototype:build` — passed; Vite reported existing upstream `"use client"`/sourcemap and large-bundle warnings.
- Isolated Next.js production build — passed with existing production lint warnings in a temporary copy with the existing dependencies. The build needed network access for its existing Google Fonts fetch; it did not change production source or the running preview.
- `git diff --check` — passed.

Manual browser QA covered:

- Opening an enrollment enters its complete Roadmap; Browse and Create remain in the outer app.
- List and Canvas contain the same topics and completion marks. Selecting a canvas topic opens its lesson.
- A fresh public canvas fits its content; Fit, dragging, and minimap work. A dragged node and its zoom/viewport retain identical visible bounds after refresh.
- Topic tutor reply → branch → nested branch stays beside the same lesson. Expanding preserves course navigation; Return to lesson restores the lesson.
- Explicit Ask tutor actions return to the topic's main tutor history. Hiding and reopening the pane preserves the selected branch, including mobile drawer close/reopen.
- An independent course chat can send a sample question, branch, open its branch in the center, and return to the course directory. Search finds nested branches; clear and rename work.
- Switching between the frontend enrollment and SQL enrollment does not expose the other course's conversations or progress.
- A guest reads SQL topic 2 and demo sign-in returns to SQL topic 2 in its private learning copy.
- Phone layout at 390×844 supports navigation and branch expansion. At 1280×500 the branch composer remains within the window; long quote/history headers scroll. Light and dark appearances were inspected, then the original light appearance was restored.

The browser walkthrough preserved the existing topic draft and completion state. Generated copies sharing a template are covered by automated identity/scope tests; no claim of a manual two-generated-copy walkthrough is made.

Focused coverage exercises course view/layout identity, startup viewport preservation, cross-enrollment chat rejection on restore, guest sign-in return to the same topic, same-course topic branching, root tutor selection from a branch, and the right-side course branch pane filtering out personal threads. Existing coverage continues to exercise selected-text validation, nested branch origins, stop/retry, interrupted-response recovery, progress, generated-copy identity, and course-specific tutor histories.

## Production migration direction

This change stays inside `apps/web/prototype`; it does not add routes, change auth, call backend APIs, or alter canonical GraphMind URLs. In production, keep the outer app as the account/collection/catalog shell and represent a course by its authorized enrollment/workspace identity. Public course reads must resolve to immutable published snapshots. Learner layouts and progress must be authorized by enrollment; tutor sessions and course general chats must be authorized by the same workspace. A branch from a tutor reply must persist its parent node, source message, validated selected quote, and topic association under that workspace's canonical chat root. The local `public:<roadmapId>` key is only a guest snapshot scope and must never be accepted as a private resource identifier.

The repository's current roadmap job, curriculum, auth, chat, and workspace routes remain the integration boundary documented in [BACKEND_HANDOFF.md](../../apps/web/prototype/BACKEND_HANDOFF.md). Any separate persistence endpoint for a course roadmap layout remains a proposed API contract until the production owner approves and implements it. Existing `/w/{workspaceId}/chat/{chatId}` and canvas route semantics remain unchanged.
