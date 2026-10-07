import asyncio
import json
from collections.abc import Awaitable, Callable
from datetime import datetime, timezone
from typing import Any, Protocol

from google import genai
from google.genai import errors, types
from pydantic import Field, JsonValue, TypeAdapter
from schemas.curriculum import CurriculumSchema
from schemas.roadmap_job import JobError
from services.roadmap.job_repository import JobStateError
from services.roadmap.source_fetcher import (
    SourceFetchError,
    canonical_source_url,
    public_address,
    resolve_public_host,
    validate_source_url,
)


class SearchResult(CurriculumSchema):
    title: str = Field(min_length=1, max_length=1000)
    url: str = Field(min_length=1, max_length=2048)
    snippet: str = Field(max_length=32768)
    provenance: dict[str, JsonValue]


class SearchResponse(CurriculumSchema):
    results: list[SearchResult]
    queries: list[str]
    attribution_html: str | None
    provider: str
    searched_at: datetime


class SearchBackend(Protocol):
    def require_configured(self) -> None: ...

    async def search(self, query: str) -> SearchResponse: ...


class SearchError(JobStateError):
    def __init__(
        self, code: str, message: str, *, recoverable: bool = True, configure: bool = False
    ) -> None:
        super().__init__(
            code,
            message,
            error=JobError(
                code=code,
                message=message,
                recoverable=recoverable,
                next_action="configure_search"
                if configure
                else "retry"
                if recoverable
                else "new_run",
            ),
        )


class GeminiSearchBackend:
    """One SDK invocation per attempt; internal retries are disabled for honest usage."""

    def __init__(
        self,
        api_key: str,
        model: str,
        client: Any | None = None,
        *,
        resolver: Callable[[str, int], Awaitable[list[str]]] = resolve_public_host,
    ) -> None:
        self.api_key = api_key
        self.model = model
        self.client = client
        self.resolver = resolver

    def require_configured(self) -> None:
        if not self.api_key:
            raise SearchError(
                "SEARCH_NOT_CONFIGURED",
                "Configure a Google search API key to research this roadmap.",
                configure=True,
            )

    async def search(self, query: str) -> SearchResponse:
        self.require_configured()
        if not 1 <= len(query.strip()) <= 500:
            raise SearchError(
                "SEARCH_QUERY_INVALID",
                "Use a topical query within 500 characters",
                recoverable=False,
            )
        owned = self.client is None
        client = self.client or genai.Client(
            api_key=self.api_key,
            http_options=types.HttpOptions(
                timeout=45000, retry_options=types.HttpRetryOptions(attempts=1)
            ),
        )
        try:
            async with asyncio.timeout(45):
                response = await client.aio.models.generate_content(
                    model=self.model,
                    contents=query.strip(),
                    config=types.GenerateContentConfig(
                        tools=[types.Tool(google_search=types.GoogleSearch())],
                        temperature=0.1,
                        max_output_tokens=4096,
                    ),
                )
                candidate = response.candidates[0] if response.candidates else None
                grounding = candidate.grounding_metadata if candidate else None
                if grounding is None or not grounding.grounding_chunks:
                    raise SearchError(
                        "SEARCH_UNGROUNDED", "Search returned no usable source evidence"
                    )
                parts = candidate.content.parts if candidate and candidate.content else []
                text_parts = [(part.text or "") if not part.thought else "" for part in parts or []]
                return await self._normalize(grounding, text_parts)
        except SearchError:
            raise
        except (TimeoutError, asyncio.TimeoutError):
            raise SearchError(
                "SEARCH_TIMEOUT", "Search took too long. Retry to continue."
            ) from None
        except errors.APIError as error:
            if error.code in {400, 401, 403, 404}:
                raise SearchError(
                    "SEARCH_NOT_CONFIGURED",
                    "Check the configured Google search key and model.",
                    configure=True,
                ) from None
            raise SearchError(
                "SEARCH_RATE_LIMITED" if error.code == 429 else "SEARCH_UNAVAILABLE",
                "Search is temporarily unavailable. Retry to continue.",
            ) from None
        except Exception:
            raise SearchError(
                "SEARCH_UNAVAILABLE", "Search is temporarily unavailable. Retry to continue."
            ) from None
        finally:
            if owned:
                await client.aio.aclose()

    async def _normalize(
        self, grounding: types.GroundingMetadata, text_parts: list[str]
    ) -> SearchResponse:
        raw = TypeAdapter(dict[str, JsonValue]).validate_python(
            grounding.model_dump(mode="json", exclude_none=True)
        )
        if len(json.dumps(raw).encode()) > 1024 * 1024:
            raise SearchError(
                "SEARCH_RESULT_LIMIT", "Search returned too much metadata. Use a narrower query."
            )
        results: list[SearchResult] = []
        grouped: dict[str, tuple[str, list[int]]] = {}
        for index, chunk in enumerate(grounding.grounding_chunks or []):
            web = chunk.web
            if web is None or not web.uri or not web.title:
                continue
            try:
                url = canonical_source_url(web.uri)
                parsed = validate_source_url(url)
                addresses = await self.resolver(
                    parsed.hostname or "", parsed.port or (443 if parsed.scheme == "https" else 80)
                )
                if not addresses or not all(public_address(address) for address in addresses):
                    raise SourceFetchError("URL_BLOCKED", "Nonpublic source")
            except SourceFetchError:
                raise SearchError(
                    "SEARCH_UNSAFE_SOURCE",
                    "Search returned a nonpublic source that cannot be used",
                    recoverable=False,
                ) from None
            if url not in grouped:
                grouped[url] = (web.title, [])
            grouped[url][1].append(index)
        for url, (title, indices) in grouped.items():
            evidence: list[str] = []
            for support in grounding.grounding_supports or []:
                if (
                    not set(indices).intersection(support.grounding_chunk_indices or [])
                    or support.segment is None
                ):
                    continue
                segment = support.segment
                text = segment.text
                part_index = segment.part_index or 0
                if (
                    not text
                    and part_index < len(text_parts)
                    and segment.start_index is not None
                    and segment.end_index is not None
                ):
                    text = (
                        text_parts[part_index]
                        .encode("utf-8")[segment.start_index : segment.end_index]
                        .decode("utf-8", errors="ignore")
                    )
                if text:
                    evidence.append(text)
            snippet = "\n".join(dict.fromkeys(evidence))[:32768]
            results.append(
                SearchResult(
                    title=title,
                    url=url,
                    snippet=snippet,
                    provenance={
                        "supported": bool(snippet),
                        "chunkIndices": [index for index in indices],
                        "grounding": raw,
                        "trust": "untrusted_evidence",
                    },
                )
            )
        if not results:
            raise SearchError(
                "SEARCH_UNGROUNDED", "Search returned no usable web source candidates"
            )
        entry = grounding.search_entry_point
        return SearchResponse(
            results=results,
            queries=grounding.web_search_queries or [],
            attribution_html=entry.rendered_content if entry else None,
            provider="gemini_google_search",
            searched_at=datetime.now(timezone.utc),
        )
