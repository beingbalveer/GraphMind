"""Deterministic repair pass for compose topic-batch grounding.

The topic-details stage asks the model to return exactly a requested set of topic
ids with 1-3 recorded instructional resources per topic, where every resource must
credit a source that is actually recorded as ``grounded``/``inspected``. Occasionally
the model invents an extra topic id, attaches a resource to a topic outside the
requested batch, credits a resource to a source id that was never recorded, or
return more than three resources for one topic. Rather than spending a full LLM
regeneration on those mechanical violations, this module deterministically drops
the ungrounded entries in place and re-checks. It never invents or fabricates:
it only ever removes resources/topics that fail grounding.

Mirrors ``grounding_repair``'s deterministic contract. If, after dropping, every
requested topic still has at least one grounded resource chairman 1-3, the repaired
batch is accepted.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from services.roadmap.prompts import TopicBatch

_MIN_RESOURCES = 1
_MAX_RESOURCES = 3


def repair_topic_batch_grounding(
    batch: "TopicBatch",
    requested_ids: list[str],
    actual_sources: set[str],
    *,
    max_resources: int = _MAX_RESOURCES,
) -> tuple[int, bool]:
    """Drop ungrounded topics/resources from ``batch`` in place.

    Removes topic details whose id is not in ``requested_ids`` (or is duplicated),
    removes resources whose ``topic_id`` is not in the requested set, removes
    resources whose ``source_id`` is not in ``actual_sources``, and clamps each
    topic to at most ``max_resources`` resources (dropping surplus, keeping the
    first ones). Returns ``(dropped, accepted)`` where ``dropped`` counts entries
    removed and ``accepted`` is True only when every requested topic still has at
    least one grounded resource after repair. Never invents anything.
    """
    dropped = 0
    wanted = set(requested_ids)
    seen: set[str] = set()
    kept_topics = []
    for detail in batch.topics:
        if detail.id in wanted and detail.id not in seen:
            seen.add(detail.id)
            kept_topics.append(detail)
        else:
            dropped += 1
    batch.topics = kept_topics

    per_topic: dict[str, int] = {}
    kept_resources = []
    for resource in batch.resources:
        if resource.topic_id not in wanted or resource.source_id not in actual_sources:
            dropped += 1
            continue
        count = per_topic.get(resource.topic_id, 0)
        if count >= max_resources:
            dropped += 1
            continue
        per_topic[resource.topic_id] = count + 1
        kept_resources.append(resource)
    batch.resources = kept_resources

    accepted = is_batch_grounded(batch, requested_ids)
    return dropped, accepted


def is_batch_grounded(batch: "TopicBatch", requested_ids: list[str]) -> bool:
    """True when every requested id appears exactly once, each with 1-3 resources.

    Whether each resource credits an actual recorded source is the caller's job
    (needs the checkpoint spotlight); this decides only id set + per-topic count.
    """
    returned = [detail.id for detail in batch.topics]
    resource_ids = {r.topic_id for r in batch.resources}
    return (
        len(returned) == len(requested_ids)
        and set(returned) == set(requested_ids)
        and resource_ids == set(requested_ids)
        and all(
            1 <= sum(r.topic_id == key for r in batch.resources) <= _MAX_RESOURCES
            for key in requested_ids
        )
    )
