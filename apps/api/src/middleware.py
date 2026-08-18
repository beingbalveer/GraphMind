import time
import uuid
from typing import Awaitable, Callable

import structlog
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

logger = structlog.get_logger()


class RequestTracingMiddleware(BaseHTTPMiddleware):
    """
    Middleware generating and propagating X-Request-ID and measuring request processing latency.
    """

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        # Resolve request ID (preserve incoming client header if present)
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        request.state.request_id = request_id

        # Bind context to structlog
        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(
            request_id=request_id,
            path=request.url.path,
            method=request.method,
        )

        start_time = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception:
            # Let exception handlers capture and format the error
            raise
        finally:
            process_time_ms = round((time.perf_counter() - start_time) * 1000, 2)

        response.headers["X-Request-ID"] = request_id
        response.headers["X-Process-Time-Ms"] = str(process_time_ms)

        logger.info(
            "HTTP request completed",
            status_code=response.status_code,
            process_time_ms=process_time_ms,
        )
        return response
