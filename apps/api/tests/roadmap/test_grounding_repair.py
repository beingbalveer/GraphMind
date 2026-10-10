"""Unit tests for the deterministic compose topic-batch grounding repair pass.

The topic-details stage must return exactly the requested topic ids with 1-3
grounded resources per topic. When the model invents an extra topic, attaches a
resource to an off-batch topic, credits an unrecorded source id, or returns more
than three resources for a topic, this deterministically drops the mechanical
violations in place instead of spending another full LLM regeneration.
"""

from __future__ import annotations

from services.roadmap.grounding_repair import (
    is_batch_grounded,
    repair_topic_batch_grounding,
)
from services.roadmap.prompts import TeachingResourceData, TopicBatch, TopicDetail


def _detail(topic_id: str) -> TopicDetail:
    return TopicDetail(
        id=topic_id,
        brief="Purpose of the topic in one clear paragraph.",
        objectives=["Recognize the core idea.", "Apply it to a worked example."],
        exercise="Practice building a small example end to end.",
        format="concepts",
        estimate_minutes=30,
    )


def _resource(topic_id: str, source_id: str, order: int = 0) -> TeachingResourceData:
    return TeachingResourceData(
        topic_id=topic_id,
        source_id=source_id,
        order=order,
        rationale="This source teaches the objective in recorded evidence.",
        evidence_excerpt="e" * 120,
        objective_index=0,
    )


class TestIsBatchGrounded:
    def test_exact_requested_set_with_grounded_resources(self) -> None:
        wanted = ["t1", "t2"]
        batch = TopicBatch(
            topics=[_detail("t1"), _detail("t2")],
            resources=[_resource("t1", "s1"), _resource("t2", "s2")],
        )
        assert is_batch_grounded(batch, wanted)

    def test_extra_invented_topic_is_not_grounded(self) -> None:
        batch = TopicBatch(
            topics=[_detail("t1"), _detail("t2"), _detail("t3")],
            resources=[_resource("t1", "s1"), _resource("t2", "s2")],
        )
        assert not is_batch_grounded(batch, ["t1", "t2"])

    def test_resource_on_off_batch_topic_is_not_grounded(self) -> None:
        batch = TopicBatch(
            topics=[_detail("t1"), _detail("t2")],
            resources=[_resource("t1", "s1"), _resource("t9", "s9")],
        )
        assert not is_batch_grounded(batch, ["t1", "t2"])

    def test_missing_resource_for_topic_is_not_grounded(self) -> None:
        batch = TopicBatch(
            topics=[_detail("t1"), _detail("t2")],
            resources=[_resource("t1", "s1")],
        )
        assert not is_batch_grounded(batch, ["t1", "t2"])

    def test_more_than_three_resources_is_not_grounded(self) -> None:
        batch = TopicBatch(
            topics=[_detail("t1")],
            resources=[
                _resource("t1", "s1", 0),
                _resource("t1", "s2", 1),
                _resource("t1", "s3", 2),
                _resource("t1", "s4", 3),
            ],
        )
        assert not is_batch_grounded(batch, ["t1"])


class TestRepairTopicBatchGrounding:
    def test_drops_invented_topic_and_off_batch_resource(self) -> None:
        batch = TopicBatch(
            topics=[_detail("t1"), _detail("t2"), _detail("invented")],
            resources=[_resource("t1", "s1"), _resource("t2", "s2"), _resource("ghost", "s9")],
        )
        dropped, accepted = repair_topic_batch_grounding(batch, ["t1", "t2"], {"s1", "s2"})
        assert dropped == 2
        assert accepted is True
        assert is_batch_grounded(batch, ["t1", "t2"])

    def test_drops_unrecorded_source_id(self) -> None:
        batch = TopicBatch(
            topics=[_detail("t1")],
            resources=[_resource("t1", "s1"), _resource("t1", "not_recorded")],
        )
        dropped, accepted = repair_topic_batch_grounding(batch, ["t1"], {"s1"})
        assert dropped == 1
        assert accepted is True
        assert is_batch_grounded(batch, ["t1"])

    def test_clamps_over_limit_resources_to_three(self) -> None:
        batch = TopicBatch(
            topics=[_detail("t1")],
            resources=[
                _resource("t1", "s1", 0),
                _resource("t1", "s2", 1),
                _resource("t1", "s3", 2),
                _resource("t1", "s4", 3),
            ],
        )
        dropped, accepted = repair_topic_batch_grounding(batch, ["t1"], {"s1", "s2", "s3", "s4"})
        assert dropped == 1
        assert accepted is True
        assert is_batch_grounded(batch, ["t1"])

    def test_topic_left_with_zero_grounded_resources_is_not_accepted(self) -> None:
        # All recorded evidence for t2 was dropped (unrecorded sources), so the
        # batch cannot be repaired and must fall through to regeneration.
        batch = TopicBatch(
            topics=[_detail("t1"), _detail("t2")],
            resources=[_resource("t1", "s1"), _resource("t2", "not_recorded")],
        )
        dropped, accepted = repair_topic_batch_grounding(batch, ["t1", "t2"], {"s1"})
        assert dropped == 1
        assert accepted is False

    def test_duplicate_topic_detail_deduplicates(self) -> None:
        batch = TopicBatch(
            topics=[_detail("t1"), _detail("t1")],
            resources=[_resource("t1", "s1")],
        )
        dropped, accepted = repair_topic_batch_grounding(batch, ["t1"], {"s1"})
        assert accepted is True
        assert is_batch_grounded(batch, ["t1"])
        assert len(batch.topics) == 1
