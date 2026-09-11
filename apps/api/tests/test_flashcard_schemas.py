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
