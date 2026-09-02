import os
from typing import AsyncIterator, Optional

import structlog
from openai import (
    APIConnectionError,
    APITimeoutError,
    AsyncOpenAI,
    InternalServerError,
    RateLimitError,
)
from openai.types.chat import (
    ChatCompletionAssistantMessageParam,
    ChatCompletionMessageParam,
    ChatCompletionSystemMessageParam,
    ChatCompletionUserMessageParam,
)
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential_jitter,
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

logger = structlog.get_logger()

# Transient errors safe to retry
RETRYABLE_OPENAI_ERRORS = (
    APIConnectionError,
    APITimeoutError,
    RateLimitError,
    InternalServerError,
)


class OpenAIProvider(BaseLLMProvider):
    """
    OpenAI foundation model provider implementation with production resilience and retry logic.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        default_model: str = "gpt-4o-mini",
    ):
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        if not self.api_key:
            raise ValueError("OPENAI_API_KEY environment variable is not set.")
        self.base_url = base_url
        self.default_model = default_model
        self.client = AsyncOpenAI(api_key=self.api_key, base_url=self.base_url)

    def _to_openai_messages(
        self, messages: MessageInput, system_prompt: Optional[str] = None
    ) -> list[ChatCompletionMessageParam]:
        normalized = self._normalize_messages(messages)
        formatted: list[ChatCompletionMessageParam] = []

        if system_prompt:
            formatted.append(ChatCompletionSystemMessageParam(role="system", content=system_prompt))

        for msg in normalized:
            if msg.role == ChatRole.SYSTEM:
                formatted.append(
                    ChatCompletionSystemMessageParam(role="system", content=msg.content)
                )
            elif msg.role == ChatRole.USER:
                formatted.append(ChatCompletionUserMessageParam(role="user", content=msg.content))
            elif msg.role == ChatRole.ASSISTANT:
                formatted.append(
                    ChatCompletionAssistantMessageParam(role="assistant", content=msg.content)
                )

        return formatted

    @retry(
        retry=retry_if_exception_type(RETRYABLE_OPENAI_ERRORS),
        stop=stop_after_attempt(3),
        wait=wait_exponential_jitter(initial=1, max=10),
        reraise=True,
    )
    async def generate(
        self,
        messages: MessageInput,
        config: Optional[ModelConfig] = None,
    ) -> GenerationResult:
        cfg = config or ModelConfig(model_name=self.default_model)
        target_model = cfg.model_name or self.default_model
        openai_messages = self._to_openai_messages(messages, cfg.system_prompt)

        try:
            response = await self.client.chat.completions.create(
                model=target_model,
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
                model_name=target_model,
                usage=usage,
                finish_reason=response.choices[0].finish_reason,
            )
        except Exception as e:
            logger.error("OpenAI generation failed", error=str(e), model=target_model)
            raise

    async def stream(
        self,
        messages: MessageInput,
        config: Optional[ModelConfig] = None,
    ) -> AsyncIterator[StreamChunk]:
        cfg = config or ModelConfig(model_name=self.default_model)
        target_model = cfg.model_name or self.default_model
        openai_messages = self._to_openai_messages(messages, cfg.system_prompt)

        try:
            response_stream = await self.client.chat.completions.create(
                model=target_model,
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
        except Exception as e:
            logger.error("OpenAI streaming failed", error=str(e), model=cfg.model_name)
            raise
