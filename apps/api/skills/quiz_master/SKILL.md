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
   - Generate 1-3 conceptual multiple choice questions testing retention and mechanism understanding.
   - Wrap each question in an interactive ````quiz code block formatted as JSON so the UI renders interactive quiz cards:
     ```quiz
     {
       "concept": "Name of the concept being tested",
       "question": "The specific question text",
       "options": [
         {"id": "A", "text": "First answer choice", "isCorrect": false},
         {"id": "B", "text": "Second answer choice", "isCorrect": true},
         {"id": "C", "text": "Third answer choice", "isCorrect": false},
         {"id": "D", "text": "Fourth answer choice", "isCorrect": false}
       ],
       "explanation": "Clear explanation explaining why the correct choice is accurate and why other options are incorrect."
     }
     ```
   - If generating multiple questions, you can format them as a JSON array `[...]` inside the ````quiz block or use multiple ````quiz blocks.

3. **Sub-node Creation**:
   - When appropriate, invoke `create_subnode` with `branch_type="quiz"` to attach the quiz directly as a child node in the workspace knowledge graph (you can omit `parent_id` or leave it null to automatically attach to the current node).
   - Provide feedback criteria and explanation hints in the quiz content.
