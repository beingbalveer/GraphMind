# GraphMind Feature Implementation Plans

This directory contains one researched, implementation-ready plan for every numbered feature in `docs/FEATURE_RESEARCH.md`. The plans are grounded in the current repository as of 2026-09-19: shipped or partial capabilities are extended rather than re-created.

Before implementing any ticket, read `AGENTS.md`, `docs/URL_DESIGN.md`, the relevant plan, and [the expert-panel decisions](./00-expert-panel-decisions.md). Follow the repository approval gate and implement one ticket at a time.

## Shared implementation order

The feature documents are independent planning artifacts, but the platform should be built in dependency waves:

1. **Learning data foundation:** normalized event ledger/outbox, projection runner, privacy/delete semantics, job retries, feature flags, and evaluation harness.
2. **Core learning loop:** roadmap hardening, flashcard provenance, FSRS queue, quiz attempts, mastery projection, and onboarding.
3. **Adaptation and consolidation:** prerequisite gates, gap analysis, decay alerts, dashboard, timeline, related concepts, annotations, digest, and study planner.
4. **Active exercises and graph scale:** Feynman, Socratic, analogy, comparison, challenges, collapse/focus/minimap, and import/export.
5. **Community and agentic intelligence:** gallery, buddy pairing, weekly challenges, curriculum, curator, debate, and prerequisite validation.
6. **Additional clients:** mobile review surface, VS Code extension, and browser clipper after the API/privacy contracts stabilize.

## Plan index

| # | Feature | Category | Current-state note |
|---:|---|---|---|
| 01 | [Start Learning X roadmap generator](./01-start-learning-roadmap-generator.md) | Intelligent roadmap | Partial; generator and UI exist |
| 02 | [Prerequisite gate system](./02-prerequisite-gate-system.md) | Intelligent roadmap | New gate state over existing prerequisite data |
| 03 | [Career path templates](./03-career-path-templates.md) | Intelligent roadmap | New curated template layer |
| 04 | [Dynamic gap analysis](./04-dynamic-gap-analysis.md) | Intelligent roadmap | Partial curator/gap service exists |
| 05 | [Node-linked flashcard generation](./05-node-linked-flashcard-generation.md) | Recall and repetition | Shipped; plan hardens provenance/quality |
| 06 | [FSRS spaced-repetition scheduler](./06-fsrs-spaced-repetition-scheduler.md) | Recall and repetition | New scheduling state and queue |
| 07 | [In-canvas quick quiz](./07-in-canvas-quick-quiz.md) | Recall and repetition | Partial prompt/card feedback exists |
| 08 | [Feynman teach-it-back mode](./08-feynman-teach-it-back.md) | Recall and repetition | Prompt action exists; durable loop is new |
| 09 | [Forgetting decay alerts](./09-forgetting-decay-alerts.md) | Recall and repetition | Replaces fixed staleness with calibrated risk |
| 10 | [Mastery heatmap overlay](./10-mastery-heatmap-overlay.md) | Progress and mastery | Partial UI/mastery signals exist |
| 11 | [Daily and weekly dashboard](./11-daily-weekly-learning-dashboard.md) | Progress and mastery | New event-backed aggregates |
| 12 | [Streak and consistency tracker](./12-streak-consistency-tracker.md) | Progress and mastery | New meaningful-action policy |
| 13 | [Knowledge timeline and session history](./13-knowledge-timeline-session-history.md) | Progress and mastery | Partial timeline reconstruction exists |
| 14 | [Explore related concepts](./14-explore-related-concepts.md) | Discovery | New ephemeral suggestions over existing vectors |
| 15 | [Cross-workspace concept linking](./15-cross-workspace-concept-linking.md) | Discovery | New privacy-safe cross-workspace index |
| 16 | [Rabbit-hole depth tracker](./16-rabbit-hole-depth-tracker.md) | Discovery | New explainable depth projection |
| 17 | [Web-grounded topic enrichment](./17-web-grounded-topic-enrichment.md) | Discovery | Partial web tool exists |
| 18 | [Code challenge node type](./18-code-challenge-node-type.md) | Active exercises | New sandboxed challenge domain |
| 19 | [Analogy builder](./19-analogy-builder.md) | Active exercises | New provider-agnostic exercise |
| 20 | [Socratic dialogue mode](./20-socratic-dialogue-mode.md) | Active exercises | Prompt action exists; session state is new |
| 21 | [Concept comparison challenge](./21-concept-comparison-challenge.md) | Active exercises | New two-node exercise |
| 22 | [Revision-mode daily digest](./22-revision-mode-daily-digest.md) | Memory consolidation | New digest orchestration/delivery |
| 23 | [Node annotations and personal notes](./23-node-annotations-personal-notes.md) | Memory consolidation | New private annotation model |
| 24 | [Re-explain differently](./24-reexplain-differently.md) | Memory consolidation | New sibling-node generation contract |
| 25 | [Study session planner](./25-study-session-planner.md) | Memory consolidation | New deterministic time-budget planner |
| 26 | [Onboarding goal setting](./26-onboarding-goal-setting-flow.md) | UX | New first-value orchestration over roadmap API |
| 27 | [Keyboard-first navigation](./27-keyboard-first-navigation.md) | UX | Extends existing shortcut hook/accessibility |
| 28 | [Smart context-aware prompting](./28-smart-context-aware-prompting.md) | UX | New authorized suggestion service |
| 29 | [Node collapse, focus, and minimap](./29-node-collapse-focus-minimap.md) | UX | Extends existing React Flow canvas |
| 30 | [Import and export ecosystem](./30-import-export-ecosystem.md) | UX | Extends file pipeline; adds safe exporters |
| 31 | [Public roadmap gallery](./31-public-roadmap-gallery.md) | Social | New publication/fork boundary |
| 32 | [Study buddy pairing](./32-study-buddy-pairing.md) | Social | New opt-in, metadata-only collaboration |
| 33 | [Weekly learning challenges](./33-weekly-learning-challenges.md) | Social | New moderated challenge system |
| 34 | [Auto-curriculum generator](./34-auto-curriculum-generator.md) | Advanced AI | Extends roadmap with deadline scheduling |
| 35 | [Knowledge curator agent](./35-knowledge-curator-agent.md) | Advanced AI | Partial curator service exists |
| 36 | [Debate mode](./36-debate-mode.md) | Advanced AI | New evidence-bounded exercise |
| 37 | [Concept prerequisite validator](./37-concept-prerequisite-validator.md) | Advanced AI | Extends curator and roadmap evidence |
| 38 | [Mobile-responsive review mode](./38-mobile-responsive-review-mode.md) | Platform | New responsive/PWA review surface |
| 39 | [VS Code extension](./39-vs-code-extension.md) | Platform | New least-privilege external client |
| 40 | [Browser extension web clipper](./40-browser-extension-web-clipper.md) | Platform | New consent-first Manifest V3 client |

## Quality contract used for these plans

Every feature file includes:

- current implementation evidence, goal, non-goals, user flow, and architecture;
- researched direct links and feature-specific questions answered without deferring to the user;
- exact models, APIs, types, repository paths, AI prompts/evaluations where applicable;
- security, privacy, accessibility, edge cases, efficiency, observability, rollout, backfill, and rollback;
- Jira-style tickets with dependencies, concrete steps, acceptance criteria, named tests, and commands;
- an explicit Definition of Done.

The documents intentionally do not commit to implementing all 40 features in parallel. `AGENTS.md` requires one approved roadmap task at a time, and the dependency waves above prevent duplicated infrastructure and contradictory learning state.

