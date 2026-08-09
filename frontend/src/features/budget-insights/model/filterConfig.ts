import rawConfig from "@/features/budget-insights/config/filter-definitions.json";

export type InsightScope = "federal" | "provincial" | "local";
export type FilterOption = { id: string; label: string };
type FilterConfig = typeof rawConfig;

export const filterConfig: FilterConfig = rawConfig;
export const fiscalYears = rawConfig.common.fiscalYears;
export const provinces: FilterOption[] = ["Koshi", "Madhesh", "Bagmati", "Gandaki", "Lumbini", "Karnali", "Sudurpashchim"].map(value => ({ id: value.toLowerCase(), label: value }));

const componentById = new Map(rawConfig.components.map(item => [item.id, item] as const));
const subcomponentById = new Map(rawConfig.subcomponents.map(item => [item.id, item] as const));
const subSubcomponentById = new Map(rawConfig.subSubcomponents.map(item => [item.id, item] as const));
const allOption: FilterOption = { id: "all", label: "All" };

export function typeOptions(scope: InsightScope): FilterOption[] {
  const allowed = new Set(rawConfig.scopes[scope].types);
  return rawConfig.common.types.filter(item => allowed.has(item.id));
}

export function componentOptions(scope: InsightScope): FilterOption[] {
  return [allOption, ...rawConfig.scopes[scope].components.flatMap(id => {
    const item = componentById.get(id);
    return item ? [{ id: item.id, label: item.label }] : [];
  })];
}

export function subcomponentOptions(scope: InsightScope, componentId: string): FilterOption[] {
  const ids = componentId === "all"
    ? rawConfig.scopes[scope].components.flatMap(id => componentById.get(id)?.children ?? [])
    : componentById.get(componentId)?.children ?? [];
  if (scope === "local") ids.push("federal_transfer", "provincial_transfer");
  return [allOption, ...Array.from(new Set(ids)).flatMap(id => {
    const item = subcomponentById.get(id);
    return item ? [{ id: item.id, label: item.label }] : [];
  })];
}

export function subSubcomponentOptions(scope: InsightScope, subcomponentId: string): FilterOption[] {
  const ids = subcomponentId === "all"
    ? subcomponentOptions(scope, "all").slice(1).flatMap(item => subcomponentById.get(item.id)?.children ?? [])
    : subcomponentById.get(subcomponentId)?.children ?? [];
  return [allOption, ...Array.from(new Set(ids)).flatMap(id => {
    const item = subSubcomponentById.get(id);
    return item ? [{ id: item.id, label: item.label }] : [];
  })];
}
