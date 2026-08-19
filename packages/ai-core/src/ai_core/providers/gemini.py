import os
from typing import AsyncIterator, Optional

import structlog
from google import genai

from ai_core.base import (
    BaseLLMProvider,
    ChatRole,
    GenerationResult,
    MessageInput,
    ModelConfig,
    StreamChunk,
)

logger = structlog.get_logger()


class GeminiProvider(BaseLLMProvider):
    """
    Google Gemini foundation model provider implementation using the official google-genai SDK
    with native async streaming and execution.
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

        try:
            response = await self.client.aio.models.generate_content(
                model=cfg.model_name,
                contents=prompt_text,
            )
            return GenerationResult(
                content=response.text or "",
                role=ChatRole.ASSISTANT,
                model_name=cfg.model_name,
            )
        except Exception as e:
            logger.error("Gemini generation failed", error=str(e), model=cfg.model_name)
            raise

    async def stream(
        self,
        messages: MessageInput,
        config: Optional[ModelConfig] = None,
    ) -> AsyncIterator[StreamChunk]:
        cfg = config or ModelConfig(model_name="gemini-2.5-flash")
        normalized = self._normalize_messages(messages)
        prompt_text = "\n".join([f"{msg.role.value}: {msg.content}" for msg in normalized])

        try:
            response_stream = await self.client.aio.models.generate_content_stream(
                model=cfg.model_name,
                contents=prompt_text,
            )
            async for chunk in response_stream:
                if chunk.text:
                    yield StreamChunk(content=chunk.text)
        except Exception as e:
            logger.error("Gemini streaming failed", error=str(e), model=cfg.model_name)
            raise
