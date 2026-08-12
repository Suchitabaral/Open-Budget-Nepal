import { useState } from "react";
import { BookOpen, Boxes, Braces, Check, Clipboard, ExternalLink, FileSearch, Landmark, Network, SearchCheck, ShieldCheck } from "lucide-react";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const apiOrigin = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/api\/?$/, "") ?? "http://localhost:3000";
const curlExample = `curl "${apiOrigin}/api/v1/projects?fiscalYear=2081%2F82&limit=10"`;
const resources = [
  { title: "Budgets", icon: Landmark, path: "/budgets", text: "Federal budget and actual amounts by available classification." },
  { title: "Projects", icon: Boxes, path: "/projects", text: "Project and programme records kept distinct from awarded contracts." },
  { title: "Contractors", icon: Network, path: "/contractors", text: "Factual contractor profiles and linked contract histories." },
  { title: "Procurement", icon: FileSearch, path: "/procurements", text: "Procurement-classified award records available in the database." },
  { title: "Contracts", icon: BookOpen, path: "/contracts", text: "Awarded contract amounts, entities, dates and contractors." },
  { title: "Watchdog", icon: SearchCheck, path: "/watchdog/findings", text: "Deterministic findings with rule evidence and methodology." },
];
const commonParameters = [
  ["q", "Search supported text fields"], ["page", "Page number, starting at 1"], ["limit", "Results per page, maximum 100"],
  ["fiscalYear", "Nepali fiscal year, such as 2081/82"], ["sort", "Endpoint-specific whitelisted order"],
  ["provinceId", "Official administrative registry ID"], ["districtId", "District registry ID"], ["municipalityId", "Local-level registry ID"],
];

export default function ApiPage() {
  const [copied, setCopied] = useState(false);
  const copy = async () => { await navigator.clipboard.writeText(curlExample); setCopied(true); window.setTimeout(() => setCopied(false), 1800); };
  return <Layout><main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-950 shadow-sm">
      <div className="grid gap-10 px-6 py-10 sm:px-10 lg:grid-cols-[1.05fr_.95fr] lg:px-12 lg:py-14">
        <div><div className="mb-5 flex items-center gap-2 text-xs font-semibold uppercase tracking-[.18em] text-emerald-700"><Braces className="h-4 w-4"/>Public data interface</div>
          <h1 className="max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">Open Budget Nepal API</h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-slate-600">Public, read-only access to Nepal budget, procurement and transparency data. No account or API key is required.</p>
          <div className="mt-7 flex flex-wrap gap-3"><Button asChild className="bg-emerald-700 text-white hover:bg-emerald-800"><a href={`${apiOrigin}/api/docs`} target="_blank" rel="noreferrer">Open interactive API docs<ExternalLink className="h-4 w-4"/></a></Button><Button asChild variant="outline" className="border-slate-300 bg-white text-slate-800 hover:border-slate-400 hover:bg-slate-50 hover:text-slate-950"><a href={`${apiOrigin}/api/openapi.json`} target="_blank" rel="noreferrer">OpenAPI JSON</a></Button></div>
        </div>
        <div className="self-end rounded-xl border border-slate-200 bg-slate-50 p-5"><div className="flex items-center justify-between text-xs text-slate-500"><span>Base URL</span><span className="rounded bg-emerald-100 px-2 py-1 font-medium text-emerald-800">v1 · JSON</span></div><code className="mt-4 block overflow-x-auto font-mono text-sm font-medium text-emerald-700">{apiOrigin}/api/v1</code><div className="mt-5 border-t border-slate-200 pt-4 text-xs leading-5 text-slate-500">Amounts are raw decimal strings in NPR. Missing values are <code className="text-slate-800">null</code>, never fabricated zeroes.</div></div>
      </div>
    </section>

    <section className="mt-10"><div className="mb-5"><h2 className="text-xl font-semibold tracking-tight text-slate-950">Quick start</h2><p className="mt-1 text-sm text-slate-600">Request ten available project records for fiscal year 2081/82.</p></div><div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><code className="min-w-0 flex-1 overflow-x-auto py-2 font-mono text-sm text-slate-800">{curlExample}</code><Button variant="outline" size="sm" onClick={copy} aria-label="Copy cURL request">{copied ? <Check className="h-4 w-4 text-emerald-600"/> : <Clipboard className="h-4 w-4"/>}{copied ? "Copied" : "Copy"}</Button></div></section>

    <section className="mt-12"><h2 className="text-xl font-semibold tracking-tight text-slate-950">Available resources</h2><div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{resources.map(({title,icon:Icon,path,text})=><Card key={title} className="transition-colors hover:border-emerald-300"><CardContent className="p-5"><div className="flex items-start justify-between"><span className="grid h-10 w-10 place-items-center rounded-lg bg-emerald-50 text-emerald-700"><Icon className="h-5 w-5"/></span><code className="rounded bg-slate-100 px-2 py-1 font-mono text-xs text-slate-600">GET {path}</code></div><h3 className="mt-5 font-semibold text-slate-950">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{text}</p></CardContent></Card>)}</div></section>

    <section className="mt-12 grid gap-6 lg:grid-cols-[1fr_.8fr]"><div><h2 className="text-xl font-semibold tracking-tight text-slate-950">Common parameters</h2><div className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white">{commonParameters.map(([name,text])=><div key={name} className="grid grid-cols-[8rem_1fr] border-b border-slate-100 px-4 py-3.5 last:border-0 sm:grid-cols-[11rem_1fr]"><code className="font-mono text-sm font-semibold text-emerald-700">{name}</code><span className="text-sm text-slate-600">{text}</span></div>)}</div></div>
      <div><h2 className="text-xl font-semibold tracking-tight text-slate-950">Response shape</h2><pre className="mt-5 overflow-x-auto rounded-xl bg-slate-950 p-5 font-mono text-xs leading-6 text-slate-300">{`{
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 25,
    "total": 0,
    "totalPages": 0
  },
  "meta": {}
}`}</pre><div className="mt-4 flex gap-3 rounded-xl border border-slate-200 bg-white p-4"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700"/><p className="text-sm leading-6 text-slate-600">Requests are limited to 120 per minute per client IP. Pagination is performed by the database.</p></div></div>
    </section>
  </main></Layout>;
}
