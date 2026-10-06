# GraphMind UI primitives

Product code composes these primitives and must not recreate their visual or accessibility contracts.

- Use `Button` for labeled actions and `IconButton` for icon-only actions.
- Every `IconButton` requires `label`; add `tooltip` when the action is not already explained nearby.
- Use `Input` for one line and `Textarea` for multiline text.
- Use `Surface` for bordered/elevated containers; `radius="composer"` supplies the measured 22px chat-composer corners.
- Use `NavigationItem` for 36px sidebar actions, with `active` and `collapsed` states.
- Use `SegmentedTabs` for mode switches; `variant="pills"` supplies flat collection and Library filters. Give each tab list an `ariaLabel`.
- Use `DropdownMenu`, `Modal`, `Drawer`, and `ConfirmDialog` for compound overlays.
- Use `InlineFeedback`, `EmptyState`, `Skeleton`, and `Toast` for explicit states.
- Use semantic tokens only. Literal palette classes and arbitrary typography or half-step spacing are rejected by `design-contract.test.ts`.
- Product-specific patterns belong outside this directory.

## Reference styling

The light palette and typography were measured and standardized for GraphMind's UI design system. The UI font is the shared system stack; display headings use locally hosted Libre Baskerville (SIL Open Font License in `src/app/fonts/OFL.txt`). Body backgrounds, sidebar backgrounds, primary actions, foregrounds, and translucent borders are semantic roles in `globals.css`, with dark-mode counterparts.

Controls use 8px corners, navigation rows use 10px corners, widgets use 12px, and cards/dialogs use 16px. The named `text-label`, `text-display-sm`, `rounded-navigation`, and `rounded-composer` utilities retain the measured reference values without scattering arbitrary classes across consumers.
