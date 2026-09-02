import io

import pytest
from httpx import ASGITransport, AsyncClient
from main import app


@pytest.mark.asyncio
async def test_workspace_file_upload_lifecycle() -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1. Create a workspace
        ws_resp = await client.post(
            "/api/v1/workspaces",
            json={"name": "File Test Workspace", "description": "Testing assets"},
        )
        assert ws_resp.status_code == 201
        ws_id = ws_resp.json()["id"]

        # 2. Upload test image file
        dummy_png = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
        files = {
            "file": ("architecture_diagram.png", io.BytesIO(dummy_png), "image/png"),
        }
        upload_resp = await client.post(
            f"/api/v1/workspaces/{ws_id}/files/upload",
            files=files,
        )
        assert upload_resp.status_code == 201
        file_data = upload_resp.json()
        file_id = file_data["id"]
        assert file_data["workspaceId"] == ws_id
        assert file_data["name"] == "architecture_diagram.png"
        assert file_data["mimeType"] == "image/png"
        assert file_data["fileCategory"] == "image"
        assert file_data["sizeBytes"] == len(dummy_png)

        # 3. List workspace files
        list_resp = await client.get(f"/api/v1/workspaces/{ws_id}/files")
        assert list_resp.status_code == 200
        file_list = list_resp.json()
        assert len(file_list) >= 1
        assert any(f["id"] == file_id for f in file_list)

        # 4. Filter by category
        image_list_resp = await client.get(
            f"/api/v1/workspaces/{ws_id}/files?category=image"
        )
        assert image_list_resp.status_code == 200
        assert any(f["id"] == file_id for f in image_list_resp.json())

        other_list_resp = await client.get(
            f"/api/v1/workspaces/{ws_id}/files?category=code"
        )
        assert other_list_resp.status_code == 200
        assert not any(f["id"] == file_id for f in other_list_resp.json())

        # 5. Fetch single file metadata
        meta_resp = await client.get(f"/api/v1/workspaces/{ws_id}/files/{file_id}")
        assert meta_resp.status_code == 200
        assert meta_resp.json()["id"] == file_id

        # 6. Download raw file
        down_resp = await client.get(
            f"/api/v1/workspaces/{ws_id}/files/{file_id}/download"
        )
        assert down_resp.status_code == 200
        assert down_resp.headers["content-type"] == "image/png"
        assert down_resp.content == dummy_png

        # 7. Delete file
        del_resp = await client.delete(f"/api/v1/workspaces/{ws_id}/files/{file_id}")
        assert del_resp.status_code == 200
        assert del_resp.json()["deleted"] is True

        # 8. Verify 404 after deletion
        after_resp = await client.get(f"/api/v1/workspaces/{ws_id}/files/{file_id}")
        assert after_resp.status_code == 404


@pytest.mark.asyncio
async def test_workspace_file_upload_nonexistent_workspace() -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        dummy_bytes = b"sample content"
        files = {
            "file": ("test.png", io.BytesIO(dummy_bytes), "image/png"),
        }
        resp = await client.post(
            "/api/v1/workspaces/ws_nonexistent_99999/files/upload",
            files=files,
        )
        assert resp.status_code == 400
        assert "not found" in resp.json()["error"]["message"].lower()


@pytest.mark.asyncio
async def test_workspace_code_and_document_upload_and_extraction() -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1. Create workspace
        ws_resp = await client.post(
            "/api/v1/workspaces",
            json={"name": "Code Extraction Workspace"},
        )
        assert ws_resp.status_code == 201
        ws_id = ws_resp.json()["id"]

        # 2. Upload Python code file
        python_code = b"def calculate_total(items):\n    return sum(item.price for item in items)\n"
        files = {
            "file": ("calculator.py", io.BytesIO(python_code), "text/x-python"),
        }
        py_resp = await client.post(
            f"/api/v1/workspaces/{ws_id}/files/upload",
            files=files,
        )
        assert py_resp.status_code == 201
        py_data = py_resp.json()
        assert py_data["fileCategory"] == "code"
        assert py_data["extractedText"] == python_code.decode("utf-8")

        # 3. Upload Markdown document
        markdown_text = b"# Architecture Overview\nGraphMind uses async PostgreSQL and Next.js.\n"
        files = {
            "file": ("README.md", io.BytesIO(markdown_text), "text/markdown"),
        }
        md_resp = await client.post(
            f"/api/v1/workspaces/{ws_id}/files/upload",
            files=files,
        )
        assert md_resp.status_code == 201
        md_data = md_resp.json()
        assert md_data["fileCategory"] == "document"
        assert md_data["extractedText"] == markdown_text.decode("utf-8")

        # 4. List code files filter
        code_filter_resp = await client.get(
            f"/api/v1/workspaces/{ws_id}/files?category=code"
        )
        assert code_filter_resp.status_code == 200
        code_ids = [f["id"] for f in code_filter_resp.json()]
        assert py_data["id"] in code_ids
        assert md_data["id"] not in code_ids

        # 5. List document files filter
        doc_filter_resp = await client.get(
            f"/api/v1/workspaces/{ws_id}/files?category=document"
        )
        assert doc_filter_resp.status_code == 200
        doc_ids = [f["id"] for f in doc_filter_resp.json()]
        assert md_data["id"] in doc_ids
        assert py_data["id"] not in doc_ids


@pytest.mark.asyncio
async def test_chat_stream_with_code_attachment() -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        payload = {
            "prompt": "Review this implementation",
            "provider": "mock",
            "model": "mock-model",
            "attachments": [
                {
                    "id": "file_code_123",
                    "name": "utils.py",
                    "mime_type": "text/x-python",
                    "fileCategory": "code",
                    "extracted_text": "def add(a, b):\n    return a + b\n",
                }
            ],
        }
        resp = await client.post("/api/v1/chat/completions", json=payload)
        assert resp.status_code == 200
        data = resp.json()
        assert "content" in data
        assert len(data["content"]) > 0

