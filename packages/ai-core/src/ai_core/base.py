from abc import ABC, abstractmethod
from enum import Enum
from typing import Any, AsyncIterator, Dict, List, Optional, Union

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


class ChatRole(str, Enum):
    """
    Standardized conversation roles across all LLM providers.
    """

    SYSTEM = "system"
    USER = "user"
    ASSISTANT = "assistant"
    TOOL = "tool"


class FileAttachment(BaseModel):
    """
    Representation of an uploaded file or image asset attached to a message.
    """

    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    id: str = Field(..., description="Unique file identifier")
    name: str = Field(..., description="Original filename")
    mime_type: str = Field(..., description="MIME content type")
    data: Optional[str] = Field(
        default=None, description="Optional base64-encoded file data for multimodal ingestion"
    )
    url: Optional[str] = Field(
        default=None, description="Optional download or view URL for referencing"
    )
    extracted_text: Optional[str] = Field(
        default=None, description="Optional extracted text or source code content"
    )
    file_category: Optional[str] = Field(
        default=None, description="Category: image, code, document, tabular, other"
    )


class ChatMessage(BaseModel):
    """
    Individual message entity in a conversation thread.
    """

    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    role: ChatRole = Field(..., description="Role of message author")
    content: str = Field(..., description="Textual content of the message")
    name: Optional[str] = Field(default=None, description="Optional author identifier")
    metadata: Dict[str, Any] = Field(
        default_factory=dict, description="Arbitrary metadata attached to message"
    )
    attachments: Optional[List[FileAttachment]] = Field(
        default=None, description="Optional file or image attachments"
    )

    @classmethod
    def user(
        cls, content: str, attachments: Optional[List[FileAttachment]] = None
    ) -> "ChatMessage":
        return cls(role=ChatRole.USER, content=content, attachments=attachments)

    @classmethod
    def assistant(cls, content: str) -> "ChatMessage":
        return cls(role=ChatRole.ASSISTANT, content=content)

    @classmethod
    def system(cls, content: str) -> "ChatMessage":
        return cls(role=ChatRole.SYSTEM, content=content)


class TokenUsage(BaseModel):
    """
    Token consumption metrics.
    """

    prompt_tokens: int = Field(default=0, description="Tokens in input prompt")
    completion_tokens: int = Field(default=0, description="Tokens in generated response")
    total_tokens: int = Field(default=0, description="Total tokens consumed")


class ModelConfig(BaseModel):
    """
    Configuration parameters governing LLM inference generation.
    """

    model_name: str = Field(default="gemini-2.5-flash", description="Target model name")
    temperature: float = Field(
        default=0.7, ge=0.0, le=2.0, description="Sampling randomness temperature"
    )
    max_tokens: Optional[int] = Field(default=2048, ge=1, description="Maximum tokens to generate")
    top_p: Optional[float] = Field(
        default=None, ge=0.0, le=1.0, description="Nucleus sampling probability"
    )
    system_prompt: Optional[str] = Field(
        default=None, description="Optional overriding system instruction"
    )
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Custom vendor parameters")


# Backward compatibility alias
LLMConfig = ModelConfig


class StreamChunk(BaseModel):
    """
    Individual chunk emitted during async token streaming.
    """

    content: str = Field(..., description="Incremental token text")
    finish_reason: Optional[str] = Field(default=None, description="Reason stream ended (if done)")
    usage: Optional[TokenUsage] = Field(
        default=None, description="Usage metrics if reported in chunk"
    )
    metadata: Dict[str, Any] = Field(default_factory=dict)


class GenerationResult(BaseModel):
    """
    Complete response returned by non-streaming LLM generation.
    """

    content: str = Field(..., description="Full generated completion text")
    role: ChatRole = Field(default=ChatRole.ASSISTANT)
    model_name: str = Field(..., description="Model that produced completion")
    usage: TokenUsage = Field(default_factory=TokenUsage)
    finish_reason: Optional[str] = Field(default=None)
    metadata: Dict[str, Any] = Field(default_factory=dict)


# Type alias allowing single string prompts or full message histories
MessageInput = Union[List[ChatMessage], str]


class BaseLLMProvider(ABC):
    """
    Abstract interface for AI foundation model providers.
    All application logic in GraphMind interacts strictly with this interface.
    """

    def __init__(self, api_key: Optional[str] = None) -> None:
        self.api_key = api_key

    @abstractmethod
    async def generate(
        self,
        messages: MessageInput,
        config: Optional[ModelConfig] = None,
    ) -> GenerationResult:
        """
        Generate a complete text completion from a prompt or message history.
        """
        pass

    @abstractmethod
    def stream(
        self,
        messages: MessageInput,
        config: Optional[ModelConfig] = None,
    ) -> AsyncIterator[StreamChunk]:
        """
        Stream completion tokens asynchronously as they are generated by the model.
        """
        pass

    def _normalize_messages(self, messages: MessageInput) -> List[ChatMessage]:
        """
        Helper normalizing raw strings into structured List[ChatMessage].
        """
        if isinstance(messages, str):
            return [ChatMessage.user(messages)]
        return messages


# Backward compatibility alias
BaseProvider = BaseLLMProvider


class EmbeddingResult(BaseModel):
    """
    Dense vector embeddings generated for input texts.
    """

    embeddings: List[List[float]] = Field(..., description="List of vector embeddings")
    model_name: str = Field(..., description="Embedding model name used")
    dimension: int = Field(..., description="Vector dimensionality")
    usage: Optional[TokenUsage] = Field(default=None)


class BaseEmbeddingProvider(ABC):
    """
    Abstract interface for AI vector embedding providers.
    """

    def __init__(self, api_key: Optional[str] = None) -> None:
        self.api_key = api_key

    @abstractmethod
    async def embed(
        self,
        texts: List[str],
        model_name: Optional[str] = None,
    ) -> EmbeddingResult:
        """
        Generate dense vector embeddings for a list of text strings.
        """
        pass

    async def embed_query(
        self,
        query: str,
        model_name: Optional[str] = None,
    ) -> List[float]:
        """
        Convenience method to generate an embedding vector for a single query string.
        """
        res = await self.embed([query], model_name=model_name)
        if not res.embeddings:
            raise ValueError("No embedding returned for query")
        return res.embeddings[0]
