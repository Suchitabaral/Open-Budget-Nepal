#!/usr/bin/env python3
"""Test script: Force OCR on every page for Nepali PDFs"""

import os
from pathlib import Path
from docling.document_converter import DocumentConverter, PdfFormatOption
from docling.datamodel.base_models import InputFormat
from docling.datamodel.pipeline_options import PdfPipelineOptions, TesseractOcrOptions


def ensure_tessdata_prefix():
    """Ensure TESSDATA_PREFIX is set, auto-detect if needed"""
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
            print(f"Auto-detected TESSDATA_PREFIX: {path}")
            return

    print("Warning: Could not auto-detect TESSDATA_PREFIX")
    print("Set it manually: export TESSDATA_PREFIX=/usr/share/tessdata")


def process_with_forced_ocr(pdf_path: Path, output_path: Path):
    """Process PDF with forced full-page OCR for Nepali text"""

    # Configure pipeline for forced OCR
    pipeline_options = PdfPipelineOptions()

    # Enable OCR
    pipeline_options.do_ocr = True

    # Enable table structure extraction
    pipeline_options.do_table_structure = True

    # Configure Tesseract OCR options
    pipeline_options.ocr_options = TesseractOcrOptions(
        force_full_page_ocr=True,  # Force OCR on every page
        lang=["nep", "eng"],        # Nepali + English
    )

    # Optional: Enable image generation for visual verification
    if hasattr(pipeline_options, "generate_page_images"):
        pipeline_options.generate_page_images = True
    if hasattr(pipeline_options, "generate_picture_images"):
        pipeline_options.generate_picture_images = True

    # Create converter
    converter = DocumentConverter(
        format_options={
            InputFormat.PDF: PdfFormatOption(
                pipeline_options=pipeline_options,
            ),
        }
    )

    print(f"Converting {pdf_path.name} with forced OCR...")
    print(f"  - OCR enabled: {pipeline_options.do_ocr}")
    print(f"  - Force full page OCR: {pipeline_options.ocr_options.force_full_page_ocr}")
    print(f"  - Languages: {pipeline_options.ocr_options.lang}")

    # Convert
    result = converter.convert(pdf_path)
    document = result.document

    print(f"\nDocument stats:")
    print(f"  - Pages: {len(document.pages)}")
    print(f"  - Tables: {len(document.tables)}")
    print(f"  - Pictures: {len(document.pictures)}")

    # Export to markdown
    markdown = document.export_to_markdown()
    output_path.write_text(markdown, encoding="utf-8")

    print(f"\nSaved to: {output_path}")

    # Show preview
    print("\n--- First 2000 characters ---")
    print(markdown[:2000])

    return output_path

if __name__ == "__main__":
    # Ensure tessdata is configured
    ensure_tessdata_prefix()

    input_pdf = Path("data/oagn/pdfs/pakhara-mahanagarapalka-31672874.pdf")
    output_md = Path("test_ocr_output.md")

    if not input_pdf.exists():
        print(f"Error: {input_pdf} not found")
        exit(1)

    process_with_forced_ocr(input_pdf, output_md)
