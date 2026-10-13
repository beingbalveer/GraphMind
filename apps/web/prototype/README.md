# Learning studio local preview

Standalone React + Vite prototype for a public roadmap catalog and learner flow. It runs without Next.js, authentication middleware, or backend APIs. All auth and generation actions are explicitly simulated in local memory.

From the repository root:

```sh
pnpm dev:prototype
```

Open `http://127.0.0.1:3400`. You can browse three seeded sample roadmaps and read lessons as a guest. Saving, tracking progress, asking the tutor, and creating a roadmap open a simulated sign-in dialog. Continuing enters a local demo learner; no credentials are requested. Progress, conversations, drafts, and reading positions are in-memory and reset on refresh or Reset demo.

The generator collects a learning goal, level, background, outcome, pace, duration, and optional reference URL. It requires an explicit fixed sample curriculum, then creates a separate local enrollment copy carrying the submitted profile. It does not generate arbitrary curriculum content or perform research. Tutor replies are scripted examples. External references link to the relevant official documentation and local notes are labeled as sample content.

Build with `pnpm --filter @graphmind/web prototype:build`; typecheck with `pnpm --filter @graphmind/web prototype:typecheck`; run focused state and render journeys with `pnpm --filter @graphmind/web prototype:test`.

See [BACKEND_HANDOFF.md](./BACKEND_HANDOFF.md) for state ownership, access boundaries, existing API mappings, and proposed production endpoints/contracts. The prototype does not modify production routes, auth, middleware, theme, or API behavior.
