# Phase 6: Multi-Agent Workflows & Knowledge Evolution (The WOW Feature)

**Estimated Timeline:** 4 – 5 Weeks (~50 – 60 Engineering Hours @ 2 hrs/day)  
**Status:** In Progress 🚀 (Autonomous Tool Runtime & Skills Engine Delivered)  
**Goal:** Introduce specialized agent workflows (Research, Quiz, Code Architect), autonomous tool execution, and the Knowledge Evolution engine to guide technical mastery.

---

## 1. Executive Summary

Phase 6 introduces GraphMind's pinnacle differentiator: **Knowledge Evolution**. The knowledge graph transitions from passive storage into an active learning partner. Models are equipped with autonomous multi-turn tool calling, live web grounding, and specialized system skills (Code Architect, Deep Research, Quiz Master) to evaluate and expand your understanding.

---

## 2. Knowledge Evolution & Multi-Agent Architecture

```
                                  [ GraphMind Workspace ]
                                             │
             ┌───────────────────────────────┼───────────────────────────────┐
             ▼                               ▼                               ▼
    [ Research Agent / Skill ]       [ Quiz Master Skill ]        [ Knowledge Curator ]
  (Performs web lookup,           (Traverses branch,            (Analyzes graph topology,
   summarizes docs, appends        generates MCQs & code         identifies skipped prerequisites,
   evidence nodes)                 quizzes with explanations)    recommends next topics)
```

---

## 3. Sub-Phases & Granular Tasks

### Sub-Phase 6.1: Tool Execution Engine & Runtime in `packages/ai-core` & `apps/api`
*Estimated Time: 5 – 6 Days*

- [x] **Task 6.1.1 — Tool Domain Abstractions**: `BaseTool`, `ToolCall`, and `ToolResult` interfaces with Pydantic validation in `packages/ai-core`.
- [x] **Task 6.1.2 — Multi-Turn Tool Execution Loop**: Autonomous tool loop in `apps/api/src/services/tool_service.py` with SSE streaming events (`tool_call`, `tool_result`).
- [x] **Task 6.1.3 — Graph-Native Tools**: LLM tools (`search_graph`, `fetch_node_details`, `get_node_neighbors`, `traverse_branch_lineage`).
- [x] **Task 6.1.4 — Web Search Grounding**: Live web search integration via DuckDuckGo (`search_web_grounding`).

### Sub-Phase 6.2: Built-in Specialized System Skills
*Estimated Time: 6 – 7 Days*

- [x] **Task 6.2.1 — Markdown Skill Loader**: File-based skill parser in `skill_service.py` reading YAML frontmatter and instructions from `apps/api/skills/`.
- [x] **Task 6.2.2 — Deep Research Skill**: Rigorous investigation persona synthesizing evidence with external citations.
- [x] **Task 6.2.3 — Code Architect Skill**: Senior architectural persona enforcing production design patterns and type safety.
- [x] **Task 6.2.4 — Quiz Master Skill**: Evaluator persona generating interactive quizzes from conversation branches.

### Sub-Phase 6.3: Knowledge State & Mastery Modeling
*Estimated Time: 5 – 6 Days*

- [ ] **Task 6.3.1 — User Knowledge Profile Schema**: Store concept mastery levels (`explored`, `quizzed`, `mastered`, `stale`).
- [ ] **Task 6.3.2 — Quiz Feedback Loop**: Answering quiz questions updates concept confidence scores in the user profile.
- [ ] **Task 6.3.3 — Visual Mastery Overlay (Heatmap)**: Canvas mode overlay coloring nodes by user mastery level (Green = Mastered, Amber = Learning, Gray = Unexplored).

### Sub-Phase 6.4: The Knowledge Curator (Evolution Engine)
*Estimated Time: 5 – 6 Days*

- [ ] **Task 6.4.1 — Gap Analysis Algorithm**: Compare explored graph topics against domain dependency graphs (e.g., detecting user learned `Asyncio` but skipped `Event Loops`).
- [ ] **Task 6.4.2 — Next Best Topic Recommendations**: Suggest 3 next logical topics to explore with rationale: *"Prerequisite for FastAPI BackgroundTasks"*.
- [ ] **Task 6.4.3 — Timeline Replay View**: Replay the evolution of your knowledge graph over time across days, weeks, and months.

### Sub-Phase 6.5: Polish, Benchmarking & Public Open-Source Launch
*Estimated Time: 4 – 5 Days*

- [ ] **Task 6.5.1 — Performance Profiling & Optimization**: Ensure graph rendering, vector search, and agent runs remain fast on large workspaces ($500+$ nodes).
- [ ] **Task 6.5.2 — Contributor Documentation & Video Walkthrough**: Complete `CONTRIBUTING.md`, architecture diagrams, and interactive demo workspace.
- [ ] **Task 6.5.3 — Release v1.0 Packaging**: Docker self-hosting verification, semantic version tagging, and GitHub release notes.

---

## 4. Exit & Acceptance Criteria

1. Users can invoke specialized agents (Research, Quiz, Summarize) on any node with a single click.
2. Quiz agent tests knowledge of sub-trees and dynamically updates the mastery heatmap.
3. Knowledge Curator recommends accurate, contextual next topics based on learning history.
4. The entire application runs seamlessly via `docker compose up` with complete documentation.
