from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from rag_service.sparse import MultilingualBM25Encoder


class MultilingualBM25EncoderTests(unittest.TestCase):
    def test_tokenizer_preserves_nepali_and_aliases_digits(self) -> None:
        tokens = MultilingualBM25Encoder.tokenize("बजेट २०८१/८२ र budget 2080")

        self.assertIn("बजेट", tokens)
        self.assertIn("२०८१", tokens)
        self.assertIn("2081", tokens)
        self.assertIn("2080", tokens)
        self.assertIn("२०८०", tokens)

    def test_dump_load_round_trip(self) -> None:
        texts = [
            "नेपालको बजेट २०८१ मा शिक्षा खर्च",
            "Nepal ko budget 2081 ma shiksha kharcha",
            "Education expenditure in Nepal budget 2081",
        ]
        encoder = MultilingualBM25Encoder().fit(texts)

        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "bm25.json"
            encoder.dump(path)
            restored = MultilingualBM25Encoder.load(path)

        self.assertEqual(
            encoder.encode_query("बजेट 2081"),
            restored.encode_query("बजेट 2081"),
        )
        self.assertEqual(
            encoder.encode_documents(texts), restored.encode_documents(texts)
        )


if __name__ == "__main__":
    unittest.main()
