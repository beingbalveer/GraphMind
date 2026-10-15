"""LSI-036: direct topic edits, revision history, and stale-edit recovery.

These tests exercise the existing revision/edit/restore HTTP contracts at the
API boundary and confirm that:
  * a saved edit advances the current revision,
  * a stale base conflicts instead of silently overwriting the newer revision,
  * history is preserved across edits and restores,
  * topic progress mapping is retained across an edit and a restore.
"""


async def _authorized_client(owner_id, session):
    from httpx import ASGITransport, AsyncClient
    from main import app
    from services.auth_service import create_access_token

    # Commit fixture rows so the request-scoped session can read them.
    await session.commit()
    client = AsyncClient(transport=ASGITransport(app=app), base_url="http://test")
    client.cookies.set("access_token", create_access_token(owner_id))
    return client


async def test_stale_edit_conflicts_and_history_is_preserved(
    curriculum_workspace, curriculum_session
):
    v = curriculum_workspace.view
    owner = curriculum_workspace.owner_id
    path = f"/api/v1/workspaces/{v.workspace_id}/roadmap"
    body = {
        "baseRevisionId": v.revision_id,
        "patches": [{"op": "update_item", "itemId": "t1", "title": "First change"}],
    }
    client = await _authorized_client(owner, curriculum_session)
    async with client:
        first = await client.patch(path, json=body)
        assert first.status_code == 200
        won_revision = first.json()["revisionId"]
        assert won_revision != v.revision_id

        # Replaying the stale base must not overwrite the winning revision.
        conflict = await client.patch(path, json=body)
        assert conflict.status_code == 409
        assert conflict.json()["error"]["code"] == "REVISION_CONFLICT"

        # The authoritative current revision is still the winner.
        current = await client.get(path)
        assert current.status_code == 200
        assert current.json()["revisionId"] == won_revision

        # Both revisions remain in history; nothing was silently discarded.
        history = await client.get(path + "/revisions")
        assert history.status_code == 200
        ids = {row["id"] for row in history.json()}
        assert {v.revision_id, won_revision} <= ids


async def test_edit_and_restore_keep_progress_mapping(
    curriculum_workspace, curriculum_session
):
    v = curriculum_workspace.view
    owner = curriculum_workspace.owner_id
    path = f"/api/v1/workspaces/{v.workspace_id}/roadmap"
    client = await _authorized_client(owner, curriculum_session)
    async with client:
        completed = await client.patch(
            path + "/topics/t1/progress", json={"status": "completed"}
        )
        assert completed.status_code == 200
        assert completed.json()["status"] == "completed"

        edited = await client.patch(
            path,
            json={
                "baseRevisionId": v.revision_id,
                "patches": [
                    {"op": "update_item", "itemId": "t1", "title": "Confident lines"}
                ],
            },
        )
        assert edited.status_code == 200
        edited_view = edited.json()
        # Progress remains mapped to the same stable topic id across the revision.
        assert edited_view["progress"]["t1"]["status"] == "completed"

        restored = await client.post(
            path + f"/revisions/{v.revision_id}/restore",
            json={"baseRevisionId": edited_view["revisionId"]},
        )
        assert restored.status_code == 200
        restored_view = restored.json()
        assert restored_view["revisionId"] not in {
            v.revision_id,
            edited_view["revisionId"],
        }
        # The completed topic identity still exists and keeps its progress.
        assert "t1" in {item["id"] for item in restored_view["candidate"]["items"]}
        assert restored_view["progress"]["t1"]["status"] == "completed"

        # A stale restore is rejected rather than overwriting the current revision.
        stale = await client.post(
            path + f"/revisions/{v.revision_id}/restore",
            json={"baseRevisionId": v.revision_id},
        )
        assert stale.status_code == 409
        assert stale.json()["error"]["code"] == "REVISION_CONFLICT"


async def test_restore_conflict_does_not_create_a_revision(
    curriculum_workspace, curriculum_session
):
    v = curriculum_workspace.view
    owner = curriculum_workspace.owner_id
    path = f"/api/v1/workspaces/{v.workspace_id}/roadmap"
    client = await _authorized_client(owner, curriculum_session)
    async with client:
        edited = await client.patch(
            path,
            json={
                "baseRevisionId": v.revision_id,
                "patches": [
                    {"op": "update_item", "itemId": "t1", "title": "Moved on"}
                ],
            },
        )
        assert edited.status_code == 200
        # Rejecting a restore against a stale base must not create a revision.
        revision_count = len((await client.get(path + "/revisions")).json())

        rejected = await client.post(
            path + f"/revisions/{v.revision_id}/restore",
            json={"baseRevisionId": v.revision_id},
        )
        assert rejected.status_code == 409
        assert rejected.json()["error"]["code"] == "REVISION_CONFLICT"

        after = await client.get(path + "/revisions")
        assert len(after.json()) == revision_count
