import asyncio
import os
from typing import AsyncIterator, List, Optional

import structlog
from google import genai
from google.genai import types

from ai_core.base import (
    BaseLLMProvider,
    ChatMessage,
    ChatRole,
    GenerationResult,
    MessageInput,
    ModelConfig,
    StreamChunk,
)

logger = structlog.get_logger()

MAX_RETRIES = 3
INITIAL_BACKOFF_SECONDS = 1.0


def _is_transient_error(exc: Exception) -> bool:
    """Determine whether an exception is a transient error suitable for retry."""
    err_msg = str(exc).lower()
    return (
        "503" in err_msg
        or "unavailable" in err_msg
        or "429" in err_msg
        or "resource_exhausted" in err_msg
        or "rate limit" in err_msg
        or "overloaded" in err_msg
    )


class GeminiProvider(BaseLLMProvider):
    """
    Google Gemini foundation model provider implementation using the official google-genai SDK
    with native async streaming, structured multi-turn conversation support, and exponential backoff.
    """

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY environment variable is not set.")
        self.client = genai.Client(api_key=self.api_key)

    def _to_genai_contents(self, messages: List[ChatMessage]) -> List[types.Content]:
        """Convert normalized ChatMessage objects into structured Gemini types.Content."""
        contents: List[types.Content] = []
        for msg in messages:
            if not msg.content:
                continue
            role = "model" if msg.role == ChatRole.ASSISTANT else "user"
            contents.append(
                types.Content(
                    role=role,
                    parts=[types.Part.from_text(text=msg.content)],
                )
            )
        return contents

    async def generate(
        self,
        messages: MessageInput,
        config: Optional[ModelConfig] = None,
    ) -> GenerationResult:
        cfg = config or ModelConfig(model_name="gemini-2.5-flash")
        normalized = self._normalize_messages(messages)
        contents = self._to_genai_contents(normalized)

        if not contents:
            return GenerationResult(
                content="",
                role=ChatRole.ASSISTANT,
                model_name=cfg.model_name,
            )

        last_exception: Optional[Exception] = None
        for attempt in range(1, MAX_RETRIES + 1):
            try:
                response = await self.client.aio.models.generate_content(
                    model=cfg.model_name,
                    contents=contents,
                )
                return GenerationResult(
                    content=response.text or "",
                    role=ChatRole.ASSISTANT,
                    model_name=cfg.model_name,
                )
            except Exception as e:
                last_exception = e
                if _is_transient_error(e) and attempt < MAX_RETRIES:
                    backoff = INITIAL_BACKOFF_SECONDS * (2 ** (attempt - 1))
                    logger.warning(
                        "Gemini API transient error, retrying with backoff",
                        attempt=attempt,
                        backoff=backoff,
                        error=str(e),
                    )
                    await asyncio.sleep(backoff)
                else:
                    break

        logger.error(
            "Gemini generation failed after retries",
            error=str(last_exception),
            model=cfg.model_name,
        )
        if last_exception and _is_transient_error(last_exception):
            raise RuntimeError(
                "Google Gemini service is temporarily unavailable (503). Please click Retry in a few seconds."
            )
        raise last_exception or RuntimeError("Gemini generation failed.")

    async def stream(
        self,
        messages: MessageInput,
        config: Optional[ModelConfig] = None,
    ) -> AsyncIterator[StreamChunk]:
        cfg = config or ModelConfig(model_name="gemini-2.5-flash")
        normalized = self._normalize_messages(messages)
        contents = self._to_genai_contents(normalized)

        if not contents:
            return

        last_exception: Optional[Exception] = None
        for attempt in range(1, MAX_RETRIES + 1):
            try:
                response_stream = await self.client.aio.models.generate_content_stream(
                    model=cfg.model_name,
                    contents=contents,
                )
                async for chunk in response_stream:
                    if chunk.text:
                        yield StreamChunk(content=chunk.text)
                return
            except Exception as e:
                last_exception = e
                if _is_transient_error(e) and attempt < MAX_RETRIES:
                    backoff = INITIAL_BACKOFF_SECONDS * (2 ** (attempt - 1))
                    logger.warning(
                        "Gemini API stream transient error, retrying stream connection",
                        attempt=attempt,
                        backoff=backoff,
                        error=str(e),
                    )
                    await asyncio.sleep(backoff)
                else:
                    break

        logger.error(
            "Gemini streaming failed after retries", error=str(last_exception), model=cfg.model_name
        )
        if last_exception and _is_transient_error(last_exception):
            raise RuntimeError(
                "Google Gemini service is temporarily unavailable (503). Please click Retry in a few seconds."
            )
        raise last_exception or RuntimeError("Gemini streaming failed.")
