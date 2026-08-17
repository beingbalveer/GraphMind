FROM ghcr.io/astral-sh/uv:python3.12-alpine AS builder

WORKDIR /app

# Enable bytecode compilation
ENV UV_COMPILE_BYTECODE=1
ENV UV_LINK_MODE=copy

# Copy workspace metadata files
COPY pyproject.toml /app/
COPY packages/ai-core/ /app/packages/ai-core/
COPY apps/api/ /app/apps/api/

# Install dependencies using uv workspace
RUN uv sync --frozen --no-cache --package graphmind-api

FROM python:3.12-alpine AS final

WORKDIR /app

# Copy installed venv and code
COPY --from=builder /app/.venv /app/.venv
COPY --from=builder /app/apps/api/src /app/src

ENV PATH="/app/.venv/bin:$PATH"
ENV PYTHONPATH="/app/src"

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
