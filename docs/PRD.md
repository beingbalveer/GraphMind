# Product Requirements Document (PRD) — GraphMind

---

## 1. Executive Summary

GraphMind is an open-source, AI-native knowledge workspace where conversations are represented as interactive, branching knowledge graphs. This document defines the functional, non-functional, and user experience requirements for the Minimum Viable Product (MVP) and future extensions.

---

## 2. Target Persona & Users

### Primary Users (MVP Target)
- **Software Engineers & AI Engineers**: Exploring complex software architectures, framework internals, or algorithmic concepts.
- **Backend & Systems Developers**: Seeking structured, provenance-backed technical research without losing context.
- **Technical Learners**: Students and engineers mastering complex technical topics through branching exploration.

### Future Personas
- Researchers, technical writers, domain analysts, and knowledge workers.

---

## 3. Product Scope

### 3.1 Included in MVP Scope
1. **User Authentication**: Secure signup/login with Email/Password, JWT access & refresh tokens, and OAuth 2.0 (Google & GitHub).
2. **Workspace Management**: Create, list, rename, delete, and load graph workspaces.
3. **AI Interaction & Question Answering**: Prompt box to ask questions; standard and streaming responses from AI foundation models.
4. **Node Generation**: Automatic transformation of prompt/response pairs into connected visual graph nodes.
5. **Graph Visualizer**: Interactive canvas (pan, zoom, drag nodes, layout auto-arrange) built with React Flow.
6. **Text Highlight Branching**: Select any substring inside a node's card to trigger a child prompt and spawn a new child branch.
7. **Node Context Continuation**: Branching retains parent node context so the LLM understands the exact lineage of the conversation.
8. **Workspace Persistence**: Graph nodes, edges, position layouts, and message history automatically persisted to PostgreSQL and Redis.

### 3.2 Explicit Non-Goals for MVP
- ❌ Multi-agent orchestrations / autonomous agent swarms (single chat agent for MVP).
- ❌ Real-time multi-user collaboration / multiplayer canvas.
- ❌ Plugin ecosystem / marketplace.
- ❌ Native Desktop (Tauri/Electron) or Mobile (iOS/Android) apps (Web-first MVP).
- ❌ Neo4j / Graph Database overhead (PostgreSQL with relational/JSON node-edge mapping is sufficient for MVP).
- ❌ Complex Knowledge Evolution engine (architecturally accommodated, but implemented post-MVP).

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
- **FR-3.3**: Streaming responses update the node content in real time as tokens arrive.

### FR-4: Highlight-to-Branch Interaction
- **FR-4.1**: User selects text within a rendered Markdown response node.
- **FR-4.2**: A contextual popover pill ("Branch from selection") appears above the highlight.
- **FR-4.3**: Clicking the pill opens a mini-prompt modal pre-filled with the highlighted text as context.
- **FR-4.4**: Submitting the sub-prompt generates a new child branch linked to the parent node at the specific highlight anchor.

### FR-5: Graph Canvas Navigation
- **FR-5.1**: Canvas pan, infinite canvas zoom (10% to 200%), and smooth drag-and-drop node positioning.
- **FR-5.2**: Auto-layout option (Dagre / ELK algorithm) to clean up messy graphs.
- **FR-5.3**: Minimap and zoom-to-fit controls.

---

## 5. Non-Functional Requirements (NFR)

### NFR-1: Performance & Latency
- **UI Responsiveness**: Canvas interactions (panning, dragging) must run at 60 FPS.
- **API Latency**: Time-To-First-Token (TTFT) for AI responses under 800ms (dependent on LLM provider).
- **Initial Load**: Workspace canvas and nodes must render in under 1.5 seconds.

### NFR-2: Observability & Logging
- Structured logging (JSON format) across FastAPI endpoints.
- Request ID tracing across API and AI Core requests.
- Latency and token usage metrics tracked per completion.

### NFR-3: Security
- OWASP Top 10 compliance.
- All database connections encrypted via TLS.
- API keys stored strictly in server-side environment variables, never exposed to client bundles.

---

## 6. Design & UX System

- **Aesthetics**: Professional, minimal, premium.
- **Visual References**: Clean layout inspired by Gemini, Linear, and Obsidian.
- **Color Theme**: Light mode first (clean white/gray surfaces, crisp typography), dark mode support added incrementally.
- **Typography**: Modern Google Fonts (e.g., Inter / Geist), precise line height, letter spacing, and explicit typographic hierarchy.
- **Visual Polish**: Micro-animations on node creation, fluid edge connections, no distracting colored borders or cliché pulsing badge pills.
