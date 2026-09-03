import datetime
from typing import Any, Dict, List, Optional

import structlog
from ai_core.base import BaseTool
from pydantic import BaseModel, Field
from services.graph_tools import (
    CreateSubnodeTool,
    FetchUrlTool,
    SearchGraphTool,
    TraverseLineageTool,
)

logger = structlog.get_logger()


# Built-in verification tools
class CalculatorInput(BaseModel):
    expression: str = Field(
        ..., description="Mathematical expression to evaluate, e.g., '24 * 7' or 'sqrt(144)'"
    )


class CalculatorTool(BaseTool):
    name = "calculator"
    description = "Safely evaluates mathematical expressions and arithmetic formulas."
    parameters_schema = CalculatorInput

    async def execute(self, expression: str) -> Dict[str, Any]:
        import math

        allowed_names = {
            "abs": abs,
            "round": round,
            "min": min,
            "max": max,
            "sum": sum,
            "pow": pow,
            "math": math,
            "sqrt": math.sqrt,
            "sin": math.sin,
            "cos": math.cos,
            "tan": math.tan,
            "pi": math.pi,
            "e": math.e,
        }
        # Sanitize expression: only allow math characters and symbols
        clean_expr = expression.strip()
        try:
            # Safe restricted eval
            result = eval(clean_expr, {"__builtins__": {}}, allowed_names)  # noqa: S307
            return {"expression": expression, "result": result}
        except Exception as err:
            raise ValueError(f"Failed to calculate '{expression}': {str(err)}") from err


class SystemInfoInput(BaseModel):
    include_timestamp: bool = Field(
        default=True, description="Whether to include current UTC timestamp"
    )


class SystemInfoTool(BaseTool):
    name = "system_info"
    description = "Provides current system status, platform version, and UTC timestamp."
    parameters_schema = SystemInfoInput

    async def execute(self, include_timestamp: bool = True) -> Dict[str, Any]:
        payload: Dict[str, Any] = {
            "platform": "GraphMind AI Engine",
            "version": "1.0.0-alpha",
            "status": "healthy",
        }
        if include_timestamp:
            payload["utc_timestamp"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
        return payload


class ToolRegistry:
    """
    Central repository of tools available for agent execution in GraphMind.
    """

    def __init__(self) -> None:
        self._tools: Dict[str, BaseTool] = {}
        # Register default calculation and system tools
        self.register(CalculatorTool())
        self.register(SystemInfoTool())
        # Register graph-native agent tools
        self.register(SearchGraphTool())
        self.register(TraverseLineageTool())
        self.register(CreateSubnodeTool())
        self.register(FetchUrlTool())

    def register(self, tool: BaseTool) -> None:
        """Register a tool instance."""
        if not tool.name or not tool.name.strip():
            raise ValueError("Tool name must not be empty.")
        self._tools[tool.name.strip()] = tool
        logger.info("Registered agent tool", tool_name=tool.name)

    def unregister(self, name: str) -> bool:
        """Remove a tool by name."""
        return self._tools.pop(name.strip(), None) is not None

    def get(self, name: str) -> Optional[BaseTool]:
        """Retrieve a tool by name."""
        return self._tools.get(name.strip())

    def get_tools(self, names: Optional[List[str]] = None) -> List[BaseTool]:
        """
        Retrieve tools matching names, or all registered tools if names is None.
        """
        if names is None:
            return list(self._tools.values())
        return [self._tools[n.strip()] for n in names if n.strip() in self._tools]

    def list_tool_definitions(self) -> List[Dict[str, Any]]:
        """
        Return JSON schema descriptions of all registered tools.
        """
        return [
            {
                "name": tool.name,
                "description": tool.description,
                "parameters": tool.to_json_schema(),
            }
            for tool in self._tools.values()
        ]


_global_registry = ToolRegistry()


def get_tool_registry() -> ToolRegistry:
    """Access the singleton ToolRegistry instance."""
    return _global_registry
