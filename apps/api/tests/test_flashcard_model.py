from models.flashcard import FlashcardModel
from models.workspace import NodeModel, Workspace


def test_flashcard_table_contract() -> None:
    table = FlashcardModel.__table__
    assert table.name == "flashcards"
    assert {column.name for column in table.columns} == {
        "id",
        "workspace_id",
        "source_node_id",
        "question",
        "answer",
        "position",
        "created_at",
        "updated_at",
    }
    foreign_keys = {fk.parent.name: fk for fk in table.foreign_keys}
    assert foreign_keys["workspace_id"].ondelete == "CASCADE"
    assert foreign_keys["source_node_id"].ondelete == "CASCADE"


def test_parent_models_expose_flashcards() -> None:
    assert "flashcards" in Workspace.__mapper__.relationships
    assert "flashcards" in NodeModel.__mapper__.relationships
