# Product Requirements Document (PRD) & Manifesto — GraphMind

> **Knowledge is the product. Chat is only the interface.**

---

## 1. Product Manifesto & Vision

### 1.1 Why GraphMind Exists
Traditional AI chat interfaces force human thought into a narrow, linear thread. A single question leads to a response, creating a rigid stack of text where previous context gets buried, context windows degrade, and complex exploration becomes chaotic.

Humans do not think in single linear threads. Humans think in **networks of connected ideas**—branching off when a concept sparks curiosity, exploring sub-topics, synthesizing insights, and building a structured mental model over time.

**GraphMind** aligns AI interactions with human cognition. Instead of an ephemeral chat log, GraphMind turns every interaction into a **living knowledge graph** that grows, branches, and evolves alongside the user.

### 1.2 The Graph-First Workspace
In GraphMind, the graph is not a secondary tab or visual gimmick—it **is** the workspace:
- The initial prompt spawns the **root node** of a new graph.
- Every response from the AI becomes an **interactive node** linked to its parent.
- Highlighting text within any node allows the user to **branch out** into a focused sub-exploration.
- The user can zoom out to view their entire mental landscape or zoom in to inspect granular details.

### 1.3 Shift in the Unit of Interaction
| Traditional AI Chat | GraphMind |
| :--- | :--- |
| **Unit of Work:** Conversation Thread | **Unit of Work:** Knowledge Graph Node & Edge |
| Linear message stream | Multi-dimensional branching map |
| Ephemeral & context-degrading | Persistent & provenance-backed |
| Chatbot paradigm | Thought companion & knowledge workspace |

### 1.4 Core Product Principles
1. **Knowledge is the Product**: Success is measured by how effectively the user builds and retains structured understanding, not by message count.
2. **Chat is Only an Interface**: Messaging UI exists solely to feed and query the graph workspace.
3. **Natural Branching**: Any sentence, concept, or node can branch into a child investigation.
4. **AI Organizes Knowledge Automatically**: The user focuses on learning and asking; the AI categorizes, connects, and structures the graph topology behind the scenes.
5. **Data Ownership**: Users own their knowledge. Graph maps and content are saved locally or in user-controlled infrastructure in standard formats.
6. **Interfaces Over Implementations**: Core logic depends on abstractions, ensuring long-term adaptability as AI foundation models evolve.
7. **Simplicity Before Abstraction**: Build clean, unbloated, production-quality code. Avoid premature optimization or unnecessary architectural layers.
8. **Releasable Milestones**: Every milestone delivers a usable, observable, production-grade slice of the system.

---

## 2. Target Persona & Users

### Primary Users
- **Software Engineers & AI Engineers**: Exploring complex software architectures, framework internals, or algorithmic concepts.
- **Backend & Systems Developers**: Seeking structured, provenance-backed technical research without losing context.
- **Technical Learners**: Students and engineers mastering complex technical topics through branching exploration.

### Secondary Personas
- Researchers, technical writers, domain analysts, and knowledge workers.

---

## 3. Product Scope

### 3.1 Functional Capabilities
1. **User Authentication**: Secure signup/login with Email/Password, JWT access & refresh tokens, and OAuth 2.0 (Google & GitHub).
2. **Workspace Management**: Create, list, rename, delete, and load graph workspaces.
3. **AI Interaction & Question Answering**: Streaming responses from AI foundation models (Gemini, Anthropic, OpenAI, DeepSeek, local Ollama).
4. **Node Generation**: Automatic transformation of prompt/response pairs into connected visual graph nodes.
5. **Dual-Mode Workspace (Chat & Canvas)**:
   - **Canonical Chat View**: Fluid message stream, markdown rendering with KaTeX math and syntax highlighting, branch context cues, and inline follow-up actions.
   - **2D Spatial Canvas**: Interactive canvas powered by React Flow (`@xyflow/react` v12), custom mindmap nodes, bezier edges, and Dagre hierarchical auto-layout.
6. **Text Highlight Branching**: Select any substring inside a node or chat message to trigger a child prompt and spawn a new child branch.
7. **Context Lineage Traversal**: Ancestor traversal engine preserving parent context so the LLM understands conversation lineage without context bloating.
8. **Multimodal File Library & Viewers**: File attachments (PDF, Code, CSV/TSV/JSONL/Excel) with specialized in-app viewer modals.
9. **Knowledge State Modeling & Curator**: Mastery tracking, domain ontology DAG, gap analysis, and forward topic recommendations.
10. **Workspace Persistence**: Automatic asynchronous persistence to PostgreSQL (with `pgvector`) and Redis.

### 3.2 Non-Goals
- Real-time multi-user multiplayer canvas (planned for enterprise roadmap).
- Plugin ecosystem or external app marketplace.
- Native Desktop (Tauri/Electron) or Mobile apps (web-first responsive application).
- Neo4j or separate graph database overhead (PostgreSQL relational + JSON mapping is performant and sufficient).

---

## 4. Detailed Functional Requirements

### FR-1: Authentication & Authorization
- **FR-1.1**: Email & password authentication with secure password hashing (Argon2 / bcrypt).
- **FR-1.2**: Third-party OAuth 2.0 via Google and GitHub.
- **FR-1.3**: Stateless JWT Access Tokens (short-lived) and Refresh Tokens stored securely.

### FR-2: Workspace & Graph Lifecycle
- **FR-2.1**: User can create a new workspace with a title and optional description.
- **FR-2.2**: Opening a workspace loads the saved graph state (nodes, edges, positions, viewport state).
- **FR-2.3**: Autosave workspace state upon node addition, edge creation, or layout movement.

### FR-3: AI Prompting & Graph Node Creation
- **FR-3.1**: The first prompt in a workspace initializes the **Root Prompt Node**.
- **FR-3.2**: AI response generates a connected **Response Node** linked via a directed edge (`Root -> Response`).
- **FR-3.3**: Streaming responses update the node content in real time via Server-Sent Events (SSE).

### FR-4: Highlight-to-Branch Interaction
- **FR-4.1**: User selects text within a rendered Markdown response node or chat message.
- **FR-4.2**: A contextual popover pill ("Branch from selection") appears above the highlight.
- **FR-4.3**: Clicking the pill opens a prompt composer pre-filled with the highlighted text as context.
- **FR-4.4**: Submitting generates a new child branch linked to the parent node at the specific highlight anchor.

### FR-5: Graph Canvas Navigation & LOD
- **FR-5.1**: Canvas pan, infinite zoom (10% to 200%), and smooth drag-and-drop node positioning.
- **FR-5.2**: Adaptive Level-of-Detail (LOD):
  - **Galaxy View** (<0.6x): High-density circular knowledge orbs.
  - **Topic Capsule View** (0.6x - 1.2x): Horizontal topic summaries with avatars.
  - **Detailed View** (>1.2x): Metadata pills and branch counts.
- **FR-5.3**: Auto-layout option (Dagre algorithm) to eliminate node overlaps and recompute hierarchical layouts.
- **FR-5.4**: Focus Drawer for deep reading of any node with full Markdown, math, and follow-up prompting.

---

## 5. Non-Functional Requirements (NFR)

### NFR-1: Performance & Latency
- **UI Responsiveness**: Canvas panning and dragging run smoothly at 60 FPS.
- **API Latency**: Time-To-First-Token (TTFT) for AI responses under 800ms.
- **Initial Load**: Workspace canvas and nodes render in under 1.5 seconds.

### NFR-2: Observability & Logging
- Structured JSON logging across FastAPI backend endpoints.
- Request ID tracing across API and AI Core requests.
- Latency and token usage metrics tracked per completion.

### NFR-3: Security
- OWASP Top 10 compliance.
- All database connections encrypted via TLS.
- API keys stored strictly in server-side environment variables, never exposed to client bundles.

---

## 6. Design & UX System (GraphMind Calm)

- **Aesthetics**: Clean, quiet surfaces, restrained indigo brand accent, clear reading hierarchy, subtle graph identity.
- **Design Primitives**: Strict adherence to `@/components/ui/` shared primitives (`Button`, `Input`, `Modal`, `Drawer`, `SegmentedTabs`, `Badge`, `DropdownMenu`).
- **Design Tokens**: Semantic CSS tokens (`bg-background`, `bg-surface`, `text-foreground`, `border-border`) without hardcoded palette literals.
- **Dark Mode**: Full native light and dark theme parity.
- **Typography Scale**: Standard scale (`text-2xs`, `text-xs`, `text-sm`, `text-base`, `text-lg`, `text-xl`).
- **Accessibility**: Keyboard navigation, ARIA attributes, visible focus indicators, and `prefers-reduced-motion` compliance.
