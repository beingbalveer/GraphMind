# Revision Mode — Daily Digest Implementation Plan

> Agentic-worker sub-skill note: record verified ticket progress. - [ ] review model - [ ] in-app queue - [ ] digest worker - [ ] FSRS adapter

**Goal:** offer an opt-in, bounded daily review queue/digest without overstating current scheduler capability.  
**Architecture:** unified review service → queue/read model → in-app digest and opt-in delivery worker.  
**Tech Stack:** FastAPI/SQLAlchemy/Alembic/Postgres/workers, Next.js/TypeScript, future FSRS adapter.  
**Spec:** `docs/FEATURE_RESEARCH.md §6.1`.

## Global Constraints

Follow `AGENTS.md` approval/verification, `URL_DESIGN.md`, provider abstraction, Alembic, RBAC, and common semantic UI primitives/tokens. Dark mode, keyboard operation, screen-reader status and email consent/unsubscribe are non-negotiable. No raw URL construction, unsolicited email, or fake FSRS score.

## Status, outcome, and boundaries

**Status: not built.** Flashcards exist but have no scheduler/review history; `ConceptModel.last_reviewed_at` and `MasteryService` use a simple staleness threshold; no notification/email model, digest route, worker, preference or daily queue exists. Goal: present a five-minute daily in-app digest with up to three due review items, one recent retrieval question, and one conservative connection insight; optional email is opt-in. It must not claim FSRS readiness until Feature 2.2 creates card scheduling state. Non-goals: send unsolicited email, reward opening an email as learning, or use web/LLM suggestions without provenance.

## UX flow

Home/sidebar badge shows “Review: 4”; **Revision mode** opens a focusable queue with due rationale, estimated duration, source navigation and postpone/finish controls. A daily digest has sections: due flashcards (when scheduler exists), yesterday’s quiz/retrieval item, and an optional graph connection labelled “suggested.” Completion writes events, updates read model and shows a concise summary. Email contains counts/links only, not private node content, and preference center offers channel, quiet hours, timezone, frequency/unsubscribe. In-app still works when email disabled.

## Architecture and exact changes

Build a unified `ActivityReviewService` now (see decisions). Create `ReviewQueueItemModel(id,user_id,workspace_id,kind,source_id,due_at,priority,status,scheduled_for,completed_at,metadata)` and `DigestDeliveryModel(id,user_id,digest_date,timezone,channel,status,idempotency_key,content_version,created_at,sent_at)`, plus `NotificationPreferenceModel`. Add migration, relations/imports, `schemas/revision.py`, `services/revision_service.py`, `services/digest_service.py`, `routers/revision.py`, `workers/digest_worker.py`, `main.py`. Modify `flashcard.py` later only to map scheduled cards; modify `mastery_service.py` to provide simple stale candidates safely.

Frontend: `lib/revisionApi.ts`, `components/revision/RevisionQueue.tsx`, `DailyDigest.tsx`, `NotificationPreferences.tsx`; modify `WorkspaceShell.tsx`, `MainHeader.tsx`, settings page and `workspaceApi.ts`. APIs: `GET /workspaces/{wid}/review-queue`, `POST /review-queue/{id}/complete|postpone`, `GET /me/digests/today`, `PATCH /me/notification-preferences`; internal worker atomically claims users/timezones and creates digest idempotently. Events: `review_queue_served/completed/postponed/digest_sent/opened` (opening email via signed redirect only).

## Scheduling, safety, resilience, and measurement

Until FSRS launch, schedule a bounded stale-concept/quiz queue; never pretend a 14-day threshold predicts memory. When FSRS data lands, its D/S/R state drives flashcard due dates: stability is the interval at 90% retrievability and higher desired retention increases review workload ([FSRS algorithm](https://github.com/open-spaced-repetition/fsrs4anki/wiki/The-Algorithm), [tutorial](https://github.com/open-spaced-repetition/fsrs4anki/blob/main/docs/tutorial.md?plain=1)). Use local timezone captured explicitly, date boundaries/DST tested, daily idempotency unique `(user_id,digest_date,channel)`, outbox/provider retry and bounce/unsubscribe suppression. Queue reads p95 <200 ms, no duplicate emails, worker lag <15 min. Instrument eligibility/sent/delivered/complaint/unsubscribe, queue completion, overdue age and review burden—not vanity opens.

Require user/workspace RBAC; email addresses never enter logs or model prompts; signed URLs are short lived and reauthorize before content. Rate-limit internal sender; use a provider abstraction and audited template. Handle no due items (quiet by default), timezone change, workspace deletion, email bounce, offline mobile, FSRS absent, duplicate worker, user pauses midsession, and source deletion (mark unavailable). Roll out in-app queue first, then opt-in transactional email to 1/10/100%; backfill only open review candidates, not historical mail. Decision: one review service serves queue/digest/alerts; separate schedulers would duplicate prioritization and user preferences.

## Research questions answered

1. **Does FSRS track memory state?** Yes: difficulty, stability and retrievability ([FSRS](https://github.com/open-spaced-repetition/fsrs4anki/wiki/The-Algorithm)).
2. **What retention target starts safely?** FSRS recommends 80–95%, 90% commonly workable; higher causes more reviews ([tutorial](https://github.com/open-spaced-repetition/fsrs4anki/blob/main/docs/tutorial.md?plain=1)).
3. **Can current `last_reviewed_at` implement FSRS?** No; it lacks card rating/review history and parameters.
4. **Should daily email be default-on?** No; opt-in and quiet no-due days avoid dark patterns.
5. **Does a login sustain a streak/review?** No; only meaningful completion events count.
6. **What if late review is successful?** FSRS updates stability based on lower retrievability; do not punish a learner ([algorithm](https://github.com/open-spaced-repetition/fsrs4anki/wiki/The-Algorithm)).
7. **Why timezone persistence?** ‘Daily’ has no meaning without locale/DST boundary.
8. **Why no source body in email?** Privacy and stale/access-change safe links.

## Jira tickets, tests, DoD

1. **REV-101 review model/service:** migrations, queue prioritizer, RBAC/idempotency. AC: no duplicate daily item, postpone preserves audit, deleted source is safe. `uv run pytest apps/api/tests/test_revision_service.py apps/api/tests/test_review_queue_endpoints.py`.
2. **REV-102 in-app queue/preferences:** components/API/settings/badge. AC: keyboard queue, empty/error/offline views, no email required. `pnpm --filter @graphmind/web vitest run src/components/revision/__tests__/revision-queue.test.tsx`.
3. **REV-103 worker/email:** outbox/provider/bounce/timezone tests. AC: exactly one digest/user/date/channel across worker retry and unsubscribe suppresses. `uv run pytest apps/api/tests/test_digest_worker.py`.
4. **REV-104 FSRS adapter (depends 2.2):** map due card read model. AC: fixture schedules agree with pinned FSRS implementation/version. Run `uv run ruff check apps/api/src apps/api/tests && uv run mypy apps/api/src && pnpm --filter @graphmind/web build`.

DoD: consent/unsubscribe/delivery audit pass, timezone/DST and worker idempotency tests pass, no false FSRS claim, dashboards/flag/rollback ready.

## Sources

[FSRS algorithm](https://github.com/open-spaced-repetition/fsrs4anki/wiki/The-Algorithm) · [FSRS tutorial](https://github.com/open-spaced-repetition/fsrs4anki/blob/main/docs/tutorial.md?plain=1) · [OWASP API](https://api-security.owasp.org/editions/2023/en/0x00-header/) · [Retrieval study](https://pubmed.ncbi.nlm.nih.gov/22082095/)

## Execution addendum: edge cases, rollout, tickets

| Condition | Behaviour | Test |
|---|---|---|
| no due work | quiet/empty in-app state | `test_empty_digest_is_quiet` |
| DST/timezone change | one digest per local date | `test_digest_dst_boundary` |
| worker retry | unique user/date/channel delivery | `test_digest_idempotency` |
| unsubscribe/bounce | suppress all mail | `test_bounce_suppresses_delivery` |
| deleted source | unavailable item, no content leak | `test_review_source_reauthorization` |

No historical email backfill. Release `revision_digest_enabled` with in-app queue first, then opt-in email employee/1/10/100%; gate delivery duplicate=0, complaint/error/p95. Off stops new sends but preserves completion/opt-out state.

### REV-101 implementation card

**Objective:** durable review queue/items and user preferences. **Dependencies:** flashcards/mastery/event ledger. **Create:** `models/revision.py`, `schemas/revision.py`, `services/revision_service.py`, `routers/revision.py`, `apps/api/alembic/versions/20260921_0022_add_revision_digests.py`, `tests/test_revision_service.py`, `tests/test_review_queue_endpoints.py`. **Modify:** `models/workspace.py`, `models/user.py`, `models/__init__.py`, `main.py`, `mastery_service.py`.

1. Define queue/delivery/preference fields/unique `(user,date,channel)`. 2. Migrate indexes/UTC. 3. Build bounded stale queue without claiming FSRS. 4. Reauthorize source on serve/complete. 5. Complete/postpone idempotently write events. 6. Test empty/deleted/foreign/duplicate.

**Acceptance:** queue ≤ configured cap; no source leak; duplicate completion once; preference actor-only; migration reversible. **Commands:** `uv run pytest apps/api/tests/test_revision_service.py apps/api/tests/test_review_queue_endpoints.py && uv run ruff check apps/api/src apps/api/tests && uv run mypy apps/api/src`. **Rollback:** disable queue write/UI flag, retain items.

### REV-102 implementation card

**Objective:** accessible queue/preferences UI. **Dependencies:** REV-101. **Create:** `lib/revisionApi.ts`, `components/revision/RevisionQueue.tsx`, `DailyDigest.tsx`, `NotificationPreferences.tsx`, queue test. **Modify:** `WorkspaceShell.tsx`, `MainHeader.tsx`, settings page.

1. Fetch count/list. 2. Render due reason/source/complete/postpone. 3. Wire preference controls. 4. Show empty/error/offline. 5. Add focus/live/dark tests. 6. Deep-link via URL helpers.

**Acceptance:** no email prerequisite; keyboard completes; quiet state understandable; source unavailable safe. **Commands:** `pnpm --filter @graphmind/web vitest run src/components/revision/__tests__/revision-queue.test.tsx && pnpm --filter @graphmind/web build`. **Rollback:** hide queue badge/entry.

### REV-103/104 implementation card

**Objective:** reliable delivery and future FSRS adapter. **Dependencies:** REV-101, then feature 2.2. **Create:** `workers/digest_worker.py`, `tests/test_digest_worker.py`, `services/fsrs_review_adapter.py`, scheduler fixtures. **Modify:** config/flashcard integration.

1. Claim outbox atomically. 2. Apply timezone/quiet/bounce. 3. Retry transient send. 4. Pin FSRS implementation/version. 5. Map D/S/R only after review history. 6. monitor lag/cost/delivery.

**Acceptance:** one send/day/channel; unsubscribe wins; DST tested; FSRS fixture matches pinned implementation. **Commands:** `uv run pytest apps/api/tests/test_digest_worker.py apps/api/tests/test_fsrs_review_adapter.py`; full lint/type/build. **Rollback:** pause worker/adapter flag.

## Implementation handoff checks

1. Store IANA timezone, not fixed offset.
2. Compute local digest date in worker transaction before unique claim.
3. Put recipient address only in provider adapter, not queue event payload.
4. Sign digest links and reauthorize target on open.
5. Use explicit `channel=in_app|email` enum.
6. Do not schedule cards with current staleness heuristic as FSRS cards.
7. Bound overdue queue so one missed month does not create an impossible digest.
8. Record all delivery provider outcomes idempotently.
9. Add opt-out preference audit timestamp.
10. Document sender-domain, bounce and complaint ownership.
11. Test worker crash after send/before acknowledgement using provider idempotency key.
12. Verify in-app queue remains usable with notifications disabled.
