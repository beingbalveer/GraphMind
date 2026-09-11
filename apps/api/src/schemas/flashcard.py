from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from pydantic.alias_generators import to_camel


class BaseSchema(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True,
        alias_generator=to_camel,
        from_attributes=True,
    )


class FlashcardDraft(BaseSchema):
    question: str = Field(min_length=1, max_length=1000)
    answer: str = Field(min_length=1, max_length=4000)

    @field_validator("question", "answer")
    @classmethod
    def strip_text(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Flashcard text cannot be blank")
        return cleaned


class FlashcardGenerateRequest(BaseSchema):
    count: int = Field(default=5, ge=1, le=10)
    replace_existing: bool = False
    provider: Optional[str] = None
    model: Optional[str] = None
    api_key: Optional[str] = Field(default=None, repr=False)
    base_url: Optional[str] = None


class FlashcardUpdate(BaseSchema):
    question: Optional[str] = Field(default=None, min_length=1, max_length=1000)
    answer: Optional[str] = Field(default=None, min_length=1, max_length=4000)

    @field_validator("question", "answer")
    @classmethod
    def strip_optional_text(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Flashcard text cannot be blank")
        return cleaned

    @model_validator(mode="after")
    def require_change(self) -> "FlashcardUpdate":
        if self.question is None and self.answer is None:
            raise ValueError("At least one of question or answer must be provided")
        return self


class FlashcardResponse(BaseSchema):
    id: str
    workspace_id: str
    source_node_id: str
    question: str
    answer: str
    position: int
    created_at: datetime
    updated_at: datetime
