from datetime import datetime
from typing import Any, Dict, List, Optional

import structlog
from anyio import Path as AsyncPath
from database import get_db
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel
from services.file_service import file_service
from sqlalchemy.ext.asyncio import AsyncSession

logger = structlog.get_logger()

router = APIRouter(
    prefix="/api/v1/workspaces/{workspace_id}/files",
    tags=["Workspace Files"],
)


class WorkspaceFileResponse(BaseModel):
    """Schema representing an uploaded workspace file asset."""

    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    id: str
    workspace_id: str
    name: str
    size_bytes: int
    mime_type: str
    file_category: str
    extracted_text: Optional[str] = None
    created_at: datetime
    metadata: Dict[str, Any] = {}
    url: str


def _to_file_response(file_rec: Any) -> WorkspaceFileResponse:
    return WorkspaceFileResponse(
        id=file_rec.id,
        workspace_id=file_rec.workspace_id,
        name=file_rec.name,
        size_bytes=file_rec.size_bytes,
        mime_type=file_rec.mime_type,
        file_category=file_rec.file_category,
        extracted_text=file_rec.extracted_text,
        created_at=file_rec.created_at,
        metadata=file_rec.metadata_payload or {},
        url=f"/api/v1/workspaces/{file_rec.workspace_id}/files/{file_rec.id}/download",
    )


@router.post(
    "/upload",
    response_model=WorkspaceFileResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload asset file to workspace library",
)
async def upload_file(
    workspace_id: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
) -> WorkspaceFileResponse:
    """
    Upload an image or document asset to the workspace file library.
    """
    try:
        content = await file.read()
        mime_type = file.content_type or "application/octet-stream"
        filename = file.filename or "uploaded_file"

        file_rec = await file_service.save_file(
            db=db,
            workspace_id=workspace_id,
            filename=filename,
            content=content,
            mime_type=mime_type,
        )
        return _to_file_response(file_rec)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        logger.error(
            "File upload failed",
            workspace_id=workspace_id,
            filename=file.filename,
            error=str(e),
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process file upload.",
        )


@router.get(
    "",
    response_model=List[WorkspaceFileResponse],
    summary="List workspace library files",
)
async def list_files(
    workspace_id: str,
    category: Optional[str] = Query(
        default=None, description="Filter files by category (e.g. 'image')"
    ),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
) -> List[WorkspaceFileResponse]:
    """
    Retrieve all uploaded files stored in this workspace library.
    """
    files = await file_service.list_files(
        db=db,
        workspace_id=workspace_id,
        category=category,
        limit=limit,
        offset=offset,
    )
    return [_to_file_response(f) for f in files]


@router.get(
    "/{file_id}",
    response_model=WorkspaceFileResponse,
    summary="Get file metadata",
)
async def get_file_metadata(
    workspace_id: str,
    file_id: str,
    db: AsyncSession = Depends(get_db),
) -> WorkspaceFileResponse:
    """
    Get file metadata details.
    """
    file_rec = await file_service.get_file(db, workspace_id, file_id)
    if not file_rec:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"File '{file_id}' not found in workspace '{workspace_id}'.",
        )
    return _to_file_response(file_rec)


@router.get(
    "/{file_id}/download",
    summary="Download or stream raw file asset",
)
async def download_file(
    workspace_id: str,
    file_id: str,
    download: bool = Query(
        default=False,
        description="Whether to force attachment download vs inline display",
    ),
    db: AsyncSession = Depends(get_db),
) -> FileResponse:
    """
    Serve raw file content directly with appropriate Content-Type and Disposition.
    """
    file_rec = await file_service.get_file(db, workspace_id, file_id)
    if not file_rec:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"File '{file_id}' not found.",
        )

    storage_p = AsyncPath(file_rec.storage_path)
    if not await storage_p.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File content not found on server storage.",
        )

    disposition = "attachment" if download else "inline"
    return FileResponse(
        path=file_rec.storage_path,
        media_type=file_rec.mime_type,
        filename=file_rec.name,
        content_disposition_type=disposition,
    )


@router.delete(
    "/{file_id}",
    summary="Delete file from workspace library",
)
async def delete_file(
    workspace_id: str,
    file_id: str,
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """
    Delete a file asset and its underlying storage file.
    """
    deleted = await file_service.delete_file(db, workspace_id, file_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"File '{file_id}' not found.",
        )
    return {"deleted": True, "file_id": file_id}
