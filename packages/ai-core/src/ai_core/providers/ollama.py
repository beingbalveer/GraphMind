import os
from typing import Optional

from ai_core.providers.openai import OpenAIProvider

DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434/v1"
DEFAULT_OLLAMA_MODEL = "llama3.3"


class OllamaProvider(OpenAIProvider):
    """
    Ollama local open-source model provider (DeepSeek-R1, Llama 3.3, Qwen 2.5 Coder, Mistral)
    using the OpenAI-compatible local HTTP endpoint. Requires zero cloud API keys.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        default_model: str = DEFAULT_OLLAMA_MODEL,
    ):
        # Ollama local endpoint does not require an API key, but AsyncOpenAI requires a non-empty string
        resolved_key = api_key or os.getenv("OLLAMA_API_KEY") or "ollama"
        resolved_base_url = base_url or os.getenv("OLLAMA_BASE_URL") or DEFAULT_OLLAMA_BASE_URL
        super().__init__(
            api_key=resolved_key,
            base_url=resolved_base_url,
            default_model=default_model,
        )
