# GraphMind UI Implementation Handoff

Use this document as the implementation brief for another AI agent. It defines the target structure and behavior; it is not a request to install or depend on `assistant-ui`.

## 1. Product intent

GraphMind is a learning workspace where a learner can:

1. Ask and understand a concept.
2. Branch into a curiosity or follow-up question.
3. See relationships on a knowledge canvas.
4. Reflect through mastery, gaps, sources, and next topics.

The visual direction is **GraphMind Calm**: quiet surfaces, restrained indigo accent, strong reading hierarchy, and subtle graph identity. The layout direction is **Adaptive Context**: navigation on the left, focused content in the center, and a contextual rail only when useful.

The attached assistant-ui source is reference material only. Extract interaction principles and layout ideas, but implement GraphMind-owned components and contracts.

## 2. Non-negotiable engineering rules

- Use the existing primitives in `apps/web/src/components/ui/`.
- Do not add a dependency on `assistant-ui`.
- Do not create raw interactive controls when a shared primitive exists.
- Use semantic tokens instead of palette literals in product components.
- Support light/dark themes and `prefers-reduced-motion`.
- Preserve current streaming, branching, file, skill, viewer, retry, stop, and send behavior.
- Preserve URL helpers and the canonical paths:
  - `/w/{workspaceId}`
  - `/w/{workspaceId}/chat/{chatId}`
  - `/w/{workspaceId}/chat/{chatId}/canvas`
- Do not put primary navigation identifiers in query parameters.

## 3. Existing foundation to consume

The repository already contains and tests these shared contracts:

- `Button`, `IconButton`, `Tooltip`
- `Input`, `Textarea`
- `Surface`, `Skeleton`
- `DropdownMenu`, `MenuCard`, `MenuItem`, `Collapsible`
- `Modal`, `Drawer`, `ConfirmDialog`
- `Switch`, `SegmentedTabs`, `Badge`
- `Toast`, `InlineFeedback`, `EmptyState`, `CopyButton`
- `GraphMindIcon`, `LogoBadge`

Use these components rather than rebuilding equivalent styles in chat files.

## 4. Target application structure

```text
Workspace route
├── WorkspaceShell
│   ├── LeftNavigation
│   │   ├── workspace switcher
│   │   ├── new chat
│   │   ├── file library
│   │   ├── recent chats
│   │   └── account/settings
│   ├── MainHeader
│   │   ├── collapse navigation
│   │   ├── workspace name
│   │   ├── Chat / Canvas segmented tabs
│   │   └── open contextual rail
│   ├── MainContent
│   │   └── ChatView or CanvasView
│   └── ContextRail (conditional)
│       ├── mastery
│       ├── knowledge gaps
│       ├── sources
│       └── next topic
└── mobile drawers for navigation/context
```

The adaptive shell is a separate migration stage from the canonical chat. Do not mix shell rewrites into a chat-only implementation unless explicitly requested.

## 5. Canonical chat structure

```text
ChatView
├── ConversationViewport
│   ├── EmptyState (new workspace)
│   ├── Loading/Skeleton state
│   ├── MessageList
│   │   ├── UserMessage
│   │   │   ├── quiet filled Surface
│   │   │   ├── attachment previews
│   │   │   ├── branch context cue
│   │   │   └── edit/copy actions
│   │   └── AssistantMessage
│   │       ├── borderless Markdown content
│   │       ├── code blocks with copy action
│   │       ├── branch links and selection exploration
│   │       ├── collapsed activity/source groups
│   │       ├── retry/error feedback when needed
│   │       └── response actions
│   └── streaming anchor / scroll state
└── ComposerShell
    ├── attachment strip
    ├── branch context strip
    ├── multiline Textarea
    ├── attachment/skill toolbar
    └── stable send/stop control
```

Desktop conversation content should be fluid below `--chat-content-max` and capped at `44rem` above it. The composer is one softly elevated bordered surface. User prompts are visually distinct; assistant responses prioritize readable content over containers.

## 6. Component responsibilities

### `ChatMessage`

Keep the existing public props and callback signatures. It owns message presentation, Markdown, attachments, branch links, source viewers, response actions, and user-message editing. It must not own workspace navigation or stream orchestration.

### `ChatInput`

Keep the existing `ChatInputProps`. It owns prompt text, Enter/Shift+Enter behavior, paste/drop, upload, file-library selection, slash commands, active skill, branch context, send, and stop. It must not decide routing or persist chat state.

### `AgentToolCallsBanner`

Represent tool activity as a compact, collapsed-by-default group. Failed tools must be visibly identified even when collapsed and must expose a real recovery action when the owner provides one.

### `BranchBreadcrumbs`

Provide compact lineage navigation with accessible labels. Branch actions must remain keyboard reachable and must use existing branch callbacks.

### `SelectionTooltip`

Offer real actions such as “Explore branch” or “Search web” for selected assistant text. Visibility may be contextual, but operation cannot depend on hover alone.

### `RightSidebar`

Keep mastery, gaps, sources, and next-topic guidance contextual. Do not repeat mastery metadata inside every answer.

## 7. State model

Every visible state must be explicit:

| State | Presentation | Required action |
|---|---|---|
| Empty workspace | concise explanation + real prompt affordance | start asking |
| Loading | reserved space or Skeleton | none |
| Streaming | stable message/composer layout + stop | stop generation |
| Stream error | InlineFeedback below interrupted response | retry or dismiss |
| Tool running | collapsed activity with progress | expand for details |
| Tool failed | destructive status visible immediately | retry when available |
| Attach failure | feedback beside affected attachment | remove/retry |
| Branch context active | compact composer context strip | clear branch |
| Sources available | collapsed source group | inspect source |
| Mastery available | contextual rail signal | open rail |

Never show a successful state for a failed operation. Never render an action that has no callback.

## 8. Interaction requirements

- Enter submits when the prompt is non-empty.
- Shift+Enter inserts a newline.
- Send and stop occupy the same stable location.
- Escape closes menus, dialogs, drawers, and transient selection UI according to the shared primitive contract.
- Menu/dialog/drawer focus returns to the opener.
- Focused controls reveal actions that are hidden at rest.
- Loading controls remain disabled and retain an accessible name.
- Descriptions and errors use `aria-describedby` without duplicate IDs.
- Async failures use live/alert semantics where appropriate.

## 9. Responsive behavior

### Desktop, 1440px

- Persistent left navigation.
- Centered conversation column capped at `44rem`.
- Contextual rail may open without obscuring the conversation.

### Tablet, 768px

- Conversation remains readable and fluid.
- Navigation may narrow or collapse.
- Context rail should become a drawer when space is constrained.

### Mobile, 390px

- Navigation becomes a drawer; it must not permanently consume half the viewport.
- Composer remains fully visible and usable above the keyboard.
- Contextual information opens as a drawer.
- No horizontal clipping or inaccessible off-screen controls.

## 10. Accessibility and visual quality checklist

- Every icon-only action has an accessible `label`.
- Headings follow a logical order.
- Interactive elements use semantic roles.
- Focus rings are visible in both themes.
- Status text meets practical contrast requirements.
- Motion-heavy transitions have reduced-motion behavior.
- Dark mode does not rely on light-only palette classes.
- Touch targets are large enough for mobile use.
- Error and loading states are announced appropriately.

## 11. Implementation order

1. Message hierarchy and Markdown/attachment surfaces.
2. Composer built on `Surface`, `Textarea`, `IconButton`, `Button`, and menu primitives.
3. Activity, branch, source, and selection signals.
4. Chat column composition and contextual rail.
5. Chat-specific contract tests, full verification, and visual QA.
6. Separately: adaptive shell/mobile navigation and remaining product surfaces.

Each stage must be test-first, independently reviewed, and committed before the next stage begins.

## 12. Definition of done

- No `assistant-ui` runtime dependency.
- Existing chat behavior remains intact.
- Product chat files consume shared UI primitives and semantic tokens.
- Messages, composer, activity, sources, branches, and learning signals match the structure above.
- Desktop and tablet layouts are readable; mobile navigation is handled by the adaptive-shell stage.
- Focus, keyboard, error, loading, reduced-motion, and dark-mode behavior are tested.
- Full frontend tests, typecheck, lint, and production build pass.
