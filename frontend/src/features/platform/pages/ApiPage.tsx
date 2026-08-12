import { useState } from "react";
import { BookOpen, Boxes, Braces, Check, Clipboard, ExternalLink, FileSearch, Landmark, Network, SearchCheck, ShieldCheck } from "lucide-react";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useTranslation, type MessageKey } from "@/features/preferences/translations";

const apiOrigin = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/api\/?$/, "") ?? "http://localhost:3000";
const curlExample = `curl "${apiOrigin}/api/v1/projects?fiscalYear=2081%2F82&limit=10"`;
const resources: { title: MessageKey; icon: typeof Landmark; path: string; text: MessageKey }[] = [
  { title: "budgets", icon: Landmark, path: "/budgets", text: "budgetResource" },
  { title: "projects", icon: Boxes, path: "/projects", text: "projectResource" },
  { title: "contractors", icon: Network, path: "/contractors", text: "contractorResource" },
  { title: "procurement", icon: FileSearch, path: "/procurements", text: "procurementResource" },
  { title: "contracts", icon: BookOpen, path: "/contracts", text: "contractResource" },
  { title: "watchdogFindings", icon: SearchCheck, path: "/watchdog/findings", text: "watchdogResource" },
];
const commonParameters: [string, MessageKey][] = [
  ["q", "searchFields"], ["page", "pageNumber"], ["limit", "resultsPerPage"], ["fiscalYear", "fiscalYearParameter"], ["sort", "sortParameter"],
  ["provinceId", "provinceRegistry"], ["districtId", "districtRegistry"], ["municipalityId", "municipalityRegistry"],
];

export default function ApiPage() {
  const [copied, setCopied] = useState(false);
  const t = useTranslation();
  const copy = async () => { await navigator.clipboard.writeText(curlExample); setCopied(true); window.setTimeout(() => setCopied(false), 1800); };
  return <Layout><main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-950 shadow-sm">
      <div className="grid gap-10 px-6 py-10 sm:px-10 lg:grid-cols-[1.05fr_.95fr] lg:px-12 lg:py-14">
        <div><div className="mb-5 flex items-center gap-2 text-xs font-semibold uppercase tracking-[.18em] text-emerald-700"><Braces className="h-4 w-4"/>{t("apiPublicInterface")}</div>
          <h1 className="max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">{t("apiTitle")}</h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-slate-600">{t("apiIntro")}</p>
          <div className="mt-7 flex flex-wrap gap-3"><Button asChild className="bg-emerald-700 text-white hover:bg-emerald-800"><a href={`${apiOrigin}/api/docs`} target="_blank" rel="noreferrer">{t("openApiDocs")}<ExternalLink className="h-4 w-4"/></a></Button><Button asChild variant="outline" className="border-slate-300 bg-white text-slate-800 hover:border-slate-400 hover:bg-slate-50 hover:text-slate-950"><a href={`${apiOrigin}/api/openapi.json`} target="_blank" rel="noreferrer">{t("openApiJson")}</a></Button></div>
        </div>
        <div className="self-end rounded-xl border border-slate-200 bg-slate-50 p-5"><div className="flex items-center justify-between text-xs text-slate-500"><span>{t("baseUrl")}</span><span className="rounded bg-emerald-100 px-2 py-1 font-medium text-emerald-800">v1 · JSON</span></div><code className="mt-4 block overflow-x-auto font-mono text-sm font-medium text-emerald-700">{apiOrigin}/api/v1</code><div className="mt-5 border-t border-slate-200 pt-4 text-xs leading-5 text-slate-500">{t("amountNote")}</div></div>
      </div>
    </section>

    <section className="mt-10"><div className="mb-5"><h2 className="text-xl font-semibold tracking-tight text-slate-950">{t("quickStart")}</h2><p className="mt-1 text-sm text-slate-600">{t("quickStartHelp")}</p></div><div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><code className="min-w-0 flex-1 overflow-x-auto py-2 font-mono text-sm text-slate-800">{curlExample}</code><Button variant="outline" size="sm" onClick={copy} aria-label={t("copyCurl")}>{copied ? <Check className="h-4 w-4 text-emerald-600"/> : <Clipboard className="h-4 w-4"/>}{copied ? t("copied") : t("copy")}</Button></div></section>

    <section className="mt-12"><h2 className="text-xl font-semibold tracking-tight text-slate-950">{t("availableResources")}</h2><div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{resources.map(({title,icon:Icon,path,text})=><Card key={title} className="transition-colors hover:border-emerald-300"><CardContent className="p-5"><div className="flex items-start justify-between"><span className="grid h-10 w-10 place-items-center rounded-lg bg-emerald-50 text-emerald-700"><Icon className="h-5 w-5"/></span><code className="rounded bg-slate-100 px-2 py-1 font-mono text-xs text-slate-600">GET {path}</code></div><h3 className="mt-5 font-semibold text-slate-950">{t(title)}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{t(text)}</p></CardContent></Card>)}</div></section>

    <section className="mt-12 grid gap-6 lg:grid-cols-[1fr_.8fr]"><div><h2 className="text-xl font-semibold tracking-tight text-slate-950">{t("commonParameters")}</h2><div className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white">{commonParameters.map(([name,text])=><div key={name} className="grid grid-cols-[8rem_1fr] border-b border-slate-100 px-4 py-3.5 last:border-0 sm:grid-cols-[11rem_1fr]"><code className="font-mono text-sm font-semibold text-emerald-700">{name}</code><span className="text-sm text-slate-600">{t(text)}</span></div>)}</div></div>
      <div><h2 className="text-xl font-semibold tracking-tight text-slate-950">{t("responseShape")}</h2><pre className="mt-5 overflow-x-auto rounded-xl bg-slate-950 p-5 font-mono text-xs leading-6 text-slate-300">{`{
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 25,
    "total": 0,
    "totalPages": 0
  },
  "meta": {}
}`}</pre><div className="mt-4 flex gap-3 rounded-xl border border-slate-200 bg-white p-4"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700"/><p className="text-sm leading-6 text-slate-600">{t("rateLimitNote")}</p></div></div>
    </section>
  </main></Layout>;
}
