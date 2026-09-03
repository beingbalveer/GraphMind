from typing import Any, Dict

import pytest
from ai_core.base import (
    BaseTool,
    ChatMessage,
    ChatRole,
    ModelConfig,
    ToolCall,
    ToolResult,
)
from ai_core.providers.anthropic import _to_anthropic_tools
from ai_core.providers.mock import MockProvider
from ai_core.providers.openai import _to_openai_tools
from pydantic import BaseModel, Field


class CalculatorInput(BaseModel):
    a: float = Field(..., description="First operand")
    b: float = Field(..., description="Second operand")
    operation: str = Field(default="add", description="Arithmetic operation: add, multiply, divide")


class CalculatorTool(BaseTool):
    name = "calculator"
    description = "Performs basic arithmetic operations on two numbers."
    parameters_schema = CalculatorInput

    async def execute(self, a: float, b: float, operation: str = "add") -> Dict[str, Any]:
        if operation == "add":
            return {"result": a + b}
        elif operation == "multiply":
            return {"result": a * b}
        elif operation == "divide":
            if b == 0:
                raise ZeroDivisionError("Cannot divide by zero.")
            return {"result": a / b}
        raise ValueError(f"Unknown operation: {operation}")


class NoArgTool(BaseTool):
    name = "get_current_time"
    description = "Returns current UTC timestamp."

    async def execute(self) -> str:
        return "2026-09-03T12:00:00Z"


def test_tool_json_schema_generation() -> None:
    tool = CalculatorTool()
    schema = tool.to_json_schema()

    assert schema["type"] == "object"
    assert "properties" in schema
    assert "a" in schema["properties"]
    assert "b" in schema["properties"]
    assert "operation" in schema["properties"]
    assert "a" in schema["required"]
    assert "b" in schema["required"]


def test_no_arg_tool_json_schema() -> None:
    tool = NoArgTool()
    schema = tool.to_json_schema()

    assert schema["type"] == "object"
    assert schema["properties"] == {}
    assert schema["required"] == []


@pytest.mark.asyncio
async def test_tool_execution_success() -> None:
    tool = CalculatorTool()
    result = await tool.run({"a": 10.5, "b": 4.5, "operation": "add"}, tool_call_id="call_calc_1")

    assert isinstance(result, ToolResult)
    assert result.tool_call_id == "call_calc_1"
    assert result.name == "calculator"
    assert not result.is_error
    assert '"result": 15.0' in result.content or '"result":15.0' in result.content


@pytest.mark.asyncio
async def test_tool_execution_json_string_input() -> None:
    tool = CalculatorTool()
    result = await tool.run('{"a": 3, "b": 7, "operation": "multiply"}', tool_call_id="call_calc_2")

    assert not result.is_error
    assert '"result": 21.0' in result.content or '"result":21.0' in result.content


@pytest.mark.asyncio
async def test_tool_execution_validation_error() -> None:
    tool = CalculatorTool()
    # Missing required field 'b'
    result = await tool.run({"a": 10.0}, tool_call_id="call_calc_3")

    assert result.is_error
    assert "Validation error" in result.content


@pytest.mark.asyncio
async def test_tool_execution_runtime_exception() -> None:
    tool = CalculatorTool()
    # Division by zero
    result = await tool.run({"a": 10.0, "b": 0, "operation": "divide"}, tool_call_id="call_calc_4")

    assert result.is_error
    assert "Cannot divide by zero" in result.content


def test_chat_message_tool_helpers() -> None:
    # Assistant message with tool calls
    call = ToolCall(id="call_123", name="calculator", arguments={"a": 1, "b": 2})
    assistant_msg = ChatMessage.assistant(content="Calculating...", tool_calls=[call])

    assert assistant_msg.role == ChatRole.ASSISTANT
    assert assistant_msg.tool_calls is not None
    assert len(assistant_msg.tool_calls) == 1
    assert assistant_msg.tool_calls[0].name == "calculator"
    assert assistant_msg.tool_calls[0].arguments == {"a": 1, "b": 2}

    # Tool result message
    tool_msg = ChatMessage.tool(content='{"result": 3}', tool_call_id="call_123", name="calculator")
    assert tool_msg.role == ChatRole.TOOL
    assert tool_msg.tool_call_id == "call_123"
    assert tool_msg.name == "calculator"
    assert tool_msg.content == '{"result": 3}'


@pytest.mark.asyncio
async def test_mock_provider_tool_simulation_via_metadata() -> None:
    provider = MockProvider()
    cfg = ModelConfig(
        metadata={
            "simulate_tool_call": {
                "id": "call_mock_42",
                "name": "calculator",
                "arguments": {"a": 5, "b": 10},
            }
        }
    )

    res = await provider.generate("Add 5 and 10", config=cfg)
    assert res.tool_calls is not None
    assert len(res.tool_calls) == 1
    assert res.tool_calls[0].id == "call_mock_42"
    assert res.tool_calls[0].name == "calculator"
    assert res.tool_calls[0].arguments == {"a": 5, "b": 10}


@pytest.mark.asyncio
async def test_mock_provider_tool_simulation_via_prompt_trigger() -> None:
    provider = MockProvider()
    tools = [CalculatorTool()]

    res = await provider.generate("Please perform [TRIGGER_TOOL: calculator]", tools=tools)
    assert res.tool_calls is not None
    assert len(res.tool_calls) == 1
    assert res.tool_calls[0].name == "calculator"


@pytest.mark.asyncio
async def test_mock_provider_stream_tool_simulation() -> None:
    provider = MockProvider()
    cfg = ModelConfig(
        metadata={
            "simulate_tool_call": {
                "id": "call_stream_1",
                "name": "calculator",
                "arguments": {"a": 2, "b": 3},
            }
        }
    )

    chunks = []
    async for chunk in provider.stream("Compute", config=cfg):
        chunks.append(chunk)

    assert len(chunks) >= 1
    assert chunks[0].tool_calls is not None
    assert chunks[0].tool_calls[0].name == "calculator"


def test_provider_tool_formatters() -> None:
    tool = CalculatorTool()

    # OpenAI format
    openai_specs = _to_openai_tools([tool])
    assert openai_specs is not None
    assert len(openai_specs) == 1
    assert openai_specs[0]["type"] == "function"
    assert openai_specs[0]["function"]["name"] == "calculator"
    assert "properties" in openai_specs[0]["function"]["parameters"]

    # Anthropic format
    anthropic_specs = _to_anthropic_tools([tool])
    assert anthropic_specs is not None
    assert len(anthropic_specs) == 1
    assert anthropic_specs[0]["name"] == "calculator"
    assert "properties" in anthropic_specs[0]["input_schema"]
