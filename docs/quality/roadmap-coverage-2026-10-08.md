# Comprehensive roadmap coverage and balanced canvas

Follow-up to learner feedback that the AI engineering roadmap contained only 8–10 topics. Scope: preserve the full researched subject map independently of time, select a realistic core, and render a clean balanced roadmap canvas using the approved palette.

## Implementation

- New runs have bounded ceilings of 120 model calls and 60 active minutes (20 searches/40 fetches unchanged); retries preserve existing saved limits and usage. Higher ceilings let large reference-complete curricula finish without making smaller runs consume extra calls.
- Reference mapping runs in batches of 64, with saved inventory and completed mappings resumable after interruptions. Charged validation repairs retain their charge on resume. Oversized tool proposals receive bounded feedback before execution.
- Research inspects supplied diagrams/PDFs, performs grounded public search, and records an inventory of up to 240 concrete active topics with source identities.
- SVG and serialized diagram labels are extracted as reference data without executing scripts. Advertisements and unrelated tracks are excluded by the research playbook.
- The service owns topic identity and hierarchy. A small outline plans necessary dependencies; detailed lessons are generated in resumable batches of 20.
- Core selection preserves all remaining lessons as further learning. Prerequisite failures identify exact IDs; capacity feedback includes required and available minutes. Combined order cycles are rejected before lesson generation.
- Quality repair can amend a deficient inventory and selectively rewrite affected lessons. Refinements preserve existing choice topology, resources, and archived history; removed selected routes recommend a surviving active branch with an explicit rationale.
- Every diagram label gets an explicit disposition and independent semantic review; distinct competencies cannot be concealed as vendor examples or headings.
- Every lesson resource requires a recorded exact passage and objective index. Diagram sources remain coverage-only even when they contain career FAQ prose. A separate skeptical per-resource reviewer checks objective and exercise support; rejected judgments go to producer repair without pressuring the reviewer to approve.
- Model prompts and tool results use consistent short topic/citation handles; immutable receipts and persisted resources retain canonical IDs.
- The curriculum canvas uses centered containers, equally spaced paired topic rows, compact accessible titles, and simple orthogonal connectors. Dependency detail is an optional real control. Topic boxes still open full learning briefs.
- Existing legacy layout coordinates reflow once into the requested geometry. Subsequent manual offsets and viewport survive collapse/expand. Conversation canvas defaults remain intact.

## Verification

- Combined API and AI core: 474 tests passed in the isolated graphmind_codex_roadmap_test database, including roadmap orchestrator tests covering interruption-safe repair and lesson resumption.
- Frontend: 337 tests passed; TypeScript check and isolated production Next build passed.
- Ruff passed across API/tests/AI core. Scoped mypy passed across the five changed roadmap modules.
- Independent backend review found and drove fixes for choice preservation, amendable inventories, removed selections, and archived resource bounds. Native source review then identified unsuitable diagram-only recommendations; independent evidence review and strict coverage-only source handling were added. Focused re-review found no remaining actionable code findings. Canvas review found no actionable issues.
- Browser verification: nested expansion remains balanced; compact topic opens brief, objectives, exercise, resources and learning controls. Semantic card contrast checks cover light and dark tokens. Native dark-mode browser appearance was not changed.

## Native comparisons (in progress)

References inspected live: https://roadmap.sh/ai-engineer, https://roadmap.sh/python and https://roadmap.sh/backend, plus the learner-provided AI Engineer Roadmap.pdf. Diagram-label inventories are saved with QA evidence outside the repository.

An initial AI engineering run completed with 110 topics and a 1,725-minute core within its 1,920-minute capacity. It failed the subsequent instructional-resource audit: 85 topics relied solely on the uploaded diagram and roadmap.sh overview. That result is not accepted as parity. A normal refinement replaces those recommendations with recorded teaching passages and independently reviews every lesson resource and diagram-label disposition. The active comparison now has 212 distinct inventory topics and 235 explicitly mapped roadmap labels, and has passed structural coverage checks. Independent semantic review and lesson authoring are still running; publication has not occurred. The saved job and all charged work are retained for retry. The original learner workspace remains untouched. Python and backend native comparisons remain pending. The completed 110-topic canvas was measured: paired rows have identical Y coordinates, equal dimensions and symmetric side gaps.

Earlier native failures are retained as QA evidence: full-candidate outline token exhaustion, invalid citation identities, missing grounded-search activity and unsuccessful core selection. They are failed attempts, not successful comparisons; no usage counters or terminal states were reset to publish a result.
