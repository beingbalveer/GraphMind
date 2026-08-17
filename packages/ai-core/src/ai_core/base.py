from abc import ABC, abstractmethod
from typing import AsyncIterator, Dict, Any, Optional
from pydantic import BaseModel, Field


class LLMConfig(BaseModel):
    model_name: str = Field(default="gpt-4o-mini", description="Name of foundation model")
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    max_tokens: Optional[int] = Field(default=2048)
    system_prompt: Optional[str] = Field(default=None)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class StreamChunk(BaseModel):
    content: str
    finish_reason: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class GenerationResult(BaseModel):
    content: str
    prompt_tokens: int = 0
    completion_tokens: int = 0
    model_name: str
    metadata: Dict[str, Any] = Field(default_factory=dict)


class BaseProvider(ABC):
    """
    Abstract interface for AI foundation model providers.
    All application logic in GraphMind interacts strictly with this interface.
    """

    @abstractmethod
    async def generate(self, prompt: str, config: LLMConfig) -> GenerationResult:
        """Generate a complete text completion."""
        pass

    @abstractmethod
    async def stream(self, prompt: str, config: LLMConfig) -> AsyncIterator[StreamChunk]:
        """Stream completion tokens in real-time."""
        pass
