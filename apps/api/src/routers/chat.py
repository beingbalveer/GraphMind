import base64
import json
import os
from typing import Any, AsyncIterator, Dict, List, Optional

import structlog
from ai_core import (
    ChatMessage,
    ChatRole,
    ConversationTree,
    FileAttachment,
    GenerationResult,
    ModelConfig,
    get_provider,
    resolve_conversation_lineage,
)
from config import get_settings
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict, Field, model_validator
from pydantic.alias_generators import to_camel
from services.file_service import parse_tabular_bytes

logger = structlog.get_logger()
router = APIRouter(prefix="/api/v1/chat", tags=["Chat"])
settings = get_settings()

DEFAULT_CONCISE_SYSTEM_PROMPT = (
    "You are GraphMind AI, a concise and high-precision technical assistant. "
    "Provide crisp, direct, and focused answers. Keep explanations brief (2-3 short paragraphs max or clean bullet points) "
    "without unnecessary conversational filler so the user can quickly grasp key technical concepts."
)


class ChatStreamRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

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
    api_key: Optional[str] = Field(
        default=None, description="Optional client-provided BYOK API key"
    )
    base_url: Optional[str] = Field(
        default=None, description="Optional custom base URL for Ollama or custom endpoints"
    )
    temperature: Optional[float] = Field(
        default=None, ge=0.0, le=2.0, description="Optional temperature parameter"
    )
    max_tokens: Optional[int] = Field(
        default=None, ge=1, le=32768, description="Optional maximum tokens parameter"
    )
    system_prompt: Optional[str] = Field(default=None, description="Optional system prompt context")
    attachments: Optional[List[FileAttachment]] = Field(
        default=None, description="Optional image or file attachments"
    )
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


def _resolve_api_key(provider_name: str, custom_key: Optional[str] = None) -> Optional[str]:
    """
    Extract the relevant API key, prioritizing client-provided custom BYOK key,
    falling back to application environment settings.
    """
    if custom_key and custom_key.strip():
        return custom_key.strip()
    name = provider_name.lower().strip()
    if name in ("gemini", "google"):
        key = settings.GEMINI_API_KEY or settings.GOOGLE_API_KEY
        return str(key) if key else None
    if name == "openai":
        key = settings.OPENAI_API_KEY
        return str(key) if key else None
    if name in ("anthropic", "claude"):
        key = settings.ANTHROPIC_API_KEY
        return str(key) if key else None
    if name == "deepseek":
        key = settings.DEEPSEEK_API_KEY
        return str(key) if key else None
    if name == "ollama":
        return "ollama"
    return None


def _extract_attachment_text(att: FileAttachment) -> Optional[str]:
    """Retrieve extracted text from the attachment or decode base64 text payload."""
    if att.extracted_text and att.extracted_text.strip():
        return att.extracted_text.strip()
    if att.data and att.data.startswith("data:"):
        try:
            parts = att.data.split(",", 1)
            if len(parts) == 2:
                header = parts[0]
                raw_b64 = parts[1]
                decoded_bytes = base64.b64decode(raw_b64)
                # Check for tabular files
                if att.file_category == "tabular" or any(
                    att.name.lower().endswith(e) for e in (".csv", ".tsv", ".jsonl", ".ndjson", ".xlsx")
                ):
                    summary, _ = parse_tabular_bytes(att.name, decoded_bytes, att.mime_type or "")
                    if summary:
                        return summary

                if any(t in header for t in ("text/", "json", "javascript", "yaml", "xml", "csv")):
                    return decoded_bytes.decode("utf-8", errors="replace").strip()
        except Exception:
            pass
    return None


def _format_message_with_attachments(msg: ChatMessage) -> ChatMessage:
    """
    If the message contains code, text, or tabular document attachments, format their
    contents into the textual prompt context so that all LLMs receive the file body.
    """
    if not msg.attachments:
        return msg

    text_blocks: List[str] = []
    for att in msg.attachments:
        text_content = _extract_attachment_text(att)
        if text_content is not None:
            is_pdf = att.mime_type == "application/pdf" or att.name.lower().endswith(".pdf")
            is_tabular = att.file_category == "tabular" or any(
                att.name.lower().endswith(e) for e in (".csv", ".tsv", ".jsonl", ".ndjson", ".xlsx")
            )
            if is_pdf:
                text_blocks.append(
                    f"[Attached PDF Document: `{att.name}`]\n```text\n{text_content}\n```"
                )
            elif is_tabular:
                text_blocks.append(
                    f"[Attached Tabular Dataset: `{att.name}`]\n{text_content}"
                )
            else:
                ext = os.path.splitext(att.name.lower())[1].lstrip(".")
                lang = ext if ext else "text"
                text_blocks.append(
                    f"[Attached File: `{att.name}`]\n```{lang}\n{text_content}\n```"
                )

    if not text_blocks:
        return msg

    joined_files = "\n\n".join(text_blocks)
    if msg.content.strip():
        new_content = f"{joined_files}\n\n{msg.content.strip()}"
    else:
        new_content = joined_files

    return ChatMessage(
        role=msg.role,
        content=new_content,
        name=msg.name,
        metadata=msg.metadata,
        attachments=msg.attachments,
    )


def _build_conversation_input(body: ChatStreamRequest) -> List[ChatMessage]:
    """
    Construct input messages from tree lineage, explicit message list, or raw prompt,
    ensuring highlighted_context and attachments are always preserved and injected.
    """
    if body.tree:
        lineage: List[ChatMessage] = resolve_conversation_lineage(
            tree=body.tree,
            target_node_id=body.parent_node_id,
            new_prompt=body.prompt or "",
            highlighted_context=body.highlighted_context,
        )
        if lineage and body.attachments:
            lineage[-1].attachments = body.attachments
        if lineage:
            lineage[-1] = _format_message_with_attachments(lineage[-1])
        return lineage

    if body.messages:
        messages = list(body.messages)
        if body.highlighted_context and body.highlighted_context.strip() and messages:
            last_msg = messages[-1]
            if last_msg.role == ChatRole.USER and not last_msg.content.startswith(
                "[Focusing on excerpt:"
            ):
                messages[-1] = ChatMessage(
                    role=ChatRole.USER,
                    content=f'[Focusing on excerpt: "{body.highlighted_context.strip()}"]\n\n{last_msg.content.strip()}',
                    metadata=last_msg.metadata,
                    attachments=last_msg.attachments,
                )
        if messages and body.attachments and not messages[-1].attachments:
            messages[-1].attachments = body.attachments
        if messages:
            messages[-1] = _format_message_with_attachments(messages[-1])
        return messages

    raw_prompt = (body.prompt or "").strip()
    if body.highlighted_context and body.highlighted_context.strip():
        content = f'[Focusing on excerpt: "{body.highlighted_context.strip()}"]\n\n{raw_prompt}'
    else:
        content = raw_prompt

    msg = ChatMessage(role=ChatRole.USER, content=content, attachments=body.attachments)
    return [_format_message_with_attachments(msg)]


@router.post("/completions", response_model=GenerationResult)
async def create_chat_completion(body: ChatCompletionRequest) -> GenerationResult:
    """
    Generate a complete, non-streaming AI response with usage metrics.
    """
    resolved_provider = body.provider or settings.DEFAULT_PROVIDER
    resolved_model = body.model or settings.DEFAULT_MODEL
    api_key = _resolve_api_key(resolved_provider, body.api_key)
    resolved_base_url = body.base_url or (
        settings.OLLAMA_BASE_URL if resolved_provider == "ollama" else None
    )

    logger.info(
        "Received non-streaming chat completion request",
        provider=resolved_provider,
        model=resolved_model,
        has_api_key=bool(api_key),
        has_base_url=bool(resolved_base_url),
        has_tree=bool(body.tree),
    )

    try:
        provider = get_provider(resolved_provider, api_key=api_key, base_url=resolved_base_url)
    except Exception as e:
        logger.error("Failed to initialize AI provider", error=str(e))
        raise HTTPException(status_code=500, detail=f"Provider initialization failed: {str(e)}")

    model_kwargs: Dict[str, Any] = {
        "model_name": resolved_model,
        "system_prompt": body.system_prompt or DEFAULT_CONCISE_SYSTEM_PROMPT,
        "metadata": body.metadata or {},
    }
    if body.temperature is not None:
        model_kwargs["temperature"] = body.temperature
    if body.max_tokens is not None:
        model_kwargs["max_tokens"] = body.max_tokens

    config = ModelConfig(**model_kwargs)

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
    api_key = _resolve_api_key(resolved_provider, body.api_key)
    resolved_base_url = body.base_url or (
        settings.OLLAMA_BASE_URL if resolved_provider == "ollama" else None
    )

    logger.info(
        "Received chat stream request",
        provider=resolved_provider,
        model=resolved_model,
        has_api_key=bool(api_key),
        has_base_url=bool(resolved_base_url),
        has_tree=bool(body.tree),
    )

    try:
        provider = get_provider(resolved_provider, api_key=api_key, base_url=resolved_base_url)
    except Exception as e:
        logger.error("Failed to initialize AI provider", error=str(e))
        raise HTTPException(status_code=500, detail=f"Provider initialization failed: {str(e)}")

    stream_model_kwargs: Dict[str, Any] = {
        "model_name": resolved_model,
        "system_prompt": body.system_prompt or DEFAULT_CONCISE_SYSTEM_PROMPT,
        "metadata": body.metadata or {},
    }
    if body.temperature is not None:
        stream_model_kwargs["temperature"] = body.temperature
    if body.max_tokens is not None:
        stream_model_kwargs["max_tokens"] = body.max_tokens

    config = ModelConfig(**stream_model_kwargs)



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
