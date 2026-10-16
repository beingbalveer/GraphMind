# Learning Studio Integration Handoff

## Current position — 2026-10-16

- Active ticket: LSI-029 (READY — public catalog in Next.js)
- Completed this session: `LSI-023` (commit `b73e6e4`; evidence `docs/integration/evidence/LSI-023.md`), `LSI-024` (commit `7424f2a`; evidence `docs/integration/evidence/LSI-024.md`), `LSI-028` (commit `764b02d`; evidence `docs/integration/evidence/LSI-028.md`)
- Completed tickets: `LSI-001` (DONE — evidence in `docs/integration/evidence/LSI-001.md`), `LSI-002` (DONE — evidence in `docs/integration/evidence/LSI-002.md`), `LSI-003` (DONE — evidence in `docs/integration/evidence/LSI-003.md`), `LSI-004` (DONE — evidence in `docs/integration/evidence/LSI-004.md`), `LSI-005` (DONE — evidence in `docs/integration/evidence/LSI-005.md`), `LSI-006` (DONE — evidence in `docs/integration/evidence/LSI-006.md`), `LSI-007` (DONE — evidence in `docs/integration/evidence/LSI-007.md`), `LSI-008` (DONE — evidence in `docs/integration/evidence/LSI-008.md`), `LSI-009` (DONE — evidence in `docs/integration/evidence/LSI-009.md`), `LSI-010` (DONE — evidence in `docs/integration/evidence/LSI-010.md`), `LSI-011` (DONE — evidence in `docs/integration/evidence/LSI-011.md`), `LSI-012` (DONE — evidence in `docs/integration/evidence/LSI-012.md`), `LSI-013` (DONE — evidence in `docs/integration/evidence/LSI-013.md`), `LSI-014` (DONE — evidence in `docs/integration/evidence/LSI-014.md`), `LSI-015` (DONE — evidence in `docs/integration/evidence/LSI-015.md`), `LSI-016` (DONE — evidence in `docs/integration/evidence/LSI-016.md`), `LSI-017` (DONE — evidence in `docs/integration/evidence/LSI-017.md`), `LSI-018` (DONE — evidence in `docs/integration/evidence/LSI-018.md`), `LSI-019` (DONE — evidence in `docs/integration/evidence/LSI-019.md`), `LSI-020` (DONE — evidence in `docs/integration/evidence/LSI-020.md`), `LSI-036` (DONE — evidence in `docs/integration/evidence/LSI-036.md`), `LSI-021` (DONE — evidence in `docs/integration/evidence/LSI-021.md`), `LSI-025` (DONE — evidence in `docs/integration/evidence/LSI-025.md`), `LSI-033` (DONE — evidence in `docs/integration/evidence/LSI-033.md`), `LSI-035` (DONE — evidence in `docs/integration/evidence/LSI-035.md`), `LSI-038` (DONE — evidence in `docs/integration/evidence/LSI-038.md`), `LSI-040` (DONE — evidence in `docs/integration/evidence/LSI-040.md`), `LSI-022` (DONE — evidence in `docs/integration/evidence/LSI-022.md`), `LSI-026` (DONE — evidence in `docs/integration/evidence/LSI-026.md`), `LSI-027` (DONE — evidence in `docs/integration/evidence/LSI-027.md`), `LSI-034` (DONE — evidence in `docs/integration/evidence/LSI-034.md`), `LSI-041` (DONE — evidence in `docs/integration/evidence/LSI-041.md`), `LSI-042` (DONE — evidence in `docs/integration/evidence/LSI-042.md`), `LSI-023` (DONE — evidence in `docs/integration/evidence/LSI-023.md`), `LSI-024` (DONE — evidence in `docs/integration/evidence/LSI-024.md`), `LSI-028` (DONE — evidence in `docs/integration/evidence/LSI-028.md`)
- Next ticket: `LSI-029` (READY — public catalog in Next; deps 004/026 DONE). Then the `LSI-030`→`LSI-031`→`LSI-032` chain, `LSI-037`/`LSI-039`/`LSI-043`/`LSI-044`/`LSI-045`, then gates `LSI-046`–`LSI-050`.
- Branch: `codex-learning-studio-backend-integration`
- Baseline commit: `4768ff8` (wave-2 completion; baseline for wave 3)
- Completion commit: `764b02d` (LSI-028)
- Batch completion SHAs (latest wave): LSI-023 `b73e6e4`, LSI-024 `7424f2a`, LSI-028 `764b02d`. Earlier wave: LSI-022 `a757e38`, LSI-026 `d62fe04`, LSI-027 `77d3d05`, LSI-034 `bc20af6`, LSI-041 `ba440a6`, LSI-042 `8be33bf`.
- Last completed work: LSI-028 (transactional save-copy service — private copy tables + migration `20261016_0008`, deterministic private IDs and durable public→private topic map, `(workspace, template)` idempotency, atomic route `POST /api/v1/workspaces/{workspace_id}/learning-roadmaps`); LSI-024 (job recovery/retry/cancellation); LSI-023 (clarification round trip)
- Files changed in this task: `apps/api/src/models/public_snapshot_copy.py`, `apps/api/src/models/__init__.py`, `apps/api/src/schemas/enrollment.py`, `apps/api/src/schemas/curriculum.py`, `apps/api/src/services/roadmap/save_copy.py`, `apps/api/src/routers/workspaces.py`, `apps/api/alembic/versions/20261016_0008_add_public_snapshot_copies.py`, `apps/api/tests/roadmap/test_save_copy.py`, `apps/api/tests/test_public_snapshot_copy_migration.py`, `docs/integration/evidence/LSI-028.md`, `docs/integration/LEARNING_STUDIO_BACKLOG.md`
- Runtime files changed in this task: backend — new copy tables/service/route and migration; no frontend runtime change
- Verification in this task: focused backend `tests/roadmap/test_save_copy.py tests/test_public_snapshot_copy_migration.py` `16 passed`; roadmap suite `tests/roadmap` `461 passed`; full backend suite `607 passed, 4 failed` (only the pre-existing `test_tool_execution.py` monkeypatch-leak failures); `ruff check`/`ruff format --check` clean; `mypy` on changed files reports only the pre-existing `workspaces.py:135` `no-any-return`.
- Runtime approval: Blanket user approval for backlog sequence recorded on 2026-10-15 ("i am approving all. i will review at the end. please complete all"), reconfirmed 2026-10-15 as explicit authorization to implement the remaining backlog in parallel with a GPT-6.1 review at the end
- Last completed step: Implemented, verified (focused/roadmap/full backend suites + ruff + mypy) and committed LSI-028; board row for LSI-028 now DONE
- Exact next action: Implement LSI-029 (public catalog in Next.js), then the remaining chain (030/031/032/037/039/043/044/045, then gates 046–050).
- Pending command/session: none
- Commands run and actual results: `ENVIRONMENT=test DATABASE_URL="postgresql+asyncpg://balveerd:1234@localhost:5432/graphmind_test" uv run pytest tests/roadmap/test_save_copy.py tests/test_public_snapshot_copy_migration.py` (16 passed), `... uv run pytest tests/roadmap` (461 passed), `... uv run pytest` (607 passed, 4 failed — pre-existing `test_tool_execution.py`), `uv run ruff check`/`ruff format --check` (clean).

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
