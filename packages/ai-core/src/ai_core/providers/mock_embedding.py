import hashlib
import math
from typing import List, Optional

from ai_core.base import BaseEmbeddingProvider, EmbeddingResult, TokenUsage


class MockEmbeddingProvider(BaseEmbeddingProvider):
    """
    Deterministic, fast mock embedding provider for unit and integration tests.
    Produces unit-normalized dense vectors of arbitrary dimension without network calls.
    """

    def __init__(self, api_key: Optional[str] = None, dimension: int = 768) -> None:
        super().__init__(api_key=api_key)
        self.dimension = dimension

    def _generate_vector(self, text: str) -> List[float]:
        """
        Generate a deterministic unit-normalized float vector from input text hash.
        """
        raw_hash = hashlib.sha256(text.encode("utf-8")).digest()
        vector: List[float] = []

        for i in range(self.dimension):
            byte_val = raw_hash[i % len(raw_hash)]
            # Map byte (0-255) to range [-1.0, 1.0] with sinusoidal variance
            val = math.sin((byte_val + i) * 0.1)
            vector.append(val)

        # L2-normalize vector to unit length
        norm = math.sqrt(sum(x * x for x in vector)) or 1.0
        return [round(x / norm, 6) for x in vector]

    async def embed(
        self,
        texts: List[str],
        model_name: Optional[str] = None,
    ) -> EmbeddingResult:
        """
        Generate mock embeddings for the given list of texts.
        """
        resolved_model = model_name or "mock-embedding-768"
        embeddings = [self._generate_vector(t) for t in texts]
        total_tokens = sum(max(1, len(t.split())) for t in texts)

        return EmbeddingResult(
            embeddings=embeddings,
            model_name=resolved_model,
            dimension=self.dimension,
            usage=TokenUsage(
                prompt_tokens=total_tokens,
                completion_tokens=0,
                total_tokens=total_tokens,
            ),
        )
