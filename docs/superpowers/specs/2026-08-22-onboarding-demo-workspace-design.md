# Design Spec: First-Time Onboarding & Demo Workspace

**Date:** 2026-08-22
**Status:** Proposed

## 1. Overview & Goal
When a user opens GraphMind for the very first time, they currently see a blank workspace. To immediately demonstrate the value of a knowledge graph (and communicate that "this AI learns like your brain does"), we will automatically seed a fully-functional "GraphMind Workspace". 

This workspace acts as a living tutorial. It contains pre-populated chats and branches that explain the tool while simultaneously demonstrating it in action.

## 2. The User Experience
- **First Load:** User navigates to `/`. The system detects they are a new user.
- **Auto-Provisioning:** A brief loading state occurs while the backend atomically generates the demo workspace.
- **Routing:** The user is immediately pushed to `/w/{demo_workspace_id}/chat/{first_chat_id}`, landing directly on the first message of the tutorial.
- **Ownership:** The demo workspace is a real workspace. The user can branch off it, edit it, or delete it.
- **Deletion:** If the user deletes the demo workspace, it is permanently removed (future phases will introduce a trash/soft-delete system). 

## 3. The Content Structure
The seed data will contain exactly two chats to provide both a "meta" layer and a "real topic" layer.

### Chat 1: What is GraphMind? (Meta Layer)
- **Root Node (User):** "What is GraphMind?"
- **Assistant Reply:** Explains the core concept (knowledge as a graph, not a linear chat history).
- **Branch A (User):** "Why graphs instead of chat history?" -> Assistant explains contextual branching.
- **Branch B (User):** "Show me a real example." -> Assistant introduces the second chat topic.

### Chat 2: How the brain learns (Topic Layer)
- **Root Node (User):** "How does the human brain learn?"
- **Assistant Reply:** Explains memory, neural connections, and spaced repetition.
- **Branch A (User):** "What is spaced repetition?" -> Assistant dives into the cognitive science.
- **Branch B (User):** "How does this relate to how I should use GraphMind?" -> Assistant ties the cognitive science back to mapping ideas in the tool.

## 4. Architecture & Implementation

### 4.1 Backend (FastAPI)
- **Endpoint:** `POST /api/v1/workspaces/seed`
- **Logic:** 
  - Opens a single database transaction.
  - Creates the `Workspace` ("GraphMind Workspace").
  - Creates `Chat` 1 and `Chat` 2.
  - Iteratively inserts the predefined `Node` records, carefully wiring the `parent_id` fields to create the branches.
  - Commits the transaction and returns the new `workspaceId` and `chat1Id`.
- **Maintainability:** The seed data (the raw text of the messages) will be stored in a clean Python dictionary constant (e.g., `seed_data.py`), keeping the API route clean and making copy tweaks trivial.

### 4.2 Frontend (Next.js)
- **Detection:** In `ChatContainer.tsx` (or a dedicated auth/init wrapper), when `fetchWorkspaces()` returns an empty array `[]`, we check a `localStorage` flag (e.g., `graphmind_demo_seeded=true`).
  - *Why `localStorage`?* Since Phase 4 (auth) is not yet implemented, we need a way to distinguish between "first time ever" (0 workspaces) and "user manually deleted all their workspaces" (0 workspaces). The flag prevents infinitely re-seeding the demo if the user chooses to delete it.
- **Execution:** If the array is empty and the flag is missing:
  1. Call `POST /api/v1/workspaces/seed`.
  2. Set `localStorage.setItem('graphmind_demo_seeded', 'true')`.
  3. Call `router.replace(buildChatUrl(newWorkspaceId, newChatId))`.

## 5. Scope & Boundary
- This spec **does not** include building a Trash/Recycle Bin feature (deferred to future).
- This spec **does not** include real User Auth (deferred to Phase 4).
