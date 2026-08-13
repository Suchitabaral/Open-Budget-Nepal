import type { InsightScope } from "@/features/budget-insights/model/filterConfig";
import mockData from "@/features/budget-insights/data/mock-insights.json";
import { administrativeRegistry } from "@/features/budget-insights/data/administrativeRegistry";

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

export function getMockBudgetInsights(scope: InsightScope, indicator: string): BudgetInsightResponse {
  const fixture = mockData[scope];
  const normalize = (items: InsightSeries[]) => {
    if (indicator !== "percentage") return items;
    const total = items.reduce((sum, item) => sum + item.value, 0);
    return items.map(item => ({ ...item, value: total ? (item.value / total) * 100 : 0 }));
  };
  return { scope, unit: indicator === "percentage" ? "percentage" : "npr_million", components: normalize(fixture.components), subcomponents: normalize(fixture.subcomponents), subSubcomponents: normalize(fixture.subSubcomponents), trend: fixture.trend, source: "mock" };
}

export function getMockBudgetInsightMetadata() {
  return {
    provinces: administrativeRegistry.provinces.map(item => item.label),
    municipalities: administrativeRegistry.localLevels.map(item => item.nameEn),
  };
}
