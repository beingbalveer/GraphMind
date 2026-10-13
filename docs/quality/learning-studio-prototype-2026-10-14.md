# Learning studio prototype verification — 2026-10-14

## Scope

The preview is a standalone local React + Vite 5 app in `apps/web/prototype`. It imports the existing UI primitives and semantic theme from `apps/web/src`, starts without the Next.js auth provider, middleware, or API hooks, and is served at `http://127.0.0.1:3400` by `pnpm dev:prototype`.

The demo contains a fixed four-lesson Python/backend curriculum, a roadmap, a local reference library, learner-controlled lesson completion, and scripted tutor replies. A path title is only a local label. Tutor conversations and unsent drafts are associated with stable lesson IDs and held in memory; reset or page reload clears them. Passage quotes are visible and removable before sending. Completion is separate from mastery. External references link to official documentation and local notes are labeled as sample content.

No production routes, API behavior, authentication, or persistence were added. Canvas and future mastery dashboards are outside this prototype.

## Verification

- `pnpm --filter @graphmind/web prototype:typecheck` — passed.
- `pnpm --filter @graphmind/web prototype:test` — passed, 7 focused state and rendered journey tests.
- `pnpm --filter @graphmind/web prototype:build` — passed with Vite 5.4.21. Vite reports ignored `use client` directives and source-map location warnings while bundling existing Base UI modules; these warnings do not fail the build.
- Browser review at 1440px and 390px — passed for plan-to-lesson, native and explicit passage selection, visible/removable quotes, full conversation composer and reply, per-topic drafts, lesson scroll restoration, mobile controls, overlay Escape behavior, and complete-path review state. At 390px, the document width was 390px and the main reading region width was 375px with no horizontal overflow.
- Full frontend TypeScript check — passed.
- Isolated Next.js 15 production build — passed from an isolated temporary copy at `/private/tmp/graphmind-studio-next-787pi7os` (log: `/private/tmp/graphmind-studio-next-build.log`).
- Full frontend Vitest suite — 371/371 passed using bundled Node 24.19.0 with `node_modules/vitest/vitest.mjs run --maxWorkers=1 --minWorkers=1` from `apps/web` (log: `/private/tmp/graphmind-studio-vitest-serial.log`). The default Node 26 parallel run, including `NODE_OPTIONS=--no-webstorage`, produced one timing-sensitive focus restoration failure in the unchanged `branch-trigger` test; that test passed when isolated.

## Limits

The prototype makes no backend requests and does not persist state across reloads. Tutor responses and curriculum content are static samples. It is for local product review, not a production learning service.
