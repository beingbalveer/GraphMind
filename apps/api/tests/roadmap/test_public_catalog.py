"""Focused HTTP tests for the anonymous public catalog API (LSI-026).

Covers the approved guest catalog contract (LSI-002 §3.1) over the immutable
public snapshots published in LSI-025:

* anonymous access (no auth token, no workspace header),
* only ``status = 'published'`` templates appear,
* search / category / level filters,
* bounded and deterministic pagination,
* no private metadata in any payload,
* deterministic empty results.

All backend tests run against the isolated ``_test`` database configured by the
repository's test guard; no live or user data is touched.
"""

import uuid

import pytest
from httpx import ASGITransport, AsyncClient
from main import app
from models.public_snapshot import PublicSnapshot
from schemas.public import PublicSnapshotPublication
from services.roadmap.public_snapshots import PublicSnapshotService
from sqlalchemy import delete

TEST_PREFIX = "catalog-test-"
CATALOG_PATH = "/api/v1/public/roadmaps"

FORBIDDEN_TOKENS = (
    "workspaceId",
    "roadmapId",
    "revisionId",
    "ownerId",
    "chatId",
    "sessionId",
    "canvasAnchorChatId",
    "provenance",
    "storagePath",
    "uploadPath",
)


def _unique(prefix: str = "cat") -> str:
    """A collision-free, pattern-valid identifier segment (``^[a-z0-9][a-z0-9-]*``)."""
    return f"{TEST_PREFIX}{prefix}-{uuid.uuid4().hex[:8]}"


@pytest.fixture(autouse=True)
async def cleanup_catalog_snapshots(curriculum_session):
    yield
    await curriculum_session.rollback()
    await curriculum_session.execute(
        delete(PublicSnapshot).where(PublicSnapshot.template_id.like(f"{TEST_PREFIX}%"))
    )
    await curriculum_session.commit()


@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as http:
        yield http


async def _publish(
    session,
    workspace,
    clock,
    template_id: str,
    category: str,
    *,
    version: str = "2026-10-15.1",
    level: str | None = None,
):
    service = PublicSnapshotService(session, clock=clock.now)
    return await service.publish_revision(
        workspace.owner_id,
        publication=PublicSnapshotPublication(
            template_id=template_id,
            snapshot_version=version,
            category=category,
            level=level,
        ),
        workspace_id=workspace.view.workspace_id,
        revision_id=workspace.view.revision_id,
    )


async def test_catalog_is_anonymous_and_lists_only_published(
    client, curriculum_session, curriculum_workspace, clock
):
    category = _unique("list")
    alpha = await _publish(
        curriculum_session, curriculum_workspace, clock, _unique("alpha"), category
    )
    await curriculum_session.commit()
    clock.advance(seconds=1)
    beta = await _publish(
        curriculum_session, curriculum_workspace, clock, _unique("beta"), category
    )
    service = PublicSnapshotService(curriculum_session, clock=clock.now)
    await service.unpublish(
        curriculum_workspace.owner_id,
        template_id=beta.template_id,
        snapshot_version=beta.snapshot_version,
    )
    await curriculum_session.commit()

    # No auth token and no workspace header: the request is genuinely anonymous.
    resp = await client.get(CATALOG_PATH, params={"category": category})
    assert resp.status_code == 200
    body = resp.json()
    assert [item["id"] for item in body["items"]] == [alpha.template_id]
    assert beta.template_id not in {item["id"] for item in body["items"]}
    assert body["total"] == 1

    # The frozen public DTO is serialized with camelCase aliases and only vetted fields.
    card = body["items"][0]
    assert {
        "id",
        "slug",
        "title",
        "summary",
        "category",
        "level",
        "estimatedWeeks",
        "hoursPerWeek",
        "topicCount",
        "snapshotVersion",
        "tags",
        "updatedAt",
    } <= set(card)


async def test_catalog_searches_title_and_summary_literally(
    client, curriculum_session, curriculum_workspace, clock
):
    category = _unique("search")
    record = await _publish(
        curriculum_session, curriculum_workspace, clock, _unique("search"), category
    )
    await curriculum_session.commit()

    by_title = await client.get(CATALOG_PATH, params={"category": category, "query": "drawing"})
    assert [item["id"] for item in by_title.json()["items"]] == [record.template_id]

    by_summary = await client.get(
        CATALOG_PATH, params={"category": category, "query": "confident lines"}
    )
    assert [item["id"] for item in by_summary.json()["items"]] == [record.template_id]

    missing = await client.get(CATALOG_PATH, params={"category": category, "query": "kubernetes"})
    assert missing.json()["items"] == []
    assert missing.json()["total"] == 0

    # A LIKE wildcard must be matched literally, not expanded into "match everything".
    wildcard = await client.get(CATALOG_PATH, params={"category": category, "query": "%"})
    assert wildcard.json()["items"] == []


async def test_catalog_filters_by_category_and_level(
    client, curriculum_session, curriculum_workspace, clock
):
    category = _unique("filter")
    beginner = await _publish(
        curriculum_session,
        curriculum_workspace,
        clock,
        _unique("beginner"),
        category,
        level="beginner",
    )
    clock.advance(seconds=1)
    advanced = await _publish(
        curriculum_session,
        curriculum_workspace,
        clock,
        _unique("advanced"),
        category,
        level="advanced",
    )
    await curriculum_session.commit()

    only_advanced = await client.get(
        CATALOG_PATH, params={"category": category, "level": "advanced"}
    )
    assert [item["id"] for item in only_advanced.json()["items"]] == [advanced.template_id]
    assert only_advanced.json()["total"] == 1

    both = await client.get(CATALOG_PATH, params={"category": category})
    assert both.json()["total"] == 2
    assert {item["level"] for item in both.json()["items"]} == {"beginner", "advanced"}
    assert {item["id"] for item in both.json()["items"]} == {
        beginner.template_id,
        advanced.template_id,
    }

    other_category = await client.get(CATALOG_PATH, params={"category": _unique("none")})
    assert other_category.json()["total"] == 0


async def test_catalog_pagination_is_bounded_and_deterministic(
    client, curriculum_session, curriculum_workspace, clock
):
    category = _unique("page")
    records = []
    for index in range(3):
        records.append(
            await _publish(
                curriculum_session, curriculum_workspace, clock, f"{category}-{index}", category
            )
        )
        clock.advance(seconds=1)
    await curriculum_session.commit()

    first = await client.get(CATALOG_PATH, params={"category": category, "limit": 2, "offset": 0})
    second = await client.get(CATALOG_PATH, params={"category": category, "limit": 2, "offset": 2})
    assert first.json()["total"] == 3
    assert second.json()["total"] == 3
    page_one = [item["id"] for item in first.json()["items"]]
    page_two = [item["id"] for item in second.json()["items"]]
    assert len(page_one) == 2
    assert len(page_two) == 1
    assert set(page_one).isdisjoint(page_two)
    assert set(page_one) | set(page_two) == {record.template_id for record in records}

    # Deterministic: identical repeated requests, identical pages.
    again = await client.get(CATALOG_PATH, params={"category": category, "limit": 2, "offset": 0})
    assert again.json() == first.json()

    for bad in ({"limit": 0}, {"limit": 101}, {"offset": -1}):
        rejected = await client.get(CATALOG_PATH, params={"category": category, **bad})
        assert rejected.status_code == 422
        assert rejected.json()["error"]["code"] == "VALIDATION_ERROR"


async def test_catalog_lists_only_the_newest_published_version(
    client, curriculum_session, curriculum_workspace, clock
):
    category = _unique("version")
    template = _unique("versioned")
    await _publish(
        curriculum_session, curriculum_workspace, clock, template, category, version="2026-10-15.1"
    )
    clock.advance(seconds=1)
    await _publish(
        curriculum_session, curriculum_workspace, clock, template, category, version="2026-10-15.2"
    )
    await curriculum_session.commit()

    listed = await client.get(CATALOG_PATH, params={"category": category})
    assert listed.json()["total"] == 1
    assert listed.json()["items"][0]["id"] == template
    assert listed.json()["items"][0]["snapshotVersion"] == "2026-10-15.2"

    service = PublicSnapshotService(curriculum_session, clock=clock.now)
    await service.unpublish(
        curriculum_workspace.owner_id, template_id=template, snapshot_version="2026-10-15.2"
    )
    await curriculum_session.commit()

    # Once the newest version is unpublished, the catalog falls back to the last published one.
    after = await client.get(CATALOG_PATH, params={"category": category})
    assert after.json()["total"] == 1
    assert after.json()["items"][0]["snapshotVersion"] == "2026-10-15.1"


async def test_catalog_empty_results_are_deterministic(client):
    params = {"category": _unique("empty")}
    first = await client.get(CATALOG_PATH, params=params)
    second = await client.get(CATALOG_PATH, params=params)

    assert first.status_code == 200
    assert first.json() == {"items": [], "total": 0, "limit": 20, "offset": 0}
    assert second.json() == first.json()


async def test_catalog_rejects_invalid_filters(client):
    bad_level = await client.get(CATALOG_PATH, params={"level": "expert"})
    assert bad_level.status_code == 422
    assert bad_level.json()["error"]["code"] == "VALIDATION_ERROR"

    too_long_query = await client.get(CATALOG_PATH, params={"query": "x" * 201})
    assert too_long_query.status_code == 422
    assert too_long_query.json()["error"]["code"] == "VALIDATION_ERROR"

    empty_category = await client.get(CATALOG_PATH, params={"category": ""})
    assert empty_category.status_code == 422


async def test_catalog_never_leaks_private_metadata(
    client, curriculum_session, curriculum_workspace, clock
):
    category = _unique("privacy")
    await _publish(curriculum_session, curriculum_workspace, clock, _unique("privacy"), category)
    await curriculum_session.commit()

    resp = await client.get(CATALOG_PATH, params={"category": category, "limit": 100})
    raw = resp.text
    for token in FORBIDDEN_TOKENS:
        assert token not in raw, f"private token {token!r} leaked into the catalog payload"
    assert curriculum_workspace.view.workspace_id not in raw
    assert curriculum_workspace.view.roadmap_id not in raw
    assert curriculum_workspace.view.revision_id not in raw


async def test_catalog_index_supports_status_category_level():
    indexes = {index.name: index for index in PublicSnapshot.__table__.indexes}
    catalog_index = indexes["idx_public_snapshot_catalog"]
    assert [column.name for column in catalog_index.columns] == ["status", "category", "level"]
