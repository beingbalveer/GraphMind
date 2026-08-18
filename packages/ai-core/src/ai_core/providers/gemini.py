import asyncio
import os
from typing import Any, AsyncIterator, Iterator, Optional

from google import genai

from ai_core.base import (
    BaseLLMProvider,
    ChatRole,
    GenerationResult,
    MessageInput,
    ModelConfig,
    StreamChunk,
)


class GeminiProvider(BaseLLMProvider):
    """
    Google Gemini foundation model provider implementation using official google-genai SDK.
    """

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY environment variable is not set.")
        self.client = genai.Client(api_key=self.api_key)

    async def generate(
        self,
        messages: MessageInput,
        config: Optional[ModelConfig] = None,
    ) -> GenerationResult:
        cfg = config or ModelConfig(model_name="gemini-2.5-flash")
        normalized = self._normalize_messages(messages)
        prompt_text = "\n".join([f"{msg.role.value}: {msg.content}" for msg in normalized])

        loop = asyncio.get_running_loop()

        # Execute blocking SDK call in executor
        response = await loop.run_in_executor(
            None,
            lambda: self.client.models.generate_content(
                model=cfg.model_name,
                contents=prompt_text,
            ),
        )

        return GenerationResult(
            content=response.text or "",
            role=ChatRole.ASSISTANT,
            model_name=cfg.model_name,
        )

    async def stream(
        self,
        messages: MessageInput,
        config: Optional[ModelConfig] = None,
    ) -> AsyncIterator[StreamChunk]:
        cfg = config or ModelConfig(model_name="gemini-2.5-flash")
        normalized = self._normalize_messages(messages)
        prompt_text = "\n".join([f"{msg.role.value}: {msg.content}" for msg in normalized])

        loop = asyncio.get_running_loop()

        def _get_stream() -> Iterator[Any]:
            return self.client.models.generate_content_stream(
                model=cfg.model_name,
                contents=prompt_text,
            )

        stream = await loop.run_in_executor(None, _get_stream)

        for chunk in stream:
            if chunk.text:
                yield StreamChunk(content=chunk.text)
                await asyncio.sleep(0.01)
