import os
from typing import List, Optional

import structlog
from openai import AsyncOpenAI

from ai_core.base import BaseEmbeddingProvider, EmbeddingResult, TokenUsage

logger = structlog.get_logger()


class OpenAIEmbeddingProvider(BaseEmbeddingProvider):
    """
    OpenAI vector embedding provider using text-embedding-3-small (768 dimensions).
    """

    DEFAULT_MODEL = "text-embedding-3-small"
    DIMENSION = 768

    def __init__(self, api_key: Optional[str] = None):
        super().__init__(api_key=api_key)
        resolved_key = api_key or os.getenv("OPENAI_API_KEY")
        if not resolved_key:
            raise ValueError("OPENAI_API_KEY environment variable is not set.")
        self.client = AsyncOpenAI(api_key=resolved_key)

    async def embed(
        self,
        texts: List[str],
        model_name: Optional[str] = None,
    ) -> EmbeddingResult:
        if not texts:
            return EmbeddingResult(
                embeddings=[],
                model_name=model_name or self.DEFAULT_MODEL,
                dimension=self.DIMENSION,
            )

        resolved_model = model_name or self.DEFAULT_MODEL

        try:
            response = await self.client.embeddings.create(
                input=texts,
                model=resolved_model,
                dimensions=self.DIMENSION,
            )

            embeddings = [item.embedding for item in response.data]
            dim = len(embeddings[0]) if embeddings else self.DIMENSION

            prompt_tokens = response.usage.prompt_tokens if response.usage else 0

            return EmbeddingResult(
                embeddings=embeddings,
                model_name=resolved_model,
                dimension=dim,
                usage=TokenUsage(
                    prompt_tokens=prompt_tokens,
                    completion_tokens=0,
                    total_tokens=prompt_tokens,
                ),
            )
        except Exception as e:
            logger.error("OpenAI embedding generation failed", error=str(e), model=resolved_model)
            raise
