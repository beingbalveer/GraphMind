# GraphMind — URL Design & Routing Reference

> **Status:** Canonical. All new features MUST follow this design.
> **See also:** [`docs/adr/0006-url-routing-design.md`](./adr/0006-url-routing-design.md) for the decision rationale.

---

## 1. Mental Model: Workspace → Chat → Node

GraphMind's data hierarchy maps directly to the URL hierarchy:

```
Workspace  (top-level container, like a Jira Project)
  └── Chat  (a conversation tree, like a Jira Issue / Linear Issue)
        └── Node  (a single message, like a comment or reply — addressed via ?node= param)
```

Just as `linear.app/{workspace}/issue/{TEAM}-{n}` gives you the full address of an item,
GraphMind uses:

```
graphmind.app/w/{workspaceId}/chat/{chatId}
```

---

## 2. Canonical Route Table

| URL Pattern | Route File (Next.js App Router) | Description |
|---|---|---|
| `/` | `app/page.tsx` | Root redirect → last active workspace |
| `/w/{workspaceId}` | `app/w/[workspaceId]/page.tsx` | Workspace landing; loads most recent chat |
| `/w/{workspaceId}/chat/{chatId}` | `app/w/[workspaceId]/chat/[chatId]/page.tsx` | Chat (thread) view |
| `/w/{workspaceId}/chat/{chatId}/canvas` | `app/w/[workspaceId]/chat/[chatId]/canvas/page.tsx` | Canvas/graph view for same chat |
| `/w/{workspaceId}/settings` | `app/w/[workspaceId]/settings/page.tsx` | *(Future)* Workspace config |
| `/w/{workspaceId}/search` | `app/w/[workspaceId]/search/page.tsx` | *(Future Phase 5)* Semantic search |
| `/w/{workspaceId}/agents` | `app/w/[workspaceId]/agents/page.tsx` | *(Future Phase 6)* Agent runtime |

---

## 3. URL Examples

```
# Workspace landing (redirects to most recent chat automatically)
/w/a1b2c3d4-e5f6-...

# Specific chat in thread view
/w/a1b2c3d4-e5f6-.../chat/f7g8h9i0-j1k2-...

# Same chat in canvas/graph view  
/w/a1b2c3d4-e5f6-.../chat/f7g8h9i0-j1k2-.../canvas

# Deep link to a specific node (message) within a chat
/w/a1b2c3d4-e5f6-.../chat/f7g8h9i0-j1k2-...?node=m3n4o5p6-q7r8-...
```

---

## 4. View Mode: Path Segment, Not Query Param

The active **view mode** (chat vs. canvas) is encoded as a sub-path:

| User action | Resulting URL |
|---|---|
| User opens a chat in thread view | `/w/{wid}/chat/{cid}` |
| User switches to canvas | `/w/{wid}/chat/{cid}/canvas` |
| User switches back to chat | `/w/{wid}/chat/{cid}` |

**Why path segment, not `?view=canvas`?**
- The two views are meaningfully different contexts, not just cosmetic toggles.
- Path segments are indexed by browsers for history; query params are often stripped.
- Allows independent sharing ("send me the canvas view of this chat").

---

## 5. Allowed Query Parameters

Query params are reserved **only** for transient, optional navigation state:

| Param | Allowed on | Purpose |
|---|---|---|
| `?node={nodeId}` | `/w/{wid}/chat/{cid}` and `/canvas` | Scroll-to and highlight a specific message node |

**Never use query params for:**
- Active workspace selection
- Active chat selection  
- Active view mode

---

## 6. Legacy Redirect Map

These redirects must be kept in `next.config.ts` permanently to avoid broken links:

| Old URL | Canonical Redirect |
|---|---|
| `/` | `/w/{lastWorkspaceId}` (client-side) |
| `/graph/{workspaceId}` | `/w/{workspaceId}` |
| `/graph/{workspaceId}?chat={chatId}` | `/w/{workspaceId}/chat/{chatId}` |
| `/workspace/{workspaceId}` | `/w/{workspaceId}` |
| `/workspace/{workspaceId}?chat={chatId}` | `/w/{workspaceId}/chat/{chatId}` |

---

## 7. URL Update Rules for Engineers & AI Agents

### Rule 1: Use `router.push()` for user-initiated navigation
```typescript
// ✅ Correct — user clicked a different chat
router.push(`/w/${workspaceId}/chat/${chatId}`);

// ❌ Wrong — never use window.history.replaceState for navigation
window.history.replaceState(null, "", `/graph/${workspaceId}?chat=${chatId}`);
```

### Rule 2: Use `router.replace()` only for redirects / initial load resolution
```typescript
// ✅ Correct — resolving workspace landing to first chat on page load
router.replace(`/w/${workspaceId}/chat/${chatId}`);
```

### Rule 3: View mode toggle uses `router.push()`
```typescript
// Chat → Canvas
router.push(`/w/${workspaceId}/chat/${chatId}/canvas`);

// Canvas → Chat
router.push(`/w/${workspaceId}/chat/${chatId}`);
```

### Rule 4: Deep-link node param must never replace the path
```typescript
// ✅ Correct — append node param to existing canonical path
router.push(`/w/${workspaceId}/chat/${chatId}?node=${nodeId}`);

// ❌ Wrong
router.push(`/w/${workspaceId}?chat=${chatId}&node=${nodeId}`);
```

### Rule 5: Never construct URLs with string concatenation in components
```typescript
// ✅ Correct — use a central helper
import { buildChatUrl, buildCanvasUrl, buildNodeUrl } from "@/lib/urls";

// ❌ Wrong — scattered URL strings cause drift
`/w/${workspaceId}/chat/${chatId}`  // in 10 different components
```

---

## 8. URL Helper Functions (to be implemented in `apps/web/src/lib/urls.ts`)

```typescript
export const buildWorkspaceUrl = (workspaceId: string) =>
  `/w/${workspaceId}`;

export const buildChatUrl = (workspaceId: string, chatId: string) =>
  `/w/${workspaceId}/chat/${chatId}`;

export const buildCanvasUrl = (workspaceId: string, chatId: string) =>
  `/w/${workspaceId}/chat/${chatId}/canvas`;

export const buildNodeUrl = (workspaceId: string, chatId: string, nodeId: string) =>
  `/w/${workspaceId}/chat/${chatId}?node=${nodeId}`;
```

All URL construction in the app must go through these helpers. This is the single source of truth. If the scheme changes, only this file changes.

---

## 9. Comparison with Industry Peers

| Product | Workspace | Item | View modifier |
|---|---|---|---|
| **Jira** | `/jira/software/projects/{project}` | `/browse/{PROJ-123}` | `?atlOrigin=…` (analytics only) |
| **Linear** | `linear.app/{workspace}` | `/issue/{ENG-123}` | n/a (modal overlay) |
| **Notion** | `notion.so/{workspace}` | `/{page-id}` | n/a |
| **GitHub** | `github.com/{org}/{repo}` | `/issues/{n}` | `/files`, `/commits` |
| **GraphMind** | `/w/{workspaceId}` | `/chat/{chatId}` | `/canvas` |

GraphMind's structure most closely mirrors **GitHub's** — a workspace (repo) contains many chats (issues), each of which can be viewed in different modes (files view, commits view → chat view, canvas view).

---

## 10. What This Unlocks for Future Phases

| Phase | Feature | URL |
|---|---|---|
| **Phase 4** | Workspace settings | `/w/{wid}/settings` |
| **Phase 5** | Semantic cross-chat search | `/w/{wid}/search?q={query}` |
| **Phase 5** | Concept node deep link | `/w/{wid}/chat/{cid}?node={nid}` |
| **Phase 6** | Agent runtime dashboard | `/w/{wid}/agents` |
| **Phase 6** | Specific agent session | `/w/{wid}/agents/{sessionId}` |
| **Future** | Org/user home | `/{orgSlug}/w/{wid}/chat/{cid}` *(slug layer added on top)* |
