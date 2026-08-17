# ADR-0002: Modular Monolith Monorepo Architecture

- **Status:** Accepted (Frozen)
- **Date:** 2026-08-17
- **Deciders:** Founding Team / Architect

---

## Context and Problem Statement

When structuring a modern web application and backend for AI-native workloads, architectural decisions regarding repository organization (monorepo vs polyrepo) and service boundaries (microservices vs monolith) dictate operational complexity, developer velocity, and code quality.

---

## Decision Drivers

- Maintain high developer velocity and ease of setup (`docker-compose up`).
- Optimize for high code quality, strict typing, and shared schemas without over-engineering infrastructure.
- Avoid premature microservice complexity (distributed tracing overhead, deployment fragmentation).

---

## Considered Options

1. **Option A: Polyrepo with Microservices** (separate repos for web, api, ai-agent service, auth service).
2. **Option B: Monorepo with Modular Monolith** (`apps/web`, `apps/api`, `packages/ai-core`, `packages/shared`).
3. **Option C: Single Monolithic Framework** (Next.js with API routes handling both frontend and AI/DB logic).

---

## Decision Outcome

**Chosen Option: Option B — Monorepo with Modular Monolith.**

### Rationale:
- **Monorepo Layout**: Keeps frontend, backend, AI packages, and infrastructure definitions in a single repository for atomic commits and unified context.
- **FastAPI Backend (Modular Monolith)**: Python is the native ecosystem for AI/LLM tooling, data processing, and vector search. FastAPI provides asynchronous performance and auto-generated OpenAPI schemas.
- **Next.js Frontend**: Best-in-class React ecosystem for App Router, server components, and client-side canvas integrations (React Flow).

---

## Consequences

### Positive:
- Single command local environment startup.
- Clean separation between presentation (`apps/web`), API routes (`apps/api`), and AI logic (`packages/ai-core`).
- No distributed microservice tax during early milestone execution.

### Negative:
- Requires discipline to keep module boundaries clean within `apps/api`.
