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

        try:
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
            image_list_resp = await client.get(f"/api/v1/workspaces/{ws_id}/files?category=image")
            assert image_list_resp.status_code == 200
            assert any(f["id"] == file_id for f in image_list_resp.json())

            other_list_resp = await client.get(f"/api/v1/workspaces/{ws_id}/files?category=code")
            assert other_list_resp.status_code == 200
            assert not any(f["id"] == file_id for f in other_list_resp.json())

            # 5. Fetch single file metadata
            meta_resp = await client.get(f"/api/v1/workspaces/{ws_id}/files/{file_id}")
            assert meta_resp.status_code == 200
            assert meta_resp.json()["id"] == file_id

            # 6. Download raw file (inline by default)
            down_resp = await client.get(f"/api/v1/workspaces/{ws_id}/files/{file_id}/download")
            assert down_resp.status_code == 200
            assert down_resp.headers["content-type"] == "image/png"
            assert "inline" in down_resp.headers["content-disposition"]
            assert down_resp.content == dummy_png

            # 6b. Explicit download parameter forces attachment
            forced_resp = await client.get(
                f"/api/v1/workspaces/{ws_id}/files/{file_id}/download?download=true"
            )
            assert forced_resp.status_code == 200
            assert "attachment" in forced_resp.headers["content-disposition"]

            # 7. Delete file
            del_resp = await client.delete(f"/api/v1/workspaces/{ws_id}/files/{file_id}")
            assert del_resp.status_code == 200
            assert del_resp.json()["deleted"] is True

            # 8. Verify 404 after deletion
            after_resp = await client.get(f"/api/v1/workspaces/{ws_id}/files/{file_id}")
            assert after_resp.status_code == 404
        finally:
            await client.delete(f"/api/v1/workspaces/{ws_id}")


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

        try:
            # 2. Upload Python code file
            python_code = (
                b"def calculate_total(items):\n    return sum(item.price for item in items)\n"
            )
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
            markdown_text = (
                b"# Architecture Overview\nGraphMind uses async PostgreSQL and Next.js.\n"
            )
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
            code_filter_resp = await client.get(f"/api/v1/workspaces/{ws_id}/files?category=code")
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
        finally:
            await client.delete(f"/api/v1/workspaces/{ws_id}")


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


@pytest.mark.asyncio
async def test_workspace_pdf_upload_and_extraction() -> None:
    import pypdf

    # Generate small valid PDF with pypdf
    writer = pypdf.PdfWriter()
    writer.add_blank_page(width=72, height=72)
    buf = io.BytesIO()
    writer.write(buf)
    pdf_bytes = buf.getvalue()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        ws_resp = await client.post(
            "/api/v1/workspaces",
            json={"name": "PDF Test Workspace"},
        )
        assert ws_resp.status_code == 201
        ws_id = ws_resp.json()["id"]

        try:
            files = {
                "file": ("sample_report.pdf", io.BytesIO(pdf_bytes), "application/pdf"),
            }
            upload_resp = await client.post(
                f"/api/v1/workspaces/{ws_id}/files/upload",
                files=files,
            )
            assert upload_resp.status_code == 201
            data = upload_resp.json()
            assert data["name"] == "sample_report.pdf"
            assert data["mimeType"] == "application/pdf"
            assert data["fileCategory"] == "document"
            assert data["metadata"]["page_count"] == 1
        finally:
            await client.delete(f"/api/v1/workspaces/{ws_id}")


@pytest.mark.asyncio
async def test_chat_stream_with_pdf_attachment() -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        payload = {
            "prompt": "Summarize this PDF",
            "provider": "mock",
            "model": "mock-model",
            "attachments": [
                {
                    "id": "file_pdf_99",
                    "name": "financial_report.pdf",
                    "mime_type": "application/pdf",
                    "fileCategory": "document",
                    "extracted_text": "Q3 Revenue was $42M with 35% YoY growth.",
                }
            ],
        }
        resp = await client.post("/api/v1/chat/completions", json=payload)
        assert resp.status_code == 200
        data = resp.json()
        assert "content" in data


@pytest.mark.asyncio
async def test_workspace_tabular_file_uploads_and_extraction() -> None:
    """Test CSV, TSV, JSONL, and Excel (XLSX) file upload, metadata, and markdown table extraction."""
    import openpyxl

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        ws_resp = await client.post(
            "/api/v1/workspaces",
            json={"name": "Tabular Data Workspace"},
        )
        assert ws_resp.status_code == 201
        ws_id = ws_resp.json()["id"]

        try:
            # 1. Upload CSV
            csv_bytes = b"id,name,role,salary\n1,Alice,Engineer,120000\n2,Bob,Designer,95000\n3,Carol,Manager,140000"
            csv_resp = await client.post(
                f"/api/v1/workspaces/{ws_id}/files/upload",
                files={"file": ("employees.csv", io.BytesIO(csv_bytes), "text/csv")},
            )
            assert csv_resp.status_code == 201
            csv_data = csv_resp.json()
            assert csv_data["fileCategory"] == "tabular"
            assert csv_data["metadata"]["row_count"] == 3
            assert csv_data["metadata"]["columns"] == ["id", "name", "role", "salary"]
            assert "| id | name | role | salary |" in csv_data["extractedText"]
            assert "| 1 | Alice | Engineer | 120000 |" in csv_data["extractedText"]

            # 2. Upload TSV
            tsv_bytes = b"dept\theadcount\nSales\t45\nEngineering\t110"
            tsv_resp = await client.post(
                f"/api/v1/workspaces/{ws_id}/files/upload",
                files={
                    "file": ("departments.tsv", io.BytesIO(tsv_bytes), "text/tab-separated-values")
                },
            )
            assert tsv_resp.status_code == 201
            tsv_data = tsv_resp.json()
            assert tsv_data["fileCategory"] == "tabular"
            assert tsv_data["metadata"]["format"] == "tsv"
            assert tsv_data["metadata"]["row_count"] == 2
            assert "| dept | headcount |" in tsv_data["extractedText"]

            # 3. Upload JSONL
            jsonl_bytes = b'{"sku": "A100", "price": 49.99}\n{"sku": "B200", "price": 19.95}'
            jsonl_resp = await client.post(
                f"/api/v1/workspaces/{ws_id}/files/upload",
                files={"file": ("products.jsonl", io.BytesIO(jsonl_bytes), "application/x-ndjson")},
            )
            assert jsonl_resp.status_code == 201
            jsonl_data = jsonl_resp.json()
            assert jsonl_data["fileCategory"] == "tabular"
            assert jsonl_data["metadata"]["format"] == "jsonl"
            assert jsonl_data["metadata"]["row_count"] == 2
            assert "| sku | price |" in jsonl_data["extractedText"]

            # 4. Upload XLSX
            wb = openpyxl.Workbook()
            ws = wb.active
            ws.title = "Q3_Metrics"
            ws.append(["Region", "Revenue", "Units"])
            ws.append(["North", 500000, 1250])
            ws.append(["South", 340000, 890])
            xlsx_buf = io.BytesIO()
            wb.save(xlsx_buf)
            xlsx_bytes = xlsx_buf.getvalue()

            xlsx_resp = await client.post(
                f"/api/v1/workspaces/{ws_id}/files/upload",
                files={
                    "file": (
                        "metrics.xlsx",
                        io.BytesIO(xlsx_bytes),
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    )
                },
            )
            assert xlsx_resp.status_code == 201
            xlsx_data = xlsx_resp.json()
            assert xlsx_data["fileCategory"] == "tabular"
            assert xlsx_data["metadata"]["format"] == "xlsx"
            assert xlsx_data["metadata"]["sheets"] == ["Q3_Metrics"]
            assert xlsx_data["metadata"]["row_count"] == 2
            assert "| Region | Revenue | Units |" in xlsx_data["extractedText"]

            # 5. Verify ?category=tabular filter
            tab_list_resp = await client.get(f"/api/v1/workspaces/{ws_id}/files?category=tabular")
            assert tab_list_resp.status_code == 200
            tab_files = tab_list_resp.json()
            assert len(tab_files) == 4
            file_names = {f["name"] for f in tab_files}
            assert file_names == {
                "employees.csv",
                "departments.tsv",
                "products.jsonl",
                "metrics.xlsx",
            }

            # 6. Verify chat completions prompt injection with tabular dataset
            chat_resp = await client.post(
                "/api/v1/chat/completions",
                json={
                    "prompt": "Analyze our Q3 sales performance",
                    "provider": "mock",
                    "model": "mock-model",
                    "attachments": [
                        {
                            "id": xlsx_data["id"],
                            "name": xlsx_data["name"],
                            "mime_type": xlsx_data["mimeType"],
                            "fileCategory": xlsx_data["fileCategory"],
                            "extracted_text": xlsx_data["extractedText"],
                        }
                    ],
                },
            )
            assert chat_resp.status_code == 200
            assert "content" in chat_resp.json()
        finally:
            await client.delete(f"/api/v1/workspaces/{ws_id}")
