from __future__ import annotations

import json
import math
import unicodedata
from collections import Counter
from pathlib import Path
from typing import Iterable

import mmh3
import regex


SparseVector = dict[str, list[int] | list[float]]
TOKEN_PATTERN = regex.compile(
    r"[\p{L}\p{M}\p{N}]+(?:[.'’_-][\p{L}\p{M}\p{N}]+)*"
)
DEVANAGARI_DIGITS = str.maketrans("०१२३४५६७८९", "0123456789")
ASCII_DIGITS = str.maketrans("0123456789", "०१२३४५६७८९")


class MultilingualBM25Encoder:
    """BM25 sparse encoder with Unicode tokenization and Nepali digit aliases."""

    format_version = 1

    def __init__(self, b: float = 0.75, k1: float = 1.2) -> None:
        self.b = b
        self.k1 = k1
        self.document_frequency: dict[int, int] = {}
        self.document_count = 0
        self.average_document_length = 0.0

    @property
    def fitted(self) -> bool:
        return self.document_count > 0 and self.average_document_length > 0

    def fit(self, texts: Iterable[str]) -> "MultilingualBM25Encoder":
        document_frequency: Counter[int] = Counter()
        document_count = 0
        total_length = 0

        for text in texts:
            token_hashes = self._token_hashes(text)
            if not token_hashes:
                continue
            document_count += 1
            total_length += len(token_hashes)
            document_frequency.update(set(token_hashes))

        if document_count == 0:
            raise ValueError("Cannot fit BM25 on an empty corpus.")
        self.document_frequency = dict(document_frequency)
        self.document_count = document_count
        self.average_document_length = total_length / document_count
        return self

    def encode_documents(self, texts: list[str]) -> list[SparseVector]:
        self._require_fitted()
        return [self._encode_document(text) for text in texts]

    def encode_query(self, text: str) -> SparseVector:
        self._require_fitted()
        counts = Counter(self._token_hashes(text))
        indices = list(counts)
        if not indices:
            return {"indices": [], "values": []}

        idf_values = [
            math.log(
                (self.document_count + 1)
                / (self.document_frequency.get(index, 0) + 0.5)
            )
            for index in indices
        ]
        total = sum(idf_values)
        if total <= 0:
            return {"indices": indices, "values": [0.0] * len(indices)}
        return {"indices": indices, "values": [value / total for value in idf_values]}

    def dump(self, path: Path) -> None:
        self._require_fitted()
        path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "format_version": self.format_version,
            "b": self.b,
            "k1": self.k1,
            "document_count": self.document_count,
            "average_document_length": self.average_document_length,
            "document_frequency": {
                str(index): value for index, value in self.document_frequency.items()
            },
        }
        path.write_text(
            json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
            encoding="utf-8",
        )

    @classmethod
    def load(cls, path: Path) -> "MultilingualBM25Encoder":
        if not path.is_file():
            raise FileNotFoundError(
                f"BM25 parameters not found at {path}. Run the ingestion command first."
            )
        payload = json.loads(path.read_text(encoding="utf-8"))
        if payload.get("format_version") != cls.format_version:
            raise ValueError(f"Unsupported BM25 parameter format in {path}")
        encoder = cls(b=float(payload["b"]), k1=float(payload["k1"]))
        encoder.document_count = int(payload["document_count"])
        encoder.average_document_length = float(payload["average_document_length"])
        encoder.document_frequency = {
            int(index): int(value)
            for index, value in payload["document_frequency"].items()
        }
        encoder._require_fitted()
        return encoder

    def _encode_document(self, text: str) -> SparseVector:
        counts = Counter(self._token_hashes(text))
        document_length = sum(counts.values())
        if document_length == 0:
            return {"indices": [], "values": []}

        indices = list(counts)
        values = []
        length_normalization = 1.0 - self.b + self.b * (
            document_length / self.average_document_length
        )
        for index in indices:
            term_frequency = counts[index]
            values.append(
                term_frequency / (self.k1 * length_normalization + term_frequency)
            )
        return {"indices": indices, "values": values}

    @classmethod
    def tokenize(cls, text: str) -> list[str]:
        normalized = unicodedata.normalize("NFKC", text).casefold()
        tokens: list[str] = []
        for match in TOKEN_PATTERN.finditer(normalized):
            token = match.group(0)
            tokens.append(token)
            ascii_digits = token.translate(DEVANAGARI_DIGITS)
            devanagari_digits = token.translate(ASCII_DIGITS)
            if ascii_digits != token:
                tokens.append(ascii_digits)
            if devanagari_digits != token:
                tokens.append(devanagari_digits)
        return tokens

    @classmethod
    def _token_hashes(cls, text: str) -> list[int]:
        return [mmh3.hash(token, signed=False) for token in cls.tokenize(text)]

    def _require_fitted(self) -> None:
        if not self.fitted:
            raise ValueError("BM25 encoder is not fitted.")
