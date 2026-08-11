from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
from statistics import fmean
from typing import Any

from .config import RAGSettings
from .rag import RAGService


METRIC_NAMES = (
    "faithfulness",
    "answer_relevancy",
    "factual_correctness",
    "context_precision",
    "context_recall",
)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Evaluate the RAG pipeline with RAGAS.")
    parser.add_argument(
        "dataset",
        type=Path,
        help="JSON or JSONL cases with query/question and reference/ground_truth fields.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("ragas_results.json"),
        help="Destination for per-case scores and summary metrics.",
    )
    parser.add_argument("--limit", type=int, help="Evaluate only the first N cases.")
    parser.add_argument("--k", type=int, help="Override retrieval result count.")
    parser.add_argument("--alpha", type=float, help="Override hybrid dense weight.")
    return parser


def load_cases(path: Path) -> list[dict[str, Any]]:
    if path.suffix.lower() == ".jsonl":
        values = [
            json.loads(line)
            for line in path.read_text(encoding="utf-8").splitlines()
            if line.strip()
        ]
    else:
        values = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(values, list):
        raise ValueError("Evaluation dataset must be a JSON array or JSONL records.")

    cases: list[dict[str, Any]] = []
    for index, value in enumerate(values, start=1):
        if not isinstance(value, dict):
            raise ValueError(f"Evaluation case {index} must be an object.")
        query = value.get("query") or value.get("question")
        reference = value.get("reference") or value.get("ground_truth")
        if not query or not reference:
            raise ValueError(
                f"Evaluation case {index} needs query/question and reference/ground_truth."
            )
        cases.append({"query": str(query), "reference": str(reference)})
    return cases


def evaluate_cases(
    cases: list[dict[str, Any]],
    settings: RAGSettings,
    *,
    k: int | None,
    alpha: float | None,
) -> tuple[dict[str, float], list[dict[str, Any]]]:
    try:
        from google import genai
        from ragas import EvaluationDataset, evaluate
        from ragas.llms import llm_factory
        from ragas.metrics import (
            AnswerRelevancy,
            ContextPrecision,
            ContextRecall,
            FactualCorrectness,
            Faithfulness,
        )
    except ImportError as exc:
        raise RuntimeError(
            "RAGAS dependencies are missing. Install requirements.txt first."
        ) from exc

    service = RAGService(settings)
    samples: list[dict[str, Any]] = []
    for number, case in enumerate(cases, start=1):
        print(f"Generating answer {number}/{len(cases)}: {case['query']}")
        answer = service.answer(case["query"], k=k, alpha=alpha)
        samples.append(
            {
                "user_input": case["query"],
                "response": answer.content,
                "retrieved_contexts": [source.text for source in answer.sources],
                "reference": case["reference"],
            }
        )

    client = genai.Client(api_key=settings.require_gemini_key())
    evaluator_llm = llm_factory(
        settings.ragas_evaluator_model,
        provider="google",
        client=client,
        temperature=0.0,
    )
    metrics = [
        Faithfulness(llm=evaluator_llm),
        AnswerRelevancy(llm=evaluator_llm),
        FactualCorrectness(llm=evaluator_llm),
        ContextPrecision(llm=evaluator_llm),
        ContextRecall(llm=evaluator_llm),
    ]
    result = evaluate(
        dataset=EvaluationDataset.from_list(samples),
        metrics=metrics,
        llm=evaluator_llm,
        embeddings=service.embeddings,
    )
    records = result.to_pandas().to_dict(orient="records")
    summary: dict[str, float] = {}
    for name in METRIC_NAMES:
        values = [
            float(record[name])
            for record in records
            if record.get(name) is not None and math.isfinite(float(record[name]))
        ]
        if values:
            summary[name] = fmean(values)
    return summary, records


def main() -> None:
    args = build_parser().parse_args()
    settings = RAGSettings()
    settings.validate()
    cases = load_cases(args.dataset)
    if args.limit is not None:
        if args.limit < 1:
            raise ValueError("--limit must be positive.")
        cases = cases[: args.limit]
    summary, records = evaluate_cases(
        cases, settings, k=args.k, alpha=args.alpha
    )
    payload = {"summary": summary, "samples": records}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2, default=str),
        encoding="utf-8",
    )
    print(json.dumps(summary, indent=2))
    print(f"Detailed results written to {args.output}.")


if __name__ == "__main__":
    main()
