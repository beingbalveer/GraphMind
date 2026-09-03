import tempfile
from pathlib import Path

import pytest
from ai_core.skills import (
    Skill,
    load_skill_from_file,
    load_skill_from_text,
    load_skills_from_dir,
)


def test_load_skill_from_text_standard() -> None:
    raw_md = """---
name: sample_skill
description: A test skill for verifying frontmatter parsing.
tags: [unit, test, demo]
required_tools: [tool_a, tool_b]
version: 1.2.0
author: Antigravity Team
---
# Sample Instructions

Always analyze inputs step-by-step.
1. Read the problem.
2. Formulate hypothesis.
"""
    skill = load_skill_from_text(raw_md)
    assert isinstance(skill, Skill)
    assert skill.name == "sample_skill"
    assert skill.description == "A test skill for verifying frontmatter parsing."
    assert skill.metadata.tags == ["unit", "test", "demo"]
    assert skill.required_tools == ["tool_a", "tool_b"]
    assert skill.metadata.version == "1.2.0"
    assert skill.metadata.author == "Antigravity Team"
    assert "Always analyze inputs step-by-step." in skill.content

    rendered = skill.render_prompt_section()
    assert "### Skill Playbook: sample_skill" in rendered
    assert "tool_a, tool_b" in rendered
    assert "Formulate hypothesis." in rendered


def test_load_skill_missing_frontmatter() -> None:
    raw_md = "# Raw Markdown Without Frontmatter\n\nJust instructions here."
    skill = load_skill_from_text(raw_md, path="/tmp/my_playbook/SKILL.md")
    assert skill.name == "my_playbook"
    assert "Procedural playbook for my_playbook" in skill.description
    assert skill.required_tools == []
    assert "Just instructions here." in skill.content


def test_load_skill_from_file_and_dir() -> None:
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_path = Path(tmpdir)
        skill_dir = tmp_path / "custom_skill"
        skill_dir.mkdir()
        file_path = skill_dir / "SKILL.md"

        file_path.write_text(
            """---
name: file_skill
description: Skill loaded from file.
required_tools: [calculator]
---
Execute calculations with high precision.
""",
            encoding="utf-8",
        )

        # Test load_skill_from_file
        loaded_single = load_skill_from_file(file_path)
        assert loaded_single.name == "file_skill"
        assert loaded_single.required_tools == ["calculator"]

        # Test load_skills_from_dir
        all_skills = load_skills_from_dir(tmp_path)
        assert len(all_skills) == 1
        assert all_skills[0].name == "file_skill"


def test_load_skill_nonexistent_file() -> None:
    with pytest.raises(FileNotFoundError):
        load_skill_from_file("/nonexistent/path/SKILL.md")
