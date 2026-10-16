"""LSI-039 — Provider, model, and system-skill settings (backend contract).

Locks the server side of the provider/key/skill settings:

* the client BYOK key has precedence over the environment and is trimmed,
* an unconfigured provider is an actionable, recoverable error (never a silent
  mock fallback),
* the chat skill surface exposes only the chat personas, ignores unknown names,
  and injects a selected playbook into the system prompt,
* a BYOK secret is never written to logs.
"""

import pytest
from httpx import ASGITransport, AsyncClient
from main import app
from services.skill_service import get_skill_registry


def test_byok_key_precedence_and_env_fallback(monkeypatch: pytest.MonkeyPatch) -> None:
    from config import get_settings
    from routers.chat import _resolve_api_key

    settings = get_settings()
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "env-gemini-key", raising=False)
    monkeypatch.setattr(settings, "GOOGLE_API_KEY", None, raising=False)

    # A client-provided BYOK key wins over the environment, trimmed.
    assert _resolve_api_key("gemini", "  byok-gemini  ") == "byok-gemini"
    assert _resolve_api_key("openai", "byok-openai") == "byok-openai"
    assert _resolve_api_key("anthropic", "byok-claude") == "byok-claude"
    assert _resolve_api_key("deepseek", "byok-deepseek") == "byok-deepseek"

    # With no BYOK key the server environment is the fallback.
    assert _resolve_api_key("gemini") == "env-gemini-key"

    # Ollama needs no secret; an unknown provider resolves to no key at all.
    assert _resolve_api_key("ollama") == "ollama"
    assert _resolve_api_key("does-not-exist") is None


def test_system_skill_surface_exposes_chat_personas_only() -> None:
    registry = get_skill_registry()
    names = {skill["name"] for skill in registry.list_skills()}

    assert {"deep_research", "code_architect", "quiz_master"} <= names
    # Roadmap-scoped playbooks must never leak into the chat skill surface.
    assert "curriculum-design" not in names
    assert "workload-planning" not in names


def test_unknown_skill_is_ignored_and_known_skill_is_injected() -> None:
    registry = get_skill_registry()
    base_prompt = "BASE SYSTEM PROMPT"

    assert registry.get_skills(["not-a-real-skill"]) == []

    injected = registry.build_system_prompt(
        base_prompt, registry.get_skills(["deep_research"])
    )
    assert base_prompt in injected
    assert "deep_research" in injected

    # No selected skills leaves the base prompt untouched.
    assert registry.build_system_prompt(base_prompt, []) == base_prompt


def test_missing_provider_configuration_is_actionable() -> None:
    from config import Settings
    from services.roadmap.job_repository import JobStateError
    from services.roadmap.stages import configured_provider

    settings = Settings(_env_file=None, DEFAULT_PROVIDER="openai", OPENAI_API_KEY=None)
    with pytest.raises(JobStateError) as error:
        configured_provider(settings)

    assert error.value.code == "MODEL_NOT_CONFIGURED"
    assert error.value.error.recoverable is True
    assert error.value.error.next_action == "retry"
    assert "provider" in error.value.error.message.lower()


@pytest.mark.asyncio
async def test_byok_secret_is_never_written_to_logs(capsys: pytest.CaptureFixture[str]) -> None:
    transport = ASGITransport(app=app)
    secret = "sk-super-secret-value-987654321"
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/v1/chat/stream",
            json={
                "prompt": "hello there",
                "provider": "mock",
                "apiKey": secret,
                "metadata": {"stream_delay": 0.001},
            },
        )

    assert response.status_code == 200
    output = capsys.readouterr().out
    # The request is logged with a boolean flag, never the credential value.
    assert "has_api_key" in output
    assert secret not in output
