from __future__ import annotations

import argparse
import logging
from dataclasses import replace
from pathlib import Path

from .config import RAGSettings
from .documents import ParsedDocumentLoader
from .rag import RAGService


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Index parsed Open Budget Nepal documents in Pinecone."
    )
    parser.add_argument(
        "--documents-root",
        type=Path,
        help="Override PARSED_DOCUMENTS_DIR.",
    )
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Delete the configured namespace before upserting the complete corpus.",
    )
    parser.add_argument(
        "--no-replace",
        action="store_true",
        help="Do not delete existing vectors document-by-document before upserting.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Parse and count chunks without loading models or contacting Pinecone.",
    )
    return parser


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    args = build_parser().parse_args()
    settings = RAGSettings()
    if args.documents_root:
        settings = replace(settings, parsed_documents_dir=args.documents_root)
    settings.validate()

    chunks = ParsedDocumentLoader(settings).load_chunks()
    document_count = len({chunk.metadata["document_id"] for chunk in chunks})
    print(f"Prepared {len(chunks)} chunks from {document_count} parsed documents.")
    if args.dry_run:
        return

    service = RAGService(settings)
    upserted = service.ingest_chunks(
        chunks,
        reset_namespace=args.reset,
        replace_documents=not args.no_replace,
    )
    print(
        f"Upserted {upserted} hybrid vectors into "
        f"{settings.pinecone_index_name}/{settings.pinecone_namespace}."
    )
    print(f"BM25 parameters saved to {settings.bm25_params_path}.")


if __name__ == "__main__":
    main()
