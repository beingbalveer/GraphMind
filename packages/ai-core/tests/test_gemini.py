from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from ai_core.base import ChatMessage, ChatRole, ModelConfig, ToolCall
from ai_core.providers.gemini import GeminiProvider
from google.genai import types


def test_explicit_thinking_budget_reserves_response_capacity():
    provider = GeminiProvider(api_key="fake-gemini-key")
    limited = provider._build_genai_config(
        "Return curriculum JSON", ModelConfig(max_tokens=65536, metadata={"thinking_budget": 2048})
    )
    assert limited.thinking_config is not None
    assert limited.thinking_config.thinking_budget == 2048
    assert limited.max_output_tokens == 65536
    assert provider._build_genai_config("Ordinary chat", ModelConfig()).thinking_config is None


@pytest.mark.asyncio
async def test_generate_preserves_empty_response_finish_reason():
    provider = GeminiProvider(api_key="fake-gemini-key")
    response = types.GenerateContentResponse(
        candidates=[types.Candidate(finish_reason=types.FinishReason.MALFORMED_FUNCTION_CALL)]
    )
    provider.client = SimpleNamespace(
        aio=SimpleNamespace(
            models=SimpleNamespace(generate_content=AsyncMock(return_value=response))
        )
    )
    result = await provider.generate("Build a drawing curriculum", ModelConfig(max_retries=0))
    assert result.content == "" and not result.tool_calls
    assert result.finish_reason == "MALFORMED_FUNCTION_CALL"


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


def _fc_part(name: str, args: dict, signature: bytes | None = None) -> types.Part:
    """Build a function-call Part, optionally carrying a Gemini 3 thought_signature."""
    return types.Part(
        function_call=types.FunctionCall(name=name, args=args),
        thought_signature=signature,
    )


@pytest.mark.asyncio
async def test_generate_captures_thought_signature_on_first_parallel_call():
    """Gemini 3 attaches thought_signature only to the first parallel function-call part."""
    provider = GeminiProvider(api_key="fake-gemini-key")
    sig = b"\x12\xa2signature-bytes"
    response = types.GenerateContentResponse(
        candidates=[
            types.Candidate(
                finish_reason=types.FinishReason.STOP,
                content=types.Content(
                    parts=[
                        _fc_part("get_weather", {"city": "Paris"}, sig),
                        _fc_part("get_weather", {"city": "London"}),
                    ]
                ),
            )
        ]
    )
    provider.client = SimpleNamespace(
        aio=SimpleNamespace(
            models=SimpleNamespace(generate_content=AsyncMock(return_value=response))
        )
    )
    result = await provider.generate("Call the weather tool", ModelConfig(max_retries=0), tools=[])
    assert result.tool_calls is not None and len(result.tool_calls) == 2
    assert result.tool_calls[0].thought_signature == sig
    assert result.tool_calls[1].thought_signature is None


def test_to_contents_replays_thought_signature_on_assistant_tool_call() -> None:
    """The replayed assistant function call must keep the Gemini 3 thought_signature."""
    with patch.dict("os.environ", {"GEMINI_API_KEY": "fake-gemini-key"}):
        provider = GeminiProvider()
    sig = b"\x12\xa2signature-bytes"
    messages = [
        ChatMessage.assistant(
            "",
            tool_calls=[
                ToolCall(
                    id="c1",
                    name="get_weather",
                    arguments={"city": "Paris"},
                    thought_signature=sig,
                )
            ],
        )
    ]
    _, contents = provider._to_genai_contents(messages, system_prompt=None)
    part = contents[0].parts[0]
    assert part.function_call is not None
    assert part.function_call.name == "get_weather"
    assert part.thought_signature == sig


def test_to_contents_omits_signature_when_absent() -> None:
    """Calls without a signature use the plain from_function_call path (back-compat)."""
    with patch.dict("os.environ", {"GEMINI_API_KEY": "fake-gemini-key"}):
        provider = GeminiProvider()
    messages = [
        ChatMessage.assistant(
            "",
            tool_calls=[ToolCall(id="c1", name="get_weather", arguments={"city": "Paris"})],
        )
    ]
    _, contents = provider._to_genai_contents(messages, system_prompt=None)
    part = contents[0].parts[0]
    assert part.function_call is not None
    assert part.function_call.name == "get_weather"
    assert getattr(part, "thought_signature", None) is None
