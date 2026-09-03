from pathlib import Path
from typing import Any, Dict, List, Optional

import structlog
from ai_core.skills import Skill, load_skills_from_dir

logger = structlog.get_logger()


class SkillRegistry:
    """
    Central repository for discovering, managing, and injecting procedural skills in GraphMind.
    """

    def __init__(self, skills_dir: Optional[Path] = None) -> None:
        self._skills: Dict[str, Skill] = {}

        # Default to apps/api/skills relative to this file if not specified
        if skills_dir is None:
            base_dir = Path(__file__).resolve().parent.parent.parent  # apps/api
            skills_dir = base_dir / "skills"

        self.skills_dir = skills_dir
        self.load_directory(self.skills_dir)

    def load_directory(self, dir_path: Path) -> int:
        """
        Scan directory for SKILL.md files and register them.
        """
        if not dir_path.exists():
            logger.info("Skills directory does not exist, skipping scan", dir=str(dir_path))
            return 0

        loaded = load_skills_from_dir(dir_path)
        for skill in loaded:
            self.register(skill)
        logger.info("Discovered and indexed agent skills", count=len(loaded), dir=str(dir_path))
        return len(loaded)

    def register(self, skill: Skill) -> None:
        """
        Register a Skill playbook instance.
        """
        if not skill.name:
            raise ValueError("Skill must have a name.")
        self._skills[skill.name.strip()] = skill
        logger.info("Registered agent skill", name=skill.name, required_tools=skill.required_tools)

    def get(self, name: str) -> Optional[Skill]:
        """
        Retrieve a skill by its unique identifier name.
        """
        return self._skills.get(name.strip())

    def get_skills(self, names: Optional[List[str]] = None) -> List[Skill]:
        """
        Retrieve skills matching a list of names, or all if names is None.
        """
        if names is None:
            return list(self._skills.values())
        return [self._skills[n.strip()] for n in names if n.strip() in self._skills]

    def list_skills(self) -> List[Dict[str, Any]]:
        """
        List metadata definitions of all registered skills.
        """
        return [
            {
                "name": skill.metadata.name,
                "description": skill.metadata.description,
                "tags": skill.metadata.tags,
                "required_tools": skill.metadata.required_tools,
                "version": skill.metadata.version,
                "author": skill.metadata.author,
            }
            for skill in self._skills.values()
        ]

    def resolve_required_tools(self, skills: List[Skill]) -> List[str]:
        """
        Collect and deduplicate all tools required across a set of active skills.
        """
        tools_set: set[str] = set()
        for skill in skills:
            for tool_name in skill.required_tools:
                tools_set.add(tool_name.strip())
        return list(tools_set)

    def build_system_prompt(self, base_prompt: str, skills: List[Skill]) -> str:
        """
        Enhance a base system prompt with rendered skill playbook instructions.
        """
        if not skills:
            return base_prompt

        skill_sections = [s.render_prompt_section() for s in skills]
        separator = "\n\n" + "=" * 40 + "\n\n"
        skills_block = (
            "## Active Agent Skills & Procedural Playbooks\n"
            "You have been equipped with the following specialized skills. "
            "Follow their instructions, guidelines, and tool usage protocols strictly:\n\n"
            + separator.join(skill_sections)
        )
        return f"{base_prompt.strip()}\n\n{skills_block}"


_global_skill_registry: Optional[SkillRegistry] = None


def get_skill_registry() -> SkillRegistry:
    """Access the singleton SkillRegistry instance."""
    global _global_skill_registry
    if _global_skill_registry is None:
        _global_skill_registry = SkillRegistry()
    return _global_skill_registry
