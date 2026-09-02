import os
from typing import Any, AsyncIterator, Dict, List, Optional, Tuple

import structlog
from anthropic import (
    APIConnectionError,
    APITimeoutError,
    AsyncAnthropic,
    InternalServerError,
    RateLimitError,
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
RETRYABLE_ANTHROPIC_ERRORS = (
    APIConnectionError,
    APITimeoutError,
    RateLimitError,
    InternalServerError,
)

DEFAULT_ANTHROPIC_MODEL = "claude-3-5-sonnet-20241022"


class AnthropicProvider(BaseLLMProvider):
    """
    Anthropic foundation model provider implementation (Claude 3.7 / 3.5 Sonnet & Haiku)
    with production resilience, message role normalization, and async token streaming.
    """

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("ANTHROPIC_API_KEY")
        if not self.api_key:
            raise ValueError("ANTHROPIC_API_KEY environment variable is not set.")
        self.client = AsyncAnthropic(api_key=self.api_key)

    def _to_anthropic_messages(
        self, messages: MessageInput, system_prompt: Optional[str] = None
    ) -> Tuple[Optional[str], List[Dict[str, str]]]:
        """
        Normalize input messages for Anthropic Messages API:
        1. Extract system instructions into a separate top-level 'system' string.
        2. Ensure strictly alternating user and assistant messages, merging consecutive roles.
        3. Guarantee the conversation starts with a user message.
        """
        normalized = self._normalize_messages(messages)
        system_parts: List[str] = []
        if system_prompt and system_prompt.strip():
            system_parts.append(system_prompt.strip())

        raw_messages: List[Dict[str, str]] = []

        for msg in normalized:
            if msg.role == ChatRole.SYSTEM:
                if msg.content.strip():
                    system_parts.append(msg.content.strip())
            elif msg.role in (ChatRole.USER, ChatRole.ASSISTANT):
                role = "user" if msg.role == ChatRole.USER else "assistant"
                raw_messages.append({"role": role, "content": msg.content})

        combined_system = "\n\n".join(system_parts) if system_parts else None

        # Anthropic requires alternating user/assistant messages. Merge consecutive same-role turns.
        merged_messages: List[Dict[str, str]] = []
        for raw_turn in raw_messages:
            if merged_messages and merged_messages[-1]["role"] == raw_turn["role"]:
                merged_messages[-1]["content"] += f"\n\n{raw_turn['content']}"
            else:
                merged_messages.append(raw_turn.copy())

        # Ensure conversation begins with a user turn
        if merged_messages and merged_messages[0]["role"] == "assistant":
            merged_messages.insert(0, {"role": "user", "content": "Continue."})

        # Anthropic requires at least 1 message
        if not merged_messages:
            merged_messages = [{"role": "user", "content": "Hello"}]

        return combined_system, merged_messages

    @retry(
        retry=retry_if_exception_type(RETRYABLE_ANTHROPIC_ERRORS),
        stop=stop_after_attempt(3),
        wait=wait_exponential_jitter(initial=1, max=10),
        reraise=True,
    )
    async def generate(
        self,
        messages: MessageInput,
        config: Optional[ModelConfig] = None,
    ) -> GenerationResult:
        cfg = config or ModelConfig(model_name=DEFAULT_ANTHROPIC_MODEL)
        system_prompt, anthropic_messages = self._to_anthropic_messages(messages, cfg.system_prompt)

        model_name = cfg.model_name or DEFAULT_ANTHROPIC_MODEL
        # Normalize model aliases
        if model_name in ("claude-3-7-sonnet", "claude-3.7-sonnet"):
            model_name = "claude-3-7-sonnet-20250219"
        elif model_name in ("claude-3-5-sonnet", "claude-3.5-sonnet"):
            model_name = "claude-3-5-sonnet-20241022"
        elif model_name in ("claude-3-5-haiku", "claude-3.5-haiku"):
            model_name = "claude-3-5-haiku-20241022"

        kwargs: Dict[str, Any] = {
            "model": model_name,
            "messages": anthropic_messages,
            "max_tokens": cfg.max_tokens or 4096,
        }
        if cfg.temperature is not None:
            kwargs["temperature"] = cfg.temperature
        if system_prompt:
            kwargs["system"] = system_prompt

        try:
            response = await self.client.messages.create(**kwargs)

            content = ""
            for block in response.content:
                if block.type == "text":
                    content += block.text

            prompt_tokens = response.usage.input_tokens if response.usage else 0
            completion_tokens = response.usage.output_tokens if response.usage else 0

            return GenerationResult(
                content=content,
                role=ChatRole.ASSISTANT,
                model_name=model_name,
                usage=TokenUsage(
                    prompt_tokens=prompt_tokens,
                    completion_tokens=completion_tokens,
                    total_tokens=prompt_tokens + completion_tokens,
                ),
                finish_reason=response.stop_reason,
            )
        except Exception as e:
            logger.error("Anthropic generation failed", error=str(e), model=model_name)
            raise

    async def stream(
        self,
        messages: MessageInput,
        config: Optional[ModelConfig] = None,
    ) -> AsyncIterator[StreamChunk]:
        cfg = config or ModelConfig(model_name=DEFAULT_ANTHROPIC_MODEL)
        system_prompt, anthropic_messages = self._to_anthropic_messages(messages, cfg.system_prompt)

        model_name = cfg.model_name or DEFAULT_ANTHROPIC_MODEL
        if model_name in ("claude-3-7-sonnet", "claude-3.7-sonnet"):
            model_name = "claude-3-7-sonnet-20250219"
        elif model_name in ("claude-3-5-sonnet", "claude-3.5-sonnet"):
            model_name = "claude-3-5-sonnet-20241022"
        elif model_name in ("claude-3-5-haiku", "claude-3.5-haiku"):
            model_name = "claude-3-5-haiku-20241022"

        kwargs: Dict[str, Any] = {
            "model": model_name,
            "messages": anthropic_messages,
            "max_tokens": cfg.max_tokens or 4096,
        }
        if cfg.temperature is not None:
            kwargs["temperature"] = cfg.temperature
        if system_prompt:
            kwargs["system"] = system_prompt

        try:
            async with self.client.messages.stream(**kwargs) as stream:
                async for text in stream.text_stream:
                    yield StreamChunk(content=text)

                final_msg = await stream.get_final_message()
                prompt_tokens = final_msg.usage.input_tokens if final_msg.usage else 0
                completion_tokens = final_msg.usage.output_tokens if final_msg.usage else 0

                yield StreamChunk(
                    content="",
                    finish_reason=final_msg.stop_reason,
                    usage=TokenUsage(
                        prompt_tokens=prompt_tokens,
                        completion_tokens=completion_tokens,
                        total_tokens=prompt_tokens + completion_tokens,
                    ),
                )
        except Exception as e:
            logger.error("Anthropic streaming failed", error=str(e), model=model_name)
            raise
