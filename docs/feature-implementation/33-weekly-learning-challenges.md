# Weekly Learning Challenges Implementation Plan

**Spec:** `docs/FEATURE_RESEARCH.md §8.3`  
**Agentic-worker sub-skill checklist:** `[ ]` read plan/AGENTS.md; `[ ]` define rule fixtures; `[ ]` implement sequential tickets; `[ ]` verify time boundaries; `[ ]` run tests/a11y checks; `[ ]` request review.  
**Goal:** optional, meaningful weekly learning goals with durable server-evaluated completion.  
**Architecture:** versioned challenges/enrollments/awards projected from normalized learning events.  
**Tech stack:** FastAPI/Pydantic/SQLAlchemy/Alembic/PostgreSQL, Next.js/TypeScript/Vitest.  
**Global constraints:** AGENTS.md workflow; URL_DESIGN and `@/lib/urls`; providers only via ai-core; Alembic migrations; RBAC; semantic primitives/tokens/dark mode; WCAG keyboard/focus/reduced motion; no mock/dead UI.

**Status:** future. `RoadmapService`, curator, mastery concepts and flashcards provide building blocks, but challenge definitions, enrollment, completion rules, badges, timezone-safe windows, leaderboard/privacy policy, and admin authoring do not exist.

## Goal/non-goals/flow

Offer an optional weekly, accessible learning goal with a curated starter-roadmap snapshot. Learner browses a challenge, sees time window/timezone and exact completion requirements, enrolls, forks the private starter roadmap, completes meaningful verified actions, and sees a private completion badge. “Community completion count” is aggregate only. No login-only completion, global public leaderboard, pressure notifications, paid reward, automatic enrollment, or permanent profile badge without consent.

Challenge definitions use `Challenge(id, slug, title, description, starts_at, ends_at, timezone, roadmap_snapshot, completion_rule JSONB, status)`; participation uses `ChallengeEnrollment(challenge_id,user_id,workspace_id,status,progress JSONB,completed_at)`; awards are immutable `BadgeAward` with revocation reason. `ChallengeProgressService` consumes normalized learning events idempotently and evaluates a versioned declarative rule (e.g. `review_cards>=10 AND quiz_passed>=1 AND nodes_explored>=3`), not front-end counters.

## Contracts/files

Add migration `apps/api/alembic/versions/20260921_0033_add_learning_challenges.py`, `apps/api/src/models/learning_challenge.py`, `apps/api/src/schemas/learning_challenge.py`, `apps/api/src/services/challenge_progress_service.py`, `apps/api/src/routers/learning_challenges.py`, admin authorization and named tests. API: public/authenticated `GET /challenges`, `GET /challenges/{slug}`; `POST /challenges/{id}/enroll`, `GET /.../me`, `POST /.../reconcile`; staff `POST|PATCH /admin/challenges`. Before routing work, modify `docs/URL_DESIGN.md` to approve `/challenges` and `/challenges/{slug}`. Create `apps/web/src/app/challenges/page.tsx`, `apps/web/src/app/challenges/[slug]/page.tsx`, `apps/web/src/lib/challengeApi.ts`, `apps/web/src/components/challenges/WeeklyChallengeCard.tsx`, `apps/web/src/components/challenges/WeeklyChallengeProgress.tsx`, and their tests; modify dashboard/context rail/mastery event publisher, `apps/web/src/lib/urls.ts`, `apps/api/src/main.py`, `apps/api/src/models/__init__.py`, shared types. Use the shared activity ledger specified by Feature 3.4 and the decision document; LEARN-331 is a hard dependency—do not parse analytics or create a second event table.

## Safety/accessibility/reliability

All requirements are readable as text; status has icon/text/colour; cards use 24px+ targets, keyboard controls, focus return, reduced motion, and no timed interaction. Store UTC instants plus authored timezone; show local time and define enrollment at boundary exactly. Owner/editor authorization applies to the chosen enrolled workspace. Prevent duplicate awards with a unique enrollment constraint; make event application idempotent; allow reconcile after worker failure; have no real-time countdown dependence. Limit descriptions/URLs, sanitize Markdown, review generated challenge content, and rate-limit enrollment. Metrics: view→enroll, enroll→first activity/completion, late-boundary disputes, reconciliation count, errors, opt-out/unsubscribe; no learner answers in event telemetry.

## Rollout/tickets/tests/DoD

Pilot one hand-authored challenge, no social comparison. Seed internal tests, then allowlisted users, then public catalog; no historical completion backfill except an explicit admin reconcile based on durable event history.

1. **DATA-831** model/migration/rule schema; accept timezone/window and award uniqueness tests.
2. **API-831** catalog/enroll/progress reducer; accept idempotent duplicate events, ownership, and boundary cases.
3. **WEB-831** details/progress/badge; accept keyboard/screen-reader/reduced-motion audit.
4. **OPS-831** authoring/review/rollout/reconciliation runbook; accept alert on failed reducer.
5. **QA-831** `uv run pytest apps/api/tests/test_challenges*.py`, `uv run ruff check apps/api`, `uv run mypy apps/api/src`, `pnpm --filter @graphmind/web test`, `pnpm --filter @graphmind/web build`.

Definition of Done: completion reflects durable meaningful events, exact rules/time windows are visible, awards cannot double-grant, and no learner is exposed by default.

## Research questions answered

1. **What starts a streak/challenge?** Meaningful verified learning events, never login.
2. **Store local dates?** Store UTC instants plus challenge timezone; render local time.
3. **Can client grant badges?** No; server-side reducer grants once.
4. **Need leaderboards?** No; aggregate completion achieves shared momentum without profiling.
5. **Can a rule change mid-week?** Version it; existing enrollments keep declared version.
6. **What if worker misses an event?** Idempotent outbox/reconcile against ledger.
7. **How are challenge roadmaps changed?** Snapshot/version; never mutate an enrolled learner copy.
8. **Is a countdown accessible?** It is supplementary; never required to complete an action.

Sources: [WCAG 2.2 time limits](https://www.w3.org/TR/WCAG22/#timing-adjustable), [OpenTelemetry events](https://opentelemetry.io/docs/specs/semconv/general/events/), [PostgreSQL transactions](https://www.postgresql.org/docs/current/tutorial-transactions.html), [GraphMind research](../FEATURE_RESEARCH.md).

## Detailed ticket execution

### DATA-831 — challenge/version/award schema

**Objective:** define time-bounded, versioned requirements and non-duplicable awards. **Create:** migration/models/schemas/tests. **Modify:** model exports/main/shared types. **Dependencies:** learning-event ledger. **Flag/rollback:** `learning_challenges_v1`; turn off enrollment/projection, retain event truth.

1. Add challenge, challenge-version, enrollment, progress projection and badge-award tables with UTC timestamps, authored timezone and unique `(challenge_version,user_id)`/award indexes.
2. Validate declarative completion-rule JSON against a Pydantic discriminated schema; version it at publish.
3. Store private enrolled workspace only after user selection and validate owner/editor access.
4. Insert award in same transaction as threshold transition; unique constraint handles duplicate events.
5. Write upgrade/downgrade, timezone/DST/expiry and rule-version tests.

Acceptance: (1) login alone never completes; (2) rule change cannot alter active enrollment; (3) award is exactly once; (4) workspace access is checked; (5) boundary is deterministic. Run `uv run pytest apps/api/tests/test_challenges_models.py`.

### API-831 — event reducer/catalog

**Objective:** project meaningful durable events into challenge progress. **Create:** service/router/reducer tests. **Modify:** mastery/review/quiz event publishers. **Dependencies:** DATA-831. **Rollback:** stop reducer; reconcile later from ledger.

1. Define allowlisted event names/attributes, idempotent event offset, and reducer ordering.
2. Create catalogue/detail/enroll/me/reconcile endpoints with read/write/admin RBAC.
3. Evaluate rule only from server events and period/version; ignore client-provided counter fields.
4. Make reconcile idempotent and staff/rate limited; log outcome/version without answers.
5. Test duplicate/out-of-order event, boundary time, deleted workspace and unauthorized enrollment.

Acceptance: (1) duplicate event does not double count; (2) expired challenge cannot enroll; (3) aggregate count does not reveal learner identity; (4) reconcile repairs projection; (5) non-member gets 404/403. Run `uv run pytest apps/api/tests/test_challenges*.py`, `uv run ruff check apps/api`, `uv run mypy apps/api/src`.

### WEB-831/OPS-831/QA-831 — learner UI and operating release

**Objective:** make requirements/choice/status accessible and support authors. **Create:** `apps/web/src/app/challenges/page.tsx`, `apps/web/src/app/challenges/[slug]/page.tsx`, `apps/web/src/lib/challengeApi.ts`, `apps/web/src/components/challenges/WeeklyChallengeCard.tsx`, `apps/web/src/components/challenges/WeeklyChallengeProgress.tsx`, `apps/web/src/components/challenges/__tests__/weekly-challenge.test.tsx`, `docs/runbooks/weekly-learning-challenges.md`. **Modify:** `docs/URL_DESIGN.md`, `apps/web/src/lib/urls.ts`, dashboard/context rail components. **Dependencies:** API-831. **Rollback:** hide UI/flag; active progress remains recoverable.

1. Update `docs/URL_DESIGN.md` for `/challenges` and `/challenges/{slug}`, then add/test central URL helpers before wiring navigation.
2. Render exact requirements/timezone/version and opt-in enroll confirmation using shared UI components.
3. Show private progress/badge with text/icon/colour and semantic progress; never a default leaderboard.
4. Support empty/expired/completed/error/retry states and canonical routes/helpers.
5. Build staff author/review/reconcile checklist, alerts and rollback owner.
6. Test keyboard/VoiceOver/reduced motion, 320px/mobile and local timezone examples.

Acceptance: (1) requirements clear before enroll; (2) all actions keyboard-operable; (3) no artificial time limit; (4) no inactive fake actions; (5) feature flag cleanly hides UI. Commands `pnpm --filter @graphmind/web test`, `pnpm --filter @graphmind/web build`.

| Edge case | Handling | Test |
|---|---|---|
| DST/week boundary | UTC comparison + authored timezone display | `test_dst_boundary` |
| duplicate review event | unique event reducer | `test_duplicate_event` |
| rule malformed | publish rejected | `test_rule_schema` |
| workspace removed | enrollment is safely ineligible | `test_deleted_workspace` |
| event worker lag | explicit stale/projection timestamp + reconcile | `test_reconcile` |
| screen reader progress | text meets same information | `challenge-progress.test.tsx` |

Rollout: one internal hand-authored challenge with flag → allowlist → public catalogue; no historical backfill except explicit ledger reconcile. Rollback disables new enrollment/worker and repairs later by replaying ledger.

**Implementation handoff:** a fresher must not change a rule evaluator until its fixture represents both a successful and failed completion; update the rule version, migration/schema test, reducer test and authoring copy together.

**Release owner:** product owns challenge wording and timezone; backend owns event/projection replay; accessibility owner signs off progress/status semantics before the flag passes 10%.
