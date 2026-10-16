# Learning Studio Production Integration Backlog

This is the authoritative status board and ticket specification.

## Status board

| ID | Epic | Ticket | Type | Priority | Depends on | Status |
|---|---|---|---|---|---|---|
| [LSI-001](#lsi-001-production-parity-and-ownership-inventory) | A | Production parity and ownership inventory | Analysis | P0 | — | DONE |
| [LSI-002](#lsi-002-approve-integration-identity-and-public-contracts) | A | Approve integration identity and public contracts | Architecture | P0 | 001 | DONE |
| [LSI-003](#lsi-003-port-production-shell-into-next) | A | Port production shell into Next.js | Frontend | P0 | 002 | DONE |
| [LSI-004](#lsi-004-real-sessions-and-public-route-boundary) | A | Real sessions and public route boundary | Full stack | P0 | 003 | DONE |
| [LSI-005](#lsi-005-authorized-collection-summaries) | A | Authorized collection summaries | Backend | P0 | 002, 004 | DONE |
| [LSI-006](#lsi-006-home-and-my-learning) | A | Home and My learning | Frontend | P0 | 003, 005 | DONE |
| [LSI-007](#lsi-007-private-roadmap-outline) | B | Private roadmap outline | Full stack | P0 | 006 | DONE |
| [LSI-008](#lsi-008-persistent-lesson-reader-and-sources) | B | Persistent lesson reader and sources | Full stack | P0 | 007 | DONE |
| [LSI-009](#lsi-009-learner-completion) | B | Learner completion | Full stack | P0 | 008 | DONE |
| [LSI-010](#lsi-010-versioned-practice-server-contract) | B | Versioned practice server contract | Backend | P1 | 002, 008 | DONE |
| [LSI-011](#lsi-011-practice-ui) | B | Practice UI | Full stack | P1 | 009, 010 | DONE |
| [LSI-012](#lsi-012-shared-roadmap-and-conversation-canvas) | B | Shared roadmap and conversation canvas | Full stack | P0 | 007, 009 | DONE |
| [LSI-013](#lsi-013-topicchat-histories) | B | TopicChat histories | Full stack | P0 | 008 | DONE |
| [LSI-014](#lsi-014-tutor-stream-and-local-context-lifecycle) | B | Tutor stream and local context lifecycle | Full stack | P0 | 013 | DONE |
| [LSI-015](#lsi-015-branch-service-integrity) | B | Branch service integrity | Backend | P0 | 014 | DONE |
| [LSI-016](#lsi-016-nested-branch-ui-and-canonical-navigation) | B | Nested branch UI and canonical navigation | Frontend | P0 | 015 | DONE |
| [LSI-017](#lsi-017-standalone-workspace-chats) | B | Standalone workspace chats | Full stack | P0 | 014, 015 | DONE |
| [LSI-018](#lsi-018-course-directory-and-historical-chats) | B | Course directory and historical chats | Full stack | P1 | 013, 016, 017 | DONE |
| [LSI-019](#lsi-019-rich-replies-and-agent-tools) | B | Rich replies and agent tools | Frontend | P1 | 014, 016 | TODO |
| [LSI-020](#lsi-020-generator-request-and-provenance-extensions) | C | Generator request and provenance extensions | Backend | P0 | 002 | DONE |
| [LSI-021](#lsi-021-goal-form-and-profile-review) | C | Goal form and profile review | Frontend | P0 | 020 | DONE |
| [LSI-022](#lsi-022-owned-job-creation-status-and-result) | C | Owned job creation, status, and result | Full stack | P0 | 021 | DONE |
| [LSI-023](#lsi-023-clarification-round-trip) | C | Clarification round trip | Full stack | P1 | 022 | DONE |
| [LSI-024](#lsi-024-job-recovery-retry-and-cancellation-safety) | C | Job recovery, retry, and cancellation safety | Full stack | P0 | 023 | DONE |
| [LSI-025](#lsi-025-public-snapshot-model-and-publication) | D | Public snapshot model and publication | Backend | P0 | 002, 020 | DONE |
| [LSI-026](#lsi-026-public-catalog-api) | D | Public catalog API | Backend | P0 | 025 | DONE |
| [LSI-027](#lsi-027-public-snapshot-and-lesson-api) | D | Public snapshot and lesson API | Backend | P0 | 025 | DONE |
| [LSI-028](#lsi-028-transactional-save-copy-service) | D | Transactional save-copy service | Backend | P0 | 005, 025, 027 | DONE |
| [LSI-029](#lsi-029-public-catalog-in-next) | D | Public catalog in Next.js | Frontend | P0 | 004, 026 | DONE |
| [LSI-030](#lsi-030-guest-course-lesson-list-and-canvas) | D | Guest course, lesson, List, and Canvas | Full stack | P0 | 012, 027, 029 | DONE |
| [LSI-031](#lsi-031-save-copy-and-learning-collection-refresh) | D | Save copy and learning collection refresh | Full stack | P0 | 006, 028, 030 | DONE |
| [LSI-032](#lsi-032-resume-one-authenticated-intent) | D | Resume one authenticated intent | Full stack | P0 | 004, 013, 031 | DONE |
| [LSI-033](#lsi-033-files-and-attachments) | E | Files and attachments | Full stack | P1 | 017, 019 | DONE |
| [LSI-034](#lsi-034-existing-modal-viewers) | E | Existing modal viewers | Frontend | P1 | 033 | DONE |
| [LSI-035](#lsi-035-flashcards-and-learning-message-actions) | E | Flashcards and learning message actions | Full stack | P1 | 019 | DONE |
| [LSI-036](#lsi-036-direct-edits-and-revision-history) | E | Direct edits and revision history | Full stack | P1 | 008, 012 | DONE |
| [LSI-037](#lsi-037-ai-refinement-proposal-review) | E | AI refinement proposal review | Full stack | P1 | 024, 036 | TODO |
| [LSI-038](#lsi-038-branch-promotion) | E | Branch promotion | Full stack | P1 | 016, 036 | DONE |
| [LSI-039](#lsi-039-provider-model-and-system-skill-settings) | E | Provider, model, and system-skill settings | Full stack | P1 | 019, 024 | TODO |
| [LSI-040](#lsi-040-general-workspaces-and-management) | E | General workspaces and management | Full stack | P1 | 006, 018 | DONE |
| [LSI-041](#lsi-041-search-and-semantic-discovery) | E | Search and semantic discovery | Full stack | P1 | 019, 033, 040 | DONE |
| [LSI-042](#lsi-042-knowledge-signals-and-curator-parity) | E | Knowledge signals and curator parity | Full stack | P1 | 035, 038, 040 | DONE |
| [LSI-043](#lsi-043-timeline-and-replay-parity) | E | Timeline and replay parity | Full stack | P2 | 012, 018, 042 | TODO |
| [LSI-044](#lsi-044-production-user-preferences) | E | Production user preferences | Full stack | P2 | 002, 004, 039 | TODO |
| [LSI-045](#lsi-045-owned-data-export-and-destructive-actions) | E | Owned data export and destructive actions | Full stack | P1 | 033, 040, 044 | TODO |
| [LSI-046](#lsi-046-integrated-access-url-and-data-compatibility-gate) | F | Integrated access, URL, and data compatibility gate | QA / Review | P0 | 001–045 | TODO |
| [LSI-047](#lsi-047-accessibility-and-responsive-journey-gate) | F | Accessibility and responsive journey gate | QA | P0 | 046 | TODO |
| [LSI-048](#lsi-048-live-provider-and-research-quality-gate) | F | Live provider and research quality gate | Evaluation | P0 | 024, 039, 046 | TODO |
| [LSI-049](#lsi-049-controlled-production-cutover) | F | Controlled production cutover | Release | P0 | 046–048 | TODO |
| [LSI-050](#lsi-050-retire-obsolete-learner-ui-and-prototype-runtime) | F | Retire obsolete learner UI and prototype runtime | Cleanup | P0 | 049 | TODO |

## Epics and design direction

- **A — Foundation (001–006):** parity and ownership decisions, shell, session boundary, authorized collection, and learner entry points.
- **B — Existing learning and tutoring (007–019):** current curriculum, progress, canvas, sessions, streams, branches, chat history, and rich replies.
- **C — Real generation (020–024):** replace local generator simulation with owned job APIs and recovery behavior.
- **D — Public immutable learning (025–032):** versioned public reads and private-copy boundary, guest browsing, and authenticated intent resumption.
- **E — Legacy parity (033–045):** preserve exposed production capabilities beyond the prototype preview.
- **F — Acceptance and cutover (046–050):** prove compatibility, accessibility, and live quality before controlled cutover and separate retirement.

Resolve the public-learning direction in LSI-001/002: workspace-owned private curriculum/revision/topic identities, existing TopicChat and root-node identities, and stable public snapshot IDs with a durable public-topic-to-private-topic map. Reuse existing workspace, curriculum, protected canvas-anchor, and canvas-layout contracts where possible. Public responses must not expose private origin IDs. Prefer curated versioned snapshots and controlled seed/publication over a CMS. These are proposals for review, not approved runtime contracts. Do not copy prototype localStorage or provider secrets into server data.

Ticket size is a planning target. When scope proves too large, create explicit `.1` / `.2` tickets as soon as that becomes clear, preserve existing IDs, and update dependencies before beginning additional work. Include completion status, commands and actual results, manual evidence, and limitations in the ticket's completion commit. Record its resulting SHA in the next HANDOFF checkpoint; never attempt to embed a commit's own SHA inside itself. Resolve completion commits by their ticket ID in Git history and verify their contents.

## Ticket details

### LSI-001 Production parity and ownership inventory
**Epic:** A · **Type:** Analysis · **Priority:** P0 · **Depends:** none
- **Scope:** Trace exposed legacy routes/actions/services against prototype behavior and existing contracts; reconcile root dashboard with stale URL documentation; recommend copy/workspace ownership, label proposed APIs, and determine whether center lesson content comes from saved TopicChat assistant nodes or a new authored/versioned lesson body.
- **Acceptance:** Parity matrix maps every exposed behavior to a ticket, including curator/mastery/search/timeline, provider, files, general workspace, and learning actions. It records current `TopicBrief` fields and `finish_lesson` persistence, and leaves the lesson-body source decision explicit. Existing research/provider verification remains outstanding.
- **Test targets:** Read-only path/contract/quality-evidence trace; no runtime-readiness claim.
- **Out of scope:** Runtime edits or closing the roadmap's active research-quality task.
- **Evidence:** Parity matrix, root dashboard reconciliation, ownership boundary, center lesson content analysis, and API registry verified and documented in [evidence/LSI-001.md](./evidence/LSI-001.md).

### LSI-002 Approve integration identity and public contracts
**Epic:** A · **Type:** Architecture · **Priority:** P0 · **Depends:** LSI-001
- **Scope:** Specify private workspace/revision/topic/root/branch/TopicChat/anchor identities, center lesson-body source and lifecycle, public snapshot lifecycle, auth intent, copy mapping/dedup, collection projection, preferences/export, and generator extensions.
- **Acceptance:** Schemas, errors, idempotency, authorization, and migration policy are concrete and reviewed; existing and proposed routes/fields are distinguished.
- **Test targets:** Schema examples, compatibility review, and adversarial ownership/duplicate/stale-reference cases.
- **Out of scope:** Implementing contracts, adding a CMS, or declaring proposed endpoints present.
- **Evidence:** Comprehensive schemas, boundary contracts, lesson lifecycle, and idempotency guarantees specified and verified in [evidence/LSI-002.md](./evidence/LSI-002.md).

### LSI-003 Port production shell into Next
**Epic:** A · **Type:** Frontend · **Priority:** P0 · **Depends:** LSI-002
- **Scope:** Port shell, rails, responsive drawers, tokens, and shared primitives into App Router; keep it gated/internal until real data/actions are connected; avoid double-mounting ChatContainer.
- **Acceptance:** Internal routes render shell; production users cannot reach demo controls, placeholders, or duplicate chat state. No Vite runtime/local-storage reducer is treated as production data.
- **Test targets:** Route/render/unmount checks, typecheck/build, desktop/mobile shell review behind gate.
- **Out of scope:** Public launch, demo reducer wiring, or legacy UI deletion.
- **Evidence:** Production shell, responsive rails, and unit test suite verified in [evidence/LSI-003.md](./evidence/LSI-003.md).

### LSI-004 Real sessions and public route boundary
**Epic:** A · **Type:** Full stack · **Priority:** P0 · **Depends:** LSI-003
- **Scope:** Use existing AuthProvider and login/refresh/logout/me; narrowly allow public routes in middleware and validate local login returns.
- **Acceptance:** Only approved public paths pass narrowly scoped middleware tests; private paths remain protected; expiry/refresh/logout clear private caches; hostile external returns are rejected. The full guest-read journey is verified in LSI-030.
- **Test targets:** Auth/middleware tests and browser expiry, redirect, logout.
- **Out of scope:** New auth provider or saved-intent replay (LSI-032).
- **Evidence:** Narrowed public route boundary, open-redirect defense, and 11 unit tests verified in [evidence/LSI-004.md](./evidence/LSI-004.md).

### LSI-005 Authorized collection summaries
**Epic:** A · **Type:** Backend · **Priority:** P0 · **Depends:** LSI-002, LSI-004
- **Scope:** Reuse accessible workspace listing and add only missing minimal curriculum summary/progress/provenance projection.
- **Acceptance:** Existing workspaces remain valid; curriculum and ordinary workspaces are identifiable; no cross-user metadata leaks.
- **Test targets:** Response schema, membership/outsider authorization, legacy workspace fixtures.
- **Out of scope:** New enrollment-per-workspace model or broad unapproved collection API.
- **Evidence:** Batch curriculum projection on workspace listing, dedicated workspace learning-roadmaps endpoint, web client types, and 15 pytest + 381 vitest test passes verified in [evidence/LSI-005.md](./evidence/LSI-005.md).

### LSI-006 Home and My learning
**Epic:** A · **Type:** Frontend · **Priority:** P0 · **Depends:** LSI-003, LSI-005
- **Scope:** Replace local collections with authorized server summaries, search/filter, counts, and resume actions.
- **Acceptance:** Saved/generated copies retain distinct identities; counts/last topic are authoritative; loading, empty, retry work.
- **Test targets:** Rendered states and refresh/two-copy journey.
- **Out of scope:** Public catalog or copy creation (LSI-029/031).
- **Evidence:** StudioHomeView, StudioMyLearningView, useAuthorizedCurricula, and 15 passing vitest tests verified in [evidence/LSI-006.md](./evidence/LSI-006.md).

### LSI-007 Private roadmap outline
**Epic:** B · **Type:** Full stack · **Priority:** P0 · **Depends:** LSI-006
- **Scope:** Load existing curriculum/revision into course rail and List view; preserve ordinary workspace behavior on `ROADMAP_NOT_FOUND`.
- **Acceptance:** Canonical workspace route and server topic IDs; no fixture fallback; stale/denied states explicit.
- **Test targets:** API adapter/component tests and legacy roadmap fixture.
- **Out of scope:** Public snapshots or canvas redesign.
- **Evidence:** Private roadmap outline, full course list view, and 6 unit tests verified in [evidence/LSI-007.md](./evidence/LSI-007.md).

### LSI-008 Persistent lesson reader and sources
**Epic:** B · **Type:** Full stack · **Priority:** P0 · **Depends:** LSI-007
- **Scope:** Resolve lesson source per LSI-001/002, then render saved server lesson body with the correct session/revision or an honest brief/not-yet-generated state; persist reading position in approved scope.
- **Acceptance:** No assumption that `TopicBrief` has a standalone lesson body (`brief`, `objectives`, `exercise`, and `resources` are present). Existing full lessons are assistant nodes under TopicChat sessions; display uses the correct saved node/session/revision. Reading does not implicitly create a session or start an LLM stream; no body means an honest state.
- **Test targets:** Lesson load/error/reference/session/revision tests and mobile refresh; if the approved design requires new lesson-body storage/API, split bounded LSI-008.1/008.2 contracts and dependencies before implementation.
- **Out of scope:** Guest authored snapshots (LSI-025/027), automatic generation on read, or curriculum editing.
- **Evidence:** Persistent lesson reader, three-tiered content resolution, verified sources, reading position persistence, and backend/frontend tests verified in [evidence/LSI-008.md](./evidence/LSI-008.md).

### LSI-009 Learner completion
**Epic:** B · **Type:** Full stack · **Priority:** P0 · **Depends:** LSI-008
- **Scope:** Use existing progress PATCH and authoritative counters with pending/failure/retry states.
- **Acceptance:** Progress is scoped to workspace/revision/topic; completion is never called mastery; rapid changes cannot overwrite newer intent.
- **Test targets:** API ownership/concurrency and UI retry/refresh.
- **Out of scope:** Practice correctness or mastery rules.
- **Evidence:** Authoritative progress scoping, anti-mastery validation, sequence concurrency protection, and backend/frontend unit tests verified in [evidence/LSI-009.md](./evidence/LSI-009.md).

### LSI-010 Versioned practice server contract
**Epic:** B · **Type:** Backend · **Priority:** P1 · **Depends:** LSI-002, LSI-008
- **Scope:** Reuse the checks route; add only missing activity version, attempt identity, feedback/retry, hint, and answer-draft contracts.
- **Acceptance:** Server validates activity/answer; duplicates are safe; correctness, completion, and mastery stay distinct; demo keyword grading is not copied.
- **Test targets:** Activity-version, authorization, duplicate, invalid-answer tests.
- **Out of scope:** UI or local-demo mastery rules.
- **Evidence:** Reused checks route with versioned activity contracts, attempt identity, draft persistence, duplicate safety, and 9 passing tests verified in [evidence/LSI-010.md](./evidence/LSI-010.md).

### LSI-011 Practice UI
**Epic:** B · **Type:** Full stack · **Priority:** P1 · **Depends:** LSI-009, LSI-010
- **Scope:** Render real activities, validated feedback, hints, retries, and owned answer drafts.
- **Acceptance:** Refresh/retry retain correct activity; missing activities have an honest state; no automatic completion/mastery.
- **Test targets:** Rendered answer/retry/version-change tests and browser refresh.
- **Out of scope:** Scripted grading or mastery claims.
- **Evidence:** Integrated StudioPracticeActivity, versioned drafts and attempts, debounced autosave, hint disclosure, anti-mastery decoupling, and 7 unit tests verified in [evidence/LSI-011.md](./evidence/LSI-011.md).

### LSI-012 Shared roadmap and conversation canvas
**Epic:** B · **Type:** Full stack · **Priority:** P0 · **Depends:** LSI-007, LSI-009
- **Scope:** Reuse existing canvas renderer, curriculum projection, layout hooks, protected anchor, and `kind=curriculum` layout endpoint. Guest read-only canvas must not call private layout APIs.
- **Acceptance:** List/Canvas project the same revision/topics; canonical URL uses protected anchor; existing persistence, 409 recovery, and anchor exclusion from ordinary chats/deletion remain intact.
- **Test targets:** Layout/API guards, projection parity, keyboard/refresh/drag browser checks.
- **Out of scope:** Rebuilding canvas or writing guest layout through private APIs.
- **Evidence:** Reused RoadmapCanvas with guest read-only guard, list/canvas mode switching in StudioCourseListView, canonical URL routing, and 6 unit tests verified in [evidence/LSI-012.md](./evidence/LSI-012.md).

### LSI-013 TopicChat histories
**Epic:** B · **Type:** Full stack · **Priority:** P0 · **Depends:** LSI-008
- **Scope:** Map existing topic-session list/read/create/fresh APIs and idempotency into rail and tutor pane.
- **Acceptance:** History preserved; fresh retries create once; session/root/topic association survives refresh without duplicate client records.
- **Test targets:** Membership/topic APIs and UI switch/fresh-session tests.
- **Out of scope:** Branch creation or replacing TopicChat identity.
- **Evidence:** useTopicChatHistory hook, StudioTopicChatHistory component, rail integrations, and 8 passing unit tests verified in [evidence/LSI-013.md](./evidence/LSI-013.md).

### LSI-014 Tutor stream and local context lifecycle
**Epic:** B · **Type:** Full stack · **Priority:** P0 · **Depends:** LSI-013
- **Scope:** Existing SSE with scoped composer/quote/draft, stop/retry, interruption recovery, late-output protection.
- **Acceptance:** Stream binds to saved parent/session; topic switch/logout/unmount cannot contaminate panes; retry preserves identities without duplicate assistant reply.
- **Test targets:** Deterministic events, cancellation/races, refresh/stop/retry browser journey.
- **Out of scope:** New stream protocol or scripted tutor responses.
- **Evidence:** StudioTutorChat component, scoped drafts, passage quoting, stop/retry controls, late-output protection, and 7 passing unit tests verified in [evidence/LSI-014.md](./evidence/LSI-014.md).

### LSI-015 Branch service integrity
**Epic:** B · **Type:** Backend · **Priority:** P0 · **Depends:** LSI-014
- **Scope:** Verify/strengthen same-root node creation, source/highlight validation, nested lineage, stale/deleted origin handling, continuation from user or assistant nodes.
- **Acceptance:** Server rejects cross-workspace origins, cycles, invalid quotes; branches remain descendants of the same root.
- **Test targets:** Focused node/stream lineage authorization and adversarial tests.
- **Out of scope:** Branches as separate chat roots.
- **Evidence:** Cross-workspace origin rejection, cycle prevention, quote bounds, ancestor validation, and 16 passing adversarial/authorization tests verified in [evidence/LSI-015.md](./evidence/LSI-015.md).

### LSI-016 Nested branch UI and canonical navigation
**Epic:** B · **Type:** Frontend · **Priority:** P0 · **Depends:** LSI-015 · **Status:** Complete
- **Scope:** Port branch pane/expanded navigation, ancestry/siblings/selection, node/branch URL helpers.
- **Acceptance:** Lesson/rail remain visible; node links reconstruct ancestry; Back/refresh retain root URL; mobile drawers/focus work.
- **Test targets:** Canonical navigation/render tests and nested browser journey.
- **Out of scope:** Workspace/chat identity in query parameters.
- **Evidence:** 3-column desktop visibility, multi-level ancestry breadcrumbs, sibling tab switching, branch from reply/selection, canonical URL helpers, and 12 passing tests verified in [evidence/LSI-016.md](./evidence/LSI-016.md).

### LSI-017 Standalone workspace chats
**Epic:** B · **Type:** Full stack · **Priority:** P0 · **Depends:** LSI-014, LSI-015 · **Status:** Complete
- **Scope:** Persist parentless first user node and real response/continuation in active workspace without implicit lesson context.
- **Acceptance:** First text is not in URL; root survives refresh/retry; topic and general-chat context are independent.
- **Test targets:** Root API contract and create-refresh-continue journey.
- **Out of scope:** Creating local-only demo threads or attaching general chat to an open lesson.
- **Evidence:** Clean canonical URLs, unresponded root recovery and resume banner, context independence verification, and 20 passing unit/integration tests verified in [evidence/LSI-017.md](./evidence/LSI-017.md).

### LSI-018 Course directory and historical chats
**Epic:** B · **Type:** Full stack · **Priority:** P1 · **Depends:** LSI-013, LSI-016, LSI-017 · **Status:** Complete
- **Scope:** Existing list/recent/pin/rename metadata, scoped search, branch ancestry projection, outer ordinary/personal history access.
- **Acceptance:** No cross-workspace rows or anchor row; titles/order persist; history is not copied.
- **Test targets:** List/rename/pin, directory filter, authorization, and refresh tests.
- **Out of scope:** New workspace-management behavior (LSI-040).
- **Evidence:** Workspace-scoped directory projection with anchor exclusion, scoped search, lesson/personal ancestry, canonical open, persistent rename/pin, and authorization rejection, verified by 15 passing web tests, 8 passing LSI-013 regression tests, and 4 passing backend tests in [evidence/LSI-018.md](./evidence/LSI-018.md).

### LSI-019 Rich replies and agent tools
**Epic:** B · **Type:** Frontend · **Priority:** P1 · **Depends:** LSI-014, LSI-016 · **Status:** Complete
- **Scope:** Reuse Markdown/KaTeX/code/citations/tool events/quiz/error renderers and working message actions.
- **Acceptance:** Incremental/final content agrees; unsafe markup/links blocked; tool failures visible; existing learning actions retained.
- **Test targets:** SSE render fixtures, injection cases, copy/citation/tool browser checks.
- **Out of scope:** New agent tool capabilities or dead placeholder actions.
- **Evidence:** Shared rich renderers wired into the tutor pane (Markdown/KaTeX/code/quiz/error, tool events, citations), pinned safe-link `urlTransform`, incremental/final SSE parity, and 10 passing focused tests verified in [evidence/LSI-019.md](./evidence/LSI-019.md).

### LSI-020 Generator request and provenance extensions
**Epic:** C — Real generation · **Type:** Backend · **Priority:** P0 · **Depends:** LSI-002 · **Status:** Complete
- **Scope:** Map existing `RoadmapRequest`; add only approved optional outcome/knownSkills/reference/source-snapshot fields.
- **Acceptance:** Existing clients remain valid; unsupported fields are not silently dropped; sources validated with existing protections.
- **Test targets:** Schema/backward-compatibility, URL-bounds, and stale-source tests.
- **Out of scope:** UI or treating local fixed-sample selection as existing API behavior.
- **Evidence:** Optional `outcome`/`known_skills`/`reference_url`/`sample_template_ref` extensions, `extra="forbid"` rejection of unsupported fields, canonicalized URL bounds, curated sample-snapshot allowlist, and 28 focused tests verified in [evidence/LSI-020.md](./evidence/LSI-020.md).

### LSI-021 Goal form and profile review
**Epic:** C · **Type:** Frontend · **Priority:** P0 · **Depends:** LSI-020 · **Status:** Complete
- **Scope:** Map real inputs, validation, editable review, and approved preference defaults; remove fixed-sample requirement for real generation.
- **Acceptance:** Submitted immutable profile is shown; edits survive failures; sample-copy path is clearly separate.
- **Test targets:** Form mapping, bounds, and review-state tests.
- **Out of scope:** Simulated progress timers or arbitrary generation claims.
- **Evidence:** Pure `generatorProfile` mapping/validation with the LSI-020 fields, `StudioGoalForm` editable review + immutable submitted snapshot, separated sample-copy path, and 18 passing tests verified in [evidence/LSI-021.md](./evidence/LSI-021.md).

### LSI-022 Owned job creation, status, and result
**Epic:** C · **Type:** Full stack · **Priority:** P0 · **Depends:** LSI-021 · **Status:** Complete
- **Scope:** Use idempotent existing job API, real event/status phases, and completed-workspace navigation.
- **Acceptance:** Duplicate submit creates one job; progress comes from server; completion resolves actual workspace/revision/anchor and saved profile.
- **Test targets:** Job client reconnect/event-order/result tests and deterministic integrated generation.
- **Out of scope:** Timer-based completion or unauthenticated job visibility.
- **Evidence:** Idempotent job creation/start with reused keys, server-driven progress via `StudioJobProgress`, canonical workspace navigation on published completion, and 15 frontend + 2 backend tests verified in [evidence/LSI-022.md](./evidence/LSI-022.md).

### LSI-023 Clarification round trip
**Epic:** C · **Type:** Full stack · **Priority:** P1 · **Depends:** LSI-022 · **Status:** Complete
- **Scope:** Render actual clarification/questions and answer route; preserve profile/history.
- **Acceptance:** Only owned pending questions are answered; duplicate/stale answers are safe; refresh resumes correct job.
- **Test targets:** API clarification plus UI refresh/answer/reject tests.
- **Out of scope:** Scripted local clarification as production behavior.
- **Evidence:** Server-driven `ClarificationForm` wired through `StudioJobProgress`/`StudioRoadmapGenerator` to the owned `/answers` route, stale/duplicate safety surfaced in the UI, owner-only answering verified, and 3 frontend + 1 backend tests in [evidence/LSI-023.md](./evidence/LSI-023.md).

### LSI-024 Job recovery, retry, and cancellation safety
**Epic:** C · **Type:** Full stack · **Priority:** P0 · **Depends:** LSI-023 · **Status:** Complete
- **Scope:** Existing job list/resume/start/retry/cancel, failure reconciliation, and any required cancellation race fix.
- **Acceptance:** Refresh resumes owned job; cancellation/stale attempts cannot publish; retry semantics are explicit; failed profile remains editable.
- **Test targets:** Worker/job cancellation-publication races and browser interruption/retry.
- **Out of scope:** Replacing the job system or using local timers.
- **Evidence:** `resumableJob` + mount resume, pre-filled failed-profile editing, explicit retry/cancel, and 5 frontend tests in [evidence/LSI-024.md](./evidence/LSI-024.md); backend cancellation/retry semantics already verified by lease-fence and retry tests in `tests/roadmap/test_jobs.py`.

### LSI-025 Public snapshot model and publication
**Epic:** D — Public immutable learning · **Type:** Backend · **Priority:** P0 · **Depends:** LSI-002, LSI-020 · **Status:** Complete
- **Scope:** Add immutable public DTO/storage and controlled publication from validated curriculum output, preferably curated seed/publish tooling rather than a CMS.
- **Acceptance:** Publication freezes version/topic IDs atomically; public fields contain only vetted lesson/reference data; unpublish stops reads without deleting private copies; no private IDs, uploads, or progress leak.
- **Test targets:** Migration round trip, immutability, sanitization, and publication permission tests.
- **Out of scope:** Admin/CMS product or copying local prototype data.
- **Evidence:** Immutable public snapshot tables (migration `20261015_0007`), `PublicSnapshotService` publish/unpublish/sanitize, private-origin isolation, single linear alembic head, and 18 passing tests verified in [evidence/LSI-025.md](./evidence/LSI-025.md).

### LSI-026 Public catalog API
**Epic:** D · **Type:** Backend · **Priority:** P0 · **Depends:** LSI-025 · **Status:** Complete
- **Scope:** Approved anonymous list/search/category/level/pagination API and indexes.
- **Acceptance:** Only published versions appear; filters/page bounds are enforced; no private metadata; empty/unavailable results are deterministic.
- **Test targets:** Anonymous catalog/filter/pagination/privacy tests.
- **Out of scope:** Signed-in collection or enrollment routes.
- **Evidence:** Anonymous `GET /api/v1/public/roadmaps` catalog with category/level/search filters, bounded pagination, published-only projection, no private metadata, and 9 passing tests verified in [evidence/LSI-026.md](./evidence/LSI-026.md).

### LSI-027 Public snapshot and lesson API
**Epic:** D · **Type:** Backend · **Priority:** P0 · **Depends:** LSI-025 · **Status:** Complete
- **Scope:** Approved anonymous versioned roadmap/lesson reads and safe public sources.
- **Acceptance:** Stable public IDs; missing/stale/unpublished content has neutral unavailable response; no private references/user fields in payloads or errors.
- **Test targets:** Guest/signed-in/outsider serialization and unpublish/cache tests.
- **Out of scope:** Public progress, private IDs, or session data.
- **Evidence:** Anonymous versioned public roadmap/lesson reads with stable public IDs, neutral no-store 404 for missing/stale/unpublished content, sanitized safe sources, and 7 passing tests verified in [evidence/LSI-027.md](./evidence/LSI-027.md).

### LSI-028 Transactional save-copy service
**Epic:** D · **Type:** Backend · **Priority:** P0 · **Depends:** LSI-005, LSI-025, LSI-027 · **Status:** Complete
- **Scope:** Approved idempotent save creates/reuses authorized private workspace+curriculum/revision, protected anchor, sourceSnapshotRef, and durable public-topic→private-topic map.
- **Acceptance:** New copy gets private IDs; relationships are valid; retry creates no duplicate; copies are independent; rollback leaves no orphan workspace/anchor.
- **Test targets:** DB migration/transaction/idempotency/race/member mapping and source-unchanged tests.
- **Out of scope:** Blindly adopting proposed endpoint names or mutating public snapshots.
- **Evidence:** Atomic `POST /api/v1/workspaces/{workspace_id}/learning-roadmaps` (`Idempotency-Key`, `require_roadmap_write`), private copy tables (migration `20261016_0008`), deterministic private IDs + durable public→private topic map, `(workspace, template)` idempotency with `WORKSPACE_HAS_ROADMAP`/`IDEMPOTENCY_MISMATCH`/`SNAPSHOT_OBSOLETE`/`SNAPSHOT_NOT_COPYABLE` errors, source-unchanged and no-orphan rollback proof, and 16 passing tests verified in [evidence/LSI-028.md](./evidence/LSI-028.md).

### LSI-029 Public catalog in Next
**Epic:** D · **Type:** Frontend · **Priority:** P0 · **Depends:** LSI-004, LSI-026 · **Status:** Complete
- **Scope:** Real Browse/search/filter/public-card navigation and public URL helpers.
- **Acceptance:** Guest and signed-in users see same published catalog; loading/empty/retry states work; root dashboard preserved; no private fetch on public page.
- **Test targets:** Component/router tests and anonymous browser browse.
- **Out of scope:** Private copies or prototype fixture catalog.
- **Evidence:** Anonymous `/learn` catalog page renders the published LSI-026 catalog with debounced search, level/category filters, pagination, honest loading/empty/no-results/error+retry states, and card navigation to `/learn/{slug}`; `buildPublicCatalogUrl` gained optional discovery filters; the studio Browse tab now opens the real public catalog (no fixture); 25 passing frontend tests verified in [evidence/LSI-029.md](./evidence/LSI-029.md).

### LSI-030 Guest course, lesson, List, and Canvas
**Epic:** D · **Type:** Full stack · **Priority:** P0 · **Depends:** LSI-012, LSI-027, LSI-029 · **Status:** Complete
- **Scope:** Read-only public snapshots in approved `/learn` routes; guest layout stays local per public snapshot; private actions are gated.
- **Acceptance:** Published lessons readable; List/Canvas use same public IDs; no private mutation or protected-layout request; unpublish fails honestly.
- **Test targets:** Public route/projection/network privacy tests and mobile reading.
- **Out of scope:** Guest progress, chat, or writes to private layout API.
- **Evidence:** Anonymous `/learn/{slug}` course (ordered List ⇄ reused read-only Canvas) and `/learn/{slug}/lessons/{topicSlug}` reader read only the LSI-027 public endpoints, project stable `pub_*` ids via a `canWrite:false` `CurriculumView`, render honest loading/not-available/error+retry states, and gate save/progress/tutor behind `buildLoginUrl`; 34 frontend tests across 7 files (full suite 114 files / 620 tests) verified in [evidence/LSI-030.md](./evidence/LSI-030.md).

### LSI-031 Save copy and learning collection refresh
**Epic:** D · **Type:** Full stack · **Priority:** P0 · **Depends:** LSI-006, LSI-028, LSI-030 · **Status:** Complete
- **Scope:** Signed-in save pending/retry/reuse and route mapping to private course.
- **Acceptance:** Duplicate click/retry returns same copy; mapped topic preserved; source snapshot unchanged; two generated copies isolated.
- **Test targets:** Save UI and integrated snapshot/copy/progress refresh.
- **Out of scope:** Replaying unrelated auth intents.
- **Evidence:** Signed-in save flow: an `enrollmentApi` client + `useSaveRoadmapCopy` hook reuse the workspace already hosting a snapshot (or create one) and post one idempotent copy (stable `Idempotency-Key` per `template:version`, duplicate-click collapse), mapping the guest's public topic to the copy's private topic; `PublicCourseView` gained guest-gate/pending/saved/error states and "Open my copy" routes to `buildWorkspaceUrl`; a collection-change broadcast refreshes `useAuthorizedCurricula`. 17 new frontend tests (full suite 117 files / 637 tests) verified in [evidence/LSI-031.md](./evidence/LSI-031.md).

### LSI-032 Resume one authenticated intent
**Epic:** D · **Type:** Full stack · **Priority:** P0 · **Depends:** LSI-004, LSI-013, LSI-031
- **Scope:** Discriminated expiring save/complete/practice/tutor/generator/signin intent with snapshot/topic/quote/reading context; execute once after login.
- **Acceptance:** Dismissal has no writes; callback revalidates source/owner and maps copied topic; practice does not auto-submit; tutor quote survives; duplicate callback safe.
- **Test targets:** Callback replay/forgery/expiry/invalid-snapshot tests and guest→login journeys.
- **Out of scope:** Trusting callback payloads or placing primary IDs in query params.
- **Evidence:** Discriminated expiring save/complete/practice/tutor/generator/signin intent (public identities only), source revalidation against the current published snapshot, idempotent save with copied-topic mapping and reading-position transfer, consume-once resume (dismissal performs no write, duplicate callback is a no-op, practice never auto-submits, tutor quote survives), executor + store + resumer + guest-journey verification by 23 new tests (32 focused) in [evidence/LSI-032.md](./evidence/LSI-032.md).

### LSI-033 Files and attachments
**Epic:** E — Legacy parity · **Type:** Full stack · **Priority:** P1 · **Depends:** LSI-017, LSI-019 · **Status:** Complete
- **Scope:** Preserve existing library upload/list/search/delete and chat attachment ingestion through real services; keep private uploads separate from public sources.
- **Acceptance:** Existing workspace files remain accessible; processing/errors and authorization work; private uploads never appear publicly.
- **Test targets:** File APIs/components and upload/attach/delete browser journey.
- **Out of scope:** Publishing private uploads or replacing backend storage.
- **Evidence:** Parity verification of the existing file library and chat attachment ingestion — authorization, cross-workspace isolation, processing errors, and no public file exposure — by 4 backend + 10 frontend tests in [evidence/LSI-033.md](./evidence/LSI-033.md).

### LSI-034 Existing modal viewers
**Epic:** E · **Type:** Frontend · **Priority:** P1 · **Depends:** LSI-033 · **Status:** Complete
- **Scope:** Port PDF/code/table/CSV/Excel/JSONL viewers with existing modal primitives and source locators.
- **Acceptance:** Correct file/content/locator; supported large-table behavior; nested modal Escape/focus and safe downloads.
- **Test targets:** Viewer fixtures/error cases and keyboard/browser file matrix.
- **Out of scope:** New file formats or ad-hoc dialog infrastructure.
- **Evidence:** Viewers ported onto shared `Modal` primitives (image lightbox + `initialFocus` fix), correct content/locators, large-table pagination, nested Escape/focus, safe downloads, and 14 focused tests verified in [evidence/LSI-034.md](./evidence/LSI-034.md).

### LSI-035 Flashcards and learning message actions
**Epic:** E · **Type:** Full stack · **Priority:** P1 · **Depends:** LSI-019 · **Status:** Complete
- **Scope:** Preserve existing generation/edit/delete/regenerate/review across root, branch, and canvas surfaces.
- **Acceptance:** Flashcards retain source node/workspace linkage and cascade semantics; exposed actions call services.
- **Test targets:** Flashcard API/component tests and cross-surface review journey.
- **Out of scope:** Local-only fake actions or changing flashcard ownership.
- **Evidence:** Cross-surface (root/branch/canvas) flashcard action parity, source node/workspace linkage, branch and workspace cascade semantics, and 3 backend + 2 frontend tests verified in [evidence/LSI-035.md](./evidence/LSI-035.md).

### LSI-036 Direct edits and revision history
**Epic:** E · **Type:** Full stack · **Priority:** P1 · **Depends:** LSI-008, LSI-012
- **Scope:** Existing topic editor/revisions/diff/restore contracts, concurrency, and current-revision projection.
- **Acceptance:** Lesson/List/Canvas update coherently; history preserved; stale edits recover; progress mapping follows existing policy.
- **Test targets:** Revision/edit APIs/components and conflict/restore browser checks.
- **Out of scope:** Silent overwrite or new revision semantics.
- **Evidence:** Reused topic editor/revision history/diff/restore across Lesson/List/Canvas surfaces, stale-edit conflict recovery, and progress-preserving edits/restores verified in [evidence/LSI-036.md](./evidence/LSI-036.md).

### LSI-037 AI refinement proposal review
**Epic:** E · **Type:** Full stack · **Priority:** P1 · **Depends:** LSI-024, LSI-036
- **Scope:** Existing refine/resume job plus explicit accept/reject proposal; current revision stays until acceptance.
- **Acceptance:** Interrupted refinement recovers; no silent publish/overwrite; errors leave profile editable.
- **Test targets:** Refinement jobs/proposal tests and accept/reject/refresh journey.
- **Out of scope:** Automatic acceptance or separate generation engine.

### LSI-038 Branch promotion
**Epic:** E · **Type:** Full stack · **Priority:** P1 · **Depends:** LSI-016, LSI-036 · **Status:** Complete
- **Scope:** Existing proposal/promotion review and source backlink.
- **Acceptance:** Promoted topic links to correct persistent node/root via `buildNodeUrl`; source branch remains unchanged; duplicates/conflicts safe.
- **Test targets:** Promotion API/lineage and source-backlink browser tests.
- **Out of scope:** Mutating source chat or adding a new proposal model without contract review.
- **Evidence:** Promotion lineage resolves the exact persistent source branch via `buildNodeUrl`, source branch stays unchanged across promote/apply, idempotency/conflict safety, and 3 backend + 3 frontend tests verified in [evidence/LSI-038.md](./evidence/LSI-038.md).

### LSI-039 Provider, model, and system-skill settings
**Epic:** E · **Type:** Full stack · **Priority:** P1 · **Depends:** LSI-019, LSI-024
- **Scope:** Port existing provider/key/model/skill selectors and supported request behavior; document browser-local key model.
- **Acceptance:** Valid selection affects real tutor/generator when supported; missing/invalid provider is actionable; secrets never enter docs/logs/export/public DTO.
- **Test targets:** Mocked provider matrix/settings; live evidence is separately required in LSI-048.
- **Out of scope:** Uploading provider secrets to server storage or claiming mocked live quality.

### LSI-040 General workspaces and management
**Epic:** E · **Type:** Full stack · **Priority:** P1 · **Depends:** LSI-006, LSI-018 · **Status:** Complete
- **Scope:** Existing dashboard/create/select/rename/delete workspace and ordinary chat/canvas/settings routes.
- **Acceptance:** Original IDs/workspaces remain accessible; `ROADMAP_NOT_FOUND` preserves ordinary behavior; delete confirmation, membership, and anchor rules hold.
- **Test targets:** Workspace API/dashboard components and existing-data browser journey.
- **Out of scope:** Replacing old workspace identities or changing canonical URL contract.
- **Evidence:** Identity-preserving rename/delete workspace management with confirm dialog and membership rules, `ROADMAP_NOT_FOUND` ordinary-workspace preservation, protected-anchor cascade, and 3 backend + 5 frontend tests verified in [evidence/LSI-040.md](./evidence/LSI-040.md).

### LSI-041 Search and semantic discovery
**Epic:** E · **Type:** Full stack · **Priority:** P1 · **Depends:** LSI-019, LSI-033, LSI-040 · **Status:** Complete
- **Scope:** Inventory-backed exposed graph/hybrid search and result navigation within authorized scope.
- **Acceptance:** Results are permission-scoped; node/file results open canonical context; empty/error states work.
- **Test targets:** Search API relevance fixture/access and node/file browser navigation.
- **Out of scope:** Enterprise discovery features not already exposed.
- **Evidence:** Permission-scoped workspace search over node + file legs, canonical node/file navigation via URL helpers, palette loading/empty/error states, and 3 backend + 8 frontend tests verified in [evidence/LSI-041.md](./evidence/LSI-041.md).

### LSI-042 Knowledge signals and curator parity
**Epic:** E · **Type:** Full stack · **Priority:** P1 · **Depends:** LSI-035, LSI-038, LSI-040 · **Status:** Complete
- **Scope:** Preserve exposed concepts/mastery/gaps/adopt/recommendation actions through existing services.
- **Acceptance:** Explicit learning signals stay distinct from completion; state persists; actions are authorized and visible.
- **Test targets:** Mastery/curator APIs/components and exposed-action journey.
- **Out of scope:** Inferring mastery from completion or inventing unexposed curator features.
- **Evidence:** `KnowledgeSignalsPanel` over existing mastery/curator/gaps/adopt services with explicit-signal-vs-completion invariants, authorization, persisted state, and 3 backend + 6 frontend tests verified in [evidence/LSI-042.md](./evidence/LSI-042.md).

### LSI-043 Timeline and replay parity
**Epic:** E · **Type:** Full stack · **Priority:** P2 · **Depends:** LSI-012, LSI-018, LSI-042
- **Scope:** Preserve existing timeline/heatmap/replay entry points, state selection, and return to current graph.
- **Acceptance:** History is scoped; playback never mutates current nodes/progress; keyboard exit returns to current view.
- **Test targets:** Timeline projections/permissions and replay/browser restore.
- **Out of scope:** New timeline product behavior.

### LSI-044 Production user preferences
**Epic:** E · **Type:** Full stack · **Priority:** P2 · **Depends:** LSI-002, LSI-004, LSI-039
- **Scope:** Implement only approved missing authenticated preference persistence and port visible theme/reading/motion/hours/tutor-style effects.
- **Acceptance:** Ownership/version validated; promised preferences survive reload/session; unsupported demo-only settings removed.
- **Test targets:** Preference API migration/ownership/concurrency and rendered effects.
- **Out of scope:** Declaring preferences API exists before audit or storing secrets.

### LSI-045 Owned data export and destructive actions
**Epic:** E · **Type:** Full stack · **Priority:** P1 · **Depends:** LSI-033, LSI-040, LSI-044
- **Scope:** Approve versioned export/privacy and reset/delete boundaries using existing deletion services; distinguish local preference reset from account/workspace deletion.
- **Acceptance:** Export includes only caller-owned permitted data and no credentials/provider keys; destructive actions confirm; failures keep UI/data consistent.
- **Test targets:** Schema/privacy/ownership/export/delete tests and confirmation browser journey.
- **Out of scope:** Local-storage dumps as production export or unreviewed data erasure.

### LSI-046 Integrated access, URL, and data compatibility gate
**Epic:** F — Acceptance and cutover · **Type:** QA / Review · **Priority:** P0 · **Depends:** LSI-001–LSI-045
- **Scope:** Validate fresh/existing DB fixtures, migrations, canonical/legacy URLs, membership, public DTO/auth intent security, and stream/job/copy races; request independent review.
- **Acceptance:** Old IDs/links/data preserved, anchor protected, no public private-data leak, applicable gates pass. Existing failures are separately evidenced.
- **Test targets:** Exact commit/environment and pytest/ruff/mypy/vitest/typecheck/Next build results; resolve security regressions and review findings.
- **Out of scope:** Counting historical static baseline as current evidence or changing unrelated failures.

### LSI-047 Accessibility and responsive journey gate
**Epic:** F · **Type:** QA · **Priority:** P0 · **Depends:** LSI-046
- **Scope:** Review guest/private/tutor/branch/generator/files/settings in light/dark, mobile 390px, short viewport, desktop, keyboard, screen reader, and reduced motion.
- **Acceptance:** No overflow, trapped controls, or dead actions; quote/reading position preserved; shared tokens/primitives comply.
- **Test targets:** Automated accessibility plus actual keyboard/mobile/browser evidence at named routes/viewports.
- **Out of scope:** Closing this gate from automated checks alone.

### LSI-048 Live provider and research quality gate
**Epic:** F · **Type:** Evaluation · **Priority:** P0 · **Depends:** LSI-024, LSI-039, LSI-046
- **Scope:** Complete outstanding native provider/researched-roadmap/tutoring evaluations against integrated UI and measure grounding, coverage, clarification, cancellation, recovery.
- **Acceptance:** Redacted real provider/model/run evidence supports product claims; unavailable credentials/provider stays explicitly blocked/unverified. Original roadmap verification closes only on its evidence.
- **Test targets:** Reproduce representative approved research comparisons and live end-to-end journeys.
- **Out of scope:** Treating mocked tests or previous branch verification as live evidence.

### LSI-049 Controlled production cutover
**Epic:** F · **Type:** Release · **Priority:** P0 · **Depends:** LSI-046, LSI-047, LSI-048
- **Scope:** Reviewed parity checklist, rollout switch/default routing, rollback, and observability for auth/streams/jobs/save failures. Keep old UI as rollback until observation passes.
- **Acceptance:** Prior gates have evidence at release SHA; every exposed action works; rollback is exercised without data rewrite.
- **Test targets:** Release build/smoke/rollback and agreed observation record.
- **Out of scope:** Deployment without required authorization or deleting old UI.

### LSI-050 Retire obsolete learner UI and prototype runtime
**Epic:** F · **Type:** Cleanup · **Priority:** P0 · **Depends:** LSI-049
- **Scope:** After cutover, remove obsolete mounts/components/demo routing/Vite scripts/fixtures only when unused; preserve shared primitives/services/tests and URL redirects.
- **Acceptance:** No obsolete entry point/dead import/duplicate store; canonical routes/data unchanged; parity matrix has no unresolved exposed item.
- **Test targets:** Dependency search, affected gates, release smoke, final evidence and commit.
- **Out of scope:** Premature retirement before LSI-049 or deleting reusable production code.

