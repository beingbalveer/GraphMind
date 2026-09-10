# Scope 4 — Remaining Product Surfaces

Status: Tasks 1–5 implemented; Tasks 6–7 remain.

## Objective

Bring dashboard, canvas, file library, settings, and auxiliary panels into the shared GraphMind contract only where inconsistency, accessibility, comprehension, or learning UX requires it. Compliant surfaces should be retained.

## Audit protocol

For each existing surface, create an inventory containing route, purpose, primary user, data dependencies, current components, current states, responsive behavior, and known defects. Then assign exactly one decision:

- **Keep**: already compliant; add documentation/tests only.
- **Refactor**: behavior is sound but shared primitives/tokens are not consumed.
- **Rebuild**: structure prevents the intended learning experience or accessibility.
- **Defer**: no current user value, missing data contract, or future-phase dependency.

Every decision must include evidence and must not be based only on visual preference.

## Task 1 — Learning dashboard

Define a clear starting state, active learning threads, mastery summary, gaps, recent activity, and next-topic actions. Use shared cards/surfaces, headings, badges, feedback, and empty states. Prioritize decisions a learner can take next; avoid decorative metrics. Loading, empty, partial-data, stale-data, and error states must be explicit.

## Task 2 — Knowledge canvas

Preserve the existing graph purpose and data behavior. Normalize toolbar controls, node/edge selection, zoom/reset actions, legends, empty state, loading, and errors through shared primitives. Provide a readable fallback for keyboard and small screens. Do not introduce a 2D canvas feature that is outside the current product phase or invent graph interactions without data support.

## Task 3 — File library and source surfaces

Use consistent search/input, filters, menus, selection states, upload feedback, empty states, and viewer launch actions. Distinguish processing, ready, failed, and unavailable files. Every destructive action uses the shared confirmation dialog. Preserve file callbacks and viewer behavior.

## Task 4 — Settings and account surfaces

Group settings by user goal, use shared titles, fields, switches, tabs, feedback, and save states. Make unsaved, saving, saved, validation-error, and server-error states explicit. Avoid settings that have no implemented behavior. Ensure destructive account actions are clearly separated and confirmed.

## Task 5 — Auxiliary panels and repeated patterns

Audit sidebars, source viewers, branch panels, skill pickers, command menus, notifications, and any other repeated UI. Consolidate equivalent patterns into Scope 1 primitives or a documented product component. Remove visual duplicates only after confirming callback and accessibility parity.

## Task 6 — Cross-surface learning consistency

Ensure the same concept has the same label, icon, color, title hierarchy, status meaning, and action placement everywhere. Mastery, gaps, sources, branches, and next-topic signals must use the same presentation rules as canonical chat.

## Task 7 — Surface verification

For every kept, refactored, or rebuilt surface, test primary workflows, empty/loading/error/success states, keyboard access, screen-reader labels, dark mode, reduced motion, responsive layout, and token compliance. Run the full frontend verification suite.

## Explicit exclusions

- Do not redesign a compliant screen solely to make it different.
- Do not add unsupported data, metrics, or actions.
- Do not create local versions of common controls.
- Do not remove working behavior to simplify visuals.
- Do not introduce future-phase features without a separate approved scope.

## Definition of done

Every remaining surface has a documented keep/refactor/rebuild/defer decision, uses shared contracts wherever it remains in product scope, preserves its behavior, and passes the same quality, accessibility, theme, responsive, and verification gates as chat and shell.
