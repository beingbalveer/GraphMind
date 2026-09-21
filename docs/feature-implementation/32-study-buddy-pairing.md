# Study Buddy Pairing Implementation Plan

**Spec:** `docs/FEATURE_RESEARCH.md §8.2`  
**Agentic-worker sub-skill checklist:** `[ ]` read plan/AGENTS.md; `[ ]` review consent/abuse model; `[ ]` implement tickets in order; `[ ]` run privacy tests; `[ ]` verify accessibility; `[ ]` request review.  
**Goal:** reciprocal, topic-scoped study support with default-minimal data sharing and immediate revocation.  
**Architecture:** consented pair/invite models plus purpose-limited projected activity and pair-scoped notes.  
**Tech stack:** FastAPI/SQLAlchemy/Alembic/PostgreSQL, Next.js/TypeScript/Vitest, structured telemetry.  
**Global constraints:** Follow AGENTS.md; preserve URL_DESIGN and helper URLs; provider boundary is ai-core; schema changes through Alembic; enforce RBAC; use shared semantic primitives/tokens and dark mode; meet WCAG keyboard/focus/reduced motion; no dead UI.

**Status:** future. Authentication and workspace memberships exist, but no user discovery, invitation, mutual consent, pairing model, visibility policy, buddy notes, presence, or notification delivery exists. The proposal's “anonymized” title sharing is insufficient: a title can itself disclose private/sensitive learning.

## Goal/non-goals and UX

Support a reciprocal, topic-scoped, revocable study-buddy relationship. User A creates an invite link/code with selected shared learning topic and default **progress-only** scope. User B previews exactly what is shared and accepts; both may later switch to no sharing, aggregate progress, or explicitly chosen concept labels. A feed says “your buddy completed a review milestone” rather than streaming activity; a note is an opt-in, limited-text message attached to a mutually shared topic, with edit/delete/report/block.

Do not link workspaces, expose graph content/titles by default, match strangers algorithmically, expose online presence/location, create a social graph, or bypass block/revocation.

## Architecture/contracts

Models: `StudyBuddyInvite(id, inviter_id, topic_key, scope, expires_at, max_uses)`, `StudyBuddyPair(id, user_low_id, user_high_id, status, sharing_scope, created_at, revoked_at)`, `BuddyActivity(id,pair_id,actor_id,type,topic_key?,occurred_at,visibility)`, `BuddyNote(id,pair_id,author_id,topic_key,body,deleted_at)`, `BuddySafetyAction(actor_id,target_id,kind)`. User IDs are internal; API DTO exposes stable pair IDs, not email. Normalise pair uniqueness unordered. A DB policy/service checks both participant and status for every row.

`POST /study-buddies/invites`, `POST /.../invites/{code}/accept`, `GET /study-buddies`, `PATCH /.../{pair_id}/settings`, `DELETE /.../{pair_id}`, `GET|POST /.../{pair_id}/activities`, `POST /.../notes`, `POST /.../report`, `POST /.../block`. Activity is created by the learning event publisher only if scope permits; a delayed digest query supplies the feed. Do not provide a generic activity endpoint by user id.

## Files/safety/a11y/operations

Create `apps/api/alembic/versions/20260921_0032_add_study_buddies.py`, `apps/api/src/models/study_buddy.py`, `apps/api/src/schemas/study_buddy.py`, `apps/api/src/services/study_buddy_service.py`, `apps/api/src/routers/study_buddies.py`, `apps/api/tests/test_study_buddies_models.py`, `apps/api/tests/test_study_buddies_endpoints.py`, `apps/web/src/lib/buddyApi.ts`, `apps/web/src/components/buddies/StudyBuddyPanel.tsx`, `apps/web/src/components/buddies/StudyBuddyInviteModal.tsx`, `apps/web/src/components/buddies/BuddyNotes.tsx`, and `apps/web/src/components/buddies/__tests__/study-buddy-panel.test.tsx`. Modify `apps/api/src/models/__init__.py`, `apps/api/src/main.py`, `apps/api/src/services/auth_service.py` (notification identity only), `apps/api/src/services/mastery_service.py` (publish safe event), workspace dashboard/context rail and shared types. Use existing UI primitives and `build*Url` helpers.

Treat pairing and notes as user-generated personal data: consent receipts, privacy settings default off, encrypted at rest transport/TLS, retention/erasure policy, moderation/admin audit separately access-controlled, rate limits/invite entropy, anti-enumeration and content sanitization. Do not use “anonymous” claims where timing/topic makes re-identification plausible. Controls explain recipients, scopes, revoke effect, block/report and deletion. Keyboard modal focus trap/return, live status, contrast/icon+text, translations, and no passive notification audio.

Failures are idempotent using invite/pair keys; revocation immediately removes read access and queued notifications; eventual activity projection tolerates duplicate events with `(pair_id,event_id)` unique key. Monitor accepted/revoked/blocked/report rates, feed lag, delivery failures, scope changes and abuse SLA—never note text.

## Tickets/verification/DoD

1. **DATA-821** consented pair/invite/activity schema and privacy erase. Accept: unique pair, expiry, no leaked emails.
2. **API-821** reciprocal invite/RBAC/block/revoke. Accept: both directions, race duplicate accept, blocked user cannot invite/read.
3. **WEB-821** consent-first scope UI/feed/notes. Accept: no default title/content sharing and fully keyboard-operable flows.
4. **TRUST-821** report/moderation/retention and threat-model review. Accept: operational handling owner and test fixtures.
5. **QA-821** run `uv run pytest apps/api/tests/test_study_buddies*.py`, `uv run ruff check apps/api`, `uv run mypy apps/api/src`, `pnpm --filter @graphmind/web test`, and `pnpm --filter @graphmind/web build`.

Definition of Done: explicit two-party consent, least-data feed, revocation/block works immediately, moderation exists, and privacy/a11y/security tests pass.

## Research questions answered

1. **Can title sharing be default?** No; titles are content and can be sensitive.
2. **Is invite acceptance enough consent?** Require a readable scope preview and reciprocal agreement.
3. **Why no stranger matching?** It adds safety/profiling risks outside the stated feature.
4. **Can revocation be eventual?** Authorization revocation must be immediate; only deletion jobs may be asynchronous.
5. **Should notes be public?** No, pair-scoped and reportable.
6. **How avoid duplicate pairs?** Canonical unordered pair unique constraint.
7. **What activity is shared?** Purpose-limited milestone events, not raw exploration history.
8. **How handle abuse?** Block/report, rate limits, audit and staffed moderation procedure before launch.

Sources: [OWASP Authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html), [OWASP Logging](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html), [W3C accessibility principles](https://www.w3.org/WAI/fundamentals/accessibility-principles/), [OpenTelemetry events](https://opentelemetry.io/docs/specs/semconv/general/events/).

## Detailed ticket execution, edge cases and release

### DATA-821 — consented relationship schema

**Objective:** encode reciprocal scope/revocation, not a generic follow graph. **Create:** `apps/api/alembic/versions/20260921_0032_add_study_buddies.py`, `apps/api/src/models/study_buddy.py`, `apps/api/src/schemas/study_buddy.py`, `apps/api/tests/test_study_buddies_models.py`. **Modify:** `apps/api/src/models/__init__.py`, `apps/api/src/services/mastery_service.py`. **Dependencies:** user auth/membership. **Flag/rollback:** `study_buddies_v1`; turn off feed and revoke queued delivery.

1. Add invite, canonical unordered pair, activity, note and safety-action tables with state/check/expiry indexes.
2. Enforce `user_low_id < user_high_id` unique pair and topic/scope enums; link no workspace by default.
3. Make invitation codes high entropy/hashed at rest, single/limited use and expiry-checked transactionally.
4. Add retention/deletion timestamps and per-pair event uniqueness; block action removes access synchronously.
5. Test migration/invitation expiry/pair races/erase cascades.

Acceptance: (1) duplicate/reversed pair impossible; (2) no email/user discovery endpoint; (3) expired/block invite cannot activate; (4) notes/activity are pair-scoped; (5) revoke is immediate. Run `uv run pytest apps/api/tests/test_study_buddies_models.py`.

### API-821 — invitation, scope and safe feed

**Objective:** enforce consent/RBAC on every pair action. **Create:** `apps/api/src/services/study_buddy_service.py`, `apps/api/src/routers/study_buddies.py`, `apps/api/tests/test_study_buddies_endpoints.py`. **Modify:** `apps/api/src/main.py`, `apps/api/src/services/auth_service.py`, `apps/api/src/services/mastery_service.py`, `packages/shared/src/index.ts`. **Dependencies:** DATA-821. **Rollback:** router disabled; no historical reprocessing.

1. Create invite only for authenticated user; accept validates recipient, code, blocks, expiry and explicit scope acknowledgement.
2. Project only scope-approved milestone events from learning ledger; do not query raw nodes or title history.
3. Implement notes with text limits/sanitize/edit/delete/report and pair participant check.
4. Implement revoke/block as transactional status change plus token/cache/notification invalidation.
5. Add rate limits/idempotency/audit and tests for cross-pair enumeration.

Acceptance: (1) default feed exposes no node title/content; (2) blocked user cannot read/invite; (3) revoke removes feed immediately; (4) duplicate accept safe; (5) reports are private/auditable. Run `uv run pytest apps/api/tests/test_study_buddies*.py`, `uv run ruff check apps/api`, `uv run mypy apps/api/src`.

### WEB-821/TRUST-821/QA-821 — consent and safety UI

**Objective:** explain data boundaries before any sharing. **Create:** `apps/web/src/lib/buddyApi.ts`, `apps/web/src/components/buddies/StudyBuddyPanel.tsx`, `apps/web/src/components/buddies/StudyBuddyInviteModal.tsx`, `apps/web/src/components/buddies/BuddyNotes.tsx`, `apps/web/src/components/buddies/__tests__/study-buddy-panel.test.tsx`, `docs/runbooks/study-buddy-safety.md`. **Modify:** `apps/web/src/components/workspace/WorkspaceDashboard.tsx`, `apps/web/src/components/layout/ContextRail.tsx`. **Dependencies:** API-821. **Rollback:** flag hides all social entry points.

1. Render scope preview with recipient/data/examples/revoke before Accept.
2. Implement settings, leave, block/report and note controls using Modal/ConfirmDialog/Button primitives.
3. Announce scope/status changes and maintain focus/keyboard/reduced-motion/dark-mode compliance.
4. Define report triage/abuse escalation/retention owner and test staff access separately.
5. Run screen-reader/keyboard plus privacy fixture/e2e suite and cohort ramp.

Acceptance: (1) no default content sharing; (2) clear block/revoke path; (3) pair feed has error/empty states; (4) report sends no note text to analytics; (5) all controls work via keyboard. Run `pnpm --filter @graphmind/web test`, `pnpm --filter @graphmind/web build`.

| Edge case | Handling | Test |
|---|---|---|
| both accept simultaneously | canonical pair transaction | `test_duplicate_accept` |
| scope tightened | remove future/read cache immediately | `test_scope_revoke` |
| user deletion | erase notes/feed per policy; preserve minimal abuse audit | `test_pair_erasure` |
| notification queued at block | worker checks current pair status | `test_block_delivery_race` |
| unsafe note | sanitize/quarantine/report | `test_note_xss` |
| blocked invite link | generic invalid response, no user disclosure | `test_blocked_invite` |

Rollout internal consent test → opt-in invite-only cohort → broader release after abuse/SLA metrics. No backfill of existing learning history; activity begins after consent. Rollback turns flag/API publication off and preserves only purpose-limited data for deletion/audit.
