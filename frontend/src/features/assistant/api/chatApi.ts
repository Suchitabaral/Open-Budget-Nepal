export type ChatSource = {
  id: string;
  score: number;
  text: string;
  documentId: string;
  documentName: string;
  page: number;
  section: string;
  sourcePath: string;
};

export type ChatResponse = {
  query: string;
  content: string;
  detectedLanguage: string;
  sources: ChatSource[];
};

export class ChatServiceError extends Error {
  readonly status: number | null;
  constructor(message: string, status: number | null) { super(message); this.name = "ChatServiceError"; this.status = status; }
}

const ragBaseUrl = (import.meta.env.VITE_RAG_API_BASE_URL || "http://localhost:8000/api/v1").replace(/\/$/, "");

export async function askBudgetAssistant(query: string, signal?: AbortSignal): Promise<ChatResponse> {
  let response: Response;
  try {
    response = await fetch(`${ragBaseUrl}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ChatServiceError("The assistant service cannot be reached.", null);
  }

  const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
  if (!response.ok) {
    const detail = typeof payload?.detail === "string" ? payload.detail : `Chat request failed with status ${response.status}.`;
    throw new ChatServiceError(detail, response.status);
  }

  const rawSources = Array.isArray(payload?.sources) ? payload.sources : [];
  return {
    query: String(payload?.query ?? query),
    content: String(payload?.content ?? ""),
    detectedLanguage: String(payload?.detected_language ?? ""),
    sources: rawSources.map((item) => {
      const source = item as Record<string, unknown>;
      return {
        id: String(source.id ?? ""),
        score: Number(source.score ?? 0),
        text: String(source.text ?? ""),
        documentId: String(source.document_id ?? ""),
        documentName: String(source.document_name ?? ""),
        page: Number(source.page ?? -1),
        section: String(source.section ?? ""),
        sourcePath: String(source.source_path ?? ""),
      };
    }),
  };
}
