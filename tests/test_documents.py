from __future__ import annotations

import json
import tempfile
import unittest
from dataclasses import replace
from pathlib import Path

from rag_service.config import RAGSettings
from rag_service.documents import ParsedDocumentLoader


class ParsedDocumentLoaderTests(unittest.TestCase):
    def test_loads_clean_nodes_and_table_with_citation_metadata(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            document_dir = root / "v3" / "sample"
            table_dir = document_dir / "assets" / "tables"
            table_dir.mkdir(parents=True)
            (table_dir / "table.md").write_text(
                "| शीर्षक | रकम |\n|---|---|\n| शिक्षा | २०८१ |", encoding="utf-8"
            )
            (document_dir / "metadata.json").write_text(
                json.dumps(
                    {
                        "document_id": "sample-1",
                        "document_name": "नमुना बजेट",
                        "organization": "नेपाल सरकार",
                        "document_type": "Budget",
                        "fiscal_year": "२०८१/८२",
                        "language": "mixed",
                        "parser_version": "1.4",
                    }
                ),
                encoding="utf-8",
            )
            (document_dir / "structure.clean.json").write_text(
                json.dumps(
                    {
                        "document_id": "sample-1",
                        "nodes": [
                            {
                                "id": "sample-1",
                                "type": "document",
                                "parent": None,
                                "page": None,
                                "title": "नमुना बजेट",
                            },
                            {
                                "id": "bad-heading",
                                "type": "heading",
                                "parent": "sample-1",
                                "page": 1,
                                "level": 1,
                                "text": "OCR GARBAGE",
                                "indexable": False,
                                "quality_score": 0.0,
                            },
                            {
                                "id": "heading-1",
                                "type": "heading",
                                "parent": "sample-1",
                                "page": 2,
                                "level": 1,
                                "text": "शिक्षा",
                                "indexable": True,
                                "quality_score": 1.0,
                            },
                            {
                                "id": "paragraph-1",
                                "type": "paragraph",
                                "parent": "heading-1",
                                "page": 2,
                                "text": "शिक्षा क्षेत्रमा विनियोजन गरिएको रकम।",
                                "indexable": True,
                                "quality_score": 0.9,
                            },
                            {
                                "id": "table-title-1",
                                "type": "table_title",
                                "parent": "heading-1",
                                "page": 2,
                                "text": "क्षेत्रगत विनियोजन",
                                "indexable": True,
                                "quality_score": 0.9,
                            },
                            {
                                "id": "table-1",
                                "type": "table",
                                "parent": "heading-1",
                                "page": 2,
                                "asset_path": "assets/tables/table.md",
                                "indexable": True,
                                "quality_score": 0.8,
                            },
                            {
                                "id": "paragraph-bad",
                                "type": "paragraph",
                                "parent": "heading-1",
                                "page": 2,
                                "text": "LOW QUALITY",
                                "indexable": True,
                                "quality_score": 0.1,
                            },
                        ],
                    },
                    ensure_ascii=False,
                ),
                encoding="utf-8",
            )
            settings = replace(
                RAGSettings(),
                parsed_documents_dir=root,
                chunk_size=500,
                chunk_overlap=50,
                minimum_quality_score=0.25,
            )
            loader = ParsedDocumentLoader(settings)
            chunks = loader.load_chunks()
            second_pass = loader.load_chunks()

        combined = "\n".join(chunk.text for chunk in chunks)
        self.assertIn("शिक्षा क्षेत्रमा", combined)
        self.assertIn("| शिक्षा | २०८१ |", combined)
        self.assertIn("Organization: नेपाल सरकार", combined)
        self.assertNotIn("OCR GARBAGE", combined)
        self.assertNotIn("LOW QUALITY", combined)
        self.assertEqual([chunk.id for chunk in chunks], [chunk.id for chunk in second_pass])
        self.assertTrue(all(chunk.metadata["page"] == 2 for chunk in chunks))
        self.assertTrue(all(chunk.metadata["section"] == "शिक्षा" for chunk in chunks))


if __name__ == "__main__":
    unittest.main()
