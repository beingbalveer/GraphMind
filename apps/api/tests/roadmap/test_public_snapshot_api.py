"""Anonymous public snapshot/lesson API boundary tests (LSI-027).

Covers the LSI-002 §3.2/§3.3 guest routes layered over the immutable snapshots
frozen in LSI-025:

* guest, signed-in, and outsider callers receive byte-identical public payloads;
* public identities are stable across reads and across published versions;
* missing, stale (superseded/unknown version), and unpublished content collapse
  to one uniform, private-data-free ``404``;
* reads are never cached, so withdrawing a snapshot cannot be replayed;
* unsafe source URLs (``javascript:``/``data:``) are neutralized.

All backend tests use the isolated ``graphmind_test`` database, never live data.
"""

import json
import uuid
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest
from httpx import ASGITransport, AsyncClient
from main import app
from models.public_snapshot import PublicSnapshot, PublicSnapshotSource
from models.user import User
from schemas.public import PublicSnapshotPublication
from services.auth_service import create_access_token
from services.roadmap.public_snapshots import PublicSnapshotService
from sqlalchemy import delete, update

TEMPLATE_PREFIX = "lsi027-api-"
SLUG = f"{TEMPLATE_PREFIX}drawing"
VERSION = "2026-10-15.1"
BASE = "/api/v1/public/roadmaps"


def _forbidden_tokens() -> list[str]:
    return [
        "workspaceId",
        "roadmapId",
        "revisionId",
        "chatId",
        "sessionId",
        "ownerId",
        "provenance",
        "evidence",
        '"progress"',
        "referenceId",
        "storagePath",
        "uploadPath",
        "verifiedAt",
    ]


class _Clock:
    """Deterministic publication clock so version ordering is not wall-clock."""

    def __init__(self) -> None:
        self.value = datetime(2026, 10, 15, 8, 0, tzinfo=timezone.utc)

    def now(self) -> datetime:
        return self.value

    def tick(self) -> datetime:
        self.value += timedelta(minutes=5)
        return self.value


@pytest.fixture(autouse=True)
async def cleanup_public_api(curriculum_session):
    """Remove everything this module publishes, keyed by a unique prefix."""
    yield
    await curriculum_session.rollback()
    await curriculum_session.execute(
        delete(PublicSnapshot).where(PublicSnapshot.template_id.like(f"{TEMPLATE_PREFIX}%"))
    )
    await curriculum_session.execute(delete(User).where(User.email.like(f"{TEMPLATE_PREFIX}%")))
    await curriculum_session.commit()


@pytest.fixture
async def outsider(curriculum_session) -> User:
    """A signed-in user with no relationship to the publishing workspace."""
    user = User(
        id=f"usr_{uuid.uuid4().hex[:12]}",
        email=f"{TEMPLATE_PREFIX}outsider-{uuid.uuid4().hex[:8]}@example.com",
        full_name="Outsider",
        provider="local",
        is_active=True,
    )
    curriculum_session.add(user)
    await curriculum_session.commit()
    return user


async def _publish(
    session,
    workspace: SimpleNamespace,
    template_id: str = SLUG,
    version: str = VERSION,
    *,
    clock=None,
):
    service = PublicSnapshotService(session, clock=clock)
    record = await service.publish_revision(
        workspace.owner_id,
        publication=PublicSnapshotPublication(
            template_id=template_id, snapshot_version=version, category="visual-arts"
        ),
        workspace_id=workspace.view.workspace_id,
        revision_id=workspace.view.revision_id,
    )
    await session.commit()
    return record


def _client(*, token: str | None = None) -> AsyncClient:
    cookies = {"access_token": token} if token else {}
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test", cookies=cookies)


# ---------------------------------------------------------------------------
# Stable public IDs and versioned reads
# ---------------------------------------------------------------------------


async def test_guest_reads_stable_public_roadmap_and_lesson(
    curriculum_workspace, curriculum_session
):
    await _publish(curriculum_session, curriculum_workspace)

    async with _client() as api:
        first = await api.get(f"{BASE}/{SLUG}")
        assert first.status_code == 200
        assert first.headers["cache-control"] == "no-store"
        body = first.json()
        assert body["id"] == SLUG
        assert body["slug"] == SLUG
        assert body["snapshotVersion"] == VERSION
        topics = body["phases"][0]["topics"]
        assert [topic["title"] for topic in topics] == [
            "Line control",
            "Simple forms",
            "Observation study",
        ]
        assert all(topic["id"].startswith("pub_topic_") for topic in topics)
        assert all(source["id"].startswith("pub_src_") for source in body["sources"])

        # Repeated reads are byte-for-byte stable: frozen public IDs never move.
        second = await api.get(f"{BASE}/{SLUG}")
        assert second.json() == body

        # A lesson is addressable by its public slug and exposes the same
        # opaque public topic id as the roadmap outline.
        lesson = await api.get(f"{BASE}/{SLUG}/topics/simple-forms")
        assert lesson.status_code == 200
        assert lesson.headers["cache-control"] == "no-store"
        lesson_body = lesson.json()
        assert lesson_body["templateId"] == SLUG
        assert lesson_body["snapshotVersion"] == VERSION
        assert lesson_body["topicSlug"] == "simple-forms"
        simple_forms = next(topic for topic in topics if topic["title"] == "Simple forms")
        assert lesson_body["topicId"] == simple_forms["id"]
        assert lesson_body["objectives"] == ["Explain and demonstrate simple forms."]
        assert all(source["id"].startswith("pub_src_") for source in lesson_body["sources"])

        # The opaque public topic id resolves to the same lesson.
        by_id = await api.get(f"{BASE}/{SLUG}/topics/{lesson_body['topicId']}")
        assert by_id.status_code == 200
        assert by_id.json() == lesson_body


async def test_versioned_read_pins_immutable_version_across_releases(
    curriculum_workspace, curriculum_session
):
    clock = _Clock()
    first_record = await _publish(
        curriculum_session, curriculum_workspace, version="2026-10-15.1", clock=clock.now
    )
    clock.tick()
    await _publish(
        curriculum_session, curriculum_workspace, version="2026-10-15.2", clock=clock.now
    )

    async with _client() as api:
        # No version: deterministic newest published version.
        newest = await api.get(f"{BASE}/{SLUG}")
        assert newest.status_code == 200
        assert newest.json()["snapshotVersion"] == "2026-10-15.2"

        # Pinned version: the older release is still addressable and unchanged.
        pinned = await api.get(f"{BASE}/{SLUG}", params={"version": "2026-10-15.1"})
        assert pinned.status_code == 200
        assert pinned.json()["snapshotVersion"] == "2026-10-15.1"

        # Stable public IDs survive across versions (same template identity).
        v1_ids = [topic["id"] for phase in pinned.json()["phases"] for topic in phase["topics"]]
        v2_ids = [topic["id"] for phase in newest.json()["phases"] for topic in phase["topics"]]
        assert v1_ids == v2_ids
        assert first_record.slug == SLUG


# ---------------------------------------------------------------------------
# Guest / signed-in / outsider serialization parity and privacy
# ---------------------------------------------------------------------------


async def test_guest_signed_in_and_outsider_serialize_identically(
    curriculum_workspace, curriculum_session, outsider
):
    record = await _publish(curriculum_session, curriculum_workspace)

    async with _client() as guest:
        guest_detail = (await guest.get(f"{BASE}/{SLUG}")).json()
        guest_lesson = (await guest.get(f"{BASE}/{SLUG}/topics/line-control")).json()

    async with _client(token=create_access_token(curriculum_workspace.owner_id)) as owner:
        owner_detail = (await owner.get(f"{BASE}/{SLUG}")).json()
        owner_lesson = (await owner.get(f"{BASE}/{SLUG}/topics/line-control")).json()

    async with _client(token=create_access_token(outsider.id)) as stranger:
        outsider_detail = (await stranger.get(f"{BASE}/{SLUG}")).json()
        outsider_lesson = (await stranger.get(f"{BASE}/{SLUG}/topics/line-control")).json()

    assert guest_detail == owner_detail == outsider_detail
    assert guest_lesson == owner_lesson == outsider_lesson

    # No private identity crosses the public boundary for any caller, and the
    # publisher's workspace is never discoverable from the payload.
    serialized = json.dumps({"detail": guest_detail, "lesson": guest_lesson})
    for token in _forbidden_tokens():
        assert token not in serialized, f"private token {token!r} leaked into a public payload"
    assert curriculum_workspace.view.workspace_id not in serialized
    assert curriculum_workspace.view.revision_id not in serialized
    assert outsider.id not in serialized
    assert record.content_hash not in serialized


# ---------------------------------------------------------------------------
# Neutral unavailable responses (missing / stale / unpublished)
# ---------------------------------------------------------------------------


def _assert_neutral_unavailable(response) -> None:
    assert response.status_code == 404
    payload = response.json()
    assert payload["error"]["code"] == "HTTP_404"
    assert payload["error"]["message"] == "This content is not available."
    # The client-supplied reference is never echoed and nothing private leaks.
    assert SLUG not in response.text
    assert "workspace" not in response.text
    assert "owner" not in response.text


async def test_missing_and_stale_content_share_one_neutral_response(
    curriculum_workspace, curriculum_session
):
    await _publish(curriculum_session, curriculum_workspace)

    async with _client() as api:
        # Unknown template.
        _assert_neutral_unavailable(await api.get(f"{BASE}/{TEMPLATE_PREFIX}never-published"))
        # Known template, stale/unknown pinned version.
        _assert_neutral_unavailable(
            await api.get(f"{BASE}/{SLUG}", params={"version": "1999-01-01.0"})
        )
        # Known template and version, unknown topic.
        _assert_neutral_unavailable(await api.get(f"{BASE}/{SLUG}/topics/no-such-topic"))
        # Unknown template lesson.
        _assert_neutral_unavailable(
            await api.get(f"{BASE}/{TEMPLATE_PREFIX}never-published/topics/anything")
        )

        # The valid content is still served; only the neutral responses are 404.
        assert (await api.get(f"{BASE}/{SLUG}")).status_code == 200
        assert (await api.get(f"{BASE}/{SLUG}", params={"version": VERSION})).status_code == 200


async def test_unpublish_withdraws_reads_and_is_never_cached(
    curriculum_workspace, curriculum_session
):
    record = await _publish(curriculum_session, curriculum_workspace)

    async with _client() as api:
        published = await api.get(f"{BASE}/{SLUG}")
        assert published.status_code == 200
        assert published.headers["cache-control"] == "no-store"

        await PublicSnapshotService(curriculum_session).unpublish(
            curriculum_workspace.owner_id,
            template_id=SLUG,
            snapshot_version=VERSION,
        )
        await curriculum_session.commit()

        # A later read cannot replay the previously published body.
        _assert_neutral_unavailable(await api.get(f"{BASE}/{SLUG}"))
        _assert_neutral_unavailable(await api.get(f"{BASE}/{SLUG}/topics/line-control"))
        # A pinned request to the withdrawn version is equally neutral.
        _assert_neutral_unavailable(await api.get(f"{BASE}/{SLUG}", params={"version": VERSION}))
    assert record.status == "published"


# ---------------------------------------------------------------------------
# Safe public sources
# ---------------------------------------------------------------------------


async def test_unsafe_source_urls_are_neutralized(curriculum_workspace, curriculum_session):
    record = await _publish(curriculum_session, curriculum_workspace)

    await curriculum_session.execute(
        update(PublicSnapshotSource)
        .where(
            PublicSnapshotSource.snapshot_id == record.id,
            PublicSnapshotSource.position == 0,
        )
        .values(url="javascript:alert(1)")
    )
    await curriculum_session.commit()

    async with _client() as api:
        detail = await api.get(f"{BASE}/{SLUG}")
        assert detail.status_code == 200
        body = detail.json()
        unsafe_source = body["sources"][0]
        assert unsafe_source["url"] is None
        assert "javascript:" not in detail.text

        lesson = await api.get(f"{BASE}/{SLUG}/topics/line-control")
        assert lesson.status_code == 200
        assert "javascript:" not in lesson.text


def test_public_snapshot_router_routes_are_registered():
    paths = set(app.openapi().get("paths", {}))
    assert "/api/v1/public/roadmaps/{slug}" in paths
    assert "/api/v1/public/roadmaps/{slug}/topics/{topic_slug}" in paths
