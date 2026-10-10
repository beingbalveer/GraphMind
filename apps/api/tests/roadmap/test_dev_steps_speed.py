"""Dev-mode 'step' events and research/evidence parallel speedups.

Covers:
- ROADMAP_DEV_STEPS=true appends a 'step' event before each research/compose
  model call (visible while the agent runs).
- ROADMAP_DEV_STEPS=false keeps the production feed coarse: no 'step' events.
- ROADMAP_AREA_CONCURRENCY>1 runs research area model calls concurrently
  (overlapping provider.generate calls); concurrency=1 stays sequential.
"""

import asyncio
import json

import pytest


def answer(value: dict) -> object:
    from ai_core.base import GenerationResult

    return GenerationResult(model_name="test", content=json.dumps(value))


async def move_to_stage(setup, target, clock, profile, sources):
    from schemas.roadmap_job import StageResult

    executor, provider, claim, job, repos = setup
    while claim.stage != target:
        job.checkpoint.profile = profile
        job.checkpoint.sources = sources or []
        async with repos() as repo:
            await repo.checkpoint(
                claim, claim.stage, StageResult(checkpoint=job.checkpoint, summary="Prepared")
            )
        async with repos() as repo:
            claim = await repo.claim("stage-test", clock.now())
            job = await repo.read(job.id, job.owner_id)
    return claim, job


async def _seed_search_receipt(job, repos) -> None:
    from models.roadmap_job import RoadmapToolReceipt

    async with repos() as repo:
        repo.session.add(
            RoadmapToolReceipt(
                job_id=job.id,
                stage="research",
                operation_key="tool:search_web:successful",
                result={"data": {}},
                reservations={},
            )
        )


def _plan(areas: list[dict[str, str]]) -> dict:
    return {
        "sourceIds": ["s1", "s2"],
        "coverageNotes": ["Compared actual instructional sources"],
        "areas": areas,
    }


def _area_topics(data: dict) -> dict:
    index = data["task"]["areaIndex"]
    return {
        "coverageTopics": [
            {
                "id": f"topic_{index}_0",
                "title": f"Area {index} concept",
                "area": data["task"]["area"],
                "sourceIds": ["s1"],
            }
        ]
    }


async def test_dev_steps_append_step_before_research_area_model_call(
    executor_setup, clock, small_profile, sources
):
    from config import Settings

    executor, provider, _, _, repos = executor_setup
    executor.settings = Settings(_env_file=None, ROADMAP_DEV_STEPS=True)
    claim, job = await move_to_stage(
        executor_setup, "research", clock, small_profile, sources
    )
    await _seed_search_receipt(job, repos)

    area_observed = {"step_before_call": False}

    async def respond(messages, *args, **kwargs):
        data = json.loads(messages[-1].content.split("\n", 1)[1])
        mode = (data.get("task") or {}).get("mode")
        if mode == "inventory_plan":
            return answer(_plan([{"title": "Drawing", "scope": "Line control"}]))
        if mode == "inventory_area":
            # A 'step' event must already have been appended before this
            # model call starts so the user sees the next action while it runs.
            async with repos() as repo:
                events = await repo.events(job.id, job.owner_id, 0)
            steps = [event for event in events if event.type == "step"]
            assert any("Researching area 1 of 1" in event.summary for event in steps)
            area_observed["step_before_call"] = True
            return answer(_area_topics(data))
        return answer({"coverageTopics": []})

    provider.generate.side_effect = respond
    await executor.run("research", job, claim)
    assert area_observed["step_before_call"]
    async with repos() as repo:
        events = await repo.events(job.id, job.owner_id, 0)
    steps = [event for event in events if event.type == "step"]
    assert any("Planning the research areas" in event.summary for event in steps)
    assert any("Researching area 1 of 1" in event.summary for event in steps)
    assert all(event.stage == "research" for event in steps)


async def test_dev_prod_no_step_events_without_flag(executor_setup, clock, small_profile, sources):
    from config import Settings

    executor, provider, _, _, repos = executor_setup
    executor.settings = Settings(_env_file=None, ROADMAP_DEV_STEPS=False)
    claim, job = await move_to_stage(
        executor_setup, "research", clock, small_profile, sources
    )
    await _seed_search_receipt(job, repos)

    async def respond(messages, *args, **kwargs):
        data = json.loads(messages[-1].content.split("\n", 1)[1])
        mode = (data.get("task") or {}).get("mode")
        if mode == "inventory_plan":
            return answer(_plan([{"title": "Drawing", "scope": "Line control"}]))
        return answer(_area_topics(data))

    provider.generate.side_effect = respond
    await executor.run("research", job, claim)
    async with repos() as repo:
        events = await repo.events(job.id, job.owner_id, 0)
    assert not any(event.type == "step" for event in events)
    # The coarse phase/composition_progress feed is still produced.
    assert any(event.type == "phase" or event.type == "composition_progress" for event in events)


@pytest.mark.parametrize(("concurrency", "expect_overlap"), [(2, True), (1, False)])
async def test_research_areas_run_concurrently_when_configured(
    executor_setup, clock, small_profile, sources, concurrency, expect_overlap
):
    from config import Settings

    executor, provider, _, _, repos = executor_setup
    executor.settings = Settings(_env_file=None, ROADMAP_AREA_CONCURRENCY=concurrency)
    claim, job = await move_to_stage(
        executor_setup, "research", clock, small_profile, sources
    )
    await _seed_search_receipt(job, repos)

    tracked = {"active": 0, "peak": 0}

    async def respond(messages, *args, **kwargs):
        data = json.loads(messages[-1].content.split("\n", 1)[1])
        mode = (data.get("task") or {}).get("mode")
        if mode == "inventory_plan":
            return answer(
                _plan(
                    [
                        {"title": "Foundations", "scope": "Basics"},
                        {"title": "Observation", "scope": "Forms"},
                        {"title": "Creativity", "scope": "Composition"},
                    ]
                )
            )
        tracked["active"] += 1
        tracked["peak"] = max(tracked["peak"], tracked["active"])
        await asyncio.sleep(0.05)
        tracked["active"] -= 1
        return answer(_area_topics(data))

    provider.generate.side_effect = respond
    result = await executor.run("research", job, claim)
    assert len(result.checkpoint.coverage_topics) == 3
    if expect_overlap:
        assert tracked["peak"] >= 2
    else:
        assert tracked["peak"] == 1
