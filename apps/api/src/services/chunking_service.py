import os
import re
from typing import Any, Dict, List, Optional

import structlog
from pydantic import BaseModel, Field

logger = structlog.get_logger()

DEFAULT_TARGET_CHUNK_TOKENS = 450
DEFAULT_CHUNK_OVERLAP_TOKENS = 60
CHARS_PER_TOKEN = 4.0


def estimate_token_count(text: str) -> int:
    """
    Estimate token count based on standard English character and whitespace heuristics.
    """
    if not text:
        return 0
    words = len(text.split())
    char_estimate = int(len(text) / CHARS_PER_TOKEN)
    return max(words, char_estimate)


class DocumentChunk(BaseModel):
    """
    Represents a segmented, context-enriched document chunk ready for dense
    and sparse vector indexing.
    """

    chunk_index: int
    content: str
    enriched_content: str
    page_number: Optional[int] = None
    section_header: Optional[str] = None
    token_count: int = 0
    metadata: Dict[str, Any] = Field(default_factory=dict)


class ChunkingService:
    """
    Production-grade, structure-aware document chunker for Enterprise RAG.
    Supports:
      - Markdown heading hierarchy tracking
      - PDF page and paragraph preservation
      - Code block and function boundary detection
      - Context-prefix enrichment to prevent orphan chunk semantics
    """

    def __init__(
        self,
        target_chunk_tokens: int = DEFAULT_TARGET_CHUNK_TOKENS,
        chunk_overlap_tokens: int = DEFAULT_CHUNK_OVERLAP_TOKENS,
    ):
        self.target_chunk_tokens = target_chunk_tokens
        self.chunk_overlap_tokens = chunk_overlap_tokens
        self.target_chunk_chars = int(target_chunk_tokens * CHARS_PER_TOKEN)
        self.chunk_overlap_chars = int(chunk_overlap_tokens * CHARS_PER_TOKEN)

    def chunk_document(
        self,
        filename: str,
        content: str,
        file_category: str = "document",
        metadata: Optional[Dict[str, Any]] = None,
    ) -> List[DocumentChunk]:
        """
        Split a document into context-enriched chunks based on file category and extension.
        """
        if not content or not content.strip():
            return []

        meta = metadata or {}
        ext = os.path.splitext(filename.lower())[1]

        if ext == ".pdf" or file_category == "pdf":
            return self._chunk_pdf_text(filename, content, meta)
        elif ext in (".md", ".markdown") or file_category == "markdown":
            return self._chunk_markdown(filename, content, meta)
        elif file_category == "code" or ext in (
            ".py",
            ".ts",
            ".tsx",
            ".js",
            ".jsx",
            ".go",
            ".rs",
            ".sql",
        ):
            return self._chunk_code(filename, content, meta)
        elif file_category == "tabular":
            return self._chunk_tabular(filename, content, meta)
        else:
            return self._chunk_generic_text(filename, content, meta)

    def _build_enriched_content(
        self,
        filename: str,
        content: str,
        page_number: Optional[int] = None,
        section_header: Optional[str] = None,
    ) -> str:
        """
        Prepend document provenance and structural breadcrumbs to the chunk text.
        """
        breadcrumbs = [f"Document: {filename}"]
        if section_header:
            breadcrumbs.append(f"Section: {section_header}")
        if page_number is not None:
            breadcrumbs.append(f"Page {page_number}")

        header_prefix = f"[{' | '.join(breadcrumbs)}]\n\n"
        return f"{header_prefix}{content.strip()}"

    def _chunk_pdf_text(
        self,
        filename: str,
        text: str,
        meta: Dict[str, Any],
    ) -> List[DocumentChunk]:
        """
        Parse PDF text formatted with page demarcations ('--- Page N ---').
        Preserves page numbers accurately for citation deep-linking.
        """
        chunks: List[DocumentChunk] = []
        page_pattern = re.compile(r"^---\s*Page\s*(\d+)\s*---", re.MULTILINE)
        splits = page_pattern.split(text)

        # splits alternate: [preamble, page_num_1, page_content_1, page_num_2, page_content_2, ...]
        if len(splits) > 1:
            idx = 1
            chunk_counter = 0
            while idx < len(splits):
                try:
                    page_num = int(splits[idx].strip())
                except ValueError:
                    page_num = 1
                page_body = splits[idx + 1].strip() if idx + 1 < len(splits) else ""
                idx += 2

                if not page_body:
                    continue

                page_chunks = self._split_text_with_overlap(page_body)
                for p_chunk in page_chunks:
                    tokens = estimate_token_count(p_chunk)
                    enriched = self._build_enriched_content(
                        filename=filename,
                        content=p_chunk,
                        page_number=page_num,
                    )
                    chunks.append(
                        DocumentChunk(
                            chunk_index=chunk_counter,
                            content=p_chunk,
                            enriched_content=enriched,
                            page_number=page_num,
                            token_count=tokens,
                            metadata={"page": page_num, **meta},
                        )
                    )
                    chunk_counter += 1
            if chunks:
                return chunks

        # Fallback if no page markers were detected
        return self._chunk_generic_text(filename, text, meta)

    def _chunk_markdown(
        self,
        filename: str,
        text: str,
        meta: Dict[str, Any],
    ) -> List[DocumentChunk]:
        """
        Split markdown document by headings (# Heading, ## Subheading),
        preserving active hierarchical breadcrumbs.
        """
        chunks: List[DocumentChunk] = []
        lines = text.splitlines()
        current_section = "Introduction"
        section_lines: List[str] = []
        chunk_counter = 0

        heading_pattern = re.compile(r"^(#{1,4})\s+(.+)$")

        for line in lines:
            match = heading_pattern.match(line)
            if match:
                # Flush previous section buffer
                if section_lines:
                    sec_text = "\n".join(section_lines).strip()
                    if sec_text:
                        sub_chunks = self._split_text_with_overlap(sec_text)
                        for sub in sub_chunks:
                            enriched = self._build_enriched_content(
                                filename=filename,
                                content=sub,
                                section_header=current_section,
                            )
                            chunks.append(
                                DocumentChunk(
                                    chunk_index=chunk_counter,
                                    content=sub,
                                    enriched_content=enriched,
                                    section_header=current_section,
                                    token_count=estimate_token_count(sub),
                                    metadata={"section": current_section, **meta},
                                )
                            )
                            chunk_counter += 1
                    section_lines = []
                current_section = match.group(2).strip()
            section_lines.append(line)

        # Flush final section
        if section_lines:
            sec_text = "\n".join(section_lines).strip()
            if sec_text:
                sub_chunks = self._split_text_with_overlap(sec_text)
                for sub in sub_chunks:
                    enriched = self._build_enriched_content(
                        filename=filename,
                        content=sub,
                        section_header=current_section,
                    )
                    chunks.append(
                        DocumentChunk(
                            chunk_index=chunk_counter,
                            content=sub,
                            enriched_content=enriched,
                            section_header=current_section,
                            token_count=estimate_token_count(sub),
                            metadata={"section": current_section, **meta},
                        )
                    )
                    chunk_counter += 1

        return chunks or self._chunk_generic_text(filename, text, meta)

    def _chunk_code(
        self,
        filename: str,
        text: str,
        meta: Dict[str, Any],
    ) -> List[DocumentChunk]:
        """
        Chunk source code files, prioritizing function/class declaration boundaries.
        """
        chunks: List[DocumentChunk] = []
        code_chunks = self._split_text_with_overlap(text)

        for idx, c_text in enumerate(code_chunks):
            # Extract first function or class declaration as section header
            first_decl: Optional[str] = None
            for line in c_text.splitlines():
                stripped = line.strip()
                if stripped.startswith(("def ", "class ", "function ", "export function ", "export class ", "const ", "type ", "interface ")):
                    first_decl = stripped[:60]
                    break

            enriched = self._build_enriched_content(
                filename=filename,
                content=c_text,
                section_header=first_decl or f"Block {idx + 1}",
            )
            chunks.append(
                DocumentChunk(
                    chunk_index=idx,
                    content=c_text,
                    enriched_content=enriched,
                    section_header=first_decl,
                    token_count=estimate_token_count(c_text),
                    metadata={"code_block": idx, **meta},
                )
            )

        return chunks

    def _chunk_tabular(
        self,
        filename: str,
        text: str,
        meta: Dict[str, Any],
    ) -> List[DocumentChunk]:
        """
        Chunk structured tabular markdown representations into clean batches.
        """
        lines = text.splitlines()
        header_lines: List[str] = []
        data_lines: List[str] = []

        for line in lines:
            if line.startswith("|") and ("---" in line or not header_lines):
                header_lines.append(line)
            else:
                data_lines.append(line)

        header_block = "\n".join(header_lines)
        chunks: List[DocumentChunk] = []
        chunk_counter = 0
        batch_size = 25

        if data_lines:
            for i in range(0, len(data_lines), batch_size):
                batch = data_lines[i : i + batch_size]
                chunk_body = f"{header_block}\n" + "\n".join(batch) if header_block else "\n".join(batch)
                enriched = self._build_enriched_content(
                    filename=filename,
                    content=chunk_body,
                    section_header=f"Rows {i + 1}-{i + len(batch)}",
                )
                chunks.append(
                    DocumentChunk(
                        chunk_index=chunk_counter,
                        content=chunk_body,
                        enriched_content=enriched,
                        section_header=f"Rows {i + 1}-{i + len(batch)}",
                        token_count=estimate_token_count(chunk_body),
                        metadata={"rows_start": i + 1, "rows_end": i + len(batch), **meta},
                    )
                )
                chunk_counter += 1
        else:
            return self._chunk_generic_text(filename, text, meta)

        return chunks

    def _chunk_generic_text(
        self,
        filename: str,
        text: str,
        meta: Dict[str, Any],
    ) -> List[DocumentChunk]:
        """
        Fallback recursive chunker for plain text, logs, and unformatted documents.
        """
        sub_chunks = self._split_text_with_overlap(text)
        chunks: List[DocumentChunk] = []
        for idx, sub in enumerate(sub_chunks):
            enriched = self._build_enriched_content(
                filename=filename,
                content=sub,
            )
            chunks.append(
                DocumentChunk(
                    chunk_index=idx,
                    content=sub,
                    enriched_content=enriched,
                    token_count=estimate_token_count(sub),
                    metadata=meta,
                )
            )
        return chunks

    def _split_text_with_overlap(self, text: str) -> List[str]:
        """
        Split a long text block into overlapping segments respecting paragraph
        and sentence boundaries.
        """
        if len(text) <= self.target_chunk_chars:
            return [text]

        paragraphs = text.split("\n\n")
        chunks: List[str] = []
        current_chunk: List[str] = []
        current_len = 0

        for para in paragraphs:
            para = para.strip()
            if not para:
                continue

            para_len = len(para)

            # If a single paragraph is larger than target_chunk_chars, split by sentences
            if para_len > self.target_chunk_chars:
                if current_chunk:
                    chunks.append("\n\n".join(current_chunk))
                    current_chunk = []
                    current_len = 0

                sentences = re.split(r"(?<=[.!?])\s+", para)
                sent_chunk: List[str] = []
                sent_len = 0
                for sent in sentences:
                    if sent_len + len(sent) > self.target_chunk_chars and sent_chunk:
                        chunks.append(" ".join(sent_chunk))
                        # Sliding overlap: keep last sentence
                        sent_chunk = [sent_chunk[-1]] if self.chunk_overlap_chars > 0 else []
                        sent_len = sum(len(s) for s in sent_chunk)
                    sent_chunk.append(sent)
                    sent_len += len(sent)
                if sent_chunk:
                    chunks.append(" ".join(sent_chunk))
                continue

            if current_len + para_len > self.target_chunk_chars and current_chunk:
                chunks.append("\n\n".join(current_chunk))
                # Sliding overlap: carry over last paragraph if within overlap budget
                if len(current_chunk[-1]) <= self.chunk_overlap_chars:
                    current_chunk = [current_chunk[-1]]
                    current_len = len(current_chunk[0])
                else:
                    current_chunk = []
                    current_len = 0

            current_chunk.append(para)
            current_len += para_len

        if current_chunk:
            chunks.append("\n\n".join(current_chunk))

        return chunks or [text]
