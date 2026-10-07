import uuid
from typing import Any, Optional

import structlog
from fastapi import Request, status
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from schemas.roadmap_job import JobError
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = structlog.get_logger()


class RoadmapHTTPError(Exception):
    def __init__(self, status_code: int, error: JobError) -> None:
        self.status_code = status_code
        self.error = error
        super().__init__(error.message)


async def roadmap_exception_handler(request: Request, exc: RoadmapHTTPError) -> JSONResponse:
    req_id = get_request_id(request)
    logger.warning(
        "roadmap_request_failed",
        code=exc.error.code,
        status_code=exc.status_code,
        request_id=req_id,
        path=request.url.path,
    )
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {**exc.error.model_dump(mode="json", by_alias=True), "request_id": req_id}
        },
        headers={"X-Request-ID": req_id},
    )


class ErrorDetail(BaseModel):
    code: str
    message: str
    request_id: Optional[str] = None
    details: Optional[Any] = None


class ErrorResponse(BaseModel):
    error: ErrorDetail


def get_request_id(request: Request) -> str:
    return getattr(request.state, "request_id", str(uuid.uuid4()))


async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    req_id = get_request_id(request)
    logger.warning(
        "HTTPException encountered",
        status_code=exc.status_code,
        detail=exc.detail,
        request_id=req_id,
        path=request.url.path,
    )
    payload = {
        "error": {
            "code": f"HTTP_{exc.status_code}",
            "message": str(exc.detail),
            "request_id": req_id,
        }
    }
    return JSONResponse(
        status_code=exc.status_code,
        content=payload,
        headers={"X-Request-ID": req_id},
    )


async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    req_id = get_request_id(request)
    # Sanitize errors to ensure nested exception objects (like ValueError in ctx) serialize cleanly
    sanitized_errors = jsonable_encoder(
        exc.errors(),
        custom_encoder={Exception: str, ValueError: str},
    )
    if "/roadmap" in request.url.path:
        sanitized_errors = [
            {key: value for key, value in error.items() if key not in {"input", "ctx"}}
            for error in sanitized_errors
        ]

    logger.warning(
        "Request validation error",
        errors=sanitized_errors,
        request_id=req_id,
        path=request.url.path,
    )
    payload = {
        "error": {
            "code": "VALIDATION_ERROR",
            "message": "Invalid request payload or parameters.",
            "request_id": req_id,
            "details": sanitized_errors,
        }
    }
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
        content=payload,
        headers={"X-Request-ID": req_id},
    )


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    req_id = get_request_id(request)
    logger.error(
        "Unhandled internal server error",
        error=str(exc),
        request_id=req_id,
        path=request.url.path,
        exc_info=True,
    )
    payload = {
        "error": {
            "code": "INTERNAL_SERVER_ERROR",
            "message": "An unexpected server error occurred. Please try again later.",
            "request_id": req_id,
        }
    }
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=payload,
        headers={"X-Request-ID": req_id},
    )
