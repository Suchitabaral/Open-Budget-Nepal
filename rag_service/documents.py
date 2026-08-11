from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable, Iterator

from langchain_text_splitters import RecursiveCharacterTextSplitter

from .config import RAGSettings


TEXT_NODE_TYPES = {"heading", "paragraph", "list_item", "table_title", "section"}


@dataclass(frozen=True)
class DocumentChunk:
    id: str
    text: str
    metadata: dict[str, Any]


@dataclass(frozen=True)
class _Piece:
    text: str
    page: int
    headings: tuple[str, ...]
    node_id: str
    node_type: str
    quality_score: float


class ParsedDocumentLoader:
    """Load parser outputs while preserving document, section, table, and page context."""

    def __init__(self, settings: RAGSettings) -> None:
        self.settings = settings
        self.splitter = RecursiveCharacterTextSplitter(
            chunk_size=settings.chunk_size,
            chunk_overlap=settings.chunk_overlap,
            separators=["\n\n", "\n", "। ", ". ", " ", ""],
            keep_separator=True,
        )

    def load_chunks(self, document_ids: set[str] | None = None) -> list[DocumentChunk]:
        root = self.settings.parsed_documents_dir
        if not root.exists():
            raise FileNotFoundError(f"Parsed document directory does not exist: {root}")

        chunks: list[DocumentChunk] = []
        for metadata_path in sorted(root.rglob("metadata.json")):
            metadata = self._read_json(metadata_path)
            document_id = str(metadata.get("document_id") or metadata_path.parent.name)
            if document_ids and document_id not in document_ids:
                continue
            chunks.extend(self._load_document(metadata_path.parent, metadata, root))
        return chunks

    def _load_document(
        self,
        document_dir: Path,
        document_metadata: dict[str, Any],
        parsed_root: Path,
    ) -> list[DocumentChunk]:
        structure_path = self._structure_path(document_dir)
        structure = self._read_json(structure_path)
        nodes = structure.get("nodes")
        if not isinstance(nodes, list):
            raise ValueError(f"Expected a nodes list in {structure_path}")

        pieces = list(self._pieces(nodes, document_dir))
        groups = self._group_pieces(pieces)
        return self._chunks_from_groups(
            groups=groups,
            document_metadata=document_metadata,
            source_path=structure_path.relative_to(parsed_root),
        )

    def _pieces(
        self, nodes: list[dict[str, Any]], document_dir: Path
    ) -> Iterator[_Piece]:
        node_map = {str(node.get("id")): node for node in nodes if node.get("id")}
        active_headings: list[str] = []
        last_page = -1

        for node in nodes:
            node_type = str(node.get("type") or "")
            node_text = str(node.get("text") or "").strip()
            page_value = node.get("page")
            page = int(page_value) if isinstance(page_value, (int, float)) else last_page
            if page >= 0:
                last_page = page

            quality = float(node.get("quality_score", 1.0))
            is_indexable = (
                node.get("indexable") is not False
                and quality >= self.settings.minimum_quality_score
            )
            if node_type == "heading" and node_text and is_indexable:
                level = max(1, int(node.get("level") or 1))
                active_headings = active_headings[: level - 1]
                active_headings.append(node_text)
                # The heading is embedded in the header of following content.
                continue

            if not is_indexable:
                continue

            if node_type == "table":
                node_text = self._load_table(document_dir, node)
            elif node_type not in TEXT_NODE_TYPES:
                continue
            if not node_text:
                continue

            ancestor_headings = self._ancestor_headings(node, node_map)
            if ancestor_headings:
                headings = ancestor_headings
            elif self._has_heading_ancestor(node, node_map):
                headings = ()
            else:
                headings = tuple(active_headings)
            yield _Piece(
                text=node_text,
                page=page,
                headings=headings,
                node_id=str(node.get("id") or "unknown"),
                node_type=node_type,
                quality_score=quality,
            )

    def _ancestor_headings(
        self, node: dict[str, Any], node_map: dict[str, dict[str, Any]]
    ) -> tuple[str, ...]:
        headings: list[str] = []
        parent_id = node.get("parent")
        visited: set[str] = set()
        while parent_id and str(parent_id) not in visited:
            key = str(parent_id)
            visited.add(key)
            parent = node_map.get(key)
            if not parent:
                break
            parent_quality = float(parent.get("quality_score", 1.0))
            if (
                parent.get("type") == "heading"
                and parent.get("text")
                and parent.get("indexable") is not False
                and parent_quality >= self.settings.minimum_quality_score
            ):
                headings.append(str(parent["text"]).strip())
            parent_id = parent.get("parent")
        headings.reverse()
        return tuple(headings)

    @staticmethod
    def _has_heading_ancestor(
        node: dict[str, Any], node_map: dict[str, dict[str, Any]]
    ) -> bool:
        parent_id = node.get("parent")
        visited: set[str] = set()
        while parent_id and str(parent_id) not in visited:
            key = str(parent_id)
            visited.add(key)
            parent = node_map.get(key)
            if not parent:
                return False
            if parent.get("type") == "heading":
                return True
            parent_id = parent.get("parent")
        return False

    def _group_pieces(self, pieces: Iterable[_Piece]) -> list[list[_Piece]]:
        groups: list[list[_Piece]] = []
        current: list[_Piece] = []
        current_length = 0

        def flush() -> None:
            nonlocal current, current_length
            if current:
                groups.append(current)
            current = []
            current_length = 0

        for piece in pieces:
            is_table = piece.node_type == "table"
            is_table_title = piece.node_type == "table_title"
            group_changed = bool(
                current
                and (
                    current[0].page != piece.page
                    or current[0].headings != piece.headings
                    or current_length + len(piece.text) > self.settings.chunk_size * 2
                )
            )
            table_follows_title = bool(
                is_table
                and current
                and current[-1].node_type == "table_title"
                and current[0].page == piece.page
                and current[0].headings == piece.headings
            )
            if group_changed or is_table_title or (is_table and not table_follows_title):
                flush()
            current.append(piece)
            current_length += len(piece.text) + 2
            if is_table:
                flush()
        flush()
        return groups

    def _chunks_from_groups(
        self,
        groups: list[list[_Piece]],
        document_metadata: dict[str, Any],
        source_path: Path,
    ) -> list[DocumentChunk]:
        document_id = str(document_metadata.get("document_id") or source_path.parent.name)
        document_name = str(document_metadata.get("document_name") or document_id)
        output: list[DocumentChunk] = []

        for group_number, group in enumerate(groups):
            body = "\n\n".join(piece.text for piece in group)
            section = " > ".join(group[0].headings)[:500]
            page = group[0].page
            header_parts = [f"Document: {document_name}"]
            organization = str(document_metadata.get("organization") or "")
            document_type = str(document_metadata.get("document_type") or "")
            fiscal_year = str(document_metadata.get("fiscal_year") or "")
            if organization:
                header_parts.append(f"Organization: {organization}")
            if document_type:
                header_parts.append(f"Document type: {document_type}")
            if fiscal_year:
                header_parts.append(f"Fiscal year: {fiscal_year}")
            if section:
                header_parts.append(f"Section: {section}")
            if page >= 0:
                header_parts.append(f"Page: {page}")
            header = "\n".join(header_parts)

            split_bodies = self.splitter.split_text(body)
            for split_number, split_body in enumerate(split_bodies):
                text = f"{header}\n\n{split_body.strip()}".strip()
                identity = (
                    f"{document_id}|{source_path}|{page}|{group_number}|{split_number}"
                )
                chunk_id = hashlib.sha256(identity.encode("utf-8")).hexdigest()[:32]
                scores = [piece.quality_score for piece in group]
                metadata = {
                    "document_id": document_id,
                    "document_name": document_name,
                    "organization": str(document_metadata.get("organization") or ""),
                    "document_type": str(document_metadata.get("document_type") or ""),
                    "language": str(document_metadata.get("language") or "unknown"),
                    "fiscal_year": str(document_metadata.get("fiscal_year") or ""),
                    "parser_version": str(document_metadata.get("parser_version") or ""),
                    "page": page,
                    "section": section,
                    "source_path": source_path.as_posix(),
                    "node_ids": [piece.node_id for piece in group],
                    "content_types": sorted({piece.node_type for piece in group}),
                    "quality_score": sum(scores) / len(scores),
                    "chunk_number": len(output),
                }
                output.append(DocumentChunk(id=chunk_id, text=text, metadata=metadata))
        return output

    @staticmethod
    def _load_table(document_dir: Path, node: dict[str, Any]) -> str:
        asset_path = node.get("asset_path")
        if not asset_path:
            return ""
        document_root = document_dir.resolve()
        table_path = (document_dir / str(asset_path)).resolve()
        if document_root not in table_path.parents or not table_path.is_file():
            return ""
        return table_path.read_text(encoding="utf-8", errors="replace").strip()

    @staticmethod
    def _structure_path(document_dir: Path) -> Path:
        for name in ("structure.clean.json", "structure.json"):
            candidate = document_dir / name
            if candidate.is_file():
                return candidate
        raise FileNotFoundError(f"No structure.clean.json or structure.json in {document_dir}")

    @staticmethod
    def _read_json(path: Path) -> dict[str, Any]:
        with path.open(encoding="utf-8") as handle:
            value = json.load(handle)
        if not isinstance(value, dict):
            raise ValueError(f"Expected a JSON object in {path}")
        return value
