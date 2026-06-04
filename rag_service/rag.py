from pinecone import Pinecone, ServerlessSpec
from dotenv import load_dotenv
from langchain_huggingface import HuggingFaceEmbeddings, HuggingFaceEndpoint
from langchain_community.document_loaders import TextLoader
from langchain_text_splitters import (
    RecursiveCharacterTextSplitter,
)
from langchain_pinecone import PineconeVectorStore
from langchain_huggingface.chat_models.huggingface import ChatHuggingFace
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_core.prompts.prompt import PromptTemplate
import os

load_dotenv()
hugging_api_key = os.getenv("HUGGING_FACE_API_KEY")
pinecone_api_key = os.getenv("PINECONE_API_KEY")
docs = None
TXT_DIR = "data/"


class ChatBot:
    docs = None
    embeddings = HuggingFaceEmbeddings(
        model_name="sentence-transformers/all-mpnet-base-v2",
        model_kwargs={"device":"cpu"},
        encode_kwargs={"normalize_embeddings":True}
    )

    pc = Pinecone(api_key=pinecone_api_key)
    index_name = os.getenv("PINECONE_INDEX_NAME") or "budgetrag"
    index=None
    vector_store = None

    # repo_id = "mistralai/Mixtral-8x7B-Instruct-v0.1"
    # llm = HuggingFaceEndpoint(
    #     repo_id=repo_id,
    #     temperature=0.8,
    #     top_k=50,
    #     huggingfacehub_api_token=hugging_api_key,
    # )

    llm = HuggingFaceEndpoint(
        repo_id="meta-llama/Meta-Llama-3.1-8B-Instruct",
        max_new_tokens=512,
        temperature=0.1,
        huggingfacehub_api_token=os.getenv("HUGGING_FACE_API_KEY"),
    )

    chat = ChatHuggingFace(llm=llm, verbose=True)

    system_template = PromptTemplate.from_template(
        "You are a specialized assistant for legal, policy, and national financial inquiries. "
        "You must answer questions solely based on the provided context below. "
        "If the answer cannot be found in the context, strictly state that you cannot answer based on the available information. "
        "\n\nContext:\n{context}"
    )

    @classmethod
    def load_split_docs(cls):
        cls.docs = []
        for filename in os.listdir(TXT_DIR):
            if filename.endswith(".txt"):
                file_path = os.path.join(TXT_DIR, filename)
                loader = TextLoader(file_path)
                documents = loader.load()
                text_splitter = RecursiveCharacterTextSplitter(
                    chunk_size=500, chunk_overlap=100
                )
                cls.docs.extend(text_splitter.split_documents(documents))

    @classmethod
    def connect_create_index(cls):
        if not cls.pc.has_index(cls.index_name):
            cls.pc.create_index(
                name=cls.index_name,
                dimension=768,
                metric="cosine",
                spec=ServerlessSpec(
                    cloud="aws",
                    region="us-east-1",
                ),
            )

        else:
            print(f"{cls.index_name} has already been created")

        cls.index = cls.pc.Index(cls.index_name, pool_threads=30)

        if cls.index is not None:
            cls.vector_store = PineconeVectorStore(
                embedding=cls.embeddings, index=cls.index
            )
            print("connected")
        else:
            print("Error while connecting to index.")
            exit(0)

    @classmethod
    def create_chunks(cls, vector, batch_size):
        for i in range(0, len(vector), batch_size):
            yield vector[i : i + batch_size]  # pyright: ignore[]

    @classmethod
    def create_store_embeddings(cls):
        cls.load_split_docs()
        if cls.docs is None:
            print("Error while loading and chunking docs")

        doc_texts = [doc.page_content for doc in cls.docs]
        doc_text_embedded = cls.embeddings.embed_documents(doc_texts)

        cls.connect_create_index()

        print(f"len of docs: {len(cls.docs)}")
        vectors = []
        for i, (doc, embedding) in enumerate(
            zip(cls.docs, doc_text_embedded)
        ):  # pyright: ignore[]
            vector_id = f"doc_{i}"
            metadata = {"text": doc.page_content, **doc.metadata}
            vectors.append({"id": vector_id, "values": embedding, "metadata": metadata})

        # upserted_response = cls.index.upsert(
        #     vector_to_upsert, namespace="codefest2025"
        # )  # pyright: ignore[]
        # if hasattr(upserted_response, "upsertedCount"):
        #     print(f"Successfully upserted {upserted_response.upserted_count} vectors")
        #     if upserted_response.upserted_count == len(vector_to_upsert):
        #         print("Successfully Upserted all vectors!!")
        #     else:
        #         print(
        #             f"Warning!! total vectors: {len(vector_to_upsert)}, upserted: {upserted_response["upserted_count"]}"
        #         )
        #
        async_results = [
            cls.index.upsert(
                vectors=vector_chunk, async_req=True, namespace="codefest2025"
            )
            for vector_chunk in cls.create_chunks(vectors, batch_size=100)
        ]

        upserted_response = cls.index.upsert(
            vector_to_upsert, namespace="codefest2025"
        )  # pyright: ignore[]
        if hasattr(upserted_response, "upsertedCount"):
            print(f"Successfully upserted {upserted_response.upserted_count} vectors")
            if upserted_response.upserted_count == len(vector_to_upsert):
                print("Successfully Upserted all vectors!!")
            else:
                print(
                    f"Warning!! total vectors: {len(vector_to_upsert)}, upserted: {upserted_response.upserted_count}"
                )

    @classmethod
    def retrieve_query(cls, query_text, k=3):
        cls.connect_create_index()
        retrieved_docs = cls.vector_store.similarity_search(
            query_text, namespace="codefest2025", k=3
        )
        context = "\n\n".join(doc.page_content for doc in retrieved_docs)
        return context

    @classmethod
    def llm_invoke(cls, query: str):
        context = cls.retrieve_query(query)

        messages = [
            SystemMessage(content=cls.system_template.format(context=context)),
            HumanMessage(content=query),
        ]

        print(messages)
        response = cls.chat.invoke(messages)

        print(response)
        print(response.content)
        print(context)
        return response.content, context


if __name__ == "__main__":
    query = input("Enter query: ")
    ChatBot.llm_invoke(query)
