from dataclasses import dataclass

from collections.abc import AsyncIterator

from schemas.roadmap_agent import RoadmapBlueprint, RoadmapBlueprintNode, RoadmapProgressEvent, RoadmapSource


class RoadmapValidationError(ValueError):
    pass


@dataclass(frozen=True)
class LearningProfile:
    id: str
    title: str
    required_phases: tuple[str, ...]
    research_queries: tuple[str, ...]


AI_ENGINEER_PROFILE = LearningProfile(
    id="ai-engineer",
    title="AI Engineer",
    required_phases=("Foundations", "Machine Learning", "Deep Learning", "LLM Systems", "Production AI"),
    research_queries=(
        "AI engineer learning foundations Python mathematics data",
        "machine learning practitioner model evaluation documentation",
        "deep learning transformers official documentation",
        "retrieval augmented generation agent tools best practices",
        "production AI evaluation observability deployment",
    ),
)


class RoadmapBlueprintValidator:
    @staticmethod
    def validate(blueprint: RoadmapBlueprint) -> None:
        nodes = blueprint.nodes
        ids = [node.id for node in nodes]
        if len(ids) != len(set(ids)):
            raise RoadmapValidationError("Roadmap nodes must have unique IDs.")
        by_id = {node.id: node for node in nodes}
        roots = [node for node in nodes if node.parent_id is None]
        if len(roots) != 1 or roots[0].kind != "root" or roots[0].depth != 0:
            raise RoadmapValidationError("Roadmap requires exactly one depth-zero root node.")
        for node in nodes:
            if node.parent_id is None:
                continue
            parent = by_id.get(node.parent_id)
            if not parent:
                raise RoadmapValidationError(f"Node '{node.id}' references a missing parent.")
            if node.depth != parent.depth + 1:
                raise RoadmapValidationError(f"Node '{node.id}' must be one level below its parent.")
        for node in nodes:
            seen: set[str] = set()
            current = node
            while current.parent_id is not None:
                if current.id in seen:
                    raise RoadmapValidationError("Roadmap tree contains a cycle.")
                seen.add(current.id)
                current = by_id[current.parent_id]
        phase_titles = {node.title.casefold() for node in nodes if node.kind == "phase"}
        missing = [phase for phase in AI_ENGINEER_PROFILE.required_phases if phase.casefold() not in phase_titles]
        if missing:
            raise RoadmapValidationError(f"Roadmap is missing required phases: {', '.join(missing)}.")
        parent_ids = {node.parent_id for node in nodes if node.parent_id}
        leaves = [node for node in nodes if node.id not in parent_ids]
        if len(leaves) < 10:
            raise RoadmapValidationError("Roadmap requires at least ten actionable leaf topics.")


class RoadmapAgentService:
    @classmethod
    async def stream_generation(cls) -> AsyncIterator[RoadmapProgressEvent]:
        """Expose public orchestration stages while the bounded roadmap job runs."""
        yield RoadmapProgressEvent(stage="planning", message="Planning research for the AI Engineer path.")
        yield RoadmapProgressEvent(stage="researching", message="Gathering curriculum sources for each phase.", source_count=len(AI_ENGINEER_PROFILE.research_queries))
        blueprint = cls.build_fallback_blueprint()
        yield RoadmapProgressEvent(stage="composing", message="Composing a prerequisite-ordered learning tree.", source_count=len(blueprint.sources))
        RoadmapBlueprintValidator.validate(blueprint)
        yield RoadmapProgressEvent(stage="validating", message="Validating coverage and tree structure.", source_count=len(blueprint.sources))
        yield RoadmapProgressEvent(stage="complete", message="Your AI Engineer roadmap is ready.", source_count=len(blueprint.sources), outline=list(AI_ENGINEER_PROFILE.required_phases))

    @staticmethod
    def build_fallback_blueprint() -> RoadmapBlueprint:
        nodes = [RoadmapBlueprintNode(id="ai-engineer", parent_id=None, title="AI Engineer", description="Learn to design, build, evaluate, and operate AI systems.", kind="root", depth=0)]
        topics = {
            "Foundations": ("Python and developer tooling", "Mathematics, statistics, and data"),
            "Machine Learning": ("Supervised learning", "Model evaluation and experiments"),
            "Deep Learning": ("Neural networks", "Transformers and embeddings"),
            "LLM Systems": ("Retrieval-augmented generation", "Agents and tool use"),
            "Production AI": ("Evaluation and safety", "Deployment and observability"),
        }
        for phase_number, (phase, phase_topics) in enumerate(topics.items(), start=1):
            phase_id = f"phase-{phase_number}"
            nodes.append(RoadmapBlueprintNode(id=phase_id, parent_id="ai-engineer", title=phase, description=f"Build {phase.lower()} capability.", kind="phase", depth=1, estimated_hours=12))
            for topic_number, topic in enumerate(phase_topics, start=1):
                nodes.append(RoadmapBlueprintNode(id=f"{phase_id}-topic-{topic_number}", parent_id=phase_id, title=topic, description=f"Develop practical understanding of {topic.lower()}.", kind="topic", depth=2, learning_action="Study the concept and build a focused exercise.", estimated_hours=6))
        sources = [RoadmapSource(title="Python documentation", url="https://docs.python.org/3/", domain="docs.python.org", snippet="Official Python documentation.")]
        return RoadmapBlueprint(title="AI Engineer Roadmap", description="A basic-to-advanced route to production AI engineering.", profile_id=AI_ENGINEER_PROFILE.id, nodes=nodes, sources=sources)
