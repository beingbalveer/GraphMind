# Auto-Curriculum Generator Implementation Plan

**Spec:** `docs/FEATURE_RESEARCH.md §9.1`  
**Agentic-worker sub-skill checklist:** `[ ]` read plan/AGENTS.md; `[ ]` inspect roadmap/curator contracts; `[ ]` implement tickets in order; `[ ]` run AI evals; `[ ]` test jobs/UX; `[ ]` request review.  
**Goal:** reviewable deadline- and availability-aware curriculum versions, never autonomous schedule changes.  
**Architecture:** versioned curriculum/sessions plus deterministic validation and event-driven projections.  
**Tech stack:** FastAPI/Pydantic/SQLAlchemy/Alembic/PostgreSQL/Redis, ai-core, Next.js/TypeScript.  
**Global constraints:** Follow AGENTS.md approval/verification; preserve URL_DESIGN/central helpers; provider calls only via ai-core; use Alembic; enforce workspace RBAC; use shared primitives/tokens/dark mode and WCAG keyboard/focus/reduced-motion standards; no dead UI.

**Status:** partial roadmap foundation. `roadmap_agent_service.py`, `roadmap_service.py`, `routers/roadmap.py`, and `RoadmapModal.tsx` generate roadmaps, while curator prerequisite DAG exists. There is no deadline/time-budget curriculum, day schedule, pacing adjustment, gated daily reveal, curriculum versioning, or scheduler.

## Goal/non-goals and learner flow

Given a stated goal, exam/deadline, availability, current level, preferred rest days and workspace, generate a reviewable curriculum: prerequisite roadmap plus dated study sessions. Learner reviews assumptions/workload warnings, accepts a version into a private workspace, follows today's small plan, marks a session done/skipped, and requests adaptation. Daily reveal is an optional focus aid: all curriculum data remains visible/editable, so it never blocks accessibility, recovery, or a learner who studies ahead.

Non-goals: guaranteeing exam outcomes, claiming verified curriculum accreditation, auto-enrolling in a public challenge, silently changing planned work, or using personal data beyond the planning request.

## Architecture/data flow and AI quality

Models: `Curriculum(id, workspace_id, owner_id, goal, deadline_at, timezone, minutes_per_day, status, active_version_id)`, `CurriculumVersion(id,curriculum_id,inputs_json,roadmap_snapshot,schedule_json,model/provider,prompt_version,created_at)`, `StudySession(id,version_id,sequence,scheduled_local_date,estimated_minutes,node_refs JSONB,activity_mix JSONB,status,completed_at)`, and `CurriculumAdaptation(id,from_version_id,to_version_id,reason)`. Schedule receives compact roadmap dependencies, due review facts, curated prerequisites, and explicit availability; the provider returns JSON validated by Pydantic. A deterministic validator proves: every referenced node exists; prerequisite date precedes dependent date; session duration >=1 and daily total <= agreed cap unless explicitly flagged; deadline is feasible/clearly marked infeasible; every AI citation/source reference is preserved. On validation failure retry once with machine-readable errors, then create a draft requiring manual edit—never fabricate a schedule.

Use queued generation/adaptation jobs with an outbox. Publish `learning.session.completed|skipped`, `review.completed`, and `quiz.completed` events to a normalised learning-event ledger. A `CurriculumProjectionService` updates progress/read model; a nightly/not-on-request assessor can propose adaptation but needs explicit learner acceptance. This makes deadlines reliable and removes duplicated counters.

## API/files/contracts

Create migration `apps/api/alembic/versions/20260921_0034_add_curricula.py`, curriculum models/schemas/service/router/jobs/tests; modify `main.py`, `models/__init__.py`, `roadmap_agent_service.py`, `roadmap_service.py`, `curator_service.py`, shared types and API router registration. Endpoints: `POST /workspaces/{id}/curricula:generate`, `GET /.../curricula/{id}`, `POST /.../{id}/accept-version`, `PATCH /.../sessions/{id}`, `POST /.../{id}/adaptations`, all owner/editor write and read RBAC. Create `apps/web/src/app/w/[workspaceId]/curriculum/page.tsx`, `lib/curriculumApi.ts`, `components/curriculum/{CurriculumWizard,ScheduleView,TodayCard,AdaptationReview}.tsx` + tests. Before exposing navigation, modify `docs/URL_DESIGN.md` to approve `/w/{workspaceId}/curriculum`, then add `buildCurriculumUrl(workspaceId)` in `apps/web/src/lib/urls.ts`; never use a query-param primary route.

## Privacy/security/accessibility/reliability

Deadline and availability are personal data: minimise retention, allow export/delete, do not use to train providers without explicit consent, and redact workspace secrets before prompting. Record prompt/version/model/input hash and validator result for reproducibility, not raw private content in logs. Use structured output schemas, schema/version contract tests, adversarial evals (impossible deadlines, unsafe medical/legal claims, prerequisite inversions, invented nodes), and a hard provider timeout/fallback to manual planning. Screen supports semantic timetable/list alternative, text schedule, keyboard reorder/edit, visible focus, colour-independent state, local date clarity, and reduced motion. Monitor generation success, validator rejection, schedule feasibility, adaptation acceptance, skipped-session rate, job lag and P95 response.

## Rollout, tickets, verification, DoD

Ship staff alpha with deterministic schedule preview; then invite-only creation; enable optional adaptation after evaluation quality meets threshold. No automatic backfill; existing roadmaps can be imported by explicit “turn into curriculum.”

1. **DATA-911** curriculum/version/session migration and ownership; accept version immutability and UTC/local-date tests.
2. **AI-911** structured generator + deterministic validator/eval corpus; accept zero invented IDs and prerequisite-order violations across fixtures.
3. **API-911** job/outbox/accept/adapt endpoints; accept idempotency, authorization, queue retry and explicit adaptation acceptance.
4. **WEB-911** accessible wizard/schedule/today/review; accept all fields/edits work with keyboard and no route strings are hardcoded.
5. **QA-911** run `uv run pytest apps/api/tests/test_curriculum*.py`, `uv run ruff check apps/api`, `uv run mypy apps/api/src`, `pnpm --filter @graphmind/web test`, `pnpm --filter @graphmind/web build`, and human review 30 generated schedules.

Definition of Done: an accepted version is immutable/reproducible, no schedule exceeds disclosed constraints silently, learner can edit/skip/adapt, and API/UI/AI eval/observability gates pass.

## Research questions answered

1. **Can the LLM own prerequisites?** No; deterministic curator/validator checks dependency ordering.
2. **Can daily unlock hide required data?** No; it is presentation only and has an accessible full-plan view.
3. **Can the plan self-change?** It may propose, but learner accepts a new version.
4. **How handle impossible deadline?** Mark it infeasible and offer scope/time alternatives, never promise success.
5. **Why immutable versions?** Learner history, debugging and evaluation need reproducibility.
6. **Should a request wait for an LLM?** No; use a durable job/status lifecycle.
7. **Why shared learning events?** One event can update schedule, mastery and challenge projections consistently.
8. **How assess quality?** Structured-output validation plus seeded eval fixtures and human review.

Sources: [OpenAI structured outputs](https://platform.openai.com/docs/guides/structured-outputs), [OpenAI evaluations](https://platform.openai.com/docs/guides/evals), [OpenTelemetry events](https://opentelemetry.io/docs/specs/semconv/general/events/), [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/).

## Detailed ticket execution

### DATA-911 — curriculum/version/session migration

**Objective:** preserve immutable accepted plans and editable execution state. **Create:** `apps/api/alembic/versions/20260921_0034_add_curricula.py`, curriculum models/schemas and `apps/api/tests/test_curriculum_models.py`. **Modify:** model exports/main/shared types. **Dependencies:** roadmap/curator. **Flag/rollback:** `curriculum_v1`; disable generation, leave accepted data readable.

1. Add curricula, immutable versions, sessions and adaptation tables with FK/indexes and session sequence unique per version.
2. Store inputs/snapshot/schema/prompt/model/ontology versions and UTC plus authored local schedule date/timezone.
3. Validate duration/date/node reference ranges in Pydantic and DB checks.
4. Make active-version change transactional; adaptation references from/to version and explicit accepted timestamp.
5. Test migration, deletion, duplicate session, version immutability and timezone rendering.

Acceptance: (1) past schedule can be reproduced; (2) no user can alter another curriculum; (3) plan contains no unknown node ref; (4) adaptation cannot mutate prior version; (5) downgrade works pre-production. Run `uv run pytest apps/api/tests/test_curriculum_models.py`.

### AI-911/API-911 — validated generator/jobs

**Objective:** create feasible drafts only and use learner acceptance. **Create:** generator/validator/router/job/eval tests. **Modify:** roadmap agent/service/curator/main. **Dependencies:** DATA-911, ai-core. **Rollback:** deterministic manual draft fallback; disable job endpoint.

1. Build compact authorized input snapshot and strict JSON schema/prompt with no tool mutations.
2. Validate prereq topological order, minutes/day, availability/rest, deadline feasibility and supplied IDs.
3. On invalid output retry once with validator errors then return review-required failure/draft, never silent schedule.
4. Queue jobs with idempotency/outbox/status; accept creates active immutable version only after confirmation.
5. Add fixture eval corpus for impossible deadlines, injection, missing prerequisite, invented node and bad JSON.

Acceptance: (1) invalid AI output creates no active plan; (2) deadline infeasibility is explicit; (3) provider sees no unrelated workspace data; (4) retry duplicate creates one job; (5) eval threshold/validator report is stored. Run `uv run pytest apps/api/tests/test_curriculum*.py`, `uv run ruff check apps/api`, `uv run mypy apps/api/src`.

### WEB-911/QA-911 — reviewable accessible plan

**Objective:** let learner understand/edit/accept plan. **Create:** wizard/schedule/today/adaptation components/API/tests. **Modify:** `docs/URL_DESIGN.md`, `apps/web/src/lib/urls.ts`, dashboard navigation. **Dependencies:** API-911. **Rollback:** hide entry; direct accepted plans remain accessible.

1. Update `docs/URL_DESIGN.md` with the canonical `/w/{workspaceId}/curriculum` route and legacy/ownership behavior; add/test `buildCurriculumUrl` before wiring navigation.
2. Use a stepper/list form with goal/deadline/timezone/availability validation and explicit data use text.
3. Render schedule as semantic list/table alternative, with typed session details and no hidden daily unlock barrier.
4. Build adaptation diff/accept/reject UI and source/rationale link.
5. Add loading/job/error/cancel/retry/focus behaviour using Modal/Buttons/tokens.
6. Test keyboard, screen reader, local timezone, dark/320px and canonical route helper.

Acceptance: (1) learner can continue/edit/skip; (2) AI change never auto-applies; (3) progress does not depend on colour; (4) no hardcoded URL; (5) all UI actions work. Commands `pnpm --filter @graphmind/web test`, `pnpm --filter @graphmind/web build`.

| Edge case | Handling | Test |
|---|---|---|
| past deadline | reject/offer scope options | `test_past_deadline` |
| unavailable duration | validator marks infeasible | `test_daily_cap` |
| DST | UTC/session-local display | `test_schedule_dst` |
| job retry | same idempotency/key | `test_generate_idempotency` |
| deleted roadmap node | draft invalid/rebuild required | `test_missing_node` |
| user declines adapt | leave active version intact | `adaptation-review.test.tsx` |

Rollout staff/on-demand → opt-in cohort → optional adaptation; no backfill except explicit conversion. Rollback flag disables new generation, jobs stop safely, and event-ledger projection can rebuild state.
