# Learning studio product demo — 2026-10-14

## Scope

The standalone Vite preview demonstrates the learner journey across a public catalog, roadmap, lesson outline, lesson practice, tutor, personal collection, library, generator, and settings. It uses seeded local curriculum and scripted responses; it does not call the production API or claim arbitrary AI curriculum generation.

The lesson outline supports mobile collapse and selection across the 12 lesson Python sample and an 18-activity practice catalog. Practice checks and hints are deterministic sample content; retries remain available, and activity completion is tracked separately from knowledge-check correctness or mastery. Library search and source-note previews work in context. The collection shows progress and resumes at the last unfinished lesson.

The browser demo persists versioned state locally, including preferences, collection/progress, per-lesson drafts and reading positions. A refresh during tutor streaming recovers the pending learner question for retry. Sign-out returns to guest browsing and hides learner data; reset is confirmed and clears the local demo. Export was manually checked as version 2 JSON at `/Users/balveer/Downloads/graphmind-demo-export.json`, with one copy, three completed items, and no job data.

Settings apply display name, theme, reading size, reduced motion, weekly-hours defaults, and tutor style. The goal-first generator derives a default title/outcome, retains scripted clarification answers, and exposes a visible failure with retry. Retrying after edits uses the current goal and sample selection. Cancelled work does not publish a copy.

## Verification

- Frontend TypeScript check passed: `/private/tmp/graphmind-product-demo-typecheck-ship.log`.
- Focused prototype tests: 43/43 passed across six files, `/private/tmp/graphmind-product-demo-focused-delivery.log`.
- Vite prototype build passed: `/private/tmp/graphmind-product-demo-build-ship.log`.
- Isolated Next.js production build passed at `/private/tmp/graphmind-product-next-sp8mk1ud`; log: `/private/tmp/graphmind-product-next-build-ship.log`.
- Manual browser review at 1440×960 and 390×844 covered practice correct/wrong answers and retry, scoped drafts and lesson refresh, stop/retry, refresh during tutor streaming, settings effects and invalid weekly hours, goal-only generation, clarification retention, save failure/retry, rapid topic changes, mobile outline controls, nested source preview Escape behavior, guest privacy, demo sign-in, export/reset, and last-lesson resume with draft context. Automated journeys additionally cover hints and retrying generation with an edited profile and sample selection.
- Screenshots: `/private/tmp/graphmind-product-learning-desktop.jpg`, `/private/tmp/graphmind-product-learning-mobile.jpg`, `/private/tmp/graphmind-product-outline-mobile.jpg`, `/private/tmp/graphmind-product-settings-dark.jpg`, and `/private/tmp/graphmind-product-mobile-sources.jpg`.
- Final full frontend Vitest run: 407/407 passed across 79 files with bundled Node 24, serial workers, and `--retry=1`; log: `/private/tmp/graphmind-product-demo-vitest-validated.log`. The preceding run passed 406/407 with an intermittent focus-restoration failure in the unchanged production `branch-trigger` test. That file passed 2/2 in isolation (`/private/tmp/graphmind-branch-focus-isolated.log`) and passed in the final suite. The final log does not expose whether an individual test required the allowed retry.
- `git diff --check` passed. Changes are confined to the standalone prototype and its documentation.

The builds report non-blocking bundle/sourcemap and client-directive warnings. The isolated Next build and browser observations validate the local demo only. They do not validate production authentication, API wiring, server persistence, live generation, or live tutoring.

## Production mapping

Existing owned roadmap job routes support job creation with an idempotency key, event/status reads, answer submission, cancellation, and retry. Existing curriculum topic routes support progress and tutor sessions; existing chat streaming supports tutor responses. The production generator must use those real job/session states and enforce owner authorization, cancellation safety, and idempotency. The current `RoadmapRequest` does not represent all demo fields, including desired outcome, reference URL, and explicit sample identity; those extensions remain proposed and must be verified before implementation.

Public catalog endpoints, signed-in learning-collection endpoints, persisted user preferences, and a server-side export/reset contract remain proposed work. Existing versus proposed endpoints and privacy boundaries are detailed in [BACKEND_HANDOFF.md](../../apps/web/prototype/BACKEND_HANDOFF.md). This demo adds no production routes, authentication behavior, or API implementation.
