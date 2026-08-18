import asyncio
import os
from typing import Any, AsyncIterator, Iterator

from google import genai

from ai_core.base import BaseProvider, GenerationResult, LLMConfig, StreamChunk


class GeminiProvider(BaseProvider):
    """
    Google Gemini foundation model provider implementation using official google-genai SDK.
    """

    def __init__(self, api_key: str | None = None):
        self.api_key = api_key or os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY environment variable is not set.")
        self.client = genai.Client(api_key=self.api_key)

    async def generate(self, prompt: str, config: LLMConfig) -> GenerationResult:
        model = config.model_name or "gemini-2.5-flash"
        loop = asyncio.get_running_loop()

        # Execute blocking SDK call in executor
        response = await loop.run_in_executor(
            None,
            lambda: self.client.models.generate_content(
                model=model,
                contents=prompt,
            ),
        )

        return GenerationResult(
            content=response.text or "",
            model_name=model,
        )

    async def stream(self, prompt: str, config: LLMConfig) -> AsyncIterator[StreamChunk]:
        model = config.model_name or "gemini-2.5-flash"
        loop = asyncio.get_running_loop()

        def _get_stream() -> Iterator[Any]:
            return self.client.models.generate_content_stream(
                model=model,
                contents=prompt,
            )

        stream = await loop.run_in_executor(None, _get_stream)

        for chunk in stream:
            if chunk.text:
                yield StreamChunk(content=chunk.text)
                await asyncio.sleep(0.01)
