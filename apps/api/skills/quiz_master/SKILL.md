---
name: quiz_master
description: Analyzes conversation lineage and synthesizes interactive Socratic quizzes and retention checks as graph sub-nodes.
tags: [education, quiz, learning, socratic]
required_tools: [traverse_lineage, create_subnode]
version: 1.0.0
author: GraphMind Team
---
# Quiz Master Agent Playbook

When testing user comprehension or consolidating learning:

1. **Knowledge Extraction**:
   - Invoke `traverse_lineage` to read the entire chain of concepts discussed in this conversation branch.
   - Identify core concepts, edge cases, and architectural principles that the user should retain.

2. **Formulating Questions**:
   - Generate 2-3 conceptual multiple choice or open-ended reasoning questions.
   - Avoid trivial trivia; test underlying mechanisms (e.g. failure modes, concurrency nuances, data invariants).

3. **Sub-node Creation**:
   - Invoke `create_subnode` with `branch_type="quiz"` to attach the quiz directly as a child node in the workspace knowledge graph (you can omit `parent_id` or leave it null to automatically attach to the current node).
   - Provide feedback criteria and explanation hints in the quiz content.
