"""Versioned owned-data export contracts (LSI-002 §8, LSI-045).

The workspace export is a **versioned JSON archive of caller-owned data** for a
single workspace. It deliberately allowlists fields per entity so that internal
storage details and any credential material can never leak:

* no provider API keys or other secrets (they live only in the browser),
* no node/concept/file ``metadata`` JSON or pgvector ``embedding`` values,
* no server-side ``storage_path`` or server system prompts.
"""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

# Bump when the exported shape changes; consumers must tolerate older versions.
EXPORT_VERSION = "1"


class BaseExportSchema(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True,
        alias_generator=to_camel,
        from_attributes=True,
    )


class ExportWorkspaceMeta(BaseExportSchema):
    id: str
    name: str
    description: Optional[str] = None
    viewport_x: float
    viewport_y: float
    zoom: float
    created_at: datetime
    updated_at: datetime


class ExportNode(BaseExportSchema):
    id: str
    parent_id: Optional[str] = None
    role: str
    content: str
    highlighted_context: Optional[str] = None
    provider: Optional[str] = None
    model: Optional[str] = None
    position_x: float
    position_y: float
    created_at: datetime
    updated_at: datetime


class ExportEdge(BaseExportSchema):
    id: str
    source_id: str
    target_id: str
    relation_type: str
    highlighted_context: Optional[str] = None
    created_at: datetime


class ExportConcept(BaseExportSchema):
    id: str
    name: str
    description: Optional[str] = None
    mastery_level: str
    confidence_score: float
    times_quizzed: int
    times_correct: int
    last_reviewed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class ExportFlashcard(BaseExportSchema):
    id: str
    source_node_id: str
    question: str
    answer: str
    position: int
    created_at: datetime
    updated_at: datetime


class ExportFile(BaseExportSchema):
    id: str
    name: str
    size_bytes: int
    mime_type: str
    file_category: str
    created_at: datetime


class ExportCounts(BaseExportSchema):
    nodes: int
    edges: int
    concepts: int
    flashcards: int
    files: int


class WorkspaceExportResponse(BaseExportSchema):
    export_version: str = Field(default=EXPORT_VERSION)
    exported_at: datetime
    workspace: ExportWorkspaceMeta
    nodes: List[ExportNode]
    edges: List[ExportEdge]
    concepts: List[ExportConcept]
    flashcards: List[ExportFlashcard]
    files: List[ExportFile]
    counts: ExportCounts
