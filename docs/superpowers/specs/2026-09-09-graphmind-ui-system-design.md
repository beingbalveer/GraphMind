# GraphMind Unified UI System and Learning Experience Design

**Date:** 2026-09-09  
**Status:** Approved design  
**Reference:** `assistant-ui-main.zip` is a read-only source of design inspiration. GraphMind will not depend on the `assistant-ui` package or reproduce its runtime architecture.

## 1. Purpose

GraphMind currently has semantic theme tokens and several shared UI primitives, but product surfaces still contain hardcoded neutral colors, raw controls, bespoke overlays, inconsistent dimensions, and repeated interaction styling. This produces an uneven interface and makes light/dark theme support, accessibility, and future UI work difficult to maintain.

This design establishes a GraphMind-owned interface system and a learning-centered UX model. The system takes inspiration from assistant-ui's visual restraint, clear asynchronous states, compact actions, and progressive disclosure while preserving GraphMind's architecture, URL contract, streaming model, branching behavior, canvas, and product identity.

## 2. Approved Product Direction

### 2.1 Visual character: GraphMind Calm

The approved visual direction combines a quiet, content-first chat surface with a subtle indigo knowledge-graph identity.

The visual language is:

- calm rather than decorative;
- spacious enough for long-form learning without feeling sparse;
- predominantly neutral, with indigo reserved for navigation, focus, graph relationships, and meaningful learning signals;
- softly layered through borders and restrained elevation rather than heavy cards;
- consistent in light and dark themes;
- animated only when motion communicates state or spatial continuity.

### 2.2 Workspace layout: Adaptive Context

The workspace uses three conceptual regions:

1. A stable, collapsible left navigation region.
2. A focused center region for chat or canvas.
3. A contextual right rail that appears only when it has useful information.

The right rail is not permanent dashboard chrome. It may contain relevant concepts, sources, mastery signals, knowledge gaps, or next topics, but it stays closed or absent when none of those are actionable.

Responsive behavior:

- Desktop uses collapsible left navigation, a centered conversation, and a conditional right rail.
- Tablet narrows the navigation and presents context in an overlay drawer.
- Mobile prioritizes the conversation and moves navigation and context into drawers.
- Canvas retains the same workspace shell but may use the full center region.

## 3. Learning Experience Model

Conversation is the primary learning surface. GraphMind must support a four-part learning loop without turning the conversation into a dashboard:

1. **Ask and understand.** Present highly readable responses, Markdown, code, sources, and activity states with minimal chrome.
2. **Follow curiosity.** Let the learner select text or use a concept cue to create a branch without losing the main thread.
3. **See relationships.** Offer canvas when spatial structure adds meaning. Chat and canvas must represent the same underlying context.
4. **Reflect and continue.** Surface mastery, gaps, sources, and suggested next topics only when they are useful and actionable.

The governing rule is progressive disclosure: no learning widget competes visually with the answer currently being studied. Concepts, branches, sources, tool activity, and mastery begin compact and expand only through an explicit learner action or a clearly meaningful state change.

## 4. Architecture

The UI system has four layers. Each layer may depend only on the layers below it.

### 4.1 Foundations

Global foundations define semantic roles rather than component-specific recipes:

- background and nested surface levels;
- primary and secondary foreground levels;
- normal, subtle, strong, focus, and status borders;
- primary accent and primary foreground;
- success, warning, destructive, and informational states;
- standard typography roles and the existing allowed type scale;
- spacing rhythm;
- standard radii for controls, inner widgets, cards, and modals;
- elevation levels;
- motion durations and easing;
- visible focus treatment;
- reduced-motion behavior;
- z-index roles.

Foundation values live in `apps/web/src/app/globals.css`. Product components consume the semantic Tailwind utilities generated from these values. Migrated product code must not introduce hardcoded neutral colors or arbitrary type sizes, radii, or spacing values.

### 4.2 Generic UI primitives

`apps/web/src/components/ui/` owns generic, product-independent controls:

- `Button`;
- `IconButton` with mandatory accessible label and optional tooltip integration;
- `Tooltip`;
- `Input` and `Textarea`;
- `Surface`;
- dropdown menu primitives;
- `Modal`, `Drawer`, and `ConfirmDialog`;
- `SegmentedTabs`;
- `Badge`;
- `Collapsible`;
- `Skeleton` and shared feedback states.

Primitives own their variants, dimensions, interaction states, focus behavior, disabled state, and reduced-motion handling. Product components may arrange primitives but must not recreate their behavior or visual contracts.

### 4.3 Learning interaction patterns

Chat and learning patterns compose generic primitives into GraphMind-specific units:

- `ChatViewport`;
- `UserMessage` and `AssistantMessage`;
- `MessageActions`;
- `ChatComposer`;
- `AttachmentTile`;
- `SourcesGroup`;
- `ActivityGroup` for reasoning and tool calls;
- `BranchCue`;
- `ConceptChip`;
- chat empty, loading, streaming, stopped, and error states.

These patterns provide presentation and interaction composition. They do not own transport, persistence, URL construction, or provider logic.

### 4.4 Product surfaces

Product surfaces assemble patterns and primitives:

- adaptive workspace shell;
- chat;
- canvas;
- contextual rail;
- workspace dashboard;
- file library;
- settings.

No product surface may introduce a new visual rule before determining whether that rule belongs in foundations, a generic primitive, or a shared learning pattern.

## 5. State and Data Flow

The redesign preserves GraphMind's current state ownership:

- `useChatStream` remains responsible for conversation and streaming behavior.
- `useScrollAnchor` remains responsible for chat scroll behavior.
- workspace APIs remain responsible for persisted workspaces, chats, files, and graph state.
- Next.js routing and helpers in `@/lib/urls` remain authoritative for navigation.
- existing domain types in `@graphmind/shared` remain authoritative for messages, trees, and attachments.

New or refactored UI components receive explicit state and callbacks through typed props. The UI renovation will not add another global store, duplicate server state, or imitate assistant-ui's runtime primitives.

State must be represented explicitly where it changes presentation. Examples include:

- idle, focused, dragging, uploading, disabled, and error composer states;
- loading, streaming, stopped, complete, and failed response states;
- active, inactive, unread, editing, and pending thread states;
- collapsed, expanded, unavailable, and empty contextual sections.

## 6. Chat Reference Experience

The canonical chat implementation is the first complete product proof of the design system.

### 6.1 Conversation viewport

- Define `--chat-content-max` as `44rem` and use it as the desktop maximum width for the conversation content column. The column remains fluid below that width.
- Keep user prompts visually distinct through a quiet filled surface.
- Keep assistant responses largely borderless so content remains primary.
- Place message actions close to the relevant message and reduce their prominence until hover, focus, or a persistent state requires visibility.
- Preserve branch navigation and selection-based exploration without obscuring text.

### 6.2 Composer

- Use one bordered, softly elevated composer surface.
- Allow multiline input with a defined maximum height and internal scrolling afterward.
- Place attachments above the input within the same composer surface.
- Place attachment, active skill or learning mode, and related secondary actions in a compact toolbar.
- Keep send and stop in a stable location and use an animated icon/state swap that respects reduced motion.
- Preserve paste, drop, upload, file-library selection, slash commands, active skills, branch context, stop, and send behavior.

### 6.3 Learning signals

- Concept chips use the primary accent sparingly and must be interactive only when they perform a real action.
- Branch cues communicate lineage or an available exploration path without becoming permanent badges on every message.
- Sources and activity groups begin collapsed unless an error or required decision makes expansion necessary.
- Mastery and next-topic information belongs in the contextual rail rather than inside every answer.

## 7. Error Handling and Feedback

Feedback appears at the smallest meaningful scope:

- attachment failures appear on the affected attachment;
- stream failures appear below the interrupted response with an appropriate recovery action;
- tool failures appear within the associated activity group;
- workspace-level failures use the shared feedback or toast primitive;
- destructive actions use the shared confirmation dialog;
- loading states preserve layout stability with skeletons or reserved space;
- empty states explain the available next action without advertising unfinished features.

Error states must provide plain-language messaging, accessible announcements where appropriate, and a real recovery path when one exists.

## 8. Accessibility and Interaction Requirements

All migrated components must provide:

- semantic HTML and correct accessible names;
- keyboard access for every interactive operation;
- visible focus treatment;
- predictable focus restoration for menus, dialogs, and drawers;
- minimum practical touch targets;
- sufficient contrast in light and dark themes;
- screen-reader descriptions for icon-only actions and asynchronous status;
- `prefers-reduced-motion` handling;
- no interaction that depends solely on hover or color.

## 9. Migration Strategy

Migration occurs through four separately approved repository tasks. Only one task is implemented at a time.

### Task 1: Foundations and generic primitives

- finalize semantic foundations in `globals.css`;
- normalize existing generic primitives;
- add only missing primitives required by the approved architecture;
- establish primitive usage guardrails and tests;
- avoid changing product behavior.

### Task 2: Canonical chat experience

- recompose messages, Markdown presentation, actions, composer, attachments, branches, sources, and activity states;
- preserve the current streaming, retry, stop, file, skill, and branch flows;
- verify every asynchronous and empty state.

### Task 3: Adaptive workspace shell

- unify navigation, header, view switching, responsive layout, and contextual rail behavior;
- retain the canonical URL hierarchy and all routing helpers;
- move mobile navigation and context into shared drawers.

### Task 4: Remaining product surfaces

- migrate canvas controls and nodes;
- migrate dashboard, library, settings, modals, and auxiliary panels;
- remove superseded styling and legacy component paths after all consumers move.

Each task requires its own design confirmation under the repository's approval workflow before implementation begins.

## 10. Verification Strategy

Every migration task must pass checks proportional to its scope.

### 10.1 Automated verification

- TypeScript type checking;
- linting;
- Next.js production build;
- unit tests for stateful primitives and extracted interaction logic;
- interaction tests for keyboard and accessibility-sensitive behavior where practical.

### 10.2 Visual verification

Verify both light and dark themes at desktop, tablet, and mobile widths. For affected components, verify:

- empty;
- loading;
- populated;
- focused;
- disabled;
- streaming or uploading;
- stopped;
- error;
- overflow and long-content states.

### 10.3 Feature regression verification

For the chat reference experience, verify:

- send, streaming, and scroll anchoring;
- stop, retry, and regenerate;
- editing and branch switching;
- text-selection branching and side-peek behavior;
- file picker, drag-and-drop, paste, upload, removal, and library selection;
- slash commands and skill selection;
- route changes between chat and canvas;
- keyboard navigation and sidebar persistence.

## 11. Definition of Done

A migration task is complete only when:

- migrated product code uses shared primitives instead of raw controls or bespoke overlays;
- migrated scope contains no hardcoded neutral theme colors;
- variants and state styling live at the correct architectural layer;
- light and dark themes are verified;
- responsive behavior is verified;
- keyboard and screen-reader-sensitive behavior is verified;
- existing behavior is preserved unless the task explicitly approves an interaction improvement;
- automated checks pass;
- obsolete styling or components in the migrated scope are removed.

## 12. Non-Goals

This design does not:

- add `assistant-ui` or another chat UI framework;
- replace GraphMind's streaming, persistence, or routing architecture;
- copy assistant-ui component source into GraphMind;
- add speculative learning features without working behavior;
- redesign every product surface in one implementation task;
- change the canonical `/w/{workspaceId}/chat/{chatId}` and canvas URL hierarchy;
- create a separate component package before the web application demonstrates a real cross-package need.

## 13. Key Risks and Mitigations

- **Risk: visual cleanup without structural consistency.** Mitigation: migrate through foundations, primitives, patterns, and surfaces in that order.
- **Risk: a prolonged half-migrated interface.** Mitigation: complete and verify one coherent surface per task and remove legacy styles within that scope.
- **Risk: regressions hidden by component refactoring.** Mitigation: preserve state ownership, use typed prop boundaries, and verify complete user flows.
- **Risk: learning widgets overwhelm the conversation.** Mitigation: enforce progressive disclosure and keep contextual information out of the primary reading flow.
- **Risk: conflicts with existing local edits.** Mitigation: inspect and preserve the user's uncommitted changes, especially current edits to `button.tsx` and `WorkspaceDashboard.tsx`, during implementation planning and execution.
