# Learning studio guest-to-learner prototype

**Scope:** local React + Vite experience under `apps/web/prototype`. The prototype now starts in a public catalog, supports guest roadmap/lesson reading, uses a simulated sign-in gate for private actions, models an in-memory learner collection, and offers a form/review/demo-copy generator with an explicit fixed sample selection. Tutor replies remain scripted and all state resets on refresh. It makes no backend requests and does not modify production routes, middleware, auth, theme, or APIs.

The detailed state ownership, public/private access boundary, existing API mapping, and clearly labeled proposed backend contracts are in [`apps/web/prototype/BACKEND_HANDOFF.md`](../../apps/web/prototype/BACKEND_HANDOFF.md).

## Local checks completed

| Check                                                                                              | Result                                                                                                                                                                                                                                                                                                                                      |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm --filter @graphmind/web prototype:typecheck`                                                 | Passed after the guest/learner state and view changes.                                                                                                                                                                                                                                                                                      |
| `pnpm --filter @graphmind/web prototype:test`                                                      | Passed: 17 focused reducer and rendered journey tests, including guest privacy, sign-in return with quoted passage and reading position, idempotent save, unsaved signed-in actions, Home and generated-copy resume identity, topic/enrollment isolation, generator validation/back/cancel/stale completion, distinct personal-copy creation. Final focused log: `/private/tmp/graphmind-guest-focused-final.log`. |
| `pnpm --filter @graphmind/web prototype:build`                                                     | Passed on the final source. Vite emitted warnings about `use client` directives in shared UI primitives; build completed successfully.                                                                                                                                                                                                        |
| Full frontend Vitest suite                                                                        | Passed: 381 tests across 75 files using bundled Node 24.19.0 in serial mode. Log: `/private/tmp/graphmind-guest-vitest-final.log`.                                                                                                                                                                                                             |
| Full frontend TypeScript check                                                                     | Passed.                                                                                                                                                                                                                                                                                                                                     |
| Isolated Next.js 15 production build                                                               | Passed using an isolated temporary copy. Log: `/private/tmp/graphmind-guest-next-build-final.log`.                                                                                                                                                                                                                                          |

## Browser review

Parent-reviewed at 1440×960 and 390×844. The tested journeys were:

- Guest catalog search, empty results, and filter clearing; public roadmap overview and lesson reading.
- Dismissing the sign-in gate returned to the same reading position (302 px). Continuing through the gate restored position and clamped it from 302 px to the new maximum of 262 px when the private view had less scrollable content.
- Saving while signed in did not show another auth gate. Generator validation covered an invalid URL, profile review with the submitted URL, cancel, retry, and result. My learning progress filters and generated-copy resume worked.
- Native text selection showed a quote in the full tutor composer; sending a quote without additional prompt text worked. Drafts remained scoped by topic.
- On mobile, dark mode, tutor and source-note modal behavior worked; Escape closed the source modal while keeping the tutor drawer open. Sign-out hid learner progress.

The 390 px viewport had a 390 px document width with no horizontal overflow. Review screenshots:

- `/private/tmp/graphmind-public-roadmaps.jpg`
- `/private/tmp/graphmind-generator-review.jpg`
- `/private/tmp/graphmind-my-learning.jpg`
- `/private/tmp/graphmind-guest-mobile.jpg`
- `/private/tmp/graphmind-public-overview-mobile-dark.jpg`

The generated roadmap is a personal enrollment copy of the selected static fixture, not arbitrary generated or researched curriculum. The local demo has no server persistence; completing a lesson records a learner choice, not mastery.

The browser prototype does not exercise real authentication, persistence, curriculum generation, or backend APIs. The proposed backend contracts in the handoff document remain proposals rather than implemented endpoints.
