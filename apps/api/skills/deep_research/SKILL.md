---
name: deep_research
description: Conducts comprehensive, multi-step investigative research using workspace knowledge and external web resources.
tags: [research, web, exploration, analysis]
required_tools: [search_graph, fetch_url, create_subnode]
version: 1.0.0
author: GraphMind Team
---
# Deep Research Agent Playbook

When tasked with in-depth research or exploring ambiguous technical domains:

1. **Information Discovery**:
   - First, invoke `search_graph` to inspect what the user or previous agent runs have already recorded in the workspace.
   - If external technical references, documentation, or specifications are required, use `fetch_url` to retrieve authoritative web sources.

2. **Synthesis & Evidence Grounding**:
   - Synthesize facts critically. Distinguish between established industry consensus and experimental proposals.
   - Quote relevant sections or data points when citing fetched content.

3. **Knowledge Evolution**:
   - For substantial findings or distinct sub-topics, invoke `create_subnode` to persist an explicit child node under the current parent branch.
   - Tag the branch with `branch_type="research"` so it integrates into the user's permanent knowledge graph.
