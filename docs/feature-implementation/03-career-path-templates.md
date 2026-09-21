# Career Path Templates Implementation Plan
## Plan protocol

- [ ] Read this plan, `AGENTS.md`, `docs/URL_DESIGN.md`, and the cited feature research before coding.
- [ ] Use the agentic-worker sub-skill protocol: one ticket at a time; inspect changed files; run its exact verification; report evidence before starting the next ticket.
- [ ] Record a reviewer checkpoint after each ticket and do not silently widen scope.

**Goal:** Deliver the feature’s learning outcome with explainable, private, production-grade behaviour.

**Architecture:** FastAPI service/router/schema/model layers; provider-agnostic AI through `packages/ai-core`; typed shared contracts; Next.js App Router surface; PostgreSQL persistence and asynchronous projections where specified.

**Tech Stack:** Python 3.12/FastAPI/async SQLAlchemy/Alembic/Pydantic v2/pytest/ruff/mypy; Next.js 15/TypeScript strict/Tailwind/shadcn primitives/vitest; PostgreSQL/Redis.

**Spec:** `docs/FEATURE_RESEARCH.md §1.3`.

**Global Constraints:** Obey `AGENTS.md`: obtain approval before implementation, one roadmap task at a time, and no dead UI. Read `docs/URL_DESIGN.md` before route work; use `@/lib/urls` and Next router, never browser history or primary-ID query parameters. Keep LLMs behind provider abstractions in `packages/ai-core`; make schema changes through reversible Alembic migrations; enforce workspace RBAC on every read/write. Use only `@/components/ui` primitives and semantic tokens, support dark mode, and meet WCAG keyboard, focus, contrast, status-message and non-colour requirements.


# 1.3 Career Path Templates
### Ticket-specific test cases to add before code review

- Happy path: authenticate an owner/editor, execute the ticket action, reload and assert exact persisted response.
- Authorization: repeat as viewer and unrelated workspace member; assert safe 403/404 and no event emitted.
- Validation: submit empty, over-boundary and malformed payloads; assert 422 field detail and no write.
- Retry: send same mutation/idempotency key twice and assert one row/event and same response.
- Failure: force provider/database/worker error; assert rollback, redacted log and accessible retry state.
- Concurrency: issue two compatible/conflicting requests; assert invariant/unique constraint remains true.
- Accessibility: tab/Enter/Escape through UI, inspect role/status/focus and dark-mode semantic classes.
- Performance: seed stated large fixture, measure query/render budget and assert bounded page size.
- Migration: upgrade, create data, downgrade in isolated database and confirm documented rollback outcome.

## Mandatory ticket execution matrix

The ticket list below is ordered. A fresher completes one ticket, obtains review evidence, then starts its dependent ticket. Use the exact files named in the feature architecture; do not add alternate persistence or routing paths.

### Required procedure for every listed LEARN ticket

**Objective/dependency:** the ticket title is its sole objective; stated dependencies are hard start conditions. If none is stated, establish a passing baseline first.

1. Read each named service/model/router/component and nearest existing test; record current input/output contract.
2. Create the named Pydantic schema and shared TypeScript type first, with bounds, enum and nullable validation.
3. When persistence is required, add only the named model/migration, query indexes and reversible Alembic downgrade.
4. Implement one service method with ownership/RBAC check, typed errors, redacted structured logs and transaction boundary.
5. Wire API/client/UI behind the feature flag, using UI primitives/tokens and canonical URL helpers.
6. Add unit, integration and interaction tests below; run all commands before review.
7. Test retry/idempotency/concurrency and migration upgrade/downgrade in an isolated database.
8. Enable internally, observe for one business day, then advance rollout.

**API/type evidence:** each request has Pydantic validation; every response has a shared TypeScript interface; retryable mutations use idempotency keys; event payloads contain event type, entity id, UTC occurred_at and schema version.

**Acceptance criteria (all tickets):**
1. Owner/editor completes happy path and result survives refresh.
2. Viewer/cross-workspace access cannot read/mutate or learn resource existence.
3. Invalid schema, provider failure and duplicate retry preserve integrity and show useful feedback.
4. Keyboard/screen-reader, dark theme and non-colour state pass component tests.
5. Feature p95 target is met or UI shows a safe stale/degraded state.

**Verification:** run the ticket-specific pytest/vitest command in the ticket list, then 'uv run ruff check apps/api', 'uv run mypy apps/api/src', 'pnpm --filter @graphmind/web vitest run', and 'pnpm --filter @graphmind/web build'. For migrations run 'uv run alembic upgrade head', inspect indexes in PostgreSQL, then 'uv run alembic downgrade -1' in an isolated test database.

**Rollback/flags:** use server flag 'LEARNING_<FEATURE>_V1' and UI flag 'NEXT_PUBLIC_LEARNING_<FEATURE>_V1'. Disable UI, then writes/jobs, drain workers, and retain audit records. Additive migrations are not dropped in incident rollback.

### Edge cases, backfill, and rollout

| Case | Required behaviour | Test |
|---|---|---|
| Retry/double click | One logical mutation through idempotency/unique constraint | concurrent POST |
| Delete source/card/concept | Documented cascade/tombstone; projection remains valid | deletion/replay |
| Duplicate/out-of-order event | Version/checkpoint keeps projection deterministic | worker replay |
| Large workspace | Pagination/index/cache; no unbounded query | 2k-node/10k-event benchmark |
| Malformed/injected AI output | Strict schema rejects; persist nothing | adversarial fixture |
| Provider/worker outage | Timeout, retry/DLQ, stale status | timeout/replay |
| Timezone/DST/deletion | UTC storage/local display; export/delete honoured | timezone/privacy |

Deploy additive migration with flag off; reader code; ascending workspace/id idempotent backfill with checkpoints/rate limit; compare counts/checksums; dual-read to parity; internal → 5% → 25% → 100% after seven-day error/latency/quality gates. Stop jobs and disable flags on parity drift, privacy leak, p95 breach or critical evaluation failure.


## Status, intent, and scope

No template catalogue exists; 1.1 has freeform generation. Ship versioned, human-reviewed starter templates that prefill 1.1’s review flow for Backend, AI, Full Stack and Data Science. They reduce blank-canvas friction; they do not certify job readiness, rank careers, or replace personalized roadmap generation.

## Design and architecture

Template gallery → accessible preview (outcomes, prerequisites, source/version, estimated effort and warning that estimates vary) → choose level/focus → editable roadmap draft → accept. Each template has an immutable published version and a fork records `template_id/version`; edits never mutate a learner’s graph. Store templates in `learning_roadmap_templates` and `learning_roadmap_template_topics` (not JSON) for review, search and rollback; topics map to generated nodes on acceptance. Add `schemas/roadmap_template.py`, `services/roadmap_template_service.py`, `routers/roadmap_templates.py`, seed fixture, migration and tests; modify `roadmap_service.py`, shared types, `roadmapApi.ts`, `RoadmapModal.tsx`, `WorkspaceDashboard.tsx`.

`GET /roadmap-templates`, `GET /roadmap-templates/{slug}`, `POST /roadmap-templates/{slug}/draft` are public-to-authenticated read/draft endpoints; publishing is admin-only. Validator from 1.1 checks every version. Record `template.viewed|selected|draft_edited|accepted` and conversion/follow-through, not chosen career text in third-party analytics.

## Quality and safety

Use direct, non-promissory descriptions. Editorial source review links each prerequisite to an official specification/course reference; AI may localize a draft but must preserve identifiers and return a change list. Eval every release: DAG/no duplicate titles, 100% source URL reachability, two domain reviewers, inclusive language lint. The IES guide supports organized, spaced and retrieval-oriented study ([source](https://ies.ed.gov/ncee/wwc/PracticeGuide/1)); templates must schedule activities, not claim their ordering is universal. Provide keyboard gallery/card controls and text alternatives ([WCAG](https://www.w3.org/TR/WCAG22/)).

## Questions answered

1. **Why templates?** Fast starting point. 2. **Are they immutable?** Published versions are. 3. **Can a learner edit?** Always. 4. **Who publishes?** Authorized editorial admins. 5. **Do they guarantee employment?** Never. 6. **How update?** New version, old forks retained. 7. **How avoid bias?** Diverse reviewers and non-normative copy. 8. **Can AI invent sources?** No; validator accepts allowlisted/direct URLs. 9. **Do templates gate nodes?** Only after 1.2 soft-gate policy. 10. **What is deleted?** Forked workspace data per retention policy, not audit version history.

## Jira implementation tickets

### LEARN-121 — Versioned template catalogue and fork API

**Objective:** publish immutable, reviewed career-roadmap template versions that users can inspect and fork into private workspaces.

**Dependencies:** roadmap validation/acceptance from feature 1.1.

**Files:**
- Create: `apps/api/src/models/roadmap_template.py`, `apps/api/src/schemas/roadmap_template.py`, `apps/api/src/services/roadmap_template_service.py`, `apps/api/src/routers/roadmap_templates.py`, `apps/api/alembic/versions/20260921_0003_add_roadmap_templates.py`
- Modify: `apps/api/src/main.py`, `apps/api/src/models/__init__.py`, `apps/api/src/services/roadmap_service.py`
- Test: `apps/api/tests/test_roadmap_template_service.py`, `apps/api/tests/test_roadmap_template_endpoints.py`

**Owned contract:** `RoadmapTemplate(id,slug,status,latest_version_id)`; immutable `RoadmapTemplateVersion(version,locale,title,description,audience,estimated_hours,graph_json,source_manifest,reviewed_at)`; `POST /roadmap-templates/{slug}/fork` with idempotency key.

1. Write tests for published/draft visibility, slug uniqueness, immutable version creation, DAG validation, and idempotent forking.
2. Add tables/indexes and a reversible migration; never update a published version's graph in place.
3. Validate every version with the roadmap DAG validator, topic limits, normalized titles, source URL allowlist, and schema version.
4. Implement list/detail endpoints with locale fallback and ETag, plus an owner-only editorial create/version/publish boundary.
5. Fork by copying the selected version through `RoadmapService` in one transaction, recording `template_version_id` provenance on the workspace.
6. Authorize the resulting workspace normally and emit `roadmap_template.forked` only after commit.

**Acceptance criteria:** only published versions are public; a fork is independent of later template edits; duplicate fork requests create one workspace; malformed/cyclic templates cannot publish; source/provenance is queryable.

**Verification:** `uv run pytest apps/api/tests/test_roadmap_template_service.py apps/api/tests/test_roadmap_template_endpoints.py -q`; `uv run ruff check apps/api`; `uv run mypy apps/api/src`.

**Rollback:** disable `CAREER_TEMPLATES_V1`; existing forked workspaces remain usable because they contain copied graph data.

### LEARN-122 — Template gallery, preview, and customization

**Objective:** let a learner compare, preview, customize, and fork a template without a blank or misleading action.

**Dependencies:** LEARN-121.

**Files:**
- Create: `apps/web/src/lib/roadmapTemplateApi.ts`, `apps/web/src/components/workspace/CareerTemplateGallery.tsx`, `apps/web/src/components/workspace/CareerTemplatePreview.tsx`, `apps/web/src/components/workspace/__tests__/career-template-gallery.test.tsx`, `apps/web/src/components/workspace/__tests__/career-template-preview.test.tsx`.
- Modify: `apps/web/src/components/workspace/WorkspaceDashboard.tsx`, `apps/web/src/components/workspace/RoadmapModal.tsx`, `packages/shared/src/index.ts`

1. Define strict catalogue/version/fork TypeScript types and central API functions with abort handling and ETag support.
2. Render searchable/filterable templates as semantic cards showing audience, estimated effort, version, reviewer/source count, and last review date.
3. Open a preview with ordered topics/prerequisites and source provenance before exposing the fork action.
4. Collect only supported customization inputs (level, weekly minutes, optional excluded topics); send them as data to the existing roadmap draft flow.
5. On successful fork navigate through `buildWorkspaceUrl`; retain selections on failure and prevent duplicate submits.
6. Test empty catalogue, locale fallback, keyboard filters, mobile layout, dark mode, stale version conflict, and API errors.

**Acceptance criteria:** every visible action works; fork requires an explicit version; customization never mutates the public template; keyboard/screen-reader users can preview and fork; canonical routing is used.

**Verification:** `pnpm --filter @graphmind/web vitest run CareerTemplateGallery CareerTemplatePreview`; `pnpm --filter @graphmind/web build`.

**Rollback:** hide the gallery with `NEXT_PUBLIC_CAREER_TEMPLATES_V1=false`; retain direct access only for already-forked workspaces.

### LEARN-123 — Editorial workflow and quality gates

**Objective:** make template publication evidence-backed, reviewable, and safe to update.

**Dependencies:** LEARN-121; UI preview from LEARN-122 for acceptance testing.

**Files:**
- Create: `apps/api/tests/evals/career_template_cases.json`, `apps/api/tests/test_career_template_quality.py`, `docs/runbooks/career-template-publishing.md`
- Modify: template service editorial methods and seed tooling.

1. Define author → reviewer → published → retired transitions with different actors for authoring and approval.
2. Require source manifest, prerequisite rationale, learning outcomes, locale, audience, and review-expiry date before publish.
3. Run DAG, broken-link, duplicate-topic, estimated-effort, accessibility-copy, and injection scans in CI/editorial validation.
4. Seed Backend, AI, Full Stack, and Data Science as versioned fixtures; never insert mutable production records during app startup.
5. Add review-expiry alerts and a retirement path that removes catalogue discovery without breaking existing forks.
6. Record publication decisions and reviewer identity in audit events.

**Acceptance criteria:** no self-approved publication; all source links and graph invariants pass; retirement is non-destructive; expired content is flagged; seeded fixtures are deterministic.

**Verification:** `uv run pytest apps/api/tests/test_career_template_quality.py -q` plus catalogue endpoint and web gallery tests.

**Rollback:** unpublish/retire the affected version, keep prior published version available, and disable catalogue ingestion while investigating.

## Definition of Done

Templates are immutable and versioned, editorially reviewed, safely forked, provenance-labelled, accessible in the gallery, and covered by migration, authorization, graph-validation, idempotency, UI, and publication-quality tests.

## Sources

- [IES Organizing Instruction and Study to Improve Student Learning](https://ies.ed.gov/ncee/wwc/PracticeGuide/1)
- [O*NET Web Services and occupational data](https://services.onetcenter.org/)
- [NIST AI Risk Management Framework — Generative AI Profile](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf)
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/)
