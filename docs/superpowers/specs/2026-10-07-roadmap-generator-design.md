# Roadmap Generator Agent and shared canvas redesign

Date: 2026-10-07

Status: Design decisions agreed in discussion; written specification awaiting user review.

Scope: Redesigned roadmap generation and learning workspaces, plus replacement of the existing conversation canvas appearance and layout.

## 1. Intended outcome

A learner opens a clean popup, describes what they want to learn, optionally supplies background, time constraints, and references, and starts a dedicated Roadmap Generator Agent. The agent researches the subject, composes a complete curriculum, checks its quality and feasibility, and publishes a new learning workspace.

The workspace offers an ordered roadmap page and a visual canvas backed by the same curriculum. Every actionable topic opens a learning brief and can launch a persistent guided tutoring conversation. Users can track study completion, optionally check understanding, directly edit topics, and request reviewable AI revisions.

The supplied AI Engineer Roadmap PDF is a reference for curriculum depth and organization: a central path, grouped subtopics, prerequisites, alternatives, and further learning. It is not a fixed template for every subject. The generator supports any learning goal, with structures and resources adapted to that subject.

The approved preview's appearance must be preserved. The existing conversation canvas also adopts that appearance, with the main conversation in the center and branches grouped beside their actual origin points.

## 2. Approved decisions

| Area | Decision |
| --- | --- |
| Setup | Focused single popup, option A; optional background and references expand when needed. |
| Inputs | Title, prompt, current level, optional background, optional target duration and hours/week, optional links and files. |
| Subject coverage | Any learning goal; no mandatory AI-engineering-specific phases. |
| Clarification | Ask only when missing information materially changes the curriculum; at most three focused questions per generation request. |
| Research | Thorough by default; a dedicated agent with structured stages and bounded autonomy. |
| Resources | Small curated mix, favoring free material and labeling paid resources. |
| Time feasibility | A realistic core path within the time budget, with further-learning branches outside that budget. |
| Presentation | Both an ordered roadmap page and a canvas, sharing one curriculum and progress record. |
| Schedule | Flexible weekly milestones when a weekly budget is known. |
| Topic interaction | A concise brief first; Start learning opens a guided tutor. |
| Editing | Direct editing plus AI refinement; substantial AI changes are proposed before application. |
| Completion | User marks study completion; optional knowledge checks provide separate evidence of understanding. |
| Background behavior | Visible progress with expandable activity; leaving the popup does not cancel the job. |
| Result ownership | Each generated roadmap has its own workspace. |
| Completion navigation | Open the completed workspace if the user is still watching; otherwise offer Open roadmap without navigating them away. |
| Export | PDF is a reference initially; export is deferred. |
| Existing canvas | Replace its default presentation with the approved design and central-conversation/side-branch layout. |
| Interface principle | Show what helps the learner act now; reveal supporting detail only when requested. |

## 3. Authoritative visual references

- [Approved workspace preview](assets/roadmap-generator/approved-workspace.html): the reference for the roadmap page, canvas styling, learning brief, and refinement interaction. Its curriculum is illustrative, not a researched recommendation.
- [Setup comparison](assets/roadmap-generator/setup-comparison.html): option A is approved; option B is not selected.
- [Approved workspace screenshot](assets/roadmap-generator/approved-roadmap-page.png): captures the page in the in-app browser's narrow viewport.

These are design artifacts, not application components. Their simulated actions, sample text, and inline styles must not be copied into production as fake functionality. Implement the appearance using GraphMind's shared primitives, semantic tokens, real data, and working actions.

### 3.1 Visual language to retain

| Role | Approved light-mode value |
| --- | --- |
| Page background | `#f8f8f7` |
| White surfaces and topic cards | `#ffffff` |
| Navigation background | `#f0f0f0` |
| Canvas background | `#f3f3f1` |
| Milestone cards | `#e7e7e2` |
| View-switch background | `#ecece9` |
| Foreground | `#1a1a1a` |
| Secondary text | `#4d4d4d` |
| Muted text | `#737373` |
| Primary action | `#1a1a19` with white text |
| Borders | Black at 12% opacity; subtle separators at 6% |
| Supporting connectors | Muted gray, as in the approved preview |

Use system sans-serif for controls and content. Preserve the preview's Georgia/serif display treatment for the roadmap title and learning brief. Define approved display sizes through named typography tokens rather than arbitrary utilities scattered through layouts. The preview uses 34px for the roadmap title, 26px for the canvas title, and 27px for a brief title, with smaller responsive title sizing.

Retain 52px headers, 8px control corners, 12px cards/groups, and 16px outer containers. Keep shadows understated. The light-mode preview is the visual acceptance reference; dark mode must use equivalent semantic roles with readable contrast.

Do not bring back galaxy/orb styling, glowing connections, large metadata badges, or a permanently expanded control toolbar as the default canvas experience. Existing advanced capabilities remain accessible through progressive disclosure.

### 3.2 Shared components

Use existing Button, Input, Textarea, Modal, Drawer, SegmentedTabs, Badge, DropdownMenu, and ConfirmDialog primitives. Add focused reusable components for a milestone card, topic row/card, expandable curriculum group, source list, topic brief, and concise job status. Share those components across the roadmap page and canvas where their responsibilities match.

Introduce semantic canvas tokens for the approved background, milestone surface, topic surface, group surface, and connector roles. Color literals belong in theme definitions. Production layout files do not contain the preview's inline color values.

## 4. User journey

### 4.1 Setup popup

The visible fields are an optional title, required freeform learning prompt, current level, optional duration, and optional hours/week. One collapsed Background & references section contains background text, reference links, and file attachments.

The title is not the learning goal. If omitted, the agent suggests an appropriate title; if provided, preserve it unless the user requests a change. Current level means familiarity with the requested subject, not overall experience. The background field can express mixed experience, such as an experienced backend developer who is new to AI.

The form has one primary action: Generate roadmap. Use concise labels and inline validation. Do not add research modes, provider selection, skill selection, mandatory learning-style questionnaires, or a multi-step wizard to this popup.

Initial validation limits are implementation defaults, not extra learner-facing choices:

- Title: up to 180 characters; prompt: 10-8,000 characters; background: up to 4,000 characters.
- Level: beginner, intermediate, or advanced; default beginner.
- Duration: optional positive number with weeks or months; Unsure stores no duration. One planning month represents four study weeks, disclosed under About this plan. No calendar deadlines are assigned.
- Hours/week: optional positive value, 0.5-80, with half-hour increments.
- Duration limit: 1-104 study weeks after normalization. Longer ambitions can be represented by a bounded core journey plus further learning.
- References: up to ten links and five files. Initial file support is text-readable PDF, TXT, and Markdown. Preserve the existing 20MB per-file limit and cap combined staged attachments at 50MB.
- Reject unsupported or unreadable uploads with an actionable inline explanation. Do not silently ignore them. Image-only/scanned PDF interpretation is outside this release.

Links and uploads are processed for a saved job, before a completed workspace exists. The client retains form inputs until the server acknowledges the request. Generation uses an idempotency key, so a double-click or network retry does not create duplicate jobs.

### 4.2 Clarification

The Understand stage determines whether an unanswered question would change the intended outcome, prerequisites, or practical scope. A vague goal may need an outcome question; a detailed prompt can proceed immediately.

Ask one focused question at a time, with two or three useful suggestions and a free-text response. A request can ask at most three questions in total. Do not repeatedly ask about information already present in the prompt or references.

When clarification is needed, the job enters awaiting_input and releases its worker lease. A dashboard status says that an answer is needed. Closing the popup preserves the question. Research resumes only after an answer. If the learner chooses a broad path or remains unsure, record an explicit assumption and continue where that is sufficient.

### 4.3 Generation screen

The accepted popup becomes a resumable progress view. Apply the user's subsequent simplification request: show the title, current stage, one short explanation, and the next useful action. Keep the full stage list and activity hidden by default.

View activity reveals actual tool actions, inspected sources, loaded skill names, and concise work summaries. It must not display private reasoning, raw prompts, or pretend activity. There is no invented percentage or guaranteed completion countdown.

Closing the popup and Continue in background only hide the job view. Cancel generation explicitly stops the job and prevents publication. These actions must be distinct. An in-progress or needs-answer job remains reopenable from the dashboard.

### 4.4 Completion

After successful validation and publication, the workspace opens on the roadmap page if the user is still observing that generation job. If the user has moved elsewhere, show an in-app ready notice with Open roadmap. Do not hijack their current navigation. If the app is closed, the result appears on their next visit; browser push/email notifications are not part of this release.

### 4.5 Roadmap page

Show a display title, one-sentence intended outcome, a compact time/level line, one Start learning or Continue learning action, and a concise progress count. About this plan contains assumptions, feasibility explanation, research sources, and why important curriculum choices were made.

Present phases as expandable cards. Initially expand the phase containing the next suggested topic; other phases stay collapsed. When weekly pacing is known, group actionable topics under week labels and show small effort estimates. Unknown duration or weekly capacity must not create an invented deadline: show ordered phases with effort estimates and an unassigned flexible schedule until the learner supplies pacing through refinement.

Further learning is collapsed by default and clearly outside the core budget. A completion count covers actionable core topics and the chosen alternative path, not every optional branch. Starting a tutor does not mark a topic completed.

### 4.6 Roadmap canvas

The central vertical path contains ordered milestones. Compact topic cards live in named groups beside the relevant milestone. Maintain the approved gray palette, clear spacing, and understated connectors.

Containment, prerequisites, and alternatives are separate semantics. A group connection means belongs to this milestone, not must learn every sibling. Prerequisite relationships are explicit and can cross groups. Alternative groups recommend one route while revealing the other choices on expansion. Do not visually imply that every vendor or tool must be learned.

The production canvas retains actual pan, zoom, fit, selection, drag, and detail-panel behavior. It is not the preview's horizontally scrollable HTML diagram. Use the existing React Flow infrastructure with a new layout adapter and shared card components. At low zoom, simplify groups while retaining their names and path context; do not convert the map into anonymous orbs.

Show fit and basic navigation controls; place layout, minimap, mastery overlay, and timeline options in an optional controls menu. Stable card dimensions and measured group bounds drive a deterministic non-overlapping layout. Opening a drawer adjusts available viewport space. Zoom, streaming tokens, and progress updates do not reset positions or reflow the entire graph.

### 4.7 Learning brief and tutor

Clicking a topic in either view opens the same Drawer-based brief with its title, concise purpose, estimated effort, learning objectives, and a practical exercise. Resources and prerequisites expand separately. Provide Start learning and a quiet completion control.

A guided tutor opens a persistent topic chat with the learner's profile, current curriculum revision, the topic's objectives, relevant prerequisites, selected resources, and progress context. It begins with a manageable lesson rather than an empty conversation or mandatory diagnostic. The learner can interrupt, ask questions, and change the pace.

Reuse the existing chat streaming/runtime capabilities. Create the topic chat lazily and idempotently on first study; reopening a topic returns to its linked conversation. The learner can explicitly start a fresh topic session without overwriting earlier sessions. Branching remains available through normal chat behavior.

Full lesson text is generated on demand. The initial roadmap contains complete structure and concise briefs for all actionable topics, not complete textbooks or empty placeholder leaves.

### 4.8 Progress and optional checks

Study status is not_started, in_progress, or completed. The learner controls completion. The latest quiz/exercise result is separate evidence, with a timestamp and its rubric/result. A user may finish studying without taking a test.

Optional checks use the existing quiz/tutoring capability and preserve evidence in the topic's learning history. Do not infer mastery from messages sent, drawer opens, elapsed time, or a completion click. Existing concept mastery can show separately without overwriting study status.

### 4.9 Refinement and manual edits

Refine accepts a natural-language request and uses the current curriculum, profile, and progress as its starting point. Reuse valid sources; conduct additional research when the requested change requires it. Produce a candidate revision and a concise added/changed/removed summary. Do not apply the change until the user chooses Apply changes.

Direct editing covers titles, brief text, effort estimates, resources, phase/group membership, topic ordering, and weekly assignment. Adding/removing a topic is supported; removing one with learning history archives its participation in the active revision rather than deleting its chats or evidence.

Keep stable topic identities for semantic continuity. A rename or move preserves progress. If a proposed topic is materially different, it receives a new identity and progress is not automatically transferred. A removal warns about the topic's existing history and provides access to it through the archived-topic history.

Structural errors such as cyclic prerequisites block saving. Manual edits that exceed the study budget show an explicit capacity warning and offer schedule refinement; they do not silently modify the weekly budget or continue claiming that the plan fits. Applying AI revisions requires a fully validated candidate.

## 5. Agent architecture and stages

### 5.1 Responsibilities and boundaries

Use one dedicated Roadmap Generator Agent with a structured orchestrator. The agent can choose queries, inspect references, select registered skills, compare evidence, and revisit earlier stages to resolve gaps. The orchestrator owns lifecycle, limits, checkpoints, tool permissions, validation, and publication.

Reuse provider-neutral BaseProvider, ChatMessage, ToolCall/ToolResult, and BaseTool contracts in packages/ai-core. The current chat router's tool loop is a useful existing behavior reference; extract only the reusable execution boundary needed by the roadmap worker rather than duplicating transport-specific streaming code.

No multi-agent research team, general agent platform rewrite, remote skill installation, or browser automation subsystem is required for this feature.

### 5.2 Stage contract

| Stage | Inputs | Saved output and completion condition |
| --- | --- | --- |
| Understand | Request, extracted references, clarification answers | Learning intent, background, known/assumed skills, normalized budget, assumptions, scope. |
| Research | Intent, references, registered skills | Search activity, inspected sources, curriculum comparison, coverage notes, resource candidates and limitations. |
| Compose | Intent and research dossier | Complete hierarchy, topic identities, containment, prerequisites, alternatives, objectives and concise briefs. |
| Personalize | Hierarchy, background and budget | Core/further classification, recommended choices, effort estimates, ordered path and feasible weekly assignment. |
| Validate | Candidate revision and inspected source registry | Structural and workload checks plus a qualitative coverage/source review; valid candidate or explicit issues for bounded repair. |
| Publish | Valid candidate, job and owner | Generation: atomic curriculum/workspace/reference association and canvas anchor. Refinement: saved candidate revision, with the active plan unchanged. Both commit the job result and final event. |

Reference extraction can precede the Understand stage's model call. Every stage saves typed output before advancement. No conversation nodes, final workspace, or active curriculum revision are published while the agent is still researching.

### 5.3 Tools and skills

Provide a job-scoped tool allowlist:

- search_web: discover curriculum and learning-material candidates through a replaceable search backend.
- fetch_source: fetch and extract a selected public source with bounded size/time and preserved headings/sections.
- read_reference: read an owner-scoped staged reference with page/section identifiers.
- list_skills and load_skill: choose from the application's registered skill metadata and load the selected playbook.
- validate_curriculum and calculate_workload: deterministic checks and effort calculations.

Job ownership and permissions are injected by the server, not model-provided arguments. The generator does not receive unrestricted graph-writing tools. Publication happens through the service boundary after validation.

Provide application-owned curriculum-design, research/source-review, workload-planning, and guided-tutoring playbooks. Load core guidance for each job and relevant domain guidance only when registered. Skill discovery is dynamic within that registry; arbitrary downloaded instructions do not become skills.

### 5.4 Search backend

Define a provider-neutral search interface returning result titles, URLs, snippets/grounding references, and provenance metadata. The proposed first adapter uses Gemini Google Search grounding through the already-installed google-genai dependency and configured Google key. Keep this as a separate search invocation behind a tool boundary, so curriculum generation can use another configured LLM provider.

Google's documentation describes google_search and groundingMetadata containing queries, source URLs, and citation supports, and lists Gemini 2.5 Flash as supported. See [official grounding documentation](https://ai.google.dev/gemini-api/docs/generate-content/google-search?hl=en). The existing default model remains a configuration default, not a permanent dependency of the domain model. Verify model availability and API compatibility when implementing and handle missing configuration explicitly.

Retain provider-returned grounding metadata and any required search attribution. Display provider-required attribution with displayed search results in the expanded Sources view. Do not handcraft or discard required attribution. Provider adapter failures are recoverable job errors; no mock research or unannounced source-free fallback is permitted in production.

Search results are candidates, not proof that a URL was inspected. Resolve redirected candidate URLs, inspect useful pages, and record their final URLs and extraction status. A model returning prose without source metadata is not a successful search result.

### 5.5 Source quality

Prefer authoritative/primary material for factual coverage and accessible explanations for the learner's level. Existing roadmaps help compare coverage and ordering; do not simply copy one or concatenate several. A single source may support multiple related topics when its actual sections are relevant.

Each actionable topic should normally have two well-chosen resources and no more than three by default. One qualified resource is acceptable when it is sufficient, with its rationale recorded. An exercise can be generated by the agent and is not required to be a third external resource. Prefer focused topical search queries; do not send whole uploaded documents or unnecessary personal background to the search service.

Every displayed external resource must be tied to a real inspected or provider-grounded source record with access/verification status, title, URL, kind, reason for inclusion, and free/paid/unknown access label. Do not invent resource names, links, or access pricing. Unknown pricing is labeled unknown, not assumed free. Unavailable user references are disclosed and replaced only where another source covers the need.

Source disagreement becomes a short assumption or choice rationale under About this plan. Optional breadth is not promoted into mandatory prerequisites just because a source lists it. Record research date; live price/model/version facts are not hardcoded into the curriculum template.

### 5.6 Workload model

Normalize estimates to integer study minutes. Use effort estimates rather than promising exact mastery time. Weekly capacity equals the provided hours times 60; total capacity equals weekly capacity times normalized study weeks when both are supplied.

Count core actionable topics once, including essential prerequisites and project work. Do not sum container estimates and their leaves, count duplicate shared prerequisites twice, include further-learning branches, or sum every mutually exclusive alternative.

Each choice group has a recommended/selected alternative. Compute the schedule using that selection; choosing another path recalculates capacity and prerequisite validity. Keep common prerequisites outside the choice. Core topics cannot require an unselected alternative or unscheduled further-learning topic. Promote necessary prerequisites into the core or change the planned outcome.

When a topic exceeds a week's capacity, divide its study into ordered sessions/checkpoints while retaining one topic identity. Weekly assignments record session minutes, and the sum of sessions equals that topic's estimate. Each week stays within capacity. Project/review effort must be budgeted, not added outside the calculation.

If only hours/week is supplied, derive a recommended number of flexible study weeks from the core effort and show it as an estimate. If duration is supplied without hours/week, avoid an invented workload: publish an ordered curriculum without a committed weekly schedule, disclose the missing capacity, and let the learner add pacing through refinement. If neither is supplied, show a flexible ordered path and topic estimates.

For an impossible goal/time combination, narrow the core outcome honestly and expose further-learning branches. Explain the achievable outcome under About this plan; do not label a short introduction as complete professional mastery.

### 5.7 Bounded execution

Initial configurable operator defaults: one active job per owner, two worker slots, 20 search-tool invocations, 40 unique source fetches, 48 model invocations, three candidate-repair attempts, and 20 minutes of active execution. These are ceilings, not goals. Clarification waiting does not consume active execution time.

Limit a candidate to 200 actionable topics and six hierarchy levels. If a requested scope exceeds those limits, produce a coherent bounded core with further-learning overview topics; do not silently truncate. Those overview topics also have useful briefs, objectives and resources; deeper breakdown can be requested through refinement. They are not empty placeholders. Resource deduplication and section-aware reuse keep deep curricula within the fetch budget.

Network calls have explicit timeouts. Repeated transport retries are bounded and count toward usage; a retry never bypasses saved limits. Track observed provider usage, search invocations, inspected URLs, and execution time. Replaying saved stage outputs does not repeat successful tool calls unnecessarily.

These defaults are proposed operational settings for review, not additional popup controls or measured performance guarantees. Real research evaluation can tune them before release without changing the learner-facing contract.

## 6. Persistence and revision model

### 6.1 Domain records

| Record | Required responsibility and key fields |
| --- | --- |
| Roadmap | Stable identity, owner, workspace, current revision, profile, canvas anchor chat ID, timestamps. |
| CurriculumRevision | Roadmap, base revision, status (candidate/active/archived/rejected), title, outcome, assumptions, effort summary, validation report. |
| CurriculumItem | Stable topic/group identity, roadmap and creation metadata; identity survives revisions. |
| RevisionItem | Revision and item ID, kind, title/brief/objectives/exercise, ordering, core/further classification, estimate, active/archived participation. |
| CurriculumRelation | Revision-scoped containment, prerequisite, recommended_next, or alternative membership with valid endpoints. |
| ChoiceSelection | Revision, choice-group ID and chosen alternative; alternatives are not normal mandatory siblings. |
| WeeklyAssignment | Revision, week, topic and ordered session minutes. |
| ResearchSource | Owner/job origin, URL or reference-file locator, title, fetched date, access status, extraction/grounding metadata and bounded evidence. |
| TopicResource | Revision/topic/source association, resource kind, relevance rationale, recommended ordering and access label. |
| TopicProgress | Roadmap/topic/owner, study status, completion timestamp; independent of curriculum revision. |
| KnowledgeCheck | Topic, linked tutor session, rubric/result, timestamp and source revision; separate from study status. |
| TopicChat | Roadmap/topic/chat association, session identity and curriculum revision used at creation. |
| RoadmapJob | Owner, operation (generate/refine), typed request, status/stage, checkpoint, usage, lease/cancel data, attempts, idempotency key and result. |
| JobEvent | Job, increasing sequence, stage/type, safe user-facing summary and bounded source/tool metadata. |
| JobReference | Owner/job-scoped staged file or link, extraction status and eventual workspace file association. |

Use typed Pydantic schemas for request, checkpoint, candidate and event payloads. Store relational identities, ownership, revision relationships and progress in SQLAlchemy models with constraints. JSON payloads can hold bounded stage/evidence data; they are not the only source of topic identity or revision membership.

Item kinds are root, phase, group, choice and topic. Only topic items are actionable; a topic can have a concepts, practice or project format. A module is a named group, not a separate storage type. Containment forms a rooted hierarchy. Prerequisites form a separate acyclic graph. Recommended_next defines presentation order and does not become a prerequisite by default. Validate relation semantics explicitly.

### 6.2 Publication and references

Create the workspace, Roadmap, initial active revision, curriculum items, source associations, transferred library references, and canvas anchor in one database publication transaction. Storage files are staged before that transaction; publication associates them without unsafe file moves inside a long SQL transaction. A failed publication leaves staged references retriable.

A unique result association on the generation job enforces one published roadmap/workspace per job. The completed status and final result event commit with publication. Never expose a half-created learning workspace as ready.

Create one normal conversation root node as the roadmap's canvas routing anchor, with metadata pointing to the Roadmap record. Its purpose is routing/integration. The curriculum does not masquerade as assistant messages in one large conversation tree.

### 6.3 Revision concurrency

Manual edits and AI proposals include the base revision ID. Applying an outdated proposal returns a conflict and offers regeneration against the latest revision; it does not overwrite newer edits. Progress changes do not create curriculum revisions or invalidate a proposal's structural base.

On application, preserve stable identities, progress and chat associations. Archive removed revision participation. A candidate that replaces a concept with a different concept must not carry over completion merely because the titles look similar.

Keep the active revision available while refinement runs or fails. A failed refinement never destroys the current usable roadmap. Support undoing the latest applied curriculum revision through a new restoring revision, keeping historical activity and learning evidence intact.

### 6.4 Ownership and reference handling

Authenticate generation and scope every job, reference, source, curriculum, edit and event stream to its owner or authorized workspace member. Do not reuse the old anonymous default-admin behavior for new research jobs. Starting another owner's job, accepting their clarification, reading their uploaded text, or applying their proposal is rejected.

Public source fetching validates URLs and redirect destinations, blocks private/local network addresses, enforces response size/type limits, and does not execute page scripts. User files and webpages are reference data; only registered application skills and the authorized user request supply agent instructions.

Do not log credentials, complete uploaded documents, raw private prompts, or private reasoning. Saved evidence remains access-controlled. Reference and evidence retention follows job/workspace deletion; canceled/failed orphan uploads expire after seven days, with automatic cleanup. Active published references remain with their workspace.

## 7. Background job lifecycle

Use PostgreSQL-backed jobs and a separate worker process. Redis is optional existing infrastructure, not a requirement for initial durability. The database is the authoritative queue and checkpoint store.

Statuses: queued, running, awaiting_input, cancel_requested, canceled, failed, completed. Stage is separate from status. Refinement completion returns a candidate revision instead of publishing it automatically.

The worker claims jobs transactionally with a lease and fencing token, performs external work outside the claim transaction, and periodically records checkpoints/heartbeats. Reclaim an expired lease and resume from the latest complete checkpoint. A stale worker cannot publish after another worker has reclaimed the job. Default lease duration is 60 seconds, with a heartbeat every 15 seconds; long external calls run alongside heartbeat handling.

An interrupted tool/model call may have run remotely without a saved result. Retrying that call can incur another provider invocation; do not claim exactly-once external execution. Make application publication idempotent and record attempts honestly. Cancellation is checked before calls, at stage boundaries and before publication. Late responses after cancellation are discarded for publication.

Persist events before broadcasting them. The API exposes a job snapshot and SSE event replay using sequence IDs/Last-Event-ID. Reconnection and polling fallback read saved state; they do not rerun the agent. Disconnecting a browser does not cancel its worker job.

Retry changes recoverable failed/canceled jobs to queued and preserves validated checkpoints and limits. Exhausted budgets or repair limits require an explicit fresh run instead of a retry that would immediately fail again. Ask for a fresh run if the user wants a different request, a new research budget, or to discard checkpoints. Awaiting-input jobs resume through the clarification endpoint, not a generic retry.

## 8. API and frontend contracts

Use camelCase external schemas consistently with the existing API. The final implementation plan will break these contracts into one task at a time.

| API action | Contract |
| --- | --- |
| Create generation job | POST /api/v1/roadmap/jobs; authenticated request plus idempotency key; returns 202 and job snapshot. |
| Attach reference | POST /api/v1/roadmap/jobs/{jobId}/references; owner-scoped staged upload/link. |
| Start accepted job | POST /api/v1/roadmap/jobs/{jobId}/start; idempotent finalization of references and enqueue. The popup performs create/upload/start as one Generate action. |
| Read/reopen jobs | GET /api/v1/roadmap/jobs and GET /api/v1/roadmap/jobs/{jobId}; list scoped to the current user. |
| Follow activity | GET /api/v1/roadmap/jobs/{jobId}/events; authenticated SSE with replay, heartbeat and safe summaries. |
| Answer clarification | POST /api/v1/roadmap/jobs/{jobId}/answers; validates the current question and resumes once. |
| Cancel/retry | POST /api/v1/roadmap/jobs/{jobId}/cancel or /retry; lifecycle-safe and idempotent. |
| Read curriculum | GET /api/v1/workspaces/{workspaceId}/roadmap; active revision, items/relations, selected alternatives, schedule and progress. |
| Read brief | GET /api/v1/workspaces/{workspaceId}/roadmap/topics/{topicId}; typed brief, resources, prerequisites and linked chat. |
| Save manual edit | POST /api/v1/workspaces/{workspaceId}/roadmap/revisions; base revision plus typed patch, validated into an active revision. |
| Request AI refinement | POST /api/v1/workspaces/{workspaceId}/roadmap/refinements; base revision plus instruction; returns job. |
| Apply/restore revision | POST /api/v1/workspaces/{workspaceId}/roadmap/revisions/{revisionId}/apply or /restore; optimistic concurrency and ownership checks. |
| Update study status | PATCH /api/v1/workspaces/{workspaceId}/roadmap/topics/{topicId}/progress; independent status operation. |
| Open tutor | POST /api/v1/workspaces/{workspaceId}/roadmap/topics/{topicId}/sessions; idempotent default-session creation or explicit new session. |

Creation returns a queued job with startupReady=false until references are finalized; the worker only claims queued jobs with startupReady=true. The active-job limit is enforced when start reserves a runnable job and includes awaiting-input jobs, not abandoned startup records. Abandoned setup jobs expire after 24 hours and clean their orphan references. A request without attachments still calls start immediately. This avoids processing incomplete uploads without exposing a second user action.

During migration, keep /roadmap/generate as a documented compatibility path until its consumers are updated. The production popup switches to the job contract. Remove the old generic programming fallback and fixed AI-engineer scaffold from the active generation path; deterministic fallback fixtures remain limited to tests/demo content.

Error payloads expose a stable code, concise message, recoverability, and next action. Candidate validation details belong in expanded activity/edit feedback, not a wall of text in the default popup.

### 8.1 Routes and shell

| Screen | Canonical route |
| --- | --- |
| Roadmap landing | /w/{workspaceId} for a roadmap workspace |
| Roadmap canvas | /w/{workspaceId}/chat/{canvasAnchorChatId}/canvas |
| Topic tutor | /w/{workspaceId}/chat/{topicChatId} |
| Topic chat canvas | Existing chat canvas path for that topic chat |
| Library | Existing workspace library path |

The workspace shell distinguishes roadmap landing, roadmap canvas anchor and ordinary topic chats. The roadmap header switches between the landing and its canvas anchor. Ordinary chat/canvas switching retains the existing URL behavior. Brief selection is transient selection, not a substitute for the workspace or chat path.

Construct links through @/lib/urls, use Next router.push/replace, retain legacy redirects, and update docs/URL_DESIGN.md when implementation adds roadmap-specific landing/anchor semantics. Do not add primary workspace/chat IDs or view mode to query parameters or cookies.

## 9. Existing canvas replacement

The same visual components support a conversation layout adapter and a curriculum layout adapter. Replace the existing default canvas presentation, not just add an optional theme users must find.

For an ordinary chat, the center represents the original main conversation in ordered segments. Branch groups attach to the actual message/segment where branching occurred. Nested branches stay attached to their actual parent and can expand progressively. Selecting another branch highlights its lineage without promoting it to the center or rearranging the whole workspace automatically.

Derive segments from actual branch-origin boundaries and message order, retaining stable source IDs. Use existing thread extraction/lineage behavior as the basis; do not invent curriculum milestones or fabricate semantic group labels for arbitrary chats. A group may use its existing thread title or highlighted branch context. Opening a card resolves to the existing conversation detail/side-peek behavior, not a learning brief unless it is a real curriculum topic.

Changing rendering/layout does not rewrite messages, parent IDs, branch origins, or mastery records. Preserve streaming updates, branch creation/deletion confirmation, keyboard navigation, deep links, side-peek and switching to chat. Deleting a group maps to the existing branch deletion semantics; decorative containment is not a new destructive data boundary.

Introduce a layout version so old saved viewports/positions are not mistaken for the new layout's geometry. On first adoption of the new layout, compute and fit the new layout; retain old saved data until the new positions are saved successfully. Preserve user-adjusted positions during ordinary updates; auto-layout is an explicit action, and new groups receive collision-free positions without resetting unrelated groups.

The existing GraphCanvas, ThreadGraphNode, treeToGraph and layoutEngine responsibilities need targeted separation into projection, layout, rendering and controls. Limit this refactor to enabling the approved shared canvas; do not rewrite unrelated chat/business logic.

## 10. Validation and acceptance

### 10.1 Deterministic curriculum checks

- IDs are unique and every relation/session/resource points to a valid record.
- Containment is rooted, reachable and acyclic, with valid item kinds and parentage.
- Prerequisite DAG is acyclic and respects selected alternatives and core/further boundaries.
- Recommended ordering and weekly sessions respect prerequisites.
- All actionable topics have useful nonempty objectives, a concise brief, practice and at least one qualified resource association.
- Estimates are positive study minutes; containers do not double-count their leaves.
- Weekly assignments sum to topic effort and remain within provided capacity.
- Selected alternatives are valid; no schedule requires every mutually exclusive option.
- Provider-produced sources resolve to the inspected/grounded source registry; unsupported source IDs or invented URLs fail validation.
- Archive/identity rules preserve progress and tutoring associations through rename, move, deletion and restoration.

### 10.2 Qualitative agent review

Evaluate whether the curriculum addresses the stated outcome, respects existing knowledge, covers necessary prerequisites, avoids redundant breadth, uses relevant accessible resources, and explains realistic limits. A deterministic graph passing does not prove educational quality; perform a distinct source/coverage review before publication.

There is no fixed requirement for AI Engineer phase names, a universal minimum of ten topics, or an identical fallback curriculum across subjects. The topic count follows the scope and budget within configured ceilings.

### 10.3 Verification strategy

| Layer | Required checks |
| --- | --- |
| Domain | Malformed hierarchy, dangling IDs, cycles, unreachable items, invalid choices, workload arithmetic, prerequisite/session ordering and invalid source associations. |
| Orchestration | Real stage transitions with mock provider/search tools; clarification only when needed; source failure, repair exhaustion, timeout, cancellation and saved usage limits. |
| Persistence | Atomic publication, duplicate request/start/retry, worker lease expiry and fencing, staged-upload association, revision conflicts, archival history and owner isolation. |
| UI | Focused popup validation, expand/collapse, waiting clarification, reconnect, background continuation, contextual completion navigation, shared page/canvas selection and progress, refinement preview/apply. |
| Canvas regression | Original branch relationships, stable segment/group IDs, non-overlap on nested/wide graphs, no reflow on zoom/token updates, drag preservation, fit/pan/zoom, side-peek, delete confirmation and URL behavior. |
| Tutor/progress | Topic-context injection, session reuse/new-session behavior, independent completion/evidence and progress preserved through revisions. |
| Visual | Compare implemented light mode with approved artifacts at desktop and narrow widths; verify dark tokens, contrast, keyboard focus and drawer responsiveness. |

Run relevant pytest, ruff, mypy, vitest, frontend type checks and Next build for each implementation slice. Record unrelated baseline failures explicitly; do not claim all checks pass when they do not. Use deterministic fixtures for routine tests, not paid external calls.

Before release, review real research outputs for at least a practical technical goal, a nontechnical learning goal, a learner with substantial prior knowledge, and an unrealistic short time budget. Use a source/coverage/feasibility rubric and inspect the selected links. This is a bounded manual quality evaluation, not an unbounded automatic research benchmark.

## 11. Delivery decomposition

This specification defines the target feature, not authorization to implement every part in one batch. Follow AGENTS.md: one active implementation task, explain its concrete approach, obtain alignment, implement, verify and commit.

Suggested sequence for the subsequent implementation plan:

1. Shared canvas design and conversation layout replacement, preserving existing behaviors.
2. Typed curriculum/revision/progress model, migrations and projection contracts.
3. Durable jobs, staged references, worker lifecycle and event replay.
4. Real search/source tools, registered roadmap skills and stage orchestrator with validation.
5. Focused popup, concise generation status and contextual publication navigation.
6. Roadmap landing and curriculum canvas using the approved shared visual components.
7. Learning briefs, linked guided tutor sessions and completion/optional evidence integration.
8. Manual edits, AI revision proposals, conflict handling and history restoration.
9. Integrated quality, responsive/dark-mode and regression verification.

Each delivered slice must be functional and reviewable. Do not expose unfinished future actions or placeholder panels in the application. Dependencies between slices must be reflected in the detailed implementation plan. The existing canvas request is first in this suggested sequence so the independently usable visual improvement can ship before the full generator.

## 12. Excluded from this release

PDF export; calendar dates/reminders; browser push/email notifications; sharing/public roadmap publication; multiple roadmaps in one workspace; multiplayer editing; a multi-agent research team; autonomous installation of remote skills; full pre-generated courses; mandatory diagnostic tests; assessment-gated progression; automatic mastery claims; scanned/image-only PDF interpretation; and new authentication/billing/provider-selection interfaces.

## 13. Current-code findings and review boundary

The current RoadmapModal sends goal/level/focus to /roadmap/generate. RoadmapService performs a single model call and materializes topics as conversation nodes, with a generic programming fallback when generation fails. RoadmapAgentService is a separate fixed AI Engineer scaffold, with simulated stage output and no real search orchestration. Its validator imposes AI-specific phases and a fixed topic minimum.

The current GraphCanvas uses React Flow, thread projection and Dagre layout, with zoom-dependent capsule/orb/detailed rendering, a toolbar, mastery overlays and timeline replay. Those existing capabilities inform regression requirements; the preview does not itself implement them.

The approved HTML is the appearance/interaction reference. Sample curriculum estimates, tutoring text and resources in that HTML are not agent output or final learning content. Operational ceilings and the first search-adapter proposal are explicit technical defaults in this document, available for adjustment during written-spec review.

After the user reviews and approves this written specification, invoke the writing-plans skill to produce a detailed implementation plan. Do not start application implementation merely because this design document has been committed.
