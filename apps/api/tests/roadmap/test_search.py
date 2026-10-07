from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from google.genai import types
from services.roadmap.search import GeminiSearchBackend, SearchError


async def public_dns(host, port):
    return ["93.184.215.14"]


def search_client(grounding):
    return SimpleNamespace(
        aio=SimpleNamespace(
            models=SimpleNamespace(
                generate_content=AsyncMock(
                    return_value=types.GenerateContentResponse(
                        candidates=[types.Candidate(grounding_metadata=grounding)]
                    )
                )
            )
        )
    )


def grounded_response(url="https://example.com/drawing"):
    return types.GroundingMetadata.model_validate(
        {
            "groundingChunks": [{"web": {"uri": url, "title": "A real drawing curriculum"}}],
            "webSearchQueries": ["beginner drawing curriculum"],
            "groundingSupports": [
                {
                    "groundingChunkIndices": [0],
                    "segment": {
                        "startIndex": 0,
                        "endIndex": 29,
                        "text": "Practice line and perspective.",
                    },
                    "confidenceScores": [0.9],
                }
            ],
            "searchEntryPoint": {"renderedContent": "<div>Google search attribution</div>"},
        }
    )


async def test_actual_grounding_and_attribution_survive_normalization():
    grounding = grounded_response()
    client = search_client(grounding)
    result = await GeminiSearchBackend(
        api_key="test-key", model="test-model", client=client, resolver=public_dns
    ).search("beginner drawing curriculum")
    assert result.results[0].url == "https://example.com/drawing"
    assert result.results[0].snippet == "Practice line and perspective."
    assert result.results[0].provenance["supported"] is True
    assert result.results[0].provenance["grounding"] == grounding.model_dump(
        mode="json", exclude_none=True
    )
    assert result.attribution_html == "<div>Google search attribution</div>"
    assert result.queries == ["beginner drawing curriculum"]
    call = client.aio.models.generate_content.call_args.kwargs
    assert call["config"].tools[0].google_search is not None


async def test_model_prose_without_grounding_is_not_research():
    client = search_client(None)
    with pytest.raises(SearchError) as error:
        await GeminiSearchBackend(api_key="test-key", model="test-model", client=client).search(
            "beginner drawing curriculum"
        )
    assert error.value.code == "SEARCH_UNGROUNDED"


async def test_missing_key_never_calls_provider():
    client = search_client(grounded_response())
    with pytest.raises(SearchError) as error:
        await GeminiSearchBackend(api_key="", model="test-model", client=client).search(
            "beginner drawing curriculum"
        )
    assert (
        error.value.code == "SEARCH_NOT_CONFIGURED"
        and error.value.error.next_action == "configure_search"
    )
    client.aio.models.generate_content.assert_not_awaited()


async def test_ungrounded_chunks_remain_candidates():
    grounding = grounded_response()
    grounding.grounding_supports = []
    result = await GeminiSearchBackend(
        api_key="test-key", model="test-model", client=search_client(grounding), resolver=public_dns
    ).search("beginner drawing curriculum")
    assert result.results[0].provenance["supported"] is False
    assert result.results[0].snippet == ""


async def test_provider_cannot_authorize_local_source():
    with pytest.raises(SearchError) as error:
        await GeminiSearchBackend(
            api_key="test-key",
            model="test-model",
            client=search_client(grounded_response("http://localhost/admin")),
            resolver=public_dns,
        ).search("beginner drawing curriculum")
    assert error.value.code == "SEARCH_UNSAFE_SOURCE"


async def test_provider_dns_private_source_is_rejected():
    async def private_dns(host, port):
        return ["10.0.0.4"]

    with pytest.raises(SearchError) as error:
        await GeminiSearchBackend(
            api_key="test-key",
            model="test-model",
            client=search_client(grounded_response()),
            resolver=private_dns,
        ).search("beginner drawing curriculum")
    assert error.value.code == "SEARCH_UNSAFE_SOURCE"


async def test_search_network_failure_stays_recoverable():
    client = search_client(None)
    client.aio.models.generate_content.side_effect = RuntimeError("private raw provider details")
    with pytest.raises(SearchError) as error:
        await GeminiSearchBackend(api_key="test-key", model="test-model", client=client).search(
            "beginner drawing curriculum"
        )
    assert error.value.error.recoverable and error.value.error.next_action == "retry"
    assert "private raw" not in str(error.value)


async def test_duplicate_url_preserves_citation_from_later_chunk():
    grounding = grounded_response()
    grounding.grounding_chunks.append(grounding.grounding_chunks[0].model_copy(deep=True))
    grounding.grounding_supports[0].grounding_chunk_indices = [1]
    response = await GeminiSearchBackend(
        api_key="test-key", model="test-model", client=search_client(grounding), resolver=public_dns
    ).search("beginner drawing curriculum")
    assert len(response.results) == 1
    assert response.results[0].snippet == "Practice line and perspective."
    assert response.results[0].provenance["supported"] is True


async def test_citation_byte_offsets_recover_missing_segment_text():
    grounding = grounded_response()
    grounding.grounding_supports[0].segment = types.Segment(
        start_index=3, end_index=8, part_index=0
    )
    client = search_client(grounding)
    client.aio.models.generate_content.return_value.candidates[0].content = types.Content(
        parts=[types.Part(text="é Learn drawing")]
    )
    response = await GeminiSearchBackend(
        api_key="test-key", model="test-model", client=client, resolver=public_dns
    ).search("drawing curriculum")
    assert response.results[0].snippet == "Learn"
