# Phase 6: Multi-Agent Workflows & Knowledge Evolution (The WOW Feature)

**Estimated Timeline:** 4 – 5 Weeks (~50 – 60 Engineering Hours @ 2 hrs/day)  
**Status:** Planned  
**Goal:** Introduce specialized agent workflows (Research, Quiz, Summarizer) and the Knowledge Evolution engine to analyze learning gaps and guide technical mastery.

---

## 1. Executive Summary

Phase 6 introduces GraphMind's pinnacle differentiator: **Knowledge Evolution**. The knowledge graph transitions from passive storage into an active learning partner. Specialized agents can be invoked on any node, while a continuous Knowledge Curator analyzes what concepts you have explored, detects prerequisites you skipped, and generates tailored quizzes to test your understanding.

---

## 2. Knowledge Evolution & Multi-Agent Architecture

```
                                  [ GraphMind Workspace ]
                                             │
             ┌───────────────────────────────┼───────────────────────────────┐
             ▼                               ▼                               ▼
    [ Research Agent ]               [ Quiz Agent ]               [ Knowledge Curator ]
  (Performs web lookup,           (Traverses branch,            (Analyzes graph topology,
   summarizes docs, appends        generates MCQs & code         identifies skipped prerequisites,
   evidence nodes)                 quizzes with explanations)    recommends next topics)
```

---

## 3. Sub-Phases & Granular Tasks

### Sub-Phase 6.1: Agent Runtime Architecture in `packages/ai-core`
*Estimated Time: 5 – 6 Days*

- [ ] **Task 6.1.1 — Agent Base Class & Lifecycle**: `BaseAgent` abstraction with state machines, tool execution hooks, and event emitters.
- [ ] **Task 6.1.2 — Tool Execution Engine**: Standardized tool interface (`BaseTool`) with schema validation via Pydantic.
- [ ] **Task 6.1.3 — Agent Context Traversal**: Provide agents with direct access to graph lineage, node siblings, and neighbor concepts.

### Sub-Phase 6.2: Built-in Specialized Agents
*Estimated Time: 6 – 7 Days*

- [ ] **Task 6.2.1 — Research Agent**: Gathers web documentation, extracts key findings, and generates source-cited sub-nodes.
- [ ] **Task 6.2.2 — Technical Quiz Agent**: Traverses all descendant nodes under a topic (e.g. *"FastAPI Architecture"*), generates interactive multiple-choice and code quizzes.
- [ ] **Task 6.2.3 — Branch Summarizer Agent**: Condenses $20+$ node deep sub-trees into a single parent executive summary node.

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
