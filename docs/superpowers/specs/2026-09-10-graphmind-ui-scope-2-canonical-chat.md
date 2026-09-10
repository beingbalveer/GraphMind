# Scope 2 — Canonical Chat Experience

Status: Tasks 1–4 implemented; Task 5 remains. This document is the complete target contract for the reference chat surface.

## Objective

Make chat the product's reference experience for hierarchy, reading, streaming, branching, evidence, learning signals, and composer behavior. Every later surface should reuse the patterns proven here.

## Task 1 — Message hierarchy and Markdown

User messages use a quiet filled surface with attachment previews, branch context, and edit/copy actions. Assistant messages are primarily readable Markdown without unnecessary containers. Code blocks provide copy actions. Branch links, source viewers, and selection exploration remain keyboard reachable.

Preserve existing message props and callbacks. Do not move routing or stream orchestration into `ChatMessage`. Loading and streaming reserve stable space; interrupted responses show explicit feedback.

Tests: Markdown structure, code-copy behavior, attachments, branch links, editing, keyboard actions, dark mode, and long-content wrapping.

## Task 2 — Composer

`ChatInput` owns prompt text, Enter submit, Shift+Enter newline, paste/drop, uploads, file-library selection, slash commands, active skill, branch context, send, and stop. The composer is one softly elevated bordered surface. Send and stop occupy the same stable location. Empty prompts cannot submit. Loading disables duplicate actions while retaining labels.

Tests: keyboard semantics, paste/drop, upload failure, file selection, slash commands, branch context clearing, send/stop transitions, mobile keyboard visibility, and focus return.

## Task 3 — Activity, branches, sources, and selection

`AgentToolCallsBanner` is collapsed by default and visibly marks failures even while collapsed. Recovery actions are real callbacks only. `BranchBreadcrumbs` exposes lineage and keyboard navigation. `SelectionTooltip` provides real Explore branch and Search web actions and cannot depend on hover alone. Sources are compact, inspectable groups. Learning signals remain contextual rather than repeated in each answer.

Tests: tool success/failure, retry availability, branch lineage, selection keyboard access, source expansion, and live status announcements.

## Task 4 — Chat column and contextual rail

Compose `ChatView` from a conversation viewport and composer shell. The viewport supports empty, loading, streaming, error, and populated states. Desktop content is fluid below `--chat-content-max` and capped at 44rem above it. The contextual rail contains mastery, knowledge gaps, sources, and next-topic guidance only when useful; it must not obscure the conversation.

Required states:

- Empty workspace: explanation and real prompt affordance.
- Loading: reserved space or skeleton, no fake answer.
- Streaming: stable layout and stop action.
- Stream error: inline feedback with retry or dismiss.
- Tool failure: destructive status immediately visible and retry when available.
- Attachment failure: feedback next to the affected attachment.
- Branch context: compact composer strip with clear action.

Tests: full composition, scroll anchoring, no layout shift, rail open/close, focus behavior, responsive widths, and existing URL/callback contracts.

## Task 5 — Contract verification and visual gate

Run chat-specific contract tests plus the full frontend test suite, typecheck, lint, and production build. Perform visual review at 1440px, 768px, and 390px in light and dark themes. Check message hierarchy, composer consistency, focus visibility, error clarity, reduced motion, and absence of local primitive replacements.

## Interaction requirements

Enter submits non-empty prompts; Shift+Enter inserts a newline. Escape dismisses menus, dialogs, drawers, and transient selection UI according to shared contracts. Focus returns to the opener. Every action has a callback; no dead controls are allowed.

## Forbidden implementations

- assistant-ui imports or runtime dependency;
- duplicated composer buttons or message controls;
- routing decisions inside message or input presentation components;
- tool activity that hides failure status;
- source or mastery metadata repeated in every response;
- hover-only branch or selection actions;
- layout shifts during streaming.

## Definition of done

Chat is a polished, accessible, behavior-preserving reference surface that consumes Scope 1 primitives exclusively and passes all verification gates.
