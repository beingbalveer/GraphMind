# GraphMind — Post-MVP Feature Research & Ideation

> Deep research into features that improve ease of use, apply advanced learning science, improve retention, and evolve GraphMind into the definitive AI-native learning platform.

---

## Context: Where GraphMind Stands Today

All 6 core phases are **complete**:
- ✅ Streamed AI Chat Engine
- ✅ Tree-Structured Branching + Lineage Traversal
- ✅ Spatial Graph Canvas (React Flow, Dagre, mindmap)
- ✅ Workspace Persistence (PostgreSQL, Redis)
- ✅ Semantic Graph & Vector Discovery (pgvector)
- ✅ Multi-Agent Knowledge Evolution (tool-calling, skills, web grounding)

The MVP is a **graph-first AI knowledge workspace**. The product turns every conversation into a living, branching knowledge map. Now it needs features that make it a *serious learning platform*.

---

## Research Foundations

### Learning Science Consensus (2025)
The most effective techniques for long-term knowledge retention:
1. **Active Recall** — Retrieving information from memory without cues (vs. passive re-reading)
2. **Spaced Repetition** — Reviewing material at scientifically-timed intervals (FSRS algorithm outperforms SM-2 by 20–30% fewer reviews)
3. **Interleaving** — Mixing topics/problem types in a session vs. massed "blocking" practice
4. **Elaborative Interrogation** — Asking "why" and "how" about concepts to build schema connections
5. **The Feynman Technique** — Teaching a concept in simple language to expose gaps
6. **Retrieval Practice** — Self-testing as a learning tool (not just assessment)

---

## Feature Categories

---

## 🧭 Category 1: Intelligent Learning Roadmap Engine

> These features make GraphMind the starting point for any learning journey — not just a place to ask questions.

### 1.1 — "Start Learning X" Roadmap Generator
**What it does:** User types a goal (e.g., "I want to learn Rust", "I want to become a backend engineer", "Master System Design for FAANG"). The AI generates a structured, graph-native learning roadmap automatically.

**How it works on GraphMind:**
- AI decomposes the goal into a prerequisite-ordered topic tree
- Each topic becomes a **graph node** with dependencies as **edges**
- Nodes are tagged: `beginner`, `intermediate`, `advanced`, `prerequisite`
- User can start learning any unlocked node immediately by clicking and asking questions

**Learning Science:** Topological ordering of prerequisites — learners build solid foundations before advancing.

**Why it drives retention:** The user has a *visual destination* on the canvas. They see their progress spatially — not just a progress bar.

---

### 1.2 — Prerequisite Gate System
**What it does:** Nodes show as `locked` until the user demonstrates competency in prerequisite topics (via a short quiz or self-assessment).

**Visual design:** Locked nodes appear dimmed with a lock icon. Completing a prerequisite "unlocks" child nodes with a satisfying animation.

**Learning Science:** Prevents learners from skipping foundational knowledge — a core failure mode in self-directed learning.

---

### 1.3 — Career Path Templates
**What it does:** Pre-built roadmap templates for popular learning goals:
- Backend Engineer → Python → FastAPI → PostgreSQL → System Design
- AI Engineer → Math Foundations → ML → LLMs → RAG → Agents
- Full Stack → HTML/CSS → React → Node.js → Databases → Deployment
- Data Scientist → Statistics → Python → Pandas → ML → Deep Learning

User picks a template, the system generates the graph, and they customize it.

**Why it's important:** Reduces the "blank canvas problem" — users don't know where to start. Templates give them an instant roadmap.

---

### 1.4 — Dynamic Gap Analysis
**What it does:** AI continuously analyzes the user's conversation history and knowledge graph to identify gaps — topics they've explored shallowly vs. deeply.

**Visualization:** A **Mastery Heatmap** overlay on the graph canvas:
- 🔴 Red nodes = not explored or weak
- 🟡 Yellow nodes = partially understood
- 🟢 Green nodes = deeply explored and tested

**Learning Science:** Gap analysis is the engine of adaptive learning — the system prioritizes what matters most next.

---

## 🧠 Category 2: Active Recall & Spaced Repetition System

> The most evidence-backed learning science, natively integrated into the graph.

### 2.1 — Node-Linked Flashcard Generation
**What it does:** For any response node on the graph, the user (or AI) can generate flashcards directly from the content.

**Trigger:** Right-click a node → "Generate Flashcards" → AI extracts 5–10 Q&A pairs from the node content.

**Integration:** These cards are stored and linked back to their source node. When reviewing a card, clicking "Go to source" navigates the canvas to that node.

**Why it matters:** Flashcards are the gold standard for active recall. Linking them to the graph closes the loop between learning and review.

---

### 2.2 — FSRS-Powered Spaced Repetition Scheduler
**What it does:** The platform uses the **FSRS (Free Spaced Repetition Scheduler)** algorithm — the modern successor to Anki's SM-2 — to schedule when each flashcard or concept should be reviewed.

**Daily Review Queue:** Users see a "Review Today" count in the sidebar. Opening it shows today's due cards. After reviewing, the system schedules the next review (could be 1 day, 3 days, 2 weeks, 1 month).

**Metrics tracked:** Per-card difficulty rating, stability (how long the memory lasts), retrievability (probability of recall at review time).

**Learning Science:** Spaced repetition is scientifically proven to be the most time-efficient memorization technique. FSRS requires 20–30% fewer reviews than older algorithms.

---

### 2.3 — In-Canvas Quick Quiz Mode
**What it does:** User clicks any node → selects "Quiz Me on This" → AI generates 3–5 retrieval questions from that node's content and surrounding context (parent/sibling nodes for interleaving).

**Format options:**
- Multiple choice
- Fill-in-the-blank
- Open-ended (user types answer, AI grades it)
- True/False

**After the quiz:** The node gets a "mastery score" that updates the Mastery Heatmap overlay.

**Learning Science:** Active recall via self-testing is more effective than re-reading. Interleaving related nodes in the quiz mimics real exam conditions.

---

### 2.4 — Feynman Mode ("Teach It Back")
**What it does:** User selects a node and clicks "Explain This Like I'm 5". They type their own explanation. The AI then:
1. Identifies what they got right
2. Flags where they used jargon without understanding
3. Points out gaps
4. Asks follow-up probing questions

**The loop:** User refines their explanation until the AI confirms they truly understand it.

**Learning Science:** The Feynman Technique is one of the most powerful deep-understanding tools. Forcing simple language exposes fluency illusions.

---

### 2.5 — "What Have I Forgotten?" Decay Alerts
**What it does:** Using FSRS stability models, the system detects which previously-explored nodes are now "at risk of forgetting" (retrievability below 70%). It surfaces these as a gentle daily nudge.

**UI:** A small "Review" badge on the node in the canvas + a notification: "You haven't revisited [Closures in JavaScript] in 14 days. Quick review?"

**Learning Science:** Forgetting curves are predictable. Proactive re-engagement before forgetting occurs is far more efficient than re-learning from scratch.

---

## 📊 Category 3: Progress & Mastery Visualization

> Users need to *feel* and *see* their growth. This category makes progress tangible.

### 3.1 — Mastery Heatmap Overlay
**What it does:** A toggle on the graph canvas that overlays a color-coded "mastery temperature" on each node, derived from:
- How many questions the user asked about it
- Quiz performance on that node
- Spaced repetition ratings
- Time since last interaction

**Color scale:** Cold (🔵 unexplored) → Cool (🟡 familiar) → Warm (🟠 practiced) → Hot (🔴 mastered)

**Why it's powerful:** The graph becomes a **live cognitive map** — users can instantly see where they're strong and where the gaps are.

---

### 3.2 — Daily & Weekly Learning Dashboard
**What it does:** A dedicated "Learning Stats" page showing:
- **Today's session:** Topics covered, questions asked, flashcards reviewed
- **Weekly graph:** Learning consistency (like GitHub contribution graph)
- **Mastery progression:** Concepts that moved from "unfamiliar" to "practiced" this week
- **Time to review:** How many flashcards are due today vs. overdue

**Retention driver:** Making progress visible creates a positive feedback loop. Users who see consistent small wins are far more likely to return.

---

### 3.3 — Streak & Consistency Tracker
**What it does:** Daily learning streaks (like Duolingo) tied to meaningful actions, not just logins:
- ✅ Explored at least 1 new node
- ✅ Reviewed due flashcards
- ✅ Completed 1 quiz

**Streak protection:** "Streak freeze" mechanic — 1 free freeze per week. Plus a weekly goal summary email.

**Why it matters:** Streaks create habit loops. Skill-based streaks (not just "you logged in") create deeper intrinsic motivation.

---

### 3.4 — Knowledge Timeline / Session History
**What it does:** A chronological "Learning Journal" view that shows how the graph evolved over time:
- Day 1: Explored [What is a Promise?]
- Day 3: Branched into [Event Loop] and [Microtask Queue]
- Day 5: Revisited and quizzed [Promises] — scored 80%
- Day 10: Connected [Async/Await] as an extension

**Why it matters:** Users can see the *journey* of their understanding growing. This narrative is deeply motivating and builds identity ("I'm the kind of person who learns systematically").

---

## 🔍 Category 4: Smart Discovery & Exploration

> Features that help users explore topics they don't know they need to know.

### 4.1 — "Explore Related Concepts" Auto-Suggestions
**What it does:** After any AI response, the system suggests 3–5 related concepts the user hasn't explored yet, displayed as **ghost nodes** on the canvas edge.

**Example:** After exploring "React Hooks" → suggests [Custom Hooks], [useReducer vs useState], [React Context API], [React.memo & Performance]

**How it works:** Uses pgvector embeddings (already built in Phase 5) to find semantically related unexplored nodes from the user's knowledge base.

**Learning Science:** Deliberate exposure to adjacent concepts builds a richer schema — the hallmark of expert knowledge vs. novice knowledge.

---

### 4.2 — Cross-Workspace Concept Linking
**What it does:** When a concept appears in multiple workspaces (e.g., "async/await" appears in both a JavaScript workspace and a Python workspace), the system surfaces the connection:

> "You've already explored this concept in your JavaScript workspace. View your notes?"

**Why it's powerful:** Schema building across domains is how experts think. Connecting the same idea across contexts dramatically improves understanding and retention.

---

### 4.3 — "Rabbit Hole" Depth Tracker
**What it does:** On any node, shows the "exploration depth":
- Surface (1–2 questions asked)
- Moderate (3–5 questions, 1–2 branches)
- Deep (5+ questions, multiple branches, quiz completed)
- Mastered (deep + spaced repetition passed)

A subtle depth indicator icon on each node.

**Why it matters:** Guides users to know when they've gone deep enough vs. when they're skimming. Prevents the "false confidence" trap.

---

### 4.4 — Web-Grounded Topic Enrichment (already partially built)
**What it does:** Using the existing web grounding tool, extend it so that clicking "Enrich This Node" auto-fetches:
- Recent articles on the topic
- Official documentation summaries
- Real-world examples and use cases

Appended as a sub-branch on the node, clearly labeled [Web Source].

---

## 🎓 Category 5: Active Learning Exercises

> Move beyond passive reading. Every topic should be learnable through *doing*.

### 5.1 — Code Challenge Node Type
**What it does:** For technical topics, the AI can generate an in-canvas code challenge:
- **Problem statement**
- **Starter code**
- **AI-powered code review** (user submits code → AI explains what's right/wrong)

Node type: `challenge` (distinct visual from regular response nodes — coded in orange/amber).

**Learning Science:** Practice problems with feedback are orders of magnitude more effective than reading alone.

---

### 5.2 — Analogy Builder
**What it does:** User clicks "Explain with an Analogy" on any node. AI generates 2–3 different analogies for the concept targeting different backgrounds:
- "If you know cooking..."
- "If you know music..."  
- "If you know construction..."

User can vote which analogy resonated, helping the AI learn their mental model.

**Learning Science:** Analogical reasoning activates existing schema and dramatically reduces cognitive load for abstract concepts.

---

### 5.3 — Socratic Dialogue Mode
**What it does:** Instead of giving an answer, the AI asks a series of guided Socratic questions to help the user discover the answer themselves.

**Triggered by:** "Socratic Mode" toggle in node context menu, or `/socratic` prefix in prompts.

**Example:**
- User: "Explain database indexing"
- AI (Socratic): "Before I explain, tell me — what happens when you search for a name in a phone book? How do you find it quickly without reading every entry?"

**Learning Science:** Discovery-based learning leads to deeper encoding than direct instruction. Knowledge constructed by the learner is more durable.

---

### 5.4 — Concept Comparison Challenge
**What it does:** User selects 2 nodes → clicks "Compare These" → AI generates a structured side-by-side comparison with fill-in-the-blank exercises.

**Example:** Compare [REST API] vs. [GraphQL] → user fills in blanks about when to use each, tradeoffs, etc.

**Learning Science:** Comparative analysis is one of the highest-order thinking skills (Bloom's taxonomy). It forces the brain to deeply process both concepts simultaneously.

---

## 🔄 Category 6: Revision & Memory Consolidation

> Long-term retention requires structured revisiting, not just initial learning.

### 6.1 — "Revision Mode" — Daily Digest
**What it does:** Every day, GraphMind sends a "Daily Learning Digest" (email or in-app notification) containing:
- 3 concepts due for spaced repetition review
- 1 quiz from yesterday's learning
- 1 "did you know?" insight connecting two concepts the user knows

**Design:** Dead-simple — a 5-minute daily habit that compounds over months.

---

### 6.2 — Node Annotation & Personal Notes
**What it does:** Users can add their own annotations (sticky notes, highlights, personal explanations) directly onto any node.

**Types:**
- 📝 Personal note (freeform text)
- 💡 Personal insight ("This is like X that I learned before")
- ⚠️ Confusion flag ("I'm still not clear on why this works")
- ✅ Mastery mark ("I can explain this confidently")

**Why it matters:** Self-generated notes are far more effective for retention than AI-generated text. Forcing the user to write *in their own words* is itself an active recall exercise.

---

### 6.3 — "Explain It Again Differently" Regeneration
**What it does:** On any response node, user can click "Re-explain with a different angle" choosing from:
- Simpler language
- More technical depth
- With code examples
- With a visual/diagram description
- As a step-by-step tutorial

Each re-explanation spawns a sibling node (not a replacement), so the original is preserved.

**Learning Science:** Multiple representations of the same concept (verbal, visual, procedural) create richer, more interconnected memory traces.

---

### 6.4 — Study Session Planner
**What it does:** User specifies: "I have 30 minutes today. What should I study?"

The AI generates a structured micro-session plan:
1. Review 2 due flashcards from [JavaScript Promises] (5 min)
2. Read the newly generated node on [Async/Await] (10 min)
3. Take a quick quiz on [Event Loop] (5 min)
4. Explore one new concept: [Promise.all vs Promise.race] (10 min)

**Why it matters:** Removes decision fatigue. Users who have a plan are significantly more likely to complete a session.

---

## 🤝 Category 7: Ease of Use & UX Improvements

> Frictionless UX is itself a retention strategy.

### 7.1 — Onboarding Goal Setting Flow
**What it does:** First-time users answer 3 questions:
1. What do you want to learn? (Free text or category picker)
2. What's your current level? (Beginner / Intermediate / Advanced)
3. How much time per day? (15 / 30 / 60 mins)

From these answers, GraphMind generates their **first roadmap workspace** automatically — giving them immediate value in < 2 minutes.

**Retention impact:** Time-to-first-value is the #1 predictor of user retention. Users who get value in session 1 return for session 2.

---

### 7.2 — Keyboard-First Navigation
**What it does:** Full keyboard navigation for power users:
- `Space` = Open prompt on selected node
- `Tab` = Navigate between nodes
- `Ctrl+Q` = Quick quiz on selected node
- `Ctrl+F` = Generate flashcards
- `Ctrl+R` = Open revision queue
- `/` = Focus search

**Why it matters:** Power users who can navigate without a mouse will use the platform 2–3x more per session.

---

### 7.3 — Smart Context-Aware Prompting
**What it does:** The prompt box becomes intelligent. As the user types, it suggests:
- Related questions other learners asked about this topic
- Branching directions based on their current graph state
- Quick actions: "Quiz me", "Summarize this branch", "Generate flashcards"

**UI:** Below the prompt box, 2–3 smart suggestion chips appear contextually.

---

### 7.4 — Node Collapse / Expand & Graph Minimap
**What it does:** Large graphs become overwhelming. Add:
- **Node groups**: Collapse a subtree into a summary node
- **Focus mode**: Dim everything except the selected branch
- **Smart minimap**: Highlight unexplored zones in a different color

**Why it matters:** Graph cognitive overload is a real UX problem. Progressive disclosure keeps the canvas navigable as the graph grows.

---

### 7.5 — Import & Export Ecosystem
**What it does:**
- **Import:** Paste a YouTube URL, PDF, article, or GitHub README → AI extracts key concepts and seeds the graph
- **Export:** Download as:
  - Markdown outline (Obsidian-compatible)
  - PDF study guide
  - Anki flashcard deck (.apkg)
  - Mermaid diagram

**Why it matters:** Users who can bring their existing materials in — and take their knowledge out — have a much stronger value perception of the platform.

---

## 👥 Category 8: Social & Community Features (Future)

> Retention skyrockets when learning is social.

### 8.1 — Public Roadmap Gallery
**What it does:** Users can publish their learning roadmap workspaces as public templates. Other users can fork them (copy to their own workspace and customize).

**Examples:** "My roadmap to learning Rust" · "System Design Interview Prep" · "Machine Learning from scratch"

**Why it matters:** User-generated content creates a flywheel — content creators get recognition, consumers get free roadmaps, platform gets stickiness.

---

### 8.2 — Study Buddy Pairing
**What it does:** Two users studying the same topic can link their workspaces. They see each other's "recently explored" nodes (anonymized as "your study buddy explored this too") and can leave notes for each other.

**Privacy:** Fully opt-in. Specific content is never shared — only node titles and exploration patterns.

---

### 8.3 — Weekly Learning Challenges
**What it does:** Platform-wide weekly challenges:
- "This week: Master the basics of Docker" — with a shared starter roadmap
- Users who complete the challenge earn a badge

**Retention:** Community momentum and shared goals are powerful FOMO/motivation drivers.

---

## 🤖 Category 9: Advanced AI-Native Features

> Features only possible because GraphMind has a living AI-native knowledge graph.

### 9.1 — Auto-Curriculum Generator
**What it does:** Given a **goal** and a **deadline** (e.g., "I want to pass the AWS Solutions Architect exam in 60 days"), the AI generates:
- A day-by-day study plan
- Mapped onto the graph as a time-stamped roadmap
- Daily "unlock" — each day reveals new nodes to explore

**Why it's unique to GraphMind:** No other platform can generate a goal-based curriculum that is also a living, explorable graph.

---

### 9.2 — Knowledge Curator Agent
**What it does:** A background agent that periodically:
- Reviews the user's entire knowledge graph
- Identifies unconnected isolated nodes (concepts learned but never linked to others)
- Suggests connections: "Your understanding of [Closures] connects to [React useCallback] — want me to create a link?"
- Flags shallow explorations that need deepening

**Output:** Weekly "Knowledge Report" card with insights and recommendations.

---

### 9.3 — Debate Mode
**What it does:** User selects a controversial or nuanced topic node → clicks "Debate This" → The AI presents two opposing viewpoints on the topic, then asks the user to argue for one side.

**Example:** [Microservices vs. Monolith] → User argues for monolith → AI steelmans the microservices position → User must rebut.

**Learning Science:** Argumentation is one of the highest-order cognitive skills. It forces synthesis, not just recall.

---

### 9.4 — Concept Prerequisite Validator
**What it does:** Before the user asks about an advanced topic, the AI checks if they have the prerequisites in their knowledge graph. If not:

> "To fully understand [Kubernetes Operators], you'll need to understand [Custom Resource Definitions] and [Controller Pattern] first. Want me to build those nodes?"

**Why it's unique:** The graph knows what the user knows. No other chat platform has this context.

---

## 📱 Category 10: Platform & Ecosystem Expansion

### 10.1 — Mobile-Responsive Review Mode
**What it does:** A simplified mobile view (no graph canvas — just the flashcard queue and today's review tasks). Users can do their daily spaced repetition review from their phone on the commute.

**Why it matters:** Spaced repetition only works if reviews happen consistently. Mobile access removes the biggest friction point.

---

### 10.2 — VS Code Extension
**What it does:** While coding, user highlights a confusing function → right-click → "Explain in GraphMind" → creates a node in their active workspace explaining the concept, linked to the file and line number.

**Context:** Developers learn in their IDE. Bringing GraphMind into the IDE removes the context-switch barrier.

---

### 10.3 — Browser Extension (Web Clipper)
**What it does:** While reading any article or documentation page, user can:
- Highlight text → "Add to GraphMind" → creates a node in their active workspace
- "Generate Roadmap from this page" → extracts key concepts as a graph

**Why it matters:** Integrates GraphMind into the natural learning flow (reading docs, articles, Stack Overflow).

---

## Priority Matrix

| Feature | Learning Science Impact | Retention Impact | Ease of Build | Priority |
|---|---|---|---|---|
| Roadmap Generator ("Start Learning X") | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | Medium | 🔴 P0 |
| FSRS Spaced Repetition + Flashcards | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | Medium | 🔴 P0 |
| In-Canvas Quiz Mode | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | Medium | 🔴 P0 |
| Mastery Heatmap Overlay | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | Medium | 🔴 P0 |
| Onboarding Goal Setting Flow | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | Easy | 🔴 P0 |
| Feynman Mode (Teach It Back) | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | Easy | 🟠 P1 |
| Daily Revision Digest | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | Easy | 🟠 P1 |
| Career Path Templates | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | Easy | 🟠 P1 |
| Node Annotations & Personal Notes | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | Easy | 🟠 P1 |
| Streak & Consistency Tracker | ⭐⭐ | ⭐⭐⭐⭐⭐ | Easy | 🟠 P1 |
| Explore Related Concepts (Ghost Nodes) | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | Medium | 🟠 P1 |
| Study Session Planner | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | Medium | 🟡 P2 |
| Socratic Dialogue Mode | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | Easy | 🟡 P2 |
| Code Challenge Node Type | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | Hard | 🟡 P2 |
| Knowledge Curator Agent | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | Medium | 🟡 P2 |
| Decay Alerts ("What Have I Forgotten") | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | Medium | 🟡 P2 |
| Public Roadmap Gallery | ⭐⭐ | ⭐⭐⭐⭐⭐ | Hard | 🔵 P3 |
| Auto-Curriculum Generator | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | Hard | 🔵 P3 |
| Mobile Review Mode | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | Hard | 🔵 P3 |
| VS Code Extension | ⭐⭐⭐ | ⭐⭐⭐⭐ | Very Hard | 🔵 P3 |
| Browser Web Clipper | ⭐⭐⭐ | ⭐⭐⭐⭐ | Hard | 🔵 P3 |
| Debate Mode | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | Easy | 🔵 P3 |

---

## Recommended Phase 7: "GraphMind Learning Engine"

Based on the research, the highest-impact next phase should combine:

1. **Roadmap Generator** — transforms GraphMind from a knowledge workspace into a learning platform entry point
2. **Flashcard System + FSRS** — adds the gold standard of memory science to every graph node
3. **Quiz Mode** — turns passive exploration into active retrieval practice
4. **Mastery Heatmap** — makes progress visible and motivating
5. **Goal Setting Onboarding** — ensures new users get value in < 2 minutes

This phase would make GraphMind a **complete learning system** — not just an AI chat tool.

---

*Research conducted September 2026 · Sources: Cognitive science literature, EdTech platform analysis (Anki, Duolingo, Coursera, RemNote, Notion AI), knowledge graph learning systems research, FSRS algorithm documentation.*
