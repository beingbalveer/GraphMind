import os
import re
import uuid
from pathlib import Path
from typing import List, Optional

import structlog
from anyio import Path as AsyncPath
from models.workspace import Workspace, WorkspaceFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

logger = structlog.get_logger()

# Allowed image MIME types and max payload limits
ALLOWED_IMAGE_MIMES = {
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
    "image/gif",
    "image/svg+xml",
}

MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024  # 20 Megabytes

# Storage root: data/storage/workspaces
BASE_STORAGE_DIR = Path(os.getenv("STORAGE_DIR", "data/storage"))


def _sanitize_filename(filename: str) -> str:
    """Sanitize filename to avoid path traversal or unsafe characters."""
    clean = os.path.basename(filename).strip()
    clean = re.sub(r"[^\w\.\-\_]", "_", clean)
    return clean or "uploaded_asset"


class FileService:
    """
    Service managing workspace asset library files, local disk persistence,
    and metadata validation.
    """

    def __init__(self, base_storage_dir: Optional[Path] = None):
        self.storage_dir = base_storage_dir or BASE_STORAGE_DIR

    async def _ensure_workspace_dir(self, workspace_id: str) -> Path:
        ws_dir = self.storage_dir / "workspaces" / workspace_id / "files"
        p = AsyncPath(ws_dir)
        await p.mkdir(parents=True, exist_ok=True)
        return ws_dir

    async def save_file(
        self,
        db: AsyncSession,
        workspace_id: str,
        filename: str,
        content: bytes,
        mime_type: str,
    ) -> WorkspaceFile:
        """
        Validate, save file to disk, and persist record to workspace_files.
        """
        # 1. Verify workspace exists
        ws_result = await db.execute(select(Workspace).where(Workspace.id == workspace_id))
        ws = ws_result.scalar_one_or_none()
        if not ws:
            raise ValueError(f"Workspace '{workspace_id}' not found.")

        # 2. Validate payload size
        if len(content) > MAX_FILE_SIZE_BYTES:
            raise ValueError(
                f"File size ({len(content)} bytes) exceeds maximum limit of 20MB."
            )

        # 3. Categorize file
        normalized_mime = mime_type.lower().split(";")[0].strip()
        if normalized_mime in ALLOWED_IMAGE_MIMES or normalized_mime.startswith("image/"):
            category = "image"
        else:
            category = "other"

        # 4. Write to workspace storage
        file_id = f"file_{uuid.uuid4().hex[:12]}"
        safe_name = _sanitize_filename(filename)
        dest_dir = await self._ensure_workspace_dir(workspace_id)
        storage_filename = f"{file_id}_{safe_name}"
        dest_path = dest_dir / storage_filename

        p = AsyncPath(dest_path)
        await p.write_bytes(content)

        # 5. Build database record
        file_record = WorkspaceFile(
            id=file_id,
            workspace_id=workspace_id,
            name=filename.strip() or safe_name,
            size_bytes=len(content),
            mime_type=normalized_mime,
            file_category=category,
            storage_path=str(dest_path),
            metadata_payload={
                "original_filename": filename,
                "sanitized_filename": safe_name,
            },
        )

        db.add(file_record)
        await db.flush()

        logger.info(
            "Saved workspace file",
            file_id=file_id,
            workspace_id=workspace_id,
            size_bytes=len(content),
            mime_type=normalized_mime,
            category=category,
        )
        return file_record

    async def get_file(
        self,
        db: AsyncSession,
        workspace_id: str,
        file_id: str,
    ) -> Optional[WorkspaceFile]:
        """Fetch file metadata by workspace ID and file ID."""
        stmt = select(WorkspaceFile).where(
            WorkspaceFile.workspace_id == workspace_id,
            WorkspaceFile.id == file_id,
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def list_files(
        self,
        db: AsyncSession,
        workspace_id: str,
        category: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[WorkspaceFile]:
        """List files in workspace with optional category filter and pagination."""
        stmt = (
            select(WorkspaceFile)
            .where(WorkspaceFile.workspace_id == workspace_id)
            .order_by(WorkspaceFile.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        if category:
            stmt = stmt.where(WorkspaceFile.file_category == category)

        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def delete_file(
        self,
        db: AsyncSession,
        workspace_id: str,
        file_id: str,
    ) -> bool:
        """Delete file from disk and database record."""
        file_record = await self.get_file(db, workspace_id, file_id)
        if not file_record:
            return False

        # Remove physical file from disk
        try:
            p = AsyncPath(file_record.storage_path)
            if await p.exists():
                await p.unlink()
        except Exception as e:
            logger.warning(
                "Could not delete physical file asset",
                path=file_record.storage_path,
                error=str(e),
            )

        await db.delete(file_record)
        await db.flush()
        logger.info("Deleted workspace file", file_id=file_id, workspace_id=workspace_id)
        return True


# Global service instance
file_service = FileService()
