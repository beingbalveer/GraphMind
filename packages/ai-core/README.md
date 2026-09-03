# AI Core (`packages/ai-core`)

Provider-agnostic AI, LLM, Embedding, Tool, and Skill foundation layer for GraphMind.

---

## 🎯 Design Philosophy & Architectural Rules

`packages/ai-core` provides strict encapsulation around external AI foundation model providers. 

- **Vendor Decoupling**: Application code in `apps/api` **never** imports `openai`, `anthropic`, or `google-genai` directly. All models interact through standardized abstract base classes.
- **Async & Streaming-First**: Built entirely on asynchronous generators (`AsyncIterator[StreamChunk]`) for responsive Server-Sent Events (SSE).
- **Extensible Tool Protocol**: Uniform tool schemas and autonomous execution interfaces across diverse providers.
- **Declarative Skills**: File-based markdown skill definitions that inject expert personas and behaviors dynamically.

---

## 🏛️ Architecture & Directory Structure

```
packages/ai-core/
├── src/ai_core/
│   ├── base.py                 # Core domain models: BaseProvider, BaseTool, ToolCall, ToolResult, LLMConfig, Message
│   ├── lineage.py              # Conversation tree ancestor context resolution
│   ├── skills.py               # Markdown skill parser and prompt composer
│   ├── tree.py                 # Hierarchical graph node traversal logic
│   └── providers/              # Concrete provider adapters
│       ├── gemini.py           # Google Gemini (multimodal, search grounding, tools)
│       ├── anthropic.py        # Anthropic Claude (multimodal, tools)
│       ├── openai.py           # OpenAI (GPT-4o, tools)
│       ├── deepseek.py         # DeepSeek Chat & Reasoner
│       ├── ollama.py           # Local Ollama adapter
│       ├── mock.py             # Deterministic mock provider for unit testing
│       ├── gemini_embedding.py # Gemini embedding provider
│       ├── openai_embedding.py # OpenAI embedding provider
│       └── mock_embedding.py   # Deterministic vector embedding mock
└── tests/                      # Unit tests for providers, tools, skills, and lineage
```

---

## 🧩 Core Domain Abstractions

### 1. `BaseProvider`
Defines the foundation contract for text generation and streaming:
```python
class BaseProvider(ABC):
    @abstractmethod
    async def generate(self, messages: List[Message], config: LLMConfig) -> GenerationResult: ...

    @abstractmethod
    async def stream(self, messages: List[Message], config: LLMConfig) -> AsyncIterator[StreamChunk]: ...

    async def stream_with_tools(
        self,
        messages: List[Message],
        config: LLMConfig,
        tools: List[BaseTool],
    ) -> AsyncIterator[StreamChunk]: ...
```

### 2. `BaseTool`, `ToolCall`, and `ToolResult`
Standardized tool execution framework compatible with OpenAI and Gemini function schemas:
```python
class BaseTool(BaseModel):
    name: str
    description: str
    parameters: Dict[str, Any]  # JSON Schema

    async def execute(self, **kwargs: Any) -> Any:
        raise NotImplementedError

class ToolCall(BaseModel):
    id: str
    name: str
    arguments: Dict[str, Any]

class ToolResult(BaseModel):
    call_id: str
    name: str
    result: Any
    is_error: bool = False
```

### 3. `Skill` System
Parses YAML frontmatter and prompt templates from markdown files:
```python
class Skill(BaseModel):
    name: str
    description: str
    system_prompt: str
    tools: List[str] = Field(default_factory=list)
```

---

## 🔌 Supported Providers

| Provider | Adapter Class | Capabilities |
| :--- | :--- | :--- |
| **Google Gemini** | `GeminiProvider` | Multimodal (Images, PDFs), Native Google Search Grounding, Tool Calling, System Instructions |
| **Anthropic** | `AnthropicProvider` | Claude 3.5 Sonnet / Haiku, Multimodal (Images, PDFs), Tool Calling |
| **OpenAI** | `OpenAIProvider` | GPT-4o, GPT-4o-mini, Function/Tool Calling, Streaming |
| **DeepSeek** | `DeepSeekProvider` | DeepSeek-V3, DeepSeek-R1 (Reasoning output extraction) |
| **Ollama** | `OllamaProvider` | Local offline models via OpenAI-compatible endpoints |
| **Mock** | `MockLLMProvider` | Deterministic token streaming, simulated latency, zero-cost CI/CD testing |

---

## 💻 Usage Examples

### 1. Streaming Chat Completion
```python
from ai_core import LLMConfig, Message, Role, get_provider

# Initialize provider dynamically via factory
provider = get_provider("gemini", api_key="...")

messages = [
    Message(role=Role.SYSTEM, content="You are an expert systems architect."),
    Message(role=Role.USER, content="Explain event loops in async Python."),
]
config = LLMConfig(temperature=0.7, max_tokens=1024)

async for chunk in provider.stream(messages, config):
    print(chunk.content, end="", flush=True)
```

### 2. Autonomous Tool Calling
```python
from ai_core import BaseTool

class GraphSearchTool(BaseTool):
    name: str = "search_graph"
    description: str = "Search graph nodes by keyword"
    parameters: dict = {
        "type": "object",
        "properties": {"query": {"type": "string"}},
        "required": ["query"],
    }

    async def execute(self, query: str) -> str:
        return f"Found matching node: {query}"

# Pass tools to provider stream
async for chunk in provider.stream_with_tools(messages, config, tools=[GraphSearchTool()]):
    if chunk.tool_call:
        print(f"Executing tool: {chunk.tool_call.name}")
```

---

## 🧪 Testing

Run provider unit tests:
```bash
uv run pytest packages/ai-core/tests
```
