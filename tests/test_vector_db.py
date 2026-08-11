from __future__ import annotations

import tempfile
import unittest
from dataclasses import replace
from pathlib import Path

from rag_service.config import RAGSettings
from rag_service.documents import DocumentChunk
from rag_service.vector_db import HybridPineconeStore


class _FakeEmbeddings:
    def embed_documents(self, texts):
        return [[1.0, 0.0] for _ in texts]

    def embed_query(self, text):
        return [1.0, 0.0]


class _FakeIndex:
    def __init__(self):
        self.upserts = []
        self.deletes = []
        self.query_args = None

    def describe_index_stats(self):
        return {"namespaces": {}}

    def delete(self, **kwargs):
        self.deletes.append(kwargs)

    def upsert(self, **kwargs):
        self.upserts.append(kwargs)
        return {"upserted_count": len(kwargs["vectors"])}

    def query(self, **kwargs):
        self.query_args = kwargs
        return {
            "matches": [
                {
                    "id": "chunk-1",
                    "score": 0.9,
                    "metadata": {
                        "text": "retrieved text",
                        "document_id": "doc-1",
                        "document_name": "Document 1",
                        "page": 4,
                    },
                }
            ]
        }


class _FakePinecone:
    def __init__(self):
        self.index = _FakeIndex()

    def has_index(self, name):
        return True

    def describe_index(self, name):
        return {
            "dimension": 2,
            "metric": "dotproduct",
            "status": {"ready": True},
        }

    def Index(self, name):
        return self.index


class HybridPineconeStoreTests(unittest.TestCase):
    def test_upsert_and_search_send_dense_and_sparse_vectors(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            settings = replace(
                RAGSettings(),
                embedding_dimension=2,
                pinecone_upsert_batch_size=2,
                bm25_params_path=Path(directory) / "bm25.json",
            )
            client = _FakePinecone()
            store = HybridPineconeStore(settings, _FakeEmbeddings(), client=client)
            chunks = [
                DocumentChunk(
                    id="chunk-1",
                    text="नेपाल बजेट २०८१",
                    metadata={"document_id": "doc-1", "page": 4},
                ),
                DocumentChunk(
                    id="chunk-2",
                    text="Nepal budget 2081",
                    metadata={"document_id": "doc-1", "page": 5},
                ),
            ]

            count = store.upsert_chunks(chunks, replace_documents=False)
            results = store.search("budget २०८१", k=3, alpha=0.6)

            self.assertEqual(count, 2)
            self.assertEqual(client.index.deletes, [])
            self.assertTrue(settings.bm25_params_path.is_file())
            vector = client.index.upserts[0]["vectors"][0]
            self.assertIn("values", vector)
            self.assertIn("sparse_values", vector)
            self.assertIn("text", vector["metadata"])
            self.assertEqual(client.index.query_args["vector"], [0.6, 0.0])
            self.assertIn("sparse_vector", client.index.query_args)
            self.assertEqual(results[0].text, "retrieved text")
            self.assertNotIn("text", results[0].metadata)


if __name__ == "__main__":
    unittest.main()
