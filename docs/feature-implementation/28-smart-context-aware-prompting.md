# Smart Context-Aware Prompting Implementation Plan

**Spec:** `docs/FEATURE_RESEARCH.md §7.3`  
**Agentic-worker sub-skill checklist:** `[ ]` read plan/AGENTS.md; `[ ]` map existing services; `[ ]` implement tickets in order; `[ ]` run API/UI/eval tests; `[ ]` document flag/rollback; `[ ]` request review.  
**Goal:** optional grounded next-action suggestions that never auto-send or leak workspace data.  
**Architecture:** typed REST suggestion service with deterministic candidate sources, cache, and optional constrained provider phrasing.  
**Tech stack:** FastAPI/Pydantic/SQLAlchemy/Redis, `packages/ai-core`, Next.js/TypeScript/Vitest.  
**Global constraints:** Obey AGENTS.md approval/verification workflow; preserve URL_DESIGN and `@/lib/urls`; provider abstractions only through ai-core; migrations via Alembic; enforce current workspace RBAC; use semantic UI primitives/tokens, dark mode and WCAG-compliant keyboard/focus/reduced-motion behaviour; no mock/dead controls.

**Status:** proposed. `ChatInput.tsx` streams prompts and `LearningActions.tsx`/`QuizCard.tsx` expose some learning actions after content exists. `semantic_service.py` has related-topic machinery and `curator_service.py` has next-topic recommendations, but there is no debounced prompt-suggestion endpoint or UI chips.

## Goal and boundaries

Offer at most three useful, safe, context-specific next actions below the existing prompt: continue a branch, ask a curator recommendation, quiz, summarize, or generate flashcards. The learner always selects or edits a suggestion; GraphMind does not auto-send, infer sensitive attributes, or present claims as questions asked by other learners without aggregate, consented evidence.

## Evidence, stories, and UX

Retrieval recommendations should be grounded in the learner's workspace graph, not anonymous behavioural profiling. The existing semantic/curator data is the first candidate source; the AI is a ranker/rewriter only. In the prompt, a learner sees skeletal chips while input is empty/after a 250-ms pause. Arrow keys move a `listbox`; Enter inserts its text, while a distinct action chip opens a confirmation-compatible modal or invokes the actual feature. A “Why this?” control explains source node/curator reason and has “hide suggestions for this branch/workspace.” 

Use the [WAI combobox pattern](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/) for typed suggestions, and do not let a live region repeatedly announce tokens while the user types. This is suggestion UI only: no new browser route and no social recommendation corpus.

## Architecture/data/API

`PromptSuggestionService` composes deterministic candidates from: active node lineage, `CuratorService.get_next_topics`, due review counts when feature 2.2 exists, and related nodes from `SemanticService`. It applies policy/rate limit/deduplication, then (optionally) calls a provider through `ai-core` to phrase, never invent, suggestions. Cache `(workspace_id,node_id,input_prefix_hash,graph_updated_at)` for 60 seconds in Redis; request cancelation and latest-request-wins prevent stale chips.

Create `GET /workspaces/{workspace_id}/prompt-suggestions?chat_id=&node_id=&q=` (read permission) returning `PromptSuggestionsResponse { suggestions: PromptSuggestion[], generatedAt, sourceVersion }`. `PromptSuggestion` is `{id, kind:'prompt'|'quiz'|'flashcards'|'summary'|'next_topic', label, prompt?, action, rationale, sourceNodeIds, confidence}`. `POST /.../prompt-suggestion-feedback` accepts `{suggestionId, disposition:'shown'|'accepted'|'dismissed'}`; it is a minimised learning event, not raw text telemetry. SSE is unnecessary.

## Exact files, safety, quality

Modify `apps/api/src/routers/chat.py`, `apps/api/src/services/semantic_service.py`, `apps/api/src/services/curator_service.py`, `apps/api/src/main.py`, `apps/web/src/components/chat/ChatInput.tsx`, `apps/web/src/lib/apiClient.ts`, and `packages/shared/src/index.ts`. Create `apps/api/src/services/prompt_suggestion_service.py`, `apps/api/src/schemas/prompt_suggestions.py`, `apps/api/src/routers/prompt_suggestions.py`, `apps/api/tests/test_prompt_suggestions.py`, `apps/web/src/lib/promptSuggestionApi.ts`, `apps/web/src/components/chat/PromptSuggestions.tsx`, and corresponding Vitest tests.

Require workspace read auth and check every `node_id` belongs to the workspace. Never send raw prompt drafts, private node content, or cross-workspace titles to an LLM solely to suggest chips; cap lineage snippets, redact credentials/secrets, and return deterministic fallback candidates on provider failure. Escape all labels, impose query length/rate limits, and record only identifiers/outcome. UI uses `Button`, semantic tokens, visible focus, `aria-controls`, 24px+ targets, and reduced motion.

## Edge cases, rollout, metrics

Suppress while streaming, offline, empty workspace, private/incognito mode, or user disables suggestions. Treat stale source IDs as non-clickable and refresh. Measure displayed→accepted rate, time-to-next-meaningful-action, dismiss/disable rate, P95 endpoint latency, provider failure/fallback rate, and no suggestion-text logging. Ship server flag to 5%, then 25%, then 100% after accessibility and bad-suggestion review; no backfill needed.

## Tickets and verification

1. **API-731 Candidate service**: schemas, auth, deterministic sources, cache, feedback. Tests: authorization, workspace isolation, de-dupe, cancellation key and provider fallback.
2. **WEB-731 Accessible chips**: debounced cancellable fetch, keyboard listbox, insertion versus action behaviour, explanation/dismissal controls. Tests with `@testing-library/user-event`.
3. **AI-731 Grounded phrasing/evals**: prompt says “return JSON from supplied candidates only”; eval 100 fixtures for hallucinated nodes, duplicates, unsafe labels, and relevance.
4. **OBS-731 Release guard**: feature flag, dashboards, sampled structured logs, rollback runbook.

Run `uv run pytest apps/api/tests/test_prompt_suggestions.py`, `uv run ruff check apps/api`, `uv run mypy apps/api/src`, `pnpm --filter @graphmind/web test`, and `pnpm --filter @graphmind/web build`.

Definition of Done: suggestions are helpful optional controls, source/rationale is inspectable, only authorized graph data is used, fallback works without AI, and the listed tests/eval/metrics pass.

## Research questions answered

1. **Autocomplete or auto-send?** Autocomplete only; sending must remain explicit.
2. **Why debounce/cancel?** It avoids stale out-of-order UI and unnecessary provider calls.
3. **Can anonymous “other learners” questions be shown?** Not in v1; it needs consent, k-anonymity, moderation, and purpose limitation.
4. **Can the LLM choose any graph topic?** No; it may rephrase supplied authorized candidates only.
5. **Why a rationale?** Recommendation explanations support agency and error detection.
6. **Why separate feedback?** Ranking telemetry must not require retaining prompt content.
7. **Should this stream?** No; a small bounded REST response is simpler and cancellable.
8. **What makes it accessible?** Native input remains usable; suggestions follow APG combobox/listbox keyboard conventions.

Sources: [WAI combobox APG](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/), [WCAG 2.2](https://www.w3.org/TR/WCAG22/), [OpenTelemetry event conventions](https://opentelemetry.io/docs/specs/semconv/general/events/), [GraphMind ARCHITECTURE](../ARCHITECTURE.md).

## Detailed implementation matrix

| Ticket | Objective | Exact files | Dependencies | Flag/rollback |
|---|---|---|---|---|
| API-731 | grounded, authorized candidates | create service/schema/router/tests; modify `main.py`, curator/semantic services | mastery/curator endpoints | `prompt_suggestions_v1`; API returns 404 off |
| WEB-731 | accessible suggestion surface | create `PromptSuggestions.tsx`, API/tests; modify `ChatInput.tsx` | API-731 | hide component off |
| AI-731 | constrain phrasing/evals | create eval fixtures/prompt version registry | API-731, ai-core | deterministic candidates only fallback |
| OBS-731 | safe release evidence | create dashboard/runbook | all | disable flag, cache TTL expires |

### API-731 steps

1. Add `PromptSuggestion`, request/query and feedback Pydantic schemas with length limits, opaque IDs and strict action enum.
2. Resolve workspace/read RBAC, chat/node membership and max `q` length before looking up candidate sources.
3. Build candidates in deterministic priority order: active lineage action, curator next topic, due review count, semantic related node; dedupe normalized labels and cap three.
4. Cache only hash/key/version metadata for 60 seconds; include graph update version so stale graph data cannot be reused.
5. Implement feedback idempotently with actor/workspace/suggestion id/disposition, rate limit it, and emit no prompt text.

Acceptance: (1) foreign node/chat is 404; (2) empty/AI-failure returns safe deterministic suggestions or empty list; (3) result never includes a cross-workspace title/id; (4) cache invalidates after version change; (5) feedback cannot be used to enumerate suggestions. Tests: `apps/api/tests/test_prompt_suggestions.py`, `test_prompt_suggestion_authorization.py`; commands `uv run pytest apps/api/tests/test_prompt_suggestions.py apps/api/tests/test_prompt_suggestion_authorization.py`, `uv run ruff check apps/api`, `uv run mypy apps/api/src`.

### WEB-731 steps

1. Add typed request with `AbortController`, 250ms debounce and monotonic request counter so late replies cannot overwrite current input.
2. Render chips only while input is empty/eligible; use `Button` primitives, semantic tokens, no custom clickable spans.
3. Implement APG combobox/listbox keyboard navigation for text completions; action chips invoke existing action callbacks and confirmation where required.
4. Render `Why this?`, dismiss branch/workspace controls and retry error state; persist only preference, not prompt history.
5. Keep input focus on insertion; preserve expected focus/announcement after action/modal completion.

Acceptance: (1) typed user text is never overwritten/autosent; (2) input remains usable under IME/keyboard; (3) loading/error/dismiss paths are screen-reader-announced; (4) dark/high contrast works; (5) disabled flags render nothing, no hollow UI. Tests: `prompt-suggestions.test.tsx`, `prompt-suggestion-api.test.ts`; command `pnpm --filter @graphmind/web test`.

### AI-731 and OBS-731 steps

1. Define provider prompt/version: “rewrite supplied candidate only; return JSON; no new topic/claim/source.”
2. Validate provider output against Pydantic and candidate id set; discard invalid labels/actions rather than repairing hallucinations.
3. Create 100 fixture evals: duplicate label, unknown node, sensitive title, bad JSON, injection within node text, no candidate, and stale candidate.
4. Add `prompt_suggestions_v1` target/account/workspace flag, 5%/25%/100% ramp and metrics dashboard.
5. Roll back by disabling flag; service/cached data is additive and feedback rows retain only minimal analytics.

Acceptance: (1) 100% generated actions resolve to supplied candidates; (2) malformed output has fallback; (3) no raw prompt in logs; (4) P95/accept/dismiss/failure thresholds pass before ramp. Commands: `uv run pytest apps/api/tests/test_prompt_suggestions.py`; `pnpm --filter @graphmind/web test`; `pnpm --filter @graphmind/web build`.

## Edge-case/rollout matrix

| Edge case | Resolution | Test |
|---|---|---|
| stream active | suppress suggestions | `prompt-suggestions.test.tsx` |
| slow first request | abort/ignore stale response | `latest-request-wins.test.ts` |
| curator unavailable | semantic/lineage fallback | `test_curator_failure_fallback` |
| no eligible actions | render nothing, not empty chrome | `test_no_candidates` |
| user opts out | local/server preference checked before fetch | `test_suggestions_opt_out` |
| hostile candidate label | escape/length cap/validate | `test_label_sanitization` |

No backfill is needed. Deploy router/service behind disabled flag, then client to employees, then gradual cohort ramp; delete cache/pause flag to roll back without data migration.
