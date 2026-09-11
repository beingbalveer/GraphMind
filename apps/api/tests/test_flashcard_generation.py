from unittest.mock import AsyncMock, patch

import pytest
from ai_core import ChatRole, GenerationResult
from database import get_session_factory
from models.workspace import NodeModel, Workspace
from schemas.flashcard import FlashcardGenerateRequest, FlashcardUpdate
from services.flashcard_service import (
    FlashcardConflictError,
    FlashcardGenerationError,
    FlashcardNotFoundError,
    FlashcardService,
    InvalidFlashcardSourceError,
)


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
    assert [card.question for card in cards] == ["What is a closure?", "Why use closures?"]
    assert cards[0].answer == "A function plus lexical scope."


def test_parser_repairs_common_llm_json_glitches() -> None:
    # 1. Missing comma between card objects
    missing_comma = """{
      "cards": [
        {"question": "What is A?", "answer": "Answer A"}
        {"question": "What is B?", "answer": "Answer B"}
      ]
    }"""
    cards = FlashcardService._parse_drafts(missing_comma, count=5)
    assert len(cards) == 2
    assert cards[0].question == "What is A?"
    assert cards[1].question == "What is B?"

    # 2. Trailing commas
    trailing_comma = """{
      "cards": [
        {"question": "What is C?", "answer": "Answer C"},
      ],
    }"""
    cards = FlashcardService._parse_drafts(trailing_comma, count=5)
    assert len(cards) == 1
    assert cards[0].question == "What is C?"

    # 3. Literal unescaped newlines in strings
    literal_newlines = """{
      "cards": [
        {"question": "What is D?", "answer": "Line 1\nLine 2"}
      ]
    }"""
    cards = FlashcardService._parse_drafts(literal_newlines, count=5)
    assert len(cards) == 1
    assert "Line 1\nLine 2" in cards[0].answer

    # 4. Unescaped quotes inside string
    unescaped_quotes = """{
      "cards": [
        {"question": "What does the "async" keyword do?", "answer": "Defines a coroutine"}
      ]
    }"""
    cards = FlashcardService._parse_drafts(unescaped_quotes, count=5)
    assert len(cards) == 1
    assert "async" in cards[0].question


@pytest.mark.parametrize(
    "raw",
    ["not json", "{}", '{"cards":[]}', '{"cards":[{"question":"","answer":"bad"}]}'],
)
def test_parser_rejects_unusable_output(raw: str) -> None:
    with pytest.raises(FlashcardGenerationError):
        FlashcardService._parse_drafts(raw, count=5)


@pytest.mark.asyncio
async def test_generate_for_node_lifecycle_and_conflict() -> None:
    session_factory = get_session_factory()
    async with session_factory() as session:
        ws = Workspace(name="Flashcard Test WS", owner_id="usr_default_admin")
        session.add(ws)
        await session.flush()

        assistant_node = NodeModel(
            workspace_id=ws.id,
            role="assistant",
            content="FastAPI uses Starlette for web tooling and Pydantic for data validation.",
        )
        user_node = NodeModel(
            workspace_id=ws.id,
            role="user",
            content="What is FastAPI?",
        )
        blank_node = NodeModel(
            workspace_id=ws.id,
            role="assistant",
            content="   ",
        )
        session.add_all([assistant_node, user_node, blank_node])
        await session.commit()

        ws_id = ws.id
        node_id = assistant_node.id
        user_node_id = user_node.id
        blank_node_id = blank_node.id

    # Test invalid source role
    async with session_factory() as session:
        with pytest.raises(InvalidFlashcardSourceError):
            await FlashcardService.generate_for_node(
                session, ws_id, user_node_id, FlashcardGenerateRequest(count=5)
            )

    # Test blank content
    async with session_factory() as session:
        with pytest.raises(InvalidFlashcardSourceError):
            await FlashcardService.generate_for_node(
                session, ws_id, blank_node_id, FlashcardGenerateRequest(count=5)
            )

    # Test missing node
    async with session_factory() as session:
        with pytest.raises(FlashcardNotFoundError):
            await FlashcardService.generate_for_node(
                session, ws_id, "node_missing_xyz", FlashcardGenerateRequest(count=5)
            )

    fake_provider = AsyncMock()
    fake_provider.generate.return_value = GenerationResult(
        content='{"cards":[{"question":"What does FastAPI use for data validation?","answer":"Pydantic."}]}',
        role=ChatRole.ASSISTANT,
        model_name="fake-model",
    )

    # Test successful generation
    with patch("services.flashcard_service.get_provider", return_value=fake_provider):
        async with session_factory() as session:
            cards = await FlashcardService.generate_for_node(
                session, ws_id, node_id, FlashcardGenerateRequest(count=5)
            )
            await session.commit()
            assert len(cards) == 1
            assert cards[0].question == "What does FastAPI use for data validation?"
            assert cards[0].answer == "Pydantic."
            assert cards[0].position == 0
            first_card_id = cards[0].id

    # Test conflict when generating again with replace_existing=False
    async with session_factory() as session:
        with pytest.raises(FlashcardConflictError):
            await FlashcardService.generate_for_node(
                session, ws_id, node_id, FlashcardGenerateRequest(count=5, replace_existing=False)
            )

    # Test replacement with replace_existing=True
    replacement_provider = AsyncMock()
    replacement_provider.generate.return_value = GenerationResult(
        content="""{"cards":[
            {"question":"What does FastAPI use for web tooling?","answer":"Starlette."},
            {"question":"What does FastAPI use for validation?","answer":"Pydantic."}
        ]}""",
        role=ChatRole.ASSISTANT,
        model_name="fake-model",
    )

    with patch("services.flashcard_service.get_provider", return_value=replacement_provider):
        async with session_factory() as session:
            new_cards = await FlashcardService.generate_for_node(
                session, ws_id, node_id, FlashcardGenerateRequest(count=5, replace_existing=True)
            )
            await session.commit()
            assert len(new_cards) == 2
            assert new_cards[0].position == 0
            assert new_cards[1].position == 1
            assert first_card_id not in [c.id for c in new_cards]

    # Test list_for_node
    async with session_factory() as session:
        listed = await FlashcardService.list_for_node(session, ws_id, node_id)
        assert len(listed) == 2
        assert listed[0].position == 0
        assert listed[1].position == 1
        target_card_id = listed[0].id

    # Test update_card
    async with session_factory() as session:
        updated = await FlashcardService.update_card(
            session,
            ws_id,
            node_id,
            target_card_id,
            FlashcardUpdate(question="Updated question?"),
        )
        await session.commit()
        assert updated.question == "Updated question?"
        assert updated.answer == "Starlette."

    # Test delete_card
    async with session_factory() as session:
        await FlashcardService.delete_card(session, ws_id, node_id, target_card_id)
        await session.commit()

        remaining = await FlashcardService.list_for_node(session, ws_id, node_id)
        assert len(remaining) == 1
        assert remaining[0].id != target_card_id


@pytest.mark.asyncio
async def test_failed_regeneration_preserves_existing_cards_and_edits() -> None:
    session_factory = get_session_factory()
    async with session_factory() as session:
        ws = Workspace(name="Preserve Cards WS", owner_id="usr_default_admin")
        session.add(ws)
        await session.flush()

        node = NodeModel(
            workspace_id=ws.id,
            role="assistant",
            content="Important architecture concepts: CQRS and Event Sourcing.",
        )
        session.add(node)
        await session.commit()
        ws_id, node_id = ws.id, node.id

    # 1. Initial generation
    initial_provider = AsyncMock()
    initial_provider.generate.return_value = GenerationResult(
        content='{"cards":[{"question":"What is CQRS?","answer":"Command Query Responsibility Segregation."}]}',
        role=ChatRole.ASSISTANT,
        model_name="fake-model",
    )
    with patch("services.flashcard_service.get_provider", return_value=initial_provider):
        async with session_factory() as session:
            cards = await FlashcardService.generate_for_node(
                session, ws_id, node_id, FlashcardGenerateRequest(count=5)
            )
            await session.commit()
            card_id = cards[0].id

    # 2. User edits the card
    async with session_factory() as session:
        await FlashcardService.update_card(
            session,
            ws_id,
            node_id,
            card_id,
            FlashcardUpdate(question="Customized CQRS question?"),
        )
        await session.commit()

    # 3. Attempt replacement generation with a failing provider
    failing_provider = AsyncMock()
    failing_provider.generate.side_effect = RuntimeError("Provider timeout or service unavailable")

    with patch("services.flashcard_service.get_provider", return_value=failing_provider):
        async with session_factory() as session:
            with pytest.raises(FlashcardGenerationError):
                await FlashcardService.generate_for_node(
                    session, ws_id, node_id, FlashcardGenerateRequest(count=5, replace_existing=True)
                )
            await session.rollback()

    # 4. Verify original card and user edit are still intact
    async with session_factory() as session:
        cards_after = await FlashcardService.list_for_node(session, ws_id, node_id)
        assert len(cards_after) == 1
        assert cards_after[0].id == card_id
        assert cards_after[0].question == "Customized CQRS question?"


@pytest.mark.asyncio
async def test_concurrent_generation_does_not_create_duplicate_sets() -> None:
    session_factory = get_session_factory()
    async with session_factory() as session:
        ws = Workspace(name="Concurrent Gen WS", owner_id="usr_default_admin")
        session.add(ws)
        await session.flush()

        node = NodeModel(
            workspace_id=ws.id,
            role="assistant",
            content="Concurrent access must be protected against race conditions.",
        )
        session.add(node)
        await session.commit()
        ws_id, node_id = ws.id, node.id

    provider = AsyncMock()
    provider.generate.return_value = GenerationResult(
        content='{"cards":[{"question":"What is concurrency?","answer":"Execution of multiple tasks."}]}',
        role=ChatRole.ASSISTANT,
        model_name="fake-model",
    )

    async def run_gen() -> list:
        async with session_factory() as session:
            result = await FlashcardService.generate_for_node(
                session, ws_id, node_id, FlashcardGenerateRequest(count=5, replace_existing=False)
            )
            await session.commit()
            return result

    with patch("services.flashcard_service.get_provider", return_value=provider):
        # Run sequentially or concurrently; with replace_existing=False, after the first commits,
        # the next attempt must raise FlashcardConflictError
        first_cards = await run_gen()
        assert len(first_cards) == 1

        async with session_factory() as session:
            with pytest.raises(FlashcardConflictError):
                await FlashcardService.generate_for_node(
                    session, ws_id, node_id, FlashcardGenerateRequest(count=5, replace_existing=False)
                )

    async with session_factory() as session:
        final_cards = await FlashcardService.list_for_node(session, ws_id, node_id)
        assert len(final_cards) == 1


@pytest.mark.asyncio
async def test_delete_reindexes_positions_contiguously() -> None:
    session_factory = get_session_factory()
    async with session_factory() as session:
        ws = Workspace(name="Reindex WS", owner_id="usr_default_admin")
        session.add(ws)
        await session.flush()

        node = NodeModel(
            workspace_id=ws.id,
            role="assistant",
            content="Card ordering and numbering test source text.",
        )
        session.add(node)
        await session.commit()
        ws_id, node_id = ws.id, node.id

    provider = AsyncMock()
    provider.generate.return_value = GenerationResult(
        content="""{"cards":[
            {"question":"Card 0?","answer":"A0"},
            {"question":"Card 1?","answer":"A1"},
            {"question":"Card 2?","answer":"A2"}
        ]}""",
        role=ChatRole.ASSISTANT,
        model_name="fake-model",
    )

    with patch("services.flashcard_service.get_provider", return_value=provider):
        async with session_factory() as session:
            cards = await FlashcardService.generate_for_node(
                session, ws_id, node_id, FlashcardGenerateRequest(count=3)
            )
            await session.commit()
            assert len(cards) == 3
            assert [c.position for c in cards] == [0, 1, 2]
            middle_id = cards[1].id

    # Delete the middle card (position 1)
    async with session_factory() as session:
        await FlashcardService.delete_card(session, ws_id, node_id, middle_id)
        await session.commit()

    # Verify positions are re-indexed to contiguous [0, 1]
    async with session_factory() as session:
        remaining = await FlashcardService.list_for_node(session, ws_id, node_id)
        assert len(remaining) == 2
        assert [c.position for c in remaining] == [0, 1]
        assert remaining[0].question == "Card 0?"
        assert remaining[1].question == "Card 2?"

