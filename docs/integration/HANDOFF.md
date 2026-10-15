# Learning Studio Integration Handoff

## Current position — 2026-10-15

- Active ticket: none
- Completed tickets: `LSI-001` (DONE — evidence in `docs/integration/evidence/LSI-001.md`), `LSI-002` (DONE — evidence in `docs/integration/evidence/LSI-002.md`), `LSI-003` (DONE — evidence in `docs/integration/evidence/LSI-003.md`), `LSI-004` (DONE — evidence in `docs/integration/evidence/LSI-004.md`), `LSI-005` (DONE — evidence in `docs/integration/evidence/LSI-005.md`), `LSI-006` (DONE — evidence in `docs/integration/evidence/LSI-006.md`), `LSI-007` (DONE — evidence in `docs/integration/evidence/LSI-007.md`), `LSI-008` (DONE — evidence in `docs/integration/evidence/LSI-008.md`), `LSI-009` (DONE — evidence in `docs/integration/evidence/LSI-009.md`), `LSI-010` (DONE — evidence in `docs/integration/evidence/LSI-010.md`), `LSI-011` (DONE — evidence in `docs/integration/evidence/LSI-011.md`), `LSI-012` (DONE — evidence in `docs/integration/evidence/LSI-012.md`), `LSI-013` (DONE — evidence in `docs/integration/evidence/LSI-013.md`), `LSI-014` (DONE — evidence in `docs/integration/evidence/LSI-014.md`), `LSI-015` (DONE — evidence in `docs/integration/evidence/LSI-015.md`), `LSI-016` (DONE — evidence in `docs/integration/evidence/LSI-016.md`), `LSI-017` (DONE — evidence in `docs/integration/evidence/LSI-017.md`), `LSI-018` (DONE — evidence in `docs/integration/evidence/LSI-018.md`), `LSI-019` (DONE — evidence in `docs/integration/evidence/LSI-019.md`), `LSI-020` (DONE — evidence in `docs/integration/evidence/LSI-020.md`), `LSI-036` (DONE — evidence in `docs/integration/evidence/LSI-036.md`)
- Next ticket: `LSI-021` (READY — Goal form and profile review; unblocked by LSI-020). Also newly unblocked by this batch: `LSI-025`, `LSI-033`, `LSI-035`, `LSI-038`, `LSI-040`.
- Branch: `codex-learning-studio-backend-integration`
- Baseline commit: `b3e15d4` (LSI-017 completion; baseline for this batch)
- Completion commit: `7473938` (LSI-036, last of the LSI-018/019/020/036 batch — see SHAs below)
- Batch completion SHAs: LSI-020 `a88957c`, LSI-019 `eade2f5`, LSI-018 `3ed1768`, LSI-036 `7473938`
- Last completed work: Parallel batch LSI-018 (workspace chat directory), LSI-019 (rich tutor replies), LSI-020 (generator request extensions), LSI-036 (direct edits and revision history)
- Files changed in this task: `apps/web/src/lib/chatDirectory.ts`, `apps/web/src/lib/workspaceApi.ts`, `apps/web/src/hooks/useWorkspaceChats.ts`, `apps/web/src/components/studio/StudioChatDirectory.tsx`, `apps/web/src/components/studio/StudioRoadmapEditing.tsx`, `apps/web/src/components/studio/StudioCourseListView.tsx`, `apps/web/src/components/studio/StudioLessonReader.tsx`, `apps/web/src/components/chat/RagSourcesStrip.tsx`, `apps/web/src/components/chat/ChatMessage.tsx`, `apps/web/src/components/studio/StudioTutorChat.tsx`, `apps/web/src/app/studio-preview/page.tsx`, `apps/api/src/schemas/curriculum.py`, `apps/api/src/services/roadmap/generator_request.py`, `apps/api/src/routers/roadmap_jobs.py`, `apps/api/src/services/roadmap/workload.py`, plus new tests and `docs/integration/evidence/LSI-018.md`/`LSI-019.md`/`LSI-020.md`/`LSI-036.md`
- Runtime files changed in this task: see above (web components + `apps/web/src/lib/*`, backend roadmap/curriculum schema+service)
- Verification in this task: full web vitest `481/481 passed` (90 files, up from 452/85); `pnpm --filter web typecheck` 0 errors; focused backend batch `47 passed`; full backend suite `535 passed, 4 failed` where all 4 failures are pre-existing `test_tool_execution.py` ordering issues reproduced identically at baseline `b3e15d4` (unrelated to this work)
- Runtime approval: Blanket user approval for backlog sequence recorded on 2026-10-15 ("i am approving all. i will review at the end. please complete all"), reconfirmed 2026-10-15 as explicit authorization to implement the remaining backlog in parallel with a GPT-6.1 review at the end
- Last completed step: Implemented, integrated, verified (full suite) and committed the LSI-018/019/020/036 batch; refreshed the status board (LSI-012–020, LSI-036 now DONE) and this handoff
- Exact next action: Continue the dependency chain with LSI-021 (and the other newly unblocked tickets LSI-025/033/035/038/040).
- Pending command/session: none
- Commands run and actual results: `pnpm --filter web test` (481 passed), `pnpm --filter web typecheck` (0 errors), `pytest apps/api/tests` (535 passed, 4 pre-existing failures), `pytest <new focused tests>` (47 passed).

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
