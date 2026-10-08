# Researched roadmap generator — quality verification

Branch: `codex/roadmap-generator`. Implementation through task 13: `772c31b`.
Release regression fixes: `ea96039`, `1ce4bcb`, `97e4fe5`; independent-review fixes: `8a0cfe2`. Verification performed 8 October 2026.
Status: all fourteen tasks and five native evaluations verified; independent branch review completed and all four Important findings fixed.

## Verified behavior

Clean setup creates one idempotent job, stages optional references and starts a
native worker. Understand, Research, Compose, Personalize, Validate and Publish
save checkpoints and real activity. Search citations and inspected evidence are
recorded; missing providers/search, invalid curricula and exhausted budgets produce
explicit failures, never a simulated successful roadmap. Closing progress keeps
running; explicit cancellation fences late results.

Publication creates a dedicated workspace. Roadmap and canvas share topic IDs,
prerequisites and independent learning progress. Topic lessons persist their real
assistant response and saved branches. Manual completion needs no quiz. Direct
editing creates immutable revisions; AI refinement produces a candidate requiring
explicit Apply. Restore changes the active curriculum without replacing saved
conversations or progress. Stale structural writes fail with conflict.

## Automated gates

| Gate | Observed result |
| --- | --- |
| Full Python suite before obsolete scaffold removal | 415 passed; one Starlette 422 deprecation warning |
| Full Python suite after independent-review fixes | 430 passed; one deprecation warning |
| Legacy endpoint after scaffold removal | 2 passed |
| Full frontend suite | 333 passed across 68 files |
| Shared contracts | 16 passed |
| Frontend TypeScript | passed |
| Ruff API/tests/ai-core | passed |
| Scoped strict roadmap mypy after review | 23 files passed |
| Canonical whole backend mypy | 41 errors in 11 files; **failed**, baseline 85 errors in 23 files |
| Isolated Next production build | passed; `/tmp/graphmind-roadmap-build/task-14-build.log` |
| Dedicated migration database | upgrade/downgrade/upgrade through all three new revisions passed |

Commands use Node 20 and `UV_CACHE_DIR=/tmp/graphmind-uv-cache`. Backend tests use
`ENVIRONMENT=test` and the guarded `graphmind_codex_roadmap_test` PostgreSQL database.
Migration roundtrips use the separate `graphmind_migration_test` database.
No test cleanup or migration is run against the live user's database.

```sh
ENVIRONMENT=test DATABASE_URL="$GRAPHMIND_TEST_DATABASE_URL" uv run --no-sync pytest -q
uv run --no-sync ruff check apps/api/src apps/api/tests packages/ai-core/src
MYPYPATH=apps/api/src:packages/ai-core/src uv run --no-sync mypy --explicit-package-bases apps/api/src packages/ai-core/src
pnpm --filter @graphmind/shared test
pnpm --filter @graphmind/web test
pnpm --filter @graphmind/web typecheck
```

Next builds run from an isolated copy, preserving the running app's `.next`.
The full mypy failure remains explicit: existing ai-core provider typing and older
semantic/RAG/curator/router services require separate cleanup. The guarded new
roadmap source check is green; this is not a claim that the entire backend is typed
without errors.

The integrated HTTP journey uses real APIs, storage, worker, publication and scoped
tools with a scripted model and mocked public source transport. It covers uploads,
necessary clarification, worker restart after Research, event replay after sequence
3, one publication, persistent lesson reopen, manual completion, a manual move,
stale proposal rejection, Apply and Restore. A separate HTTP cancellation journey
releases a blocked model result and verifies zero published workspaces. Scripted
sources are fixtures, not claimed real research.

## Real research evaluations

Real configured Gemini 2.5 Flash and grounded search run under the saved default
ceilings: 48 model calls, 20 search attempts, 40 fetch attempts, three repairs and
1,200 active seconds. Waiting for an answer is excluded; Retry preserves usage.
The per-model deadline is now 180 seconds, search 45 seconds, source inspection
bounded separately. All learning requests are disposable public QA examples.

- Beginner drawing: `job_b863bf7414854a1eabc466d96b0d5f04` published
  `roadmap_b03e2c3bcd854e2788c69e75892b064e` in `ws_35b556eaee70`.
  Nine selected topics, 480 core minutes within four weeks at two hours/week;
  drawing phases, practical drills and a small final drawing. 17 model calls,
  one search, seven fetches, no repairs, 215.81 active seconds. Saved lesson,
  Explain simply branch, refresh, completion/reversal, edits/history and native
  refinement Apply were verified. Resource access labels remain honestly unknown;
  an early grounded commercial catalog is a weaker recommendation than the
  inspected museum/conservancy/practice instructions. Source guidance now explicitly
  favors freely readable teaching pages over catalogs when free instruction is requested.
- Unrealistic one-hour AI request: `job_435edb351e474934acf891d5beeb4cc6`
  completed with exactly 60 core minutes within 60 available minutes. It states an
  introductory Elements of AI first step; advanced engineering remains further
  learning. 27 model calls, three searches, one fetch, three repairs, 244.10 active
  seconds. It does not claim production AI mastery in one hour.
- AI engineering: first attempt `job_b554bee73c0246beb635298b5effa952`
  refused publication after three repairs (33 model calls, 15 searches, two fetches,
  843.78 active seconds). Missing briefs/unrecorded source references exposed weak
  repair feedback. Corrected feedback names codes, topic IDs and missing fields;
  fresh run `job_390679195ede4c6e9edbae2d06f73e28` completed in 543.2 seconds,
  publishing `ws_b5da50faa0e0` / `roadmap_5627041ed83e408190522952b6fd44b0`,
  revision `rev_8e62891780814f4d862bdca1d0ca411c`. Eleven selected topics total
  1,720 minutes within 1,920 available; four further topics cover fine-tuning,
  advanced prompting, deployment and monitoring. Weekly sessions sum to the same
  1,720 minutes and resources remain at most three per topic. Manual resource audit
  then found overview-only links for Python/embeddings/evaluation: this counts as
  structural success, **not full instructional quality acceptance**. Final fresh
  run `job_b8649ed9dddb4242856ca46c03218fc7` completed in 312.3 wall seconds
  (305.14 active seconds), with 23 model calls, six searches, two fetches and one
  repair. It published `ws_554827f13a4b`,
  `roadmap_e1267cbfe95749dda280efb57683b0ec`, revision
  `rev_5694270b44d246c29ab16f97f71b7bb8`. Eleven core topics total 1,080 minutes
  within 1,920 capacity, with two further topics and at most two resources per
  topic. All weekly sessions total 1,080 minutes; topic briefs and practical
  exercises are complete. Actual LazyLLM/SuperML/GitHub RAG instruction and
  Patronus/GeeksforGeeks evaluation guidance replace inferred evaluation coverage.
  Basic programming/Python proficiency is an explicit assumption, verified visible
  under About this plan; this evaluates a beginner in AI, not a promise of teaching
  programming from zero. The preceding run
  `job_21a2622fd182459ab490b773cd346561` hit an input-token quota, preserved its
  research on Retry, then encountered empty/truncated model responses and was
  canceled by the evaluation timer without publication. Observed total usage:
  48 model calls, 14 searches, 12 fetches, three repairs, 1,131.62 active seconds. The earlier outcome is a
  small RAG assistant with practical experience, not advanced production mastery.
- Experienced backend developer learning AI: `job_7303c9c46a68432488f06f77d69bc889`
  preserved completed research but a validation repair exceeded the original
  90-second deadline. Initial usage: 11 model calls, two searches, no fetches,
  one repair, 352.98 active seconds. Retry with the bounded 180-second deadline is
  completed on the saved job but exhausted its preserved three-repair budget.
  Fresh run `job_ad155bd602124e12a5b666488322362c` completed in 351.1 seconds,
  publishing `ws_9f0c0f3f5cd4`, revision `rev_bbf1e5c590cf43a297c81182b7f43067`.
  25 model calls, five searches, eight fetches, two repairs and 344.09 active
  seconds. Core minutes 720 within 720 capacity; Python foundations are skipped. Actual
  freeCodeCamp/RAG implementation and Ragas/Evidently evaluation tutorials replace
  overview-only subject lists.
- Drawing with explicit prior skills: first attempt
  `job_e26d875f91ec48f99217f4b412a570fa` had correct 480-minute pacing but
  phase-to-phase prerequisite edges and exhausted JSON schema retries. Initial
  usage: 17 model calls, four searches, two fetches, one repair, 318.90 active seconds.
  Composition now explicitly requires topic prerequisites; schema retries identify
  invalid paths/types without echoing input values. Fresh run `job_711703f1f1c8437f8423932bd3c15307` completed in 196 seconds,
  publishing `ws_fc8cd0334459`, revision `rev_fc734d54b79e44159979b1bea255e12d`.
  11 model calls, one search, two fetches, no repairs and 190.88 active seconds.
  Nine selected core topics total 480 minutes within 480 capacity; known pencil
  control/shapes/ellipses are skipped, beginning with proportions and measuring.
  The browser displays the same weekly totals and practical still-life outcome.

No failed case is counted as successful. The illustrative PDF and approved HTML
preview supplied design/reference direction; neither is represented as researched
output. Recommended URLs are re-inspected with the production DNS-pinned fetcher;
HTTP success alone does not establish free-course pricing.

## Browser evidence

Disposable drawing workspace only. Verified real six-stage generation, automatic
opening while setup remains active, saved lesson refresh and branches, manual
progress, direct editing/undo/history and explicit native refinement Apply.
The original saved lesson ID `node_c5c2271208e54c10a17cb2af` remains unchanged.
Desktop canvas has measured non-overlapping cards and keyboard actions. Dragging
the introduction to world position `(695.67, 208)`, collapsing/expanding its phase
and reloading retains that exact position. At 390px width, document scroll width
is 390px; heading font is Georgia and drawer Escape works. Earlier setup screenshots
verify paper light tokens and dark semantic colors, concise options and activity.

Screenshots are local artifacts under
`/Users/balveerd/.codex/visualizations/2026/10/06/01a11274-a96e-7ec0-8cfe-c0d46575019c/`:

- `roadmap-final-mobile.png`
- `roadmap-final-canvas-placement.png`
- `roadmap-native-refinement-review.png`
- `roadmap-native-refinement-applied.png`
- `roadmap-native-history.png`
- `roadmap-native-lesson.png`
- Task 10 desktop, narrow and dark setup captures.

## Release regressions

Tests reproduced and verified: manual canvas positions disappearing when hidden,
stale resumed-job auto-navigation, missing private clarification query protection
and question context, imprecise repair feedback, slow response deadline and expiry,
and typed retry feedback missing invalid field identities. Full browser focus
behavior was verified independently. Test-only jsdom native `:fullscreen`/`:modal`
states return false to avoid the profiled nwsapi selector recursion; normal matches,
focus and event behavior are unchanged. The outdated flashcard deletion test now
uses the real actions menu.

The unused simulated AI Engineer agent/schema and its three obsolete tests were
removed. The uncalled programming fallback helper was removed. The existing
synchronous endpoint remains for compatibility and reports generation/parse errors.

## Operational limits

Live database migration history names an old revision not present in this checkout.
No live migration/stamp was attempted. Dedicated migration verification passes;
operators must reconcile the original history before upgrading that live database.
Source inspection can be unavailable and access can remain unknown; no access or
pricing guarantee is inferred from search prose. API and worker must restart
together after checkpoint contract changes.

## Recommended source inspection

All ten recommended URLs in the drawing and one-hour cases were inspected on
8 October 2026. Redirects resolved to the publisher pages below. Recorded access
labels were not upgraded merely because the page responded.

| Case | Inspected publisher page | Recorded access |
| --- | --- | --- |
| short-budget | [A free online introduction to artificial intelligence for non-experts](https://www.elementsofai.com/) | unknown |
| short-budget | [A free online introduction to artificial intelligence for non-experts](https://www.elementsofai.com/) | unknown |
| short-budget | [The AI Engineering Roadmap — Shreyas Pandey](https://www.shreyaspandey.me/blogs/the-ai-engineering-roadmap) | unknown |
| short-budget | [AI Agent Engineering Roadmap — Free Download — Tariq Labs](https://tariqlabs.com/roadmap/) | unknown |
| beginner-drawing | [Draw What You See (Observation and Drawing Fundamentals)](https://www.masterbooksacademy.com/course/creators-design-draw-what-you-see) | unknown |
| beginner-drawing | [Practice Drawing From Observation](https://practicedrawingthis.com/cgi-bin/carousel.cgi?section=free-online-drawing-course&episode=article-practice-drawing-from-observation) | unknown |
| beginner-drawing | [Lessons 1 - Observational Drawing](https://www.tejonconservancy.org/drawing-lessons/lessons-1---observational-drawing) | unknown |
| beginner-drawing | [How to Teach Observational Drawing - Art With Trista](https://artwithtrista.com/how-to-teach-observational-drawing/) | unknown |
| beginner-drawing | [Draw what you see: 9 observation exercises to train your artist’s eye — Creative Bloq](https://www.creativebloq.com/art/draw-what-you-see-9-observation-exercises-to-train-your-artists-eye) | unknown |
| beginner-drawing | [Drawing from Observation – NCMALearn](https://learn.ncartmuseum.org/lesson-plans/drawing-from-observation/) | unknown |

Source evidence extraction now compacts ordinary HTML template whitespace while
preserving headings and preformatted code indentation. Regressions observed both
missing instruction in the first4KB and code indentation loss before correction;
29 safe-fetch checks pass, including article/main preference over large navigation.

The final source-selection playbooks explicitly separate curriculum-comparison
evidence from instructional recommendations. Empty Gemini results now preserve the
existing provider-neutral finish reason in diagnostics; private response text is
not logged.

See the [exhaustive implementation decision audit](roadmap-generator-decisions-2026-10-07.md)
for every recorded ruling and its trade-off.

Model messages retain source identities and evidence, while full grounding and
attribution remain in immutable audit receipts. Duplicate rendering metadata is
omitted from model context after the native quota failure. Gemini 2.5 roadmap
stages request a 2,048-token thinking budget; the existing 32,768 output allowance
and saved job ceilings remain unchanged. This is provider guidance, not a hard
reasoning-token guarantee: [Google documents](https://ai.google.dev/gemini-api/docs/generate-content/thinking)
that output allowance includes thinking and that thinking budget can vary.
Ordinary chat and other providers retain their defaults. Exhausted schema retries
with `MAX_TOKENS` now offer Retry with saved research, rather than forcing a new
job. Both changes have behavioral regression coverage.

The later backend and prior-knowledge cases add 22 recommended URL checks.
Seven of nine backend links and ten of thirteen prior-knowledge links were
re-inspected successfully; two and three respectively were unavailable during
this audit. Unavailable links are not claimed inspected or free. Search-grounded
records keep their original provenance/access labels. Publisher instruction
examples include the following (inspected 8 October 2026):

- backend-to-ai: [Learn RAG from Scratch – Python AI Tutorial from a LangChain Engineer](https://www.freecodecamp.org/news/mastering-rag-from-scratch/); recorded access `unknown`.
- backend-to-ai: [RAG Tutorial for Beginners: Build a Retrieval Pipeline in Python | LogicWiz](https://logicwiz.ai/genai/guides/rag-tutorial-for-beginners/); recorded access `unknown`.
- backend-to-ai: [Ragas Evaluation: The Complete RAG Metrics Tutorial (2026) | QASkills.sh](https://qaskills.sh/blog/ragas-llm-evaluation-guide); recorded access `unknown`.
- backend-to-ai: [Using DeepEval for Large Language Model (LLM) Evaluation in Python | Codecademy](https://www.codecademy.com/article/using-deepeval-for-llm-evaluation-python); recorded access `unknown`.
- backend-to-ai: [A complete guide to RAG evaluation: metrics, testing and best practices](https://www.evidentlyai.com/llm-guide/rag-evaluation); recorded access `unknown`.
- backend-to-ai: [Production-Ready FastAPI Deployment Using Docker and Uvicorn | seenode blog](https://seenode.com/blog/deploy-fastapi-docker-and-uvicorn); recorded access `unknown`.
- backend-to-ai: [Your First Containerized Machine Learning Deployment with Docker and FastAPI - MachineLearningMastery.comYour First Containerized Machine Learning Deployment with Docker and FastAPI - MachineLearningMastery.com](https://machinelearningmastery.com/your-first-containerized-machine-learning-deployment-with-docker-and-fastapi/); recorded access `unknown`.
- prior-knowledge: [Lesson 6: Observational Drawings — Free Online Painting Course](https://www.painting-course.com/the-painting-course-1/lesson-6-observational-drawings); recorded access `unknown`.
- prior-knowledge: [7 Observational Drawing Exercises – Artistcoveries](https://artistcoveries.com/2025/05/21/7-observational-drawing-exercises/); recorded access `unknown`.
- prior-knowledge: [Lesson 3: Drawing an Object from Observation - Studio in a School](https://createart.studioinaschool.org/lesson-plan/lesson-3-drawing-an-object-from-observation/); recorded access `unknown`.
- prior-knowledge: [How To Improve Your Observational Drawing Skills  – Journey Art Stuff](https://journeyartstuff.com/blogs/journey-art-supplies-blog/5-tips-to-improve-your-observational-drawing-skills); recorded access `unknown`.
- prior-knowledge: [Mastering Scale & Proportion | BLICK Art Materials](https://www.dickblick.com/learning-resources/how-to/scale-and-proportion/); recorded access `unknown`.
- prior-knowledge: [Mastering Observational Drawing: 2 Simple Tips for Accurate Proportions](https://www.jamesottoallen.com/post/mastering-observational-drawing-2-simple-tips-for-accurate-proportions); recorded access `unknown`.
- prior-knowledge: [Exercise 9: Observing shadow and light formations on a surface – mags phelan](https://magsphelan.wordpress.com/2012/11/13/exercise-observing-shadow-and-light-formations-on-a-surface/); recorded access `unknown`.
- prior-knowledge: [1 – Observing Light and Shadow Formations on a Surface – My Drawing Course](https://mydrawingcourse.com/category/coursework/pt-1-mark-making-and-tone/3-tone-and-form/1-observing-light-and-shadow-formations-on-a-surface/); recorded access `unknown`.
- prior-knowledge: [Seeing Light. Artist’s eye training while out and about | Love life drawing](https://www.lovelifedrawing.com/seeing-light-eye-training-while-out-and-about/); recorded access `unknown`.

Final AI source audit: 18 distinct recommended URLs checked on 8 October 2026;
14 publisher pages re-inspected, four unavailable. Search-grounded video evidence
remains distinct from HTML inspection: a YouTube shell does not establish a reviewed
video transcript. The two further-learning overview references are orientation,
not claimed full advanced instruction. Official/free preference is not a guarantee;
unknown access labels remain visible.

- [LazyLLM RAG principles tutorial](https://docs.lazyllm.ai/en/stable/Tutorial/1/)
- [LLM and RAG hands-on guide](https://github.com/zahaby/intro-llm-rag)
- [RAG step-by-step tutorial](https://superml.org/tutorials/rag-beginner)
- [RAG evaluation metrics guidance](https://www.patronus.ai/llm-testing/rag-evaluation-metrics)
- [Retrieval-augmented generation evaluation metrics](https://www.geeksforgeeks.org/nlp/evaluation-metrics-for-retrieval-augmented-generation-rag-systems/)

Additional browser proof: `roadmap-ai-final-workspace.png`; completed native
workspace opened with 18 core hours, 0/11 completion, weekly milestones, further
learning and the saved programming assumptions.

## Independent branch review and final fix pass

A fresh GPT-6 Astra reviewer inspected `b0600ad..ff79312` read-only. It identified
four Important findings and no Critical or Minor findings. All four were reproduced
and fixed in one pass, followed by the full 430 Python / 333 frontend / 16 shared
suites, TypeScript, Ruff, strict scoped mypy and isolated Next production build.
No re-review or further paid research run was needed.

- Assessment persistence expires the pre-model ORM snapshot and rechecks current
  write permission and active account status. Cross-session ownership/access removal
  and account-deactivation tests prevent stale-owner writes.
- Outbound fetch paths/queries are repeatedly percent-decoded before the same
  private-context and identifier checks used by search. Query-bearing destinations
  must match a recorded source or explicit user reference. Rejected requests cause
  no transport or fetch charge. Public ISO publication dates remain usable.
- Saved sessions and archived history allow readers who own those lessons; lesson
  creation/claim/finish and assessments still independently require write access.
- Canvas cards retain selected-route and further-learning semantics. Choice rationale
  identifies the recommendation; unselected routes appear only after Show alternatives
  for visible expanded choices. Topic IDs, workload and saved progress remain unchanged.

The reviewer did not independently repeat external research, mutating suites,
migrations, builds or Docker deployment. The executor's measured verification is
reported above. Existing mypy failures and live migration-history reconciliation
remain explicit limitations. Learning-profile/time-budget editing through refinement
and semantic/paraphrased DLP remain outside this release's approved scope. Every
set-aside behavior and its cost is preserved in the decision audit.

Final committed fix revision: `8a0cfe2`. API `/healthz` is healthy, the refreshed
worker loads the reviewed private-fetch boundary, and the completed native QA
workspace remains accessible through the authenticated API with its original
valid 1,080-minute curriculum. Local application entry point: http://localhost:3300.

Detailed native records and verification logs are preserved outside the deleted
execution scratch directory at
`/Users/balveerd/.codex/visualizations/2026/10/06/01a11274-a96e-7ec0-8cfe-c0d46575019c/roadmap-verification-evidence/`.
