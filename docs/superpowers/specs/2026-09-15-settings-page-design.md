# Settings Page Design

## Goal

Replace the current multi-tab settings modal with a full workspace settings page that uses the standalone component source provided by Assistant UI's Base UI registry. Keep GraphMind's existing workspace navigation, routes, configuration model, and settings behavior intact.

The page must use shared primitives from `apps/web/src/components/ui/`. It must not introduce GraphMind-specific visual variants or expose Assistant UI branding in product source.

## Scope

### Included

- Canonical settings URL: `/w/{workspaceId}/settings`.
- A Settings page rendered in the existing workspace shell, preserving the left navigation and workspace context.
- Global, reusable Base UI primitives for the settings page: dialog, tabs, select, switch, input, textarea, badge, keyboard key, separator, dropdown menu, and the existing Button.
- Migration of every current Settings tab and interaction:
  - provider and model configuration;
  - API-key visibility and local persistence;
  - Ollama endpoint validation;
  - workspace status;
  - disabled roadmap preferences;
  - keyboard-shortcut reference;
  - application information;
  - save, reset, and error states.
- Reset and unsaved-exit confirmation dialogs.

### Excluded

- Changes to chat, canvas, workspace, or library layout and navigation.
- New settings, server persistence, authentication changes, or model-provider behavior.
- Assistant runtime adoption and chat transport migration.
- A workspace-list redesign; it remains a later, independent task.

## Architecture

`ChatContainer` remains the owner of workspace state, current chat state, and `useModelConfig`. It continues to render the existing `WorkspaceShell`, `ChatSidebar`, and header for all workspace routes.

The route resolver adds `settings` to its view modes. When that view mode is active, `ChatContainer` renders `SettingsPage` in the shell's main content area instead of a chat, canvas, or library surface. The current settings modal is removed.

The Settings control in the chat sidebar and the `Cmd/Ctrl + ,` shortcut navigate with `router.push(buildSettingsUrl(workspaceId))`. URL construction is centralized in `buildSettingsUrl`; no component hardcodes the URL.

`SettingsPage` receives `LLMConfig`, `updateConfig`, `resetDefaults`, current workspace data, and navigation callbacks from `ChatContainer`. Saving therefore keeps the existing local-storage behavior and is immediately available when the user returns to a chat.

## Shared Component Boundary

The following components live under `apps/web/src/components/ui/` and preserve their upstream Base UI API and visual treatment:

- `button` (already migrated)
- `dialog`
- `tabs`
- `select`
- `switch`
- `input`
- `textarea`
- `badge`
- `kbd`
- `separator`
- `dropdown-menu`

The application may compose these primitives into semantic settings sections and rows, but may not add product-specific colors, rounded-card treatments, custom tab pills, or alternate control variants. Where the registry does not provide a needed native form element, the shared wrapper uses the same tokens and interaction contract as the supplied controls.

## Settings Page Layout

The page uses a clear, full-page hierarchy:

1. A page header identifies Settings and provides the current workspace context.
2. A vertical `Tabs` list presents Models, Workspaces, General, Appearance, Shortcuts, and About. The active tab remains visible and keyboard navigable.
3. A scrollable content panel presents each section with a heading, concise description, and hairline-separated settings rows.
4. A persistent footer provides Reset, Cancel/back, and Save actions. It presents unsaved state and inline save errors without shifting the layout.

On compact viewports, tabs become a horizontally scrollable tabs list above the content panel. The settings page remains within the existing workspace shell; it does not open as an overlay.

## Interaction and Error Handling

- Provider selection resets the selected model to the first compatible provider model, matching current behavior.
- Password visibility controls use accessible labels and do not alter the stored key value.
- Saving validates the Ollama endpoint before persistence. Invalid input leaves the user on the page and displays the current actionable error message next to the relevant field and in the page status region.
- Controls that mutate configuration disable while a save is in progress.
- Reset requires confirmation and retains the current hook's API-key preservation behavior.
- Leaving with unsaved values requires confirmation; canceling that confirmation retains the edited form.
- Existing disabled roadmap options remain visible, disabled, and semantically announced.

## Testing and Verification

Tests will cover:

- canonical settings URL generation and sidebar/keyboard navigation;
- shell continuity when switching between a chat and settings;
- tab selection and keyboard accessibility;
- provider/model selection, API-key visibility, save persistence, and reset confirmation;
- invalid Ollama URL handling and save-disabled state;
- responsive settings navigation semantics;
- no raw product-specific controls in the Settings page where a shared primitive exists.

Before completion, run the focused settings and UI tests, the full web test suite, `pnpm --filter @graphmind/web typecheck`, and `pnpm --filter @graphmind/web build`.
