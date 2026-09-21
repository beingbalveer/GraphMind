# Concept Prerequisite Validator Implementation Plan

**Spec:** `docs/FEATURE_RESEARCH.md §9.4`  
**Agentic-worker sub-skill checklist:** `[ ]` read plan/AGENTS.md; `[ ]` validate ontology; `[ ]` implement tickets sequentially; `[ ]` run matcher/eval fixtures; `[ ]` audit wording/a11y; `[ ]` request review.  
**Goal:** non-blocking, explainable readiness guidance from evidence-backed prerequisite rules.  
**Architecture:** versioned ontology + deterministic matching/traversal, optional schema-constrained AI normalisation.  
**Tech stack:** FastAPI/Pydantic/SQLAlchemy/Alembic/PostgreSQL, ai-core, Next.js/TypeScript.  
**Global constraints:** AGENTS.md workflow, URL_DESIGN/central helpers, ai-core provider isolation, Alembic durability, RBAC, semantic primitives/tokens/dark mode, WCAG keyboard/focus/reduced motion and no dead UI are mandatory.

**Status:** partial. `CuratorService` has a static domain prerequisite DAG and `get_next_topics`; `MasteryService` has per-workspace concepts/mastery; `ChatInput.tsx` sends prompts. There is no pre-prompt validator, topic extraction confidence policy, learner choice UI, prerequisite proposal workflow, or false-positive controls.

## Goal/non-goals/flow

Before an advanced-topic request is sent, optionally check GraphMind's evidence-backed prerequisite graph and offer a non-blocking preparation choice: **continue anyway**, **show why**, **build a draft prerequisite branch**, or **open already-known prerequisite nodes**. It must never refuse learning, claim the learner does not know something merely because the graph lacks data, or silently add nodes.

Prompt submit computes a local/simple topic candidate; client calls `POST /workspaces/{id}/prerequisite-check` only after the learner submits or selects “check first,” avoiding per-keystroke surveillance. Service resolves a domain/topic only when confidence exceeds threshold, checks DAG prerequisites against concept links/mastery, returns `{status:'ready'|'possible_gap'|'unknown', topic, missing:[{conceptId,name,rationale,evidenceNodeIds}], confidence, disclaimer}`. `unknown` is the normal safe fallback. “Build” posts a preview request to roadmap/graph tool service and requires confirmation before persisting.

## Design/data/files

Keep ontology versioned and source-tagged: `PrerequisiteRule(id, ontology_version, topic_key, prerequisite_key, rationale, source_url, confidence, enabled)`, plus `PrerequisiteCheckAudit(id,workspace_id,request_hash,ontology_version,outcome,created_at)` storing no raw prompt by default. Existing static `DOMAIN_CONCEPTS_CATALOG` migrates incrementally into a repository-versioned seed/migration, then DB rules if product needs editing. Deterministic alias/entity matching plus curated rule traversal precedes any LLM. LLM may normalise candidate names under a strict JSON schema but cannot determine eligibility/mutate rules. 

Create migration `apps/api/alembic/versions/20260921_0037_add_prerequisite_checks.py`, models/schema/service/router/tests, `services/prerequisite_service.py`, ontology seed/version document. Modify `curator_service.py`, `roadmap_service.py`, `routers/chat.py`, `ChatInput.tsx`, `LearningActions.tsx`, `lib/apiClient.ts`, shared types and `main.py`; create `lib/prerequisiteApi.ts`, `components/chat/PrerequisiteCheckCard.tsx`, and tests. Use read auth for check, write auth/confirmation for graph creation. All node IDs must resolve inside workspace.

## Safety/accessibility/reliability/rollout

Make confidence/disclaimer conspicuous: “GraphMind has no evidence you studied X, not ‘you do not know X.’” Reveal rule source/rationale; enable feedback “I know this / this is wrong” which updates an evidence signal, not a self-declared mastery score automatically. No gate based on protected traits, no medical/legal precondition claims, no full prompt logging. Use semantic alert/status, focus preservation, buttons and keyboard/pointer actions, no colour-only confidence, and privacy setting to turn automatic check off. Cache rules by ontology version; not user result; deterministic traversal has depth/cycle limit. Monitor unknown/possible-gap rates, continue-anyway, correction rate, accepted draft rate, rule precision audit, latency and error rate. Ship one ontology domain on opt-in, evaluate correction/abandonment, expand only when validated; no historic backfill is required.

## Tickets/verification/DoD

1. **DATA-941** versioned prerequisite rules/audit migration; accept cycle/source/version validation.
2. **API-941** deterministic matcher/traversal/check endpoint; accept workspace isolation, high-confidence true/false/unknown fixtures and no raw prompt persistence.
3. **AI-941** optional normalisation prompt/eval; accept schema-only output, injection tests, threshold/unknown safe default.
4. **WEB-941** non-blocking check card/draft confirmation; accept keyboard, screen-reader wording and continue-anyway.
5. **QA-941** run `uv run pytest apps/api/tests/test_prerequisite*.py`, `uv run ruff check apps/api`, `uv run mypy apps/api/src`, `pnpm --filter @graphmind/web test`, `pnpm --filter @graphmind/web build`.

Definition of Done: it is explainable, reversible/non-blocking, deterministic rules are versioned/cited, AI cannot silently alter learning graph, and tests/evals/metrics gates pass.

## Research questions answered

1. **Can absence prove ignorance?** No; present a possible graph gap, never a personal judgment.
2. **Should validation block chat?** No; learners may continue at all times.
3. **Can an LLM define prerequisites?** Not at runtime; use reviewed/versioned rules and deterministic traversal.
4. **When should it run?** Submit/explicit check, not keystroke-by-keystroke.
5. **How explain a gap?** Rule source/rationale plus linked workspace evidence.
6. **Can self-report mark mastery?** Record feedback separately; do not overwrite measured mastery.
7. **What if a concept is ambiguous?** Return `unknown` or ask the learner to select a meaning.
8. **How avoid bad rules persisting?** Versioned ontology, correction feedback, precision audits, and rollback.

Sources: [OpenAI structured outputs](https://platform.openai.com/docs/guides/structured-outputs), [OWASP authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html), [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/), [GraphMind feature research](../FEATURE_RESEARCH.md).

## Detailed ticket execution

### DATA-941 — versioned reviewed ontology

**Objective:** move prerequisite truth from implicit code to traceable, reversible rules. **Create:** migration/models/schema/ontology seed/tests. **Modify:** curator service/model exports/main. **Dependencies:** existing curator concept catalog. **Flag/rollback:** `prerequisite_validator_v1`; off returns no checks and leaves rules dormant.

1. Add ontology version/rule tables or a versioned seeded registry with rule id, topic/prerequisite keys, rationale, source URL, confidence/enabled fields.
2. Enforce unique topic/prerequisite/version and validate DAG acyclicity during seed/migration/admin publish.
3. Add check audit with request hash/result/version/time and a separate learner correction record; exclude raw prompt.
4. Define rule deprecation/effective version so active checks reproduce their source set.
5. Test migration, cycles, source-required rule, version rollback and retention deletion.

Acceptance: (1) every active edge has rationale/source/version; (2) cycle cannot publish; (3) rules do not leak workspace data; (4) correction never auto-overwrites mastery; (5) upgrade/downgrade succeeds. Run `uv run pytest apps/api/tests/test_prerequisite_ontology.py`.

### API-941/AI-941 — deterministic check with safe unknown

**Objective:** produce explainable readiness guidance, never gate learning. **Create:** service/router/AI normalizer/eval/API tests. **Modify:** chat/roadmap/curator services. **Dependencies:** DATA-941, ai-core optional. **Rollback:** disable endpoint/client card; chat continues normally.

1. On submit/explicit action extract a bounded candidate using aliases/deterministic matcher; do not call per keystroke.
2. If alias ambiguity or confidence below threshold, return `unknown` with neutral action; do not call provider unless opted-in normalisation needed.
3. Traverse versioned rules with depth/cycle limit and compare only workspace concept evidence/mastery, returning `possible_gap`, not personal deficiency.
4. If AI normalizer enabled, supply allowed names and require strict JSON; validate output against candidate set/no graph tools.
5. Record minimised audit/feedback, rate limit, auth-check workspace/node IDs and test injection/malformed output.

Acceptance: (1) every user can Continue anyway; (2) unknown does not assert missing knowledge; (3) returned evidence IDs belong to workspace; (4) hallucinated topic/rule is discarded; (5) no raw prompt logs. Run `uv run pytest apps/api/tests/test_prerequisite*.py`, `uv run ruff check apps/api`, `uv run mypy apps/api/src`.

### WEB-941/QA-941 — non-blocking accessible choice

**Objective:** explain signal/uncertainty and require confirmation before graph drafts. **Create:** prerequisite API/card/Vitest/e2e tests. **Modify:** ChatInput/LearningActions/URLs/types. **Dependencies:** API-941, roadmap proposal API. **Rollback:** flag hides check card but submit remains unchanged.

1. Trigger only on submitted/selected prompt; render ready/possible-gap/unknown text with source/rationale and “Why am I seeing this?” link.
2. Provide Continue, open known prerequisite, build draft and “I know this/incorrect” feedback as real Buttons.
3. Build draft calls proposal endpoint; preview/confirmation is mandatory before node persistence.
4. Manage focus/status/retry/escape and use icon/text/semantic colour/reduced motion/dark tokens.
5. Test no selected topic, ambiguous topic, known prerequisite, viewer/API error and canonical deep-link navigation.

Acceptance: (1) user can always send original prompt; (2) card never claims certainty beyond evidence; (3) keyboard/screen reader gets equal information; (4) no direct history/url string; (5) feedback does not alter mastery automatically. Commands `pnpm --filter @graphmind/web test`, `pnpm --filter @graphmind/web build`.

| Edge case | Handling | Test |
|---|---|---|
| ambiguous term | `unknown`/meaning choice | `test_ambiguous_topic` |
| ontology cycle | publish rejection | `test_cycle_validation` |
| no workspace concepts | neutral possible graph gap | `test_empty_workspace` |
| stale/deleted evidence | omit/refetch, never actionable | `test_stale_node` |
| user says “I know it” | correction record only | `test_self_report` |
| injected prompt text | data-delimited/AI schema rejection | `test_normalizer_injection` |

Rollout one curated domain to internal opt-in → evaluate correction/continue/false-positive → allowlist → more ontology domains. No mastery/graph backfill. Rollback disables client/API feature flag; rules/audits remain versioned for later analysis/deletion.

**Implementation handoff:** rule authors must submit citation/rationale, acyclicity fixture and effective-version date in the same review as a new prerequisite edge; an unreviewed LLM suggestion is never a rule.

**Release owner:** learning science owns ontology quality; backend owns threshold/audit/RBAC tests; accessibility owner signs off neutral language and always-continue flow before cohort expansion.
