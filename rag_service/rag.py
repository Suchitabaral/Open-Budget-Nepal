from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable, Sequence

from dotenv import load_dotenv
from langchain_community.document_loaders import TextLoader
from langchain_core.documents import Document
from langchain_core.embeddings import Embeddings
from langchain_core.prompts.prompt import PromptTemplate
from langchain_ollama.llms import OllamaLLM
from langchain_pinecone import PineconeVectorStore
from langchain_text_splitters import RecursiveCharacterTextSplitter
from pinecone import Pinecone, ServerlessSpec
from pinecone_text.sparse import BM25Encoder
from sentence_transformers import SentenceTransformer

load_dotenv()


@dataclass(frozen=True)
class RAGSettings:
    data_dir: Path = Path(os.getenv("RAG_TXT_DIR", "data/"))
    namespace: str = os.getenv("PINECONE_NAMESPACE", "codefest2025")
    index_name: str = os.getenv("PINECONE_INDEX_NAME", "budgetrag")
    pinecone_api_key: str | None = os.getenv("PINECONE_API_KEY")
    pinecone_cloud: str = os.getenv("PINECONE_CLOUD", "aws")
    pinecone_region: str = os.getenv("PINECONE_REGION", "us-east-1")
    embedding_model_name: str = os.getenv(
        "EMBEDDING_MODEL_NAME", "intfloat/multilingual-e5-base"
    )
    embedding_dimension: int = int(os.getenv("EMBEDDING_DIMENSION", "768"))
    chunk_size: int = int(os.getenv("RAG_CHUNK_SIZE", "500"))
    chunk_overlap: int = int(os.getenv("RAG_CHUNK_OVERLAP", "100"))
    batch_size: int = int(os.getenv("PINECONE_UPSERT_BATCH_SIZE", "100"))
    retrieval_k: int = int(os.getenv("RAG_RETRIEVAL_K", "3"))
    ollama_model: str = os.getenv("OLLAMA_MODEL", "qwen2.5:7b-instruct")
    ollama_base_url: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    ollama_temperature: float = float(os.getenv("OLLAMA_TEMPERATURE", "0.1"))

class SparseEnocoder(Embeddings):
    def __init__(self) -> None:
        self.encoder = BM25Encoder().default()
        
    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return self._encode(texts)

    def _encode(self, texts:Sequence[str]) -> list[list[float]]:
        embeddings = self.encoder.fit(texts)
        return embeddings.tolist()

class SentenceTransformerEmbeddings(Embeddings):
    def __init__(self, model_name: str) -> None:
        self.model = SentenceTransformer(model_name)

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return self._encode([self._passage_text(text) for text in texts])

    def embed_query(self, text: str) -> list[float]:
        return self._encode([self._query_text(text)])[0]

    def _encode(self, texts: Sequence[str]) -> list[list[float]]:
        embeddings = self.model.encode(texts, normalize_embeddings=True)
        return embeddings.tolist()

    @staticmethod
    def _passage_text(text: str) -> str:
        return text if text.startswith("passage: ") else f"passage: {text}"

    @staticmethod
    def _query_text(text: str) -> str:
        return text if text.startswith("query: ") else f"query: {text}"


class DocumentLoader:
    def __init__(self, settings: RAGSettings) -> None:
        self.settings = settings
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=settings.chunk_size,
            chunk_overlap=settings.chunk_overlap,
        )

    def load_split_documents(self) -> list[Document]:
        documents: list[Document] = []

        for text_file in sorted(self.settings.data_dir.glob("*.txt")):
            loaded_documents = TextLoader(str(text_file)).load()
            documents.extend(self.text_splitter.split_documents(loaded_documents))

        return documents


class PineconeIndex:
    def __init__(self, settings: RAGSettings, embeddings: Embeddings) -> None:
        self.settings = settings
        self.embeddings = embeddings
        self._client: Pinecone | None = None
        self._index: Any | None = None
        self._vector_store: PineconeVectorStore | None = None

    @property
    def index(self) -> Any:
        self.connect()
        return self._index

    @property
    def vector_store(self) -> PineconeVectorStore:
        self.connect()
        if self._vector_store is None:
            raise RuntimeError("Pinecone vector store was not initialized.")
        return self._vector_store

    def connect(self) -> None:
        if self._vector_store is not None:
            return

        if not self.settings.pinecone_api_key:
            raise RuntimeError("PINECONE_API_KEY is required to connect to Pinecone.")

        self._client = Pinecone(api_key=self.settings.pinecone_api_key)
        self._ensure_index()
        self._index = self._client.Index(self.settings.index_name, pool_threads=30)
        self._vector_store = PineconeVectorStore(
            embedding=self.embeddings,
            index=self._index,
        )

    def upsert_documents(self, documents: list[Document]) -> int:
        if not documents:
            return 0

        vectors = self._build_vectors(documents)
        async_results = [
            self.index.upsert(
                vectors=chunk,
                async_req=True,
                namespace=self.settings.namespace,
            )
            for chunk in self._chunks(vectors, self.settings.batch_size)
        ]

        return sum(result.get().upserted_count for result in async_results)

    def similarity_search(self, query: str, k: int) -> list[Document]:
        return self.vector_store.similarity_search(
            query,
            namespace=self.settings.namespace,
            k=k,
        )

    def _ensure_index(self) -> None:
        if self._client is None:
            raise RuntimeError("Pinecone client was not initialized.")

        if self._client.has_index(self.settings.index_name):
            return

        self._client.create_index(
            name=self.settings.index_name,
            dimension=self.settings.embedding_dimension,
            metric="dotproduct",
            spec=ServerlessSpec(
                cloud=self.settings.pinecone_cloud,
                region=self.settings.pinecone_region,
            ),
        )

    def _build_vectors(self, documents: list[Document]) -> list[dict[str, Any]]:
        embeddings = self.embeddings.embed_documents(
            [document.page_content for document in documents]
        )

        return [
            {
                "id": f"doc_{index}",
                "values": embedding,
                "metadata": {"text": document.page_content, **document.metadata},
            }
            for index, (document, embedding) in enumerate(zip(documents, embeddings))
        ]

    @staticmethod
    def _chunks(
        vector: list[dict[str, Any]],
        batch_size: int,
    ) -> Iterable[list[dict[str, Any]]]:
        for index in range(0, len(vector), batch_size):
            yield vector[index : index + batch_size]


class RAGService:
    system_template = PromptTemplate.from_template(
        "You are a specialized assistant for legal, policy, and national financial inquiries. "
        "You must answer questions solely based on the provided context below. "
        "If the answer cannot be found in the context, strictly state that you cannot answer "
        "based on the available information.\n\nContext:\n{context}"
    )

    def __init__(self, settings: RAGSettings | None = None) -> None:
        self.settings = settings or RAGSettings()
        self.document_loader = DocumentLoader(self.settings)
        self.embeddings = SentenceTransformerEmbeddings(
            self.settings.embedding_model_name
        )
        self.vector_index = PineconeIndex(self.settings, self.embeddings)
        self.llm = OllamaLLM(
            model=self.settings.ollama_model,
            base_url=self.settings.ollama_base_url,
            temperature=self.settings.ollama_temperature,
        )

    def create_store_embeddings(self) -> int:
        documents = self.document_loader.load_split_documents()
        upserted_count = self.vector_index.upsert_documents(documents)

        print(f"Loaded {len(documents)} document chunks")
        print(f"Successfully upserted {upserted_count} vectors")

        if upserted_count != len(documents):
            print(
                f"Warning: total vectors: {len(documents)}, "
                f"upserted: {upserted_count}"
            )

        return upserted_count

    def retrieve_query(self, query: str, k: int | None = None) -> str:
        query = self.embeddings._query_text(query)
        retrieved_documents = self.vector_index.similarity_search(
            query,
            k=k or self.settings.retrieval_k,
        )
        return self.format_context(retrieved_documents)

    def llm_invoke(self, query: str) -> tuple[str, str]:
        context = self.retrieve_query(query)
        prompt = self._build_prompt(query=query, context=context)
        response = self.llm.invoke(prompt)
        return str(response), context

    def _build_prompt(self, query: str, context: str) -> str:
        system_message = self.system_template.format(context=context)
        return f"{system_message}\n\nQuestion:\n{query}\n\nAnswer:"

    @staticmethod
    def format_context(documents: list[Document]) -> str:
        return "\n\n".join(document.page_content for document in documents)


class ChatBot:
    _service: RAGService | None = None

    @classmethod
    def service(cls) -> RAGService:
        if cls._service is None:
            cls._service = RAGService()
        return cls._service

    @classmethod
    def create_store_embeddings(cls) -> int:
        return cls.service().create_store_embeddings()

    @classmethod
    def retrieve_query(cls, query_text: str, k: int = 3) -> str:
        return cls.service().retrieve_query(query_text, k=k)

    @classmethod
    def llm_invoke(cls, query: str) -> tuple[str, str]:
        return cls.service().llm_invoke(query)


if __name__ == "__main__":
    user_query = input("Enter query: ")
    answer, source_context = ChatBot.llm_invoke(user_query)
    print(answer)
    print(source_context)
