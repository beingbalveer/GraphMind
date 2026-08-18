import os
from typing import AsyncIterator

from openai import AsyncOpenAI

from ai_core.base import BaseProvider, GenerationResult, LLMConfig, StreamChunk


class OpenAIProvider(BaseProvider):
    """
    OpenAI foundation model provider implementation.
    """

    def __init__(self, api_key: str | None = None):
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        if not self.api_key:
            raise ValueError("OPENAI_API_KEY environment variable is not set.")
        self.client = AsyncOpenAI(api_key=self.api_key)

    async def generate(self, prompt: str, config: LLMConfig) -> GenerationResult:
        model = config.model_name or "gpt-4o-mini"
        response = await self.client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            temperature=config.temperature,
            max_tokens=config.max_tokens,
        )
        content = response.choices[0].message.content or ""
        return GenerationResult(
            content=content,
            model_name=model,
            prompt_tokens=response.usage.prompt_tokens if response.usage else 0,
            completion_tokens=response.usage.completion_tokens if response.usage else 0,
        )

    async def stream(self, prompt: str, config: LLMConfig) -> AsyncIterator[StreamChunk]:
        model = config.model_name or "gpt-4o-mini"
        response_stream = await self.client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            temperature=config.temperature,
            max_tokens=config.max_tokens,
            stream=True,
        )
        async for chunk in response_stream:
            if chunk.choices and chunk.choices[0].delta.content:
                yield StreamChunk(content=chunk.choices[0].delta.content)
