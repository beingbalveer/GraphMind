async def test_reconnect_replays_only_missing_committed_events(
    auth_client, worker_job, job_repo, curriculum_session
):
    await job_repo.append_event(
        worker_job.id, "tool_completed", "Inspected source", {"tool": "fetch_source"}
    )
    await job_repo.append_event(worker_job.id, "tool_completed", "Compared sources", {"count": 2})
    await job_repo.cancel(worker_job.id, worker_job.owner_id)
    await curriculum_session.commit()
    response = await auth_client.get(
        f"/api/v1/roadmap/jobs/{worker_job.id}/events?after=1", headers={"Last-Event-ID": "2"}
    )
    assert response.status_code == 200
    assert "id: 1\n" not in response.text and "id: 2\n" not in response.text
    assert "id: 3\n" in response.text and "id: 4\n" in response.text
    assert "checkpoint" not in response.text and "ownerId" not in response.text
    assert response.headers["content-type"].startswith("text/event-stream")


async def test_disconnect_does_not_cancel_saved_job(worker_job):
    from routers.roadmap_jobs import job_events

    stream = job_events(worker_job.id, worker_job.owner_id, 0)
    first = await anext(stream)
    assert "id: 1" in first
    await stream.aclose()
    from database import get_session_factory
    from services.roadmap.job_repository import JobRepository

    async with get_session_factory()() as session:
        job = await JobRepository(session).read(worker_job.id, worker_job.owner_id)
    assert job.status == "queued"


async def test_oversized_header_cursor_is_not_a_valid_database_sequence(
    auth_client, worker_job, job_repo, curriculum_session
):
    await job_repo.cancel(worker_job.id, worker_job.owner_id)
    await curriculum_session.commit()
    response = await auth_client.get(
        f"/api/v1/roadmap/jobs/{worker_job.id}/events", headers={"Last-Event-ID": "9" * 100}
    )
    assert response.status_code == 200 and "id: 1\n" in response.text


async def test_concurrent_inserts_have_unique_monotonic_replay(worker_job):
    import asyncio

    from database import get_session_factory
    from services.roadmap.job_repository import JobRepository

    async def append(index):
        async with get_session_factory()() as session:
            event = await JobRepository(session).append_event(
                worker_job.id, "tool_completed", "Inspected source", {"count": index}
            )
            await session.commit()
            return event.sequence

    ids = await asyncio.gather(*(append(index) for index in range(5)))
    assert sorted(ids) == list(range(2, 7))


async def test_terminal_stream_drains_more_than_one_replay_batch(
    auth_client, worker_job, job_repo, curriculum_session
):
    for index in range(205):
        await job_repo.append_event(
            worker_job.id, "tool_completed", "Inspected source", {"count": index}
        )
    final = await job_repo.cancel(worker_job.id, worker_job.owner_id)
    await curriculum_session.commit()
    response = await auth_client.get(f"/api/v1/roadmap/jobs/{worker_job.id}/events")
    assert f"id: {final.last_sequence}\n" in response.text
