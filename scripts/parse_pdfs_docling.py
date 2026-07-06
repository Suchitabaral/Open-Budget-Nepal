#!/usr/bin/env python3
"""Parse PDFs with Docling into document packages.

Each input PDF produces:

    <output>/<package>/
        metadata.json
        document.md
        structure.json
        pages/page_001.json
        assets/tables/
        assets/images/
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import importlib.metadata
import json
import re
import shutil
import sys
import unicodedata
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

PARSER_VERSION = "1.1"
EXPECTED_NEPALI_TERMS = (
    "लेखापरीक्षण",
    "प्रतिवेदन",
    "गाउँपालिका",
    "महालेखापरीक्षक",
    "बेरुजु",
    "आर्थिक वर्ष",
)
DEFAULT_BOILERPLATE_EXACT = {
    "of",
    "https://nams.oag.gov.np",
    "https://nams.oag.gov.n",
}
DEFAULT_BOILERPLATE_REGEX = (
    r"^page\s+\d+\s+of\s+\d+$",
    r"^\d+\s+of\s+\d+$",
    r"^https?://nams\.oag\.gov\.np/?$",
)
BOILERPLATE_FRAGMENT_REGEX = (
    re.compile(r"https?://nams\.oag\.gov\.n(?:p)?/?", re.IGNORECASE),
    re.compile(r"\bpage\s+\d+\s+of\s+\d+\b", re.IGNORECASE),
)
DEFAULT_REPEATED_HEADERS = {
    "महालेखापरीक्षकको कार्यालय",
    "Office of the Auditor General",
}
REF_COLLECTIONS = (
    "groups",
    "texts",
    "tables",
    "pictures",
    "key_value_items",
    "form_items",
)


@dataclass(frozen=True)
class RefItem:
    collection: str
    index: int
    data: dict[str, Any]


@dataclass(frozen=True)
class ParserOptions:
    generate_page_images: bool = True
    generate_picture_images: bool = True
    clean_text: bool = True
    quality_report: bool = True
    table_validation: bool = True
    min_page_quality: float = 0.7
    review_low_quality: bool = True
    ocr: str = "never"
    ocr_engine: str | None = None
    ocr_lang: str | None = None


@dataclass(frozen=True)
class BoilerplateRules:
    remove_exact: set[str]
    remove_regex: tuple[re.Pattern[str], ...]
    downrank_repeated: set[str]


def load_boilerplate_rules(path: Path | None) -> BoilerplateRules:
    exact = set(DEFAULT_BOILERPLATE_EXACT)
    regexes = list(DEFAULT_BOILERPLATE_REGEX)
    repeated = set(DEFAULT_REPEATED_HEADERS)
    if path and path.exists():
        section: str | None = None
        for raw_line in path.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#"):
                continue
            if line.endswith(":"):
                section = line[:-1]
                continue
            if not line.startswith("-"):
                continue
            value = line[1:].strip().strip("'\"")
            if not value:
                continue
            if section == "remove_exact":
                exact.add(value)
            elif section == "remove_regex":
                regexes.append(value)
            elif section == "downrank_repeated":
                repeated.add(value)
    return BoilerplateRules(
        remove_exact={normalize_spaces(value).lower() for value in exact},
        remove_regex=tuple(re.compile(pattern, re.IGNORECASE) for pattern in regexes),
        downrank_repeated={normalize_spaces(value) for value in repeated},
    )


def build_converter(options: ParserOptions) -> Any:
    """Create a Docling PDF converter with image generation enabled when possible."""
    try:
        from docling.datamodel.base_models import InputFormat
        from docling.datamodel.pipeline_options import PdfPipelineOptions, TableFormerMode
        from docling.document_converter import DocumentConverter, PdfFormatOption
    except ModuleNotFoundError as exc:
        raise SystemExit(
            "Docling is not installed. Install dependencies with:\n"
            "  python -m pip install -r requirements.txt"
        ) from exc

    pipeline_options = PdfPipelineOptions()
    if hasattr(pipeline_options, "generate_page_images"):
        pipeline_options.generate_page_images = options.generate_page_images
    if hasattr(pipeline_options, "generate_picture_images"):
        pipeline_options.generate_picture_images = options.generate_picture_images
    if hasattr(pipeline_options, "images_scale"):
        pipeline_options.images_scale = 2.0 if options.generate_page_images else 1.0
    if hasattr(pipeline_options, "do_ocr"):
        pipeline_options.do_ocr = options.ocr in {"auto", "always"}
    if hasattr(pipeline_options, "do_table_structure"):
        pipeline_options.do_table_structure = True
    table_options = getattr(pipeline_options, "table_structure_options", None)
    if table_options is not None:
        if hasattr(table_options, "mode"):
            try:
                table_options.mode = TableFormerMode.ACCURATE
            except Exception:
                table_options.mode = "accurate"
        if hasattr(table_options, "do_cell_matching"):
            table_options.do_cell_matching = True
    ocr_options = getattr(pipeline_options, "ocr_options", None)
    if ocr_options is not None:
        if options.ocr_lang and hasattr(ocr_options, "lang"):
            ocr_options.lang = [part.strip() for part in options.ocr_lang.split("+") if part.strip()]
        if hasattr(ocr_options, "force_full_page_ocr"):
            ocr_options.force_full_page_ocr = options.ocr == "always"

    return DocumentConverter(
        format_options={
            InputFormat.PDF: PdfFormatOption(pipeline_options=pipeline_options),
        }
    )


def get_docling_version() -> str | None:
    try:
        import docling
    except ModuleNotFoundError:
        return None
    try:
        package_version = importlib.metadata.version("docling")
    except importlib.metadata.PackageNotFoundError:
        package_version = None
    return getattr(docling, "__version__", None) or package_version


def json_dump(path: Path, payload: Any) -> None:
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def slugify(value: str) -> str:
    value = value.strip().replace(" ", "_")
    value = re.sub(r"[^0-9A-Za-z._-]+", "_", value)
    value = re.sub(r"_+", "_", value).strip("._-")
    return value or "document"


def sha256_file(path: Path, chunk_size: int = 1024 * 1024) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while chunk := handle.read(chunk_size):
            digest.update(chunk)
    return digest.hexdigest()


def infer_document_id(path: Path) -> str:
    suffix = hashlib.sha1(str(path).encode("utf-8")).hexdigest()[:8]
    return f"{slugify(path.stem)[:48]}_{suffix}"


def normalize_spaces(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def script_counts(text: str) -> dict[str, int]:
    counts = {
        "devanagari": 0,
        "latin": 0,
        "numeric": 0,
        "punctuation": 0,
        "cjk_other": 0,
        "control": 0,
        "other": 0,
    }
    for char in text:
        code = ord(char)
        category = unicodedata.category(char)
        if 0x0900 <= code <= 0x097F:
            counts["devanagari"] += 1
        elif char.isascii() and char.isalpha():
            counts["latin"] += 1
        elif char.isdigit() or 0x0966 <= code <= 0x096F:
            counts["numeric"] += 1
        elif category.startswith("P") or char.isspace():
            counts["punctuation"] += 1
        elif (
            0x4E00 <= code <= 0x9FFF
            or 0x3040 <= code <= 0x30FF
            or 0xAC00 <= code <= 0xD7AF
        ):
            counts["cjk_other"] += 1
        elif category.startswith("C"):
            counts["control"] += 1
        else:
            counts["other"] += 1
    return counts


def ratio(part: int, whole: int) -> float:
    return round(part / whole, 4) if whole else 0.0


def garbage_ratio(text: str) -> float:
    counts = script_counts(text)
    meaningful = sum(counts.values())
    garbage = counts["cjk_other"] + counts["control"]
    replacement = text.count("\ufffd") + text.count("\ufffe") + text.count("�")
    return ratio(garbage + replacement, meaningful + replacement)


def devanagari_ratio(text: str) -> float:
    counts = script_counts(text)
    letters = counts["devanagari"] + counts["latin"] + counts["cjk_other"] + counts["other"]
    return ratio(counts["devanagari"], letters)


def clean_text(text: str, rules: BoilerplateRules) -> tuple[str, list[str]]:
    flags: list[str] = []
    normalized = unicodedata.normalize("NFC", text or "")
    if normalized != (text or ""):
        flags.append("unicode_normalized")
    normalized = normalized.replace("\ufffe", "").replace("\ufffd", "")
    normalized = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", normalized)
    normalized = re.sub(r"\s+([,।.!?;:])", r"\1", normalized)
    normalized = re.sub(r"([०-९0-9])\s*/\s*([०-९0-9])", r"\1/\2", normalized)

    cleaned_lines: list[str] = []
    for line in normalized.splitlines():
        line = normalize_spaces(line)
        if not line:
            continue
        lowered = line.lower()
        if lowered in rules.remove_exact:
            flags.append("boilerplate_removed")
            continue
        if any(pattern.search(line) for pattern in rules.remove_regex):
            flags.append("boilerplate_removed")
            continue
        stripped_line = line
        for pattern in BOILERPLATE_FRAGMENT_REGEX:
            stripped_line = pattern.sub("", stripped_line)
        stripped_line = normalize_spaces(stripped_line)
        if stripped_line != line:
            flags.append("boilerplate_removed")
            line = stripped_line
        if not line:
            continue
        if garbage_ratio(line) > 0.35 and devanagari_ratio(line) < 0.2:
            flags.append("garbage_line_removed")
            continue
        cleaned_lines.append(line)

    return "\n".join(cleaned_lines).strip(), sorted(set(flags))


def infer_fiscal_year(*texts: str) -> str | None:
    joined = "\n".join(text for text in texts if text)
    patterns = (
        r"([०-९]{4})\s*[/।-]\s*([०-९]{2})",
        r"([0-9]{4})\s*[/.-]\s*([0-9]{2})",
    )
    for pattern in patterns:
        match = re.search(pattern, joined)
        if match:
            return f"{match.group(1)}/{match.group(2)}"
    return None


def expected_keyword_hits(text: str) -> list[str]:
    return [term for term in EXPECTED_NEPALI_TERMS if term in text]


def infer_document_type(path: Path) -> str:
    lower_parts = {part.lower() for part in path.parts}
    if "oagn" in lower_parts:
        return "Audit Report"
    return "Budget Document"


def infer_organization(path: Path) -> str:
    lower_parts = {part.lower() for part in path.parts}
    if "oagn" in lower_parts:
        return "Office of the Auditor General, Nepal"
    return "Ministry of Finance"


def normalize_bbox(bbox: Any) -> dict[str, Any] | None:
    if bbox is None:
        return None

    if not isinstance(bbox, dict):
        bbox = {
            key: getattr(bbox, key)
            for key in ("l", "t", "r", "b", "left", "top", "right", "bottom")
            if hasattr(bbox, key)
        }

    if not bbox:
        return None

    left = bbox.get("left", bbox.get("l"))
    top = bbox.get("top", bbox.get("t"))
    right = bbox.get("right", bbox.get("r"))
    bottom = bbox.get("bottom", bbox.get("b"))
    position = {
        "left": left,
        "top": top,
        "right": right,
        "bottom": bottom,
    }
    coord_origin = bbox.get("coord_origin")
    if coord_origin:
        position["coord_origin"] = coord_origin
    return {key: value for key, value in position.items() if value is not None}


def first_provenance(item: dict[str, Any]) -> dict[str, Any]:
    prov = item.get("prov") or item.get("provenance") or []
    if not prov:
        return {}
    return prov[0] or {}


def page_no(item: dict[str, Any]) -> int | None:
    prov = first_provenance(item)
    page = prov.get("page_no") or prov.get("page")
    try:
        return int(page) if page is not None else None
    except (TypeError, ValueError):
        return None


def position(item: dict[str, Any]) -> dict[str, Any] | None:
    prov = first_provenance(item)
    return normalize_bbox(prov.get("bbox") or item.get("bbox"))


def text_value(item: dict[str, Any]) -> str:
    return str(item.get("text") or item.get("orig") or "").strip()


def label_value(item: dict[str, Any]) -> str:
    return str(item.get("label") or item.get("name") or "").lower()


def heading_level(item: dict[str, Any], default: int = 1) -> int:
    try:
        level = int(item.get("level") or default)
    except (TypeError, ValueError):
        level = default
    return min(max(level, 1), 6)


def element_type(collection: str, item: dict[str, Any]) -> str:
    label = label_value(item)
    if collection == "tables" or label == "table":
        return "table"
    if collection == "pictures" or label in {"picture", "image"}:
        return "image"
    if collection == "groups":
        if "chapter" in label:
            return "chapter"
        if "appendix" in label:
            return "appendix"
        return "section"
    if label in {"title", "document_title"}:
        return "heading"
    if "section_header" in label or label in {"heading", "header"}:
        return "heading"
    if "list" in label:
        return "list_item"
    return "paragraph"


def table_data_to_markdown(data: dict[str, Any] | None) -> str:
    if not data:
        return ""

    rows = data.get("num_rows") or data.get("row_count") or 0
    cols = data.get("num_cols") or data.get("col_count") or 0
    cells = data.get("table_cells") or data.get("cells") or []

    for cell in cells:
        rows = max(rows, int(cell.get("end_row_offset_idx", 0) or 0))
        cols = max(cols, int(cell.get("end_col_offset_idx", 0) or 0))

    if not rows or not cols:
        return ""

    matrix = [["" for _ in range(cols)] for _ in range(rows)]
    for cell in cells:
        row = int(cell.get("start_row_offset_idx", cell.get("row", 0)) or 0)
        col = int(cell.get("start_col_offset_idx", cell.get("col", 0)) or 0)
        if 0 <= row < rows and 0 <= col < cols:
            matrix[row][col] = str(cell.get("text") or "").replace("\n", " ").strip()

    header = matrix[0]
    separator = ["---"] * cols
    body = matrix[1:] if rows > 1 else []

    def line(values: list[str]) -> str:
        return "| " + " | ".join(value.replace("|", "\\|") for value in values) + " |"

    return "\n".join([line(header), line(separator), *(line(row) for row in body)])


class DocumentPackageWriter:
    def __init__(
        self,
        pdf_path: Path,
        output_root: Path,
        document: Any,
        doc_dict: dict[str, Any],
        metadata_overrides: dict[str, str | None],
        options: ParserOptions,
        boilerplate_rules: BoilerplateRules,
        overwrite: bool,
    ) -> None:
        self.pdf_path = pdf_path
        self.document = document
        self.doc_dict = doc_dict
        self.options = options
        self.boilerplate_rules = boilerplate_rules
        self.document_id = metadata_overrides.get("document_id") or infer_document_id(pdf_path)
        self.package_dir = output_root / slugify(self.document_id)
        self.pages_dir = self.package_dir / "pages"
        self.tables_dir = self.package_dir / "assets" / "tables"
        self.images_dir = self.package_dir / "assets" / "images"
        self.page_images_dir = self.package_dir / "assets" / "page_images"
        self.quality_dir = self.package_dir / "quality"
        self.metadata_overrides = metadata_overrides
        self.overwrite = overwrite
        self.ref_map = self._build_ref_map()
        self.counters: defaultdict[str, int] = defaultdict(int)
        self.nodes: list[dict[str, Any]] = []
        self.page_elements: defaultdict[int, list[dict[str, Any]]] = defaultdict(list)
        self.page_raw_text: defaultdict[int, list[str]] = defaultdict(list)
        self.page_clean_text: defaultdict[int, list[str]] = defaultdict(list)
        self.page_quality: list[dict[str, Any]] = []
        self.table_quality: list[dict[str, Any]] = []
        self.manual_review: list[dict[str, Any]] = []
        self.page_image_paths: dict[int, str] = {}
        self.heading_stack: dict[int, str] = {}

    def write(self) -> Path:
        if self.package_dir.exists() and self.overwrite:
            shutil.rmtree(self.package_dir)
        if self.package_dir.exists():
            raise FileExistsError(
                f"{self.package_dir} already exists. Use --overwrite to replace it."
            )

        self.pages_dir.mkdir(parents=True, exist_ok=True)
        self.tables_dir.mkdir(parents=True, exist_ok=True)
        self.images_dir.mkdir(parents=True, exist_ok=True)
        self.page_images_dir.mkdir(parents=True, exist_ok=True)
        self.quality_dir.mkdir(parents=True, exist_ok=True)

        self._write_markdown()
        self._write_page_images()
        self._build_structure()
        self._score_pages()
        self._write_pages()
        self._write_structure()
        self._write_metadata()
        self._write_quality_reports()
        return self.package_dir

    def _build_ref_map(self) -> dict[str, RefItem]:
        refs: dict[str, RefItem] = {}
        for collection in REF_COLLECTIONS:
            values = self.doc_dict.get(collection) or []
            if not isinstance(values, list):
                continue
            for index, item in enumerate(values):
                if not isinstance(item, dict):
                    continue
                ref = item.get("self_ref") or f"#/{collection}/{index}"
                refs[ref] = RefItem(collection=collection, index=index, data=item)
        return refs

    def _next_id(self, kind: str) -> str:
        prefix = {
            "chapter": "ch",
            "section": "sec",
            "appendix": "app",
            "heading": "heading",
            "paragraph": "para",
            "list_item": "list",
            "table": "tbl",
            "image": "img",
            "office_header": "office",
            "footer": "footer",
            "noise": "noise",
            "table_title": "tbl_title",
        }.get(kind, kind)
        self.counters[prefix] += 1
        return f"{prefix}_{self.counters[prefix]}"

    def _write_markdown(self) -> None:
        markdown = ""
        if hasattr(self.document, "export_to_markdown"):
            markdown = self.document.export_to_markdown()
        clean_markdown = markdown
        if self.options.clean_text:
            clean_markdown, _ = clean_text(markdown, self.boilerplate_rules)
        (self.package_dir / "document.raw.md").write_text(markdown, encoding="utf-8")
        (self.package_dir / "document.clean.md").write_text(clean_markdown, encoding="utf-8")
        (self.package_dir / "document.md").write_text(clean_markdown, encoding="utf-8")

    def _write_page_images(self) -> None:
        if not self.options.generate_page_images:
            return
        pages = getattr(self.document, "pages", None)
        if not pages:
            return
        page_items = pages.items() if isinstance(pages, dict) else enumerate(pages, start=1)
        for page_no_value, page_obj in page_items:
            try:
                page = int(page_no_value)
            except (TypeError, ValueError):
                page = len(self.page_image_paths) + 1
            image = None
            get_image = getattr(page_obj, "get_image", None)
            if get_image is not None:
                for args in ((self.document,), ()):
                    try:
                        image = get_image(*args)
                        break
                    except TypeError:
                        continue
            if image is None:
                image_container = getattr(page_obj, "image", None)
                image = getattr(image_container, "pil_image", None) or image_container
            if image is None or not hasattr(image, "save"):
                continue
            asset_path = f"assets/page_images/page_{page:03d}.png"
            image.save(self.package_dir / asset_path)
            self.page_image_paths[page] = asset_path

    def _build_structure(self) -> None:
        root = {
            "id": self.document_id,
            "parent": None,
            "page": None,
            "type": "document",
            "position": None,
            "title": self.metadata_overrides.get("document_name") or self.pdf_path.stem,
        }
        self.nodes.append(root)

        body = self.doc_dict.get("body") or {}
        children = body.get("children") or []
        for child in children:
            self._walk_child(child, self.document_id)

    def _walk_child(self, child: Any, fallback_parent: str) -> None:
        if isinstance(child, dict) and "$ref" in child:
            ref_item = self.ref_map.get(child["$ref"])
            if ref_item is not None:
                self._add_ref_item(ref_item, fallback_parent)
            return

        if isinstance(child, dict):
            inline_item = dict(child)
            children = inline_item.pop("children", []) or []
            ref_item = RefItem(
                collection="groups",
                index=-1,
                data=inline_item,
            )
            parent_id = self._add_ref_item(ref_item, fallback_parent)
            for grandchild in children:
                self._walk_child(grandchild, parent_id)

    def _add_ref_item(self, ref_item: RefItem, fallback_parent: str) -> str:
        item_type = element_type(ref_item.collection, ref_item.data)
        raw_text = text_value(ref_item.data)
        if self.options.clean_text:
            text_clean, cleanup_flags = clean_text(raw_text, self.boilerplate_rules)
        else:
            text_clean, cleanup_flags = raw_text, []
        item_type = self._refined_element_type(item_type, raw_text, text_clean, ref_item.data)
        element_id = self._next_id(item_type)

        if item_type == "heading":
            level = heading_level(ref_item.data)
            parent_id = self._nearest_heading_parent(level) or fallback_parent
        elif item_type in {"chapter", "section", "appendix"}:
            level = heading_level(ref_item.data)
            parent_id = fallback_parent
        else:
            parent_id = self._current_heading_parent() or fallback_parent

        page = page_no(ref_item.data)
        node = {
            "id": element_id,
            "parent": parent_id,
            "page": page,
            "type": item_type,
            "position": position(ref_item.data),
            "source": "docling",
            "quality_flags": cleanup_flags,
        }

        if item_type == "heading":
            level = heading_level(ref_item.data)
            node["level"] = level
            node["text_raw"] = raw_text
            node["text_clean"] = text_clean
            node["text"] = text_clean
            self.heading_stack = {
                known_level: known_id
                for known_level, known_id in self.heading_stack.items()
                if known_level < level
            }
            self.heading_stack[level] = element_id
        elif item_type in {"paragraph", "list_item", "chapter", "section", "appendix"}:
            node["text_raw"] = raw_text
            node["text_clean"] = text_clean
            node["text"] = text_clean
        elif item_type in {"office_header", "footer", "noise", "table_title"}:
            node["text_raw"] = raw_text
            node["text_clean"] = text_clean
            node["text"] = text_clean
        elif item_type == "table":
            table_markdown = self._table_markdown(ref_item)
            asset_path = f"assets/tables/{element_id}.md"
            (self.package_dir / asset_path).write_text(table_markdown, encoding="utf-8")
            json_dump(self.package_dir / f"assets/tables/{element_id}.raw.json", ref_item.data)
            self._write_table_csv(ref_item, element_id)
            table_quality = (
                self._table_quality(ref_item, element_id, page)
                if self.options.table_validation
                else {
                    "table_id": element_id,
                    "page": page,
                    "rows": None,
                    "cols": None,
                    "empty_cell_ratio": None,
                    "numeric_merge_suspected": None,
                    "quality": "unvalidated",
                    "flags": ["table_validation_disabled"],
                }
            )
            self.table_quality.append(table_quality)
            node["asset_path"] = asset_path
            node["quality"] = table_quality["quality"]
            node["quality_flags"] = table_quality["flags"]
        elif item_type == "image":
            asset_path = self._write_image(ref_item, element_id)
            if asset_path:
                node["asset_path"] = asset_path
            if text_clean:
                node["text_raw"] = raw_text
                node["text_clean"] = text_clean
                node["text"] = text_clean

        node["quality_score"] = self._element_quality_score(node)
        node["indexable"] = self._is_indexable(node)
        node["index_weight"] = self._index_weight(node)

        self.nodes.append(node)

        if page is not None and item_type != "document":
            page_element = self._page_element(node, ref_item)
            self.page_elements[page].append(page_element)
            if raw_text:
                self.page_raw_text[page].append(raw_text)
            if text_clean:
                self.page_clean_text[page].append(text_clean)

        children = ref_item.data.get("children") or []
        for child in children:
            self._walk_child(child, element_id)

        return element_id

    def _refined_element_type(
        self,
        item_type: str,
        raw_text: str,
        text_clean: str,
        item: dict[str, Any],
    ) -> str:
        text = normalize_spaces(text_clean or raw_text)
        lowered = text.lower()
        if not text:
            return "noise" if item_type in {"heading", "paragraph", "list_item"} else item_type
        if lowered in self.boilerplate_rules.remove_exact:
            return "footer"
        if any(pattern.search(text) for pattern in self.boilerplate_rules.remove_regex):
            return "footer"
        if any(header.lower() == lowered for header in self.boilerplate_rules.downrank_repeated):
            return "office_header"
        if garbage_ratio(text) > 0.35 and devanagari_ratio(text) < 0.2:
            return "noise"
        if item_type == "heading" and not self._looks_like_heading(text, item):
            return "paragraph"
        if item_type == "paragraph" and re.search(r"तालिका|विवरण|अनुसूची", text):
            return "table_title"
        return item_type

    def _looks_like_heading(self, text: str, item: dict[str, Any]) -> bool:
        if len(text) < 3 or text.lower() in {"of", "s83"}:
            return False
        if len(text) > 160:
            return False
        if re.match(r"^[०-९0-9]+[.)।]\s+\S+", text):
            return True
        if any(keyword in text for keyword in ("दफा", "परिचय", "निष्कर्ष", "लेखापरीक्षण", "प्रतिवेदन")):
            return True
        label = label_value(item)
        return label in {"title", "document_title", "section_header", "heading", "header"}

    def _nearest_heading_parent(self, level: int) -> str | None:
        lower_levels = [known_level for known_level in self.heading_stack if known_level < level]
        if not lower_levels:
            return None
        return self.heading_stack[max(lower_levels)]

    def _current_heading_parent(self) -> str | None:
        if not self.heading_stack:
            return None
        return self.heading_stack[max(self.heading_stack)]

    def _page_element(self, node: dict[str, Any], ref_item: RefItem) -> dict[str, Any]:
        element = {
            "id": node["id"],
            "type": node["type"],
        }
        if "level" in node:
            element["level"] = node["level"]
        if "text" in node:
            element["text"] = node["text"]
        for key in ("text_raw", "text_clean", "source", "quality_score", "quality_flags", "indexable", "index_weight"):
            if key in node:
                element[key] = node[key]
        if node["type"] == "table":
            markdown = self._table_markdown(ref_item)
            element["markdown"] = markdown
            element["asset_path"] = node.get("asset_path")
            element["quality"] = node.get("quality")
        if node["type"] == "image" and node.get("asset_path"):
            element["asset_path"] = node["asset_path"]
        if node.get("position") is not None:
            element["position"] = node["position"]
        return element

    def _table_markdown(self, ref_item: RefItem) -> str:
        table_obj = self._typed_object(ref_item)
        if table_obj is not None:
            for method_name in ("export_to_markdown", "to_markdown"):
                method = getattr(table_obj, method_name, None)
                if method is None:
                    continue
                for args in ((self.document,), ()):
                    try:
                        markdown = method(*args)
                    except TypeError:
                        continue
                    if markdown:
                        return str(markdown)

            dataframe_method = getattr(table_obj, "export_to_dataframe", None)
            if dataframe_method is not None:
                call_variants = (
                    ((), {}),
                    ((self.document,), {}),
                    ((), {"doc": self.document}),
                )
                for args, kwargs in call_variants:
                    try:
                        dataframe = dataframe_method(*args, **kwargs)
                    except TypeError:
                        continue
                    try:
                        return dataframe.to_markdown(index=False)
                    except Exception:
                        pass

        return table_data_to_markdown(ref_item.data.get("data"))

    def _write_table_csv(self, ref_item: RefItem, element_id: str) -> str | None:
        data = ref_item.data.get("data") or {}
        rows = data.get("num_rows") or data.get("row_count") or 0
        cols = data.get("num_cols") or data.get("col_count") or 0
        cells = data.get("table_cells") or data.get("cells") or []
        for cell in cells:
            rows = max(rows, int(cell.get("end_row_offset_idx", 0) or 0))
            cols = max(cols, int(cell.get("end_col_offset_idx", 0) or 0))
        if not rows or not cols:
            return None
        matrix = [["" for _ in range(cols)] for _ in range(rows)]
        for cell in cells:
            row = int(cell.get("start_row_offset_idx", cell.get("row", 0)) or 0)
            col = int(cell.get("start_col_offset_idx", cell.get("col", 0)) or 0)
            if 0 <= row < rows and 0 <= col < cols:
                matrix[row][col] = str(cell.get("text") or "").replace("\n", " ").strip()
        asset_path = f"assets/tables/{element_id}.csv"
        with (self.package_dir / asset_path).open("w", encoding="utf-8", newline="") as handle:
            writer = csv.writer(handle)
            writer.writerows(matrix)
        return asset_path

    def _table_quality(self, ref_item: RefItem, element_id: str, page: int | None) -> dict[str, Any]:
        data = ref_item.data.get("data") or {}
        rows = int(data.get("num_rows") or data.get("row_count") or 0)
        cols = int(data.get("num_cols") or data.get("col_count") or 0)
        cells = data.get("table_cells") or data.get("cells") or []
        for cell in cells:
            rows = max(rows, int(cell.get("end_row_offset_idx", 0) or 0))
            cols = max(cols, int(cell.get("end_col_offset_idx", 0) or 0))
        total_cells = rows * cols
        empty_cells = sum(1 for cell in cells if not normalize_spaces(str(cell.get("text") or "")))
        numeric_merge = any(re.search(r"\d+[,.]\d+.*\d+[,.]\d+", str(cell.get("text") or "")) for cell in cells)
        empty_ratio = ratio(empty_cells, total_cells)
        flags: list[str] = []
        if not rows or not cols:
            flags.append("missing_table_geometry")
        if empty_ratio > 0.35:
            flags.append("high_empty_cell_ratio")
        if numeric_merge:
            flags.append("numeric_merge_suspected")
        quality = "high"
        if flags:
            quality = "low" if len(flags) > 1 or "missing_table_geometry" in flags else "medium"
        if quality == "low" and page is not None and self.options.review_low_quality:
            self.manual_review.append(
                {
                    "page": page,
                    "reason": f"Table {element_id} quality is low: {', '.join(flags)}",
                }
            )
        return {
            "table_id": element_id,
            "page": page,
            "rows": rows,
            "cols": cols,
            "empty_cell_ratio": empty_ratio,
            "numeric_merge_suspected": numeric_merge,
            "quality": quality,
            "flags": flags,
        }

    def _typed_object(self, ref_item: RefItem) -> Any | None:
        values = getattr(self.document, ref_item.collection, None)
        if values is None or ref_item.index < 0:
            return None
        try:
            return values[ref_item.index]
        except (IndexError, TypeError):
            return None

    def _write_image(self, ref_item: RefItem, element_id: str) -> str | None:
        picture_obj = self._typed_object(ref_item)
        if picture_obj is None:
            return None

        image = None
        get_image = getattr(picture_obj, "get_image", None)
        if get_image is not None:
            for args in ((self.document,), ()):
                try:
                    image = get_image(*args)
                    break
                except TypeError:
                    continue

        if image is None:
            image_container = getattr(picture_obj, "image", None)
            image = getattr(image_container, "pil_image", None) or image_container

        if image is None or not hasattr(image, "save"):
            return None

        asset_path = f"assets/images/{element_id}.png"
        image.save(self.package_dir / asset_path)
        return asset_path

    def _write_pages(self) -> None:
        total_pages = self._page_count()
        pages_to_write = range(1, total_pages + 1) if total_pages else sorted(self.page_elements)
        for page in pages_to_write:
            elements = self.page_elements.get(page, [])
            raw_payload = {
                "page": page,
                "page_image": self.page_image_paths.get(page),
                "text_docling_raw": "\n".join(self.page_raw_text.get(page, [])),
                "elements": elements,
            }
            clean_payload = {
                "page": page,
                "page_image": self.page_image_paths.get(page),
                "text_docling_raw": raw_payload["text_docling_raw"],
                "text_ocr_raw": None,
                "text_clean": "\n".join(self.page_clean_text.get(page, [])),
                "selected_source": "docling",
                "quality": self._page_quality_by_page(page),
                "elements": elements,
            }
            json_dump(self.pages_dir / f"page_{page:03d}.raw.json", raw_payload)
            json_dump(self.pages_dir / f"page_{page:03d}.clean.json", clean_payload)
            json_dump(self.pages_dir / f"page_{page:03d}.json", clean_payload)

    def _write_structure(self) -> None:
        payload = {
            "document_id": self.document_id,
            "nodes": self.nodes,
        }
        json_dump(self.package_dir / "structure.raw.json", payload)
        json_dump(self.package_dir / "structure.clean.json", payload)
        json_dump(self.package_dir / "structure.json", payload)

    def _write_metadata(self) -> None:
        overrides = self.metadata_overrides
        metadata = {
            "document_id": self.document_id,
            "document_name": overrides.get("document_name") or self.pdf_path.stem,
            "organization": overrides.get("organization") or infer_organization(self.pdf_path),
            "document_type": overrides.get("document_type") or infer_document_type(self.pdf_path),
            "language": overrides.get("language") or "mixed",
            "fiscal_year": overrides.get("fiscal_year") or infer_fiscal_year(
                self.pdf_path.stem,
                (self.package_dir / "document.clean.md").read_text(encoding="utf-8")
                if (self.package_dir / "document.clean.md").exists()
                else "",
            ),
            "pages": self._page_count(),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "parser_version": PARSER_VERSION,
            "docling_version": get_docling_version(),
            "source_pdf": str(self.pdf_path),
            "source_sha256": sha256_file(self.pdf_path),
        }
        json_dump(self.package_dir / "metadata.json", metadata)

    def _page_count(self) -> int:
        pages = self.doc_dict.get("pages")
        if isinstance(pages, dict):
            return len(pages)
        if isinstance(pages, list):
            return len(pages)
        origin = self.doc_dict.get("origin") or {}
        try:
            return int(origin.get("page_count") or origin.get("pages") or 0)
        except (TypeError, ValueError):
            return 0

    def _element_quality_score(self, node: dict[str, Any]) -> float:
        text = node.get("text_clean") or node.get("text") or ""
        if node["type"] in {"table", "image"}:
            return 0.8
        if node["type"] in {"footer", "noise"}:
            return 0.0
        if not text:
            return 0.0
        score = 1.0
        score -= garbage_ratio(text) * 1.5
        if devanagari_ratio(text) < 0.15 and any(term in text for term in EXPECTED_NEPALI_TERMS):
            score -= 0.2
        if expected_keyword_hits(text):
            score += 0.1
        return round(min(max(score, 0.0), 1.0), 3)

    def _is_indexable(self, node: dict[str, Any]) -> bool:
        if node["type"] in {"footer", "noise", "office_header"}:
            return False
        if node["type"] == "table":
            return node.get("quality") != "low"
        return bool(node.get("text_clean") or node.get("text") or node.get("asset_path"))

    def _index_weight(self, node: dict[str, Any]) -> float:
        if not self._is_indexable(node):
            return 0.0
        if node["type"] == "table":
            return 1.0 if node.get("quality") == "high" else 0.5
        if node["type"] in {"heading", "chapter", "section"}:
            return 0.9
        if node["type"] == "image":
            return 0.4
        return round(0.3 + (node.get("quality_score", 0.5) * 0.6), 3)

    def _score_pages(self) -> None:
        total_pages = self._page_count()
        pages_to_score = range(1, total_pages + 1) if total_pages else sorted(self.page_elements)
        seen_hashes: dict[str, int] = {}
        for page in pages_to_score:
            raw_text = "\n".join(self.page_raw_text.get(page, []))
            clean_page_text = "\n".join(self.page_clean_text.get(page, []))
            counts = script_counts(raw_text)
            text_chars = len(normalize_spaces(raw_text))
            clean_chars = len(normalize_spaces(clean_page_text))
            page_tables = [item for item in self.page_elements.get(page, []) if item["type"] == "table"]
            page_images = [item for item in self.page_elements.get(page, []) if item["type"] == "image"]
            has_visual = bool(page_images or self.page_image_paths.get(page))
            normalized_hash = hashlib.sha1(normalize_spaces(clean_page_text).encode("utf-8")).hexdigest()
            duplicate_of = seen_hashes.get(normalized_hash) if clean_page_text else None
            if clean_page_text and normalized_hash not in seen_hashes:
                seen_hashes[normalized_hash] = page
            flags: list[str] = []
            if text_chars < 200 and has_visual:
                flags.append("little_text_with_visual_content")
            if text_chars < 80 and clean_chars == 0:
                flags.append("footer_only_or_empty_text")
            if devanagari_ratio(raw_text) < 0.30 and text_chars > 80:
                flags.append("low_devanagari_ratio")
            if garbage_ratio(raw_text) > 0.12:
                flags.append("high_garbage_ratio")
            if duplicate_of:
                flags.append("duplicate_text")
            if page_tables:
                flags.append("table_page")
            recommended = "accept"
            if (
                "little_text_with_visual_content" in flags
                or "footer_only_or_empty_text" in flags
                or "high_garbage_ratio" in flags
            ):
                recommended = "full_page_ocr" if self.options.ocr != "never" else "manual_review"
            elif "table_page" in flags:
                recommended = "validate_tables"
            score = 1.0
            score -= 0.35 if "little_text_with_visual_content" in flags else 0.0
            score -= 0.45 if "footer_only_or_empty_text" in flags else 0.0
            score -= 0.25 if "low_devanagari_ratio" in flags else 0.0
            score -= min(0.4, garbage_ratio(raw_text) * 2)
            score -= 0.1 if "duplicate_text" in flags else 0.0
            score = round(min(max(score, 0.0), 1.0), 3)
            payload = {
                "page": page,
                "text_chars": text_chars,
                "clean_text_chars": clean_chars,
                "devanagari_ratio": devanagari_ratio(raw_text),
                "garbage_ratio": garbage_ratio(raw_text),
                "script_counts": counts,
                "has_page_image": page in self.page_image_paths,
                "has_visual_content": has_visual,
                "likely_scanned": text_chars < 200 and has_visual,
                "table_count": len(page_tables),
                "duplicate_of": duplicate_of,
                "quality_score": score,
                "flags": flags,
                "recommended_action": recommended,
            }
            self.page_quality.append(payload)
            if score < self.options.min_page_quality and self.options.review_low_quality:
                self.manual_review.append(
                    {
                        "page": page,
                        "reason": f"Page quality {score} below threshold {self.options.min_page_quality}",
                    }
                )

    def _page_quality_by_page(self, page: int) -> dict[str, Any] | None:
        for item in self.page_quality:
            if item["page"] == page:
                return item
        return None

    def _write_quality_reports(self) -> None:
        if not self.options.quality_report:
            return
        bad_pages = [
            item["page"]
            for item in self.page_quality
            if item["quality_score"] < self.options.min_page_quality
        ]
        table_pages = sorted({item["page"] for item in self.table_quality if item["page"] is not None})
        ocr_pages = [
            item["page"]
            for item in self.page_quality
            if item["recommended_action"] == "full_page_ocr"
        ]
        low_tables = [item for item in self.table_quality if item["quality"] == "low"]
        average_quality = (
            sum(item["quality_score"] for item in self.page_quality) / len(self.page_quality)
            if self.page_quality
            else 0.0
        )
        overall_quality = "high"
        if average_quality < 0.55:
            overall_quality = "low"
        elif average_quality < 0.75:
            overall_quality = "medium"
        report = {
            "document_id": self.document_id,
            "pages": self._page_count(),
            "average_page_quality": round(average_quality, 3),
            "overall_quality": overall_quality,
            "bad_pages": bad_pages,
            "ocr_pages": ocr_pages,
            "table_pages": table_pages,
            "low_quality_tables": [item["table_id"] for item in low_tables],
            "manual_review_required": self.manual_review,
            "critical_warnings": self._critical_warnings(bad_pages, low_tables),
        }
        json_dump(self.quality_dir / "page_quality.json", self.page_quality)
        json_dump(self.quality_dir / "table_quality.json", self.table_quality)
        json_dump(self.quality_dir / "manual_review_queue.json", {"manual_review_required": self.manual_review})
        json_dump(self.quality_dir / "quality_report.json", report)
        (self.quality_dir / "quality_report.md").write_text(
            self._quality_markdown(report),
            encoding="utf-8",
        )
        self._write_page_qa_files()

    def _critical_warnings(self, bad_pages: list[int], low_tables: list[dict[str, Any]]) -> list[str]:
        warnings: list[str] = []
        if bad_pages:
            warnings.append(f"{len(bad_pages)} page(s) are below the quality threshold.")
        if low_tables:
            warnings.append(f"{len(low_tables)} table(s) are marked low quality.")
        if any(item["garbage_ratio"] > 0.12 for item in self.page_quality):
            warnings.append("Unicode/script corruption detected in extracted text.")
        if any(item["recommended_action"] == "full_page_ocr" for item in self.page_quality):
            warnings.append("Some pages should be repaired with full-page OCR.")
        return warnings

    def _quality_markdown(self, report: dict[str, Any]) -> str:
        lines = [
            "# Parse Quality Report",
            "",
            "## Summary",
            f"Overall quality: {report['overall_quality']}",
            f"Average page quality: {report['average_page_quality']}",
            "",
            "## Bad pages",
        ]
        if report["bad_pages"]:
            for page in report["bad_pages"]:
                quality = self._page_quality_by_page(page) or {}
                lines.append(f"- Page {page}: {', '.join(quality.get('flags') or ['low quality'])}")
        else:
            lines.append("- None")
        lines.extend(["", "## Recommended actions"])
        if report["manual_review_required"]:
            for item in report["manual_review_required"]:
                lines.append(f"- Page {item['page']}: {item['reason']}")
        else:
            lines.append("- None")
        return "\n".join(lines) + "\n"

    def _write_page_qa_files(self) -> None:
        page_quality_dir = self.quality_dir / "pages"
        page_quality_dir.mkdir(exist_ok=True)
        for item in self.page_quality:
            page = item["page"]
            lines = [f"# Page {page} QA", ""]
            image_path = self.page_image_paths.get(page)
            if image_path:
                rel_path = Path("..") / ".." / image_path
                lines.extend(["## Rendered page", f"![page]({rel_path.as_posix()})", ""])
            lines.extend(
                [
                    "## Extracted text",
                    "",
                    "```text",
                    "\n".join(self.page_clean_text.get(page, []))[:4000],
                    "```",
                    "",
                    "## Flags",
                ]
            )
            flags = item.get("flags") or []
            lines.extend([f"- {flag}" for flag in flags] or ["- None"])
            (page_quality_dir / f"page_{page:03d}_qa.md").write_text(
                "\n".join(lines) + "\n",
                encoding="utf-8",
            )


def convert_pdf(
    converter: Any,
    pdf_path: Path,
    output_root: Path,
    metadata_overrides: dict[str, str | None],
    options: ParserOptions,
    boilerplate_rules: BoilerplateRules,
    overwrite: bool,
) -> Path:
    print(f"  starting Docling conversion: {pdf_path}", flush=True)
    result = converter.convert(pdf_path)
    print("  Docling conversion finished; exporting document dict", flush=True)
    document = result.document
    if not hasattr(document, "export_to_dict"):
        raise RuntimeError("Docling document object does not expose export_to_dict().")
    doc_dict = document.export_to_dict()

    print("  writing package files", flush=True)

    writer = DocumentPackageWriter(
        pdf_path=pdf_path,
        output_root=output_root,
        document=document,
        doc_dict=doc_dict,
        metadata_overrides=metadata_overrides,
        options=options,
        boilerplate_rules=boilerplate_rules,
        overwrite=overwrite,
    )
    return writer.write()


def discover_pdfs(input_dir: Path, pattern: str) -> list[Path]:
    return sorted(path for path in input_dir.glob(pattern) if path.is_file())


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Parse PDFs in data/ with Docling and write document packages.",
    )
    parser.add_argument(
        "--input-dir",
        type=Path,
        default=Path("data"),
        help="Directory to search for PDFs. Default: data",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("parsed_documents"),
        help="Directory for generated document packages. Default: parsed_documents",
    )
    parser.add_argument(
        "--pattern",
        default="**/*.pdf",
        help="Glob pattern under input-dir. Default: **/*.pdf",
    )
    parser.add_argument("--limit", type=int, help="Parse only the first N PDFs.")
    parser.add_argument("--overwrite", action="store_true", help="Replace existing packages.")
    parser.add_argument("--document-id", help="Document ID to use when parsing a single PDF.")
    parser.add_argument("--document-name", help="Document name metadata override.")
    parser.add_argument("--organization", help="Organization metadata override.")
    parser.add_argument("--document-type", help="Document type metadata override.")
    parser.add_argument("--language", default="mixed", help="Language metadata. Default: mixed")
    parser.add_argument("--fiscal-year", help="Fiscal year metadata, e.g. 2083/84.")
    parser.add_argument(
        "--ocr",
        choices=("auto", "always", "never"),
        default="never",
        help="OCR mode. Default: never. Use auto/always for scanned pages after OCR dependencies are ready.",
    )
    parser.add_argument(
        "--ocr-engine",
        help="OCR backend hint for metadata/reporting. Configure Docling dependencies separately.",
    )
    parser.add_argument(
        "--ocr-lang",
        default="nep+eng",
        help="OCR language hint, e.g. nep+eng or script/Devanagari+eng. Default: nep+eng",
    )
    parser.add_argument(
        "--generate-page-images",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="Render page images into assets/page_images. Default: enabled.",
    )
    parser.add_argument(
        "--generate-picture-images",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="Extract document picture assets when Docling exposes them. Default: enabled.",
    )
    parser.add_argument(
        "--quality-report",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="Write quality report artifacts. Default: enabled.",
    )
    parser.add_argument(
        "--min-page-quality",
        type=float,
        default=0.70,
        help="Pages below this synthetic score enter review. Default: 0.70",
    )
    parser.add_argument(
        "--table-validation",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="Validate table geometry and write table quality artifacts. Default: enabled.",
    )
    parser.add_argument(
        "--clean-text",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="Write cleaned Markdown/page/structure text alongside raw extraction. Default: enabled.",
    )
    parser.add_argument(
        "--review-low-quality",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="Add low-quality pages/tables to the manual review queue. Default: enabled.",
    )
    parser.add_argument(
        "--boilerplate-rules",
        type=Path,
        default=Path("cleaning/boilerplate_rules.yaml"),
        help="YAML-like boilerplate rules file. Default: cleaning/boilerplate_rules.yaml",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    input_dir = args.input_dir.resolve()
    output_dir = args.output_dir.resolve()

    pdfs = discover_pdfs(input_dir, args.pattern)
    if args.limit is not None:
        pdfs = pdfs[: args.limit]

    if not pdfs:
        print(f"No PDFs found in {input_dir} with pattern {args.pattern}", file=sys.stderr)
        return 1

    if args.document_id and len(pdfs) != 1:
        print("--document-id can only be used when exactly one PDF is selected.", file=sys.stderr)
        return 1

    output_dir.mkdir(parents=True, exist_ok=True)
    parser_options = ParserOptions(
        generate_page_images=args.generate_page_images,
        generate_picture_images=args.generate_picture_images,
        clean_text=args.clean_text,
        quality_report=args.quality_report,
        table_validation=args.table_validation,
        min_page_quality=args.min_page_quality,
        review_low_quality=args.review_low_quality,
        ocr=args.ocr,
        ocr_engine=args.ocr_engine,
        ocr_lang=args.ocr_lang,
    )
    boilerplate_rules = load_boilerplate_rules(args.boilerplate_rules)
    converter = build_converter(parser_options)
    metadata_overrides = {
        "document_id": args.document_id,
        "document_name": args.document_name,
        "organization": args.organization,
        "document_type": args.document_type,
        "language": args.language,
        "fiscal_year": args.fiscal_year,
    }

    print(f"Found {len(pdfs)} PDF(s). Writing packages to {output_dir}")
    failures = 0
    for index, pdf_path in enumerate(pdfs, start=1):
        print(f"[{index}/{len(pdfs)}] Parsing {pdf_path}")
        try:
            package_dir = convert_pdf(
                converter=converter,
                pdf_path=pdf_path,
                output_root=output_dir,
                metadata_overrides=metadata_overrides,
                options=parser_options,
                boilerplate_rules=boilerplate_rules,
                overwrite=args.overwrite,
            )
        except Exception as exc:
            failures += 1
            print(f"  failed: {exc}", file=sys.stderr)
            continue
        print(f"  wrote {package_dir}")

    if failures:
        print(f"Completed with {failures} failure(s).", file=sys.stderr)
        return 2
    print("Done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
