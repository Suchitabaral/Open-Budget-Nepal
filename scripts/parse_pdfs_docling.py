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
import gc
import hashlib
import io
import importlib.metadata
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import threading
import traceback
import unicodedata
from bisect import bisect_right
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from dotenv import load_dotenv
from tqdm import tqdm

PARSER_VERSION = "1.5"
OCR_INT_STRING_DIGIT_LIMIT = 20_000
LATIN_OCR_ALLOWLIST = {
    "API",
    "GPS",
    "NAMS",
    "PAN",
    "RTO",
    "SUTRA",
    "URL",
    "VAT",
}
NEPALI_OCR_CORRECTIONS = {
    "आवोजना": "आयोजना",
    "उत्यानशील": "उत्थानशील",
    "कार्बालय": "कार्यालय",
    "कार्ालय": "कार्यालय",
    "कार्षालव": "कार्यालय",
    "कार्षालष": "कार्यालय",
    "कार्यालयव": "कार्यालय",
    "कन्टिनजन्छी": "कन्टिन्जेन्सी",
    "केफिबत": "कैफियत",
    "नहाशाखा": "महाशाखा",
    "बातावरण": "वातावरण",
    "बडा": "वडा",
}
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
    ocr: str = "always"
    ocr_engine: str | None = "TesseractCliOcrOptions"
    ocr_lang: str | None = "nep+eng"
    tesseract_prefix: str | None = None
    ocr_fallback: bool = True
    tesseract_cmd: str = "tesseract"
    ocr_fallback_psm: int = 6
    ocr_fallback_timeout: int = 120
    show_progress: bool = True
    prefer_devanagari: bool = True
    grid_table_ocr: bool = True
    table_ocr_psm: int = 6
    table_ocr_timeout: int = 120


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
        from docling.datamodel.pipeline_options import (
            PdfPipelineOptions,
            TableFormerMode,
            TesseractCliOcrOptions,
            TesseractOcrOptions,
        )
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

    # Configure OCR with TesseractOcrOptions when OCR is enabled
    if options.ocr in {"auto", "always"}:
        ocr_langs = parse_ocr_langs(options.ocr_lang)
        force_ocr = options.ocr == "always"

        ocr_class = (
            TesseractCliOcrOptions
            if options.ocr_engine == "TesseractCliOcrOptions"
            else TesseractOcrOptions
        )
        ocr_kwargs: dict[str, Any] = {
            "force_full_page_ocr": force_ocr,
            "psm": 3,
            "path": options.tesseract_prefix or os.environ.get("TESSDATA_PREFIX") or None,
            "lang": ocr_langs,
        }
        if ocr_class is TesseractCliOcrOptions:
            ocr_kwargs["tesseract_cmd"] = options.tesseract_cmd
        pipeline_options.ocr_options = ocr_class(
            **ocr_kwargs,
        )

    return DocumentConverter(
        format_options={
            InputFormat.PDF: PdfFormatOption(pipeline_options=pipeline_options),
        }
    )


def parse_ocr_langs(value: str | None) -> list[str]:
    if not value:
        return ["eng"]
    return [part.strip() for part in re.split(r"[,+]", value) if part.strip()] or ["eng"]


def ensure_tessdata_prefix() -> None:
    """Ensure TESSDATA_PREFIX is set, auto-detect if needed for OCR"""
    if os.environ.get("TESSDATA_PREFIX"):
        return

    # Common tessdata locations
    candidates = [
        "/usr/share/tessdata",
        "/usr/local/share/tessdata",
        Path.home() / "tessdata",
        "/opt/homebrew/share/tessdata",  # macOS Homebrew
    ]

    for path in candidates:
        if Path(path).exists() and (Path(path) / "eng.traineddata").exists():
            os.environ["TESSDATA_PREFIX"] = str(path)
            return

    # TESSDATA_PREFIX not found, OCR may fail if requested


def parse_page_range(value: str) -> tuple[int, int]:
    match = re.fullmatch(r"\s*(\d+)\s*(?:-|:|,)\s*(\d+)\s*", value)
    if not match:
        raise argparse.ArgumentTypeError("Use START-END, for example: 1-5")
    start, end = int(match.group(1)), int(match.group(2))
    if start < 1 or end < start:
        raise argparse.ArgumentTypeError("Page range must be positive and START <= END")
    return (start, end)


def configure_ocr_integer_limit() -> None:
    """Allow large OCR digit runs while retaining a bounded DoS safeguard."""
    get_limit = getattr(sys, "get_int_max_str_digits", None)
    set_limit = getattr(sys, "set_int_max_str_digits", None)
    if get_limit is None or set_limit is None:
        return
    current_limit = get_limit()
    if current_limit and current_limit < OCR_INT_STRING_DIGIT_LIMIT:
        set_limit(OCR_INT_STRING_DIGIT_LIMIT)


def run_with_elapsed_bar(label: str, enabled: bool, operation: Any) -> Any:
    if not enabled:
        return operation()

    stop = threading.Event()
    bar = tqdm(
        total=None,
        desc=label,
        unit="s",
        bar_format="{desc}: {elapsed} elapsed",
        dynamic_ncols=True,
        leave=False,
    )

    def tick() -> None:
        while not stop.wait(1):
            bar.update(1)

    thread = threading.Thread(target=tick, daemon=True)
    thread.start()
    try:
        return operation()
    finally:
        stop.set()
        thread.join(timeout=2)
        bar.close()


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


def text_quality_signal(text: str) -> float:
    """Rank OCR candidates by useful text, script fit, and obvious corruption."""
    normalized = normalize_spaces(text)
    if not normalized:
        return 0.0
    length_score = min(len(normalized), 2000) / 20
    keyword_score = len(expected_keyword_hits(normalized)) * 12
    script_score = devanagari_ratio(normalized) * 30
    corruption_penalty = garbage_ratio(normalized) * 100
    return round(length_score + keyword_score + script_score - corruption_penalty, 3)


def table_geometry(data: dict[str, Any] | None) -> tuple[int, int, list[dict[str, Any]]]:
    data = data or {}
    rows = int(data.get("num_rows") or data.get("row_count") or 0)
    cols = int(data.get("num_cols") or data.get("col_count") or 0)
    cells = data.get("table_cells") or data.get("cells") or []
    for cell in cells:
        rows = max(rows, int(cell.get("end_row_offset_idx", 0) or 0))
        cols = max(cols, int(cell.get("end_col_offset_idx", 0) or 0))
    return rows, cols, cells


def analyze_table_data(data: dict[str, Any] | None) -> dict[str, Any]:
    """Return conservative table diagnostics; financial OCR needs honest flags."""
    rows, cols, cells = table_geometry(data)
    total_cells = rows * cols
    populated_slots: set[tuple[int, int]] = set()
    texts: list[str] = []
    for cell in cells:
        text = normalize_spaces(str(cell.get("text") or ""))
        if not text:
            continue
        texts.append(text)
        start_row = int(cell.get("start_row_offset_idx", cell.get("row", 0)) or 0)
        end_row = int(cell.get("end_row_offset_idx", start_row + 1) or start_row + 1)
        start_col = int(cell.get("start_col_offset_idx", cell.get("col", 0)) or 0)
        end_col = int(cell.get("end_col_offset_idx", start_col + 1) or start_col + 1)
        for row in range(start_row, max(start_row + 1, end_row)):
            for col in range(start_col, max(start_col + 1, end_col)):
                if row < rows and col < cols:
                    populated_slots.add((row, col))

    empty_ratio = ratio(max(total_cells - len(populated_slots), 0), total_cells)
    formatted_number = r"[0-9०-९]+[,.][0-9०-९]+"
    numeric_merge = any(
        re.search(fr"{formatted_number}.*{formatted_number}", text) for text in texts
    )
    single_column = rows >= 3 and cols == 1
    merged_cell_ratio = ratio(sum(text.count("|") >= 2 for text in texts), len(texts))
    cell_column_merge = cols > 1 and len(texts) >= 3 and merged_cell_ratio > 0.20
    suspicious_characters = sum(text.count(char) for text in texts for char in "¥¢£�")
    ocr_confusion = suspicious_characters >= 2

    flags: list[str] = []
    if not rows or not cols:
        flags.append("missing_table_geometry")
    if single_column:
        flags.append("collapsed_columns_suspected")
    if cell_column_merge:
        flags.append("cell_column_merge_suspected")
    if empty_ratio > 0.35:
        flags.append("high_empty_cell_ratio")
    if numeric_merge:
        flags.append("numeric_merge_suspected")
    if ocr_confusion:
        flags.append("ocr_character_confusion")

    critical = {
        "missing_table_geometry",
        "collapsed_columns_suspected",
        "cell_column_merge_suspected",
    }
    quality = "high"
    if critical.intersection(flags) or len(flags) >= 2:
        quality = "low"
    elif flags:
        quality = "medium"
    return {
        "rows": rows,
        "cols": cols,
        "empty_cell_ratio": empty_ratio,
        "merged_cell_ratio": merged_cell_ratio,
        "numeric_merge_suspected": numeric_merge,
        "ocr_character_confusion": ocr_confusion,
        "quality": quality,
        "flags": flags,
    }


def remove_non_devanagari_ocr_noise(text: str) -> tuple[str, bool]:
    changed = False

    def replace_latin(match: re.Match[str]) -> str:
        nonlocal changed
        token = match.group(0)
        if token.upper() in LATIN_OCR_ALLOWLIST:
            return token.upper()
        changed = True
        return ""

    filtered = re.sub(r"[A-Za-z]+", replace_latin, text)
    devanagari_digits = str.maketrans("0123456789", "०१२३४५६७८९")
    digit_normalized = filtered.translate(devanagari_digits)
    changed = changed or digit_normalized != filtered
    filtered = re.sub(r"[@¥¢£&]+", "", digit_normalized)
    changed = changed or filtered != digit_normalized
    without_foreign_scripts = "".join(
        char
        for char in filtered
        if not (
            0x4E00 <= ord(char) <= 0x9FFF
            or 0x3040 <= ord(char) <= 0x30FF
            or 0xAC00 <= ord(char) <= 0xD7AF
        )
    )
    changed = changed or without_foreign_scripts != filtered
    corrected = without_foreign_scripts
    for bad, good in NEPALI_OCR_CORRECTIONS.items():
        if bad in corrected:
            corrected = corrected.replace(bad, good)
            changed = True
    return normalize_spaces(corrected), changed


def clean_text(
    text: str,
    rules: BoilerplateRules,
    prefer_devanagari: bool = False,
) -> tuple[str, list[str]]:
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
        if prefer_devanagari:
            line, script_filtered = remove_non_devanagari_ocr_noise(line)
            if script_filtered:
                flags.append("non_devanagari_ocr_noise_removed")
            if not line or not re.search(r"[\u0900-\u097F०-९0-9]", line):
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

    rows, cols, cells = table_geometry(data)

    if not rows or not cols:
        return ""

    matrix = [["" for _ in range(cols)] for _ in range(rows)]
    for cell in cells:
        row = int(cell.get("start_row_offset_idx", cell.get("row", 0)) or 0)
        col = int(cell.get("start_col_offset_idx", cell.get("col", 0)) or 0)
        if 0 <= row < rows and 0 <= col < cols:
            matrix[row][col] = str(cell.get("text") or "").replace("\n", " ").strip()

    return matrix_to_markdown(matrix)


def matrix_to_markdown(matrix: list[list[str]]) -> str:
    if not matrix or not matrix[0]:
        return ""
    cols = max(len(row) for row in matrix)
    normalized = [row + [""] * (cols - len(row)) for row in matrix]
    header = normalized[0]
    separator = ["---"] * cols
    body = normalized[1:]

    def line(values: list[str]) -> str:
        return "| " + " | ".join(value.replace("|", "\\|") for value in values) + " |"

    return "\n".join([line(header), line(separator), *(line(row) for row in body)])


def normalize_serial_column(matrix: list[list[str]]) -> bool:
    if len(matrix) < 5 or not matrix[0]:
        return False
    reverse_digits = str.maketrans("०१२३४५६७८९", "0123456789")
    matches = 0
    candidates = 0
    for expected, row in enumerate(matrix[1:], start=1):
        if not row:
            continue
        value = re.sub(r"\D", "", row[0].translate(reverse_digits))
        if not value:
            continue
        # A serial number cannot reasonably contain thousands of digits. This
        # indicates that OCR merged a large region into the first table cell.
        if len(value) > 12:
            return False
        candidates += 1
        normalized_value = value.lstrip("0") or "0"
        if normalized_value == str(expected):
            matches += 1
    if candidates < 3 or matches / max(len(matrix) - 1, 1) < 0.65:
        return False
    devanagari_digits = str.maketrans("0123456789", "०१२३४५६७८९")
    for expected, row in enumerate(matrix[1:], start=1):
        if row:
            row[0] = str(expected).translate(devanagari_digits)
    return True


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
        id_prefix: str = "",
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
        self.id_prefix = id_prefix
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
        self.page_ocr_raw_text: dict[int, str] = {}
        self.page_ocr_text: dict[int, str] = {}
        self.page_selected_source: dict[int, str] = {}
        self.table_markdown: dict[str, str] = {}
        self.table_matrices: dict[str, list[list[str]]] = {}
        self.table_extraction: dict[str, dict[str, Any]] = {}
        self.table_progress: Any | None = None
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

        self._write_page_images()
        table_total = len(self.doc_dict.get("tables") or [])
        self.table_progress = tqdm(
            total=table_total,
            desc="Reconstructing tables",
            unit="table",
            dynamic_ncols=True,
            leave=False,
            disable=not self.options.show_progress or not self.options.grid_table_ocr,
        )
        try:
            self._build_structure()
        finally:
            self.table_progress.close()
            self.table_progress = None
        self._run_ocr_fallbacks()
        self._score_pages()
        self._write_markdown()
        self._write_pages()
        self._write_structure()
        self._write_metadata()
        self._write_quality_reports()
        return self.package_dir

    def write_chunk(self) -> Path:
        """Write one page-range chunk into an already prepared package."""
        self.pages_dir.mkdir(parents=True, exist_ok=True)
        self.tables_dir.mkdir(parents=True, exist_ok=True)
        self.images_dir.mkdir(parents=True, exist_ok=True)
        self.page_images_dir.mkdir(parents=True, exist_ok=True)
        self.quality_dir.mkdir(parents=True, exist_ok=True)

        self._write_page_images()
        table_total = len(self.doc_dict.get("tables") or [])
        self.table_progress = tqdm(
            total=table_total,
            desc="Reconstructing tables",
            unit="table",
            dynamic_ncols=True,
            leave=False,
            disable=not self.options.show_progress or not self.options.grid_table_ocr,
        )
        try:
            self._build_structure()
        finally:
            self.table_progress.close()
            self.table_progress = None
        self._run_ocr_fallbacks()
        self._score_pages()
        self._write_markdown(append=True)
        self._write_pages()
        if self.options.quality_report:
            self._write_page_qa_files()
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
        return f"{self.id_prefix}{prefix}_{self.counters[prefix]}"

    def _write_markdown(self, append: bool = False) -> None:
        raw_sections: list[str] = []
        clean_sections: list[str] = []
        export = getattr(self.document, "export_to_markdown", None)
        for page in self._page_numbers():
            raw_page = ""
            if export is not None:
                try:
                    raw_page = str(export(page_no=page) or "")
                except TypeError:
                    raw_page = ""
            marker = f"<!-- page: {page} -->"
            raw_sections.append(f"{marker}\n\n{raw_page.strip()}".rstrip())
            clean_page = raw_page
            if self.options.clean_text:
                clean_page, _ = clean_text(
                    raw_page,
                    self.boilerplate_rules,
                    prefer_devanagari=self.options.prefer_devanagari,
                )
            structured_page = self._page_elements_to_markdown(page)
            if structured_page:
                clean_page = structured_page
            clean_sections.append(f"{marker}\n\n{clean_page.strip()}".rstrip())

        if not raw_sections and export is not None:
            markdown = str(export() or "")
            clean_markdown = clean_text(
                markdown,
                self.boilerplate_rules,
                prefer_devanagari=self.options.prefer_devanagari,
            )[0]
        else:
            markdown = "\n\n".join(raw_sections) + "\n"
            clean_markdown = "\n\n".join(clean_sections) + "\n"
        mode = "a" if append else "w"
        for filename, content in (
            ("document.raw.md", markdown),
            ("document.clean.md", clean_markdown),
            ("document.md", clean_markdown),
        ):
            with (self.package_dir / filename).open(mode, encoding="utf-8") as handle:
                handle.write(content)

    def _page_elements_to_markdown(self, page: int) -> str:
        lines: list[str] = []
        for element in self.page_elements.get(page, []):
            if element.get("indexable") is False:
                continue
            kind = element.get("type")
            text = str(element.get("text_clean") or element.get("text") or "").strip()
            if kind == "table":
                markdown = str(element.get("markdown") or "").strip()
                if markdown:
                    lines.append(markdown)
            elif kind == "heading" and text:
                level = min(max(int(element.get("level") or 2), 1), 6)
                lines.append(f"{'#' * level} {text}")
            elif kind == "list_item" and text:
                lines.append(f"- {text}")
            elif kind == "image":
                lines.append("<!-- image -->")
            elif text:
                lines.append(text)
        return "\n\n".join(lines)

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

    def _run_ocr_fallbacks(self) -> None:
        if not self.options.ocr_fallback or self.options.ocr == "never":
            return
        if shutil.which(self.options.tesseract_cmd) is None:
            self.manual_review.append(
                {"page": None, "reason": f"OCR fallback unavailable: {self.options.tesseract_cmd} not found"}
            )
            return

        candidates: list[int] = []
        for page, elements in self.page_elements.items():
            if page not in self.page_image_paths or not elements:
                continue
            if any(element["type"] == "table" for element in elements):
                continue
            text = "\n".join(self.page_raw_text.get(page, []))
            if len(normalize_spaces(text)) < 200 or garbage_ratio(text) > 0.12:
                candidates.append(page)

        iterator = tqdm(
            sorted(candidates),
            desc="OCR fallback",
            unit="page",
            dynamic_ncols=True,
            leave=False,
            disable=not self.options.show_progress,
        )
        for page in iterator:
            image_path = self.package_dir / self.page_image_paths[page]
            command = [
                self.options.tesseract_cmd,
                str(image_path),
                "stdout",
                "-l",
                "+".join(parse_ocr_langs(self.options.ocr_lang)),
                "--psm",
                str(self.options.ocr_fallback_psm),
            ]
            try:
                result = subprocess.run(
                    command,
                    check=True,
                    capture_output=True,
                    text=True,
                    timeout=self.options.ocr_fallback_timeout,
                )
            except (OSError, subprocess.SubprocessError) as exc:
                self.manual_review.append(
                    {"page": page, "reason": f"Standalone OCR fallback failed: {exc}"}
                )
                continue
            self.page_ocr_raw_text[page] = result.stdout
            ocr_text, _ = clean_text(
                result.stdout,
                self.boilerplate_rules,
                prefer_devanagari=self.options.prefer_devanagari,
            )
            self.page_ocr_text[page] = ocr_text
            docling_text = "\n".join(self.page_clean_text.get(page, []))
            if text_quality_signal(ocr_text) > text_quality_signal(docling_text) + 5:
                self.page_selected_source[page] = "tesseract_cli_fallback"
                self._add_ocr_fallback_element(page, ocr_text)

    def _add_ocr_fallback_element(self, page: int, text: str) -> None:
        for node in self.nodes:
            if node.get("page") != page or node.get("type") in {"image", "table"}:
                continue
            node["indexable"] = False
            node["index_weight"] = 0.0
            flags = node.setdefault("quality_flags", [])
            if "superseded_by_ocr_fallback" not in flags:
                flags.append("superseded_by_ocr_fallback")
        for element in self.page_elements.get(page, []):
            if element.get("type") in {"image", "table"}:
                continue
            element["indexable"] = False
            element["index_weight"] = 0.0
            flags = element.setdefault("quality_flags", [])
            if "superseded_by_ocr_fallback" not in flags:
                flags.append("superseded_by_ocr_fallback")

        element_id = self._next_id("paragraph")
        node = {
            "id": element_id,
            "parent": self.document_id,
            "page": page,
            "type": "paragraph",
            "position": None,
            "text_raw": text,
            "text_clean": text,
            "text": text,
            "source": "tesseract_cli_fallback",
            "quality_score": self._element_quality_score(
                {"type": "paragraph", "text_clean": text}
            ),
            "quality_flags": ["ocr_fallback_selected"],
            "indexable": True,
            "index_weight": 0.8,
        }
        self.nodes.append(node)
        self.page_elements[page].append(
            {
                key: value
                for key, value in node.items()
                if key not in {"parent", "page", "position"}
            }
        )

    def _docling_source(self) -> str:
        if self.options.ocr == "always":
            return "docling+tesseract_full_page_ocr"
        if self.options.ocr == "auto":
            return "docling+ocr_auto"
        return "docling"

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
            text_clean, cleanup_flags = clean_text(
                raw_text,
                self.boilerplate_rules,
                prefer_devanagari=self.options.prefer_devanagari,
            )
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
            "source": self._docling_source(),
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
            reconstructed = self._reconstruct_ruled_table(ref_item, page, element_id)
            if reconstructed is not None:
                matrix, extraction = reconstructed
                table_markdown = matrix_to_markdown(matrix)
                self.table_matrices[element_id] = matrix
                self.table_extraction[element_id] = extraction
            else:
                table_markdown = self._docling_table_markdown(ref_item)
                self.table_extraction[element_id] = {"method": "docling_tableformer"}
            self.table_markdown[element_id] = table_markdown
            asset_path = f"assets/tables/{element_id}.md"
            (self.package_dir / asset_path).write_text(table_markdown, encoding="utf-8")
            json_dump(self.package_dir / f"assets/tables/{element_id}.raw.json", ref_item.data)
            self._write_table_csv(ref_item, element_id)
            json_dump(
                self.package_dir / f"assets/tables/{element_id}.extraction.json",
                self.table_extraction[element_id],
            )
            table_quality = (
                self._table_quality(ref_item, element_id, page, reconstructed is not None)
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
            node["table_extraction"] = self.table_extraction[element_id]
            node["quality"] = table_quality["quality"]
            node["quality_flags"] = table_quality["flags"]
            if self.table_progress is not None:
                self.table_progress.update(1)
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
                element[key] = list(node[key]) if key == "quality_flags" else node[key]
        if node["type"] == "table":
            markdown = self.table_markdown.get(node["id"], "")
            element["markdown"] = markdown
            element["asset_path"] = node.get("asset_path")
            element["table_extraction"] = node.get("table_extraction")
            element["quality"] = node.get("quality")
        if node["type"] == "image" and node.get("asset_path"):
            element["asset_path"] = node["asset_path"]
        if node.get("position") is not None:
            element["position"] = node["position"]
        return element

    def _reconstruct_ruled_table(
        self,
        ref_item: RefItem,
        page: int | None,
        element_id: str,
    ) -> tuple[list[list[str]], dict[str, Any]] | None:
        if not self.options.grid_table_ocr or page is None:
            return None
        image_rel = self.page_image_paths.get(page)
        if not image_rel:
            return None
        bbox = first_provenance(ref_item.data).get("bbox") or {}
        if not isinstance(bbox, dict):
            bbox = {
                key: getattr(bbox, key, None)
                for key in ("l", "t", "r", "b", "coord_origin")
            }
        left = bbox.get("l", bbox.get("left"))
        top = bbox.get("t", bbox.get("top"))
        right = bbox.get("r", bbox.get("right"))
        bottom = bbox.get("b", bbox.get("bottom"))
        if None in (left, top, right, bottom):
            return None

        try:
            import cv2
        except ModuleNotFoundError:
            return None
        image = cv2.imread(str(self.package_dir / image_rel))
        if image is None:
            return None
        page_obj = getattr(self.document, "pages", {}).get(page)
        page_size = getattr(page_obj, "size", None)
        page_width = float(getattr(page_size, "width", 0) or 0)
        page_height = float(getattr(page_size, "height", 0) or 0)
        if not page_width or not page_height:
            return None

        image_height, image_width = image.shape[:2]
        scale_x = image_width / page_width
        scale_y = image_height / page_height
        coord_origin = str(bbox.get("coord_origin") or "BOTTOMLEFT").upper()
        x1 = max(0, int(float(left) * scale_x))
        x2 = min(image_width, int(float(right) * scale_x))
        if "TOPLEFT" in coord_origin:
            y1 = max(0, int(float(top) * scale_y))
            y2 = min(image_height, int(float(bottom) * scale_y))
        else:
            y1 = max(0, int((page_height - float(top)) * scale_y))
            y2 = min(image_height, int((page_height - float(bottom)) * scale_y))
        if x2 - x1 < 40 or y2 - y1 < 40:
            return None
        crop = image[y1:y2, x1:x2]
        gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
        binary = cv2.threshold(gray, 210, 255, cv2.THRESH_BINARY_INV)[1]
        horizontal = cv2.morphologyEx(
            binary,
            cv2.MORPH_OPEN,
            cv2.getStructuringElement(
                cv2.MORPH_RECT, (max(20, crop.shape[1] // 15), 1)
            ),
        )
        vertical = cv2.morphologyEx(
            binary,
            cv2.MORPH_OPEN,
            cv2.getStructuringElement(
                cv2.MORPH_RECT, (1, max(20, crop.shape[0] // 30))
            ),
        )

        def projection_lines(mask: Any, axis: int, fraction: float) -> list[int]:
            projection = (mask > 0).sum(axis=axis)
            required = mask.shape[axis] * fraction
            indices = [index for index, value in enumerate(projection) if value >= required]
            groups: list[list[int]] = []
            for index in indices:
                if not groups or index > groups[-1][-1] + 1:
                    groups.append([index])
                else:
                    groups[-1].append(index)
            return [round(sum(group) / len(group)) for group in groups]

        x_lines = projection_lines(vertical, axis=0, fraction=0.25)
        y_lines = projection_lines(horizontal, axis=1, fraction=0.35)
        rows = len(y_lines) - 1
        cols = len(x_lines) - 1
        if rows < 1 or cols < 2 or rows * cols > 2500:
            return None
        if min((b - a for a, b in zip(x_lines, x_lines[1:])), default=0) < 8:
            return None
        if min((b - a for a, b in zip(y_lines, y_lines[1:])), default=0) < 8:
            return None

        line_mask = cv2.dilate(
            cv2.bitwise_or(horizontal, vertical),
            cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2)),
        )
        ocr_image = crop.copy()
        ocr_image[line_mask > 0] = 255
        crop_asset = f"assets/tables/{element_id}.grid.png"
        cv2.imwrite(str(self.package_dir / crop_asset), ocr_image)

        with tempfile.NamedTemporaryFile(suffix=".png") as handle:
            cv2.imwrite(handle.name, ocr_image)
            try:
                result = subprocess.run(
                    [
                        self.options.tesseract_cmd,
                        handle.name,
                        "stdout",
                        "-l",
                        "+".join(parse_ocr_langs(self.options.ocr_lang)),
                        "--psm",
                        str(self.options.table_ocr_psm),
                        "tsv",
                    ],
                    check=True,
                    capture_output=True,
                    text=True,
                    timeout=self.options.table_ocr_timeout,
                )
            except (OSError, subprocess.SubprocessError):
                return None

        cells: list[list[dict[tuple[int, int, int], list[tuple[int, str]]]]] = [
            [defaultdict(list) for _ in range(cols)] for _ in range(rows)
        ]
        confidences: list[float] = []
        for word in csv.DictReader(io.StringIO(result.stdout), delimiter="\t"):
            word_text = normalize_spaces(word.get("text") or "")
            if not word_text:
                continue
            try:
                confidence = float(word.get("conf") or -1)
                word_x = int(word["left"]) + int(word["width"]) / 2
                word_y = int(word["top"]) + int(word["height"]) / 2
            except (TypeError, ValueError, KeyError):
                continue
            row = bisect_right(y_lines, word_y) - 1
            col = bisect_right(x_lines, word_x) - 1
            if not (0 <= row < rows and 0 <= col < cols):
                continue
            line_key = (
                int(word.get("block_num") or 0),
                int(word.get("par_num") or 0),
                int(word.get("line_num") or 0),
            )
            cells[row][col][line_key].append((int(word["left"]), word_text))
            if confidence >= 0:
                confidences.append(confidence)

        matrix: list[list[str]] = []
        for row_cells in cells:
            matrix_row: list[str] = []
            for lines in row_cells:
                line_values = [
                    " ".join(text for _, text in sorted(words))
                    for _, words in sorted(lines.items())
                ]
                cell_text = " ".join(value for value in line_values if value)
                if self.options.clean_text:
                    cell_text = clean_text(
                        cell_text,
                        self.boilerplate_rules,
                        prefer_devanagari=self.options.prefer_devanagari,
                    )[0]
                matrix_row.append(cell_text)
            matrix.append(matrix_row)
        serial_column_normalized = normalize_serial_column(matrix)
        populated = sum(bool(cell) for row in matrix for cell in row)
        if not populated:
            return None
        extraction = {
            "method": "opencv_grid+tesseract_tsv",
            "rows": rows,
            "cols": cols,
            "empty_cell_ratio": ratio(rows * cols - populated, rows * cols),
            "mean_ocr_confidence": round(
                sum(confidences) / len(confidences), 2
            ) if confidences else 0.0,
            "x_boundaries": x_lines,
            "y_boundaries": y_lines,
            "crop_bbox_pixels": {"left": x1, "top": y1, "right": x2, "bottom": y2},
            "grid_image": crop_asset,
            "serial_column_normalized": serial_column_normalized,
        }
        return matrix, extraction

    def _docling_table_markdown(self, ref_item: RefItem) -> str:
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
        matrix = self.table_matrices.get(element_id)
        if matrix is None:
            data = ref_item.data.get("data") or {}
            rows, cols, cells = table_geometry(data)
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

    def _table_quality(
        self,
        ref_item: RefItem,
        element_id: str,
        page: int | None,
        grid_reconstructed: bool,
    ) -> dict[str, Any]:
        if grid_reconstructed:
            extraction = self.table_extraction[element_id]
            confidence = float(extraction.get("mean_ocr_confidence") or 0.0)
            flags = ["grid_reconstructed", "numeric_values_require_visual_verification"]
            quality = "medium" if confidence >= 40 else "low"
            if confidence < 40:
                flags.append("low_ocr_confidence")
            result = {
                "table_id": element_id,
                "page": page,
                "rows": extraction["rows"],
                "cols": extraction["cols"],
                "empty_cell_ratio": extraction["empty_cell_ratio"],
                "merged_cell_ratio": 0.0,
                "numeric_merge_suspected": False,
                "ocr_character_confusion": False,
                "structure_quality": "high",
                "mean_ocr_confidence": confidence,
                "quality": quality,
                "flags": flags,
            }
            if quality == "low" and page is not None and self.options.review_low_quality:
                self.manual_review.append(
                    {"page": page, "reason": f"Table {element_id} grid OCR confidence is low"}
                )
            return result

        data = ref_item.data.get("data") or {}
        analysis = analyze_table_data(data)
        flags = analysis["flags"]
        quality = analysis["quality"]
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
            "rows": analysis["rows"],
            "cols": analysis["cols"],
            "empty_cell_ratio": analysis["empty_cell_ratio"],
            "merged_cell_ratio": analysis["merged_cell_ratio"],
            "numeric_merge_suspected": analysis["numeric_merge_suspected"],
            "ocr_character_confusion": analysis["ocr_character_confusion"],
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
        for page in self._page_numbers():
            elements = self.page_elements.get(page, [])
            non_table_raw = "\n".join(self.page_raw_text.get(page, []))
            non_table_clean = "\n".join(self.page_clean_text.get(page, []))
            table_text = self._page_table_text(page)
            docling_all_text = "\n\n".join(
                part for part in (non_table_raw, table_text) if part
            )
            selected_source = self.page_selected_source.get(page, self._docling_source())
            selected_text = (
                self.page_ocr_text.get(page, "")
                if selected_source == "tesseract_cli_fallback"
                else "\n\n".join(part for part in (non_table_clean, table_text) if part)
            )
            raw_payload = {
                "page": page,
                "page_image": self.page_image_paths.get(page),
                "text_docling_raw": docling_all_text,
                "text_docling_non_table_raw": non_table_raw,
                "table_markdown": table_text,
                "elements": elements,
            }
            clean_payload = {
                "page": page,
                "page_image": self.page_image_paths.get(page),
                "text_docling_raw": raw_payload["text_docling_raw"],
                "text_docling_non_table_raw": non_table_raw,
                "text_ocr_raw": self.page_ocr_raw_text.get(page),
                "text_clean": selected_text,
                "selected_source": selected_source,
                "ocr_enabled": self.options.ocr in {"auto", "always"},
                "full_page_ocr_forced": self.options.ocr == "always",
                "quality": self._page_quality_by_page(page),
                "elements": elements,
            }
            json_dump(self.pages_dir / f"page_{page:03d}.raw.json", raw_payload)
            json_dump(self.pages_dir / f"page_{page:03d}.clean.json", clean_payload)
            json_dump(self.pages_dir / f"page_{page:03d}.json", clean_payload)

    def _page_table_text(self, page: int) -> str:
        return "\n\n".join(
            str(element.get("markdown") or "")
            for element in self.page_elements.get(page, [])
            if element["type"] == "table" and element.get("markdown")
        )

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
            "ocr": {
                "enabled": self.options.ocr in {"auto", "always"},
                "policy": self.options.ocr,
                "engine": self.options.ocr_engine,
                "languages": parse_ocr_langs(self.options.ocr_lang),
                "tessdata_prefix": self.options.tesseract_prefix
                or os.environ.get("TESSDATA_PREFIX"),
                "standalone_fallback_enabled": self.options.ocr_fallback,
                "standalone_fallback_command": self.options.tesseract_cmd,
                "standalone_fallback_psm": self.options.ocr_fallback_psm,
                "standalone_fallback_selected_pages": sorted(self.page_selected_source),
            },
            "text_cleanup": {
                "prefer_devanagari": self.options.prefer_devanagari,
                "latin_allowlist": sorted(LATIN_OCR_ALLOWLIST),
            },
            "table_extraction": {
                "grid_table_ocr_enabled": self.options.grid_table_ocr,
                "ocr_psm": self.options.table_ocr_psm,
                "grid_reconstructed": sum(
                    item.get("method") == "opencv_grid+tesseract_tsv"
                    for item in self.table_extraction.values()
                ),
                "docling_fallback": sum(
                    item.get("method") == "docling_tableformer"
                    for item in self.table_extraction.values()
                ),
            },
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

    def _page_numbers(self) -> list[int]:
        pages = self.doc_dict.get("pages")
        if isinstance(pages, dict):
            numbers: list[int] = []
            for key in pages:
                try:
                    numbers.append(int(key))
                except (TypeError, ValueError):
                    continue
            if numbers:
                return sorted(numbers)
        if isinstance(pages, list):
            numbers = []
            for index, item in enumerate(pages, start=1):
                if isinstance(item, dict):
                    value = item.get("page_no") or item.get("page") or index
                else:
                    value = index
                try:
                    numbers.append(int(value))
                except (TypeError, ValueError):
                    numbers.append(index)
            return numbers
        total_pages = self._page_count()
        return list(range(1, total_pages + 1))

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
            return bool(node.get("asset_path"))
        return bool(node.get("text_clean") or node.get("text") or node.get("asset_path"))

    def _index_weight(self, node: dict[str, Any]) -> float:
        if not self._is_indexable(node):
            return 0.0
        if node["type"] == "table":
            return {"high": 1.0, "medium": 0.5, "low": 0.25}.get(
                node.get("quality"), 0.25
            )
        if node["type"] in {"heading", "chapter", "section"}:
            return 0.9
        if node["type"] == "image":
            return 0.4
        return round(0.3 + (node.get("quality_score", 0.5) * 0.6), 3)

    def _score_pages(self) -> None:
        seen_hashes: dict[str, int] = {}
        for page in self._page_numbers():
            non_table_raw = "\n".join(self.page_raw_text.get(page, []))
            non_table_clean = "\n".join(self.page_clean_text.get(page, []))
            table_text = self._page_table_text(page)
            selected_source = self.page_selected_source.get(page, self._docling_source())
            selected_text = (
                self.page_ocr_text.get(page, "")
                if selected_source == "tesseract_cli_fallback"
                else "\n\n".join(part for part in (non_table_clean, table_text) if part)
            )
            raw_all_text = "\n\n".join(part for part in (non_table_raw, table_text) if part)
            counts = script_counts(selected_text)
            text_chars = len(normalize_spaces(raw_all_text))
            clean_chars = len(normalize_spaces(selected_text))
            non_table_chars = len(normalize_spaces(non_table_clean))
            table_chars = len(normalize_spaces(table_text))
            page_tables = [item for item in self.page_elements.get(page, []) if item["type"] == "table"]
            page_images = [item for item in self.page_elements.get(page, []) if item["type"] == "image"]
            has_visual = bool(page_images or self.page_image_paths.get(page))
            visual_only = not self.page_elements.get(page) and has_visual
            normalized_hash = hashlib.sha1(normalize_spaces(selected_text).encode("utf-8")).hexdigest()
            duplicate_of = seen_hashes.get(normalized_hash) if selected_text else None
            if selected_text and normalized_hash not in seen_hashes:
                seen_hashes[normalized_hash] = page
            page_table_quality = [item for item in self.table_quality if item.get("page") == page]
            low_tables = [item for item in page_table_quality if item["quality"] == "low"]
            medium_tables = [item for item in page_table_quality if item["quality"] == "medium"]
            flags: list[str] = []
            if visual_only:
                flags.append("visual_only_page")
            elif clean_chars < 200 and has_visual:
                flags.append("sparse_text_with_visual_content")
            if not visual_only and clean_chars == 0:
                flags.append("footer_only_or_empty_text")
            if devanagari_ratio(selected_text) < 0.30 and clean_chars > 80:
                flags.append("low_devanagari_ratio")
            if garbage_ratio(selected_text) > 0.12:
                flags.append("high_garbage_ratio")
            if duplicate_of:
                flags.append("duplicate_text")
            if page_tables:
                flags.append("table_page")
            if low_tables:
                flags.append("low_quality_table")
            elif medium_tables:
                flags.append("medium_quality_table")
            if selected_source == "tesseract_cli_fallback":
                flags.append("ocr_fallback_selected")
            recommended = "accept"
            if visual_only:
                recommended = "accept_visual_only"
            elif low_tables:
                recommended = "validate_tables"
            elif "footer_only_or_empty_text" in flags or "high_garbage_ratio" in flags:
                recommended = (
                    "manual_review"
                    if self.options.ocr in {"auto", "always"}
                    else "full_page_ocr"
                )
            elif medium_tables:
                recommended = "validate_tables"
            score = 1.0
            score -= 0.15 if "sparse_text_with_visual_content" in flags else 0.0
            score -= 0.45 if "footer_only_or_empty_text" in flags else 0.0
            score -= 0.25 if "low_devanagari_ratio" in flags else 0.0
            score -= min(0.4, garbage_ratio(selected_text) * 2)
            score -= 0.1 if "duplicate_text" in flags else 0.0
            score -= 0.35 if low_tables else 0.0
            score -= 0.1 if medium_tables else 0.0
            score = round(min(max(score, 0.0), 1.0), 3)
            payload = {
                "page": page,
                "text_chars": text_chars,
                "clean_text_chars": clean_chars,
                "non_table_text_chars": non_table_chars,
                "table_text_chars": table_chars,
                "devanagari_ratio": devanagari_ratio(selected_text),
                "garbage_ratio": garbage_ratio(selected_text),
                "script_counts": counts,
                "has_page_image": page in self.page_image_paths,
                "has_visual_content": has_visual,
                "visual_only": visual_only,
                "ocr_enabled": self.options.ocr in {"auto", "always"},
                "full_page_ocr_forced": self.options.ocr == "always",
                "selected_source": selected_source,
                "table_count": len(page_tables),
                "low_quality_table_count": len(low_tables),
                "medium_quality_table_count": len(medium_tables),
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
            "ocr_fallback_selected_pages": sorted(self.page_selected_source),
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
                    (
                        self.page_ocr_text.get(page, "")
                        if self.page_selected_source.get(page) == "tesseract_cli_fallback"
                        else "\n\n".join(
                            part
                            for part in (
                                "\n".join(self.page_clean_text.get(page, [])),
                                self._page_table_text(page),
                            )
                            if part
                        )
                    )[:4000],
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


def pdf_page_count(pdf_path: Path) -> int:
    """Read the PDF page count without rendering or loading every page."""
    try:
        import pypdfium2
    except ModuleNotFoundError as exc:
        raise RuntimeError(
            "pypdfium2 is required for memory-safe batching; install requirements.txt"
        ) from exc

    pdf = pypdfium2.PdfDocument(str(pdf_path))
    try:
        return len(pdf)
    finally:
        close = getattr(pdf, "close", None)
        if close is not None:
            close()


def selected_page_span(
    total_pages: int,
    max_num_pages: int | None,
    page_range: tuple[int, int] | None,
) -> tuple[int, int]:
    if total_pages < 1:
        raise ValueError("PDF has no pages")
    if page_range is not None:
        start, requested_end = page_range
        if start > total_pages:
            raise ValueError(
                f"Page range starts at {start}, but the PDF has {total_pages} pages"
            )
        return start, min(requested_end, total_pages)
    if max_num_pages is not None:
        if max_num_pages < 1:
            raise ValueError("--max-num-pages must be at least 1")
        return 1, min(max_num_pages, total_pages)
    return 1, total_pages


def iter_page_batches(start: int, end: int, batch_size: int) -> list[tuple[int, int]]:
    if batch_size < 1:
        return [(start, end)]
    return [
        (batch_start, min(batch_start + batch_size - 1, end))
        for batch_start in range(start, end + 1, batch_size)
    ]


def iter_missing_page_batches(
    start: int,
    end: int,
    batch_size: int,
    existing_pages: set[int],
) -> list[tuple[int, int]]:
    """Group missing pages into bounded, contiguous Docling page ranges."""
    missing = [page for page in range(start, end + 1) if page not in existing_pages]
    if not missing:
        return []
    runs: list[tuple[int, int]] = []
    run_start = previous = missing[0]
    for page in missing[1:]:
        if page != previous + 1:
            runs.extend(iter_page_batches(run_start, previous, batch_size))
            run_start = page
        previous = page
    runs.extend(iter_page_batches(run_start, previous, batch_size))
    return runs


def package_page_numbers(package_dir: Path) -> set[int]:
    pages_dir = package_dir / "pages"
    if not pages_dir.exists():
        return set()
    numbers: set[int] = set()
    for path in pages_dir.glob("page_*.json"):
        match = re.fullmatch(r"page_(\d+)\.json", path.name)
        if match:
            numbers.add(int(match.group(1)))
    return numbers


def load_structure_spool(package_dir: Path, spool_path: Path) -> list[dict[str, Any]]:
    """Ensure resumable NDJSON exists and return its existing nodes."""
    nodes: list[dict[str, Any]] = []
    if spool_path.exists():
        with spool_path.open(encoding="utf-8") as spool:
            for line in spool:
                if line.strip():
                    nodes.append(json.loads(line))
        return nodes

    structure_path = package_dir / "structure.json"
    if structure_path.exists():
        payload = json.loads(structure_path.read_text(encoding="utf-8"))
        nodes = [node for node in payload.get("nodes", []) if isinstance(node, dict)]
        with spool_path.open("w", encoding="utf-8") as spool:
            for node in nodes:
                spool.write(json.dumps(node, ensure_ascii=False) + "\n")
    return nodes


def next_batch_index(nodes: list[dict[str, Any]]) -> int:
    indices: list[int] = []
    for node in nodes:
        match = re.match(r"b(\d+)_", str(node.get("id") or ""))
        if match:
            indices.append(int(match.group(1)))
    return max(indices, default=0) + 1


def load_existing_page_quality(
    package_dir: Path,
    pages: set[int],
) -> tuple[list[dict[str, Any]], set[int]]:
    quality: list[dict[str, Any]] = []
    selected_ocr_pages: set[int] = set()
    for page in sorted(pages):
        page_path = package_dir / "pages" / f"page_{page:03d}.json"
        try:
            payload = json.loads(page_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        page_quality = payload.get("quality")
        if isinstance(page_quality, dict):
            quality.append(page_quality)
        if payload.get("selected_source") == "tesseract_cli_fallback":
            selected_ocr_pages.add(page)
    return quality, selected_ocr_pages


def load_existing_table_quality(
    package_dir: Path,
    nodes: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    quality_path = package_dir / "quality" / "table_quality.json"
    if quality_path.exists():
        try:
            payload = json.loads(quality_path.read_text(encoding="utf-8"))
            if isinstance(payload, list):
                return [item for item in payload if isinstance(item, dict)]
        except (OSError, json.JSONDecodeError):
            pass
    quality: list[dict[str, Any]] = []
    for node in nodes:
        if node.get("type") != "table":
            continue
        extraction = node.get("table_extraction") or {}
        quality.append(
            {
                "table_id": node.get("id"),
                "page": node.get("page"),
                "rows": extraction.get("rows"),
                "cols": extraction.get("cols"),
                "empty_cell_ratio": extraction.get("empty_cell_ratio"),
                "numeric_merge_suspected": None,
                "quality": node.get("quality") or "unvalidated",
                "flags": node.get("quality_flags") or ["recovered_from_structure"],
            }
        )
    return quality


def release_conversion_memory() -> None:
    gc.collect()
    try:
        import torch
    except ModuleNotFoundError:
        return
    if torch.cuda.is_available():
        torch.cuda.empty_cache()


def write_structure_from_spool(
    package_dir: Path,
    document_id: str,
    spool_path: Path,
) -> None:
    output_path = package_dir / "structure.json"
    with output_path.open("w", encoding="utf-8") as output:
        output.write(
            json.dumps(
                {"document_id": document_id},
                ensure_ascii=False,
                indent=2,
            )[:-2]
        )
        output.write(',\n  "nodes": [\n')
        first = True
        with spool_path.open(encoding="utf-8") as spool:
            for line in spool:
                serialized = line.strip()
                if not serialized:
                    continue
                if not first:
                    output.write(",\n")
                output.write("    ")
                output.write(serialized)
                first = False
        output.write("\n  ]\n}\n")
    shutil.copyfile(output_path, package_dir / "structure.raw.json")
    shutil.copyfile(output_path, package_dir / "structure.clean.json")


def write_batched_metadata(
    package_dir: Path,
    pdf_path: Path,
    document_id: str,
    metadata_overrides: dict[str, str | None],
    options: ParserOptions,
    parsed_pages: set[int],
    source_pages: int,
    batch_size: int,
    batch_count: int,
    resumed: bool,
    selected_ocr_pages: set[int],
    grid_reconstructed: int,
    docling_fallback: int,
) -> None:
    clean_markdown_path = package_dir / "document.clean.md"
    clean_markdown = (
        clean_markdown_path.read_text(encoding="utf-8")
        if clean_markdown_path.exists()
        else ""
    )
    sorted_pages = sorted(parsed_pages)
    start = sorted_pages[0] if sorted_pages else None
    end = sorted_pages[-1] if sorted_pages else None
    metadata = {
        "document_id": document_id,
        "document_name": metadata_overrides.get("document_name") or pdf_path.stem,
        "organization": metadata_overrides.get("organization") or infer_organization(pdf_path),
        "document_type": metadata_overrides.get("document_type") or infer_document_type(pdf_path),
        "language": metadata_overrides.get("language") or "mixed",
        "fiscal_year": metadata_overrides.get("fiscal_year")
        or infer_fiscal_year(pdf_path.stem, clean_markdown),
        "pages": len(sorted_pages),
        "source_pages": source_pages,
        "parsed_page_range": {"start": start, "end": end},
        "created_at": datetime.now(timezone.utc).isoformat(),
        "parser_version": PARSER_VERSION,
        "docling_version": get_docling_version(),
        "batch_processing": {
            "enabled": True,
            "batch_size": batch_size,
            "batches": batch_count,
            "resumed": resumed,
        },
        "ocr": {
            "enabled": options.ocr in {"auto", "always"},
            "policy": options.ocr,
            "engine": options.ocr_engine,
            "languages": parse_ocr_langs(options.ocr_lang),
            "tessdata_prefix": options.tesseract_prefix
            or os.environ.get("TESSDATA_PREFIX"),
            "standalone_fallback_enabled": options.ocr_fallback,
            "standalone_fallback_command": options.tesseract_cmd,
            "standalone_fallback_psm": options.ocr_fallback_psm,
            "standalone_fallback_selected_pages": sorted(selected_ocr_pages),
        },
        "text_cleanup": {
            "prefer_devanagari": options.prefer_devanagari,
            "latin_allowlist": sorted(LATIN_OCR_ALLOWLIST),
        },
        "table_extraction": {
            "grid_table_ocr_enabled": options.grid_table_ocr,
            "ocr_psm": options.table_ocr_psm,
            "grid_reconstructed": grid_reconstructed,
            "docling_fallback": docling_fallback,
        },
        "source_pdf": str(pdf_path),
        "source_sha256": sha256_file(pdf_path),
    }
    json_dump(package_dir / "metadata.json", metadata)


def write_batched_quality_reports(
    package_dir: Path,
    document_id: str,
    page_quality: list[dict[str, Any]],
    table_quality: list[dict[str, Any]],
    manual_review: list[dict[str, Any]],
    selected_ocr_pages: set[int],
    min_page_quality: float,
) -> None:
    quality_dir = package_dir / "quality"
    bad_pages = [
        item["page"]
        for item in page_quality
        if item["quality_score"] < min_page_quality
    ]
    low_tables = [item for item in table_quality if item["quality"] == "low"]
    average_quality = (
        sum(item["quality_score"] for item in page_quality) / len(page_quality)
        if page_quality
        else 0.0
    )
    overall_quality = "high"
    if average_quality < 0.55:
        overall_quality = "low"
    elif average_quality < 0.75:
        overall_quality = "medium"
    warnings: list[str] = []
    if bad_pages:
        warnings.append(f"{len(bad_pages)} page(s) are below the quality threshold.")
    if low_tables:
        warnings.append(f"{len(low_tables)} table(s) are marked low quality.")
    if any(item["garbage_ratio"] > 0.12 for item in page_quality):
        warnings.append("Unicode/script corruption detected in extracted text.")
    if any(item["recommended_action"] == "full_page_ocr" for item in page_quality):
        warnings.append("Some pages should be repaired with full-page OCR.")
    report = {
        "document_id": document_id,
        "pages": len(page_quality),
        "average_page_quality": round(average_quality, 3),
        "overall_quality": overall_quality,
        "bad_pages": bad_pages,
        "ocr_pages": [
            item["page"]
            for item in page_quality
            if item["recommended_action"] == "full_page_ocr"
        ],
        "ocr_fallback_selected_pages": sorted(selected_ocr_pages),
        "table_pages": sorted(
            {item["page"] for item in table_quality if item["page"] is not None}
        ),
        "low_quality_tables": [item["table_id"] for item in low_tables],
        "manual_review_required": manual_review,
        "critical_warnings": warnings,
    }
    json_dump(quality_dir / "page_quality.json", page_quality)
    json_dump(quality_dir / "table_quality.json", table_quality)
    json_dump(
        quality_dir / "manual_review_queue.json",
        {"manual_review_required": manual_review},
    )
    json_dump(quality_dir / "quality_report.json", report)
    quality_by_page = {item["page"]: item for item in page_quality}
    lines = [
        "# Parse Quality Report",
        "",
        "## Summary",
        f"Overall quality: {overall_quality}",
        f"Average page quality: {report['average_page_quality']}",
        "",
        "## Bad pages",
    ]
    if bad_pages:
        lines.extend(
            f"- Page {page}: {', '.join(quality_by_page[page].get('flags') or ['low quality'])}"
            for page in bad_pages
        )
    else:
        lines.append("- None")
    lines.extend(["", "## Recommended actions"])
    if manual_review:
        lines.extend(
            f"- Page {item['page']}: {item['reason']}" for item in manual_review
        )
    else:
        lines.append("- None")
    (quality_dir / "quality_report.md").write_text(
        "\n".join(lines) + "\n",
        encoding="utf-8",
    )


def convert_pdf_batched(
    converter: Any,
    pdf_path: Path,
    output_root: Path,
    metadata_overrides: dict[str, str | None],
    options: ParserOptions,
    boilerplate_rules: BoilerplateRules,
    overwrite: bool,
    progress: bool,
    max_num_pages: int | None,
    page_range: tuple[int, int] | None,
    batch_size: int,
    resume: bool,
) -> Path:
    source_pages = pdf_page_count(pdf_path)
    start, end = selected_page_span(source_pages, max_num_pages, page_range)
    document_id = metadata_overrides.get("document_id") or infer_document_id(pdf_path)
    package_dir = output_root / slugify(document_id)
    if package_dir.exists() and overwrite:
        shutil.rmtree(package_dir)
    if package_dir.exists() and not resume:
        raise FileExistsError(
            f"{package_dir} already exists. Use --resume to append missing pages "
            "or --overwrite to replace it."
        )
    if resume and not package_dir.exists():
        raise FileNotFoundError(
            f"Cannot resume because package {package_dir} does not exist."
        )
    for path in (
        package_dir / "pages",
        package_dir / "assets" / "tables",
        package_dir / "assets" / "images",
        package_dir / "assets" / "page_images",
        package_dir / "quality" / "pages",
    ):
        path.mkdir(parents=True, exist_ok=True)

    spool_path = package_dir / ".structure.nodes.ndjson"
    existing_pages = package_page_numbers(package_dir) if resume else set()
    existing_nodes = load_structure_spool(package_dir, spool_path) if resume else []
    if existing_pages and not existing_nodes:
        raise RuntimeError(
            "Existing page files have no resumable structure data. Keep the package "
            "for inspection and rerun into a new output directory."
        )
    batches = iter_missing_page_batches(start, end, batch_size, existing_pages)
    if resume:
        skipped = (end - start + 1) - sum(
            batch_end - batch_start + 1 for batch_start, batch_end in batches
        )
        tqdm.write(
            f"resume: found {len(existing_pages)} packaged page(s); "
            f"skipping {skipped} existing page(s) in requested range"
        )
    page_quality, selected_ocr_pages = load_existing_page_quality(
        package_dir,
        existing_pages,
    )
    table_quality = load_existing_table_quality(package_dir, existing_nodes)
    manual_review = [
        {
            "page": item["page"],
            "reason": (
                f"Page quality {item['quality_score']} below threshold "
                f"{options.min_page_quality}"
            ),
        }
        for item in page_quality
        if item.get("quality_score", 0) < options.min_page_quality
        and options.review_low_quality
    ]
    grid_reconstructed = sum(
        (node.get("table_extraction") or {}).get("method")
        == "opencv_grid+tesseract_tsv"
        for node in existing_nodes
    )
    docling_fallback = sum(
        (node.get("table_extraction") or {}).get("method") == "docling_tableformer"
        for node in existing_nodes
    )
    parsed_pages = set(existing_pages)
    first_batch_index = next_batch_index(existing_nodes)
    document_root_written = any(
        node.get("type") == "document" for node in existing_nodes
    )
    completed_batch_count = first_batch_index - 1

    batch_progress = tqdm(
        batches,
        desc="Parsing page batches",
        unit="batch",
        dynamic_ncols=True,
        disable=not progress,
    )
    for batch_index, batch_range in enumerate(
        batch_progress,
        start=first_batch_index,
    ):
        batch_progress.set_postfix_str(f"pages {batch_range[0]}-{batch_range[1]}")
        result = None
        document = None
        doc_dict = None
        writer = None
        try:
            result = run_with_elapsed_bar(
                f"Docling pages {batch_range[0]}-{batch_range[1]}",
                progress,
                lambda batch_range=batch_range: converter.convert(
                    pdf_path,
                    page_range=batch_range,
                ),
            )
            document = result.document
            if not hasattr(document, "export_to_dict"):
                raise RuntimeError(
                    "Docling document object does not expose export_to_dict()."
                )
            doc_dict = document.export_to_dict()
            writer = DocumentPackageWriter(
                pdf_path=pdf_path,
                output_root=output_root,
                document=document,
                doc_dict=doc_dict,
                metadata_overrides=metadata_overrides,
                options=options,
                boilerplate_rules=boilerplate_rules,
                overwrite=False,
                id_prefix=f"b{batch_index:04d}_",
            )
            writer.write_chunk()
            with spool_path.open("a", encoding="utf-8") as spool:
                for node in writer.nodes:
                    if node.get("type") == "document":
                        if document_root_written:
                            continue
                        document_root_written = True
                    spool.write(json.dumps(node, ensure_ascii=False) + "\n")
            page_quality.extend(writer.page_quality)
            table_quality.extend(writer.table_quality)
            manual_review.extend(writer.manual_review)
            selected_ocr_pages.update(writer.page_selected_source)
            parsed_pages.update(writer._page_numbers())
            completed_batch_count += 1
            grid_reconstructed += sum(
                item.get("method") == "opencv_grid+tesseract_tsv"
                for item in writer.table_extraction.values()
            )
            docling_fallback += sum(
                item.get("method") == "docling_tableformer"
                for item in writer.table_extraction.values()
            )
        finally:
            del writer, doc_dict, document, result
            release_conversion_memory()

    write_structure_from_spool(package_dir, document_id, spool_path)
    write_batched_metadata(
        package_dir=package_dir,
        pdf_path=pdf_path,
        document_id=document_id,
        metadata_overrides=metadata_overrides,
        options=options,
        parsed_pages=parsed_pages,
        source_pages=source_pages,
        batch_size=batch_size,
        batch_count=completed_batch_count,
        resumed=resume,
        selected_ocr_pages=selected_ocr_pages,
        grid_reconstructed=grid_reconstructed,
        docling_fallback=docling_fallback,
    )
    if options.quality_report:
        write_batched_quality_reports(
            package_dir=package_dir,
            document_id=document_id,
            page_quality=page_quality,
            table_quality=table_quality,
            manual_review=manual_review,
            selected_ocr_pages=selected_ocr_pages,
            min_page_quality=options.min_page_quality,
        )
    spool_path.unlink(missing_ok=True)
    return package_dir


def convert_pdf(
    converter: Any,
    pdf_path: Path,
    output_root: Path,
    metadata_overrides: dict[str, str | None],
    options: ParserOptions,
    boilerplate_rules: BoilerplateRules,
    overwrite: bool,
    progress: bool,
    max_num_pages: int | None,
    page_range: tuple[int, int] | None,
    batch_size: int,
    resume: bool,
) -> Path:
    if batch_size > 0:
        return convert_pdf_batched(
            converter=converter,
            pdf_path=pdf_path,
            output_root=output_root,
            metadata_overrides=metadata_overrides,
            options=options,
            boilerplate_rules=boilerplate_rules,
            overwrite=overwrite,
            progress=progress,
            max_num_pages=max_num_pages,
            page_range=page_range,
            batch_size=batch_size,
            resume=resume,
        )
    if resume:
        raise ValueError("--resume requires batching; use --batch-size 1 or greater")
    tqdm.write(f"starting Docling conversion: {pdf_path}")
    convert_kwargs: dict[str, Any] = {}
    if page_range is not None:
        convert_kwargs["page_range"] = page_range
    elif max_num_pages is not None:
        convert_kwargs["page_range"] = (1, max_num_pages)
    result = run_with_elapsed_bar(
        "Docling conversion",
        progress,
        lambda: converter.convert(pdf_path, **convert_kwargs),
    )
    tqdm.write("Docling conversion finished; exporting document dict")
    document = result.document
    if not hasattr(document, "export_to_dict"):
        raise RuntimeError("Docling document object does not expose export_to_dict().")
    doc_dict = document.export_to_dict()

    tqdm.write("writing package files")

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
    parser.add_argument(
        "--max-num-pages",
        type=int,
        help="Maximum pages to parse per PDF. Useful for testing OCR on large files.",
    )
    parser.add_argument(
        "--page-range",
        type=parse_page_range,
        help="Parse a specific inclusive page range, e.g. 1-5.",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=50,
        help=(
            "Convert this many pages at a time to bound memory usage. "
            "Use 0 to disable batching. Default: 50."
        ),
    )
    parser.add_argument(
        "--resume",
        "--append",
        action="store_true",
        dest="resume",
        help=(
            "Append only missing pages to an existing package. Use with "
            "--page-range and the same output directory/document ID."
        ),
    )
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
        default="always",
        help="OCR mode. Default: always, because these PDFs often have broken embedded Unicode text.",
    )
    parser.add_argument(
        "--ocr-engine",
        choices=("TesseractOcrOptions", "TesseractCliOcrOptions"),
        default="TesseractCliOcrOptions",
        help="Docling OCR backend. Default: TesseractCliOcrOptions (quieter native OCR logs).",
    )
    parser.add_argument(
        "--ocr-lang",
        default="nep+eng",
        help="OCR language hint, e.g. nep+eng or script/Devanagari+eng. Default: nep+eng",
    )
    parser.add_argument(
        "--tessdata-prefix",
        type=Path,
        help="Directory containing Tesseract traineddata files; auto-detected when omitted.",
    )
    parser.add_argument(
        "--ocr-fallback",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="Run standalone Tesseract on sparse non-table pages and select it when better. Default: enabled.",
    )
    parser.add_argument(
        "--tesseract-cmd",
        default="tesseract",
        help="Tesseract executable used by CLI OCR and fallback. Default: tesseract.",
    )
    parser.add_argument(
        "--ocr-fallback-psm",
        type=int,
        default=6,
        help="Tesseract page segmentation mode for sparse-page fallback. Default: 6.",
    )
    parser.add_argument(
        "--prefer-devanagari",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="Remove Latin/foreign-script OCR noise except approved technical acronyms. Default: enabled.",
    )
    parser.add_argument(
        "--grid-table-ocr",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="Reconstruct bordered tables from detected page-image grid lines. Default: enabled.",
    )
    parser.add_argument(
        "--table-ocr-psm",
        type=int,
        default=6,
        help="Tesseract page segmentation mode for reconstructed table crops. Default: 6.",
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
    parser.add_argument(
        "--progress",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="Show a progress bar while parsing PDFs. Default: enabled.",
    )
    return parser.parse_args()


def main() -> int:
    load_dotenv()
    configure_ocr_integer_limit()
    args = parse_args()

    if args.batch_size < 0:
        print("--batch-size must be 0 or greater.", file=sys.stderr)
        return 1
    if args.resume and args.overwrite:
        print("--resume and --overwrite cannot be used together.", file=sys.stderr)
        return 1

    if args.tessdata_prefix:
        os.environ["TESSDATA_PREFIX"] = str(args.tessdata_prefix.resolve())

    # Ensure tessdata is configured before initializing OCR
    if args.ocr in {"auto", "always"}:
        ensure_tessdata_prefix()

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
        tesseract_prefix=str(args.tessdata_prefix.resolve()) if args.tessdata_prefix else None,
        ocr_fallback=args.ocr_fallback,
        tesseract_cmd=args.tesseract_cmd,
        ocr_fallback_psm=args.ocr_fallback_psm,
        show_progress=args.progress,
        prefer_devanagari=args.prefer_devanagari,
        grid_table_ocr=args.grid_table_ocr,
        table_ocr_psm=args.table_ocr_psm,
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
    progress = tqdm(
        pdfs,
        desc="Parsing PDFs",
        unit="pdf",
        dynamic_ncols=True,
        disable=not args.progress,
    )
    for pdf_path in progress:
        progress.set_postfix_str(pdf_path.name[:60])
        try:
            package_dir = convert_pdf(
                converter=converter,
                pdf_path=pdf_path,
                output_root=output_dir,
                metadata_overrides=metadata_overrides,
                options=parser_options,
                boilerplate_rules=boilerplate_rules,
                overwrite=args.overwrite,
                progress=args.progress,
                max_num_pages=args.max_num_pages,
                page_range=args.page_range,
                batch_size=args.batch_size,
                resume=args.resume,
            )
        except Exception as exc:
            failures += 1
            progress.write(f"failed: {pdf_path} ({exc})", file=sys.stderr)
            traceback.print_exc()
            continue
        progress.write(f"wrote {package_dir}")

    if failures:
        print(f"Completed with {failures} failure(s).", file=sys.stderr)
        return 2
    print("Done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
