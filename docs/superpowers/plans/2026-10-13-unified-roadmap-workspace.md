# Unified Roadmap Workspace Implementation Plan

Date: 2026-10-13

Status: The user approved implementation of this plan, including parallel multi-agent execution on `codex/unified-roadmap-workspace`. Tasks 1–6 are implemented. Task 7's automated gates and core integrated browser journey are verified; the broader manual browser matrix and live-provider/research checks remain unverified. See [verification record](../../quality/unified-roadmap-workspace-2026-10-13.md). Implementation landed in grouped backend/frontend commits rather than one commit per task.

## Outcome and approved direction

A generated roadmap opens a workspace where the learner can resume topic lessons, start general conversations, and branch from messages using the existing chat engine. The roadmap organizes learning within the workspace. Users experience one workspace with connected roadmap, conversation, and canvas views.

Use separate topic conversations plus general workspace conversations. Keep curriculum relationships and message ancestry as distinct domain relationships. A branch inherits its conversation's topic context; it becomes a roadmap topic only through a reviewed addition. Completing a conversation or creating a branch never automatically completes a topic or claims mastery.

References:

- [Repository working protocol](../../../AGENTS.md).
- [Canonical URL contract](../../URL_DESIGN.md), especially section 11.
- [Existing approved roadmap design](../specs/2026-10-07-roadmap-generator-design.md).
- [Existing roadmap implementation plan](2026-10-07-roadmap-generator.md).
- [Current milestone and verification status](../../ROADMAP.md).

This is a follow-on to the shared canvas and roadmap delivery. Preserve its outstanding research-quality verification and whole-branch review; this plan does not mark that work complete or replace its active task.

## Existing implementation to reuse

| Existing behavior | Source | Implication |
| --- | --- | --- |
| Publication atomically creates a workspace, curriculum, and protected canvas anchor. | `apps/api/src/services/roadmap/publication.py` | No roadmap-to-workspace conversion migration is needed. |
| One roadmap belongs to one workspace; revisions and stable topic identities are persisted separately. | `apps/api/src/models/roadmap.py` | Retain the current ownership and revision model. |
| `TopicChat` associates a topic, learner, revision, and chat root; primary and fresh sessions already exist. | `apps/api/src/services/roadmap/tutor.py` | Reuse topic sessions rather than introducing another conversation engine. |
| Chat endpoints build server-verified topic context from the session or root association. | `apps/api/src/routers/chat.py` | Extend verification and budgeting at the shared context boundary. |
| Highlight and nested branches use the current tree and carry `topicSessionId`. | `ChatContainer.tsx`, `useChatStream.ts` | Verify and repair gaps rather than rebuilding branching. |
| General chat creation is hidden whenever a roadmap is loaded. | `apps/web/src/components/chat/ChatContainer.tsx` | Restore a working creation flow before exposing the action. |
| The current new-chat handler clears the tree and navigates to workspace landing. | Same file, `handleNewChat` | Simply exposing the button would return a roadmap workspace to its roadmap. |
| Chat creation callbacks currently persist nodes without awaiting the user-root save. | Same file, `handleSendMessage`; `useChatStream.ts` | New chat navigation must wait for a durable root and recover from save failures. |
| Roadmap edits, candidate revisions, proposal review, stale-write checks, and archived lessons exist. | `services/roadmap/revision_service.py`, `routers/curriculum.py` | Reuse these boundaries for changes originating from exploration. |

Frontend filenames without a directory in this table are under `apps/web/src/components/chat/` or `apps/web/src/hooks/` as appropriate.

## Domain and navigation decisions

1. **Workspace is the container.** It owns files and conversation trees and may contain a published roadmap. Generation continues to publish one new workspace. No eager general-chat or empty lesson creation for every topic.
2. **Curriculum items remain curriculum items.** `contains`, `prerequisite`, `recommended_next`, and `alternative` remain curriculum relations. `NodeModel.parent_id` continues to describe message ancestry only. Never attach lesson roots to curriculum topics or the structural canvas anchor through `parent_id`.
3. **Topic context belongs to the chat root.** A `TopicChat` record is authoritative. Descendant branches resolve through that root; copying topic metadata to every message is unnecessary. A general conversation has no `TopicChat` and does not gain one through client-supplied metadata.
4. **General conversations can discuss several topics.** They receive verified workspace context and explicitly selected relevant topics; they do not become guided lessons or receive lesson-start, completion, or assessment controls.
5. **Promotion preserves conversation identity.** Adding an explored branch to the roadmap creates a new stable curriculum identity and a provenance association. It does not reparent messages, reassign the originating lesson, or duplicate the conversation tree. Learning the new topic uses its own primary topic session.
6. **Workspace landing remains authoritative.** `/w/{workspaceId}` renders the roadmap when one exists. Chats use `/w/{workspaceId}/chat/{chatId}` and their canvases append `/canvas`. The roadmap canvas continues to use the published anchor. Use `@/lib/urls` and Next.js router methods; retain legacy redirects.
7. **Keep both graph projections.** The roadmap canvas shows curriculum relationships; a chat canvas shows its message tree. Topic cards and chat context provide working navigation between them. Combining every conversation into one workspace-wide canvas is deferred.

## Delivery sequence

The original delivery sequence and ownership boundaries are retained below as the implementation record. The user authorized the complete plan and parallel execution, so the tasks were implemented on one shared branch. Do not treat unchecked verification as complete.

### Task 1 — Enable reliable general conversations in roadmap workspaces

**Status: Implemented.** Persisted-first creation, selected-topic preferences, prepared-root streaming, explicit recovery, and navigation guards are covered by focused frontend tests and the integrated local walkthrough. See the verification record for current suite results.

**User behavior:** From a roadmap workspace, New chat opens a focused composer. Submitting the first message saves a new general conversation in that workspace and opens its canonical URL. Canceling leaves the current view intact. Topic lessons continue to resume normally.

**Primary files:** `apps/web/src/components/chat/ChatContainer.tsx`, `ChatSidebar.tsx`, `apps/web/src/hooks/useChatStream.ts`, `apps/web/src/lib/workspaceApi.ts`; create `apps/web/src/components/chat/NewWorkspaceChatModal.tsx` and a focused creation coordinator hook if needed. Touch `apps/api/src/routers/workspaces.py` or `services/workspace_service.py` only if existing root creation cannot meet the persistence contract.

- [x] Build the focused composer with existing `Modal`, `Input`/chat composer, `Button`, and feedback primitives. No new primary route or empty system message masquerading as a chat.
- [x] Prepare one root with the actual first user message, a stable request-scoped node ID, `parent_id=None`, and no topic-session metadata. Await a successful authenticated save before navigating.
- [x] Extend the streaming hook with an explicit prepared-user-message path so starting the response reuses that saved root exactly once. Do not use `lessonStart` for general messages. Scope retries to the same root; do not promise automatic exactly-once provider execution after reload.
- [x] Keep creation state independent from the previously open lesson. A late save must not overwrite a subsequently selected workspace or hijack navigation. Disable duplicate submits; retain input on save failure. An unanswered saved root remains resumable with an explicit response/retry action after refresh.
- [x] Enable the sidebar, header, and existing keyboard creation actions after the complete flow works. Respect workspace write access and ongoing streaming behavior. Use `router.push` for user selections, including touched existing chat-selection code; use `replace` for initial resolution only.
- [x] When deleting the last visible conversation, return to the roadmap landing in a roadmap workspace rather than opening a creation modal or deleting the anchor. Preserve ordinary workspace behavior.
- [ ] Verify creation, failed save, canceled modal, duplicate submission, reload of an unanswered root, navigation during save, read-only access, and lesson-to-general-chat switching with no stale topic-session ID.

**Acceptance:** One first prompt creates one durable general root in the same workspace, opens its real chat URL, streams one answer through the existing engine, and remains accessible after refresh. The roadmap remains intact.

**Commit:** `feat: enable general chats in roadmap workspaces`

### Task 2 — Make topic conversations and resume paths visible

**Status: Implemented.** Server-derived topic associations and topic-history navigation are covered by the frontend/backend suites; the full isolated API and ai-core suites passed (539 tests, two pre-existing warnings).

**User behavior:** The workspace sidebar distinguishes general conversations from topic conversations. Topic briefs offer Continue lesson, saved session history, and an explicit New conversation action. Renamed and archived topics retain their history.

**Primary files:** `apps/api/src/schemas/workspace.py`, `services/workspace_service.py`, `services/roadmap/tutor.py`, `routers/curriculum.py`; `apps/web/src/lib/workspaceApi.ts`, `roadmapTypes.ts`, `roadmapApi.ts`, `components/chat/ChatSidebar.tsx`, `ChatContainer.tsx`, `components/roadmap/TopicBriefDrawer.tsx`, `TopicRow.tsx`.

- [x] Add optional typed topic-association data to chat summaries, derived from server-side `TopicChat` and curriculum identities. Include session ID, stable topic ID, current title or archived title, and archived state only when the actor may access that lesson. Ordinary summaries remain compatible.
- [x] Batch-load associations and titles; avoid a database query or topic-session HTTP fetch per row. Keep the structural anchor excluded. Do not expose another learner's private lesson association through the workspace list.
- [x] Add a bounded topic-session history read endpoint under the existing curriculum router. Reuse current session ownership rules, deterministic ordering, and primary/fresh creation semantics. Define a typed lightweight summary rather than returning every knowledge check for each history row.
- [x] Group accessible chats into General conversations and Topic conversations, with pinned ordering retained within each group. Keep topics without sessions in the roadmap; do not generate hundreds of empty sidebar rows.
- [x] Opening a topic resumes its primary conversation; New conversation explicitly requests `fresh=True` with a stable idempotency key for that action. Show archived lessons as resumable history without offering new archived-topic sessions.
- [x] Retain rename, pin, delete, collapsed-sidebar, and mobile behavior. Resolve loading/error states without briefly classifying a lesson as a general chat.
- [ ] Verify classification from database associations rather than forged metadata; primary resume, multiple sessions, renamed/archived topics, deletion and recreation of a primary session, learner privacy, and efficient query behavior.

**Acceptance:** Users can locate a topic's saved conversation and return to the roadmap without losing branches or starting a duplicate lesson. Existing plain workspaces still display their conversations correctly.

**Commit:** `feat: connect topic conversations to workspace navigation`

### Task 3 — Verify topic inheritance across every branch entry point

**Status: Implemented.** Completion and stream share the persisted conversation-context resolver; frontend callers await message persistence before requests. The full isolated API and ai-core suites passed (539 tests, two pre-existing warnings).

**User behavior:** Branching from a topic explanation retains the lesson's topic and relevant ancestor messages, including nested branches and branches reopened from the canvas.

**Primary files:** `apps/api/src/routers/chat.py`, `services/roadmap/tutor.py`; create a focused `services/roadmap/conversation_context.py` module if needed; `apps/web/src/components/chat/ChatContainer.tsx`, `apps/web/src/hooks/useChatStream.ts`, `useTopicSession.ts`. Reuse `packages/ai-core/src/ai_core/lineage.py`.

- [x] Centralize authenticated conversation-scope resolution for streaming and nonstreaming completion. Treat session ID and client tree data as hints, never proof of ownership or topic membership.
- [x] Verify the persisted root, branch origin, and parent membership against the requested workspace. Resolve the topic association from the real root and enforce existing learner/session permissions. Ensure a new branch's user node is saved before server ancestry verification needs it.
- [x] Audit main-thread input, highlighted branches, nested side-peek, canvas actions, and restored deep links. All use the same root association and retain highlighted context and actual message ancestry.
- [x] Clear session state on chat/workspace changes and reject late responses from previously active sessions. General branches remain general; no metadata copied from the previous lesson.
- [x] Preserve the original recorded topic when it is archived and current topic context when its stable identity remains active. Keep revision provenance available without injecting entire historical curricula.
- [x] Apply an explicit combined input budget to learning context and lineage, reserving space for the prompt and response. Bound evidence and prerequisites; omit optional context before losing the current question or branch origin. The existing lineage budget alone does not cover appended curriculum context.
- [ ] Verify actual provider-bound messages with a mock provider: correct ancestors and topic, no sibling branch or unrelated chat, nested/reopened branches, archived topics, forged session/root/parent IDs, and total context bounds.

**Acceptance:** Every supported branch surface receives the same authorized topic association and correct ancestor path. Cross-chat and cross-workspace claims are rejected rather than silently falling back.

**Commit:** `fix: preserve verified roadmap context across chat branches`

### Task 4 — Ground general conversations in the workspace roadmap

**Status: Implemented.** Root topic preferences are persisted and revalidated against the active curriculum on requests. The initial selector allows up to three topics and defaults to none.

**User behavior:** General chat can answer questions about the learning goal and compare selected topics. A user can select relevant roadmap topics while continuing an ordinary conversation.

**Primary files:** `apps/api/src/routers/chat.py`, `services/roadmap/conversation_context.py`, `services/roadmap/curriculum_repository.py`; `apps/web/src/components/chat/NewWorkspaceChatModal.tsx`, `ChatContainer.tsx`, `apps/web/src/hooks/useChatStream.ts`, and an existing context selector or focused shared topic selector.

- [x] Add a bounded optional `roadmapTopicIds` request field, with at most three selected active topics. Validate IDs against the actor's current workspace roadmap. Return a clear error for invalid IDs; never trust supplied topic text or progress.
- [x] For general conversations, provide the verified goal/outcome, learner profile, compact actor-scoped progress, and selected topic briefs, resources, and immediate prerequisites. With no selection, include the workspace goal and a compact next-topic summary, not the full curriculum.
- [x] Keep selected topics as conversation context preferences, separate from `TopicChat`. Persist preferences on the general chat root through an authorized metadata update and validate them anew on every request; branches inherit the same preferences. An archived selection is surfaced for removal and excluded from active context.
- [x] Use the shared combined input budget from task 3. Treat source evidence and uploads as untrusted reference data; reuse existing provider abstractions and structured errors.
- [x] Do not query or inject unrelated conversation transcripts. Automatic semantic topic selection and cross-chat summaries are deferred; explicit selection makes the first release predictable.
- [ ] Verify root and branch context, selected-topic persistence, no guided-lesson startup or completion side effects, renamed/archived selections, roadmap-free workspaces, authorization, and bounded large-roadmap input.

**Acceptance:** A general conversation can discuss the workspace plan and selected topics through the existing chat engine without changing learning progress or exposing other conversations.

**Commit:** `feat: ground workspace chats in selected roadmap topics`

### Task 5 — Prepare reviewed roadmap additions from exploration

**Status: Implemented.** Typed source provenance, additive proposal validation, and review/apply handling are present. The full isolated API and ai-core suites passed (539 tests, two pre-existing warnings); Ruff, mypy comparison, and migration round trip also passed.

**User behavior:** A user selects an explored branch and requests a proposed addition to the roadmap. The request prepares a reviewable change with a source-conversation link; the active roadmap remains unchanged until the proposal is applied.

**Primary files:** `apps/api/src/models/roadmap.py`, `schemas/roadmap_edit.py`, `schemas/roadmap_job.py`, `routers/curriculum.py`, `services/roadmap/revision_service.py`, `job_repository.py`, `publication.py`, `prompts.py`, `validation.py`; create `services/roadmap/promotion.py` and an additive Alembic migration for typed topic provenance.

- [x] Define a typed promotion request containing workspace-scoped source chat/node IDs, target curriculum container, base revision, optional user instruction, and an idempotency key. Bound the source excerpt and ancestry; validate their persisted membership and the actor's read/write permissions before any model call.
- [x] Add a typed `CurriculumTopicOrigin` association scoped to a stable curriculum topic and its creation revision. Preserve source chat/node references independently of message parents. Nullable source foreign keys use `SET NULL` on conversation deletion; the topic and revision survive with a source-unavailable state. Match existing ID column types and database conventions.
- [x] Feed a server-created source snapshot into the existing refinement job/checkpoint path. Existing unrelated items and stable IDs must remain unchanged for an additive promotion; reject unexplained removal or remapping. A new concept receives a new identity rather than inheriting the source lesson's progress.
- [x] Generate a complete topic draft using existing curriculum contracts: title, brief, objectives, exercise, effort, placement, prerequisite/resource proposals, and their rationale. Reuse research/reference inspection where needed; a transcript is provenance, not automatically verified research evidence.
- [x] Run normal structural, resource, and workload validation. Preserve a reviewable capacity warning/change when the proposed addition affects pacing; do not silently squeeze the existing schedule or expose an invalid candidate as applicable.
- [x] Persist the candidate revision and provenance atomically when publishing the proposal. Review shows the source and diff. Apply/reject uses existing revision conflict and history-preservation rules; retry cannot produce duplicate jobs or topics. Only origins included in the active revision appear in active roadmap responses.
- [x] Preserve source conversation/root/topic associations. Test source deletion before apply, rejected proposals, archived topics, stale base revision, cross-workspace origins, read-only users, same-key retries and conflicting input, generation failure, and migration upgrade/downgrade on isolated data.

**Acceptance:** The backend produces one validated candidate addition with trustworthy provenance, preserves the originating branch, and changes the active roadmap only through explicit proposal application.

**Commit:** `feat: propose roadmap topics from conversation branches`

### Task 6 — Expose branch promotion and provenance in the connected UI

**Status: Implemented.** Promotion from a general-chat nested branch was reviewed and applied in the isolated browser walkthrough. Following the origin link reopened the nested branch; the promoted topic's own lesson streamed, survived reload, and offered its saved primary session for resume.

**Primary files:** `apps/web/src/components/chat/ChatContainer.tsx`, existing message/branch action components, `components/roadmap/RevisionProposal.tsx`, `RefinementModal.tsx`, `TopicBriefDrawer.tsx`, `TopicRow.tsx`, `lib/roadmapApi.ts`, `roadmapTypes.ts`, `lib/urls.ts`.

- [x] Add Add to roadmap only for a persisted, accessible branch in a roadmap workspace with write access. Use a shared modal to choose placement and provide the instruction; no action appears before task 5 is working.
- [x] Reuse resumable job status/activity and proposal review. Display the proposed topic, origin, prerequisites/resources, affected schedule, and the actual diff. Apply and reject operate on the recorded base revision.
- [x] After application, expose a working source-conversation link through canonical URL helpers, targeting the recorded node. A `node` deep link to a nested branch opens its branch ancestry. The browser walkthrough followed the link and verified the actual nested side peek, then started the new topic's saved primary lesson and reloaded/resumed it. Deleted-source display remains covered by backend tests, not this browser walkthrough.
- [ ] Keep workspace/roadmap/chat context visible through existing shell and shared primitives. Preserve standard header heights, semantic tokens, typography, accessible controls, dark mode, and responsive behavior.
- [ ] Verify promotion from nested side-peek and canvas branches, canceled/retried jobs, navigating away during generation, stale proposal recovery, source deletion, and no automatic completion or conversation reparenting.

**Acceptance:** A learner can move from roadmap to lesson to branch to reviewed roadmap addition and back to its source within the same workspace. Every exposed action performs its real operation.

**Commit:** `feat: connect branch exploration with roadmap review`

### Task 7 — Verify the connected journey and update contracts

**Status: Core verification complete.** Full frontend/shared/API/ai-core suites, typechecks, production build, Ruff, matching mypy comparison, and migration round trip passed; mypy diagnostics match the main baseline. The local browser journey reached proposal Apply, followed its origin to the actual nested branch, and started/reloaded/resumed the new topic lesson using a clearly labeled scripted worker fixture. The broader manual browser matrix and live-provider/research checks remain unverified. Initial verification used isolated databases; the later development schema repair is recorded in the quality report.

**Primary files:** existing backend/frontend integration suites; `docs/URL_DESIGN.md`, `docs/ROADMAP.md`; create `docs/quality/unified-roadmap-workspace-2026-10-13.md` with actual results and limitations.

- [ ] Exercise the complete journey: publish workspace; general chat; primary topic lesson; nested highlight branch; reload and resume; selected-topic general discussion; propose/apply addition; follow origin; start new-topic lesson; archive a topic; resume its historical lesson.
- [ ] Verify privacy/write permissions, stale revisions, duplicate requests, provider/save failure recovery, rapid chat/workspace switches, browser back/forward, canvas switching, last-chat deletion, anchor protection, and source deletion.
- [ ] Verify ordinary workspaces and existing legacy redirect behavior. Confirm no placeholder sidebar topics, duplicate roots, synthetic curriculum messages, or hidden persistence failures were introduced.
- [x] Run relevant backend, ai-core, and frontend suites plus ruff, mypy, TypeScript checking, and a production build. Record actual failures and baseline limitations; never label unchecked behavior verified.
- [x] Perform a real local UI walkthrough with deterministic provider fixtures where practical and verify refresh. The walkthrough covered persisted-first general chat, nested-branch promotion, Apply, origin navigation back to the actual branch, and new-topic lesson reload/resume. Light/dark mode, keyboard-only use, responsive sidebar/modals, and live research evaluation remain unverified.
- [x] Update URL documentation with creation/resume behavior and source-node navigation without changing the canonical hierarchy. The roadmap records implementation and verification state while preserving the active research-quality gate.

**Acceptance:** The complete connected journey passes and the verification record identifies exactly what was exercised. Outstanding checks remain explicitly outstanding.

**Commit:** `test: verify unified roadmap workspace journeys`

## Verification protocol

For each implementation task, select focused existing suites and add behavior tests only where needed. Likely suites include:

- Backend: `apps/api/tests/test_workspaces.py`, `test_workspace_rbac.py`, `test_chat_stream.py`, `test_chat_completions.py`; `apps/api/tests/roadmap/test_tutor.py`, `test_curriculum_api.py`, `test_publication.py`, `test_revisions.py`, `test_refinement.py`, and `test_end_to_end.py`.
- Frontend: `apps/web/src/components/chat/__tests__/chat-container.test.tsx`, `chat-sidebar.test.tsx`, `canonical-chat-contract.test.tsx`, `cross-surface-learning.test.tsx`; `apps/web/src/components/roadmap/__tests__/topic-learning.test.tsx`, `roadmap-journey.test.tsx`, `revision-history.test.tsx`; `apps/web/src/hooks/__tests__/useChatStream.lesson.test.tsx` and focused tests for the new creation path.
- Domain: `packages/ai-core/tests/test_lineage.py` and `test_tree.py`.

Backend fixtures require `ENVIRONMENT=test` and an explicitly configured isolated PostgreSQL database whose name ends in `_test`. Confirm this before running any API test or migration; never substitute the development database. Commands below assume the task-specific variable `GRAPHMIND_TEST_DATABASE_URL` has been configured safely:

```sh
ENVIRONMENT=test DATABASE_URL="$GRAPHMIND_TEST_DATABASE_URL" uv run pytest apps/api/tests/roadmap/test_tutor.py -q
uv run pytest packages/ai-core/tests/test_lineage.py packages/ai-core/tests/test_tree.py -q
uv run ruff check apps/api/src apps/api/tests packages/ai-core
uv run mypy apps/api/src packages/ai-core/src
pnpm --filter @graphmind/web test
pnpm --filter @graphmind/web typecheck
pnpm build
```

Scale the pytest selection to changed behavior and run the combined relevant suites at task 7. Investigate existing build isolation requirements before executing a production build alongside a running development server. A documentation-only planning change needs Markdown/link and diff checks, not these runtime suites.

## Scope limits and data compatibility

- No data merge, replacement roadmap generator, or second conversation framework. Existing workspaces, roots, lessons, progress, revisions, and canvas anchors keep their identities.
- No migration for task 1 merely to distinguish general conversations. `TopicChat` remains the authority for topic association; provenance adds schema only when task 5 needs it.
- Generating a roadmap into an existing blank workspace or converting a general chat into a roadmap requires a separate design because current publication creates a new workspace. Moving chats between workspaces and multiple roadmaps per workspace are deferred.
- Automatic branch promotion, automatic mastery/completion, global conversation injection, a merged workspace-wide graph, sharing, reminders, and collaborative lesson visibility changes are deferred.
- Promote one additive topic per request initially. Reuse existing researched resources and refinement machinery; do not introduce another autonomous agent runtime.

## Implementation authorization record

The user explicitly authorized implementation of the plan and parallel multi-agent work. Task 1 used a focused composer, awaited persistence of the actual first user root, a prepared-message stream path, and canonical router navigation. That authorization covered the implementation tasks in this plan; verification status remains governed by the evidence in the linked quality record.
