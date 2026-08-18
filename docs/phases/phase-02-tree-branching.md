# Phase 2: Tree-Structured Branching & Lineage Engine

**Estimated Timeline:** 2 – 3 Weeks (~25 – 35 Engineering Hours @ 2 hrs/day)  
**Status:** Planned  
**Goal:** Transition from a flat chat list to an interactive, hierarchical conversation tree with text-selection branching and ancestor context traversal.

---

## 1. Executive Summary

In Phase 2, GraphMind introduces its core interaction paradigm: **Branching Conversations**. Instead of forcing all prompts into a single vertical sequence, users can select any concept in an AI response and spawn a focused sub-thread. The system preserves context lineage so child nodes know their conversation ancestry without token bloat.

---

## 2. Lineage Context Traversal Model

```
[ Root Node: "Explain Python Data Structures" ] (ID: n1)
       │
       ▼
[ Response Node: Lists, Tuples, Dicts, Sets ] (ID: n2)
       │
       ├── [ Highlighted: "Dicts" ] ──► [ Child Branch Node: "How does dict hash table work?" ] (ID: n3)
       │                                       │
       │                                       ▼
       │                                [ Child Response Node: "Hash table collision resolution" ] (ID: n4)
       │
       └── [ Highlighted: "Sets" ] ──►  [ Child Branch Node: "Set operations and complexity" ] (ID: n5)
```

When querying at Node `n3`, the Lineage Engine traverses `n1 -> n2 -> n3` to construct the prompt context.

---

## 3. Sub-Phases & Granular Tasks

### Sub-Phase 2.1: Tree Data Structures & Domain Models
*Estimated Time: 3 – 4 Days*

- [ ] **Task 2.1.1 — Tree Node Schema**: Create `TreeNode` domain model (`id`, `parent_id`, `children_ids`, `role`, `content`, `highlighted_context`, `created_at`).
- [ ] **Task 2.1.2 — In-Memory Conversation Tree**: Implement immutable tree manipulation utilities in TypeScript (`addChild`, `pruneBranch`, `getAncestors`, `findNode`).
- [ ] **Task 2.1.3 — Python Tree Schema**: Mirror tree models in Pydantic for API serialization.

### Sub-Phase 2.2: Context Lineage Traversal Engine
*Estimated Time: 4 – 5 Days*

- [ ] **Task 2.2.1 — Ancestor Path Resolver**: Implement backend ancestor path extraction from tree root to active branch node.
- [ ] **Task 2.2.2 — Context Window Token Budgeter**: Build prompt builder that fits ancestor summaries + direct parent message + highlighted snippet within model token limits.
- [ ] **Task 2.2.3 — Lineage Test Suite**: Pytest verification for branching depth $\ge 10$ levels, ensuring prompt context stays coherent.

### Sub-Phase 2.3: Text Highlight & Contextual Action Menu (UI)
*Estimated Time: 4 – 5 Days*

- [ ] **Task 2.3.1 — Selection Detection**: Implement floating selection tooltip on text highlight inside assistant responses.
- [ ] **Task 2.3.2 — Quick-Branch Action**: "Explore Sub-topic" action opening inline branch composer pre-filled with selected text snippet context.
- [ ] **Task 2.3.3 — Branch Spawn Animation**: Smooth visual transition spawning child thread container below or alongside the parent node.

### Sub-Phase 2.4: Hierarchical Branch Navigation & Breadcrumbs
*Estimated Time: 3 – 4 Days*

- [ ] **Task 2.4.1 — Branch Breadcrumb Bar**: Top navigation displaying `Root > Concept > Sub-topic` path with single-click jump back.
- [ ] **Task 2.4.2 — Branch Tree Outline Sidebar**: Collapsible tree explorer sidebar showing the conversation outline and branch count.
- [ ] **Task 2.4.3 — Keyboard Navigation**: Shortcuts (`Cmd+[`, `Cmd+]`, `Cmd+Up`) to traverse parent/child/sibling branches.

### Sub-Phase 2.5: Integration & Branch State Management
*Estimated Time: 2 – 3 Days*

- [ ] **Task 2.5.1 — Zustand Tree Store**: Migrate frontend state from flat message list to tree store.
- [ ] **Task 2.5.2 — LocalStorage Tree Snapshot**: Auto-persist active tree state to browser local storage across refreshes.
- [ ] **Task 2.5.3 — Vitest Tree Coverage**: Comprehensive unit tests for branch creation, switching, and pruning.

---

## 4. Exit & Acceptance Criteria

1. Highlighting any text inside a response displays an "Explore" pill.
2. Clicking "Explore" spawns a child conversation inheriting the parent context.
3. The LLM accurately answers follow-up questions referencing previous parent nodes without re-explaining the root prompt.
4. Users can seamlessly switch between multiple parallel branches via breadcrumbs or tree sidebar.
