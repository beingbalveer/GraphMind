# Learning Studio Integration Handoff

## Current position — 2026-10-15

- Active ticket: none
- Completed tickets: `LSI-001` (DONE — evidence in `docs/integration/evidence/LSI-001.md`), `LSI-002` (DONE — evidence in `docs/integration/evidence/LSI-002.md`), `LSI-003` (DONE — evidence in `docs/integration/evidence/LSI-003.md`), `LSI-004` (DONE — evidence in `docs/integration/evidence/LSI-004.md`), `LSI-005` (DONE — evidence in `docs/integration/evidence/LSI-005.md`), `LSI-006` (DONE — evidence in `docs/integration/evidence/LSI-006.md`), `LSI-007` (DONE — evidence in `docs/integration/evidence/LSI-007.md`), `LSI-008` (DONE — evidence in `docs/integration/evidence/LSI-008.md`), `LSI-009` (DONE — evidence in `docs/integration/evidence/LSI-009.md`), `LSI-010` (DONE — evidence in `docs/integration/evidence/LSI-010.md`), `LSI-011` (DONE — evidence in `docs/integration/evidence/LSI-011.md`), `LSI-012` (DONE — evidence in `docs/integration/evidence/LSI-012.md`), `LSI-013` (DONE — evidence in `docs/integration/evidence/LSI-013.md`), `LSI-014` (DONE — evidence in `docs/integration/evidence/LSI-014.md`), `LSI-015` (DONE — evidence in `docs/integration/evidence/LSI-015.md`), `LSI-016` (DONE — evidence in `docs/integration/evidence/LSI-016.md`), `LSI-017` (DONE — evidence in `docs/integration/evidence/LSI-017.md`), `LSI-018` (DONE — evidence in `docs/integration/evidence/LSI-018.md`), `LSI-019` (DONE — evidence in `docs/integration/evidence/LSI-019.md`), `LSI-020` (DONE — evidence in `docs/integration/evidence/LSI-020.md`), `LSI-036` (DONE — evidence in `docs/integration/evidence/LSI-036.md`), `LSI-021` (DONE — evidence in `docs/integration/evidence/LSI-021.md`), `LSI-025` (DONE — evidence in `docs/integration/evidence/LSI-025.md`), `LSI-033` (DONE — evidence in `docs/integration/evidence/LSI-033.md`), `LSI-035` (DONE — evidence in `docs/integration/evidence/LSI-035.md`), `LSI-038` (DONE — evidence in `docs/integration/evidence/LSI-038.md`), `LSI-040` (DONE — evidence in `docs/integration/evidence/LSI-040.md`)
- Next ticket: `LSI-022` (READY — Owned job creation, status, and result; unblocked by LSI-021). Also newly unblocked by this batch: `LSI-026`, `LSI-027` (via LSI-025), `LSI-034` (via LSI-033), `LSI-041`/`LSI-042` after their remaining deps.
- Branch: `codex-learning-studio-backend-integration`
- Baseline commit: `6045bcf` (wave-1 docs checkpoint; baseline for wave 2)
- Completion commit: `4768ff8` (LSI-040, last of the LSI-021/025/033/035/038/040 batch)
- Batch completion SHAs: LSI-021 `b01be23`, LSI-025 `1eb5c0b`, LSI-033 `b495c96`, LSI-035 `9d8d213`, LSI-038 `7a1c197`, LSI-040 `4768ff8`
- Last completed work: Parallel wave 2 — LSI-021 (goal form/profile review), LSI-025 (public snapshot model + migration `20261015_0007`), LSI-033 (files/attachments parity), LSI-035 (flashcards cross-surface parity), LSI-038 (branch promotion parity), LSI-040 (workspace management)
- Files changed in this task: `apps/web/src/lib/generatorProfile.ts`, `apps/web/src/components/studio/StudioGoalForm.tsx`, `apps/web/src/lib/roadmapTypes.ts`, `apps/web/src/app/studio-preview/page.tsx`, `apps/api/src/schemas/public.py`, `apps/api/src/models/public_snapshot.py`, `apps/api/src/models/__init__.py`, `apps/api/src/services/roadmap/public_snapshots.py`, `apps/api/alembic/versions/20261015_0007_add_public_snapshots.py`, `apps/web/src/components/workspace/WorkspaceDashboard.tsx`, `apps/web/src/lib/workspaceApi.ts`, plus new tests and `docs/integration/evidence/LSI-021/025/033/035/038/040.md`
- Runtime files changed in this task: see above (web goal form + workspace dashboard + types; backend public snapshot model/schema/service + migration)
- Verification in this task: full web vitest `511/511 passed` (95 files, up from 481/90); `pnpm --filter web typecheck` 0 errors; full backend suite `565 passed, 5 failed`; single alembic head `20261015_0007`. All 5 backend failures are pre-existing/unrelated: 4 `test_tool_execution.py` monkeypatch-leak failures (reproduced at baseline `b3e15d4`), and 1 load-sensitive `test_worker.py::test_expired_worker_discards_stage_after_new_fence` race (worker heartbeat renews the lease on the real clock while the test advances a mock clock; passes in isolation and at the wave-1 full-suite baseline — not caused by the changed modules, which never touch worker/claim/heartbeat code).
- Runtime approval: Blanket user approval for backlog sequence recorded on 2026-10-15 ("i am approving all. i will review at the end. please complete all"), reconfirmed 2026-10-15 as explicit authorization to implement the remaining backlog in parallel with a GPT-6.1 review at the end
- Last completed step: Implemented, integrated, verified (full suite) and committed wave 2 (LSI-021/025/033/035/038/040); refreshed the status board (LSI-021/025/033/035/038/040 now DONE) and this handoff
- Exact next action: Continue with LSI-022 (Owned job creation, status, and result), then LSI-026/027/034 and the rest of the dependency chain.
- Pending command/session: none
- Commands run and actual results: `pnpm --filter web test` (511 passed), `pnpm --filter web typecheck` (0 errors), `pytest apps/api/tests` (565 passed, 5 pre-existing/unrelated failures), `alembic heads` (single head `20261015_0007`).

For each approved ticket, record the user approval source, date, and precise scope here. Preserve it across interruptions for that same scope.

## Checkpoint template

Copy and update this block after each meaningful step or test result:

```text
Active ticket/status:
Approval source/date/scope:
Branch and current commit (read from git):
Last completed step:
Files changed:
Commands run and actual results:
Tests completed and remaining:
Pending command/session/output/error:
Decisions and blockers:
Exact next action:
```

## Resume procedure

Read [the backlog](./LEARNING_STUDIO_BACKLOG.md), [the work protocol](./README.md), [AGENTS.md](../../AGENTS.md), [the URL contract](../URL_DESIGN.md), and [the prototype handoff](../../apps/web/prototype/BACKEND_HANDOFF.md). Then inspect `git status --short --branch` and the current commit. Continue the active `IN_PROGRESS` or `VERIFYING` ticket first, preserving recorded approval for its scope and approach. If no ticket is active, use dependencies to select the next `READY` ticket, explain its scope and proposed approach, and wait for explicit user approval before runtime changes.

## Interruption record

No runtime ticket is in progress. Update this record after each meaningful step or test result. If work is interrupted later, record the active ticket and status, branch and commit, changed files, commands with actual results, tests completed and remaining, pending command/session/output/error, decisions made, and the next exact step. Preserve this record across quota or agent changes. A quota interruption leaves the ticket `IN_PROGRESS`, not `DONE` or `BLOCKED`; record a real blocker separately when one exists. Record a completed ticket's SHA from `git log` in the next checkpoint because a commit cannot include its own final SHA.
