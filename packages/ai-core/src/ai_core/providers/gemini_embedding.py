import os
from typing import List, Optional

import structlog
from google import genai

from ai_core.base import BaseEmbeddingProvider, EmbeddingResult, TokenUsage

logger = structlog.get_logger()


class GeminiEmbeddingProvider(BaseEmbeddingProvider):
    """
    Google Gemini vector embedding provider using text-embedding-004 (768 dimensions).
    """

    DEFAULT_MODEL = "text-embedding-004"
    DIMENSION = 768

    def __init__(self, api_key: Optional[str] = None):
        super().__init__(api_key=api_key)
        resolved_key = api_key or os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        if not resolved_key:
            raise ValueError("GEMINI_API_KEY environment variable is not set.")
        self.client = genai.Client(api_key=resolved_key)

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
            # Batch embedding call via google-genai
            response = await self.client.aio.models.embed_content(
                model=resolved_model,
                contents=texts,
            )

            raw_embeddings = response.embeddings or []
            embeddings: List[List[float]] = []

            for emb in raw_embeddings:
                if hasattr(emb, "values") and emb.values:
                    embeddings.append(list(emb.values))
                elif isinstance(emb, list):
                    embeddings.append(emb)

            dim = len(embeddings[0]) if embeddings else self.DIMENSION

            return EmbeddingResult(
                embeddings=embeddings,
                model_name=resolved_model,
                dimension=dim,
                usage=TokenUsage(
                    prompt_tokens=sum(len(t.split()) for t in texts),
                    completion_tokens=0,
                    total_tokens=sum(len(t.split()) for t in texts),
                ),
            )
        except Exception as e:
            logger.error("Gemini embedding generation failed", error=str(e), model=resolved_model)
            raise
