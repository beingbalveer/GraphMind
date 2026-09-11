# Node-Linked Flashcards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user generate, persist, review, edit, regenerate, delete, and return to the source of AI-created flashcards linked to one assistant response node.

**Architecture:** Add a dedicated `FlashcardModel` related to `Workspace` and `NodeModel`, expose workspace-scoped REST endpoints guarded by the existing RBAC dependencies, and generate structured card drafts through the provider-agnostic `ai-core` interface. In the web app, add a focused API module and a modal opened from an assistant-message action; using the existing `ChatMessage` surface makes the feature available in linear chat and the canvas side-peek without creating a new page or graph-node type.

**Tech Stack:** Python 3.12, FastAPI, Pydantic v2, async SQLAlchemy, Alembic, PostgreSQL, `ai-core`, structlog, pytest/httpx, Next.js 15 App Router, React 19, strict TypeScript, Tailwind semantic tokens, shared UI primitives, Vitest, and Testing Library.

**Spec:** [`docs/FEATURE_RESEARCH.md`](../../FEATURE_RESEARCH.md), Section 2.1, refined by the explicit first-release decisions and acceptance criteria below.

## Global Constraints

- Implement only Feature 2.1, Node-Linked Flashcard Generation.
- Do not add FSRS scheduling, review history, due dates, a daily queue, notifications, a new route, a workspace-wide deck, import/export, manual creation, or flashcard graph nodes.
- Generate cards only from a persisted, non-streaming assistant node with non-blank content in the requested workspace.
- Generate five cards by default. The API accepts `count` from 1 through 10; the first UI always requests five.
- A repeated generation returns `409 Conflict` unless `replaceExisting` is true.
- Regeneration requires confirmation. Generate and validate the new set before deleting the old set, then replace in one transaction.
- Provider failure or invalid output returns `502 Bad Gateway`; never fabricate fallback cards and never destroy existing cards on failure.
- Store and render question/answer as plain text, not HTML.
- API JSON uses camelCase through the existing Pydantic alias convention. Python uses snake_case; TypeScript uses camelCase.
- GET uses `require_workspace_read`. Generate, PATCH, and DELETE use `require_workspace_write`.
- Never log API keys or full source content. Structured logs may include workspace ID, node ID, provider, requested count, and result count.
- Use only `@/components/ui/` primitives for controls and surfaces. Use semantic color tokens and support light/dark modes.
- Create no URL. Preserve `docs/URL_DESIGN.md` and never call the History API directly.
- Use TDD and commit after every independently reviewable task.
- Preserve unrelated working-tree changes. Do not update the roadmap until all verification passes.

## Product Decisions

| Question | Decision | Reason |
|---|---|---|
| Source unit | One persisted assistant `NodeModel` | It is the smallest stable content unit and already has workspace ownership and cascade deletion. |
| Canvas entry | Open the thread side-peek and use the response action | Canvas nodes represent whole threads, not individual messages; auto-selecting one response would be ambiguous. |
| Entry action | `Generate or review flashcards` beside response actions | Accessible and consistent with Copy, Rating, and Regenerate. |
| First click | GET existing cards; if the successful result is empty, automatically generate five | One click creates value, while reopening never incurs an unnecessary model call. |
| Regeneration | Confirm, generate and validate, then atomically replace | User edits survive provider and parser failures. |
| Editing | Edit question and answer together | Simple validation and one predictable Save action. |
| Deletion | Confirm one-card deletion | Prevents accidental loss without bulk-management scope. |
| Source navigation | Close modal, scroll source message into view, focus it | This release is node-scoped and needs no cross-page navigation. |
| Scheduling | Excluded | FSRS is Feature 2.2 and depends on this persistence layer. |

## API Contract

| Method | Path | Permission | Body | Success |
|---|---|---|---|---|
| GET | `/api/v1/workspaces/{workspaceId}/nodes/{nodeId}/flashcards` | Read | none | `200 FlashcardResponse[]` ordered by position |
| POST | `/api/v1/workspaces/{workspaceId}/nodes/{nodeId}/flashcards/generate` | Write | `FlashcardGenerateRequest` | `201 FlashcardResponse[]` |
| PATCH | `/api/v1/workspaces/{workspaceId}/nodes/{nodeId}/flashcards/{flashcardId}` | Write | `FlashcardUpdate` | `200 FlashcardResponse` |
| DELETE | `/api/v1/workspaces/{workspaceId}/nodes/{nodeId}/flashcards/{flashcardId}` | Write | none | `204` empty body |

Error mapping:

- `404`: node/card is absent inside the requested workspace.
- `409`: cards already exist and replacement is false.
- `422`: body validation fails, node is not an assistant response, or source is blank.
- `502`: provider initialization/generation fails or output contains no valid cards.

## File Map

New backend files:

- `apps/api/src/models/flashcard.py`
- `apps/api/src/schemas/flashcard.py`
- `apps/api/src/services/flashcard_service.py`
- `apps/api/src/routers/flashcards.py`
- `apps/api/tests/test_flashcard_schemas.py`
- `apps/api/tests/test_flashcard_model.py`
- `apps/api/tests/test_flashcard_generation.py`
- `apps/api/tests/test_flashcard_endpoints.py`
- `alembic.ini`
- `apps/api/alembic/env.py`
- `apps/api/alembic/script.py.mako`
- `apps/api/alembic/versions/20260911_0001_add_flashcards.py`

New frontend files:

- `apps/web/src/lib/flashcardApi.ts`
- `apps/web/src/lib/__tests__/flashcard-api.test.ts`
- `apps/web/src/components/flashcards/FlashcardItem.tsx`
- `apps/web/src/components/flashcards/FlashcardModal.tsx`
- `apps/web/src/components/flashcards/__tests__/flashcard-item.test.tsx`
- `apps/web/src/components/flashcards/__tests__/flashcard-modal.test.tsx`

Existing files to modify:

- `apps/api/src/models/workspace.py`
- `apps/api/src/models/__init__.py`
- `apps/api/src/main.py`
- `packages/shared/src/index.ts`
- `apps/web/src/components/chat/ChatMessage.tsx`
- `apps/web/src/components/chat/ChatContainer.tsx`
- `apps/web/src/components/chat/SidePeekBranchSheet.tsx`
- `apps/web/src/components/chat/__tests__/chat-message.test.tsx`
- `apps/web/src/components/chat/__tests__/auxiliary-panels.test.tsx`
- `docs/ROADMAP.md`
- `README.md`

---

## Before Task 1: Preflight and Baseline

- [ ] Read `AGENTS.md`, `docs/FEATURE_RESEARCH.md` Section 2.1, `docs/URL_DESIGN.md`, and this complete plan.

- [ ] Inspect branch and worktree without modifying either.

```bash
git status --short
git branch --show-current
git log -5 --oneline
```

Expected: record and preserve unrelated changes. Use a `codex/` branch unless the user specifies another name.

- [ ] Run and record the backend baseline.

```bash
uv run pytest
uv run ruff check
uv run mypy apps/api/src packages/ai-core/src
```

- [ ] Run and record the frontend baseline.

```bash
pnpm --filter @graphmind/shared build
pnpm --filter @graphmind/web test
pnpm --filter @graphmind/web typecheck
pnpm --filter @graphmind/web build
```

Expected: record pre-existing failures before editing. Do not repair unrelated baseline failures in this feature.

### Task 1: Define Backend Schemas

**Files:**
- Create: `apps/api/src/schemas/flashcard.py`
- Create: `apps/api/tests/test_flashcard_schemas.py`

**Interfaces:**
- Produces: `FlashcardDraft`, `FlashcardGenerateRequest`, `FlashcardUpdate`, `FlashcardResponse`.
- All schemas accept camelCase and serialize camelCase with the repository's Pydantic convention.

- [ ] **Step 1: Write failing validation tests**

```python
from datetime import datetime, timezone

import pytest
from pydantic import ValidationError

from schemas.flashcard import FlashcardGenerateRequest, FlashcardResponse, FlashcardUpdate


def test_generate_request_accepts_alias_and_bounds_count() -> None:
    request = FlashcardGenerateRequest.model_validate(
        {"count": 5, "replaceExisting": True, "provider": "mock", "model": "mock-provider"}
    )
    assert request.replace_existing is True

    with pytest.raises(ValidationError):
        FlashcardGenerateRequest(count=0)
    with pytest.raises(ValidationError):
        FlashcardGenerateRequest(count=11)


def test_update_requires_non_blank_change() -> None:
    with pytest.raises(ValidationError):
        FlashcardUpdate()
    with pytest.raises(ValidationError):
        FlashcardUpdate(question="   ")
    with pytest.raises(ValidationError):
        FlashcardUpdate(answer="")


def test_response_serializes_public_aliases() -> None:
    now = datetime.now(timezone.utc)
    response = FlashcardResponse(
        id="card_1",
        workspace_id="ws_1",
        source_node_id="node_1",
        question="What is a vector embedding?",
        answer="A learned numeric representation.",
        position=0,
        created_at=now,
        updated_at=now,
    )
    payload = response.model_dump(by_alias=True)
    assert payload["workspaceId"] == "ws_1"
    assert payload["sourceNodeId"] == "node_1"
```

- [ ] **Step 2: Confirm the tests fail because the module is missing**

```bash
uv run pytest apps/api/tests/test_flashcard_schemas.py -v
```

- [ ] **Step 3: Implement the schemas**

```python
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from pydantic.alias_generators import to_camel


class BaseSchema(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True,
        alias_generator=to_camel,
        from_attributes=True,
    )


class FlashcardDraft(BaseSchema):
    question: str = Field(min_length=1, max_length=1000)
    answer: str = Field(min_length=1, max_length=4000)

    @field_validator("question", "answer")
    @classmethod
    def strip_text(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Flashcard text cannot be blank")
        return cleaned


class FlashcardGenerateRequest(BaseSchema):
    count: int = Field(default=5, ge=1, le=10)
    replace_existing: bool = False
    provider: Optional[str] = None
    model: Optional[str] = None
    api_key: Optional[str] = Field(default=None, repr=False)
    base_url: Optional[str] = None


class FlashcardUpdate(BaseSchema):
    question: Optional[str] = Field(default=None, min_length=1, max_length=1000)
    answer: Optional[str] = Field(default=None, min_length=1, max_length=4000)

    @field_validator("question", "answer")
    @classmethod
    def strip_optional_text(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Flashcard text cannot be blank")
        return cleaned

    @model_validator(mode="after")
    def require_change(self) -> "FlashcardUpdate":
        if self.question is None and self.answer is None:
            raise ValueError("At least one of question or answer must be provided")
        return self


class FlashcardResponse(BaseSchema):
    id: str
    workspace_id: str
    source_node_id: str
    question: str
    answer: str
    position: int
    created_at: datetime
    updated_at: datetime
```

- [ ] **Step 4: Verify and commit**

```bash
uv run pytest apps/api/tests/test_flashcard_schemas.py -v
uv run ruff check apps/api/src/schemas/flashcard.py apps/api/tests/test_flashcard_schemas.py
uv run mypy apps/api/src/schemas/flashcard.py
git add apps/api/src/schemas/flashcard.py apps/api/tests/test_flashcard_schemas.py
git commit -m "feat(api): define flashcard contracts"
```

### Task 2: Add the Persistence Model

**Files:**
- Create: `apps/api/src/models/flashcard.py`
- Modify: `apps/api/src/models/workspace.py`
- Modify: `apps/api/src/models/__init__.py`
- Create: `apps/api/tests/test_flashcard_model.py`

**Interfaces:**
- Produces: `FlashcardModel` with `card_` IDs.
- Both foreign keys use database cascade deletion.
- Index ordered lookups by `(source_node_id, position)`.

- [ ] **Step 1: Write failing ORM metadata tests**

```python
from models.flashcard import FlashcardModel
from models.workspace import NodeModel, Workspace


def test_flashcard_table_contract() -> None:
    table = FlashcardModel.__table__
    assert table.name == "flashcards"
    assert {column.name for column in table.columns} == {
        "id", "workspace_id", "source_node_id", "question", "answer",
        "position", "created_at", "updated_at",
    }
    foreign_keys = {fk.parent.name: fk for fk in table.foreign_keys}
    assert foreign_keys["workspace_id"].ondelete == "CASCADE"
    assert foreign_keys["source_node_id"].ondelete == "CASCADE"


def test_parent_models_expose_flashcards() -> None:
    assert "flashcards" in Workspace.__mapper__.relationships
    assert "flashcards" in NodeModel.__mapper__.relationships
```

- [ ] **Step 2: Confirm missing-model failure**

```bash
uv run pytest apps/api/tests/test_flashcard_model.py -v
```

- [ ] **Step 3: Create the model**

```python
import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from database import Base
from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

if TYPE_CHECKING:
    from models.workspace import NodeModel, Workspace


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class FlashcardModel(Base):
    __tablename__ = "flashcards"
    __table_args__ = (
        Index("idx_flashcards_source_position", "source_node_id", "position"),
        Index("idx_flashcards_workspace_created", "workspace_id", "created_at"),
    )

    id: Mapped[str] = mapped_column(
        String(64), primary_key=True, default=lambda: f"card_{uuid.uuid4().hex[:12]}"
    )
    workspace_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False
    )
    source_node_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("nodes.id", ondelete="CASCADE"), nullable=False
    )
    question: Mapped[str] = mapped_column(Text, nullable=False)
    answer: Mapped[str] = mapped_column(Text, nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utc_now, onupdate=_utc_now
    )

    workspace: Mapped["Workspace"] = relationship("Workspace", back_populates="flashcards")
    source_node: Mapped["NodeModel"] = relationship("NodeModel", back_populates="flashcards")
```

- [ ] **Step 4: Add reciprocal relationships**

In `workspace.py`, extend the type-only imports with `FlashcardModel`. Add this relationship to `Workspace`:

```python
flashcards: Mapped[List["FlashcardModel"]] = relationship(
    "FlashcardModel",
    back_populates="workspace",
    cascade="all, delete-orphan",
    passive_deletes=True,
    order_by="FlashcardModel.created_at",
)
```

Add this relationship to `NodeModel`:

```python
flashcards: Mapped[List["FlashcardModel"]] = relationship(
    "FlashcardModel",
    back_populates="source_node",
    cascade="all, delete-orphan",
    passive_deletes=True,
    order_by="FlashcardModel.position",
)
```

Import `FlashcardModel` in `models/__init__.py` and include it in `__all__` so metadata and Alembic register the table.

- [ ] **Step 5: Verify and commit**

```bash
uv run pytest apps/api/tests/test_flashcard_model.py -v
uv run ruff check apps/api/src/models apps/api/tests/test_flashcard_model.py
uv run mypy apps/api/src/models
git add apps/api/src/models/flashcard.py apps/api/src/models/workspace.py apps/api/src/models/__init__.py apps/api/tests/test_flashcard_model.py
git commit -m "feat(api): persist node-linked flashcards"
```

### Task 3: Add the First Checked-In Alembic Revision

**Files:**
- Create: `alembic.ini`
- Create: `apps/api/alembic/env.py`
- Create: `apps/api/alembic/script.py.mako`
- Create: `apps/api/alembic/versions/20260911_0001_add_flashcards.py`

**Interfaces:**
- Makes the README command `uv run alembic upgrade head` real.
- This first revision is additive and expects the completed Phase 4 schema (`workspaces` and `nodes`) to exist.
- It fails clearly on a blank historical database instead of pretending to be a complete baseline.

- [ ] **Step 1: Verify the current migration gap**

```bash
test ! -f alembic.ini
test ! -d apps/api/alembic
```

Expected: both succeed. If migrations now exist, stop and use their real head as `down_revision`.

- [ ] **Step 2: Create Alembic configuration**

Set `script_location = apps/api/alembic` and prepend `apps/api/src` plus `packages/ai-core/src`. In `env.py`, import `models`, use `Base.metadata`, set the URL from `get_db_url()`, and run online migrations with `async_engine_from_config` plus `connection.run_sync`.

Core online runner:

```python
async def run_async_migrations() -> None:
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()
```

Use Alembic's standard revision template in `script.py.mako`.

- [ ] **Step 3: Create the explicit additive revision**

The revision must define:

```python
revision: str = "20260911_0001"
down_revision: str | None = None
```

In `upgrade()`, inspect existing tables, raise a descriptive `RuntimeError` if `workspaces` or `nodes` is missing, and create `flashcards` only if absent. Define the two cascade foreign keys, the primary key, and both model indexes. In `downgrade()`, drop both indexes and the table only when the table exists.

- [ ] **Step 4: Run migration checks on a disposable copy of an existing Phase 4 database**

```bash
uv run alembic heads
uv run alembic current
uv run alembic upgrade head
uv run alembic current
uv run alembic check
```

Expected: head/current is `20260911_0001`, the table has both indexes and cascades, and no flashcard schema diff remains. Never downgrade a database with user cards.

- [ ] **Step 5: Commit**

```bash
git add alembic.ini apps/api/alembic
git commit -m "feat(db): add flashcard migration"
```

### Task 4: Build Strict Prompting and Output Parsing

**Files:**
- Create: `apps/api/src/services/flashcard_service.py`
- Create: `apps/api/tests/test_flashcard_generation.py`

**Interfaces:**
- Produces: `FlashcardService._build_prompt(source_content: str, count: int) -> str`.
- Produces: `FlashcardService._parse_drafts(raw_text: str, count: int) -> list[FlashcardDraft]`.
- Produces typed errors: `FlashcardGenerationError`, `FlashcardConflictError`, `FlashcardNotFoundError`, `InvalidFlashcardSourceError`.

- [ ] **Step 1: Write failing prompt/parser tests**

```python
import pytest

from services.flashcard_service import FlashcardGenerationError, FlashcardService


def test_prompt_delimits_untrusted_source_and_requests_shape() -> None:
    prompt = FlashcardService._build_prompt("Closures retain lexical scope.", 5)
    assert "exactly 5" in prompt
    assert '"cards"' in prompt
    assert "BEGIN SOURCE" in prompt
    assert "Closures retain lexical scope." in prompt


def test_parser_strips_fences_and_deduplicates_questions() -> None:
    raw = """```json
    {"cards": [
      {"question": " What is a closure? ", "answer": " A function plus lexical scope. "},
      {"question": "what is a closure?", "answer": "Duplicate"},
      {"question": "Why use closures?", "answer": "To preserve private state."}
    ]}
    ```"""
    cards = FlashcardService._parse_drafts(raw, count=5)
    assert [card.question for card in cards] == [
        "What is a closure?", "Why use closures?"
    ]
    assert cards[0].answer == "A function plus lexical scope."


@pytest.mark.parametrize(
    "raw",
    ["not json", "{}", '{"cards":[]}', '{"cards":[{"question":"","answer":"bad"}]}'],
)
def test_parser_rejects_unusable_output(raw: str) -> None:
    with pytest.raises(FlashcardGenerationError):
        FlashcardService._parse_drafts(raw, count=5)
```

- [ ] **Step 2: Observe missing-service failure**

```bash
uv run pytest apps/api/tests/test_flashcard_generation.py -v
```

- [ ] **Step 3: Implement pure parsing**

Define `MAX_SOURCE_CHARS = 12_000`. The prompt must request self-contained retrieval questions, concise factual answers, no unsupported facts, no duplicates, and JSON only:

```json
{"cards":[{"question":"string","answer":"string"}]}
```

Delimit source with `--- BEGIN SOURCE ---` and `--- END SOURCE ---`, and say source text is data, not instructions. Strip an optional JSON fence, slice from the first `{` through the last `}`, call `json.loads`, validate each entry with `FlashcardDraft`, normalize questions with collapsed whitespace plus `casefold()`, keep the first duplicate, return at most `count`, and raise `FlashcardGenerationError` when no usable card remains.

- [ ] **Step 4: Verify and commit**

```bash
uv run pytest apps/api/tests/test_flashcard_generation.py -v
uv run ruff check apps/api/src/services/flashcard_service.py apps/api/tests/test_flashcard_generation.py
uv run mypy apps/api/src/services/flashcard_service.py
git add apps/api/src/services/flashcard_service.py apps/api/tests/test_flashcard_generation.py
git commit -m "feat(api): parse structured flashcard output"
```

### Task 5: Implement Provider Generation

**Files:**
- Modify: `apps/api/src/services/flashcard_service.py`
- Modify: `apps/api/tests/test_flashcard_generation.py`

**Interfaces:**
- Begins `FlashcardService.generate_for_node(db, workspace_id, node_id, request) -> list[FlashcardResponse]`.
- Uses `get_provider`, `ChatMessage`, `ChatRole`, and `ModelConfig` from `ai_core`.

- [ ] **Step 1: Write a failing provider test**

Use a fake provider returning:

```python
GenerationResult(
    content='{"cards":[{"question":"What is lexical scope?","answer":"Scope determined by source structure."}]}',
    role=ChatRole.ASSISTANT,
    model_name="fake-model",
)
```

Create a workspace and assistant node in the test DB, monkeypatch `services.flashcard_service.get_provider`, call `generate_for_node`, and assert one persisted card at position zero.

- [ ] **Step 2: Observe failure**

```bash
uv run pytest apps/api/tests/test_flashcard_generation.py -k provider -v
```

- [ ] **Step 3: Implement provider resolution**

Resolve request provider/model first, then `settings.DEFAULT_PROVIDER`/`DEFAULT_MODEL`. Resolve credentials as chat does: client key first, then provider-specific settings. Use request base URL first and configured Ollama URL second. Configure temperature `0.2` and `max_tokens=2500`.

```python
messages = [ChatMessage(role=ChatRole.USER, content=prompt)]
config = ModelConfig(model_name=resolved_model, temperature=0.2, max_tokens=2500)
result = await provider.generate(messages=messages, config=config)
drafts = cls._parse_drafts(result.content, request.count)
```

- [ ] **Step 4: Add failing source/error tests**

Cover missing node, wrong workspace, user-role node, blank assistant node, provider exception, and malformed provider output. Assert service errors, not HTTP codes.

- [ ] **Step 5: Implement safe translation**

Raise `InvalidFlashcardSourceError` for role/content violations. Wrap provider initialization, generation, and parse failures as `FlashcardGenerationError("Flashcard generation failed")`; log IDs, provider, error type, and requested count, but no key/source.

- [ ] **Step 6: Verify and commit**

```bash
uv run pytest apps/api/tests/test_flashcard_generation.py -v
uv run ruff check apps/api/src/services/flashcard_service.py apps/api/tests/test_flashcard_generation.py
uv run mypy apps/api/src/services/flashcard_service.py
git add apps/api/src/services/flashcard_service.py apps/api/tests/test_flashcard_generation.py
git commit -m "feat(api): generate flashcards through ai core"
```

### Task 6: Make Generation Conflict-Safe and Atomic

**Files:**
- Modify: `apps/api/src/services/flashcard_service.py`
- Modify: `apps/api/tests/test_flashcard_generation.py`

**Interfaces:**
- Completes `generate_for_node`.
- A source node serializes final writes through `SELECT ... FOR UPDATE`.

- [ ] **Step 1: Write a failing conflict test**

Generate once, call again with `replace_existing=False`, assert `FlashcardConflictError`, and assert the provider is not called the second time.

- [ ] **Step 2: Write a failing safe-replacement test**

Persist an edited old card, have the provider return two new cards, call with `replace_existing=True`, and assert the old ID is absent and new positions are `[0, 1]`.

- [ ] **Step 3: Write a failing preservation test**

Make regeneration's provider throw or return invalid JSON. Roll back the request transaction and assert the old card still exists unchanged.

- [ ] **Step 4: Implement the transaction order**

1. Read and validate source.
2. Query existing cards; conflict before model call when replacement is false.
3. Generate and validate drafts without deleting anything.
4. Re-select source by workspace/node with `.with_for_update()`.
5. Re-query cards.
6. Conflict if cards appeared and replacement is false.
7. Delete/flush old rows only when replacement is true.
8. Add new rows with zero-based enumerated positions.
9. Flush and return responses.
10. Let `get_db()` own commit/rollback.

- [ ] **Step 5: Verify and commit**

```bash
uv run pytest apps/api/tests/test_flashcard_generation.py -v
git add apps/api/src/services/flashcard_service.py apps/api/tests/test_flashcard_generation.py
git commit -m "feat(api): replace flashcards atomically"
```

### Task 7: Add List, Update, and Delete Services

**Files:**
- Modify: `apps/api/src/services/flashcard_service.py`
- Modify: `apps/api/tests/test_flashcard_generation.py`

**Interfaces:**
- `list_for_node(db, workspace_id, node_id) -> list[FlashcardResponse]`
- `update_card(db, workspace_id, node_id, card_id, data) -> FlashcardResponse`
- `delete_card(db, workspace_id, node_id, card_id) -> None`

- [ ] **Step 1: Write failing ordered-list tests**

Persist positions 2, 0, 1 and assert returned positions are 0, 1, 2. Wrong workspace/node must raise `FlashcardNotFoundError`.

- [ ] **Step 2: Implement ordered listing**

Verify the source node using both path IDs. Select cards using both IDs, ordered by position then created time.

- [ ] **Step 3: Write failing update tests**

Assert trimming, omitted-field preservation, changed `updated_at`, and path scoping. A card from another node/workspace must look missing.

- [ ] **Step 4: Implement update**

Use one private selector constrained by card ID, workspace ID, and source node ID. Apply only fields in `data.model_fields_set`, flush, refresh, convert to response.

- [ ] **Step 5: Write failing delete tests**

Delete exactly one card and confirm remaining ordering. Assert wrong workspace/node/card raises `FlashcardNotFoundError`.

- [ ] **Step 6: Implement delete**

Call `await db.delete(card)`, then `await db.flush()`. Do not renumber remaining positions; stable ordering remains correct.

- [ ] **Step 7: Verify and commit**

```bash
uv run pytest apps/api/tests/test_flashcard_generation.py -v
uv run ruff check apps/api/src/services/flashcard_service.py apps/api/tests/test_flashcard_generation.py
uv run mypy apps/api/src/services/flashcard_service.py
git add apps/api/src/services/flashcard_service.py apps/api/tests/test_flashcard_generation.py
git commit -m "feat(api): manage persisted flashcards"
```

### Task 8: Expose and Secure REST Endpoints

**Files:**
- Create: `apps/api/src/routers/flashcards.py`
- Modify: `apps/api/src/main.py`
- Create: `apps/api/tests/test_flashcard_endpoints.py`

**Interfaces:**
- Produces exactly the four routes in the API table.
- Maps not-found/conflict/invalid-source/generation errors to 404/409/422/502.

- [ ] **Step 1: Write a failing lifecycle test**

With `AsyncClient(ASGITransport(app=app))`, create workspace and assistant node, monkeypatch provider, then generate, list, patch, delete, and list. Assert camelCase keys, ordering, edit persistence, `204` empty body, and final empty list.

- [ ] **Step 2: Confirm 404 route failures**

```bash
uv run pytest apps/api/tests/test_flashcard_endpoints.py -k lifecycle -v
```

- [ ] **Step 3: Implement router and registration**

```python
router = APIRouter(
    prefix="/workspaces/{workspace_id}/nodes/{node_id}/flashcards",
    tags=["Node Flashcards"],
)
```

GET returns `list[FlashcardResponse]` and uses read permission. POST uses 201 plus write permission. PATCH uses write permission. DELETE uses 204 plus write permission. Import/register with:

```python
app.include_router(flashcards.router, prefix="/api/v1")
```

Do not add startup `ALTER TABLE` SQL.

- [ ] **Step 4: Add error-contract tests**

Assert: user node is 422; repeated generation without replacement is 409; invalid provider output is 502 and preserves cards; missing card is 404; counts 0/11 use standardized 422 validation envelopes.

- [ ] **Step 5: Add cross-tenant and viewer tests**

Follow `test_workspace_rbac.py`. An unrelated user must receive 404 for all four operations. A `viewer` member may GET but receives 403 for POST/PATCH/DELETE.

- [ ] **Step 6: Verify and commit**

```bash
uv run pytest apps/api/tests/test_flashcard_endpoints.py -v
uv run pytest apps/api/tests/test_workspace_rbac.py apps/api/tests/test_workspaces.py -v
uv run ruff check apps/api/src/routers/flashcards.py apps/api/src/main.py apps/api/tests/test_flashcard_endpoints.py
uv run mypy apps/api/src/routers/flashcards.py apps/api/src/main.py
git add apps/api/src/routers/flashcards.py apps/api/src/main.py apps/api/tests/test_flashcard_endpoints.py
git commit -m "feat(api): expose node flashcard endpoints"
```

### Task 9: Add Shared Types and the Web API Client

**Files:**
- Modify: `packages/shared/src/index.ts`
- Create: `apps/web/src/lib/flashcardApi.ts`
- Create: `apps/web/src/lib/__tests__/flashcard-api.test.ts`

**Interfaces:**
- Produces `Flashcard`, `FlashcardGenerateInput`, `FlashcardUpdateInput`, `FlashcardGenerationConfig`.
- Client methods throw `ApiError`; they never coerce errors to empty values.

- [ ] **Step 1: Add shared types**

```typescript
export interface Flashcard {
  id: string;
  workspaceId: string;
  sourceNodeId: string;
  question: string;
  answer: string;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface FlashcardGenerateInput {
  count?: number;
  replaceExisting?: boolean;
  provider?: string;
  model?: string;
  apiKey?: string;
  baseUrl?: string;
}

export interface FlashcardUpdateInput {
  question?: string;
  answer?: string;
}
```

- [ ] **Step 2: Write failing client tests**

Mock `global.fetch`. Assert exact encoded path, HTTP method, credentials, and body for all four methods. Return a 502 envelope and assert rejection is `ApiError`.

- [ ] **Step 3: Confirm missing-module failure**

```bash
pnpm --filter @graphmind/shared build
pnpm --filter @graphmind/web test -- src/lib/__tests__/flashcard-api.test.ts
```

- [ ] **Step 4: Implement focused client**

```typescript
import type {
  Flashcard,
  FlashcardGenerateInput,
  FlashcardUpdateInput,
} from "@graphmind/shared";
import { apiClient } from "./apiClient";

export type FlashcardGenerationConfig = Pick<
  FlashcardGenerateInput,
  "provider" | "model" | "apiKey" | "baseUrl"
>;

const basePath = (workspaceId: string, nodeId: string) =>
  "/workspaces/" + encodeURIComponent(workspaceId) +
  "/nodes/" + encodeURIComponent(nodeId) + "/flashcards";

export const listNodeFlashcards = (workspaceId: string, nodeId: string) =>
  apiClient.get<Flashcard[]>(basePath(workspaceId, nodeId));

export const generateNodeFlashcards = (
  workspaceId: string,
  nodeId: string,
  input: FlashcardGenerateInput
) => apiClient.post<Flashcard[]>(basePath(workspaceId, nodeId) + "/generate", input);

export const updateNodeFlashcard = (
  workspaceId: string,
  nodeId: string,
  cardId: string,
  input: FlashcardUpdateInput
) => apiClient.patch<Flashcard>(
  basePath(workspaceId, nodeId) + "/" + encodeURIComponent(cardId),
  input
);

export const deleteNodeFlashcard = (
  workspaceId: string,
  nodeId: string,
  cardId: string
) => apiClient.delete<void>(
  basePath(workspaceId, nodeId) + "/" + encodeURIComponent(cardId)
);
```

- [ ] **Step 5: Verify and commit**

```bash
pnpm --filter @graphmind/shared build
pnpm --filter @graphmind/shared test
pnpm --filter @graphmind/web test -- src/lib/__tests__/flashcard-api.test.ts
pnpm --filter @graphmind/web typecheck
git add packages/shared/src/index.ts apps/web/src/lib/flashcardApi.ts apps/web/src/lib/__tests__/flashcard-api.test.ts
git commit -m "feat(web): add flashcard API client"
```

### Task 10: Build One Flashcard's Review/Edit UI

**Files:**
- Create: `apps/web/src/components/flashcards/FlashcardItem.tsx`
- Create: `apps/web/src/components/flashcards/__tests__/flashcard-item.test.tsx`

**Interfaces:**
- Props: `card`, `onSave(cardId, update)`, `onRequestDelete(card)`, `isBusy`.
- Answer is absent from the DOM until revealed.

- [ ] **Step 1: Write failing reveal tests**

Render a card; assert question visible and answer absent. Activate `Show answer` with keyboard, assert answer and `Hide answer`; hide it again. Verify shared primitives, semantic tokens, and no raw `<button>`.

- [ ] **Step 2: Observe missing component**

```bash
pnpm --filter @graphmind/web test -- src/components/flashcards/__tests__/flashcard-item.test.tsx
```

- [ ] **Step 3: Implement review mode**

Use `Surface radius="card"`, `Badge`, and `Button`. Use `text-sm` for the question and `text-xs` for answer/support copy. Reset revealed state when `card.id` changes.

- [ ] **Step 4: Write failing edit tests**

Activate `Edit flashcard`, assert two labeled `Textarea` controls contain current values, blank either field and assert Save disabled, save valid trimmed text, and assert callback payload. Cancel must not call Save.

- [ ] **Step 5: Implement edit/delete controls**

Use the shared `Textarea` and `Button`; every icon-only control needs an accessible label. `onRequestDelete` asks the parent for confirmation and performs no API call. Disable mutations while busy, but leave reveal usable.

- [ ] **Step 6: Verify and commit**

```bash
pnpm --filter @graphmind/web test -- src/components/flashcards/__tests__/flashcard-item.test.tsx
pnpm --filter @graphmind/web typecheck
git add apps/web/src/components/flashcards/FlashcardItem.tsx apps/web/src/components/flashcards/__tests__/flashcard-item.test.tsx
git commit -m "feat(web): add flashcard review editor"
```

### Task 11: Build Modal Load and First Generation

**Files:**
- Create: `apps/web/src/components/flashcards/FlashcardModal.tsx`
- Create: `apps/web/src/components/flashcards/__tests__/flashcard-modal.test.tsx`

**Interfaces:**
- Props: `isOpen`, `onClose`, `workspaceId`, `nodeId`, `sourcePreview`, `generationConfig`, `onGoToSource`.
- State: closed, loading, showing existing, generating, showing cards, error.

- [ ] **Step 1: Write failing existing-card test**

Mock list returning two cards. Assert title, truncated source preview, two questions, `2 cards`, and no generation call. Close/reopen with another node and assert a fresh request and no stale card.

- [ ] **Step 2: Write failing empty-set test**

Mock list empty and generation returning five cards. Assert GET precedes POST, body is `count: 5`, `replaceExisting: false` plus current generation config, status copy is accessible, and five cards render.

- [ ] **Step 3: Observe missing component**

```bash
pnpm --filter @graphmind/web test -- src/components/flashcards/__tests__/flashcard-modal.test.tsx
```

- [ ] **Step 4: Implement state initialization**

Use `Modal size="2xl"`, `ModalHeader`, `ModalBody`, and `ModalFooter`. Effect keys: open, workspace ID, node ID. Use a cancellation flag; clear previous cards/error, GET, and auto-generate only after successful empty GET. Ignore late results after close/source change. Never auto-generate after failed GET.

- [ ] **Step 5: Add and satisfy error tests**

GET/generation rejection shows `InlineFeedback tone="destructive"` and Retry. Retry repeats only the failed phase. Existing cards remain visible after later mutation errors. Convert unknown errors safely.

- [ ] **Step 6: Add source action**

Footer `Go to source` calls `onGoToSource` exactly once. Parent owns close/scroll/focus.

- [ ] **Step 7: Verify and commit**

```bash
pnpm --filter @graphmind/web test -- src/components/flashcards/__tests__/flashcard-modal.test.tsx
pnpm --filter @graphmind/web test -- src/components/ui/__tests__/design-contract.test.ts
pnpm --filter @graphmind/web typecheck
git add apps/web/src/components/flashcards/FlashcardModal.tsx apps/web/src/components/flashcards/__tests__/flashcard-modal.test.tsx
git commit -m "feat(web): generate flashcards from a response"
```

### Task 12: Add Edit/Delete/Regenerate Orchestration

**Files:**
- Modify: `apps/web/src/components/flashcards/FlashcardModal.tsx`
- Modify: `apps/web/src/components/flashcards/__tests__/flashcard-modal.test.tsx`

**Interfaces:**
- Uses all mutation methods from `flashcardApi.ts`.
- Allows one mutation at a time with `busyCardId` and `isRegenerating`.

- [ ] **Step 1: Write failing edit success/failure tests**

On success, replace only the returned card and preserve order. On failure, retain old local text and show inline error.

- [ ] **Step 2: Implement edit orchestration**

Set busy ID, clear prior error, PATCH, replace by ID only on success, clear busy in `finally`. Do not optimistically change stored display text.

- [ ] **Step 3: Write failing confirmed-delete tests**

Request delete, assert `ConfirmDialog` names the card and no API call occurred, confirm, then assert removal. Rejection keeps the card and shows error.

- [ ] **Step 4: Implement delete orchestration**

Store `pendingDelete: Flashcard | null`. Use destructive `ConfirmDialog` with loading state. Remove locally only after DELETE resolves.

- [ ] **Step 5: Write failing confirmed-regeneration tests**

Regenerate opens confirmation. Confirm POST includes `count: 5`, `replaceExisting: true`, and generation config. Success replaces the entire array; failure retains every old card.

- [ ] **Step 6: Implement regeneration**

Use a separate confirmation dialog. Disable close/mutations while running. Never clear local cards before success.

- [ ] **Step 7: Verify and commit**

```bash
pnpm --filter @graphmind/web test -- src/components/flashcards/__tests__/flashcard-modal.test.tsx src/components/flashcards/__tests__/flashcard-item.test.tsx
pnpm --filter @graphmind/web typecheck
git add apps/web/src/components/flashcards/FlashcardModal.tsx apps/web/src/components/flashcards/__tests__/flashcard-modal.test.tsx
git commit -m "feat(web): manage generated flashcards"
```

### Task 13: Integrate the Assistant Message Action

**Files:**
- Modify: `apps/web/src/components/chat/ChatMessage.tsx`
- Modify: `apps/web/src/components/chat/ChatContainer.tsx`
- Modify: `apps/web/src/components/chat/__tests__/chat-message.test.tsx`

**Interfaces:**
- `ChatMessageProps` gains `flashcardGenerationConfig?: FlashcardGenerationConfig`.
- Eligibility: assistant, workspace ID, non-blank content, not streaming.

- [ ] **Step 1: Write failing eligibility tests**

Mock `FlashcardModal`. Assert action present for eligible assistant, absent for user, streaming assistant, blank assistant, and assistant without workspace ID.

- [ ] **Step 2: Write failing open/focus test**

Click action; assert modal receives workspace/node IDs and source preview. Trigger `onGoToSource`; assert modal closes and source message receives focus after `requestAnimationFrame`.

- [ ] **Step 3: Observe failure**

```bash
pnpm --filter @graphmind/web test -- src/components/chat/__tests__/chat-message.test.tsx
```

- [ ] **Step 4: Add action and modal**

Use a Lucide cards icon and an `IconButton` labeled `Generate or review flashcards` in the assistant action row. Match Copy/Rating hover and focus classes. Add `tabIndex={-1}` to the assistant root. Render the modal beside existing message-level modals.

- [ ] **Step 5: Memoize current generation config in ChatContainer**

```typescript
const flashcardGenerationConfig = useMemo(
  () => ({
    provider: llmConfig.provider,
    model: llmConfig.model,
    apiKey: getEffectiveApiKey(llmConfig.provider),
    baseUrl: getEffectiveBaseUrl(llmConfig.provider),
  }),
  [llmConfig.provider, llmConfig.model, getEffectiveApiKey, getEffectiveBaseUrl]
);
```

Pass it to every main-stream `ChatMessage`. Never persist it in node metadata.

- [ ] **Step 6: Implement source focus using the actual ID**

Use `document.getElementById(message.id)`, not the existing incorrect `msg-` prefix. Close, schedule smooth `scrollIntoView`, then `focus({ preventScroll: true })`. Do not alter routes.

- [ ] **Step 7: Verify and commit**

```bash
pnpm --filter @graphmind/web test -- src/components/chat/__tests__/chat-message.test.tsx src/components/chat/__tests__/chat-container.test.tsx
pnpm --filter @graphmind/web typecheck
git add apps/web/src/components/chat/ChatMessage.tsx apps/web/src/components/chat/ChatContainer.tsx apps/web/src/components/chat/__tests__/chat-message.test.tsx
git commit -m "feat(web): open flashcards from responses"
```

### Task 14: Make It Work in Canvas Side-Peek

**Files:**
- Modify: `apps/web/src/components/chat/SidePeekBranchSheet.tsx`
- Modify: `apps/web/src/components/chat/ChatContainer.tsx`
- Modify: `apps/web/src/components/chat/__tests__/auxiliary-panels.test.tsx`

**Interfaces:**
- Side-peek gains optional `workspaceId` and `flashcardGenerationConfig` props and passes both to nested `ChatMessage`.
- `GraphCanvas` and `ThreadGraphNode` remain unchanged.

- [ ] **Step 1: Write failing side-peek test**

Extend the branch fixture with an assistant response. Render with `workspaceId="ws_test"` and generation config. Assert the action exists and opens the modal for that response ID.

- [ ] **Step 2: Observe failure**

```bash
pnpm --filter @graphmind/web test -- src/components/chat/__tests__/auxiliary-panels.test.tsx
```

- [ ] **Step 3: Forward context**

Import `FlashcardGenerationConfig` as a type. Add/destructure both props and pass them to each `ChatMessage`. Pass current workspace ID and memoized config from `ChatContainer`.

- [ ] **Step 4: Verify cross-surface behavior and commit**

```bash
pnpm --filter @graphmind/web test -- src/components/chat/__tests__/auxiliary-panels.test.tsx src/components/canvas/__tests__/knowledge-canvas.test.tsx src/components/chat/__tests__/cross-surface-learning.test.tsx
pnpm --filter @graphmind/web typecheck
git add apps/web/src/components/chat/SidePeekBranchSheet.tsx apps/web/src/components/chat/ChatContainer.tsx apps/web/src/components/chat/__tests__/auxiliary-panels.test.tsx
git commit -m "feat(web): expose flashcards in canvas side peek"
```

### Task 15: Documentation, Full Verification, and Handoff

**Files:**
- Modify: `docs/ROADMAP.md`
- Modify: `README.md`
- Verify all changed files.

- [ ] **Step 1: Run all backend checks before claiming completion**

```bash
uv run pytest
uv run ruff check
uv run mypy apps/api/src packages/ai-core/src
```

Expected: all pass, or only failures proven identical to preflight. Fix every regression caused by this feature.

- [ ] **Step 2: Run all frontend checks**

```bash
pnpm --filter @graphmind/shared build
pnpm --filter @graphmind/shared test
pnpm --filter @graphmind/web test
pnpm --filter @graphmind/web typecheck
pnpm --filter @graphmind/web build
```

- [ ] **Step 3: Recheck migration on disposable existing-schema DB**

```bash
uv run alembic heads
uv run alembic upgrade head
uv run alembic current
uv run alembic check
```

Expected: current is `20260911_0001`; table/indexes/cascades exist; no flashcard diff. Never downgrade user data.

- [ ] **Step 4: Perform manual owner acceptance**

1. Open an existing assistant response.
2. Activate the action using only the keyboard.
3. Confirm exactly five cards appear and answers start hidden.
4. Reveal and hide an answer.
5. Edit both fields; close/reopen and verify persistence.
6. Request delete, cancel, then confirm; reopen and verify.
7. Request regenerate, cancel, then confirm replacement.
8. Force provider failure during regeneration and verify old cards remain.
9. Use Go to source and verify the correct response scrolls/focuses.
10. Switch to canvas, open a thread side-peek, and repeat open/review.
11. Check light/dark mode at narrow and desktop widths.

- [ ] **Step 5: Perform authorization acceptance**

Verify owner/editor mutation, viewer GET-only behavior, and non-member 404 isolation. Confirm error feedback never removes currently displayed cards.

- [ ] **Step 6: Update documentation only after verification**

Add `Phase 7 — Learning Engine` as `In Progress` to `ROADMAP.md`. Mark only Node-Linked Flashcards complete and name FSRS scheduling as the next unimplemented task. In README, document all four endpoints, source restrictions, replacement behavior, and that first revision `20260911_0001` expects the existing Phase 4 schema and must run before the upgraded API starts.

- [ ] **Step 7: Check documentation truthfulness**

```bash
rg -n "Flashcard|FSRS|Phase 7|20260911_0001" README.md docs/ROADMAP.md docs/FEATURE_RESEARCH.md
rg -n "FSRS.*complete|spaced repetition.*complete" README.md docs/ROADMAP.md
```

Expected: the second command finds no false completion claim.

- [ ] **Step 8: Inspect final diff**

```bash
git diff --check
git status --short
git diff --stat
git diff -- apps/api/src apps/api/tests apps/web/src packages/shared/src README.md docs/ROADMAP.md alembic.ini apps/api/alembic
```

Confirm: no secrets, source-content logs, raw buttons, hard-coded colors, History API calls, FSRS fields, unrelated refactors, or generated artifacts.

- [ ] **Step 9: Commit documentation**

```bash
git add README.md docs/ROADMAP.md
git commit -m "docs: document node-linked flashcards"
```

- [ ] **Step 10: Commit verification fixes only if needed**

If verification changed files, inspect `git status --short`, stage each reviewed file by its exact path, and commit with `git commit -m "test: verify node-linked flashcards"`. Never use `git add .`. Skip this step when verification required no code changes.

- [ ] **Step 11: Report handoff evidence**

Report exact commits, every command and result, pre-existing failures, migration-baseline limitation, manual acceptance results, and the next single task: FSRS scheduling only after review/acceptance.

## Definition of Done

- A persisted assistant response generates 1–10 valid cards; UI requests five.
- Reopening loads existing cards without a model call.
- Answers are hidden until revealed.
- Edits and one-card deletions persist across reopen/reload.
- Regeneration is confirmed and cannot destroy old cards on generation/validation failure.
- All access is workspace scoped with read/write RBAC.
- Node/workspace deletion cascades to cards.
- The action works in main chat and canvas side-peek.
- Go to source closes the modal and focuses the correct response.
- No FSRS, review queue, global deck, route, manual form, or graph-node behavior was added.
- Backend tests/Ruff/MyPy, shared build/tests, web tests/typecheck/build, and migration checks pass or only documented pre-existing failures remain.
