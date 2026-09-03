import base64
from unittest.mock import patch

from ai_core.base import ChatMessage, FileAttachment
from ai_core.providers.anthropic import AnthropicProvider
from ai_core.providers.gemini import GeminiProvider
from ai_core.providers.openai import OpenAIProvider

SAMPLE_IMAGE_BYTES = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
SAMPLE_B64 = base64.b64encode(SAMPLE_IMAGE_BYTES).decode("utf-8")


def test_gemini_multimodal_image_attachment() -> None:
    with patch.dict("os.environ", {"GEMINI_API_KEY": "fake-gemini-key"}):
        provider = GeminiProvider()

    attachment = FileAttachment(
        id="file_123",
        name="chart.png",
        mime_type="image/png",
        data=SAMPLE_B64,
    )
    message = ChatMessage.user(content="Analyze this chart", attachments=[attachment])

    _, contents = provider._to_genai_contents([message])

    assert len(contents) == 1
    content = contents[0]
    assert content.role == "user"
    assert len(content.parts) == 2
    # First part: text
    assert content.parts[0].text == "Analyze this chart"
    # Second part: inline image bytes
    assert content.parts[1].inline_data is not None
    assert content.parts[1].inline_data.mime_type == "image/png"
    assert content.parts[1].inline_data.data == SAMPLE_IMAGE_BYTES


def test_anthropic_multimodal_image_attachment() -> None:
    with patch.dict("os.environ", {"ANTHROPIC_API_KEY": "fake-anthropic-key"}):
        provider = AnthropicProvider()

    attachment = FileAttachment(
        id="file_456",
        name="architecture.jpg",
        mime_type="image/jpeg",
        data=f"data:image/jpeg;base64,{SAMPLE_B64}",
    )
    message = ChatMessage.user(content="Review this architecture", attachments=[attachment])

    _, anthropic_messages = provider._to_anthropic_messages([message])

    assert len(anthropic_messages) == 1
    turn = anthropic_messages[0]
    assert turn["role"] == "user"
    blocks = turn["content"]
    assert isinstance(blocks, list)
    assert len(blocks) == 2
    assert blocks[0] == {"type": "text", "text": "Review this architecture"}
    assert blocks[1]["type"] == "image"
    assert blocks[1]["source"]["type"] == "base64"
    assert blocks[1]["source"]["media_type"] == "image/jpeg"
    assert blocks[1]["source"]["data"] == SAMPLE_B64


def test_openai_multimodal_image_attachment() -> None:
    with patch.dict("os.environ", {"OPENAI_API_KEY": "fake-openai-key"}):
        provider = OpenAIProvider()

    attachment = FileAttachment(
        id="file_789",
        name="ui_mockup.png",
        mime_type="image/png",
        data=SAMPLE_B64,
    )
    message = ChatMessage.user(content="Inspect UI mockup", attachments=[attachment])

    openai_messages = provider._to_openai_messages([message])

    assert len(openai_messages) == 1
    turn = openai_messages[0]
    assert turn["role"] == "user"
    content_parts = turn["content"]
    assert isinstance(content_parts, list)
    assert len(content_parts) == 2
    assert content_parts[0] == {"type": "text", "text": "Inspect UI mockup"}
    assert content_parts[1]["type"] == "image_url"
    assert content_parts[1]["image_url"]["url"] == f"data:image/png;base64,{SAMPLE_B64}"


def test_gemini_multimodal_pdf_attachment() -> None:
    with patch.dict("os.environ", {"GEMINI_API_KEY": "fake-gemini-key"}):
        provider = GeminiProvider()

    dummy_pdf = b"%PDF-1.4 sample pdf binary"
    pdf_b64 = base64.b64encode(dummy_pdf).decode("utf-8")
    attachment = FileAttachment(
        id="file_pdf_1",
        name="specification.pdf",
        mime_type="application/pdf",
        data=pdf_b64,
    )
    message = ChatMessage.user(content="Read this spec", attachments=[attachment])

    _, contents = provider._to_genai_contents([message])

    assert len(contents) == 1
    content = contents[0]
    assert len(content.parts) == 2
    assert content.parts[1].inline_data is not None
    assert content.parts[1].inline_data.mime_type == "application/pdf"
    assert content.parts[1].inline_data.data == dummy_pdf


def test_anthropic_multimodal_pdf_attachment() -> None:
    with patch.dict("os.environ", {"ANTHROPIC_API_KEY": "fake-anthropic-key"}):
        provider = AnthropicProvider()

    dummy_pdf = b"%PDF-1.4 sample pdf binary"
    pdf_b64 = base64.b64encode(dummy_pdf).decode("utf-8")
    attachment = FileAttachment(
        id="file_pdf_2",
        name="contract.pdf",
        mime_type="application/pdf",
        data=pdf_b64,
    )
    message = ChatMessage.user(content="Review this contract", attachments=[attachment])

    _, anthropic_messages = provider._to_anthropic_messages([message])

    assert len(anthropic_messages) == 1
    blocks = anthropic_messages[0]["content"]
    assert len(blocks) == 2
    assert blocks[1]["type"] == "document"
    assert blocks[1]["source"]["type"] == "base64"
    assert blocks[1]["source"]["media_type"] == "application/pdf"
    assert blocks[1]["source"]["data"] == pdf_b64
