from __future__ import annotations

import unittest
from dataclasses import replace

from rag_service.config import RAGSettings
from rag_service.gemini import GeminiGenerator


class _ProviderError(Exception):
    status_code = 404


class _FailingModels:
    def generate_content(self, **kwargs):
        raise _ProviderError("model not found")


class _FailingClient:
    models = _FailingModels()


class GeminiGeneratorTests(unittest.TestCase):
    def test_model_not_found_becomes_actionable_runtime_error(self) -> None:
        settings = replace(RAGSettings(), gemini_model="retired-model")
        generator = GeminiGenerator(settings, client=_FailingClient())

        with self.assertRaisesRegex(
            RuntimeError, "retired-model.*GEMINI_MODEL.*gemini-3.6-flash"
        ):
            generator.answer(query="test", context="context", detected_language="english")


if __name__ == "__main__":
    unittest.main()
