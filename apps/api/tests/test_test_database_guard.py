"""Exercise test bootstrap in a subprocess, without connecting to a database."""

import os
import subprocess
import sys
from pathlib import Path

import pytest

FIXTURE = Path(__file__).with_name("conftest.py")
REPOSITORY = FIXTURE.parents[3]


def import_fixture(url: str | None, environment: str | None) -> subprocess.CompletedProcess[str]:
    env = dict(os.environ)
    env["PYTHONPATH"] = os.pathsep.join(
        [str(REPOSITORY / "apps/api/src"), str(REPOSITORY / "packages/ai-core/src")]
    )
    for name, value in {"DATABASE_URL": url, "ENVIRONMENT": environment}.items():
        if value is None:
            env.pop(name, None)
        else:
            env[name] = value
    return subprocess.run(
        [sys.executable, "-c", f"import runpy; runpy.run_path({str(FIXTURE)!r})"],
        env=env,
        capture_output=True,
        text=True,
        check=False,
        timeout=15,
    )


def test_live_database_is_rejected_before_database_import() -> None:
    result = import_fixture("postgresql+asyncpg://x:x@127.0.0.1:1/graphmind", "test")
    assert result.returncode != 0
    assert "isolated *_test database" in result.stderr
    assert "Connection refused" not in result.stderr


@pytest.mark.parametrize(
    ("url", "environment"),
    [
        (None, "test"),
        ("not a connection URL", "test"),
        ("postgresql+asyncpg://x:x@localhost/graphmind_test", None),
        ("postgresql+asyncpg://x:x@localhost/graphmind_test", "development"),
        ("sqlite:///graphmind_test", "test"),
    ],
)
def test_unsafe_test_configuration_is_rejected(url: str | None, environment: str | None) -> None:
    result = import_fixture(url, environment)
    assert result.returncode != 0
    assert "isolated *_test database" in result.stderr
    assert "not a connection URL" not in result.stderr


def test_explicit_postgres_test_database_can_import_without_connecting() -> None:
    result = import_fixture("postgresql+asyncpg://x:x@127.0.0.1:1/graphmind_test", "test")
    assert result.returncode == 0, result.stderr
