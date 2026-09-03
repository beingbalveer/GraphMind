import asyncio
import base64
import os
from typing import AsyncIterator, List, Optional, Tuple

import structlog
from google import genai
from google.genai import types

from ai_core.base import (
    BaseLLMProvider,
    BaseTool,
    ChatRole,
    GenerationResult,
    MessageInput,
    ModelConfig,
    StreamChunk,
    ToolCall,
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

    def _to_genai_contents(
        self, messages: MessageInput, system_prompt: Optional[str] = None
    ) -> Tuple[Optional[str], List[types.Content]]:
        """
        Convert normalized ChatMessage objects into structured Gemini types.Content,
        extracting system instructions to pass via types.GenerateContentConfig.
        """
        normalized = self._normalize_messages(messages)
        system_parts: List[str] = []
        if system_prompt and system_prompt.strip():
            system_parts.append(system_prompt.strip())

        contents: List[types.Content] = []
        for msg in normalized:
            if msg.role == ChatRole.SYSTEM:
                if msg.content.strip():
                    system_parts.append(msg.content.strip())
            elif msg.role == ChatRole.TOOL:
                contents.append(
                    types.Content(
                        role="user",
                        parts=[
                            types.Part.from_function_response(
                                name=msg.name or "tool",
                                response={"result": msg.content},
                            )
                        ],
                    )
                )
            else:
                parts: List[types.Part] = []
                if msg.content:
                    parts.append(types.Part.from_text(text=msg.content))

                if msg.tool_calls and msg.role == ChatRole.ASSISTANT:
                    for tc in msg.tool_calls:
                        parts.append(
                            types.Part.from_function_call(
                                name=tc.name,
                                args=tc.arguments,
                            )
                        )

                if msg.attachments:
                    for att in msg.attachments:
                        is_image = att.mime_type.startswith("image/")
                        is_pdf = att.mime_type == "application/pdf" or att.name.lower().endswith(
                            ".pdf"
                        )
                        if att.data and (is_image or is_pdf):
                            raw_b64 = att.data
                            if "," in raw_b64:
                                raw_b64 = raw_b64.split(",", 1)[1]
                            try:
                                file_bytes = base64.b64decode(raw_b64)
                                mime = "application/pdf" if is_pdf else att.mime_type
                                parts.append(types.Part.from_bytes(data=file_bytes, mime_type=mime))
                            except Exception as e:
                                logger.warning(
                                    "Failed to decode base64 attachment",
                                    filename=att.name,
                                    error=str(e),
                                )

                if parts:
                    role = "model" if msg.role == ChatRole.ASSISTANT else "user"
                    contents.append(
                        types.Content(
                            role=role,
                            parts=parts,
                        )
                    )

        combined_system = "\n\n".join(system_parts) if system_parts else None
        return combined_system, contents

    def _build_genai_config(
        self,
        system_instruction: Optional[str],
        cfg: ModelConfig,
        tools: Optional[List[BaseTool]] = None,
    ) -> types.GenerateContentConfig:
        """Construct types.GenerateContentConfig including system instruction, temperature, tokens, and tools."""
        gemini_tools = None
        if tools:
            declarations = [
                types.FunctionDeclaration(
                    name=t.name,
                    description=t.description,
                    parameters=t.to_json_schema(),
                )
                for t in tools
            ]
            gemini_tools = [types.Tool(function_declarations=declarations)]

        return types.GenerateContentConfig(
            system_instruction=system_instruction,
            temperature=cfg.temperature,
            max_output_tokens=cfg.max_tokens,
            tools=gemini_tools,
        )

    async def generate(
        self,
        messages: MessageInput,
        config: Optional[ModelConfig] = None,
        tools: Optional[List[BaseTool]] = None,
    ) -> GenerationResult:
        cfg = config or ModelConfig(model_name="gemini-2.5-flash")
        system_instruction, contents = self._to_genai_contents(messages, cfg.system_prompt)
        genai_config = self._build_genai_config(system_instruction, cfg, tools)

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
                    config=genai_config,
                )

                content_text = ""
                try:
                    content_text = response.text or ""
                except Exception:
                    pass

                parsed_tool_calls: Optional[List[ToolCall]] = None
                if response.function_calls:
                    parsed_tool_calls = []
                    for idx, fc in enumerate(response.function_calls):
                        args = dict(fc.args) if fc.args else {}
                        parsed_tool_calls.append(
                            ToolCall(
                                id=f"gemini_call_{idx + 1}",
                                name=fc.name or "",
                                arguments=args,
                            )
                        )

                return GenerationResult(
                    content=content_text,
                    role=ChatRole.ASSISTANT,
                    model_name=cfg.model_name,
                    tool_calls=parsed_tool_calls,
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
        tools: Optional[List[BaseTool]] = None,
    ) -> AsyncIterator[StreamChunk]:
        cfg = config or ModelConfig(model_name="gemini-2.5-flash")
        system_instruction, contents = self._to_genai_contents(messages, cfg.system_prompt)
        genai_config = self._build_genai_config(system_instruction, cfg, tools)

        if not contents:
            return

        last_exception: Optional[Exception] = None
        for attempt in range(1, MAX_RETRIES + 1):
            try:
                response_stream = await self.client.aio.models.generate_content_stream(
                    model=cfg.model_name,
                    contents=contents,
                    config=genai_config,
                )
                async for chunk in response_stream:
                    chunk_text = ""
                    try:
                        chunk_text = chunk.text or ""
                    except Exception:
                        pass

                    chunk_tool_calls: Optional[List[ToolCall]] = None
                    if chunk.function_calls:
                        chunk_tool_calls = []
                        for idx, fc in enumerate(chunk.function_calls):
                            chunk_tool_calls.append(
                                ToolCall(
                                    id=f"gemini_stream_call_{idx + 1}",
                                    name=fc.name or "",
                                    arguments=dict(fc.args) if fc.args else {},
                                )
                            )

                    if chunk_text or chunk_tool_calls:
                        yield StreamChunk(
                            content=chunk_text,
                            tool_calls=chunk_tool_calls,
                        )
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
