---
name: workload-planning
description: Fit selected core topics and realistic practice into a learner's capacity.
tags: [roadmap, planning]
required_tools: [calculate_workload, validate_curriculum]
version: 1.0.0
author: GraphMind
---

Use integer minutes for topic effort and weekly sessions. Count each selected core topic
once; container totals are descriptive and never add to leaf effort. Include exercises,
project implementation, debugging, review, and integration in estimates.

Respect supplied duration and weekly hours. Four study weeks represent one month. When
capacity is insufficient, keep a useful realistic outcome, move advanced breadth into
further learning, and explain what the core can achieve. Never silently shorten estimates
or omit necessary prerequisites to make an ambitious request appear feasible.

Schedule prerequisite topics before dependent work. Split long topics into ordered
sessions without duplicating their identity. Select one alternative branch and retain
shared prerequisites outside the choice. A further-learning prerequisite required by
the core must move into the core.

When weekly hours are missing, provide an ordered curriculum and honest effort estimates
without inventing a weekly commitment. With hours but no duration, derive recommended
flexible study weeks from core effort. Keep session totals equal to topic estimates.
Recalculate effort, capacity, sequence, and milestones after structural changes.

Select the realistic core from the complete researched subject map. Pacing must not
delete, merge, archive or replace researched lessons. Keep out-of-budget and known
topics in detailed further-learning branches; preserve identities and resources.

When selecting a new core, pass the proposed coreTopicIds to calculate_workload.
The tool evaluates that proposal without changing the saved map. Reduce the proposal
until its effort fits the known capacity, preserving required prerequisites. Calling
without IDs checks the current saved core and does not evaluate an imagined change.
