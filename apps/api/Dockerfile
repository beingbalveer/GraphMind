FROM ghcr.io/astral-sh/uv:python3.12-alpine AS builder

WORKDIR /app

# Enable bytecode compilation
ENV UV_COMPILE_BYTECODE=1
ENV UV_LINK_MODE=copy

# Copy workspace metadata files
COPY pyproject.toml uv.lock /app/
COPY packages/ai-core/ /app/packages/ai-core/
COPY apps/api/ /app/apps/api/

# Install dependencies using uv workspace
RUN uv sync --frozen --no-cache --package graphmind-api

FROM python:3.12-alpine AS final

WORKDIR /app

# Copy installed venv and code
COPY --from=builder /app/.venv /app/.venv
COPY --from=builder /app/apps/api/src /app/src
COPY --from=builder /app/apps/api/skills /app/skills
COPY --from=builder /app/packages/ai-core /app/packages/ai-core

ENV PATH="/app/.venv/bin:$PATH"
ENV PYTHONPATH="/app/src"
ENV STORAGE_DIR="/app/data/storage"
ENV ROADMAP_REFERENCE_DIR="/app/data/storage/roadmap"

EXPOSE 8300

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8300"]
