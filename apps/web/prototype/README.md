# Learning studio local preview

Standalone React + Vite prototype for a public roadmap catalog and learner flow. It runs without Next.js, authentication middleware, or backend APIs. Authentication and generation actions are simulated locally.

From the repository root:

```sh
pnpm dev:prototype
```

Open `http://127.0.0.1:3400`. Browse three seeded roadmaps as a guest, follow the 12-lesson Python outline, and try 18 deterministic practice activities with hints and retries. The preview also includes a searchable source library, in-context note previews, lesson-scoped tutor drafts, and a collection that resumes at the last unfinished lesson. Saving, tracking progress, asking the tutor, and creating a roadmap open a simulated sign-in dialog. Continuing enters a local demo learner; no credentials are requested. Versioned learner preferences, progress, conversations, drafts, and reading positions persist in this browser's local storage. Guest mode hides learner data; Reset demo clears it.

The goal-first generator reviews the submitted profile, supports a scripted clarification and failure case, and shows progressive local job status before creating a separate sample enrollment. It requires an explicit fixed curriculum; arbitrary lesson generation and research are not performed. Settings make display name, theme, reading size, motion, study-time, and tutor-style preferences observable. Export/reset are local demo actions. No credentials, model keys, email, or billing information are collected. Tutor replies remain scripted examples. External references link to relevant official documentation and local notes are labeled as sample content.

Build with `pnpm --filter @graphmind/web prototype:build`; typecheck with `pnpm --filter @graphmind/web prototype:typecheck`; run focused state and render journeys with `pnpm --filter @graphmind/web prototype:test`.

See [BACKEND_HANDOFF.md](./BACKEND_HANDOFF.md) for state ownership, access boundaries, existing API mappings, and proposed production endpoints/contracts. The prototype does not modify production routes, auth, middleware, theme, or API behavior. Preferences and generation actions remain local; learner state persists in browser storage.
