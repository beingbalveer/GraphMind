# Expert Panel Architecture Decisions

**Date:** 2026-09-19  
**Scope:** Cross-cutting architecture shared by the 40 plans in this directory  
**Status:** Accepted for planning; implementation still follows the approval gate in `AGENTS.md`

## Panel and method

Three independent expert agents inspected `docs/FEATURE_RESEARCH.md`, the current GraphMind repository, and relevant primary or official sources before voting:

1. **Learning Science and AI Product Architect** — learning evidence, mastery semantics, scheduler quality, learner safety.
2. **Backend, Data, and AI Systems Architect** — persistence, APIs, event processing, projections, reliability, and observability.
3. **Frontend, UX, Accessibility, and Platform Architect** — interaction contracts, low-latency reads, privacy boundaries, and extension surfaces.

Each expert voted independently on the same three questions. The maintainer decision below uses the majority where options were binary and records the minority view where service boundaries required synthesis.

## Decision 1 — Use a normalized, immutable learning-event ledger

**Question:** Should GraphMind use one normalized learning-event ledger or keep per-feature counters as the authoritative record?

| Expert | Vote | Key reason |
|---|---|---|
| Learning Science / Product | Shared ledger | Mastery and retention claims must be traceable to the learner actions that produced them. |
| Backend / Data / AI | Shared ledger | Replay, repair, audit, backfill, idempotency, and consistent analytics are not possible with unrelated mutable counters. |
| Frontend / Platform | Shared ledger | One event contract supports predictable projections and privacy/delete handling across web, mobile, IDE, and browser clients. |

**Vote:** 3–0 for the shared ledger.  
**Decision:** Add an append-only `learning_events` ledger as the source of evidence. Existing fields such as `times_quizzed`, `times_correct`, and `last_reviewed_at` become compatibility projections, not independent truth.

Minimum event envelope:

```text
id, schema_version, event_type, actor_user_id, workspace_id,
subject_type, subject_id, occurred_at_utc, recorded_at_utc,
result_json, context_json, idempotency_key, correlation_id,
privacy_classification, voided_by_event_id
```

Write the domain mutation, event, and outbox record in one database transaction. Consumers must be idempotent and checkpointed. Corrections append a compensating/voiding event; they do not rewrite history. This follows the durable learning-statement principle in the [ADL xAPI data specification](https://github.com/adlnet/xAPI-Spec/blob/master/xAPI-Data.md), while using a GraphMind-specific schema rather than claiming xAPI conformance. Event names are stable and low-cardinality, consistent with [OpenTelemetry event guidance](https://opentelemetry.io/docs/specs/semconv/general/events/).

Per-feature counters remain allowed only as rebuildable read models. Raw learner text, card answers, annotations, code selections, and fetched page content do not belong in the general event payload; store references and privacy-safe outcomes instead.

## Decision 2 — Serve mastery from a materialized projection

**Question:** Should mastery be computed on every request or served from a materialized read model?

| Expert | Vote | Key reason |
|---|---|---|
| Learning Science / Product | Materialized projection | Versioned projections make changes to evidence weights explainable and reversible. |
| Backend / Data / AI | Materialized projection | Canvas and dashboard reads require bounded latency and bulk retrieval. |
| Frontend / Platform | Materialized projection | A stable snapshot prevents visual flicker and inconsistent scores across surfaces. |

**Vote:** 3–0 for a materialized projection.  
**Decision:** Maintain indexed tables such as `node_mastery_projection` and `workspace_learning_summary`, updated asynchronously from the ledger and rebuildable by projection version.

This means a **projection table maintained incrementally**, not necessarily PostgreSQL `CREATE MATERIALIZED VIEW`. PostgreSQL materialized views persist query results, but a refresh replaces their contents; concurrent refresh also requires a qualifying unique index and permits only one refresh at a time ([PostgreSQL documentation](https://www.postgresql.org/docs/18/sql-refreshmaterializedview.html)). Incremental, checkpointed projection consumers better fit per-event updates and tenant-scoped repair.

Every read response exposes `projectionVersion`, `computedAt`, and optional `stale=true`. The UI may serve stale-but-labelled data during consumer lag. Rebuilds write a shadow version, compare counts/checksums/calibration, and switch only after parity gates pass.

## Decision 3 — Share the domain contract, separate deterministic scheduling

**Question:** Should activity selection and spaced review live in one service or separate services?

| Expert | Vote | Key reason |
|---|---|---|
| Learning Science / Product | Unified learning-activity domain, isolated FSRS module | “What next?” needs one policy, while scheduling math needs golden-vector isolation. |
| Backend / Data / AI | Unified activity/review orchestration | Digest, decay, queues, and session planning must not produce contradictory priorities. |
| Frontend / Platform | Separate bounded services | Security, privacy, failure isolation, and platform growth argue against a single overloaded service. |

**Vote:** 2–1 for unified orchestration, with unanimous support for isolating FSRS internals.  
**Decision:** Use one `ActivityReviewService` orchestration interface and event vocabulary, backed by separate modules:

- `FsrsScheduler`: deterministic card-state transitions only, version-pinned and tested against official golden vectors.
- `ReviewQueueService`: authorization, due-card queries, idempotent grading, and queue policy.
- `ActivityCandidateService`: quiz, gap, annotation, challenge, and new-topic candidates.
- `StudyPlannerService`: time-budget allocation across authorized candidates.
- `NotificationDigestService`: channel preferences, quiet hours, and delivery retries.

The orchestration layer may rank results from these modules but cannot reimplement their algorithms. FSRS explicitly models difficulty, stability, and retrievability and separates scheduling from optimization ([official FSRS documentation](https://github.com/open-spaced-repetition/awesome-fsrs/wiki/The-Algorithm)).

## Consequences for every implementation ticket

1. New learning mutations define a versioned ledger event and idempotency behavior.
2. User-facing aggregate reads use a projection with a freshness contract, not an unbounded request-time scan.
3. AI can propose or explain, but deterministic code enforces authorization, graph invariants, review intervals, scoring bounds, and state transitions.
4. Schema changes use reversible Alembic migrations; runtime `create_all` or ad hoc startup DDL is not an implementation path.
5. Background jobs use an outbox, retries with backoff, a dead-letter/replay path, structured logs, and measurable lag.
6. Privacy deletion either removes payload-bearing domain records or appends a privacy-safe void/tombstone event while preserving aggregate integrity.
7. Feature flags disable new writes/jobs before hiding reads, so users are not stranded during rollback.

## Rejected alternatives

- **Independent counters per feature:** fast initially, but cannot reconstruct why mastery changed, correct double writes, or safely change scoring rules.
- **Compute mastery on every canvas request:** simple for tiny workspaces, but latency and result consistency degrade as events and nodes grow.
- **One monolithic learning service:** centralizes policy but couples FSRS, notifications, social activity, AI exercises, and external clients into one failure/security boundary.
- **Fully separate services with no shared orchestration:** clean modules, but daily queue, digest, decay alerts, and study plans can recommend incompatible work.

