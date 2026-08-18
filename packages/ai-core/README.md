# AI Core (`packages/ai-core`)

Provider-agnostic AI and LLM foundation model abstraction package for GraphMind.

## Overview
This package defines the abstract interfaces (`BaseProvider`, `LLMConfig`, `StreamChunk`, `GenerationResult`) that all foundation model adapters (OpenAI, Anthropic, Ollama) must implement.

Application code in `apps/api` depends strictly on `ai-core` abstractions and never imports third-party provider SDKs directly.
