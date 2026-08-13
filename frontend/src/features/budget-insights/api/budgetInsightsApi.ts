import type { InsightScope } from "@/features/budget-insights/model/filterConfig";

export type BudgetInsightFilters = {
  fiscalYear: string;
  type: string;
  indicator: string;
  category: string;
  subcategory: string;
  component: string;
  subcomponent: string;
  subSubcomponent: string;
  province?: string;
  municipality?: string;
  municipalityCode?: string;
  municipalityType?: string;
};

export type InsightSeries = { name: string; value: number };
export type InsightTrend = { fiscalYear: string; budget: number | null; actual: number | null };
export type BudgetInsightResponse = {
  scope: InsightScope;
  unit: "npr_million" | "percentage";
  components: InsightSeries[];
  subcomponents: InsightSeries[];
  subSubcomponents: InsightSeries[];
  trend: InsightTrend[];
  source: "api" | "mock";
  metadata?: { limitation?: string; sources?: Array<{ coverage: string; title: string }> };
};

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001/api";

export async function fetchBudgetInsights(scope: InsightScope, filters: BudgetInsightFilters, signal: AbortSignal) {
  // TODO(api): Keep this as the single frontend integration boundary. If the
  // backend route changes, replace it here rather than inside UI components.
  const params = new URLSearchParams({ scope, ...Object.fromEntries(Object.entries(filters).filter(([, value]) => Boolean(value))) });
  const response = await fetch(`${apiBaseUrl}/budget-insights?${params}`, { signal });
  if (!response.ok) throw new Error(`Budget insights request failed (${response.status})`);
  const data = await response.json() as Omit<BudgetInsightResponse, "source">;
  return { ...data, source: "api" as const };
}

export async function fetchBudgetInsightMetadata(signal: AbortSignal) {
  // TODO(api): Dynamic dimensions belong in the database. Replace only this
  // endpoint when municipality/province metadata moves to a dedicated service.
  const response = await fetch(`${apiBaseUrl}/budget-insights/metadata`, { signal });
  if (!response.ok) throw new Error(`Budget metadata request failed (${response.status})`);
  return response.json() as Promise<{ provinces: string[]; municipalities: string[] }>;
}
