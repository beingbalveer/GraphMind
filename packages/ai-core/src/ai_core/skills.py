import os
import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

from pydantic import BaseModel, Field


class SkillMetadata(BaseModel):
    """
    Metadata extracted from a SKILL.md YAML frontmatter header.
    """

    name: str = Field(..., description="Unique machine-readable skill name")
    description: str = Field(..., description="High-level summary of what this skill does")
    tags: List[str] = Field(default_factory=list, description="Categorization tags")
    required_tools: List[str] = Field(
        default_factory=list, description="Tools that must be made available for this skill"
    )
    version: str = Field(default="1.0.0", description="Semantic version of the skill")
    author: Optional[str] = Field(default=None, description="Author or maintainer of the skill")


class Skill:
    """
    Represents an executable agent procedural playbook.
    """

    def __init__(
        self,
        metadata: SkillMetadata,
        content: str,
        path: Optional[str] = None,
    ) -> None:
        self.metadata = metadata
        self.content = content.strip()
        self.path = path

    @property
    def name(self) -> str:
        return self.metadata.name

    @property
    def description(self) -> str:
        return self.metadata.description

    @property
    def required_tools(self) -> List[str]:
        return self.metadata.required_tools

    def render_prompt_section(self, include_header: bool = True) -> str:
        """
        Format the skill playbook into a markdown prompt block for model injection.
        """
        parts: List[str] = []
        if include_header:
            parts.append(f"### Skill Playbook: {self.metadata.name}")
            parts.append(f"**Description:** {self.metadata.description}")
            if self.metadata.required_tools:
                parts.append(f"**Required Tools:** {', '.join(self.metadata.required_tools)}")
            parts.append("")
        parts.append(self.content)
        return "\n".join(parts)

    def __repr__(self) -> str:
        return f"Skill(name='{self.name}', tools={self.required_tools})"


def _parse_frontmatter(text: str) -> tuple[Dict[str, Any], str]:
    """
    Extract YAML frontmatter and markdown body from a raw file text.
    Handles standard YAML key-value pairs, string arrays, and multiline body.
    """
    stripped = text.strip()
    if not stripped.startswith("---"):
        return {}, stripped

    # Match --- frontmatter --- body
    pattern = r"^---\s*\n(.*?)\n---\s*\n(.*)$"
    match = re.match(pattern, stripped, re.DOTALL)
    if not match:
        return {}, stripped

    raw_yaml, body = match.group(1), match.group(2)
    metadata: Dict[str, Any] = {}

    try:
        import yaml  # type: ignore

        parsed = yaml.safe_load(raw_yaml)
        if isinstance(parsed, dict):
            metadata = parsed
            return metadata, body.strip()
    except Exception:
        pass

    # Resilient fallback parser for YAML frontmatter key-values
    current_list_key: Optional[str] = None
    for line in raw_yaml.splitlines():
        line_clean = line.strip()
        if not line_clean or line_clean.startswith("#"):
            continue

        if line_clean.startswith("- ") and current_list_key:
            item_val = line_clean[2:].strip().strip("\"'")
            metadata.setdefault(current_list_key, []).append(item_val)
            continue

        if ":" in line_clean:
            key, val = line_clean.split(":", 1)
            key = key.strip()
            val = val.strip()

            if not val:
                # Potential start of indented list
                current_list_key = key
                metadata[key] = []
            elif val.startswith("[") and val.endswith("]"):
                current_list_key = None
                items = [item.strip().strip("\"'") for item in val[1:-1].split(",") if item.strip()]
                metadata[key] = items
            else:
                current_list_key = None
                # Strip quotes if present
                clean_val = val.strip("\"'")
                metadata[key] = clean_val

    return metadata, body.strip()


def load_skill_from_text(text: str, path: Optional[str] = None) -> Skill:
    """
    Parse a SKILL.md document into a Skill instance.
    """
    raw_meta, body = _parse_frontmatter(text)

    # Derive name fallback from path or content title if missing in frontmatter
    if "name" not in raw_meta or not raw_meta["name"]:
        if path:
            parent_dir = Path(path).parent.name
            raw_meta["name"] = parent_dir if parent_dir != "." else Path(path).stem
        else:
            raw_meta["name"] = "unnamed_skill"

    if "description" not in raw_meta or not raw_meta["description"]:
        raw_meta["description"] = f"Procedural playbook for {raw_meta['name']}"

    # Ensure required_tools and tags are lists
    if isinstance(raw_meta.get("required_tools"), str):
        raw_meta["required_tools"] = [t.strip() for t in raw_meta["required_tools"].split(",")]
    if isinstance(raw_meta.get("tags"), str):
        raw_meta["tags"] = [t.strip() for t in raw_meta["tags"].split(",")]

    meta = SkillMetadata(**raw_meta)
    return Skill(metadata=meta, content=body, path=path)


def load_skill_from_file(path: Union[str, Path]) -> Skill:
    """
    Load a single SKILL.md file from disk.
    """
    file_path = Path(path).resolve()
    if not file_path.is_file():
        raise FileNotFoundError(f"Skill file not found: {file_path}")

    text = file_path.read_text(encoding="utf-8")
    return load_skill_from_text(text, path=str(file_path))


def load_skills_from_dir(dir_path: Union[str, Path]) -> List[Skill]:
    """
    Recursively scan a directory for SKILL.md or *.skill.md files.
    """
    root_dir = Path(dir_path).resolve()
    if not root_dir.is_dir():
        return []

    skills: List[Skill] = []
    for root, _, files in os.walk(root_dir):
        for file in files:
            if file.upper() == "SKILL.MD" or file.endswith(".skill.md"):
                full_path = Path(root) / file
                try:
                    skill = load_skill_from_file(full_path)
                    skills.append(skill)
                except Exception:
                    pass
    return skills
