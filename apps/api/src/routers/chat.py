import json
from typing import Any, AsyncIterator, Dict, List, Optional

import structlog
from ai_core import (
    ChatMessage,
    ChatRole,
    ConversationTree,
    GenerationResult,
    ModelConfig,
    get_provider,
    resolve_conversation_lineage,
)
from config import get_settings
from fastapi import APIRouter, HTTPException, Request
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
    tree: Optional[ConversationTree] = Field(
        default=None, description="Active conversation tree for lineage traversal"
    )
    parent_node_id: Optional[str] = Field(
        default=None, description="Target parent node ID being branched from"
    )
    highlighted_context: Optional[str] = Field(
        default=None, description="Optional highlighted text excerpt from parent message"
    )
    provider: Optional[str] = Field(
        default=None, description="AI provider name (gemini, openai, mock)"
    )
    model: Optional[str] = Field(default=None, description="Foundation model name")
    system_prompt: Optional[str] = Field(default=None, description="Optional system prompt context")
    metadata: Optional[Dict[str, Any]] = Field(
        default_factory=dict, description="Optional runtime metadata"
    )

    @model_validator(mode="after")
    def validate_input(self) -> "ChatStreamRequest":
        if not self.prompt and not self.messages:
            raise ValueError("Either 'prompt' or 'messages' must be provided.")
        return self


# Request alias for completion
ChatCompletionRequest = ChatStreamRequest


def _resolve_api_key(provider_name: str) -> Optional[str]:
    """
    Extract the relevant API key from application settings.
    """
    name = provider_name.lower().strip()
    if name in ("gemini", "google"):
        key = settings.GEMINI_API_KEY or settings.GOOGLE_API_KEY
        return str(key) if key else None
    if name == "openai":
        key = settings.OPENAI_API_KEY
        return str(key) if key else None
    return None


def _build_conversation_input(body: ChatStreamRequest) -> List[ChatMessage]:
    """
    Construct input messages from tree lineage, explicit message list, or raw prompt.
    """
    if body.tree:
        return resolve_conversation_lineage(
            tree=body.tree,
            target_node_id=body.parent_node_id,
            new_prompt=body.prompt or "",
            highlighted_context=body.highlighted_context,
        )
    if body.messages:
        return body.messages
    return [ChatMessage(role=ChatRole.USER, content=body.prompt or "")]


@router.post("/completions", response_model=GenerationResult)
async def create_chat_completion(body: ChatCompletionRequest) -> GenerationResult:
    """
    Generate a complete, non-streaming AI response with usage metrics.
    """
    resolved_provider = body.provider or settings.DEFAULT_PROVIDER
    resolved_model = body.model or settings.DEFAULT_MODEL
    api_key = _resolve_api_key(resolved_provider)

    logger.info(
        "Received non-streaming chat completion request",
        provider=resolved_provider,
        model=resolved_model,
        has_api_key=bool(api_key),
        has_tree=bool(body.tree),
    )

    try:
        provider = get_provider(resolved_provider, api_key=api_key)
    except Exception as e:
        logger.error("Failed to initialize AI provider", error=str(e))
        raise HTTPException(status_code=500, detail=f"Provider initialization failed: {str(e)}")

    config = ModelConfig(
        model_name=resolved_model,
        system_prompt=body.system_prompt,
        metadata=body.metadata or {},
    )

    conversation_input = _build_conversation_input(body)

    try:
        result = await provider.generate(conversation_input, config)
        logger.info(
            "Chat completion generated successfully",
            model=result.model_name,
            total_tokens=result.usage.total_tokens,
        )
        return result
    except Exception as e:
        logger.error("Error during chat completion generation", error=str(e))
        raise HTTPException(status_code=500, detail=f"Generation failed: {str(e)}")


@router.post("/stream")
async def stream_chat(
    body: ChatStreamRequest,
    request: Request,
) -> StreamingResponse:
    """
    Stream AI completion tokens in real-time as Server-Sent Events (SSE)
    with client disconnect monitoring and error propagation.
    """
    resolved_provider = body.provider or settings.DEFAULT_PROVIDER
    resolved_model = body.model or settings.DEFAULT_MODEL
    api_key = _resolve_api_key(resolved_provider)

    logger.info(
        "Received chat stream request",
        provider=resolved_provider,
        model=resolved_model,
        has_api_key=bool(api_key),
        has_tree=bool(body.tree),
    )

    try:
        provider = get_provider(resolved_provider, api_key=api_key)
    except Exception as e:
        logger.error("Failed to initialize AI provider", error=str(e))
        raise HTTPException(status_code=500, detail=f"Provider initialization failed: {str(e)}")

    config = ModelConfig(
        model_name=resolved_model,
        system_prompt=body.system_prompt,
        metadata=body.metadata or {},
    )

    conversation_input = _build_conversation_input(body)

    async def event_generator() -> AsyncIterator[str]:
        try:
            async for chunk in provider.stream(conversation_input, config):
                # Check for client disconnect
                if await request.is_disconnected():
                    logger.info("Client disconnected, terminating stream generator")
                    break

                payload = json.dumps({"content": chunk.content})
                yield f"event: token\ndata: {payload}\n\n"

            yield "event: done\ndata: [DONE]\n\n"
        except Exception as e:
            logger.error("Error during AI token streaming", error=str(e))
            err_payload = json.dumps({"error": str(e)})
            yield f"event: error\ndata: {err_payload}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
