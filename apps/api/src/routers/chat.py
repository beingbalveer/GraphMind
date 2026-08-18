import json
from typing import AsyncIterator, List, Optional

import structlog
from ai_core import ChatMessage, ChatRole, ModelConfig, get_provider
from config import get_settings
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, model_validator

logger = structlog.get_logger()
router = APIRouter(prefix="/api/v1/chat", tags=["Chat"])
settings = get_settings()


class ChatStreamRequest(BaseModel):
    prompt: Optional[str] = Field(default=None, description="Single prompt string")
    messages: Optional[List[ChatMessage]] = Field(
        default=None, description="Full conversation history"
    )
    provider: Optional[str] = Field(
        default=None, description="AI provider name (gemini, openai, mock)"
    )
    model: Optional[str] = Field(default=None, description="Foundation model name")
    system_prompt: Optional[str] = Field(default=None, description="Optional system prompt context")

    @model_validator(mode="after")
    def validate_input(self) -> "ChatStreamRequest":
        if not self.prompt and not self.messages:
            raise ValueError("Either 'prompt' or 'messages' must be provided.")
        return self


@router.post("/stream")
async def stream_chat(request: ChatStreamRequest) -> StreamingResponse:
    """
    Stream AI completion tokens in real-time as Server-Sent Events (SSE).
    """
    resolved_provider = request.provider or settings.DEFAULT_PROVIDER
    resolved_model = request.model or settings.DEFAULT_MODEL

    logger.info(
        "Received chat stream request",
        provider=resolved_provider,
        model=resolved_model,
    )

    try:
        provider = get_provider(resolved_provider)
    except Exception as e:
        logger.error("Failed to initialize AI provider", error=str(e))
        raise HTTPException(status_code=500, detail=f"Provider initialization failed: {str(e)}")

    config = ModelConfig(
        model_name=resolved_model,
        system_prompt=request.system_prompt,
    )

    # Normalize into List[ChatMessage]
    conversation_input: List[ChatMessage]
    if request.messages:
        conversation_input = request.messages
    else:
        conversation_input = [ChatMessage(role=ChatRole.USER, content=request.prompt or "")]

    async def event_generator() -> AsyncIterator[str]:
        try:
            async for chunk in provider.stream(conversation_input, config):
                payload = json.dumps({"content": chunk.content})
                yield f"data: {payload}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            logger.error("Error during AI token streaming", error=str(e))
            err_payload = json.dumps({"error": str(e)})
            yield f"data: {err_payload}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
