import json
from typing import AsyncIterator, Optional

import structlog
from ai_core import LLMConfig, get_provider
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

logger = structlog.get_logger()
router = APIRouter(prefix="/api/v1/chat", tags=["Chat"])


class ChatPromptRequest(BaseModel):
    prompt: str = Field(..., min_length=1, description="User prompt text")
    provider: Optional[str] = Field(
        default="gemini", description="AI provider name (gemini, openai, mock)"
    )
    model: Optional[str] = Field(default="gemini-2.5-flash", description="Foundation model name")
    system_prompt: Optional[str] = Field(default=None, description="Optional system prompt context")


@router.post("/stream")
async def stream_chat(request: ChatPromptRequest) -> StreamingResponse:
    """
    Stream AI completion tokens in real-time as Server-Sent Events (SSE).
    """
    logger.info("Received chat stream request", provider=request.provider, model=request.model)

    try:
        provider = get_provider(request.provider)
    except Exception as e:
        logger.error("Failed to initialize AI provider", error=str(e))
        raise HTTPException(status_code=500, detail=f"Provider initialization failed: {str(e)}")

    config = LLMConfig(
        model_name=request.model or "gemini-2.5-flash",
        system_prompt=request.system_prompt,
    )

    async def event_generator() -> AsyncIterator[str]:
        try:
            async for chunk in provider.stream(request.prompt, config):
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
