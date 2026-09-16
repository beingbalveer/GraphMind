# AI Engineer Roadmap Agent Design

## Goal

Build GraphMind's first intelligent-learning-roadmap experience: an AI research agent that turns the AI Engineer profile into a trustworthy, basic-to-advanced learning tree.

## Product scope

The learner starts from the workspace dashboard, opens a right-side build drawer, selects AI Engineer, and starts generation. The drawer exposes concise stage updates, sources found, and the emerging phase outline. It never shows hidden model reasoning. When generation completes, GraphMind opens a dedicated roadmap workspace in the canonical canvas view.

The generated learning graph is a tree: `AI Engineer` is the root; phase nodes are its children; module and topic nodes descend until every leaf is an actionable learning unit. Each node has exactly one parent. Topic metadata carries level, estimated effort, learning action, project checkpoint, rationale, and source URLs.

## Agent architecture

`RoadmapAgentService` orchestrates a bounded pipeline:

1. Build a research brief from the profile and the learner's basic-to-advanced intent.
2. Ask the model for focused research queries; fall back to a curated AI Engineer query set when output is invalid.
3. Run a bounded web-search adapter for each query and retain only normalized title, URL, domain, and snippet records.
4. Ask the model to compose a typed roadmap blueprint using the profile guardrails and source summaries.
5. Validate tree structure, depth, required phase coverage, unique titles, minimum leaf count, and source provenance. Retry composition once with validation feedback; fail cleanly if the second blueprint is invalid.
6. Materialize only a validated blueprint as GraphMind nodes, edges, and concepts.

The first profile is a code-owned `AI_ENGINEER_PROFILE`. Future profiles use the same profile contract and agent pipeline; they do not require a new route or a new generation implementation.

## Runtime and API

Generation is started with a new roadmap-agent endpoint and delivered as a server-sent event stream. Events are small public progress records: `stage`, human-readable `message`, optional source count, optional outline, terminal `complete`, and terminal `error`. The agent has fixed query, result, and retry limits. The stream's complete event returns workspace and root-node identifiers.

The old one-shot roadmap endpoint remains compatible. The new endpoint is used by the AI Engineer drawer. The service reuses the existing provider abstraction and adds a bounded `search_web` tool/adapter; no model is allowed to invent source records.

## UX and navigation

`RoadmapModal` is replaced by a shared `Drawer` implementation with no backdrop blur. It initially presents the AI Engineer profile and a single build action. During generation, it renders transparent progress and a source count. On completion it uses the central URL helper to navigate to the resulting workspace, whose existing workspace resolution opens the graph's chat/canvas context. It preserves accessible loading, error, and retry states.

## Reliability and safety

- Search input is limited to agent-produced strings and a fixed query count.
- Search output is truncated before it enters model context.
- Network and provider failures emit an actionable error and do not persist a half-built roadmap.
- A roadmap must have five named phases—Foundations, Machine Learning, Deep Learning, LLM Systems, and Production AI—and at least ten leaf topics before materialization.
- Each non-root blueprint node has exactly one valid parent; the validator rejects cycles, orphan nodes, duplicate IDs, duplicate sibling titles, and invalid depths.
- Source URLs are persisted only as metadata on the roadmap root and relevant topic nodes.

## Testing

Backend unit tests cover query-plan parsing/fallback, source normalization, valid and invalid blueprint validation, retry behavior, and materialization metadata. Router tests cover progress and terminal SSE events with a fake agent. Frontend tests cover opening the drawer, visible agent progress, source count, error/retry state, and navigation through the URL helper. Existing roadmap tests are updated to require validated minimum tree coverage instead of accepting any non-empty model JSON.

## Non-goals

This release does not add competency gates, quizzes, spaced repetition scheduling, continuous re-planning, arbitrary profiles in the UI, account-wide source management, or cross-tree prerequisite links. Those are follow-on Category 1 and Category 2 work.
