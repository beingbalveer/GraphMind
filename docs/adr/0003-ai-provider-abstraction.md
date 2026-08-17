# ADR-0003: AI Provider Abstraction (`packages/ai-core`)

- **Status:** Accepted (Frozen)
- **Date:** 2026-08-17
- **Deciders:** Founding Team / Architect

---

## Context and Problem Statement

Foundation models (OpenAI, Anthropic, Gemini, Ollama, OpenRouter) and LLM framework libraries evolve rapidly. Coupling backend application code directly to vendor SDKs (e.g., calling `openai.ChatCompletion.create` inside FastAPI router endpoints) creates strict vendor lock-in, brittle code, and testing friction.

---

## Decision Drivers

- GraphMind must be **AI-provider agnostic** from Day 1.
- Application logic must not break when swapping LLM foundation models or agent frameworks.
- Testing should be straightforward via mock provider implementations.

---

## Decision Outcome

**Chosen Option: Internal Abstraction Package (`packages/ai-core`).**

### Implementation Strategy:
1. Create `packages/ai-core` as an isolated internal Python package.
2. Define provider-agnostic interfaces (`BaseProvider`, `LLMConfig`, `StreamChunk`).
3. Implement model adapters inside `ai-core` (starting with OpenAI, followed by Anthropic, Ollama, etc.).
4. `apps/api` is strictly forbidden from importing foundation model SDKs directly; it only interacts through `packages/ai-core`.

---

## Consequences

### Positive:
- Seamlessly swap or combine AI foundation models without touching backend API routes.
- Easy offline unit testing via mock providers.
- Future-proof against framework changes in LangGraph or raw provider APIs.

### Negative:
- Minor initial boilerplate overhead when defining abstraction interfaces before implementing the first provider.
