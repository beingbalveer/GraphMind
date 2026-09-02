from unittest.mock import patch

from ai_core.base import ChatMessage, ChatRole, ModelConfig
from ai_core.providers.gemini import GeminiProvider


def test_gemini_to_contents_and_system_prompt_extraction() -> None:
    with patch.dict("os.environ", {"GEMINI_API_KEY": "fake-gemini-key"}):
        provider = GeminiProvider()

    messages = [
        ChatMessage(role=ChatRole.SYSTEM, content="In-line system instruction."),
        ChatMessage(role=ChatRole.USER, content="Hello Gemini!"),
        ChatMessage(role=ChatRole.ASSISTANT, content="Hi there!"),
    ]

    system_instruction, contents = provider._to_genai_contents(
        messages, system_prompt="Global custom instruction."
    )

    # Verify system prompts merged
    assert system_instruction is not None
    assert "Global custom instruction." in system_instruction
    assert "In-line system instruction." in system_instruction

    # Verify messages converted to user/model roles without system messages
    assert len(contents) == 2
    assert contents[0].role == "user"
    assert contents[0].parts[0].text == "Hello Gemini!"
    assert contents[1].role == "model"
    assert contents[1].parts[0].text == "Hi there!"


def test_gemini_build_genai_config() -> None:
    with patch.dict("os.environ", {"GEMINI_API_KEY": "fake-gemini-key"}):
        provider = GeminiProvider()

    cfg = ModelConfig(
        model_name="gemini-2.5-flash",
        temperature=0.3,
        max_tokens=2048,
        system_prompt="Be concise",
    )

    genai_config = provider._build_genai_config("Be concise", cfg)
    assert genai_config.system_instruction == "Be concise"
    assert genai_config.temperature == 0.3
    assert genai_config.max_output_tokens == 2048
