# ADR-0005: Milestone-Driven Execution Strategy

- **Status:** Accepted (Frozen)
- **Date:** 2026-08-17
- **Deciders:** Founding Team / Architect

---

## Context and Problem Statement

Open-source projects frequently suffer from scope creep, abandoned rewrites, and over-engineering before delivering a working product. We need an execution strategy that ensures steady shipping cadences, high code quality, and clear milestone completion.

---

## Decision Drivers

- Maintain steady visible progress (releasable increments every 2–3 days).
- Prevent scope creep from distracting current development focus.
- 80% shipping / 20% planning balance.

---

## Decision Rules & Outcome

1. **Strict Milestone Boundaries**: Features outside the active milestone scope are deferred to the `ROADMAP.md` backlog.
2. **No Mid-Milestone Rewrites**: Architecture changes during an active milestone are forbidden unless a critical blocker is proven by empirical logs.
3. **Releasable Increments**: Every milestone must result in a runnable, observable system slice.
4. **Demonstrable Senior Engineering**: Prioritize unit tests, type safety, structured logs, and documentation over hacky shortcuts.

---

## Consequences

### Positive:
- High momentum and tangible progress.
- Clean git history with clear release tags per milestone (`M0`, `M1`, `M2`, etc.).
- Keeps codebase unbloated and maintainable.
