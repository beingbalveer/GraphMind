# Public Roadmap Gallery Implementation Plan

**Spec:** `docs/FEATURE_RESEARCH.md §8.1`  
**Agentic-worker sub-skill checklist:** `[ ]` read plan/AGENTS.md; `[ ]` complete privacy threat model; `[ ]` implement tickets in order; `[ ]` run abuse/security tests; `[ ]` validate moderation runbook; `[ ]` request review.  
**Goal:** opt-in, versioned publication and isolated forking of sanitised roadmap templates.  
**Architecture:** immutable public template versions separate from private workspaces, with report/moderation lifecycle.  
**Tech stack:** FastAPI/Pydantic/SQLAlchemy/Alembic, Next.js App Router/TypeScript/Vitest.  
**Global constraints:** AGENTS.md approval/verification process; preserve URL_DESIGN and central helpers; providers through ai-core only; Alembic for durable changes; strict RBAC; semantic primitives/tokens/dark mode; WCAG keyboard/focus/reduced motion; no premature/dead UI.

**Status:** future. Workspaces/memberships/RBAC exist (`models/user.py`, `dependencies.py`), as does roadmap generation (`roadmap_agent_service.py`), but no public visibility model, public route, publishing review, gallery search, fork, reports, or moderation queue exists.

## Goal/non-goals and user flows

Let a creator deliberately publish a **sanitised roadmap template**, then let a signed-in learner browse, preview, and fork that immutable published version into a private editable workspace. Creator: select roadmap → preflight privacy/copyright scan → edit title/summary/tags/license → preview public redacted graph → publish/rollback. Learner: browse/filter → inspect source/updated date/version → fork → receive an independent workspace/roadmap and attribution. Moderator: triage report → unpublish/restrict/restore with audited reason.

No public conversations, user profiles, private node content, live collaboration, ratings/comments, search-engine indexing by default, or automatic publication. A gallery item is a publication snapshot, not a public `Workspace` switch: this prevents later private edits leaking.

## Architecture/data/API

Create `PublicRoadmap`, `PublicRoadmapVersion`, `PublicRoadmapReport` models. Version stores a validated, sanitised JSON roadmap snapshot, source workspace/version identifiers, tag set, license, status (`draft|published|unpublished|removed`), publish metadata and content hash. Database source workspace remains private. `GalleryService` creates a snapshot after owner-only consent, strips node/message content and unsupported external URLs, rejects secrets/PII detector hits for human review, and records provenance. Fork deserializes only allowed roadmap node/dependency metadata into a new private workspace via `RoadmapService`; it never copies source conversation IDs or user identity.

Endpoints: public `GET /public-roadmaps`, `GET /public-roadmaps/{slug}` (published only, cursor pagination); authenticated owner `POST /workspaces/{id}/public-roadmaps`, `POST /public-roadmaps/{id}/versions`, `PATCH /.../{id}`, `POST /.../{id}/fork`, `POST /.../{id}/reports`; staff-only moderation endpoints. Before routing work, modify `docs/URL_DESIGN.md` to approve public `/gallery` and `/gallery/{slug}` routes and state that they contain no workspace ID. Create `apps/web/src/app/gallery/page.tsx` and `apps/web/src/app/gallery/[slug]/page.tsx`, then centralize both routes in `apps/web/src/lib/urls.ts`. Use a `<meta name="robots" content="noindex">` until policy/consent/legal review enables indexability.

## Exact repository changes

Create migration `apps/api/alembic/versions/20260921_0031_add_public_roadmaps.py`, `apps/api/src/models/public_roadmap.py`, `apps/api/src/schemas/public_roadmap.py`, `apps/api/src/services/gallery_service.py`, `apps/api/src/routers/gallery.py`, `apps/api/tests/test_gallery_service.py`, `apps/api/tests/test_gallery_endpoints.py`, `apps/web/src/app/gallery/page.tsx`, `apps/web/src/app/gallery/[slug]/page.tsx`, `apps/web/src/lib/galleryApi.ts`, and gallery components/tests named in WEB-811. Modify `docs/URL_DESIGN.md`, `apps/api/src/models/__init__.py`, `apps/api/src/main.py`, `apps/api/src/services/roadmap_service.py`, `apps/api/src/routers/roadmap.py`, `apps/web/src/lib/urls.ts`, `apps/web/src/components/workspace/WorkspaceDashboard.tsx`, `apps/web/src/components/workspace/RoadmapModal.tsx`, and `packages/shared/src/index.ts`. Keep all workspace navigation on existing URL helpers.

## Safety, accessibility, reliability

Use explicit content licence selection; warn that public means public; data subject deletion unpublishes future access while retaining minimal legally-required moderation audit. Prevent enumeration via opaque ids/slugs, HTML sanitize every field, rate-limit publishing/fork/reporting, abuse-score/rate-limit spam, validate SVG/Mermaid/link protocols, and require owner re-authentication before publish. Gallery cards are real links with accessible title/metadata; filters are labelled controls; fork state/errors are announced. Log no report narrative in analytics. Cache published immutable versions with ETag; invalidate only on publish/unpublish; queue scan/index tasks and fail closed (draft) on scan failure.

## Rollout, metrics, tickets, DoD

Start internal staff-only, then allowlisted creators, then public browsing/forking. Backfill none; existing roadmaps remain private. Metrics: publish completion, fork conversion, 7/28-day fork activation, report rate, moderation SLA, P95 gallery/search latency, privacy-scan false-positive/negative audit.

1. **DATA-811** models/migration/version snapshot; accept atomic publish and never-public workspace nodes.
2. **API-811** browse/fork/report/RBAC/rate limits; accept 404 for unpublished and fork provenance.
3. **WEB-811** accessible gallery/publish preview; accept keyboard filter/card/fork and clear irreversible-public warning.
4. **TRUST-811** moderation policy, scanner/evals and audit; accept seeded PII/XSS/abuse fixtures block publication.
5. **QA-811** run `uv run pytest apps/api/tests/test_gallery*.py`, `uv run ruff check apps/api`, `uv run mypy apps/api/src`, `pnpm --filter @graphmind/web test`, `pnpm --filter @graphmind/web build`, plus manual abuse/privacy review.

Definition of Done: publication is explicit/versioned/revocable, forking is isolated, access controls and sanitisation are proven, a report has a human operational path, and all tests pass.

## Research questions answered

1. **Make workspace public directly?** No—publish a redacted immutable template snapshot.
2. **Can forks retain source messages?** No; copy only roadmap structure/allowed metadata.
3. **Should it be indexed immediately?** No; require policy and creator consent first.
4. **Why versions?** A fork must have reproducible provenance even when creator changes a draft.
5. **Are reports optional?** No; public UGC needs a reporting/moderation path before launch.
6. **Can public payload contain HTML?** Only sanitized plain/limited Markdown; never unsanitized HTML.
7. **Who can publish?** Owner or a defined publisher role, not any viewer/editor by implication.
8. **What survives deletion?** Unpublish/erase public content; retain only minimum legal/audit metadata per policy.

Sources: [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html), [OWASP XSS Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html), [WCAG 2.2](https://www.w3.org/TR/WCAG22/), [GraphMind URL contract](../URL_DESIGN.md).

## Detailed ticket execution, edge cases and release

### DATA-811 — immutable publication model

**Objective:** make public output a redacted version, never a workspace visibility bit. **Create:** migration/public roadmap model/schema/tests. **Modify:** model exports/main/roadmap service. **Dependencies:** current workspace RBAC. **Flag/rollback:** `public_gallery_v1`; disable public routes, retain snapshots for owner deletion.

1. Create parent/version/report tables with status checks, unique slug/version, creator FK, JSON snapshot/content hash and moderation audit fields.
2. Build snapshot allowlist from roadmap metadata only; reject node message content, member/user identity and unsafe external links.
3. Run secret/PII/XSS scan before status can become `published`; scan failure leaves draft.
4. Enforce owner/publisher create/update and staff moderation actions; return 404 for unpublished/non-owner objects.
5. Test transactionally that publish records immutable version/source hash and unpublish removes public read.

Acceptance: (1) changing private workspace cannot mutate published version; (2) private text/member ID never appears in public payload; (3) invalid slug/XSS/PII blocks; (4) report is auditable; (5) downgrade/test cleanup is valid. Run `uv run pytest apps/api/tests/test_gallery_models.py apps/api/tests/test_gallery_security.py`.

### API-811 — browse, fork and moderation API

**Objective:** browse safe published versions and fork isolated learner copies. **Create:** gallery router/service/API tests. **Modify:** roadmap service/router/shared types. **Dependencies:** DATA-811. **Rollback:** flag router 404; no private workspace mutation.

1. Implement cursor pagination/filter validation and ETag cache for only published versions.
2. Fork serializes roadmap structure into a new private workspace with attribution/version id and no source node/user IDs.
3. Add report rate limit/status, staff-only resolve/unpublish/restore and minimum audit reason.
4. Recheck authorization in every fork/report/version operation; never trust slug alone.
5. Test deleted creator, duplicate forks, unpublish race, enumeration and pagination stable ordering.

Acceptance: (1) forked workspace is private/independent; (2) unpublished returns 404/public cache invalidates; (3) report cannot be spammed; (4) source attribution persists; (5) API never leaks email/membership. Commands `uv run pytest apps/api/tests/test_gallery*.py`, `uv run ruff check apps/api`, `uv run mypy apps/api/src`.

### WEB-811/TRUST-811/QA-811 — consent UI and operations

**Objective:** make public scope comprehensible and moderated. **Create:** `apps/web/src/app/gallery/page.tsx`, `apps/web/src/app/gallery/[slug]/page.tsx`, `apps/web/src/lib/galleryApi.ts`, `apps/web/src/components/gallery/PublicRoadmapCard.tsx`, `apps/web/src/components/gallery/PublicRoadmapPreview.tsx`, `apps/web/src/components/gallery/__tests__/public-roadmap-gallery.test.tsx`, `docs/runbooks/public-roadmap-moderation.md`. **Modify:** `docs/URL_DESIGN.md`, `apps/web/src/lib/urls.ts`, `apps/web/src/components/workspace/WorkspaceDashboard.tsx`, `apps/web/src/components/workspace/RoadmapModal.tsx`. **Dependencies:** API-811. **Rollback:** hide nav/publish controls via flag.

1. First update `docs/URL_DESIGN.md` with `/gallery` and `/gallery/{slug}` ownership, privacy and legacy behavior; then add the pages and central helpers in `apps/web/src/lib/urls.ts`, never reusing a private workspace path.
2. Build creator preflight preview showing included/excluded data, licence, noindex choice and irreversible-public warning.
3. Build accessible browse/filter/fork/report UI with proper links, focus/announce states and no colour-only moderation status.
4. Define staff on-call, report categories/SLA/evidence/appeal/erasure procedure before enabling public content.
5. Execute XSS/PII/copyright/malicious-link fixtures, keyboard/screen-reader run and staged flag ramp.

Acceptance: (1) no publish without explicit consent/licence; (2) every card/fork/report control works keyboard-only; (3) no indexing until policy approval; (4) staff can unpublish in test; (5) error/retry is usable. Run `pnpm --filter @graphmind/web test`, `pnpm --filter @graphmind/web build`.

| Edge case | Handling | Test |
|---|---|---|
| source workspace deleted | keep permitted snapshot/provenance or unpublish per policy | `test_deleted_source` |
| creator unpublishes during fork | atomic version read; fork completes version or 404 | `test_unpublish_fork_race` |
| report abuse | rate limit/dedupe/audit | `test_report_rate_limit` |
| XSS label | sanitize/render text only | `gallery-security.test.tsx` |
| public cache stale | ETag/invalidate status transition | `test_gallery_etag` |
| user data erase | unpublish/erase queue with audit minimality | `test_erasure` |

Rollout: staff templates → allowlisted creators → signed-in browsing/fork → public browsing after moderation and legal approval. No backfill. Rollback disables flag/routes, stops publishing, and uses forward cleanup/erasure—never exposes workspace data.
