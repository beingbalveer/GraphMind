# ADR-0006: URL Routing & Deep-Link Design

- **Status:** Accepted
- **Date:** 2026-08-22
- **Deciders:** Founding Team / Architect

---

## Context and Problem Statement

GraphMind currently has two conflicting URL schemes live in the codebase:

| Route | When used |
|---|---|
| `/graph/{workspaceId}` | Canvas view; also used as the generic fallback |
| `/graph/{workspaceId}?chat={chatId}` | When a specific chat is active (via `?chat=` query param) |
| `/workspace/{workspaceId}` | Chat view (second route prefix, rarely reached) |

This is problematic for several reasons:

1. **A workspace ≠ a chat.** A workspace is the top-level container; a chat is an item inside it. The URL must reflect this hierarchy instead of collapsing them.
2. **Query params for primary navigation are an anti-pattern.** `?chat={id}` is correct for optional filter state (e.g. scroll position), not for the primary selected resource. Professional tools (Jira, Linear, Notion) always put the selected resource in the **path**, not the query string, so it is shareable, bookmarkable, and server-renderable.
3. **Two route prefixes (`/graph/` and `/workspace/`) for the same concept creates confusion.** New features and new AI agents building on this codebase have no clear contract about which route to use.
4. **The current scheme has no room to grow.** Phase 5 (semantic search), Phase 6 (multi-agent), and future settings pages all need stable, predictable URL homes.

---

## Decision Drivers

- **Jira analogy:** Workspace = Jira Project, Chat = Jira Issue. Jira uses `/{project-key}/issues/{ISSUE-KEY}` — never a query param.
- **Linear analogy:** `linear.app/{workspace}/issue/{TEAM-KEY}-{number}` — workspace → issue in the path.
- **Notion analogy:** `notion.so/{workspace-slug}/{page-id}` — every resource is a path segment.
- **GraphMind's own data model:** `Workspace 1 → N Chats`. The URL must reflect this ownership.
- **Server-renderability:** Next.js App Router can only use `params` from path segments in Server Components, not `searchParams`, for primary data fetching. Putting `chatId` in the path unlocks proper SSR and metadata generation.

---

## Considered Options

### Option A — Keep `?chat=` query param (status quo)
```
/graph/{workspaceId}?chat={chatId}
```
**Rejected.** Query params are for transient view state, not primary resource identity. Not shareable, not SSR-friendly, not industry standard.

### Option B — Double nested path, view-type prefix
```
/graph/{workspaceId}/{chatId}
/workspace/{workspaceId}/{chatId}
```
**Partially good.** Chat is in the path. But two prefixes (`/graph/`, `/workspace/`) for the same entity is confusing and splits routes arbitrarily.

### Option C — Unified workspace-first hierarchy (CHOSEN)
```
/w/{workspaceId}                        → Workspace home (redirects to most recent chat)
/w/{workspaceId}/chat/{chatId}          → Specific chat in chat/tree view
/w/{workspaceId}/chat/{chatId}/canvas   → Same chat in canvas/graph view
/w/{workspaceId}/settings               → Workspace settings (future)
/w/{workspaceId}/search                 → Semantic search (Phase 5)
```
**Chosen.** This mirrors the industry standard (Jira, Linear, Notion), puts every resource in the path, and has natural room to grow.

---

## Decision Outcome

**Chosen Option: Option C — Unified `/w/{workspaceId}/...` hierarchy.**

### Final Canonical URL Map

```
/                                         → Root: redirect to last active workspace
/w/{workspaceId}                          → Workspace landing (loads most recent chat)
/w/{workspaceId}/chat/{chatId}            → Chat view (linear thread + side branches)
/w/{workspaceId}/chat/{chatId}/canvas     → Canvas/graph view for the same chat
/w/{workspaceId}/settings                 → [Future] Workspace config
/w/{workspaceId}/search                   → [Future Phase 5] Semantic cross-chat search
/w/{workspaceId}/agents                   → [Future Phase 6] Multi-agent runtime view
```

### View Mode Encoding

The **view mode** (chat vs. canvas) is the only transient state that lives in the URL — as a **sub-path segment**, not a query param. This means:

- Switching between chat and canvas view changes the URL segment (`/chat/{id}` ↔ `/chat/{id}/canvas`).
- This makes view mode bookmarkable and shareable, which is important since the canvas is a genuinely different visual context.
- Other transient state (scroll position, drawer open state, selected node) lives in React state only — not in the URL — to avoid unnecessary re-renders.

### Human Readability vs. UUID

UUIDs are kept as-is for `workspaceId` and `chatId`. Reason:

- GraphMind does not yet have user accounts / org slugs (Phase 4 auth is pending).
- UUIDs are stable even if the workspace/chat is renamed (critical for shared links).
- A future "slug" layer can be added transparently via redirect middleware once auth + org names land.

### Query Params — Allowed Uses Only

| Param | Route | Purpose |
|---|---|---|
| `node={nodeId}` | `/w/{wid}/chat/{cid}` | Deep link to a specific message node within the chat (scroll-to + highlight) |
| `view=canvas` | (fallback only) | Legacy redirect shim during migration |

---

## Migration Plan (from current → canonical)

1. **Phase A (Now):** Add `next.config.ts` redirects mapping old routes to new:
   - `/graph/{id}` → `/w/{id}`
   - `/graph/{id}?chat={chatId}` → `/w/{id}/chat/{chatId}`
   - `/workspace/{id}` → `/w/{id}`

2. **Phase B (Now):** Rename Next.js App Router pages:
   - `app/graph/[id]/page.tsx` → `app/w/[workspaceId]/page.tsx`
   - New: `app/w/[workspaceId]/chat/[chatId]/page.tsx`
   - New: `app/w/[workspaceId]/chat/[chatId]/canvas/page.tsx`

3. **Phase C (Now):** Replace all `window.history.replaceState(…, "/graph/…")` calls in `ChatContainer.tsx` with the new canonical paths.

---

## Consequences

### Positive
- **Shareable deep links:** Any URL points unambiguously to a specific chat in a specific workspace.
- **SSR-ready:** `workspaceId` and `chatId` are both `params` in App Router, enabling full server-side data fetching and `<title>` metadata generation.
- **Future-proof:** Settings, semantic search, and agent runtime pages have natural URL homes.
- **Industry aligned:** New developers and AI agents working on the codebase will immediately recognise the pattern from Jira/Linear.

### Negative
- **One-time migration effort:** Existing bookmarks/links using `/graph/` will need redirects (handled by `next.config.ts`).
- **No human-readable slugs yet:** Will require a slug layer once org/user auth lands. This is a known future cost, not a blocker.
