import json
import os
from typing import Any, AsyncIterator, Dict, List, Optional

import structlog
from openai import (
    APIConnectionError,
    APITimeoutError,
    AsyncOpenAI,
    InternalServerError,
    RateLimitError,
)
from openai.types.chat import (
    ChatCompletionContentPartImageParam,
    ChatCompletionContentPartTextParam,
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
    BaseTool,
    ChatRole,
    GenerationResult,
    MessageInput,
    ModelConfig,
    StreamChunk,
    TokenUsage,
    ToolCall,
)

logger = structlog.get_logger()

# Transient errors safe to retry
RETRYABLE_OPENAI_ERRORS = (
    APIConnectionError,
    APITimeoutError,
    RateLimitError,
    InternalServerError,
)


def _to_openai_tools(tools: Optional[List[BaseTool]]) -> Optional[list[dict[str, Any]]]:
    """Convert BaseTool list into OpenAI function tools specification."""
    if not tools:
        return None
    return [
        {
            "type": "function",
            "function": {
                "name": t.name,
                "description": t.description,
                "parameters": t.to_json_schema(),
            },
        }
        for t in tools
    ]


class OpenAIProvider(BaseLLMProvider):
    """
    OpenAI foundation model provider implementation with production resilience,
    retry logic, and native tool-calling / function execution support.
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
            elif msg.role == ChatRole.TOOL:
                formatted.append(
                    {
                        "role": "tool",
                        "tool_call_id": msg.tool_call_id or "",
                        "content": msg.content,
                    }
                )
            elif msg.role == ChatRole.USER:
                if msg.attachments:
                    content_parts: list[Any] = []
                    if msg.content:
                        content_parts.append(
                            ChatCompletionContentPartTextParam(type="text", text=msg.content)
                        )
                    for att in msg.attachments:
                        if att.data and att.mime_type.startswith("image/"):
                            raw_b64 = att.data
                            if not raw_b64.startswith("data:"):
                                raw_b64 = f"data:{att.mime_type};base64,{raw_b64}"
                            content_parts.append(
                                ChatCompletionContentPartImageParam(
                                    type="image_url",
                                    image_url={"url": raw_b64},
                                )
                            )
                    if content_parts:
                        formatted.append(
                            ChatCompletionUserMessageParam(role="user", content=content_parts)
                        )
                    else:
                        formatted.append(
                            ChatCompletionUserMessageParam(role="user", content=msg.content)
                        )
                else:
                    formatted.append(
                        ChatCompletionUserMessageParam(role="user", content=msg.content)
                    )
            elif msg.role == ChatRole.ASSISTANT:
                assistant_dict: dict[str, Any] = {
                    "role": "assistant",
                    "content": msg.content,
                }
                if msg.tool_calls:
                    assistant_dict["tool_calls"] = [
                        {
                            "id": tc.id,
                            "type": "function",
                            "function": {
                                "name": tc.name,
                                "arguments": json.dumps(tc.arguments)
                                if isinstance(tc.arguments, dict)
                                else str(tc.arguments),
                            },
                        }
                        for tc in msg.tool_calls
                    ]
                formatted.append(assistant_dict)  # type: ignore[arg-type]

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
        tools: Optional[List[BaseTool]] = None,
    ) -> GenerationResult:
        cfg = config or ModelConfig(model_name=self.default_model)
        target_model = cfg.model_name or self.default_model
        openai_messages = self._to_openai_messages(messages, cfg.system_prompt)
        openai_tools = _to_openai_tools(tools)

        call_kwargs: dict[str, Any] = {
            "model": target_model,
            "messages": openai_messages,
            "temperature": cfg.temperature,
            "max_tokens": cfg.max_tokens,
            "top_p": cfg.top_p,
        }
        if openai_tools:
            call_kwargs["tools"] = openai_tools

        try:
            response = await self.client.chat.completions.create(**call_kwargs)
            choice = response.choices[0]
            content = choice.message.content or ""

            parsed_tool_calls: Optional[List[ToolCall]] = None
            if choice.message.tool_calls:
                parsed_tool_calls = []
                for tc in choice.message.tool_calls:
                    try:
                        args = json.loads(tc.function.arguments) if tc.function.arguments else {}
                    except Exception:
                        args = {"raw": tc.function.arguments}
                    parsed_tool_calls.append(
                        ToolCall(
                            id=tc.id,
                            name=tc.function.name,
                            arguments=args,
                        )
                    )

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
                finish_reason=choice.finish_reason,
                tool_calls=parsed_tool_calls,
            )
        except Exception as e:
            logger.error("OpenAI generation failed", error=str(e), model=target_model)
            raise

    async def stream(
        self,
        messages: MessageInput,
        config: Optional[ModelConfig] = None,
        tools: Optional[List[BaseTool]] = None,
    ) -> AsyncIterator[StreamChunk]:
        cfg = config or ModelConfig(model_name=self.default_model)
        target_model = cfg.model_name or self.default_model
        openai_messages = self._to_openai_messages(messages, cfg.system_prompt)
        openai_tools = _to_openai_tools(tools)

        call_kwargs: dict[str, Any] = {
            "model": target_model,
            "messages": openai_messages,
            "temperature": cfg.temperature,
            "max_tokens": cfg.max_tokens,
            "top_p": cfg.top_p,
            "stream": True,
        }
        if openai_tools:
            call_kwargs["tools"] = openai_tools

        try:
            response_stream = await self.client.chat.completions.create(**call_kwargs)
            async for chunk in response_stream:
                if chunk.choices:
                    delta = chunk.choices[0].delta
                    chunk_tool_calls: Optional[List[ToolCall]] = None
                    if delta.tool_calls:
                        chunk_tool_calls = []
                        for tc in delta.tool_calls:
                            args: Dict[str, Any] = {}
                            if tc.function and tc.function.arguments:
                                try:
                                    args = json.loads(tc.function.arguments)
                                except Exception:
                                    args = {"delta": tc.function.arguments}
                            chunk_tool_calls.append(
                                ToolCall(
                                    id=tc.id or "",
                                    name=tc.function.name or "" if tc.function else "",
                                    arguments=args,
                                )
                            )
                    if delta.content or chunk_tool_calls or chunk.choices[0].finish_reason:
                        yield StreamChunk(
                            content=delta.content or "",
                            finish_reason=chunk.choices[0].finish_reason,
                            tool_calls=chunk_tool_calls,
                        )
        except Exception as e:
            logger.error("OpenAI streaming failed", error=str(e), model=cfg.model_name)
            raise
