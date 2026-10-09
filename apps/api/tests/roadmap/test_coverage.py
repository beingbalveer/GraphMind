import pytest


def test_budget_selection_retains_all_topics_and_learning_content(small_candidate):
    from services.roadmap.coverage import select_core

    result = select_core(small_candidate, ["t1"], "Practice confident lines", [])
    assert {i.id for i in result.items} == {i.id for i in small_candidate.items}
    assert result.resources == small_candidate.resources
    assert result.items[3].brief == small_candidate.items[3].brief
    assert {i.id for i in result.items if i.kind == "topic" and i.path == "core"} == {"t1"}
    assert {i.id for i in result.items if i.kind == "topic" and i.path == "further"} == {"t2", "t3"}


def test_selection_cannot_invent_topics_or_skip_prerequisites(small_candidate):
    from services.roadmap.coverage import select_core

    with pytest.raises(ValueError, match="Unknown"):
        select_core(small_candidate, ["invented"], "Outcome", [])
    with pytest.raises(ValueError, match="prerequisite"):
        select_core(small_candidate, ["t2"], "Outcome", [])


def test_coverage_check_includes_further_learning_but_rejects_removed_topics(small_candidate):
    from schemas.roadmap_job import CoverageTopic
    from services.roadmap.coverage import coverage_issues

    inventory = [
        CoverageTopic(id="t1", title="Line control", area="Drawing", source_ids=["s1"]),
        CoverageTopic(id="t2", title="Simple forms", area="Drawing", source_ids=["s2"]),
    ]
    small_candidate.items[3].path = "further"
    assert not coverage_issues(small_candidate, inventory)
    small_candidate.items[3].participation = "archived"
    assert "t2" in " ".join(coverage_issues(small_candidate, inventory))


def test_registered_source_handles_resolve_only_reference_fields(sources):
    import json

    from services.roadmap.prompts import resolve_source_handles

    payload = {
        "sourceIds": ["source_1", "source_2", "invented"],
        "resources": [{"topicId": "source_1", "sourceId": "source_2"}],
        "items": [{"id": "source_1", "title": "source_2"}],
        "relations": [{"sourceId": "source_1", "targetId": "source_2", "kind": "prerequisite"}],
    }
    result = json.loads(resolve_source_handles(json.dumps(payload), sources))
    assert result["sourceIds"] == ["s1", "s2", "invented"]
    assert result["resources"] == [{"topicId": "source_1", "sourceId": "s2"}]
    assert result["items"] == payload["items"]
    assert result["relations"] == payload["relations"]


def test_outline_keeps_every_researched_concept_without_asking_model_to_rewrite_it(small_candidate):
    from schemas.roadmap_job import CoverageTopic
    from services.roadmap.coverage import inventory_candidate

    inventory = [
        CoverageTopic(
            id=f"t{i}",
            title=f"Technique {i}",
            area="Drawing" if i < 50 else "Review",
            source_ids=["s1"],
        )
        for i in range(100)
    ]
    candidate = inventory_candidate(
        "Complete drawing", "Practice drawing", inventory, [], [], small_candidate
    )
    assert {i.id for i in candidate.items if i.kind == "topic" and i.participation == "active"} == {
        t.id for t in inventory
    }
    assert len([i for i in candidate.items if i.kind == "phase"]) == 3  # Retain existing milestone.
    assert {r.target_id for r in candidate.relations if r.kind == "contains"} >= {
        t.id for t in inventory
    }


def test_outline_relationships_drop_unknown_duplicate_and_cyclic_edges():
    from schemas.curriculum import CurriculumRelationData
    from services.roadmap.coverage import sanitize_outline_relations

    relations = [
        CurriculumRelationData(source_id="a", target_id="b", kind="prerequisite"),
        CurriculumRelationData(source_id="b", target_id="a", kind="recommended_next"),
        CurriculumRelationData(source_id="b", target_id="b", kind="prerequisite"),
        CurriculumRelationData(source_id="a", target_id="missing", kind="prerequisite"),
        CurriculumRelationData(source_id="a", target_id="b", kind="prerequisite"),
    ]

    result = sanitize_outline_relations(relations, {"a", "b"})

    assert [(r.source_id, r.target_id, r.kind) for r in result] == [
        ("a", "b", "prerequisite")
    ]


def test_outline_rejects_order_that_reverses_required_prerequisites():
    from schemas.curriculum import CurriculumRelationData
    from services.roadmap.coverage import outline_issues

    relations = [
        CurriculumRelationData(source_id="a", target_id="b", kind="prerequisite"),
        CurriculumRelationData(source_id="b", target_id="a", kind="recommended_next"),
    ]
    assert "cycle" in " ".join(outline_issues(relations, {"a", "b"})).lower()
    assert not outline_issues(relations[:1], {"a", "b"})


def test_missing_prerequisite_feedback_identifies_exact_topics(small_candidate):
    from services.roadmap.coverage import select_core

    with pytest.raises(ValueError, match="t1.*t2"):
        select_core(small_candidate, ["t2"], "Outcome", [])


def test_inventory_rebuild_preserves_existing_choice_route_and_lessons(small_candidate):
    from schemas.curriculum import ChoiceData, CurriculumItemData, CurriculumRelationData
    from schemas.roadmap_job import CoverageTopic
    from services.roadmap.coverage import inventory_candidate, select_core

    original = small_candidate
    original.items.append(
        CurriculumItemData(id="choice", kind="choice", title="Choose a tool", order=1)
    )
    original.relations = [
        r for r in original.relations if not (r.kind == "contains" and r.target_id in {"t2", "t3"})
    ]
    original.relations += [
        CurriculumRelationData(source_id="phase", target_id="choice", kind="contains")
    ]
    original.relations += [
        CurriculumRelationData(source_id="choice", target_id=x, kind="contains")
        for x in ["t2", "t3"]
    ]
    original.choices = [
        ChoiceData(choice_id="choice", selected_id="t2", rationale="One tool is sufficient.")
    ]
    inventory = [
        CoverageTopic(id=i.id, title=i.title, area="Drawing", source_ids=["s1"])
        for i in original.items
        if i.kind == "topic"
    ]
    rebuilt = inventory_candidate(original.title, original.outcome, inventory, [], [], original)
    assert rebuilt.choices == original.choices
    assert {(r.source_id, r.target_id) for r in rebuilt.relations if r.kind == "contains"} >= {
        ("phase", "choice"),
        ("choice", "t2"),
        ("choice", "t3"),
    }
    assert (
        next(i for i in rebuilt.items if i.id == "t2").brief
        == next(i for i in original.items if i.id == "t2").brief
    )
    assert rebuilt.resources == original.resources
    with pytest.raises(ValueError, match="unselected"):
        select_core(rebuilt, ["t1", "t3"], "Outcome", [])


def test_tool_evidence_uses_same_registered_handles_as_stage_catalog(sources):
    import json

    from ai_core.base import ToolResult
    from services.roadmap.orchestrator import model_tool_content

    result = ToolResult(
        tool_call_id="call",
        name="search_web",
        content=json.dumps({"results": [{"title": "Reference", "provenance": {"sourceId": "s2"}}]}),
    )
    rendered = json.loads(model_tool_content(result, sources))
    assert rendered["results"][0]["provenance"]["sourceId"] == "source_2"
    assert json.loads(result.content)["results"][0]["provenance"]["sourceId"] == "s2"


def test_removed_selected_route_recommends_surviving_active_alternative(small_candidate):
    from schemas.curriculum import ChoiceData, CurriculumItemData, CurriculumRelationData
    from schemas.roadmap_job import CoverageTopic
    from services.roadmap.coverage import inventory_candidate

    original = small_candidate
    original.items.append(
        CurriculumItemData(id="choice", kind="choice", title="Choose one tool", order=1)
    )
    original.relations = [
        r for r in original.relations if not (r.kind == "contains" and r.target_id in {"t2", "t3"})
    ]
    original.relations += [
        CurriculumRelationData(source_id="phase", target_id="choice", kind="contains")
    ] + [
        CurriculumRelationData(source_id="choice", target_id=x, kind="contains")
        for x in ["t2", "t3"]
    ]
    original.choices = [
        ChoiceData(choice_id="choice", selected_id="t2", rationale="Recommended tool.")
    ]
    inventory = [
        CoverageTopic(id=i.id, title=i.title, area="Drawing", source_ids=["s1"])
        for i in original.items
        if i.id in {"t1", "t3"}
    ]
    result = inventory_candidate(original.title, original.outcome, inventory, [], [], original)
    assert result.choices[0].selected_id == "t3"
    assert "removed" in result.choices[0].rationale
    assert next(i for i in result.items if i.id == "t2").participation == "archived"


def test_checkpoint_accepts_active_recommendations_plus_archived_lesson_resources(small_candidate):
    from schemas.curriculum import CurriculumCandidate, CurriculumItemData, ResourceData

    candidate = small_candidate.model_copy(deep=True)
    candidate.items = [
        CurriculumItemData(
            id=f"t{i}",
            kind="topic",
            title=f"Topic {i}",
            order=i,
            participation="active" if i < 200 else "archived",
        )
        for i in range(201)
    ]
    candidate.resources = [
        ResourceData(
            topic_id=f"t{i}",
            source_id=f"s{j}",
            order=j,
            rationale="Relevant instructional reference for this lesson.",
        )
        for i in range(201)
        for j in range(3)
    ]
    restored = CurriculumCandidate.model_validate_json(candidate.model_dump_json())
    assert len(restored.resources) == 603
    assert len([i for i in restored.items if i.participation == "active"]) == 200


def test_topic_handles_resolve_identity_fields_without_rewriting_text(sources):
    import json

    from schemas.roadmap_job import CoverageTopic
    from services.roadmap.prompts import resolve_source_handles

    inventory = [
        CoverageTopic(id="canonical_topic", title="A concept", area="Area", source_ids=["s1"])
    ]
    payload = {
        "topics": [{"id": "topic_1", "brief": "topic_1"}],
        "coreTopicIds": ["topic_1"],
        "resources": [{"topicId": "topic_1", "sourceId": "source_2"}],
        "relations": [{"sourceId": "topic_1", "targetId": "topic_1", "kind": "recommended_next"}],
        "identityContinuity": {"topic_1": "Same learning concept remains."},
    }
    result = json.loads(resolve_source_handles(json.dumps(payload), sources, inventory))
    assert result["topics"][0] == {"id": "canonical_topic", "brief": "topic_1"}
    assert result["coreTopicIds"] == ["canonical_topic"]
    assert result["resources"] == [{"topicId": "canonical_topic", "sourceId": "s2"}]
    assert result["relations"][0]["sourceId"] == "canonical_topic"
    assert "canonical_topic" in result["identityContinuity"]


def test_reference_dispositions_cannot_hide_omitted_or_merged_concepts(sources):
    from schemas.roadmap_job import CoverageTopic
    from services.roadmap.coverage import reference_coverage_issues
    from services.roadmap.prompts import ResearchReview

    sources[0].provenance["diagramLabels"] = ["Chunking", "Retrieval", "ToolBrand"]
    topics = [CoverageTopic(id="t1", title="RAG", area="RAG", source_ids=["s1"])]
    review = ResearchReview(
        source_ids=["s1", "s2"],
        coverage_notes=["Coverage reviewed"],
        coverage_topics=topics,
        reference_dispositions=[
            {
                "sourceId": "s1",
                "labelIndex": 0,
                "kind": "concept",
                "topicIds": ["t1"],
                "reason": "Required skill",
            }
        ],
    )
    assert "missing" in " ".join(reference_coverage_issues(review, sources)).lower()
    review.reference_dispositions += [
        type(review.reference_dispositions[0])(
            source_id="s1", label_index=1, kind="concept", topic_ids=["t1"], reason="Required skill"
        ),
        type(review.reference_dispositions[0])(
            source_id="s1",
            label_index=2,
            kind="example",
            topic_ids=["t1"],
            reason="A tooling example",
        ),
    ]
    assert "separate" in " ".join(reference_coverage_issues(review, sources)).lower()
    review.reference_dispositions[1].kind = "synonym"
    assert not reference_coverage_issues(review, sources)


def test_learning_resources_require_recorded_instruction_not_diagram_labels(
    small_candidate, sources
):
    from services.roadmap.coverage import resource_grounding_issues

    sources[
        0
    ].evidence = (
        "Chunking\nEmbedding\nVector Database\nRetrieval Process\nGeneration\nContext Window"
    )
    sources[0].provenance["diagramLabels"] = ["Chunking", "Embedding", "Vector Database"]
    resource = small_candidate.resources[0]
    resource.evidence_excerpt = sources[0].evidence
    resource.objective_index = 0
    assert resource_grounding_issues(small_candidate, sources)
    for resource in small_candidate.resources:
        source = next(s for s in sources if s.id == resource.source_id)
        source.provenance.pop("diagramLabels", None)
        source.evidence = "Practise contour lines by observing the boundary of an object, then compare proportions and draw simple forms from direct observation."
        resource.evidence_excerpt = source.evidence
        resource.objective_index = 0
    assert not resource_grounding_issues(small_candidate, sources)
    small_candidate.resources[
        0
    ].evidence_excerpt = "Invented instruction absent from all recorded evidence. Practise contour lines on a new sheet of paper."
    assert resource_grounding_issues(small_candidate, sources)


def test_topic_slug_cannot_rename_schema_fields():
    from services.roadmap.prompts import map_topic_identifiers

    payload = {
        "id": "format",
        "format": "practice",
        "title": "Formatting",
        "studyProgress": {"format": {"status": "completed"}},
    }
    mapped = map_topic_identifiers(payload, {"format": "topic_1", "title": "topic_2"})
    assert mapped == {
        "id": "topic_1",
        "format": "practice",
        "title": "Formatting",
        "studyProgress": {"topic_1": {"status": "completed"}},
    }


def test_diagram_career_faq_remains_coverage_only(small_candidate, sources):
    from services.roadmap.coverage import resource_grounding_issues

    for source in sources:
        source.provenance["diagramLabels"] = ["Chunking", "Embedding"]
        source.evidence = "Yes, becoming an AI engineer is a great career choice. AI is transforming nearly every industry, from healthcare and finance to transportation and entertainment."
    for resource in small_candidate.resources:
        resource.evidence_excerpt = sources[0].evidence
        resource.objective_index = 0
    assert resource_grounding_issues(small_candidate, sources)


def test_evidence_review_requires_every_check_and_rejects_irrelevant_passages():
    from services.roadmap.coverage import evidence_review_issues
    from services.roadmap.prompts import EvidenceReview

    checks = [{"checkId": "lesson_0", "topicId": "t1"}, {"checkId": "label_0", "topicId": "t2"}]
    missing = EvidenceReview(
        verdicts=[
            {
                "checkId": "lesson_0",
                "approved": True,
                "reason": "The passage teaches the requested skill.",
            }
        ]
    )
    assert evidence_review_issues(missing, checks)
    rejected = EvidenceReview(
        verdicts=[
            {
                "checkId": "lesson_0",
                "approved": False,
                "reason": "Career advice does not teach vector indexing.",
            },
            {
                "checkId": "label_0",
                "approved": True,
                "reason": "The label identifies a genuine vendor example.",
            },
        ]
    )
    assert "vector indexing" in " ".join(evidence_review_issues(rejected, checks))
    rejected.verdicts[0].approved = True
    assert not evidence_review_issues(rejected, checks)
    rejected.verdicts.append(rejected.verdicts[0])
    assert evidence_review_issues(rejected, checks)
