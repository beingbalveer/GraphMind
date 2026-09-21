# Debate Mode Implementation Plan

**Spec:** `docs/FEATURE_RESEARCH.md §9.3`  
**Agentic-worker sub-skill checklist:** `[ ]` read plan/AGENTS.md; `[ ]` complete safety policy; `[ ]` implement tickets in order; `[ ]` run red-team/evals; `[ ]` verify UI; `[ ]` request review.  
**Goal:** learner-controlled, source-labelled critical reasoning practice rather than engagement-driven argument.  
**Architecture:** private structured sessions/turns/assessments with grounded provider calls and explicit save.  
**Tech stack:** FastAPI/Pydantic/SQLAlchemy/Alembic, ai-core/web grounding, Next.js/TypeScript.  
**Global constraints:** Follow AGENTS.md; preserve URL_DESIGN/central helpers; use ai-core providers; Alembic migrations; RBAC; semantic primitives/tokens/dark-mode safety; WCAG keyboard/focus/reduced motion; no dead controls.

**Status:** future. AI chat/skills and `quiz_master` exist, but no debate session model, balanced viewpoint generator, source policy, turn state, answer assessment or harmful-topic policy exists.

## Goal/non-goals and UX flow

Help a learner analyse a nuanced claim by exposing charitable, evidence-labelled competing positions and asking them to reason—not by simulating consensus or generating partisan persuasion. From an eligible node, the learner selects a proposition and format (steelman/rebuttal/compare evidence), confirms it, reads scope and sources, writes an argument, receives rubric feedback, and may save a summary as an explicitly labelled child node. End/leave deletes the unsaved draft.

Non-goals: political targeting, therapeutic/legal/medical advice, deceptive personas, engagement-maximising conflict, real-user debate, automatic publishing, or an AI verdict on personal beliefs. High-risk topic categories require grounded sources or a safe “cannot facilitate this format” response.

## Model, prompt, API, files

`DebateSession(id,workspace_id,node_id,owner_id,proposition,mode,status,source_snapshot,policy_version,prompt_version,created_at)`, `DebateTurn(id,session_id,sequence,actor,content,claims JSONB,created_at)`, `DebateAssessment(turn_id,rubric JSONB,limitations,created_at)` are private/workspace-scoped. `POST /workspaces/{id}/nodes/{node}/debates` creates a draft after policy classification; `POST /.../debates/{id}/turns` produces next structured AI turn; `POST /.../{id}/complete` creates a summary node only after preview; `DELETE` ends. Attach citations as `{url,title,quote_span?}` only when the existing web-grounding pipeline obtained them; otherwise label views as ungrounded hypothetical arguments.

Create `apps/api/alembic/versions/20260921_0036_add_debate_sessions.py`, `apps/api/src/models/debate.py`, `apps/api/src/schemas/debate.py`, `apps/api/src/services/debate_service.py`, `apps/api/src/routers/debates.py`, `apps/api/tests/test_debate_models.py`, `apps/api/tests/test_debate_service.py`, `apps/web/src/lib/debateApi.ts`, `apps/web/src/components/chat/DebateModal.tsx`, `apps/web/src/components/chat/DebateTurn.tsx`, `apps/web/src/components/chat/__tests__/debate-modal.test.tsx`; modify `apps/api/src/main.py`, `apps/api/src/models/__init__.py`, `apps/api/src/routers/chat.py` or the grounded tool adapter, `apps/web/src/components/chat/LearningActions.tsx`, `apps/web/src/components/chat/ChatMessage.tsx`, and `packages/shared/src/index.ts`. Keep prompt/provider calls behind `ai-core`. Prompt requires: distinguish evidence/fact/value, steelman before rebutting, declare uncertainty, cite supplied source IDs only, avoid personal persuasion, score argument against transparent rubric (claim, evidence, counterargument, reasoning), never say “winner.”

## Safety, accessibility, AI eval/reliability

Classify/route protected or high-stakes prompts; do not infer personal attributes. Source selection uses reputable primary/authoritative sources where practical, diverse perspectives only when meaningful, date labels, and citations inspected before showing. Render source links safely; never invent citations. Limit turns/tokens and rate-limit expensive requests. Use moderation before/after output, abuse reporting, sensitive-content warning, erase/export control, retention TTL configurable, encrypted storage, and no training use without consent. Modal uses existing primitives, focus trap/return, semantic headings/live response status, keyboard submit/stop, non-colour labels and reduced motion.

Evaluate balancedness, factual citation support, instruction injection, identity attack/refusal, prompt conformity, and rubric calibration with expert-labelled fixtures. Job/turn idempotency keys prevent double model calls; server returns cached last result after timeout; trace each call without text logging. Metrics: completion, abandon, safety block, citation coverage, hallucinated-citation incidents, user-reported imbalance, latency/cost.

## Tickets/verification/DoD

1. **DATA-931** session/turn/migration/retention; accept private ownership and ordered turns.
2. **AI-931** grounded prompt/schema/policy/evals; accept no fabricated source IDs or winner claims in corpus.
3. **API-931** turn/complete/save endpoints; accept idempotency, ownership and cancellation.
4. **WEB-931** accessible debate flow/source disclosure; accept all controls/escapes/focus path and no dead action.
5. **QA-931** `uv run pytest apps/api/tests/test_debate*.py`, `uv run ruff check apps/api`, `uv run mypy apps/api/src`, `pnpm --filter @graphmind/web test`, `pnpm --filter @graphmind/web build` plus red-team review.

Definition of Done: every displayed claim is scoped/cited or labelled hypothetical, learner controls saving, policy moderation is operational, and automated/manual AI quality gates pass.

## Research questions answered

1. **Does debate need two equal sides?** No; evidence may be asymmetric; label that rather than false balance.
2. **Can it declare a winner?** No; assess reasoning via a transparent rubric.
3. **Can it invent citations?** Never; cite supplied grounded source IDs only.
4. **What is saved?** Only learner-approved labelled summary/turns per retention policy.
5. **How prevent persuasion harms?** Avoid targeting, safety classify high-risk topics, and provide neutral educational framing.
6. **Can raw node text direct the model?** No; it is quoted input data, not instruction.
7. **Why source snapshots?** Debate reproducibility requires a known evidence base.
8. **Why idempotency?** Retried turn requests must not create divergent paid AI responses.

Sources: [OpenAI safety best practices](https://platform.openai.com/docs/guides/safety-best-practices), [OpenAI evals](https://platform.openai.com/docs/guides/evals), [OWASP prompt injection](https://genai.owasp.org/llmrisk/llm01-prompt-injection/), [WCAG 2.2](https://www.w3.org/TR/WCAG22/).

## Detailed ticket execution

### DATA-931 — private session history

**Objective:** persist owner-scoped ordered debate drafts with explicit completion/save. **Create:** `apps/api/alembic/versions/20260921_0036_add_debate_sessions.py`, `apps/api/src/models/debate.py`, `apps/api/src/schemas/debate.py`, `apps/api/tests/test_debate_models.py`. **Modify:** `apps/api/src/models/__init__.py`, `apps/api/src/main.py`. **Dependencies:** node/workspace RBAC. **Flag/rollback:** `debate_mode_v1`; disable entry/API, retain/delete drafts by policy.

1. Add session/turn/assessment tables, sequence unique index, source snapshot/policy/prompt versions and retention/delete fields.
2. Validate proposition/turn length/mode/status and owner/workspace/node membership.
3. Store sources as structured citation IDs/URLs, not unverified HTML.
4. Mark completion separately from create-summary command; summary creation is absent until confirm.
5. Test migration/order/owner/delete and no cross-workspace turn access.

Acceptance: (1) no session public by default; (2) turn ordering immutable; (3) no auto-summary node; (4) source version recorded; (5) deletion works. Run `uv run pytest apps/api/tests/test_debate_models.py`.

### AI-931/API-931 — safe grounded turn service

**Objective:** generate transparent educational critique rather than a “winner.” **Create:** `apps/api/src/services/debate_policy_service.py`, `apps/api/src/services/debate_service.py`, `apps/api/src/routers/debates.py`, `apps/api/tests/test_debate_service.py`, `apps/api/tests/test_debate_evals.py`. **Modify:** `apps/api/src/routers/chat.py`, `apps/api/src/services/graph_tools.py`. **Dependencies:** DATA-931, web grounding. **Rollback:** schema/parser failure returns safe unavailable response.

1. Classify topic/policy before provider; route/refuse high-risk prompts under documented safe language.
2. Supply source snapshot/candidate citations, force JSON with claim/evidence/limitation/counterargument/rubric and no winner field.
3. Treat node/user text as quoted data and prohibit tool instruction/mutation; validate citations resolve.
4. Use idempotency key plus turn sequence lock; cache completed result for retry.
5. Evaluate false balance, fabricated source, identity attack, prompt injection, unsafe advice and rubric consistency.

Acceptance: (1) AI cannot save/mutate graph; (2) ungrounded views are labelled; (3) fabricated citations blocked; (4) duplicate request one turn; (5) policy refusal actionable. Run `uv run pytest apps/api/tests/test_debate*.py`, `uv run ruff check apps/api`, `uv run mypy apps/api/src`.

### WEB-931/QA-931 — learner-safe accessible flow

**Objective:** deliver clear consent, turns, sources and save choice. **Create:** `apps/web/src/lib/debateApi.ts`, `apps/web/src/components/chat/DebateModal.tsx`, `apps/web/src/components/chat/DebateTurn.tsx`, `apps/web/src/components/chat/__tests__/debate-modal.test.tsx`, `apps/web/tests/e2e/debate-mode.spec.ts`. **Modify:** `apps/web/src/components/chat/LearningActions.tsx`, `apps/web/src/components/chat/ChatMessage.tsx`. **Dependencies:** API-931. **Rollback:** hide action behind flag.

1. Build create mode/proposition/source-policy confirmation using Modal/Buttons, and only show active endpoint states.
2. Render semantic turn headings, source links, uncertainty/rubric/stop control and error/retry states.
3. Add explicit complete/save-preview/cancel-delete draft confirmations and focus restoration.
4. Support keyboard, live status, text-equivalent source info, contrast/dark/reduced motion.
5. Run red-team, accessibility manual test and gradual flag rollout dashboard.

Acceptance: (1) learner can stop/delete; (2) no fake source/winner UI; (3) save requires confirmation; (4) all actions keyboard-operable; (5) failure never creates summary. Commands `pnpm --filter @graphmind/web test`, `pnpm --filter @graphmind/web build`.

| Edge case | Handling | Test |
|---|---|---|
| no sources | label hypothetical/disable grounded mode | `test_no_source` |
| policy-sensitive subject | safety route/refusal | `test_sensitive_policy` |
| retry after timeout | same idempotency response | `test_turn_idempotency` |
| source revoked | snapshot warning/no claim | `test_stale_source` |
| user cancels | draft deleted/no summary | `debate-modal.test.tsx` |
| provider injection | output validator rejects | `test_prompt_injection` |

Rollout staff/red-team → opt-in cohort → broad release after citation/safety KPIs. No backfill. Rollback disables creation and preserves/deletes private records by retention rule.
