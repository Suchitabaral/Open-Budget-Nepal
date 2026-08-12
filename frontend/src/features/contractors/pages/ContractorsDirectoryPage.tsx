import { useDeferredValue, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Database } from "lucide-react";
import { Link } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import PageHeader from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import DirectoryControls from "@/features/contractors/components/DirectoryControls";
import {
  getContractors,
  getDirectoryMetadata,
  type ContractorSummary,
  type DirectoryFilters,
  type DirectoryMetadata,
} from "@/features/contractors/api/contractorDirectoryApi";

const PAGE_SIZE = 20;
const initialFilters: DirectoryFilters = {
  search: "",
  pan: "",
  category: "all",
  fiscalYear: "all",
  page: 1,
  pageSize: PAGE_SIZE,
  sort: "all",
};

const formatMoney = (value: number) =>
  new Intl.NumberFormat("en-NP", {
    style: "currency",
    currency: "NPR",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);

function paginationItems(current: number, total: number): Array<number | string> {
  if (total <= 9) return Array.from({ length: total }, (_, index) => index + 1);
  const pages = new Set([1, 2, total - 1, total]);
  for (let page = current - 2; page <= current + 2; page += 1) {
    if (page > 0 && page <= total) pages.add(page);
  }
  const sorted = Array.from(pages).sort((a, b) => a - b);
  const items: Array<number | string> = [];
  sorted.forEach((page, index) => {
    if (index > 0 && page - sorted[index - 1] > 1) items.push(`ellipsis-${page}`);
    items.push(page);
  });
  return items;
}

export default function ContractorsDirectoryPage() {
  const [filters, setFilters] = useState(initialFilters);
  const deferredFilters = useDeferredValue(filters);
  const [metadata, setMetadata] = useState<DirectoryMetadata | null>(null);
  const [rows, setRows] = useState<ContractorSummary[]>([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: PAGE_SIZE, total: 0, pages: 0 });
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    const controller = new AbortController();
    getDirectoryMetadata(controller.signal).then(setMetadata).catch(() => undefined);
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    getContractors(deferredFilters, controller.signal)
      .then(result => {
        setRows(result.data);
        setPagination(result.pagination);
        setStatus("ready");
      })
      .catch(error => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setStatus("error");
      });
    return () => controller.abort();
  }, [deferredFilters]);

  const updateFilter = (key: keyof DirectoryFilters, value: string | number) => {
    setFilters(current => ({ ...current, [key]: value, page: key === "page" ? Number(value) : 1 }));
  };
  const firstSerial = (pagination.page - 1) * pagination.pageSize;

  return <Layout>
    <PageHeader title="Contractors directory" subtitle="Search public contract recipients by legal name or PAN, then inspect their awards and joint ventures." />
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <DirectoryControls filters={filters} metadata={metadata} onChange={updateFilter} />
      <div className="flex items-center justify-between border-b px-4 py-3 text-xs text-slate-600">
        <span>{pagination.total.toLocaleString()} contractor records</span>
        <span className="flex items-center gap-1.5"><Database className="h-3.5 w-3.5" />{metadata?.source.name ?? "Public procurement records"}</span>
      </div>

      {status === "loading" ? <div className="space-y-px bg-slate-100" aria-label="Loading contractors">
        {Array.from({ length: PAGE_SIZE }, (_, index) => <div key={index} className="h-16 animate-pulse bg-white" />)}
      </div> : status === "error" ? <div className="p-12 text-center text-sm text-red-700">The contractor API could not be reached. Confirm the backend is running and try again.</div> : rows.length === 0 ? <div className="p-12 text-center">
        <p className="font-medium text-slate-900">No contractors match these filters</p>
        <p className="mt-1 text-sm text-slate-600">Try a shorter name, remove the PAN, or clear a filter.</p>
      </div> : <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="sticky top-0 z-10 bg-slate-50"><tr>
            {["S.N", "Contractor", "PAN", "Contract categories", "Contracts", "Awarded value"].map(label => <th key={label} className="border-b px-5 py-3 text-xs font-semibold text-slate-600">{label}</th>)}
          </tr></thead>
          <tbody>{rows.map((row, index) => <tr key={row.id} className="border-b last:border-0 hover:bg-slate-50">
            <td className="w-16 px-5 py-4 tabular-nums text-slate-500">{firstSerial + index + 1}</td>
            <td className="px-5 py-4">
              <Link className="font-semibold text-slate-950 hover:text-emerald-700" to={`/contractors/${row.id}`}>{row.name}</Link>
              <p className="mt-1 text-xs text-slate-500">{row.country ?? "Country not provided"}</p>
            </td>
            <td className="px-5 py-4 font-mono text-xs text-slate-700">{row.pan ?? "Not provided"}</td>
            <td className="px-5 py-4"><div className="flex flex-wrap gap-1">{row.categories.length ? row.categories.map(value => <Badge key={value} variant="secondary">{value}</Badge>) : <span className="text-slate-500">Not classified</span>}</div></td>
            <td className="px-5 py-4 tabular-nums text-slate-700">{row.contractCount}</td>
            <td className="px-5 py-4 font-semibold tabular-nums text-slate-950">{formatMoney(row.awardedValue)}</td>
          </tr>)}</tbody>
        </table>
      </div>}

      <DirectoryPagination current={pagination.page} total={pagination.pages} onChange={page => updateFilter("page", page)} />
    </section>
  </Layout>;
}

function DirectoryPagination({ current, total, onChange }: { current: number; total: number; onChange: (page: number) => void }) {
  if (total <= 1) return null;
  return <nav className="border-t border-slate-200 p-3" aria-label="Contractor directory pages">
    <div className="overflow-x-auto pb-1">
      <div className="flex min-w-max items-center gap-1.5">
        <Button variant="outline" className="h-10 px-3" disabled={current <= 1} onClick={() => onChange(current - 1)}>
          <ChevronLeft className="h-4 w-4" />Previous
        </Button>
        {paginationItems(current, total).map(item => typeof item === "number" ? <Button
          key={item}
          variant={item === current ? "default" : "outline"}
          className="h-10 min-w-10 px-3 tabular-nums"
          aria-current={item === current ? "page" : undefined}
          aria-label={`Page ${item}`}
          onClick={() => onChange(item)}
        >{item}</Button> : <span key={item} className="grid h-10 w-8 place-items-center text-slate-500" aria-hidden="true">…</span>)}
        <Button variant="outline" className="h-10 px-3" disabled={current >= total} onClick={() => onChange(current + 1)}>
          Next<ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  </nav>;
}
