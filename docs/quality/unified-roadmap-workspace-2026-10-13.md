# Unified roadmap workspace — verification record

Branch: `codex/unified-roadmap-workspace`. Verification recorded 13 October 2026.
The user authorized the full implementation plan and parallel multi-agent work.
Tasks 1–6 are implemented. Task 7's automated gates and core integrated browser
journey are verified; the broader manual browser matrix and live-provider/research
checks remain unverified. The pre-existing roadmap research-quality and independent
whole-branch review gate remains active and is not replaced by these checks.

## Automated checks observed

| Check | Result | Notes |
| --- | --- | --- |
| Full web Vitest suite | 362 passed across 72 files | `/tmp/graphmind-unified-frontend-final.log` |
| Focused frontend integration suites | 35 passed | Final focused rerun, including chat/roadmap journey coverage |
| Shared-package Vitest suite | 16 passed | `/tmp/graphmind-unified-shared-tests.log` |
| Web TypeScript typecheck | Passed | Full web project typecheck |
| Shared-package TypeScript check | Passed | Direct local compiler invocation; pnpm 11 refused the repository symlink build invocation |
| Next.js production build | Passed | Isolated frontend copy and output directory; final source snapshot build log `/tmp/graphmind-unified-production-build-final.log`; required an approved network retry to fetch the configured font; existing lint warnings remain |
| Full API and ai-core pytest suite | 539 passed; 2 pre-existing dependency/deprecation warnings | Ran on isolated database `graphmind_codex_roadmap_test`; database for the browser walkthrough remained separate |
| Ruff | Passed | Full-repository `ruff check .` |
| API mypy comparison | Passed with unchanged diagnostics | Branch and main each have 55 diagnostics across 13 files; normalized diagnostic diff is empty. Source count changed from 88 to 90. Strict checks for the four new/critical services passed. Logs: `/tmp/graphmind-unified-current-mypy.log` and `/tmp/graphmind-unified-main-mypy.log` |
| Alembic migration 0005 | Upgrade, downgrade to 0004, and upgrade to head passed | Isolated database `graphmind_migration_test` |

## Local browser journey

The walkthrough used a copied frontend on port 3301, an isolated API on port 8301,
and PostgreSQL database `graphmind_codex_ui_test`. It did not use or migrate the
live development database. The flow exercised was:

1. Create a general conversation from the roadmap workspace with its first prompt
   saved as the root and two selected active topic preferences.
2. Confirm the general chat opened at its canonical chat URL, streamed one answer,
   and appeared in the General conversations group. Database inspection showed one
   root with the selected topic IDs and one completed assistant response.
3. Open a topic lesson, create and stream a nested branch, and return to the general
   conversation to create a separate nested branch there.
4. Prepare a promotion from the general nested branch, review a one-topic additive
   proposal, and apply it in the browser.
5. Confirm the new topic appeared under Further learning and its brief displayed
   “Added from exploration” with the source title and nested branch transcript.
   Database inspection confirmed the applied revision was current and the origin
   retained the expected workspace, chat, node, privacy flag, and source excerpt.
6. Follow Open source branch. The canonical `?node=` URL reopened the actual
   nested branch side peek, with the general chat's selected topic context visible.
7. Start the promoted topic's own primary lesson and confirm a response streamed.
   Reload its canonical chat URL, verify the persisted answer, return to the roadmap,
   and verify the topic offers its saved Primary lesson session and Continue lesson.

The promotion job was completed with a **scripted worker fixture**, not an actual
research or generation run. The fixture used the saved job candidate, profile,
source snapshot, typed `StageResult` checkpoints, the real curriculum validator,
`JobRepository`, and `PublicationService`; it made no external provider calls. The
browser review and Apply actions and origin persistence were real application
behavior. Source deletion/unavailable-origin behavior was not exercised in the
browser; backend automated publication tests cover that lifecycle. The browser
walkthrough did not exhaustively test light/dark appearance, keyboard-only use,
responsive breakpoints, back/forward navigation, canvas switching, or every
permission/failure scenario. Live-provider generation and the existing delivery's
research-quality evaluation were not exercised here.

The isolated UI database had a pre-existing schema and was initially brought to the
then-current model shape with an additive `source_private` column and ORM table
creation. After the post-commit development failure, inspection found that the
development database also had an older, empty `curriculum_topic_origins` table.
`create_all()` did not add columns to that existing table, and migration 0005 had
returned early whenever the table existed. The migration now converges compatible
partial tables, recovers owners from surviving `TopicChat` rows, and marks legacy
origins private when their visibility is unknown. An unavailable source remains
private with no inferred owner.

The additive 0005 upgrade was applied directly to the development database after
the column mismatch was confirmed. It added `source_owner_id`, `source_private`,
the owner foreign key, and the missing uniqueness constraint; the existing
revision index was retained. The table had zero origin rows before and after, and
the database had no Alembic version table, which was left unchanged. A read-only
`CurriculumRepository.read` then returned the existing workspace roadmap for its
owner (309 topics, current revision present), and the browser rendered the Cyber
Security roadmap without the prior server error.

Four migration regression tests pass on `graphmind_codex_roadmap_test` using
temporary schemas rolled back after each test. They cover fresh creation and
idempotency, legacy-table privacy backfill including a deleted source, preserving
explicit general/private/unavailable visibility, constraints, and downgrade with
an equivalent legacy index name. Migration 0005's separate
upgrade/downgrade/upgrade round trip also passed on `graphmind_migration_test`.

## Implementation coverage

- General-chat creation persists the actual first user root before navigation and
  streaming. Prepared-root retries reuse that message, reject completed responses
  and responses with descendants, and retain failed/interrupted lifecycle metadata.
- Normal and branch messages await their user-node save before the API verifies
  persisted ancestry. Conversation scope and roadmap context are resolved by one
  server-side path for completion and streaming.
- General chats can store up to three selected active roadmap topics on the root;
  the server revalidates preferences and bounds injected roadmap context.
- Topic conversations remain tied to `TopicChat`; branch promotion creates a
  reviewable additive revision with typed source provenance and an explicit Apply
  step. Origin deep links resolve nested branches through canonical URL helpers.

The automated gates and core integrated browser journey are complete. The remaining
manual browser matrix and live-provider/research evaluation are listed as
unverified; the existing roadmap research-quality gate remains separate.
