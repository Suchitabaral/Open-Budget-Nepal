import { Search, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { DirectoryFilters, DirectoryMetadata } from "@/features/contractors/api/contractorDirectoryApi";
import { useTranslation, type MessageKey } from "@/features/preferences/translations";

type Props = { filters: DirectoryFilters; metadata: DirectoryMetadata | null; onChange: (key: keyof DirectoryFilters, value: string | number) => void };

export default function DirectoryControls({ filters, metadata, onChange }: Props) {
  const t = useTranslation();
  return <div className="border-b border-slate-200 bg-white p-4"><div className="flex items-center gap-2 text-sm font-semibold text-slate-900"><SlidersHorizontal className="h-4 w-4 text-emerald-700"/>{t("searchAndFilters")}</div><div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4"><label className="relative xl:col-span-2"><span className="sr-only">{t("contractorName")}</span><Search className="absolute left-3 top-3 h-4 w-4 text-slate-500"/><Input value={filters.search} onChange={event => onChange("search", event.target.value)} className="pl-9" placeholder={t("searchContractorName")}/></label><label><span className="sr-only">{t("pan")}</span><Input value={filters.pan} inputMode="numeric" onChange={event => onChange("pan", event.target.value.replace(/\D/g, ""))} placeholder={t("searchPan")}/></label><Filter value={filters.category} label="allContractCategories" options={metadata?.categories ?? []} onChange={value => onChange("category", value)}/></div><div className="mt-3 flex flex-wrap gap-3"><Filter value={filters.fiscalYear} label="allContractFiscalYears" options={metadata?.fiscalYears ?? []} onChange={value => onChange("fiscalYear", value)}/><Filter value={filters.sort} label="nameAz" options={["name_desc"]} optionLabels={{ name_desc: "nameZa" }} onChange={value => onChange("sort", value)}/></div></div>;
}

function Filter({ value, label, options, onChange, optionLabels = {} }: { value: string; label: MessageKey; options: string[]; onChange: (value: string) => void; optionLabels?: Record<string, MessageKey> }) {
  const t = useTranslation();
  return <select value={value} onChange={event => onChange(event.target.value)} className="h-10 min-w-44 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15"><option value="all">{t(label)}</option>{options.map(option => <option key={option} value={option}>{optionLabels[option] ? t(optionLabels[option]) : option}</option>)}</select>;
}
