# Scope 1 — Foundations and Generic Primitives

Status: implemented; this document records the contract that future agents must preserve.

## Objective

Create one centralized, accessible, theme-aware component language for the entire product. The result is the only approved source for repeated controls and visual tokens.

## Task 1 — Establish the token contract

Define semantic tokens for background, secondary background, surface, hover surface, foreground, muted foreground, border, subtle border, primary, destructive, success, warning, info, focus, and overlay. Define light and dark values together. Define typography roles for display, page title, section title, body, label, caption, code, and error text. Define the approved spacing, radius, elevation, breakpoint, and motion scales.

Rules: product files cannot use arbitrary palette literals, arbitrary font sizes, invented spacing, or unapproved radii. Token names must describe meaning, not hue. Dark mode must not rely on light-only classes.

Tests: token contract tests must verify required names exist in both themes and representative primitives render without hardcoded colors.

## Task 2 — Normalize buttons and icon actions

Canonical components: `Button`, `IconButton`, and `Tooltip`. Approved button variants are primary, secondary, ghost, and destructive. Approved sizes are the existing standard sizes, including `iconSm` and `icon`. Loading preserves the button footprint, disables duplicate submission, and retains an accessible name. Icon-only actions require a label and tooltip where appropriate.

Interaction: focus rings are visible; disabled controls are not clickable; keyboard activation matches pointer activation; tooltip never becomes the only source of meaning. Do not create raw `<button>` elements in product surfaces.

Tests: render every variant in both themes; verify keyboard focus, disabled state, loading state, accessible name, tooltip dismissal, and no layout shift.

## Task 3 — Normalize fields and surfaces

Canonical components: `Input`, `Textarea`, `Surface`, and `Skeleton`. Inputs define label, description, error, disabled, loading, and icon behavior. Textareas define multiline resizing and keyboard semantics. Surface defines default, muted, elevated, and interactive treatments. Skeleton reserves the final layout space and respects reduced motion.

Rules: errors use `aria-describedby` with stable unique IDs. Placeholder text is not a label. Surfaces do not become interactive unless the component exposes a real callback and keyboard behavior.

Tests: label association, error announcements, focus styles, dark mode, reduced motion, disabled behavior, and responsive width.

## Task 4 — Normalize menus and collapsible content

Canonical components: `DropdownMenu`, `MenuCard`, `MenuItem`, and `Collapsible`. Menus must manage focus, Escape, outside click, disabled items, and focus return to the opener. Menu items must not be decorative rows pretending to be actions. Collapsible content must expose expanded state and preserve accessible relationships.

Tests: keyboard navigation, Escape dismissal, focus return, disabled-item behavior, nested content, and screen-reader expanded state.

## Task 5 — Normalize overlays

Canonical components: `Modal`, `ModalHeader`, `ModalBody`, `ModalFooter`, `Drawer`, and `ConfirmDialog`. Overlays must trap focus while open, close according to the documented dismissal policy, restore focus, provide a labelled heading, and prevent background interaction. Drawers must support desktop and mobile widths without clipping content.

Tests: focus trap, focus return, Escape, backdrop policy, scroll locking, nested overlay safety, accessible names, and reduced-motion transitions.

## Task 6 — Normalize status, selection, and brand primitives

Canonical components: `Switch`, `SegmentedTabs`, `Badge`, `Toast`, `InlineFeedback`, `EmptyState`, `CopyButton`, `GraphMindIcon`, and `LogoBadge`. Each component gets only the variants required by current product behavior. Status colors must communicate meaning consistently. Empty states must include a useful explanation and a real next action when one exists. Toasts must not replace inline error context.

Tests: semantic roles, live-region behavior, selection keyboard use, copy success/failure feedback, status contrast, and theme parity.

## Task 7 — Enforce the contract

Create or maintain tests and review checks that detect raw buttons, arbitrary token values, invalid typography/spacing classes, missing labels, duplicate IDs, and local component duplicates. Review every consumer before declaring the foundation complete.

## Required implementation strategy

1. Inspect existing primitive behavior before changing it.
2. Preserve public props and callbacks unless a migration is explicitly documented.
3. Add tests before changing behavior.
4. Update consumers incrementally; never leave two competing implementations.
5. Verify frontend tests, typecheck, lint, and production build.

## Forbidden implementations

- raw interactive HTML where a shared primitive exists;
- arbitrary color, typography, spacing, or radius literals;
- hover-only actions;
- fake loading or success states;
- duplicated modal, menu, drawer, checkbox, title, or badge styles;
- theme-specific markup that changes semantics.

## Definition of done

All approved primitives are centralized, documented, accessible, theme-safe, tested, and consumed by product surfaces. A future agent can change a common button or title once and observe the change everywhere.
