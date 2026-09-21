# Keyboard-First Navigation Implementation Plan

**Spec:** `docs/FEATURE_RESEARCH.md §7.2`  
**Agentic-worker sub-skill checklist:** `[ ]` read this plan and AGENTS.md; `[ ]` inspect exact files; `[ ]` implement ticket-by-ticket; `[ ]` run named tests; `[ ]` capture a11y evidence; `[ ]` request review.  
**Goal:** keyboard-equivalent graph/chat learning navigation without browser shortcut regressions.  
**Architecture:** client shortcut registry + roving graph focus layered on React Flow; no persistent domain change.  
**Tech stack:** Next.js 15, TypeScript strict, React Flow v12, Vitest/Playwright, Tailwind/shadcn primitives.  
**Global constraints:** Follow AGENTS.md one-task approval/verify/commit workflow; preserve `docs/URL_DESIGN.md` and only use `@/lib/urls`; all provider calls remain behind `packages/ai-core`; any durable schema requires Alembic; every API is RBAC-gated; use only shared semantic UI primitives/tokens, dark-mode-safe classes, WCAG keyboard/focus/reduced-motion support, and no dead UI.

**Status:** proposed; no implementation in this feature branch. `apps/web/src/hooks/useKeyboardShortcuts.ts` already owns global `Cmd/Ctrl+K`, `B`, `L`, `0`, `.`, `,`, brackets and Escape. `GraphCanvas.tsx` already owns React Flow selection/minimap. It does **not** maintain a roving graph focus model, shortcut help, prompt focus, or learning actions. The research proposal's `Ctrl+F` and `Ctrl+R` must not ship: they conflict with browser Find and Reload.

## Goal and boundaries

Make every existing graph/chat learning action operable efficiently without a mouse, while preserving native text editing, browser shortcuts, screen-reader behaviour, and the canonical `/w/{workspaceId}/chat/{chatId}[ /canvas]` route contract. This is navigation and command dispatch, not a new command palette, canvas, quiz, or flashcard implementation.

Non-goals: hijacking browser/OS commands; using positive `tabIndex`; changing routes; making React Flow's visual node cards fake buttons; or claiming canvas drag is keyboard-only (provide equivalent move/layout actions instead).

## Evidence and decisions

W3C's [APG keyboard guidance](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/) assigns Tab to move *between* composites and arrow keys inside them; [WCAG 2.2](https://www.w3.org/TR/WCAG22/) requires keyboard alternatives to dragging and visible focus. WAI-ARIA's [shortcut guidance](https://www.w3.org/TR/wai-aria-1.3/#aria-keyshortcuts) says shortcuts must be discoverable and must avoid OS/browser/assistive-technology conflicts. Therefore use arrows/Home/End for graph focus, `Enter` to open, `Space` only when the canvas composite owns focus, `Mod+Shift+Q` for quiz, `Mod+Shift+F` for flashcards, `Mod+Shift+R` for review queue, and `/` to search only outside editable controls. Expose actual bindings with `aria-keyshortcuts`; do not treat that attribute as an event handler.

## Users and UX flow

* A keyboard learner tabs to the canvas landmark, receives the concise instruction, uses arrows to the closest directional node, then Enter opens its focus drawer; the selected node remains visibly focused after a data refresh.
* They press Space on a selected node to focus the existing chat input with node context; in an input/textarea/contenteditable, Space and `/` retain normal typing.
* They invoke Quiz/Flashcards only when a selected assistant node supports it. Disabled commands say why through the shared live region rather than silently doing nothing.
* `?` opens a modal shortcut reference. Escape closes the nearest modal/drawer first, then returns focus to its invoker. `/` opens search; search results use the existing `buildNodeUrl`, never direct history mutation.

## Architecture and data flow

Create a client-only `ShortcutRegistry`: definitions include id, platform labels, `ariaKeyshortcuts`, scope (`global|canvas|input`), availability predicate, and command callback. `useKeyboardShortcuts` becomes a thin listener that rejects IME composition, editable targets, modifier collisions, and repeated keydown unless permitted. `useGraphRovingFocus` derives stable sorted node IDs from the conversation tree plus node positions, stores active ID in React state, and sends selection to `GraphCanvas`; it does not persist focus to PostgreSQL. `KeyboardHelpModal` reads the same registry. Existing learning commands dispatch typed custom events only temporarily; each feature replaces its command with a direct callback when implemented.

## Files and contracts

Modify `apps/web/src/hooks/useKeyboardShortcuts.ts`, `apps/web/src/components/canvas/GraphCanvas.tsx`, `apps/web/src/components/canvas/ThreadGraphNode.tsx`, `apps/web/src/components/chat/ChatContainer.tsx`, `apps/web/src/components/ui/modal.tsx`, `apps/web/src/app/globals.css`, and `apps/web/src/lib/urls.ts` only if a `buildReviewUrl` helper is added by 10.1. Create `apps/web/src/lib/shortcuts.ts`, `apps/web/src/hooks/useGraphRovingFocus.ts`, `apps/web/src/components/layout/KeyboardHelpModal.tsx`, and tests beside each. Add no API, migration, or durable type. Command payload: `{commandId, workspaceId, chatId, nodeId?: string}`; do not place it in the URL.

## Accessibility, privacy, reliability

Use one `role="tree"`/`treeitem` semantic representation only if the visual graph can truthfully expose hierarchy; otherwise use a labelled `region` plus an off-screen ordered node list and `aria-activedescendant`. Maintain one tab stop using roving `tabIndex=0/-1`, restore focus after mutation, respect `prefers-reduced-motion`, and keep focus unobscured. Do not log typed prompt text. Emit low-cardinality `learning.keyboard_command` telemetry with command id, surface, outcome, and latency; OpenTelemetry's [event specification](https://opentelemetry.io/docs/specs/semconv/general/events/) requires named, timestamped, documented event structures.

## Edge cases and performance

Ignore shortcuts while composing IME, selecting text, using a native dialog, or holding only a modifier. On an empty graph, canvas receives focus and announces it. Deleted/hidden selected node falls back to its parent then root. Recompute directional neighbours on a debounced layout/viewport change; for >1,000 nodes use a spatial index, not O(n) on every keydown. Screen-reader browse mode remains able to traverse the linear node list.

## Delivery, tickets, and DoD

1. **WEB-721 Registry and conflicts** (no dependency): implement registry, editable-target guard, platform labels, and remove any planned Ctrl+F/Ctrl+R interception. Acceptance: browser Find/Reload still work; Cmd/Ctrl variants work; `?` is discoverable.
2. **WEB-722 Canvas roving focus** (WEB-721): add stable roving focus, arrows/Home/End, announcement, focus restoration, and non-drag alternatives. Acceptance: a keyboard user selects/opens every visible node without mouse.
3. **WEB-723 Learning command bindings** (WEB-721, features 2.1/2.3/10.1): gate quiz/flashcard/review commands by capability and show unavailable explanation. Acceptance: no command causes an unhandled promise or navigation error.
4. **WEB-724 A11y and regression tests** (WEB-722): add `useKeyboardShortcuts.test.ts`, `GraphCanvas.keyboard.test.tsx`, and Playwright keyboard smoke tests. Run `pnpm --filter @graphmind/web test`, `pnpm --filter @graphmind/web lint`, `pnpm --filter @graphmind/web build`; manually test Chrome, Firefox, VoiceOver and NVDA.

Definition of Done: the bindings are documented in product UI; all actions have pointer equivalents; focus/contrast/reduced-motion tests pass; telemetry dashboard has a no-PII command success metric; and the URL contract is unchanged.

## Research questions answered

1. **Should Tab visit every node?** No; APG reserves Tab for entering/leaving a composite and arrows for internal movement.
2. **Can `aria-keyshortcuts` implement a command?** No; it only exposes the binding to assistive technology.
3. **Can Space always open prompting?** No; editable controls and button semantics need their native Space behaviour.
4. **Can Ctrl+F be repurposed?** No; it removes browser Find, a discoverability and accessibility regression.
5. **Can Ctrl+R be repurposed?** No; it conflicts with reload; use a modified binding.
6. **Does canvas dragging need an alternative?** Yes; WCAG 2.2 SC 2.5.7 requires a single-pointer alternative where dragging is not essential.
7. **Should selection equal DOM focus?** Keep them distinct but synchronized/announced; visual selection alone is not discoverable.
8. **Are shortcuts enough for accessibility?** No; every shortcut action must be reachable through semantic controls and predictable focus.

Sources: [WAI-ARIA APG](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/), [WAI-ARIA 1.3 shortcuts](https://www.w3.org/TR/wai-aria-1.3/#aria-keyshortcuts), [WCAG 2.2](https://www.w3.org/TR/WCAG22/), [OpenTelemetry events](https://opentelemetry.io/docs/specs/semconv/general/events/).

## Detailed delivery matrix

| Ticket | Objective | Create | Modify | Dependencies | Flag/rollback |
|---|---|---|---|---|---|
| WEB-721 | one source of shortcut truth | `lib/shortcuts.ts`, shortcut tests | `useKeyboardShortcuts.ts` | none | `keyboard_nav_v1`; disable listener registrations |
| WEB-722 | semantic graph focus | `useGraphRovingFocus.ts`, graph keyboard tests | `GraphCanvas.tsx`, `ThreadGraphNode.tsx` | WEB-721 | keep current pointer selection if flag off |
| WEB-723 | safe learning commands | help modal and action tests | `ChatContainer.tsx`, `ChatInput.tsx` | 2.1/2.3/10.1 APIs | hide unavailable bindings |
| WEB-724 | prove real accessibility | Playwright spec/a11y evidence | globals/modal only if needed | WEB-721–723 | release flag to 0% |

### WEB-721 implementation steps

1. Define a typed `ShortcutDefinition` with `id`, platform keys, `scope`, `requiresSelection`, `isEnabled` and callback; render platform-specific labels instead of inferring them in components.
2. Move existing hook branches to registry lookups and retain every already-shipped binding exactly unless it is a documented conflict.
3. Reject `event.isComposing`, editable/`contenteditable` targets, native modal targets and unmodified key events outside their intended scope.
4. Add a conflict table: browser Find/Reload/Save/Close and screen-reader keys must never call `preventDefault`; replace proposed Ctrl bindings with `Mod+Shift` alternatives.
5. Add `aria-keyshortcuts` only to enabled discoverable controls and expose same definitions in a `?` help modal.

Acceptance criteria: (1) Cmd/Ctrl+K/B/L behaviours remain green; (2) Ctrl/Cmd+F/R retain native browser behaviour; (3) IME typing and text-entry characters are unchanged; (4) every bound command has a visible control/help entry; (5) repeated keydown cannot invoke paid/networked actions twice.

### WEB-722 implementation steps

1. Derive a stable node order from tree IDs and positions, with parent/root fallback if selected node disappears.
2. Add one roving tab stop to canvas region; arrows choose nearest directional candidate, Home/End first/last, and Enter opens the same selection action as pointer.
3. Make `ThreadGraphNode` expose selected/focused state and a concise accessible name including role/title/branch state.
4. Expand ancestors before centring any deep-linked `?node=` target; do not mutate the pathname.
5. Restore focus to invoker after drawer/modal closes and use `scrollIntoView` only when the focused item is obscured.

Acceptance criteria: (1) all rendered nodes are reachable from keyboard; (2) no positive `tabIndex`; (3) focus survives streamed node addition/deletion; (4) selected/focused state is visibly distinct in light/dark; (5) tree/region semantics pass screen-reader smoke tests.

### WEB-723 implementation steps

1. Register Quiz/Flashcard/Review commands against capability callbacks rather than DOM custom event strings.
2. Gate commands on selected node type, API availability and feature flags; disabled help text explains prerequisite condition.
3. Have Space focus the prompt only when canvas owns focus and selected node exists; never consume it on a native button/input.
4. Route search/source/review actions through `build*Url` helpers and Next `router.push`.
5. Add analytics at command boundary using command id/outcome only.

Acceptance criteria: (1) no action is offered without a working handler; (2) unavailable actions remain discoverable with reason; (3) shortcuts and pointer action yield equivalent result; (4) no primary navigation is query-param/state-history based.

### WEB-724 verification steps

1. Add `apps/web/src/hooks/__tests__/use-keyboard-shortcuts.test.ts` for modifier, input, composition and conflict cases.
2. Add `apps/web/src/components/canvas/__tests__/graph-canvas-keyboard.test.tsx` for roving order/focus restore/deep links.
3. Add `apps/web/tests/e2e/keyboard-navigation.spec.ts` for browser Find/Reload and real canvas action.
4. Manually test VoiceOver Safari and NVDA/Firefox at 200% zoom and reduced motion.
5. Turn flag on only after command success, focus-loss and error metrics meet pre-agreed threshold; document disable-to-0 rollback.

Run `pnpm --filter @graphmind/web test`, `pnpm --filter @graphmind/web build`, and `pnpm --filter @graphmind/web lint`.

## Edge-case and rollout matrix

| Case | Behaviour | Named test |
|---|---|---|
| empty graph | focusable labelled region announces empty state | `graph-canvas-keyboard.test.tsx` |
| streamed replacement | retain by stable node ID then parent/root | `focus-restoration-on-stream.test.tsx` |
| browser find/reload | no preventDefault | `keyboard-navigation.spec.ts` |
| IME composition | ignore all custom shortcuts | `use-keyboard-shortcuts.test.ts` |
| modal open | trap receives keys; canvas not invoked | `modal-shortcut-scope.test.tsx` |
| 2,000-node canvas | spatial-neighbour index; no O(n) paint per key | `keyboard-perf.spec.ts` |

Deploy client code behind `keyboard_nav_v1`: internal keyboard/a11y users → 10% → 50% → 100%. No migration/backfill applies. Rollback disables the registry feature while preserving existing hook bindings, and leaves no persisted state to repair.
