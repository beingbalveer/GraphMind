# GraphMind UI System — Master Design

Status: design authority for future implementation agents  
Date: 2026-09-10  
Audience: AI implementation agents, reviewers, and maintainers

## 1. Purpose

This document defines the complete GraphMind UI redesign program. It is the source of truth for why the redesign exists, what is included, how work is sequenced, how progress is measured, and where detailed implementation instructions live.

GraphMind is a learning workspace, not merely a chat application. The interface must help a learner ask questions, understand explanations, branch into related ideas, inspect evidence, see knowledge relationships, identify gaps, and decide what to learn next.

The redesign takes interaction and layout inspiration from the attached `assistant-ui-main.zip` source only. GraphMind must not install, import, or depend on `assistant-ui`. All implementation must use GraphMind-owned components and contracts.

## 2. Objectives

### Primary objectives

1. Make every repeated interaction visually and behaviorally consistent.
2. Centralize design decisions so a change to a shared component propagates everywhere.
3. Create a calm, polished, Apple-level experience without copying Apple branding or visuals.
4. Make learning progress, context, sources, branches, and next actions understandable.
5. Preserve existing chat, streaming, branching, file, skill, viewer, retry, stop, and send behavior.
6. Make desktop, tablet, mobile, light mode, dark mode, keyboard use, screen readers, and reduced motion first-class.
7. Give independent AI agents implementation-ready instructions with no implicit visual or interaction decisions.

### Non-objectives

- Adding an `assistant-ui` runtime dependency.
- Rebuilding a surface that already satisfies the shared contract.
- Introducing decorative UI that does not improve comprehension or learning.
- Mixing adaptive-shell work into a chat-only task.
- Creating mock buttons, dead panels, placeholder actions, or future-phase canvas behavior.

## 3. Product design direction

### GraphMind Calm

The visual language is quiet surfaces, restrained indigo brand emphasis, readable text, deliberate whitespace, subtle graph identity, and clear learning hierarchy. Emphasis is earned by importance: the learner's question and the explanation are primary; metadata and controls recede until useful.

### Adaptive Context

The default desktop structure is left navigation, focused central content, and a contextual rail that appears only when it adds value. On smaller screens, navigation and contextual information become drawers. The conversation must never be obscured by permanent side panels or clipped controls.

### Learning-first hierarchy

Every surface should answer, in order:

1. What am I looking at?
2. What can I do next?
3. Why is this information useful to my learning?
4. What evidence or relationship supports it?

## 4. Contract-first operating model

The shared UI contract is more authoritative than any individual screen. Product components compose common primitives; they do not recreate them.

### Centralized tokens

All components consume semantic tokens for backgrounds, surfaces, foregrounds, muted text, borders, brand, status colors, focus rings, spacing, typography, radii, elevation, breakpoints, and motion. Palette literals and arbitrary dimensions are forbidden in product layout files.

### Limited variants

Each shared primitive has a deliberately small approved variant set. A new variant requires a documented cross-surface need, proof that existing variants cannot satisfy it, accessibility behavior, theme behavior, tests, and reviewer approval.

### Single ownership

Buttons, inputs, checkboxes, switches, tabs, badges, titles, menus, dialogs, drawers, cards, loading indicators, and feedback patterns each have one canonical implementation. Product surfaces may provide content and callbacks, not replacement styling.

### Existing behavior preservation

Visual redesign must not silently change routing, API contracts, callback signatures, streaming state, persistence, or user data behavior. Any necessary behavior change must be explicitly documented as a separate decision.

## 5. Scope map

| Scope | Name | Purpose | Dependency | Detailed document |
|---|---|---|---|---|
| 1 | Foundations and generic primitives | Establish the shared visual and interaction contract | None | [Scope 1](2026-09-10-graphmind-ui-scope-1-foundations.md) |
| 2 | Canonical chat experience | Make chat the reference product surface | Scope 1 | [Scope 2](2026-09-10-graphmind-ui-scope-2-canonical-chat.md) |
| 3 | Adaptive workspace shell | Make navigation, header, chat/canvas modes, rail, and responsive behavior coherent | Scopes 1–2 | [Scope 3](2026-09-10-graphmind-ui-scope-3-adaptive-shell.md) |
| 4 | Remaining product surfaces | Audit and align dashboard, canvas, library, settings, and auxiliary surfaces | Scopes 1–3 | [Scope 4](2026-09-10-graphmind-ui-scope-4-product-surfaces.md) |

## 6. Progress and branch status

### High-level status

- Scope 1: complete and merged into local `main`.
- Scope 2: complete (all 5 tasks implemented and verified).
- Scope 3: not started.
- Scope 4: not started.

The foundational and canonical-chat implementation plans contain 12 tasks: 7 foundation tasks and 5 canonical-chat tasks. All 12 are complete. Scope 3 (Adaptive workspace shell) is the next phase.

### Git status at design time

- Local `main`: `5aed6ea`, containing foundations, canonical-chat Tasks 1–3, and the implementation handoff document.
- `origin/main`: `5afe419`; local `main` is one commit ahead because of the handoff document.
- `codex/canonical-chat-experience`: `5afe419`; it contains the same completed implementation commits but not the handoff-document commit.
- An isolated canonical-chat worktree contains an uncommitted partial Task 4 test. It is not completed work and is not merged.
- Existing unstaged user-owned files must be preserved by future agents unless explicitly addressed in a separate task.

## 7. Cross-scope implementation order

1. Verify and extend Scope 1 contracts only when a real consumer requires it.
2. Finish canonical chat using only Scope 1 primitives.
3. Build the adaptive shell around the completed chat reference surface.
4. Audit every remaining surface; keep compliant UI, refactor inconsistent UI, rebuild only where necessary, and defer work that has no current learning value.
5. Run cross-surface contract tests, accessibility checks, visual review, typecheck, lint, and production build.

Each scope is independently reviewed and committed before the next scope begins.

## 8. Cross-scope risks and contradictions

### Risk: local one-off components

Agents may copy a button, title, card, or menu because it is faster. This creates visual drift. Every scope therefore requires a reuse audit and prohibits equivalent local implementations.

### Risk: learning metadata overload

Mastery, sources, gaps, and next topics can overwhelm the explanation. These signals belong in contextual or collapsed surfaces unless they are required to understand the answer.

### Risk: responsive redesign becomes a second product

Mobile must preserve the same information hierarchy and contracts. It may change layout and disclosure, not semantics or capabilities.

### Risk: visual polish changes behavior

Animation, virtualization, streaming, and focus changes can regress existing behavior. Agents must test behavior before and after visual changes and avoid layout shifts.

### Contradiction resolution

When a local screen requirement conflicts with a common component rule, prefer the shared rule. If the screen has a genuine unmet need, document the exception, propose a reusable variant, and obtain review before implementation.

## 9. Open questions and decision log

The current design decisions are settled as follows:

- Design approach: contract-first with experience validation.
- Variant policy: few approved variants.
- Redesign policy: do not redesign compliant surfaces unnecessarily.
- Brand direction: GraphMind identity with Apple-level craft, not Apple imitation.
- Source policy: assistant-ui is inspiration/reference only; no dependency.

Future agents must add unresolved questions here before making assumptions that affect multiple scopes. Each entry must record the question, options considered, decision, date, and affected documents.

## 10. Global acceptance criteria

The redesign is complete only when:

- every repeated control uses one shared implementation;
- no assistant-ui runtime dependency exists;
- shared tokens control colors, typography, spacing, radii, elevation, and motion;
- existing chat behavior and canonical URLs remain intact;
- all four scope documents are implemented or explicitly marked deferred with rationale;
- desktop, tablet, mobile, light, dark, keyboard, screen-reader, and reduced-motion behavior are reviewed;
- empty, loading, streaming, error, retry, disabled, and success states are explicit;
- full frontend tests, typecheck, lint, and production build pass;
- visual review finds no stitched-together component families or arbitrary local variants.

## 11. Handoff instructions for AI implementers

Read this master document first, then read only the scope document assigned to you. Do not infer missing behavior from visual similarity. Follow the task order in the scope document, preserve existing contracts, and report any contradiction in the master decision log before implementing it.
