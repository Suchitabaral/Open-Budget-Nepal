import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path


SCRIPT_PATH = Path(__file__).resolve().parents[1] / "scripts" / "parse_pdfs_docling.py"
SPEC = importlib.util.spec_from_file_location("parse_pdfs_docling", SCRIPT_PATH)
parser = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
sys.modules["parse_pdfs_docling"] = parser
SPEC.loader.exec_module(parser)


class ParserQualityTests(unittest.TestCase):
    def test_clean_text_removes_boilerplate_and_spacing_noise(self):
        rules = parser.load_boilerplate_rules(Path("cleaning/boilerplate_rules.yaml"))
        cleaned, flags = parser.clean_text(
            "लेखापरीक्षण प्रतिवेदन\nhttps://nams.oag.gov.np\nPage 1 of 4\n२०८१ / ८२",
            rules,
        )

        self.assertNotIn("https://nams.oag.gov.np", cleaned)
        self.assertNotIn("Page 1 of 4", cleaned)
        self.assertIn("२०८१/८२", cleaned)
        self.assertIn("boilerplate_removed", flags)

    def test_infer_fiscal_year_supports_nepali_and_ascii_digits(self):
        self.assertEqual(parser.infer_fiscal_year("आर्थिक वर्ष २०८१ / ८२"), "२०८१/८२")
        self.assertEqual(parser.infer_fiscal_year("Fiscal year 2081-82"), "2081/82")

    def test_script_scoring_flags_mixed_script_garbage(self):
        text = "可aThaTEa RR89开"

        self.assertGreater(parser.garbage_ratio(text), 0.1)
        self.assertEqual(parser.devanagari_ratio(text), 0.0)

    def test_table_data_to_markdown_preserves_basic_cells(self):
        markdown = parser.table_data_to_markdown(
            {
                "num_rows": 2,
                "num_cols": 2,
                "table_cells": [
                    {"start_row_offset_idx": 0, "start_col_offset_idx": 0, "text": "शीर्षक"},
                    {"start_row_offset_idx": 0, "start_col_offset_idx": 1, "text": "रकम"},
                    {"start_row_offset_idx": 1, "start_col_offset_idx": 0, "text": "बेरुजु"},
                    {"start_row_offset_idx": 1, "start_col_offset_idx": 1, "text": "१२३"},
                ],
            }
        )

        self.assertIn("| शीर्षक | रकम |", markdown)
        self.assertIn("| बेरुजु | १२३ |", markdown)

    def test_table_quality_flags_collapsed_single_column_table(self):
        quality = parser.analyze_table_data(
            {
                "num_rows": 4,
                "num_cols": 1,
                "table_cells": [
                    {
                        "start_row_offset_idx": row,
                        "end_row_offset_idx": row + 1,
                        "start_col_offset_idx": 0,
                        "end_col_offset_idx": 1,
                        "text": text,
                    }
                    for row, text in enumerate(
                        ("क्र.सं. खर्च केन्द्र रकम", "१ कार्यालय १२३", "२ वडा ४५६", "जम्मा ५७९")
                    )
                ],
            }
        )

        self.assertEqual(quality["quality"], "low")
        self.assertIn("collapsed_columns_suspected", quality["flags"])

    def test_table_quality_counts_unpopulated_grid_slots(self):
        quality = parser.analyze_table_data(
            {
                "num_rows": 2,
                "num_cols": 3,
                "table_cells": [
                    {
                        "start_row_offset_idx": 0,
                        "end_row_offset_idx": 1,
                        "start_col_offset_idx": 0,
                        "end_col_offset_idx": 1,
                        "text": "शीर्षक",
                    },
                    {
                        "start_row_offset_idx": 1,
                        "end_row_offset_idx": 2,
                        "start_col_offset_idx": 0,
                        "end_col_offset_idx": 1,
                        "text": "मात्र एक कोष्ठ",
                    },
                ],
            }
        )

        self.assertGreater(quality["empty_cell_ratio"], 0.35)
        self.assertIn("high_empty_cell_ratio", quality["flags"])

    def test_table_quality_flags_multiple_visual_columns_in_one_cell(self):
        quality = parser.analyze_table_data(
            {
                "num_rows": 3,
                "num_cols": 3,
                "table_cells": [
                    {
                        "start_row_offset_idx": row,
                        "end_row_offset_idx": row + 1,
                        "start_col_offset_idx": 0,
                        "end_col_offset_idx": 1,
                        "text": text,
                    }
                    for row, text in enumerate(
                        ("नाम | रकम | कैफियत", "कार्यालय | १२३ | ठीक", "वडा | ४५६ | ठीक")
                    )
                ],
            }
        )

        self.assertEqual(quality["quality"], "low")
        self.assertIn("cell_column_merge_suspected", quality["flags"])

    def test_text_quality_signal_prefers_complete_nepali_ocr(self):
        corrupted = "८»/७ ५2०८ 2 413]"
        complete = "लेखापरीक्षण प्रतिवेदन पोखरा महानगरपालिका, कास्की आर्थिक वर्ष २०८१/८२"

        self.assertGreater(
            parser.text_quality_signal(complete),
            parser.text_quality_signal(corrupted),
        )

    def test_devanagari_cleanup_removes_latin_noise_but_keeps_allowlist(self):
        rules = parser.load_boilerplate_rules(Path("cleaning/boilerplate_rules.yaml"))
        cleaned, flags = parser.clean_text(
            "पालिकाले BTATAA रकम 123 SUTRA प्रणालीमा प्रविष्ट गर्यो dC @",
            rules,
            prefer_devanagari=True,
        )

        self.assertNotIn("BTATAA", cleaned)
        self.assertNotIn("dC", cleaned)
        self.assertNotIn("123", cleaned)
        self.assertNotIn("@", cleaned)
        self.assertIn("१२३", cleaned)
        self.assertIn("SUTRA", cleaned)
        self.assertEqual(
            parser.remove_non_devanagari_ocr_noise("बडा कार्यालय केफिबत")[0],
            "वडा कार्यालय कैफियत",
        )
        self.assertIn("non_devanagari_ocr_noise_removed", flags)

    def test_matrix_to_markdown_preserves_detected_grid_columns(self):
        markdown = parser.matrix_to_markdown(
            [["क्र.सं.", "खर्च केन्द्र", "रकम"], ["१", "कार्यालय", "१२३"]]
        )

        self.assertIn("| क्र.सं. | खर्च केन्द्र | रकम |", markdown)
        self.assertIn("| १ | कार्यालय | १२३ |", markdown)

    def test_serial_column_normalization_repairs_isolated_ocr_errors(self):
        matrix = [
            ["क्र.सं.", "विवरण"],
            ["१", "क"],
            ["२", "ख"],
            ["छ", "ग"],
            ["४", "घ"],
            ["५", "ङ"],
        ]

        self.assertTrue(parser.normalize_serial_column(matrix))
        self.assertEqual([row[0] for row in matrix[1:]], ["१", "२", "३", "४", "५"])

    def test_serial_column_rejects_oversized_merged_ocr_cell(self):
        matrix = [
            ["क्र.सं.", "विवरण"],
            ["९" * 6159, "merged OCR content"],
            ["२", "ख"],
            ["३", "ग"],
            ["४", "घ"],
            ["५", "ङ"],
        ]

        self.assertFalse(parser.normalize_serial_column(matrix))
        self.assertEqual(len(matrix[1][0]), 6159)

    def test_page_batches_cover_selected_range_without_overlap(self):
        self.assertEqual(
            parser.iter_page_batches(28, 35, 3),
            [(28, 30), (31, 33), (34, 35)],
        )
        self.assertEqual(parser.iter_page_batches(28, 35, 0), [(28, 35)])

    def test_missing_page_batches_skip_existing_pages_and_preserve_holes(self):
        self.assertEqual(
            parser.iter_missing_page_batches(
                898,
                910,
                4,
                {898, 899, 900, 904, 905},
            ),
            [(901, 903), (906, 909), (910, 910)],
        )

    def test_selected_page_span_clamps_to_pdf_page_count(self):
        self.assertEqual(parser.selected_page_span(100, None, (90, 120)), (90, 100))
        self.assertEqual(parser.selected_page_span(100, 12, None), (1, 12))
        with self.assertRaises(ValueError):
            parser.selected_page_span(100, None, (101, 105))

    def test_streamed_structure_is_valid_json(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            package_dir = Path(temp_dir)
            spool_path = package_dir / "nodes.ndjson"
            spool_path.write_text(
                '\n'.join(
                    json.dumps(node, ensure_ascii=False)
                    for node in (
                        {"id": "doc", "parent": None, "type": "document"},
                        {"id": "b0001_para_1", "parent": "doc", "type": "paragraph"},
                    )
                )
                + "\n",
                encoding="utf-8",
            )

            parser.write_structure_from_spool(package_dir, "doc", spool_path)

            structure = json.loads((package_dir / "structure.json").read_text(encoding="utf-8"))
            self.assertEqual(structure["document_id"], "doc")
            self.assertEqual(len(structure["nodes"]), 2)
            self.assertTrue((package_dir / "structure.raw.json").exists())
            self.assertTrue((package_dir / "structure.clean.json").exists())

    def test_resume_helpers_load_pages_and_continue_batch_ids(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            package_dir = Path(temp_dir)
            pages_dir = package_dir / "pages"
            pages_dir.mkdir()
            for filename in (
                "page_899.json",
                "page_900.json",
                "page_900.clean.json",
                "page_900.raw.json",
            ):
                (pages_dir / filename).write_text("{}", encoding="utf-8")
            structure = {
                "document_id": "doc",
                "nodes": [
                    {"id": "doc", "type": "document"},
                    {"id": "b0018_para_1", "type": "paragraph", "page": 900},
                ],
            }
            (package_dir / "structure.json").write_text(
                json.dumps(structure),
                encoding="utf-8",
            )
            spool_path = package_dir / ".structure.nodes.ndjson"

            nodes = parser.load_structure_spool(package_dir, spool_path)

            self.assertEqual(parser.package_page_numbers(package_dir), {899, 900})
            self.assertEqual(parser.next_batch_index(nodes), 19)
            self.assertTrue(spool_path.exists())


if __name__ == "__main__":
    unittest.main()
