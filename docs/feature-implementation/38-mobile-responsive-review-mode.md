# Mobile-Responsive Review Mode Implementation Plan

**Spec:** `docs/FEATURE_RESEARCH.md §10.1`  
**Agentic-worker sub-skill checklist:** `[ ]` read plan/AGENTS.md; `[ ]` inspect flashcard/mastery APIs; `[ ]` implement tickets in order; `[ ]` run mobile/a11y tests; `[ ]` exercise offline/resume; `[ ]` request review.  
**Goal:** let a signed-in learner complete today's review and small learning tasks quickly on a phone without trying to shrink the graph canvas.  
**Architecture:** a first-class, route-addressable mobile review surface backed by a server-generated queue and optimistic idempotent review events.  
**Tech stack:** Next.js 15 App Router/TypeScript/Tailwind/shadcn/Vitest/Playwright; FastAPI/Pydantic/SQLAlchemy/Alembic/PostgreSQL/Redis; existing ai-core only where card generation already needs it.  
**Global constraints:** Follow AGENTS.md approval/verify/commit workflow; preserve `docs/URL_DESIGN.md` and use `@/lib/urls`; provider calls stay behind `packages/ai-core`; durable storage uses Alembic; every route uses workspace RBAC; use only semantic UI primitives/tokens and dark-mode-safe styling; meet WCAG keyboard, focus, target-size, colour-independent, reduced-motion requirements; ship no mock/dead UI.

## Status/current implementation evidence

The current repository has no scheduling/review record yet, but Feature 2.2 owns that durable schema and must land before this feature. `FlashcardModal.tsx` and `FlashcardItem.tsx` handle card browsing/editing, and `MasteryService` tracks concept quiz outcomes but not an actionable review queue. `GraphCanvas.tsx` assumes a desktop canvas and its heatmap/timeline. There is no `/review` canonical route, responsive review shell, mobile navigation, service worker, or offline mutation queue.

## Product scope, non-goals, stories, and flow

Scope: due flashcards (once scheduler feature 2.2 exists), short quiz/review tasks, a daily queue count, source navigation, and recovery from interruption. Non-goals: full graph editing on a phone, feature-incomplete “mobile app” wrappers, independent scheduling rules, push notifications, or background upload of answers.

1. Commuting learner opens `/w/{workspaceId}/review`, sees “12 due, about 8 minutes,” chooses Start, reveals and rates a card, and gets the next card without canvas load.
2. Learner rotates, backgrounds the browser, or loses network after rating; the outcome is saved once or visibly queued, and resume never double-schedules the card.
3. Screen-reader/keyboard user has a text-first card, labelled reveal/rating buttons, clear position/status, and `Go to source` opens canonical chat/node link.
4. Desktop user can open the same route; its deliberate review layout is still useful, not a device sniff/redirect.

## Architecture/data/API/events/types

Add `ReviewQueueService` as a façade over future `ReviewService`/FSRS. It accepts a workspace/user, reads a materialized mastery/review read model, and returns deterministic, cursor-paginated queue items ordered `(due_at, overdue priority, id)`. A card state transition is a transaction: validate card/user/workspace and expected schedule revision → insert immutable `learning_events` row (`review.completed`) with UUID idempotency key → update card schedule/review projection → return the next item. The client keeps an encrypted? No: do **not** persist answer text; it stores only pending rating/idempotency keys in IndexedDB for same-device outage recovery and exposes a manual “clear pending reviews” control.

Types to add in `packages/shared/src/index.ts`:

```ts
type ReviewRating = 'again' | 'hard' | 'good' | 'easy';
interface ReviewQueueItem { card: Flashcard; dueAt: string; scheduleRevision: number; sourceNodeId: string; }
interface ReviewQueueResponse { workspaceId: string; generatedAt: string; totalDue: number; estimatedMinutes: number; items: ReviewQueueItem[]; nextCursor?: string; }
interface SubmitReviewInput { rating: ReviewRating; reviewedAt: string; idempotencyKey: string; scheduleRevision: number; }
```

Endpoints: `GET /workspaces/{workspace_id}/review-queue?limit=20&cursor=`, `POST /workspaces/{workspace_id}/flashcards/{card_id}/reviews`, and `GET /.../review-summary`. Read needs `require_workspace_read`; posting needs `require_workspace_write`, card membership check, Pydantic validation, 409 `stale_schedule` (client refetches), and unique `(actor_id,idempotency_key)`. No phone number/device fingerprint is required. The URL helper adds `buildReviewUrl(workspaceId) => /w/${workspaceId}/review`; do not add `?mobile=true`.

## Exact repository files

**Create:** `apps/api/src/services/review_queue_service.py`; `apps/api/tests/test_review_queue.py`; `apps/api/tests/test_review_idempotency.py`; `apps/web/src/app/w/[workspaceId]/review/page.tsx`; `apps/web/src/lib/reviewApi.ts`; `apps/web/src/hooks/usePendingReviews.ts`; `apps/web/src/components/review/MobileReviewShell.tsx`; `ReviewCard.tsx`; `ReviewProgress.tsx`; and `apps/web/src/components/review/__tests__/mobile-review-shell.test.tsx`. **Do not create a migration, review model, schema, or router here:** modify Feature 2.2's `apps/api/src/models/review.py`, `schemas/review.py`, and `routers/reviews.py` and consume Feature 3.4's event service.

**Modify:** `docs/URL_DESIGN.md`, `apps/api/src/models/review.py`, `apps/api/src/schemas/review.py`, `apps/api/src/routers/reviews.py`, `apps/api/src/services/learning_event_service.py`, `apps/api/src/services/flashcard_service.py`, `apps/api/src/routers/flashcards.py`, `packages/shared/src/index.ts`, `apps/web/src/lib/urls.ts`, `apps/web/src/components/layout/WorkspaceShell.tsx`, `apps/web/src/components/flashcards/FlashcardModal.tsx`, `apps/web/src/app/globals.css`, and route tests. Update the URL contract to approve `/w/{workspaceId}/review` before adding `buildReviewUrl`; do not modify unrelated current user changes in `MainHeader.tsx`.

## Privacy, security, abuse, accessibility

Use existing HttpOnly-cookie auth through `apiFetch`; every card and source node must belong to the selected workspace. Store only rating/time/idempotency in offline storage, expire after 24h, encrypt no fake “security” layer, and delete it on logout/user request. No notifications, tracking pixels, or raw answers in analytics. Rate limit submissions but allow a safe retry. Avoid exposing source contents on a lock screen.

The review screen is a semantic main landmark; cards use headings and text (not a flip-only visual), reveal control is a `Button`, ratings have labels plus shortcut hints, and progress uses `aria-valuenow`. Provide 44px comfortable touch targets (WCAG 2.2 [target-size guidance](https://www.w3.org/TR/WCAG22/#target-size-minimum) sets the AA minimum at 24px), visible focus, safe-area inset padding, no hover-only actions, no auto-advance after screen-reader announcements, and a no-animation preference. WCAG also requires an alternative to drag; review uses taps/buttons only.

## Edge-case matrix

| Condition | Required handling | Test |
|---|---|---|
| Empty queue | Show “You’re caught up,” link back to workspace, no disabled fake card | `test_empty_queue` |
| Two tabs rate same card | first transaction wins; second receives 409/refetches | `test_review_stale_revision` |
| Network drops after submit | retain idempotency key, retry safely, show pending state | `test_pending_review_replay` |
| Session expires | preserve local pending keys, redirect login, replay only after user resumes | `mobile-review-shell.test.tsx` |
| Card/source deleted | skip and count diagnostic; never crash/404 loop | `test_deleted_card_skipped` |
| DST/local clock changes | server trusts UTC timestamp within bounded skew and returns normalized due time | `test_timezone_boundary` |
| Assistive technology | answer remains in DOM only after explicit reveal; no focus loss | `test_keyboard_reveal_and_rate` |
| Queue >500 | cursor pagination; don't fetch/render all cards | `test_queue_cursor` |

## Performance, reliability, observability

Queue response P95 <300ms at 20 cards; initial JS renders one card plus next prefetch. Use `Cache-Control: no-store` for personal queue responses. Server transaction/unique event id makes replay safe; pending queue is a resilience enhancement, not source of truth. Emit `review.queue.loaded`, `review.submitted`, `review.submit_conflict`, `review.pending_replayed` with workspace hash, count, outcome, duration—not card text—following [OpenTelemetry event conventions](https://opentelemetry.io/docs/specs/semconv/general/events/). Alert on error rate, conflict spikes, queue latency and pending replay failure.

## Rollout, migration, backfill, rollback

Feature flag `mobile_review_v1` defaults false per user. Deploy additive migration/model/router disabled; internal test accounts; 5% opted-in responsive users; 25%; 100% after a11y/device matrix and idempotency metrics pass. Existing flashcards initially appear only after the FSRS migration calculates `due_at`; backfill batched by workspace and records `schedule_version=1`, with no invented historical reviews. Roll back by disabling client/server flag; review events remain valid immutable history and schema is retained. A bad schedule projection is rebuilt from event ledger, never from client storage.

## Jira tickets — implementation-ready

### MOB-1011 — Review event and queue backend

**Objective:** extend the existing FSRS review contract with an authorized mobile queue; Feature 2.2 remains the sole owner of review persistence. **Dependencies:** FSRS scheduler (2.2), normalized event ledger Feature 3.4, existing flashcard migration. **Create:** `apps/api/src/services/review_queue_service.py`, `apps/api/tests/test_review_queue.py`, `apps/api/tests/test_review_idempotency.py`. **Modify:** Feature 2.2's `models/review.py`, `schemas/review.py`, `routers/reviews.py`, flashcard service/router and shared types; no new migration.

1. Verify Feature 2.2's `review_states`/`review_events` contract and Feature 3.4's canonical ledger migration are applied; add no duplicate table or index.
2. Define strict Pydantic request/response schemas; validate rating enum, UUID idempotency key and ISO timestamp; return 422 for bad input.
3. Implement one `async with db.begin()` transition with `SELECT ... FOR UPDATE`, workspace ownership and expected revision checks; insert event before projection update.
4. Implement cursor encoding/decoding and queue ordering; omit deleted/ineligible cards and record structured warning.
5. Register RBAC-gated router, add OpenAPI descriptions, telemetry and feature-flag guard returning 404 rather than exposed unsupported controls.

Acceptance: (a) foreign workspace card is 404; (b) replay with same key changes schedule once; (c) stale revision is 409 with current schedule; (d) queue is stable/paginated; (e) migration downgrade works on clean database. Run `uv run pytest apps/api/tests/test_review_queue.py apps/api/tests/test_review_idempotency.py`, `uv run ruff check apps/api`, `uv run mypy apps/api/src`.

### MOB-1012 — Responsive route and typed client

**Objective:** make a canonical review route consumable on every viewport. **Dependencies:** MOB-1011 and URL contract review. **Create:** page, API client, pending-review hook. **Modify:** `docs/URL_DESIGN.md`, `apps/web/src/lib/urls.ts`, shell and shared types.

1. Add `/w/{workspaceId}/review` to `docs/URL_DESIGN.md`, including ownership and legacy behavior; then add/test `buildReviewUrl`, route page and server-safe workspace parameter validation. Do not inspect user agent.
2. Add typed `getReviewQueue`, `submitReview`, `getReviewSummary`, map `ApiError` 409 to a typed stale response.
3. Implement IndexedDB pending record `{endpoint,body,idempotencyKey,createdAt}` with 24h TTL and logout clear.
4. On mount, replay one pending request at a time after auth succeeds; refresh queue after each completion/conflict.
5. Add navigation entry only when feature flag and due-count summary are available; otherwise no dead “Review” button.

Acceptance: (a) route uses no query ID; (b) no desktop redirect; (c) retry has same key; (d) session expiry does not lose/corrupt a review; (e) no card content persists offline. Tests: `apps/web/src/lib/__tests__/review-api.test.ts`, `use-pending-reviews.test.ts`; run `pnpm --filter @graphmind/web test`.

### MOB-1013 — Accessible review UI

**Objective:** ship the usable compact learner flow. **Dependencies:** MOB-1012, UI primitives. **Create:** three review components/tests. **Modify:** globals/modal/shell only as necessary.

1. Build one-card layout with semantic headings, due count, source link and skeleton/loading/error states using shared components.
2. Add explicit Reveal, Again/Hard/Good/Easy controls; disable only during submit and announce outcome/failure.
3. Add responsive CSS using semantic tokens, safe-area padding and breakpoints; keep desktop useful, omit canvas intentionally with explanatory route context.
4. Manage focus: after rating move to next card heading; after error retain focused button and expose retry.
5. Add `aria-live="polite"` status, reduced-motion styles and keyboard shortcut help that never replaces buttons.

Acceptance: (a) complete one card mouse/touch/keyboard; (b) VoiceOver reads card/rating/progress logically; (c) 320px width has no horizontal scroll; (d) light/dark modes meet contrast; (e) source link produces canonical node URL. Run Vitest plus Playwright `tests/e2e/mobile-review.spec.ts` on Chromium WebKit viewports.

### MOB-1014 — Quality, rollout and operations

**Objective:** prove scheduling/recovery and make rollout reversible. **Dependencies:** MOB-1011–1013. **Create:** e2e fixture, dashboard/runbook document. **Modify:** flags/config/monitoring registration.

1. Seed due/non-due cards and test UTC/DST/timezone and duplicate submissions.
2. Test offline request loss with network interception; assert exactly one server event after replay.
3. Run manual accessibility matrix: iOS Safari VoiceOver, Android TalkBack Chrome, desktop keyboard/zoom 200%.
4. Add dashboard queries/alerts and flag ramp criteria listed above.
5. Perform flag-on internal smoke, record evidence, and document rollback command/owner.

Acceptance: (a) all named tests green; (b) schedule state rebuild passes; (c) flag disables entry/API safely; (d) P95/error budgets meet targets; (e) accessibility matrix has no blocker. Commands: `uv run pytest apps/api/tests/test_review_queue.py apps/api/tests/test_review_idempotency.py`; `pnpm --filter @graphmind/web test`; `pnpm --filter @graphmind/web build`.

## Definition of Done

The mobile review route is canonical and optional, every displayed action performs a persisted/visible action, review writes are idempotent and workspace-scoped, offline recovery cannot double-rate, non-visual and touch flows are verified, schedule/event telemetry is privacy-minimised, rollout/backfill/rollback are rehearsed, and all named API/UI/e2e/build checks pass.

## Research questions answered

1. **Should this be a hidden mobile-only redirect?** No; a canonical route is shareable/testable and works on all viewports.
2. **Can the client schedule a review?** No; only the transactionally authoritative service can.
3. **Can offline storage retain answer text?** No; only minimal pending mutation metadata.
4. **Why a schedule revision?** It detects a second device/tab’s newer rating.
5. **Can card flip be the only answer representation?** No; answer must remain semantic/readable after explicit reveal.
6. **How are large queues handled?** Stable cursor pagination and next-card prefetch.
7. **Can a stale review silently retry?** No; refetch/reconfirm using new revision.
8. **Why no push notifications in v1?** They require separate consent, platform delivery and notification policy.

Sources: [WCAG 2.2](https://www.w3.org/TR/WCAG22/), [WAI keyboard practice](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/), [OpenTelemetry events](https://opentelemetry.io/docs/specs/semconv/general/events/), [GraphMind URL design](../URL_DESIGN.md).
