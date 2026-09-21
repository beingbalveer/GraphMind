# Socratic Dialogue Mode Implementation Plan

> Agentic-worker sub-skill note: track work in this order. - [ ] session persistence - [ ] chat UX - [ ] prompt eval/ops

**Goal:** give an opt-in, bounded question-first learning dialogue with direct-answer escape.  
**Architecture:** durable session/turn state → provider-validated next question → chat UI and final summary branch.  
**Tech Stack:** FastAPI/SQLAlchemy/Alembic/Postgres/SSE, `packages/ai-core`, Next.js.  
**Spec:** `docs/FEATURE_RESEARCH.md §5.3`.

## Global Constraints

Honor `AGENTS.md` and URL helpers, use provider abstraction/Alembic/RBAC, and shared semantic UI primitives with dark-mode and keyboard/live-region accessibility. Do not make raw history changes, use a user answer as authorization, or create an infinite question loop/dead control.

## Status, objective, and UX

**Status: partially adjacent.** `LearningActions` “quiz” asks one question at a time and `teach_back` requests a learner explanation, but chat has no persistent mode, turn state, prompt prefix `/socratic`, exit/resume policy, or assessment record. Goal: a learner explicitly enters a guided, question-first dialogue attached to an anchor node; the model asks a calibrated question, waits, probes reasoning, gives bounded feedback/hints, and exits with a summary. Non-goals: trap learners in questions, grade mental state, or use Socratic questioning during safety-critical/urgent queries.

Flow: node menu or `/socratic` starts a `SocraticSession`; a visible banner says “Guided discovery—ask for a direct explanation anytime.” User answers, presses Hint, Explain, Skip, or End. Each response shows goal/reasoning feedback and a next question; exit produces a normal summary child branch and optional linked concept/quiz event. Mobile/keyboard uses ordinary ChatInput and buttons—no key capture while typing. Announce new question with `aria-live="polite"`; preserve focus on input.

## Design and contracts

Create `SocraticSessionModel(id,workspace_id,anchor_node_id,user_id,status,objective,level,turn_count,max_turns,summary_node_id,prompt_version,created_at,ended_at)` and `SocraticTurnModel(id,session_id,ordinal,role,content,assessment_json,created_at)`. Add migration/import/relationships, `schemas/socratic.py`, `services/socratic_service.py`, `routers/socratic.py`, main registration; frontend `lib/socraticApi.ts`, `components/chat/SocraticPanel.tsx`, modify `LearningActions.tsx`, `ChatContainer.tsx`, `ChatInput.tsx`, `useChatStream.ts`.

`POST /workspaces/{wid}/nodes/{nid}/socratic-sessions {objective?,level?}` → session/first question; `POST /socratic-sessions/{id}/turns {answer,action, idempotencyKey}` → `{feedback,nextQuestion,canExit}`; `POST .../end` materializes summary once. Reuse provider abstraction but enforce server session state/max 8 turns. System prompt: “Ask one answerable question, diagnose only supplied response, acknowledge uncertainty, offer direct explanation on request; do not fabricate mastery; output JSON `{feedback,next_question,hint,skill_tags}`.”

## Reliability, safety, evaluation, rollout

Require workspace read/write appropriately; turn ownership, length/rate limits, moderation, encryption/retention/deletion. Treat learner input/node text as data and prevent prompt injection. Handle refresh/reconnect by retrieving durable session; race via ordinal/idempotency; provider error with retry/direct-answer fallback; abandoned session auto-expire; selected unsupported source no start. Log structured session IDs—not answer text—plus latency, completion/hint/skip rates; instrument learning outcomes only with consent. SLO p95 turn <5s, preserve every committed turn before streaming next. Evaluate 200 seeded dialogues: one question/turn 100%, direct-answer request honored 100%, rubric accuracy ≥.8, unsafe refusal routes correct. Retrieval practice has evidence beyond repeated presentation ([McDaniel et al.](https://pubmed.ncbi.nlm.nih.gov/22082095/)).

Decision: session tables, not metadata/chats alone, make continuation, audit, deletion, and AI evaluation reliable. Do not automatically convert every quiz to Socratic mode: user intent and cognitive load differ.

## Research questions answered

1. **Why question-first?** Retrieval/practice can improve later academic performance ([study](https://pubmed.ncbi.nlm.nih.gov/22082095/)).
2. **Can it withhold direct answers indefinitely?** No; explicit Explain/Skip must be available.
3. **How many turns?** Max eight, then offer summary/continue to prevent loops.
4. **Can a chat message identify a session?** No; persist a session ID/state.
5. **Should hints count as correct?** Record separately; do not inflate mastery.
6. **Can model assess confidence from prose?** Treat it as tentative feedback, not psychometric fact.
7. **How secure IDs?** authorize each session against workspace and owner, preventing BOLA ([OWASP](https://api-security.owasp.org/editions/2023/en/0x00-header/)).
8. **How accessible is dynamic questioning?** retain focus and use polite announcements, not forced focus jumps ([MDN](https://developer.mozilla.org/en-US/docs/Web/Accessibility/Guides/Keyboard-navigable_JavaScript_widgets)).

## Tickets, tests, DoD

1. **SOC-101 persistence/API:** models/migration/service/router. AC: authorization, eight-turn cap, duplicate turn returns same response, end creates one summary. `uv run pytest apps/api/tests/test_socratic_service.py apps/api/tests/test_socratic_endpoints.py`.
2. **SOC-102 chat UX:** start/banner/actions/reconnect. AC: Explain/Skip/End work with keyboard; focus stays input. `pnpm --filter @graphmind/web vitest run src/components/chat/__tests__/socratic-panel.test.tsx`.
3. **SOC-103 prompt/eval/ops:** JSON guard/eval fixtures/flag/dashboard. AC: direct-answer and injection tests pass. Run `uv run ruff check apps/api/src apps/api/tests && uv run mypy apps/api/src && pnpm --filter @graphmind/web build`.

DoD: session recovery/deletion/privacy tested; no infinite auto-question loop; evaluation and observability thresholds accepted; error fallback and flag rollback work.

## Sources

[Test-enhanced learning](https://pubmed.ncbi.nlm.nih.gov/22082095/) · [OWASP API Top 10](https://api-security.owasp.org/editions/2023/en/0x00-header/) · [MDN keyboard widgets](https://developer.mozilla.org/en-US/docs/Web/Accessibility/Guides/Keyboard-navigable_JavaScript_widgets) · [NIST GAI Profile](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf)

## Execution addendum: edges, rollout, ticket cards

| Edge case | Required result | Test |
|---|---|---|
| refresh | durable current turn, no duplicate question | `test_session_resumes` |
| duplicate answer | ordinal/idempotency stable response | `test_turn_is_idempotent` |
| turn eight | end/direct explanation only | `test_turn_cap` |
| model failure | direct-answer fallback | `test_provider_failure_fallback` |
| deleted anchor | safe end/redaction | `test_deleted_anchor` |

Migration is additive/no backfill. Ship `socratic_mode_enabled` internal→5→25→100% after direct-answer/p95/error gates; disabling blocks start but permits active end/read for 24 hours.

### SOC-101 implementation card

**Objective:** persistent bounded session/turn API. **Dependencies:** chat/auth/provider. **Create:** `models/socratic.py`, `schemas/socratic.py`, `services/socratic_service.py`, `routers/socratic.py`, `apps/api/alembic/versions/20260921_0020_add_socratic_sessions.py`, `tests/test_socratic_service.py`, `tests/test_socratic_endpoints.py`. **Modify:** `models/workspace.py`, `models/__init__.py`, `main.py`.

1. Add session/turn SQL fields in plan, `unique(session_id,ordinal)` and user/workspace indexes. 2. Write additive upgrade/downgrade. 3. Start validates anchor/write permission and persists first JSON question. 4. Turn locks session/version, validates `answer|hint|skip|explain`, cap/UUID. 5. End creates exactly one summary child/event. 6. Test foreign, expiry, cap, concurrent calls.

**Acceptance:** actor-only access; one question/ordinal; Explain/Skip always work; one end summary; migration reversible. **Commands:** `uv run pytest apps/api/tests/test_socratic_service.py apps/api/tests/test_socratic_endpoints.py && uv run ruff check apps/api/src apps/api/tests && uv run mypy apps/api/src`. **Rollback:** flag blocks start, preserves sessions.

### SOC-102 implementation card

**Objective:** accessible chat interaction. **Dependencies:** SOC-101. **Create:** `lib/socraticApi.ts`, `components/chat/SocraticPanel.tsx`, `components/chat/__tests__/socratic-panel.test.tsx`. **Modify:** `LearningActions.tsx`, `ChatContainer.tsx`, `ChatInput.tsx`, `useChatStream.ts`.

1. Parse `/socratic`/action. 2. Render banner/turn/direct/hint/skip/end. 3. Keep input focus after response. 4. Send UUID and disable only pending turn. 5. Resume GET on refresh. 6. Test live-region/keyboard/error/dark states.

**Acceptance:** no typing key capture; direct answer exits visibly; retry is safe; announcement works. **Commands:** `pnpm --filter @graphmind/web vitest run src/components/chat/__tests__/socratic-panel.test.tsx && pnpm --filter @graphmind/web build`. **Rollback:** hide start action.

### SOC-103 implementation card

**Objective:** prove calibrated question behaviour. **Dependencies:** SOC-101/102. **Create:** `tests/evals/socratic_cases.json`, `tests/test_socratic_evals.py`, dashboard/runbook. **Modify:** prompt/metric config.

1. Fixture direct-answer/unsafe/injection/novice cases. 2. Validate JSON one-question rule. 3. Score feedback. 4. Emit opaque latency/hint/exit metrics. 5. Alert loop/provider failure.

**Acceptance:** direct answer 100%; one question; injection safe; flag drill documented. **Commands:** `uv run pytest apps/api/tests/test_socratic_evals.py`; full lint/type/build. **Rollback:** disable generation.

## Implementation handoff checks

1. `SocraticSession.status` transitions only `active→ended|expired`.
2. Store turn ordinal server-side; never trust client count.
3. Keep model system prompt/version with session for audit.
4. Add max answer bytes and moderation/error response before provider call.
5. Persist learner answer before streaming provider response.
6. Use optimistic session version to return 409 on simultaneous tabs.
7. Schedule expiry worker to mark idle sessions, never delete active data silently.
8. Ensure summary node parent/source linkage complies with graph transaction rules.
9. Do not increment concept mastery for a hint or a skipped answer.
10. Emit only opaque session metrics, never answer text.
11. Verify reconnect GET path returns latest committed turn.
12. Run manual screen-reader test for question announcement and input focus.
