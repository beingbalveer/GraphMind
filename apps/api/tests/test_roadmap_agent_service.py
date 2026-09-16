from schemas.roadmap_agent import RoadmapBlueprint, RoadmapBlueprintNode, RoadmapSource
from services.roadmap_agent_service import RoadmapBlueprintValidator, RoadmapValidationError
from services.roadmap_agent_service import RoadmapAgentService


def _valid_blueprint() -> RoadmapBlueprint:
    phases = [
        ("foundations", "Foundations"),
        ("machine-learning", "Machine Learning"),
        ("deep-learning", "Deep Learning"),
        ("llm-systems", "LLM Systems"),
        ("production-ai", "Production AI"),
    ]
    nodes = [RoadmapBlueprintNode(id="root", parent_id=None, title="AI Engineer", description="Build production AI systems.", kind="root", depth=0)]
    for phase_id, title in phases:
        nodes.append(RoadmapBlueprintNode(id=phase_id, parent_id="root", title=title, description=f"Learn {title}.", kind="phase", depth=1))
        for number in range(2):
            nodes.append(RoadmapBlueprintNode(id=f"{phase_id}-{number}", parent_id=phase_id, title=f"{title} topic {number + 1}", description="A small actionable learning unit.", kind="topic", depth=2, learning_action="Study and build a small exercise."))
    return RoadmapBlueprint(title="AI Engineer", description="Basic to advanced AI engineering.", profile_id="ai-engineer", nodes=nodes, sources=[RoadmapSource(title="Python documentation", url="https://docs.python.org/3/", domain="docs.python.org", snippet="Official documentation")])


def test_accepts_complete_ai_engineer_tree() -> None:
    blueprint = _valid_blueprint()

    RoadmapBlueprintValidator.validate(blueprint)


def test_rejects_orphan_topic() -> None:
    blueprint = _valid_blueprint()
    blueprint.nodes[-1].parent_id = "missing"

    try:
        RoadmapBlueprintValidator.validate(blueprint)
    except RoadmapValidationError as error:
        assert "parent" in str(error).lower()
    else:
        raise AssertionError("Expected an orphan node to be rejected")


async def test_agent_emits_public_progress_before_validated_blueprint() -> None:
    events = [event async for event in RoadmapAgentService.stream_generation()]

    assert [event.stage for event in events] == ["planning", "researching", "composing", "validating", "complete"]
    assert events[-1].outline == ["Foundations", "Machine Learning", "Deep Learning", "LLM Systems", "Production AI"]
