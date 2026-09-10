# Scope 3 — Adaptive Workspace Shell

Status: Tasks 1–3 implemented; Tasks 4–7 remain.

## Objective

Create one coherent workspace frame around chat and canvas. Navigation, header, contextual rail, routing, and responsive disclosure must feel like one product rather than independent pages.

## Task 1 — Workspace shell structure

Compose `WorkspaceShell` with `LeftNavigation`, `MainHeader`, `MainContent`, and conditional `ContextRail`. Use the canonical hierarchy: `/w/{workspaceId}`, `/w/{workspaceId}/chat/{chatId}`, and `/w/{workspaceId}/chat/{chatId}/canvas`. Use URL helpers; never hardcode route strings or place primary identifiers in query parameters.

## Task 2 — Left navigation

Provide workspace switcher, new chat, file library, recent chats, and account/settings entry points. Use shared buttons, menus, badges, and drawer primitives. Navigation items need active, focus, disabled, loading, and unavailable states. No item may appear unless it has a real destination or callback.

Desktop navigation is persistent; tablet navigation may narrow or collapse; mobile navigation is a drawer and must not permanently consume half the viewport.

## Task 3 — Main header and mode switching

Use the standard 52px header height. Include navigation collapse, workspace name, Chat/Canvas segmented tabs, and contextual-rail control. The mode switch changes the path segment through Next.js router helpers. It must preserve workspace and chat identity and maintain accessible selected state.

## Task 4 — Contextual rail

Show mastery, gaps, sources, and next-topic guidance only when data exists and the rail adds value. The rail must be dismissible, keyboard accessible, and transformed into a drawer at constrained widths. Opening it must not destroy or reset chat scroll or composer state.

## Task 5 — Responsive behavior

At 1440px, keep left navigation and a capped central conversation with optional rail. At 768px, allow navigation collapse and use a rail drawer. At 390px, use drawers for navigation and context, keep the composer above the keyboard, prevent horizontal clipping, and maintain touch targets.

## Task 6 — Routing and state preservation

Use `router.push`/`router.replace`; never call `window.history`. View mode is a path segment, not a query parameter or cookie. Preserve scroll, active chat, unsent composer text, and open/closed disclosure state according to documented navigation semantics.

## Task 7 — Shell verification

Test route transitions, active navigation, focus return, drawer behavior, responsive breakpoints, dark mode, reduced motion, keyboard access, and no horizontal overflow. Run full tests, typecheck, lint, and production build.

## Forbidden implementations

- hardcoded route strings in components;
- `window.history.pushState` or `replaceState`;
- query parameters for primary workspace/chat navigation;
- permanent mobile sidebars;
- rail content that blocks the conversation;
- shell-specific duplicates of shared controls.

## Definition of done

Chat and canvas share one responsive shell, canonical URLs remain valid, drawers and focus behavior are accessible, and the layout behaves predictably at desktop, tablet, and mobile sizes.
