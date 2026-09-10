# GraphMind UI primitives

Product code composes these primitives and must not recreate their visual or accessibility contracts.

- Use `Button` for labeled actions and `IconButton` for icon-only actions.
- Every `IconButton` requires `label`; add `tooltip` when the action is not already explained nearby.
- Use `Input` for one line and `Textarea` for multiline text.
- Use `Surface` for bordered/elevated containers.
- Use `DropdownMenu`, `Modal`, `Drawer`, and `ConfirmDialog` for compound overlays.
- Use `InlineFeedback`, `EmptyState`, `Skeleton`, and `Toast` for explicit states.
- Use semantic tokens only. Literal palette classes and arbitrary typography or half-step spacing are rejected by `design-contract.test.ts`.
- Product-specific patterns belong outside this directory.
