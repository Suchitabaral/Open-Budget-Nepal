import { useEffect, useState } from "react";
import { Check, Clipboard, ExternalLink } from "lucide-react";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/features/preferences/translations";

const apiOrigin = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/api\/?$/, "") ?? "http://localhost:3000";
const baseUrl = `${apiOrigin}/api/v1`;

type Parameter = {
  name: string;
  type: string;
  required?: boolean;
  description: string;
};

type Endpoint = {
  id: string;
  title: string;
  path: string;
  description: string;
  parameters: Parameter[];
  example: string;
  response: string;
};

const endpoints: Endpoint[] = [
  {
    id: "projects",
    title: "List projects",
    path: "/projects",
    description: "Returns distinct public project and programme records. Results are paginated and can be filtered by fiscal year or administrative registry IDs.",
    parameters: [
      { name: "q", type: "string", description: "Case-insensitive project-name search." },
      { name: "fiscalYear", type: "string", description: "Nepali fiscal year, for example 2081/82." },
      { name: "provinceId", type: "string", description: "Province ID returned by /meta/provinces." },
      { name: "municipalityId", type: "string", description: "Local-level ID returned by /meta/municipalities." },
      { name: "page", type: "integer", description: "Page number. Defaults to 1." },
      { name: "limit", type: "integer", description: "Records per page. Maximum 100." },
      { name: "sort", type: "enum", description: "name_asc, name_desc, budget_asc or budget_desc." },
    ],
    example: `curl "${baseUrl}/projects?fiscalYear=2081%2F82&limit=10"`,
    response: `{
  "data": [
    {
      "id": 1842,
      "name": "Road upgrading project",
      "fiscalYear": "2081/82",
      "municipality": "Pokhara Metropolitan City",
      "province": "Gandaki",
      "annualBudget": "25000000",
      "expenditure": "16250000",
      "currency": "NPR",
      "status": "In progress"
    }
  ],
  "pagination": { "page": 1, "limit": 10, "total": 1, "totalPages": 1 },
  "meta": {}
}`,
  },
  {
    id: "contractors",
    title: "List contractors",
    path: "/contractors",
    description: "Returns verified contractor directory records and their linked contract counts. PAN values are handled as strings.",
    parameters: [
      { name: "q", type: "string", description: "Search contractor name or PAN." },
      { name: "pan", type: "string", description: "Exact PAN value." },
      { name: "contractorType", type: "string", description: "Exact recorded contractor classification." },
      { name: "page", type: "integer", description: "Page number. Defaults to 1." },
      { name: "limit", type: "integer", description: "Records per page. Maximum 100." },
      { name: "sort", type: "enum", description: "name_asc or name_desc." },
    ],
    example: `curl "${baseUrl}/contractors?q=construction&limit=20"`,
    response: `{
  "data": [
    {
      "id": 31,
      "name": "Example Construction Pvt. Ltd.",
      "pan": "123456789",
      "contractorType": "Works",
      "country": "Nepal",
      "contractCount": 4,
      "sources": []
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 },
  "meta": {}
}`,
  },
  {
    id: "watchdog",
    title: "List Watchdog findings",
    path: "/watchdog/findings",
    description: "Returns deterministic, rule-based findings with the evidence used to calculate each score. Scores are not probabilities.",
    parameters: [
      { name: "rule", type: "enum", description: "SEVERE_DELAY, COST_OVERRUN or HIGH_CONCENTRATION." },
      { name: "severity", type: "enum", description: "High or Medium." },
      { name: "fiscalYear", type: "string", description: "Nepali fiscal year." },
      { name: "contractorId", type: "integer", description: "Contractor resource ID." },
      { name: "page", type: "integer", description: "Page number. Defaults to 1." },
      { name: "limit", type: "integer", description: "Records per page. Maximum 100." },
    ],
    example: `curl "${baseUrl}/watchdog/findings?severity=High&fiscalYear=2081%2F82"`,
    response: `{
  "data": [
    {
      "id": "finding-id",
      "ruleId": "SEVERE_DELAY",
      "severity": "High",
      "riskScore": 90,
      "fiscalYear": "2081/82",
      "evidence": { "Schedule overrun": "Recorded evidence" }
    }
  ],
  "pagination": { "page": 1, "limit": 25, "total": 1, "totalPages": 1 },
  "meta": { "methodology": "Deterministic rule-based findings; risk scores are not probabilities." }
}`,
  },
];

const resources = [
  ["Budgets", "/budgets"],
  ["Projects", "/projects"],
  ["Contractors", "/contractors"],
  ["Contracts", "/contracts"],
  ["Procurement", "/procurements"],
  ["Watchdog", "/watchdog/findings"],
  ["Provinces", "/meta/provinces"],
  ["Districts", "/meta/districts"],
  ["Municipalities", "/meta/municipalities"],
] as const;

const referenceItems = [
  { id: "introduction", label: "Introduction", level: 0 },
  { id: "getting-started", label: "Getting started", level: 0 },
  { id: "resources", label: "Resources", level: 0 },
  { id: "projects", label: "Projects", level: 1 },
  { id: "contractors", label: "Contractors", level: 1 },
  { id: "watchdog", label: "Watchdog", level: 1 },
  { id: "errors", label: "Errors", level: 0 },
] as const;

function CodeBlock({ children, copyValue }: { children: string; copyValue?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(copyValue ?? children);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="relative overflow-hidden border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-950">
      <pre className="overflow-x-auto p-4 pr-12 font-mono text-xs leading-6 text-slate-700 dark:text-slate-300"><code>{children}</code></pre>
      <button onClick={copy} className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded border border-slate-200 bg-white text-slate-500 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 dark:border-slate-700 dark:bg-slate-900 dark:hover:text-white" aria-label="Copy code">
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Clipboard className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

function EndpointReference({ endpoint }: { endpoint: Endpoint }) {
  return (
    <section id={endpoint.id} className="scroll-mt-6 border-t border-slate-200 pt-9 dark:border-slate-800">
      <h2 className="text-xl font-semibold tracking-tight text-slate-950 dark:text-white">{endpoint.title}</h2>
      <div className="mt-4 flex min-w-0 items-center border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        <span className="self-stretch bg-emerald-700 px-3 py-2 font-mono text-xs font-bold text-white">GET</span>
        <code className="min-w-0 overflow-x-auto px-3 py-2 font-mono text-sm text-slate-800 dark:text-slate-200">{endpoint.path}</code>
      </div>
      <p className="mt-4 text-sm leading-6 text-slate-700 dark:text-slate-300">{endpoint.description}</p>

      <h3 className="mt-7 text-sm font-semibold text-slate-950 dark:text-white">Query parameters</h3>
      <div className="mt-3 overflow-x-auto border border-slate-200 dark:border-slate-700">
        <table className="w-full min-w-[560px] border-collapse text-left text-sm">
          <thead className="bg-slate-50 text-xs text-slate-600 dark:bg-slate-900 dark:text-slate-400"><tr><th className="px-3 py-2 font-medium">Name</th><th className="px-3 py-2 font-medium">Type</th><th className="px-3 py-2 font-medium">Required</th><th className="px-3 py-2 font-medium">Description</th></tr></thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">{endpoint.parameters.map(parameter=><tr key={parameter.name}><td className="px-3 py-2.5"><code className="font-mono text-xs font-semibold text-emerald-700 dark:text-emerald-400">{parameter.name}</code></td><td className="px-3 py-2.5 font-mono text-xs text-slate-600 dark:text-slate-400">{parameter.type}</td><td className="px-3 py-2.5 text-xs text-slate-600 dark:text-slate-400">{parameter.required ? "Yes" : "No"}</td><td className="px-3 py-2.5 text-xs leading-5 text-slate-700 dark:text-slate-300">{parameter.description}</td></tr>)}</tbody>
        </table>
      </div>

      <h3 className="mt-7 text-sm font-semibold text-slate-950 dark:text-white">Example request</h3>
      <div className="mt-3"><CodeBlock>{endpoint.example}</CodeBlock></div>
      <h3 className="mt-7 text-sm font-semibold text-slate-950 dark:text-white">200 response</h3>
      <div className="mt-3 border-l-2 border-l-emerald-600"><CodeBlock>{endpoint.response}</CodeBlock></div>
    </section>
  );
}

export default function ApiPage() {
  const t = useTranslation();
  const [activeSection, setActiveSection] = useState<string>("introduction");

  useEffect(() => {
    const sections = referenceItems
      .map(item => document.getElementById(item.id))
      .filter((section): section is HTMLElement => Boolean(section));
    const observer = new IntersectionObserver(entries => {
      const visible = entries
        .filter(entry => entry.isIntersecting)
        .sort((a, b) => Math.abs(a.boundingClientRect.top) - Math.abs(b.boundingClientRect.top));
      if (visible[0]) setActiveSection(visible[0].target.id);
    }, { rootMargin: "-12% 0px -62% 0px", threshold: [0, 0.1, 0.5] });
    sections.forEach(section => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  const navigateToSection = (id: string) => {
    const section = document.getElementById(id);
    if (!section) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    section.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
    window.history.replaceState(null, "", `#${id}`);
    setActiveSection(id);
  };

  return (
    <Layout>
      <div className="w-full">
        <main className="min-w-0">
          <div className="mb-6 lg:hidden">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">On this page
              <select value={activeSection} onChange={event => navigateToSection(event.target.value)} className="mt-1.5 block h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white">
                {referenceItems.map(item => <option key={item.id} value={item.id}>{item.level ? `— ${item.label}` : item.label}</option>)}
              </select>
            </label>
          </div>

          <header id="introduction" className="scroll-mt-6">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">{t("apiTitle")}</h1>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-700 dark:text-slate-300">{t("apiIntro")}</p>
            <div className="mt-6 flex flex-wrap gap-2"><Button asChild size="sm"><a href={`${apiOrigin}/api/docs`} target="_blank" rel="noreferrer">Interactive reference<ExternalLink className="h-3.5 w-3.5" /></a></Button><Button asChild size="sm" variant="outline"><a href={`${apiOrigin}/api/openapi.json`} target="_blank" rel="noreferrer">OpenAPI 3.0 JSON</a></Button></div>
          </header>

          <section id="getting-started" className="mt-10 scroll-mt-6 border-t border-slate-200 pt-9 dark:border-slate-800">
            <h2 className="text-xl font-semibold tracking-tight text-slate-950 dark:text-white">Getting started</h2>
            <p className="mt-4 text-sm leading-6 text-slate-700 dark:text-slate-300">Send an HTTP GET request to the versioned base URL. Responses use JSON. Authentication is not currently required.</p>
            <dl className="mt-5 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[9rem_1fr]"><dt className="font-medium text-slate-950 dark:text-white">Base URL</dt><dd><code className="font-mono text-emerald-700 dark:text-emerald-400">{baseUrl}</code></dd><dt className="font-medium text-slate-950 dark:text-white">Authentication</dt><dd className="text-slate-700 dark:text-slate-300">None</dd><dt className="font-medium text-slate-950 dark:text-white">Content type</dt><dd><code className="font-mono text-xs text-slate-700 dark:text-slate-300">application/json</code></dd><dt className="font-medium text-slate-950 dark:text-white">Rate limit</dt><dd className="text-slate-700 dark:text-slate-300">120 requests per minute per client IP</dd></dl>
            <p className="mt-5 border-l-2 border-amber-500 pl-3 text-xs leading-5 text-slate-600 dark:text-slate-400">Monetary values are decimal strings in NPR. Missing values are returned as <code className="font-mono">null</code>, never as fabricated zeroes.</p>
          </section>

          <section id="resources" className="mt-10 scroll-mt-6 border-t border-slate-200 pt-9 dark:border-slate-800">
            <h2 className="text-xl font-semibold tracking-tight text-slate-950 dark:text-white">Available resources</h2>
            <div className="mt-4 divide-y divide-slate-200 border-y border-slate-200 dark:divide-slate-800 dark:border-slate-800">{resources.map(([name,path])=><div key={path} className="grid grid-cols-[8rem_minmax(0,1fr)] items-center py-2.5 text-sm"><span className="text-slate-700 dark:text-slate-300">{name}</span><code className="overflow-x-auto font-mono text-xs text-emerald-700 dark:text-emerald-400">GET {path}</code></div>)}</div>
          </section>

          {endpoints.map(endpoint=><EndpointReference key={endpoint.id} endpoint={endpoint} />)}

          <section id="errors" className="mt-10 scroll-mt-6 border-t border-slate-200 pt-9 dark:border-slate-800">
            <h2 className="text-xl font-semibold tracking-tight text-slate-950 dark:text-white">Errors</h2>
            <p className="mt-4 text-sm leading-6 text-slate-700 dark:text-slate-300">Errors use a consistent envelope. HTTP status codes include 400 for invalid parameters, 404 for missing resources, 429 for rate limiting and 500 for unexpected server errors.</p>
            <div className="mt-4 border-l-2 border-l-red-500"><CodeBlock>{`{
  "error": {
    "code": "INVALID_QUERY",
    "message": "The supplied query parameter is invalid.",
    "details": []
  }
}`}</CodeBlock></div>
          </section>
        </main>

        <aside className="group fixed inset-y-0 right-0 z-[1000] hidden w-12 lg:block">
          <button type="button" aria-label="Show API reference" className="absolute inset-y-0 right-0 flex w-12 cursor-default flex-col items-end justify-center gap-2.5 pr-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-600">
            {referenceItems.map(item => <span key={item.id} className={`block h-0.5 rounded-full transition-[width,background-color] ${activeSection === item.id ? "w-9 bg-emerald-600" : "w-7 bg-slate-400 group-hover:bg-slate-500 dark:bg-slate-600 dark:group-hover:bg-slate-500"}`} aria-hidden="true" />)}
          </button>
          <nav aria-label="API documentation" className="invisible absolute right-10 top-1/2 w-64 -translate-y-1/2 rounded-xl border border-slate-200 bg-white p-5 opacity-0 shadow-lg shadow-slate-900/10 transition-[opacity,visibility] duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 dark:border-slate-700 dark:bg-slate-900">
            <p className="text-base font-semibold text-slate-950 dark:text-white">API reference</p>
            <div className="mt-4">
              <ul className="space-y-1">
                {referenceItems.map(item => {
                  const active = activeSection === item.id;
                  return <li key={item.id}>
                    <a href={`#${item.id}`} aria-current={active ? "location" : undefined} onClick={event => { event.preventDefault(); navigateToSection(item.id); }} className={`flex min-h-10 items-center rounded-lg py-2 pr-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/25 ${item.level ? "pl-8" : "pl-3"} ${active ? "bg-emerald-50 font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"}`}>
                      {item.label}
                    </a>
                  </li>;
                })}
              </ul>
            </div>
          </nav>
        </aside>
      </div>
    </Layout>
  );
}
