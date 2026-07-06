import importlib.util
import sys
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


if __name__ == "__main__":
    unittest.main()
