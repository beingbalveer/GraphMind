import os
from typing import Optional

from ai_core.providers.openai import OpenAIProvider

DEFAULT_DEEPSEEK_BASE_URL = "https://api.deepseek.com/v1"
DEFAULT_DEEPSEEK_MODEL = "deepseek-chat"


class DeepSeekProvider(OpenAIProvider):
    """
    DeepSeek foundation model provider (DeepSeek-V3, DeepSeek-R1)
    leveraging the OpenAI-compatible REST API.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        default_model: str = DEFAULT_DEEPSEEK_MODEL,
    ):
        resolved_key = api_key or os.getenv("DEEPSEEK_API_KEY")
        if not resolved_key:
            raise ValueError("DEEPSEEK_API_KEY environment variable is not set.")
        resolved_base_url = base_url or os.getenv("DEEPSEEK_BASE_URL") or DEFAULT_DEEPSEEK_BASE_URL
        super().__init__(
            api_key=resolved_key,
            base_url=resolved_base_url,
            default_model=default_model,
        )
