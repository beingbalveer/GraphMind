"""LSI-035: flashcard source-node/workspace linkage and cascade semantics.

These tests exercise the real service/DB paths that the UI uses to delete a
branch (``WorkspaceService.delete_branch``), delete a workspace
(``WorkspaceService.delete_workspace``), and to read/write flashcards. They run
against the isolated ``*_test`` database enforced by ``tests/conftest.py``.
"""

from unittest.mock import AsyncMock, patch

import pytest
from ai_core import ChatRole, GenerationResult
from database import get_session_factory
from models.flashcard import FlashcardModel
from models.workspace import NodeModel, Workspace
from schemas.flashcard import FlashcardGenerateRequest, FlashcardUpdate
from services.flashcard_service import FlashcardNotFoundError, FlashcardService
from services.workspace_service import WorkspaceService
from sqlalchemy import func, select


def _fake_provider(question: str) -> AsyncMock:
    provider = AsyncMock()
    provider.generate.return_value = GenerationResult(
        content=f'{{"cards":[{{"question":"{question}","answer":"Answer."}}]}}',
        role=ChatRole.ASSISTANT,
        model_name="fake-model",
    )
    return provider


async def _seed_workspace_with_cards(
    session_factory,
    *,
    label: str,
    with_child: bool = False,
) -> tuple[str, str, str | None]:
    """Create a workspace + assistant node(s) and generate one card per node."""
    async with session_factory() as session:
        ws = Workspace(name=f"{label} workspace", owner_id="usr_default_admin")
        session.add(ws)
        await session.flush()

        parent = NodeModel(
            workspace_id=ws.id,
            role="assistant",
            content=f"{label} parent source content for flashcard generation.",
        )
        session.add(parent)
        await session.flush()

        child_id: str | None = None
        if with_child:
            child = NodeModel(
                workspace_id=ws.id,
                parent_id=parent.id,
                role="assistant",
                content=f"{label} child source content for flashcard generation.",
            )
            session.add(child)
            await session.flush()
            child_id = child.id

        await session.commit()
        ws_id, parent_id = ws.id, parent.id

    with patch(
        "services.flashcard_service.get_provider",
        return_value=_fake_provider(f"{label} parent?"),
    ):
        async with session_factory() as session:
            parent_cards = await FlashcardService.generate_for_node(
                session, ws_id, parent_id, FlashcardGenerateRequest(count=3)
            )
            await session.commit()
            assert parent_cards[0].source_node_id == parent_id
            assert parent_cards[0].workspace_id == ws_id

    if child_id is not None:
        with patch(
            "services.flashcard_service.get_provider",
            return_value=_fake_provider(f"{label} child?"),
        ):
            async with session_factory() as session:
                child_cards = await FlashcardService.generate_for_node(
                    session, ws_id, child_id, FlashcardGenerateRequest(count=3)
                )
                await session.commit()
                assert child_cards[0].source_node_id == child_id

    return ws_id, parent_id, child_id


async def _count_cards(session, workspace_id: str) -> int:
    stmt = (
        select(func.count())
        .select_from(FlashcardModel)
        .where(FlashcardModel.workspace_id == workspace_id)
    )
    return int((await session.execute(stmt)).scalar_one())


@pytest.mark.asyncio
async def test_deleting_source_branch_cascades_flashcards() -> None:
    """Deleting a node (and its descendants) removes every linked flashcard."""
    session_factory = get_session_factory()
    ws_id, parent_id, child_id = await _seed_workspace_with_cards(
        session_factory, label="branch-cascade", with_child=True
    )
    assert child_id is not None

    async with session_factory() as session:
        assert await _count_cards(session, ws_id) == 2

    async with session_factory() as session:
        deleted = await WorkspaceService.delete_branch(session, ws_id, parent_id)
        await session.commit()
        assert deleted is True

    async with session_factory() as session:
        # Both the parent and its descendant are gone, so both cards cascade away.
        assert await _count_cards(session, ws_id) == 0
        assert await session.get(NodeModel, parent_id) is None
        assert await session.get(NodeModel, child_id) is None


@pytest.mark.asyncio
async def test_deleting_workspace_cascades_flashcards() -> None:
    """Deleting the workspace removes its nodes and every linked flashcard."""
    session_factory = get_session_factory()
    ws_id, _, child_id = await _seed_workspace_with_cards(
        session_factory, label="workspace-cascade", with_child=True
    )
    assert child_id is not None

    async with session_factory() as session:
        assert await _count_cards(session, ws_id) == 2

    async with session_factory() as session:
        deleted = await WorkspaceService.delete_workspace(session, ws_id)
        await session.commit()
        assert deleted is True

    async with session_factory() as session:
        assert await _count_cards(session, ws_id) == 0
        assert await session.get(Workspace, ws_id) is None


@pytest.mark.asyncio
async def test_flashcard_linkage_is_scoped_to_source_node_and_workspace() -> None:
    """Cards keep their exact source node/workspace linkage and reject others."""
    session_factory = get_session_factory()
    ws_id, parent_id, child_id = await _seed_workspace_with_cards(
        session_factory, label="linkage", with_child=True
    )
    assert child_id is not None

    async with session_factory() as session:
        parent_cards = await FlashcardService.list_for_node(session, ws_id, parent_id)
        child_cards = await FlashcardService.list_for_node(session, ws_id, child_id)

        assert len(parent_cards) == 1
        assert len(child_cards) == 1
        assert parent_cards[0].source_node_id == parent_id
        assert parent_cards[0].workspace_id == ws_id
        assert child_cards[0].source_node_id == child_id
        assert child_cards[0].workspace_id == ws_id

        # Cards are addressable only through their exact source node.
        with pytest.raises(FlashcardNotFoundError):
            await FlashcardService.update_card(
                session,
                ws_id,
                child_id,
                parent_cards[0].id,
                FlashcardUpdate(question="Cross-node edit?"),
            )
        with pytest.raises(FlashcardNotFoundError):
            await FlashcardService.delete_card(
                session, ws_id, child_id, parent_cards[0].id
            )

        # A card cannot be reached from a different workspace either.
        other = Workspace(name="linkage-other", owner_id="usr_default_admin")
        session.add(other)
        await session.flush()
        with pytest.raises(FlashcardNotFoundError):
            await FlashcardService.list_for_node(session, other.id, parent_id)
        await session.rollback()
