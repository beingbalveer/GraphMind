# Learning Studio Integration Backlog

This folder is the working queue for connecting the Learning Studio prototype to GraphMind's production backend and replacing the older learner-facing UI after feature parity. The authoritative ticket board and acceptance criteria are in [LEARNING_STUDIO_BACKLOG.md](./LEARNING_STUDIO_BACKLOG.md); current session state is in [HANDOFF.md](./HANDOFF.md). The prototype's current mapping and boundary notes remain in [BACKEND_HANDOFF.md](../../apps/web/prototype/BACKEND_HANDOFF.md).

## Working protocol

- Work on one ticket at a time, in dependency order. Do not parallelize tickets or begin a later ticket while the current one is unfinished.
- Before runtime changes, explain the selected ticket and its implementation approach, then wait for the user's explicit approval required by [AGENTS.md](../../AGENTS.md). Record the approval source, date, and scope in HANDOFF. Preserve that approval across quota or agent interruptions; do not ask again for the same ticket and approved approach. Approval of the backlog authorizes planning, not runtime implementation. Apply the repository's URL contract in [URL_DESIGN.md](../URL_DESIGN.md).
- Use statuses `TODO`, `READY`, `IN_PROGRESS`, `VERIFYING`, `DONE`, or `BLOCKED`. On resume, continue the active `IN_PROGRESS` or `VERIFYING` ticket first; select a `READY` ticket only when no ticket is active. Keep work `IN_PROGRESS` across a quota interruption. Use `BLOCKED` only for a concrete unresolved blocker, recorded separately from quota limits.
- Update HANDOFF after every meaningful completed step and test result, not only when interruption is expected. Keep the last completed step and exact next action current; never imply a pending command finished. If interrupted, record branch and commit, files changed, commands and actual results, remaining checks, pending session/output/error, decisions, and next exact step. Distinguish historical verification from current checks. Never infer state or a commit; read `git status` and current revision first.
- Treat ticket size as a planning target, not a quota or completion guarantee. When a ticket proves too large, split it into explicit `.1` / `.2` follow-up tickets as soon as that is clear and before starting additional work. Preserve dependencies and record the new scope in the board.
- Commit each completed ticket with a Conventional Commit message that includes its ticket ID, and include its status and evidence in the completion commit. Mark `DONE` only after acceptance criteria, review, required test evidence, and the commit are complete. Record the actual resulting SHA in the next HANDOFF checkpoint; a commit cannot contain its own final SHA. Partial work is never `DONE`.
- Keep completed evidence durable: add a completion record under the ticket or link an `evidence/LSI-xxx.md` file from its detail block. Include outcomes, changed files, exact commands/results, manual checks, and limitations. HANDOFF tracks the current step; do not erase a completed ticket's evidence when starting the next one.
- Run focused checks appropriate to the ticket; do not rerun the full suite after every small ticket. Backend tests must use an isolated test database with a `_test` name, never live or user data. Do not put secrets, credentials, or local storage dumps in repository files.
- Keep feature-parity inventory, cutover, rollback, and deletion of the older UI as separate tickets. The older UI stays until the parity and cutover gates are met.

## Resume prompt

```text
Resume the Learning Studio backend integration from docs/integration/HANDOFF.md. Read AGENTS.md, docs/URL_DESIGN.md, docs/integration/README.md, the backlog, and the prototype handoff. Check git status and the current commit before relying on the handoff. Continue the active IN_PROGRESS or VERIFYING ticket first, preserving any recorded user approval for its scope and approach. If no ticket is active, discuss the next READY ticket and wait for explicit user approval before runtime edits. Preserve ticket dependencies and acceptance evidence; do not repeat completed work.
```
