import os
from typing import AsyncIterator, Optional

from openai import AsyncOpenAI
from openai.types.chat import (
    ChatCompletionAssistantMessageParam,
    ChatCompletionMessageParam,
    ChatCompletionSystemMessageParam,
    ChatCompletionUserMessageParam,
)

from ai_core.base import (
    BaseLLMProvider,
    ChatRole,
    GenerationResult,
    MessageInput,
    ModelConfig,
    StreamChunk,
    TokenUsage,
)


class OpenAIProvider(BaseLLMProvider):
    """
    OpenAI foundation model provider implementation.
    """

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        if not self.api_key:
            raise ValueError("OPENAI_API_KEY environment variable is not set.")
        self.client = AsyncOpenAI(api_key=self.api_key)

    def _to_openai_messages(
        self, messages: MessageInput, system_prompt: Optional[str] = None
    ) -> list[ChatCompletionMessageParam]:
        normalized = self._normalize_messages(messages)
        formatted: list[ChatCompletionMessageParam] = []

        if system_prompt:
            formatted.append(ChatCompletionSystemMessageParam(role="system", content=system_prompt))

        for msg in normalized:
            if msg.role == ChatRole.SYSTEM:
                formatted.append(ChatCompletionSystemMessageParam(role="system", content=msg.content))
            elif msg.role == ChatRole.USER:
                formatted.append(ChatCompletionUserMessageParam(role="user", content=msg.content))
            elif msg.role == ChatRole.ASSISTANT:
                formatted.append(ChatCompletionAssistantMessageParam(role="assistant", content=msg.content))

        return formatted

    async def generate(
        self,
        messages: MessageInput,
        config: Optional[ModelConfig] = None,
    ) -> GenerationResult:
        cfg = config or ModelConfig(model_name="gpt-4o-mini")
        openai_messages = self._to_openai_messages(messages, cfg.system_prompt)

        response = await self.client.chat.completions.create(
            model=cfg.model_name,
            messages=openai_messages,
            temperature=cfg.temperature,
            max_tokens=cfg.max_tokens,
            top_p=cfg.top_p,
        )
        content = response.choices[0].message.content or ""
        usage = TokenUsage(
            prompt_tokens=response.usage.prompt_tokens if response.usage else 0,
            completion_tokens=response.usage.completion_tokens if response.usage else 0,
            total_tokens=response.usage.total_tokens if response.usage else 0,
        )
        return GenerationResult(
            content=content,
            role=ChatRole.ASSISTANT,
            model_name=cfg.model_name,
            usage=usage,
            finish_reason=response.choices[0].finish_reason,
        )

    async def stream(
        self,
        messages: MessageInput,
        config: Optional[ModelConfig] = None,
    ) -> AsyncIterator[StreamChunk]:
        cfg = config or ModelConfig(model_name="gpt-4o-mini")
        openai_messages = self._to_openai_messages(messages, cfg.system_prompt)

        response_stream = await self.client.chat.completions.create(
            model=cfg.model_name,
            messages=openai_messages,
            temperature=cfg.temperature,
            max_tokens=cfg.max_tokens,
            top_p=cfg.top_p,
            stream=True,
        )
        async for chunk in response_stream:
            if chunk.choices and chunk.choices[0].delta.content:
                yield StreamChunk(
                    content=chunk.choices[0].delta.content,
                    finish_reason=chunk.choices[0].finish_reason,
                )
