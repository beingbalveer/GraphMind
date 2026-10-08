# Roadmap generator — implementation decision audit

Every recorded ruling is preserved below in execution order, including its cost if wrong.

- Ruling: Continue both linked plans on the requested branch with one implementation task at a time; primary checkout is the only sandbox-writable project checkout — cost if wrong: running dev server reflects branch changes.

- Ruling: Reuse guarded graphmind_codex_roadmap_test with explicit ENVIRONMENT=test; UV_CACHE_DIR=/tmp/graphmind-uv-cache and uv run --no-sync use installed dependencies; Postgres.app replaces unavailable Docker for verification — cost if wrong: runtime/dependency drift is exposed by checks; container verification remains unavailable.

- Task 1: Ruling: Prerequisites connect actionable topic endpoints; group membership and alternatives remain separate relation semantics — deterministic effort/session ordering requires explicit actionable dependencies — cost if wrong: model must expand group-level prerequisites into topic edges during repair.

- Task 1: Ruling: Container estimates are allowed for descriptive totals but never added to core effort — spec forbids double counting rather than forbidding summaries — cost if wrong: aggregate display estimates may become stale and should be derived by view code.

- Task 1: Ruling: Bound structural payloads to1200 items/5000 relations/600 resources and scheduler output to10000 sessions in addition to200 topics/six levels — stops pathological input from generating unbounded loops or payloads — cost if wrong: an extreme valid ambition requires narrower core or a new run.

- Task 1: Ruling: Decimal hours/month values serialize as strings in profile JSON; frontend request accepts number/string and profile models decimal strings explicitly — preserve exact half-hour/whole-week arithmetic across API — cost if wrong: clients must parse decimal strings only for input/display, schedule uses integer minutes.

- Task 2: Ruling: Add relational RevisionSource membership and keep ResearchSource evidence immutable — otherwise a proposal's new dossier could contaminate the active or archived revision source list — cost if wrong: one extra join table/read per revision.

- Task 2: Ruling: Repository optionally accepts reader_id, defaulting to roadmap owner for existing contract — future authenticated viewers need their own study progress and default tutor session — cost if wrong: API must consistently pass the authenticated reader for personalized reads.

- Task 2: Ruling: Keep explicit ordinal columns for immutable list roundtrips, separate from local item order/session sequence — shared topic-local sequence does not uniquely order all sessions/resources — cost if wrong: additional small integer columns/index to maintain.

- Task 2: Ruling: Create/research proposals always revalidate with generated budget strictness; only active manual saves can honor explicit capacity warnings — a manual warning is not authority to publish an impossible generated plan — cost if wrong: caller must supply correct generated/manual report and new evidence IDs when evidence changes.

- Task 2: Ruling: Use MYPYPATH=apps/api/src:packages/ai-core/src plus --explicit-package-bases for strict module checks — without canonical roots, local imports were treated as missing/Any; corrected prior validator variable names and validate SQL literal values via Pydantic — cost if wrong: check command depends on repository-root invocation. Current canonical-root strict check passes all six domain/repository/model modules.

- Task 2: Ruling: Migration recognizes a fully metadata-created curriculum schema and rejects partial initialization — existing API additive startup already creates new tables in development — cost if wrong: partial legacy installs require explicit reconciliation rather than guessed destructive repair.

- Task 3: Ruling: Production lease decisions use PostgreSQL clock_timestamp; the repository accepts an injected clock for deterministic tests, rather than trusting caller timestamps — avoids client/process clock drift — cost if wrong: claim/heartbeat now arguments remain compatibility hints in production.

- Task 3: Ruling: Each checkpoint releases its short lease and queues the next stage; only the publication transaction can mark completion — prevents partially published jobs and allows independent stage recovery — cost if wrong: one extra short claim transaction per stage.

- Task 3: Ruling: Global slot reservation uses a transaction-scoped PostgreSQL advisory lock plus running-lease count; owner row locks and a partial unique index reserve one active job per user — works across processes, while awaiting input excludes execution time — cost if wrong: short claim transactions must never contain external network calls.

- Task 3: Ruling: Every attempted external operation is charged, including failed transport retries; successful immutable stage receipts are replayed before any new charge — enforces hard attempt ceilings — cost if wrong: uniqueFetches counts fetch attempts conservatively and a new run may be needed after repeated transport failures.

- Task 3: Ruling: Store reference descriptors alongside jobs in migration0004, as the plan requires durable staged references; extraction and attachment limits remain Task4 — cost if wrong: the early nullable descriptor fields require a future migration if publication needs additional provenance.

- Task 3: Ruling: Preserve saved per-job ceilings across retries; current operator worker_slots controls the shared process pool, while model/search/fetch/repair/active-time budgets remain immutable per job — cost if wrong: operator pool changes can affect concurrency of existing jobs without granting extra research budget.

- Task 4: Ruling: Unreadable/blank/image-only accepted references remain visible as rejected with clear errors; invalid formats and quota failures return typed errors; duplicate acknowledged or lost-ack retries reserve nothing extra — fulfills visible evidence/error semantics — cost if wrong: rejected accepted files consume a file slot until explicitly removed/new run.

- Task 4: Ruling: Add a pure bounded PDF/text extractor beside the existing workspace upload parser, without changing legacy extraction behavior — roadmap requires2MB/16KB bounds and truthful extraction-limit activity; legacy workspace parser has broader formats and metadata — cost if wrong: PDF extraction entry points share pypdf mechanics but remain distinct adapters.

- Task 4: Ruling: Registered HTTP-core network backend is the DNS-pinning boundary; fresh httpx client per redirect preserves original Host/TLS SNI and drops cookies/proxies/credentials; identity/gzip/deflate streaming bounds compressed and decoded bytes — official https://www.encode.io/httpcore/network-backends/ documents this public interface — cost if wrong: unsupported encodings and concatenated/malformed compressed sources report unavailable rather than claiming inspection.

- Task 4: Ruling: Stage file originals under random job/reference IDs, fsync private writes, and unlink expired storage only via after_commit; rollback deactivates unlink callbacks — prevents library/publication races and rollback data loss — cost if wrong: a process crash after SQL commit can leave orphan bytes for a later cleanup scan.

- Task 4: Ruling: Expiring unpublished evidence makes the run unrecoverable/new_run; published workspace-associated references are protected under job/reference locks — retry must not silently resume with removed inputs — cost if wrong: a canceled/failed run older than seven days requires restaging its optional references.

- Task 5: Ruling: Materialize generation-local item/source labels with deterministic per-job UUID namespaces at publication, updating relationships/choices/resources/sessions and saved checkpoint; refinements retain stable existing IDs — a model may reuse labels across independent roadmaps, so uniqueness belongs to the trusted boundary — cost if wrong: generation progress/checkpoints use local labels until final publication; Task7 must not assume those are persisted workspace IDs.

- Task 5: Ruling: Construct the one structural canvas anchor directly after WorkspaceService creates owner membership; never invoke add_node_and_edge's external embedding callback in publication — no network work under a publication transaction — cost if wrong: anchors have no dense embedding until a later indexing job, while normal topic sessions keep normal chat behavior.

- Task 5: Ruling: Store bounded prepared reference text/page sections and derive library chunks locally inside publication, with null embeddings and provenance; no FileService.save_file or storage move — reliable rollback and lexical lookup without remote side effects — cost if wrong: dense file retrieval needs later asynchronous indexing; up to10MB of extraction may require a longer short transaction, whose lease is rechecked before completion.

- Task 5: Ruling: Refinement publication saves only a candidate revision; optional new library reference association belongs to explicit Apply in Task13 — preserves the currently active plan and avoids exposing unaccepted refinement uploads through the workspace library — cost if wrong: proposal viewers need private job evidence until Apply; completed job retention protects staged originals.

- Task 5: Ruling: Cancellation is the durable cancel_requested status, with event timestamps; no duplicate cancel_requested_at field is needed from the illustrative pseudocode — row status, fence and database lease are authoritative — cost if wrong: cancellation timing is read from events/updated_at instead of a dedicated column.

- Task 5: Ruling: Keep the separate Compose worker behind the roadmap profile until the typed research executor and core learning actions are installed; CLI imports the Task7 stages factory at process entry — prevents starting a partial generator on ordinary compose up — cost if wrong: operators explicitly selecting the roadmap profile before Task7 completes get an import failure, documented during implementation.

- Task 5: Ruling: Fix existing API image packaging prerequisites while adding the worker: include uv.lock for --frozen and copy editable ai-core sources into the final image; use one shared reference volume and matching API/worker provider environment — cost if wrong: image rebuild required; Docker itself is unavailable in this environment, so runtime image validation remains unverified.

- Task 6: Ruling: Use installed google-genai2.18.1 async generate_content with Gemini2.5Flash GoogleSearch,45s timeout and SDK attempts1; charge model plus search for each actual attempt, check missing key before reservations, configuration failures retryable after setup — official Google grounding/SDK docs verify compatibility — cost if wrong: provider model retirement requires changing ROADMAP_SEARCH_MODEL; no fabricated research fallback.

- Task 6: Ruling: Preserve provider grounding, attribution and UTF-8 citation segments; duplicate URLs collect all chunk citations; unsupported chunks remain candidates, access unknown until actually verified — source identity/evidence must be grounded rather than inferred from model prose — cost if wrong: large metadata can reach receipt bounds and require a narrower research query; UI must preserve attribution in Task9/14.

- Task 6: Ruling: Scope application SkillRegistry to chat versus roadmap by registered tags, with exact seven-tool roadmap allowlist; reference service is created per short session — prevents exposing unavailable tools in ordinary chat or sharing a network/heartbeat session — cost if wrong: new roadmap playbooks must carry the roadmap tag and allowed required_tools.

- Task 6: Ruling: Block credentials/identifiers and four-word verbatim private-background/reference fragments in search queries; agent instructions also forbid private disclosure — practical direct-copy guard, not a proof against paraphrased disclosure — cost if wrong: benign overlapping topical phrases may need reformulation; Task7 must produce short subject-only queries and never feed raw private documents to the search backend.

- Task 6: Ruling: Cache inspections only for current-job evidence; preserve old revision source IDs/payloads, merge current-job grounding attribution on inspection, include candidate/profile/sources in validation receipt keys — prevents immutable evidence mutation or replaying pre-repair validation — cost if wrong: refinement may repeat an inspection, consuming its saved budget.

- Task 6: Ruling: Package roadmap tests with __init__.py to avoid pytest basename collision with ai-core test_tools.py — isolated modules retain actual test coverage — cost if wrong: test import paths use roadmap.test_tools.

- Task 7: Ruling: Keep orchestration provider-neutral in orchestrator.py and production provider/tool/session wiring in stages.py to honor worker bootstrap's existing factory — separates heartbeat/publication mechanics from external execution — cost if wrong: composition root adds one small module rather than duplicating worker logic.

- Task 7: Ruling: Add optional typed ModelConfig.max_retries with existing-chat defaults unchanged; roadmap uses zero outer retries and disables Gemini SDK retries, OpenAI/Anthropic per-call with_options (also inherited DeepSeek/Ollama) — every actual generation invocation must consume a saved model reservation — cost if wrong: roadmap transient failures require a durable retry; normal chat retry behavior remains its prior default.

- Task 7: Ruling: Production composition explicitly selects configured real providers and rejects absent/unsupported/mock configuration with a recoverable job error; no generic factory's offline fallback — research/generation must be genuine — cost if wrong: worker remains running but operator must configure generation/search before retry.

- Task 7: Ruling: Research requires at least two recorded usable public sources and a durable successful search receipt, not merely a spent search counter; registered stage playbooks are actually loaded through scoped tools — failed/ungrounded calls cannot masquerade as research — cost if wrong: narrow subjects need a second complementary source or an explicit fresh narrower run.

- Task 7: Ruling: Preserve explicit request fields; absent pacing stays unknown/flexible unless supplied by clarification, and deterministic scheduler overrides model sessions — spec forbids invented deadlines — cost if wrong: freeform pacing should be entered in time fields or clarified rather than silently inferred from prose.

- Task 7: Ruling: Bound typed-output parsing to three model attempts per output and semantic/qualitative repair to saved maximum three; repair calls can reuse scoped research tools before deterministic revalidation — malformed JSON never publishes; resumed limits never reset — cost if wrong: difficult subjects require a narrower fresh run instead of indefinite self-repair.

- Task 7: Ruling: Provide labeled source excerpts of4096 bytes with full-evidence byte count plus read/fetch tools; keep raw provider attribution out of model dossiers while retaining source records — avoids repeating large grounding JSON in every prompt without claiming full evidence coverage — cost if wrong: qualitative review may need explicit deeper read/fetch calls within saved limits.

- Task 8: Ruling: Strict roadmap auth requires an actual nonempty cookie/bearer credential before calling existing get_current_user; illustrative startswith-only check was insufficient under pytest — explicit empty bearer cannot inherit anonymous admin — cost if wrong: malformed/empty authorization gets401 even in tests, which is the intended production invariant.

- Task 8: Ruling: Use function-scoped yield dependencies so request auth/transaction closes before streaming; each SSE poll opens/closes a fresh session and rechecks authenticated user, then yields saved safe DTOs; terminal replay drains every200-event batch — no browser-held transaction or lost completion after long histories — cost if wrong: one-second polling adds bounded DB reads; disconnect never cancels generation.

- Task 8: Ruling: Accept the greatest valid nonnegative int32 SSE cursor (database event sequence uses INTEGER), ignore malformed/out-of-range Last-Event-ID and reject out-of-range after query — user header cannot cause SQL overflow — cost if wrong: invalid header replays earlier events, which client sequence dedup handles.

- Task 8: Ruling: Preserve public typed JobError fields through RoadmapHTTPError and ApiError including authenticated replay, with validation input/ctx omitted for roadmap endpoints — frontend needs stable next actions without logging private prompts/documents — cost if wrong: detailed input values are absent from validation feedback; field paths/messages remain.

- Task 8: Ruling: Keep legacy synchronous201 contract while removing its live generic fallback and prompt snippets/goal logging; old helper remains solely for legacy pure compatibility tests, not active generation — errors cannot create a misleading subject curriculum — cost if wrong: failed legacy provider now returns502 and requires retry/configuration instead of pretending success.

- Task 8: Ruling: Replace legacy success test's live external generation/embedding with deterministic injected provider JSON and no-op embedding; keep graph/materialization assertions; explicitly clean committed curriculum fixtures — prior tests accidentally relied on fabricated fallback/live network, and shared t1/s1 fixture IDs must not leak between committed HTTP cases — cost if wrong: real-provider quality remains Task14's separate bounded evaluation, while API contract tests are deterministic.

- Task 9: Ruling: Retain successful attachment acknowledgments by exact immutable File object and canonical link plus server reference ID; server already hashes bytes for durable dedup — avoids duplicate browser buffering while retrying the same held form — cost if wrong: a deliberately reselected File rechecks server dedup rather than trusting metadata-only equality.

- Task 9: Ruling: Start over explicitly clears setup key/acknowledgments before changing an accepted request; rejected accepted file cannot be silently skipped on Retry — idempotency keys bind immutable submitted inputs — cost if wrong: a replaced rejected file starts a new setup record; old unstarted job is cleaned after24h.

- Task 9: Ruling: reconnect cursor advances only across contiguous events, and resumed jobs reject stale snapshots — prevents missing activity or prematurely closing a resumed stream — cost if wrong: additional snapshot requests and duplicate-event handling.

- Task 9: Ruling: record an actual stage_started event on worker claim — queued-to-running must be observable without waiting for research tools — cost if wrong: one extra durable event per claim.

- Task 9: Ruling: return server-created source IDs with grounded search evidence and initialize private-search guard from the original request before Understand — actual model tools must be usable and protect background text immediately — cost if wrong: slightly larger tool output and conservative search rejection. Both regressions observed RED then GREEN.

- Task 10: Ruling: hierarchical order is the tie-breaker for prerequisite/recommended-next topological ordering in both Python scheduler and frontend next-topic selection — local topic order cannot override phase order — cost if wrong: explicit cross-phase prerequisites still move topics ahead of their phase presentation; their links remain visible in canvas.

- Task 10: Ruling: keep task10 topic-open/start callbacks optional and omit their buttons until task11 supplies real actions, with operator flag still false — avoids dead learner controls during staged implementation — cost if wrong: isolated design QA has read-only topics until integration.

- Task 10: Ruling: distinguish ROADMAP_NOT_FOUND from auth/network errors and abort prior workspace reads; only published landing/anchor canvas replace the persistent shell — ordinary chats/library/settings preserve canonical routes — cost if wrong: a temporary API outage shows Retry instead of an empty chat on affected landing/canvas routes.

- Task 10: Ruling: update stale chat breadcrumb test to assert the active conversation title rather than an absent Workspace crumb — approved current header identifies New Chat directly — cost if wrong: future workspace breadcrumb restoration needs a new expectation; routing tests remain explicit.

- Task 10: Ruling: optional further items nested below core phases are collected under the collapsed Further learning section — supplemental branches must not compete with the initial core path — cost if wrong: their original grouping context is clearer on the curriculum canvas than the page.

- Task 11: Ruling: common curriculum_workspace fixture cleans its exact workspace even if another fixture commits the shared session — worker_job fixture otherwise committed default-admin curriculum IDs and caused later ITEM_OWNERSHIP_MISMATCH — cost if wrong: tests needing the curriculum after fixture teardown must explicitly persist a separate fixture; production ownership is unchanged.

- Task 11: Ruling: lesson generation has a150s timeout and claim expires after180s; pending/interrupted can claim, fresh token fences stale results, completed cannot auto-run — two tabs and process crashes cannot duplicate the initial lesson — cost if wrong: unusually slow initial lesson needs explicit Resume; ordinary subsequent chat remains unchanged.

- Task 11: Ruling: add compute_embedding=False to the internal workspace node service for lazy tutor root and server-persisted first assistant — optional embedding must not keep lesson-creation/finalization transactions open on another model call — cost if wrong: those two nodes lack semantic search embeddings until a later indexing pass, while normal chat persistence still embeds.

- Task 11: Ruling: Show weekly sessions inside collapsed phases and use presentation ordinals, not generator-local order values — clean initial view and no duplicated future curriculum — cost if wrong: known-pace page prioritizes weekly grouping over intermediate named groups; canvas retains hierarchy.

- Task 11: Ruling: Hide general New chat/command palette on curriculum landing, and generic mastery recommendations in linked topic lessons — existing empty-route chat creation is inapplicable and programming fallback resources are misleading for researched drawing lessons — cost if wrong: these general chat controls require an ordinary chat workspace; optional topic checks remain available.

- Task 11: Ruling: Keep at most 100 recent assessments in the tutor DTO, with older records retained in DB — bound repeated session reads — cost if wrong: older history needs future pagination.

- Task 11: Ruling: Live graphmind DB already has compatible new tables, but alembic_version names an unknown old revision — no blind migration or stamp of user data; test-only migration DB verified separately — cost if wrong: operators must reconcile original migration history before future live upgrades.

- Task 12: Ruling: Source inspection is a separate authenticated bounded endpoint; persists server-created immutable evidence before a later revision save — lets the editor show honest verification state before Save, performs network outside DB transaction, and accepts only source IDs in patches — cost if wrong: discarded inspected links retain bounded metadata (dedup same URL, max600 per roadmap) until workspace deletion. No client free/verified claims accepted. Inspection expires pre-network ORM state and rechecks write access after fetch.

- Task 12: Ruling: Keep existing JobError nextAction enum; REVISION_CONFLICT's stable code drives explicit frontend Reload rather than adding a global reload action — avoids changing job recovery contract for editing — cost if wrong: generic clients may display answer guidance; dedicated editor retains draft and offers named reload.

- Task 12: Ruling: Undo defaults to the latest applied revision's base, older history is read-only summaries; restoration creates a new active revision and never rolls back learning — follows approved scope — cost if wrong: older full curriculum inspection is not yet exposed, candidate proposal inspection belongs Task13.

- Task 13: Ruling: Preserve original goal/profile/time budget during refinement; instruction changes curriculum depth, practice and pacing within that budget — original publication/validation profile is binding and must not become a goal of 'Make this more practical' — cost if wrong: changing the overall hours/week/deadline requires an explicit future profile-change contract rather than silently trusting model-inferred time. Native refinement must restart worker after generation module changes because it does not reload.

- Task 13: Ruling: Record proposal handling in job result and expose target workspace identity, not private checkpoint/request — durable progress/review recovery and no misleading ready notices after Apply/Keep current — cost if wrong: old proposal results without state remain reviewable until acted on; retained rejected candidate remains read-only in history.

- Task 13: Ruling: Display concrete current/proposed field values inside collapsed per-topic changes, with whitespace-only differences hidden and topics in curriculum order — counts alone did not make actual native proposal reviewable — cost if wrong: longer optional details, while primary review remains concise.

- Task 14: Ruling: Preserve hidden canvas placements until explicit Auto layout/reset, and ignore hidden nodes when placing new visible cards — collapsing/reopening must not discard learner placement — cost if wrong: stale deleted-card coordinates remain within saved2000-entry bound until reset; subsequent review must address long-lived deletion churn if material.

- Task 14: Ruling: Use typed CanvasViewport deserialization and cast narrowly registered exception handlers to Starlette HTTPExceptionHandler — concrete storage format and runtime exception dispatch remain unchanged, strictmypy cannot assume narrower handler signatures — cost if wrong: malformed stored camera now raises explicit validation instead of opaque downstream parsing.

- Task 14: Ruling: Extend private checkpoint with bounded question-answer pairs while preserving legacy answer list — replies such as beginner or four weeks need the actual question after restart, and private answer text must receive the same outbound-search protection as background/uploads — cost if wrong: older jobs retain less context, and the existing guard remains verbatim/identifier protection, not semantic DLP.

- Task 14: Ruling: Fix only missing native top-layer states in jsdom test environment rather than weaken focus assertions or change production menus — profiler proves selector recursion, and browser keyboard/menu behavior is independently verified — cost if wrong: native fullscreen/modal top-layer behavior requires browser tests, since jsdom cannot model it.

- Task 14: Ruling: Extend model response deadline90→180 seconds while preserving saved overall usage/time limits — real curriculum repair exceeded90s, and no approved spec mandates90 — cost if wrong: a stalled individual request takes up to90 seconds longer before retry; heartbeat/cancellation still fence late publication.

- Task 14: Ruling: Delete unused fixed AI Engineer scaffold/schema and their three obsolete tests, plus uncalled generic programming fallback helper — rg proves only those tests consume them; retain the actual legacy endpoint with its existing explicit provider/parse failures — cost if wrong: untracked external Python imports of the obsolete scaffold must migrate to the durable jobs API.

- Task 14: Ruling: Compact ordinary HTML template whitespace before evidence truncation but preserve preformatted code indentation — actual publisher pages supplied thousands of blank characters instead of useful first4KB — cost if wrong: original ordinary-page whitespace layout is not preserved, while words/headings/code remain quoted evidence and canonical source links remain available.

- Task 14: Ruling: Tighten instructional-source guidance and repeat native educational acceptance rather than call structurally valid output complete — actual recommendations inferred teaching from subject lists — cost if wrong: a few more bounded topical searches/inspections and longer generation, within the saved ceilings.

- Task 14: Ruling: Prefer nonempty article/main content over full-page navigation with fallback to original page text — real documentation boilerplate displaced instructional sections — cost if wrong: publisher metadata/sidebar teaching outside those landmarks may be omitted; canonical links and full publisher pages remain available.

- Task 14: Ruling: Preserve Gemini finish_reason in the existing provider-neutral result and include it in bounded schema diagnostics — repeated empty results lacked failure cause, preventing evidence-based repair — cost if wrong: downstream consumers now see an SDK terminal reason previously absent, with no change to generated text or retries.

- Task 14: Ruling: Keep full source grounding/attribution in audit receipts while omitting duplicated rendering metadata from model tool context — real1M-input-token/minute quota failed under saved call ceilings — cost if wrong: model cannot inspect raw citation/rendering metadata through that result, while supported evidence/IDs remain and complete provenance stays persisted.

- Task 14: Ruling: Bound Gemini2.5 roadmap reasoning guidance and make truncated-output schema failure retryable — finish_reason diagnostics prove output-limit responses with empty JSON, and Google documents output allowance includes thinking — cost if wrong: complex tasks receive less reasoning guidance; provider may overflow the requested thinking budget, saved total ceilings still fence retries. Ordinary chat and other providers retain existing defaults. Primary documentation: https://ai.google.dev/gemini-api/docs/generate-content/thinking

- Final: Ruling: Guard decoded outbound fetch components using existing private-context/identifier checks and require query-bearing URLs to match a recorded source or user-provided link — direct fetch was an unguarded disclosure channel; canonical public paths remain usable for independently discovered instruction — cost if wrong: agents must search/register exact query URLs first, and lexical/identifier protection remains narrower than semantic DLP.

- Final: Ruling: Treat ISO publication dates as public numeric metadata only for URL identifier detection, retaining their tokens in private-copy comparison — phone regex otherwise blocks legitimate dated publisher paths — cost if wrong: an isolated date is allowed externally; private multiword passages and other identifiers are still checked.

- Final: Ruling: Use adapter-owned metaLabel on the shared canvas card, selected-route rationale and one contextual Show alternatives control only for expanded visible choices — preserves domain-neutral renderer and clean approved presentation while making workload selection visible — cost if wrong: revealing alternatives is global for expanded choices rather than per-choice, with stable IDs/layout/progress unchanged.

- Final: Ruling: Reviewer did not repeat live research — executor already performed five bounded native evaluations with source/usage/browser evidence, so no extra paid calls are needed — cost if wrong: educational judgments have author rather than independently reproduced native evidence.

- Final: Ruling: Reviewer did not repeat full suites/migrations/build — read-only review checks code, executor owns fresh complete gates after its fix pass — cost if wrong: environmental behavior is established by executor verification rather than reviewer replay.

- Final: Ruling: Existing canonical mypy failures remain explicit baseline — 41 errors/11files versus85/23 baseline, approved new roadmap scope is checked independently — cost if wrong: older provider/semantic/router modules need separate type cleanup.

- Final: Ruling: Docker runtime deployment remains unverified — user requested local Native implementation, migrations are verified in isolatedPostgreSQL and startup documented, no container deployment requested — cost if wrong: container-specific integration requires deployment verification later.

- Final: Ruling: Keep existing learning profile/time-budget refinement deferral — this approved slice refines curriculum structure/resources/effort within saved profile rather than silently mutating scheduling inputs — cost if wrong: changing duration/hours/level requires a new roadmap or future explicit profile editing.

- Final: Ruling: Semantic/paraphrased DLP remains outside the direct-copy guard guarantee — prompts/private data go to the configured model, tool boundary blocks identifiers/verbatim private contexts and constrained query URLs — cost if wrong: paraphrased or novel encodings cannot be treated as fully prevented disclosure.

- Final: Ruling: Keep bounded deleted-card coordinate retention — retaining positions proves collapse/expand/reload stability, no ordinary-use failure found — cost if wrong: long structural churn may reach the saved coordinate cap and require future pruning.

## Independent review

# Independent whole-branch review

Reviewer: fresh gpt-6-astra, read-only, b0600ad..ff79312. No child agents or Git/file changes. Verdict: With fixes. No Critical or Minor findings.

Strengths: database-time leases and fencing, atomic publication, saved bounded usage, selected actionable workload/prerequisites, immutable curriculum with independent history, DNS-pinned public source fetching and redirect checks.

Four Important findings:
1. ProgressService.record_check retains ORM identities across inference; stale ownership and inactive accounts can pass post-call authorization. Recheck fresh authority before persisting a knowledge check.
2. fetch_source has no equivalent to search_web's private-copy boundary. Decode/check URL components before transport, constrain model-derived destinations using source/user-reference provenance where practical.
3. TutorService.read_session requires write permission although GET/session/archived-history routes allow readers. Separate reads from mutation authorization and preserve learner ownership.
4. Curriculum canvas projects chosen and unselected alternatives identically. Preserve recommendation/rationale and reveal other routes separately.

Declined to judge:
- Fresh live provider research: inspected recorded evidence, no new external calls.
- Full suites/migrations/build: inspected recorded evidence, did not rerun mutating gates during read-only review.
- Existing canonical mypy failures: documented baseline, not new findings.
- Docker runtime deployment: documented unverified and not exercised.
- Learning profile/time-budget refinement: explicitly deferred by existing ledger; limits schedule refinement.
- Semantic/paraphrased DLP: outside direct-copy guard guarantee; private-fetch finding concerns its missing direct-copy channel.
- Deleted-card coordinate accumulation: documented bounded-retention tradeoff; no ordinary-use failure established.

The executor's reproducers, fixes and final gates are recorded in progress.md and the durable decision/quality audits. No second review is requested; meaningful RED→GREEN regressions and complete verification close this one fix pass.

## Fix verification

- Final: fixed stale assessment authority — test_assessment_rechecks_changed_authority_after_provider_await ownership/deactivation RED→GREEN; identities expire before post-inference write authorization and activeUserrefresh. FullPython430/430, UI333/333, shared16/16.

- Final: fixed private fetch channel — test_fetch_private_url_is_blocked_before_transport (4cases), test_fetch_guard_decodes_deeply_encoded_private_paths and test_model_query_url_requires_registered_source_or_user_link RED→GREEN; zero transport/fetchcharges on rejection, publicdatedURL allowed. FullPython430/430.

- Final: fixed viewer saved/archived history read — test_demoted_viewer_can_read_saved_and_archived_lesson_but_cannot_write RED403→GREEN200; mutationsremain403 and learnerownership preserved. FullPython430/430.

- Final: fixed selected-alternative canvas semantics — projection/renderingRED2→GREEN7, recommendedrationale/Selectedpath distinct, optionalroutes disclosedonlyonrequest, originaltopicIDs/selectedCore unchanged. FullUI333/333, shared16/16.

## Deferred minors

None. Existing global mypy failures, Docker verification and live migration-history reconciliation are documented operational limits; future profile-budget editing and broader DLP are explicit scope rulings above.
