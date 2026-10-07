from typing import Literal

from pydantic import Field, FiniteFloat
from schemas.flashcard import BaseSchema

GraphKind = Literal["conversation", "curriculum"]


class CanvasPoint(BaseSchema):
    x: FiniteFloat
    y: FiniteFloat


class CanvasViewport(CanvasPoint):
    zoom: FiniteFloat = Field(ge=0.05, le=4)


class CanvasLayout(BaseSchema):
    version: str = Field(min_length=1, max_length=32)
    positions: dict[str, CanvasPoint] = Field(max_length=2000)
    viewport: CanvasViewport | None
    topology_key: str = Field(max_length=100000)


class CanvasLayoutWrite(BaseSchema):
    base_revision: int = Field(ge=0)
    layout: CanvasLayout


class CanvasLayoutResponse(BaseSchema):
    layout: CanvasLayout | None
    revision: int
