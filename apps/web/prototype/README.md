# Learning studio local preview

Standalone React + Vite prototype for a public roadmap catalog and course-scoped learning workspace. It runs without Next.js, authentication middleware, or backend APIs. Authentication and generation actions are simulated locally.

From the repository root:

```sh
pnpm dev:prototype
```

Open `http://127.0.0.1:3400`. The outer app offers Home, My learning, Browse, Create, and account settings. Opening a roadmap enters its course workspace: a persistent course rail holds the full outline and progress, and the roadmap has List and Canvas views over the same topics. Guests can read the public snapshot and use both roadmap views. Private progress and conversations open the simulated sign-in gate; signing in from a public lesson creates or resumes its learner copy and returns to the same course and topic. No credentials are requested. Versioned learner preferences, per-enrollment progress, layouts, conversations, drafts, quotes, and reading positions persist in this browser's local storage. Guest course layouts use a public snapshot scope; Reset demo clears local preview state.

Course conversations and New chat stay inside the active enrollment. Topic tutor histories appear in the course rail and open beside the lesson. Branches replace the tutor pane while leaving the lesson visible; their ancestry, siblings, and nested children remain navigable, and an expanded branch fills the center while retaining the course rail. General chats open in the center. Legacy personal historical chats have a separate outer Personal chats view, shown only when such chats already exist. Branch creation validates that selected text belongs to the chosen tutor reply; sibling branches remain available. The thread tree, titles, drafts, stop/retry state, and interrupted-response recovery persist locally.

The goal-first generator reviews the submitted profile, supports a scripted clarification and failure case, and shows progressive local job status before creating a separate sample enrollment. It requires an explicit fixed curriculum; arbitrary lesson generation and research are not performed. Settings make display name, theme, reading size, motion, study-time, and tutor-style preferences observable. Export/reset are local demo actions. No credentials, model keys, email, or billing information are collected. Tutor replies remain scripted examples. External references link to relevant official documentation and local notes are labeled as sample content.

Build with `pnpm --filter @graphmind/web prototype:build`; typecheck with `pnpm --filter @graphmind/web prototype:typecheck`; run focused state and render journeys with `pnpm --filter @graphmind/web prototype:test`.

See [BACKEND_HANDOFF.md](./BACKEND_HANDOFF.md) for state ownership, access boundaries, existing API mappings, and proposed production endpoints/contracts. The prototype does not modify production routes, auth, middleware, theme, or API behavior. [Course workspace verification](../../../docs/quality/learning-studio-course-workspace-2026-10-14.md) records focused checks and the migration direction.
