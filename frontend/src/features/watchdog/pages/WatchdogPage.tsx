import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  Flag,
  Loader2,
  MessageSquare,
  Search,
  X,
} from "lucide-react";
import Layout from "@/components/layout/Layout";
import PageHeader from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTranslation, type MessageKey } from "@/features/preferences/translations";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001/api";
const issueTypes: { value: string; label: MessageKey }[] = [{value:"All Rules",label:"allRules"},{value:"Severe Delay",label:"severeDelay"},{value:"Cost Overrun",label:"costOverrun"},{value:"High Concentration",label:"highConcentration"}];
const severityOptions: { value: string; label: MessageKey }[] = [{value:"All Severities",label:"allSeverities"},{value:"High",label:"high"},{value:"Medium",label:"medium"}];
const assessmentOptions = [
  { value: "all", label: "allProjects" },
  { value: "TRIGGERED", label: "scoredFindings" },
  { value: "INHERITED_CONTRACTOR_RISK", label: "inheritedRisk" },
  { value: "NO_FINDING", label: "noFinding" },
  { value: "INSUFFICIENT_DATA", label: "insufficientData" },
] as const;
const fiscalYearOptions = ["All fiscal years", "2075/76", "2076/77", "2077/78", "2078/79", "2079/80", "2080/81", "2081/82", "2082/83"] as const;
const PAGE_SIZE = 20;

type Severity = "High" | "Medium";
type RuleId = "SEVERE_DELAY" | "COST_OVERRUN" | "HIGH_CONCENTRATION";
type WatchdogFinding = {
  id: string;
  ruleId: RuleId;
  ruleLabel: string;
  severity: Severity;
  riskScore: number;
  scoreMethod: string;
  scoreFactors: Array<{ label: string; value: string; points: number }>;
  dataQualityNotes: string[];
  contractor: string;
  project: string;
  details: string;
  evaluatedAt: string;
  contractorId?: number;
  contractId?: number;
  projectId?: number;
  contractCode?: string;
  contractStatus?: string;
  fiscalYear?: string;
  municipality?: string;
};

type EvaluationStatus = "TRIGGERED" | "INHERITED_CONTRACTOR_RISK" | "NO_FINDING" | "INSUFFICIENT_DATA";
type WatchdogProject = Omit<WatchdogFinding, "ruleId" | "ruleLabel" | "severity" | "riskScore" | "scoreMethod"> & {
  ruleLabel: string | null;
  severity: Severity | null;
  riskScore: number | null;
  scoreMethod: string | null;
  evaluationStatus: EvaluationStatus;
  sourceDataset?: string;
  sourceVerificationStatus?: string;
  inheritedFrom: { findingId: string; contractId?: number; contractCode?: string; project: string; ruleLabel: string } | null;
  findings: WatchdogFinding[];
};

type WatchdogSummary = {
  total: number;
  high: number;
  medium: number;
  monitoredProjects: number;
  triggeredProjects: number;
  inheritedRiskProjects: number;
  noFindingProjects: number;
  insufficientDataProjects: number;
};

type WatchdogResponse = {
  findings: WatchdogFinding[];
  projects: WatchdogProject[];
  summary: WatchdogSummary;
  evaluatedAt: string;
};

type FeedbackForm = {
  userName: string;
  userEmail: string;
  rating: string;
  comment: string;
};

type SortField = "riskScore" | "ruleLabel" | "severity" | "contractor" | "project";

function SortHeader({ label, field, onSort }: { label: string; field: SortField; onSort: (field: SortField) => void }) {
  return (
    <button className="flex items-center gap-1 font-semibold" onClick={() => onSort(field)}>
      {label}<ArrowUpDown className="h-3.5 w-3.5" aria-hidden="true" />
    </button>
  );
}

const severityConfig: Record<Severity, { variant: "destructive" | "warning" }> = {
  High: { variant: "destructive" },
  Medium: { variant: "warning" },
};
const severityOrder: Record<Severity, number> = { High: 2, Medium: 1 };
const emptyFeedbackForm: FeedbackForm = { userName: "", userEmail: "", rating: "3", comment: "" };

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

function normalizeFiscalYear(value?: string): string {
  return (value ?? "").replace(/^FY\s*/i, "").replace(/\s+/g, "");
}

function readableProjectName(value?: string): string {
  const normalized = (value ?? "").trim();
  if (!normalized || /^[\s?\uFFFD._-]+$/.test(normalized)) return "Project name unavailable";
  return normalized;
}

export default function Watchdog() {
  const t = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [issueTypeFilter, setIssueTypeFilter] = useState("All Rules");
  const [severityFilter, setSeverityFilter] = useState("All Severities");
  const [assessmentFilter, setAssessmentFilter] = useState("TRIGGERED");
  const [fiscalYearFilter, setFiscalYearFilter] = useState("All fiscal years");
  const [sortConfig, setSortConfig] = useState<{ key: SortField; direction: "asc" | "desc" } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [flaggedItems, setFlaggedItems] = useState<Set<string>>(new Set());
  const [issues, setIssues] = useState<WatchdogProject[]>([]);
  const [summary, setSummary] = useState<WatchdogSummary>({ total: 0, high: 0, medium: 0, monitoredProjects: 0, triggeredProjects: 0, inheritedRiskProjects: 0, noFindingProjects: 0, insufficientDataProjects: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<WatchdogProject | null>(null);
  const [feedbackIssue, setFeedbackIssue] = useState<WatchdogProject | null>(null);
  const [feedbackForm, setFeedbackForm] = useState<FeedbackForm>(emptyFeedbackForm);
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function loadFindings() {
      try {
        setIsLoading(true);
        setLoadError(null);
        const response = await fetch(`${apiBaseUrl}/suspicious-activities`, { signal: controller.signal });
        if (!response.ok) throw new Error(`Watchdog API returned ${response.status}`);
        const data = (await response.json()) as WatchdogResponse;
        // Preserve the source record while presenting a safe fallback for imports
        // whose project-name bytes were already replaced with question marks.
        setIssues(Array.isArray(data.projects) ? data.projects.map(project => ({
          ...project,
          project: readableProjectName(project.project),
        })) : []);
        setSummary(data.summary);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setIssues([]);
        setSummary({ total: 0, high: 0, medium: 0, monitoredProjects: 0, triggeredProjects: 0, inheritedRiskProjects: 0, noFindingProjects: 0, insufficientDataProjects: 0 });
        setLoadError(error instanceof Error ? error.message : "Unable to load watchdog findings.");
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }
    void loadFindings();
    return () => controller.abort();
  }, []);

  const filteredIssues = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const result = issues.filter((issue) => {
      const matchesSearch = !query || [issue.contractor, issue.project, issue.ruleLabel, issue.details]
        .some((value) => (value ?? "").toLowerCase().includes(query));
      const matchesType = issueTypeFilter === "All Rules" || issue.findings.some(finding => finding.ruleLabel === issueTypeFilter) || issue.ruleLabel?.endsWith(issueTypeFilter) === true;
      const matchesSeverity = severityFilter === "All Severities" || issue.severity === severityFilter;
      const matchesAssessment = assessmentFilter === "all" || issue.evaluationStatus === assessmentFilter;
      const matchesFiscalYear = fiscalYearFilter === "All fiscal years" || normalizeFiscalYear(issue.fiscalYear) === fiscalYearFilter;
      return matchesSearch && matchesType && matchesSeverity && matchesAssessment && matchesFiscalYear;
    });

    if (!sortConfig) return result;
    return result.sort((a, b) => {
      const aValue = sortConfig.key === "severity" ? (a.severity ? severityOrder[a.severity] : 0) : (a[sortConfig.key] ?? "");
      const bValue = sortConfig.key === "severity" ? (b.severity ? severityOrder[b.severity] : 0) : (b[sortConfig.key] ?? "");
      if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
  }, [issues, searchQuery, issueTypeFilter, severityFilter, assessmentFilter, fiscalYearFilter, sortConfig]);

  const totalPages = Math.ceil(filteredIssues.length / PAGE_SIZE);
  const safePage = Math.min(currentPage, Math.max(totalPages, 1));
  const firstSerial = (safePage - 1) * PAGE_SIZE;
  const paginatedIssues = filteredIssues.slice(firstSerial, safePage * PAGE_SIZE);

  const updateSearch = (value: string) => { setSearchQuery(value); setCurrentPage(1); };
  const updateIssueType = (value: string) => { setIssueTypeFilter(value); setCurrentPage(1); };
  const updateSeverity = (value: string) => { setSeverityFilter(value); setCurrentPage(1); };
  const updateAssessment = (value: string) => { setAssessmentFilter(value); setCurrentPage(1); };
  const updateFiscalYear = (value: string) => { setFiscalYearFilter(value); setCurrentPage(1); };
  const handleSort = (key: SortField) => {
    setSortConfig((current) => current?.key === key
      ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
      : { key, direction: "asc" });
  };
  const toggleFlag = (id: string) => setFlaggedItems((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const openFeedback = (issue: WatchdogProject) => {
    setSelectedIssue(null);
    setFeedbackIssue(issue);
    setFeedbackForm(emptyFeedbackForm);
    setFeedbackMessage(null);
  };

  const submitFeedback = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!feedbackIssue || !feedbackForm.comment.trim()) return;
    setIsSubmittingFeedback(true);
    setFeedbackMessage(null);
    try {
      const response = await fetch(`${apiBaseUrl}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...feedbackForm,
          rating: Number(feedbackForm.rating),
          feedbackType: "watchdog",
          contractorId: feedbackIssue.contractorId,
          contractId: feedbackIssue.contractId,
          projectId: feedbackIssue.projectId,
          issue: feedbackIssue,
        }),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.error ?? `Feedback API returned ${response.status}`);
      }
      setFlaggedItems((current) => new Set(current).add(feedbackIssue.id));
      setFeedbackMessage("Feedback submitted for review.");
      setFeedbackForm(emptyFeedbackForm);
    } catch (error) {
      setFeedbackMessage(error instanceof Error ? error.message : "Unable to submit feedback.");
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  return (
    <Layout>
      <PageHeader
        title={t("watchdogTitle")}
        subtitle={t("watchdogIntro")}
      />

      <Card className="mb-6 shadow-none">
        <CardContent className="grid p-0 sm:grid-cols-3 sm:divide-x sm:divide-slate-200 dark:sm:divide-slate-800">
          <div className="border-b border-slate-200 px-5 py-4 sm:border-b-0 dark:border-slate-800"><p className="text-xs font-medium text-muted-foreground">{t("monitoredProjects")}</p><p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{summary.monitoredProjects.toLocaleString()}</p></div>
          <div className="border-b border-slate-200 px-5 py-4 sm:border-b-0 dark:border-slate-800"><p className="text-xs font-medium text-muted-foreground">{t("triggeredFindings")}</p><p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{summary.total.toLocaleString()}</p></div>
          <div className="px-5 py-4"><p className="text-xs font-medium text-muted-foreground">{t("highSeverity")}</p><p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{summary.high.toLocaleString()}</p></div>
        </CardContent>
      </Card>

      <section className="mb-4 overflow-hidden rounded-xl border border-slate-200 bg-card dark:border-slate-800" aria-label={t("searchAndFilters")}>
        <div className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-foreground dark:border-slate-800">{t("searchAndFilters")}</div>
        <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-[minmax(18rem,1fr)_repeat(4,minmax(10rem,auto))]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input aria-label={t("searchWatchdog")} placeholder={t("searchWatchdogPlaceholder")} value={searchQuery} onChange={(event) => updateSearch(event.target.value)} className="bg-card pl-9" />
          </div>
          <Select value={issueTypeFilter} onValueChange={updateIssueType}><SelectTrigger aria-label={t("filterRule")} className="w-full bg-card"><SelectValue /></SelectTrigger><SelectContent>{issueTypes.map((type) => <SelectItem key={type.value} value={type.value}>{t(type.label)}</SelectItem>)}</SelectContent></Select>
          <Select value={severityFilter} onValueChange={updateSeverity}><SelectTrigger aria-label={t("filterSeverity")} className="w-full bg-card"><SelectValue /></SelectTrigger><SelectContent>{severityOptions.map((severity) => <SelectItem key={severity.value} value={severity.value}>{t(severity.label)}</SelectItem>)}</SelectContent></Select>
          <Select value={assessmentFilter} onValueChange={updateAssessment}><SelectTrigger aria-label={t("filterAssessment")} className="w-full bg-card"><SelectValue /></SelectTrigger><SelectContent>{assessmentOptions.map((option) => <SelectItem key={option.value} value={option.value}>{t(option.label)}</SelectItem>)}</SelectContent></Select>
          <Select value={fiscalYearFilter} onValueChange={updateFiscalYear}><SelectTrigger aria-label={t("filterFiscalYear")} className="w-full bg-card"><SelectValue /></SelectTrigger><SelectContent>{fiscalYearOptions.map((year) => <SelectItem key={year} value={year}>{year === "All fiscal years" ? t("allFiscalYears") : year}</SelectItem>)}</SelectContent></Select>
        </div>
      </section>

      {loadError && <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{t("watchdogLoadError")} {loadError}</div>}

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 text-sm text-muted-foreground dark:border-slate-800">
          <p>{isLoading ? t("loadingProjects") : <>{t("showing")} <span className="font-semibold text-foreground">{paginatedIssues.length}</span> {t("of")} <span className="font-semibold text-foreground">{filteredIssues.length}</span> {assessmentFilter === "all" ? t("projects") : t("findings")}</>}</p>
          {flaggedItems.size > 0 ? <p className="hidden sm:block"><span className="font-semibold text-foreground">{flaggedItems.size}</span> {t("markedFollowUp").toLowerCase()}</p> : null}
        </div>
        <div className="overflow-x-auto">
          <Table className="min-w-[1380px] table-fixed">
            <TableHeader><TableRow className="bg-muted/50 hover:bg-muted/50"><TableHead className="w-16">{t("serialNumber")}</TableHead><TableHead className="w-28"><SortHeader label={t("riskScore")} field="riskScore" onSort={handleSort} /></TableHead><TableHead className="w-40"><SortHeader label={t("rule")} field="ruleLabel" onSort={handleSort} /></TableHead><TableHead className="w-28"><SortHeader label={t("severity")} field="severity" onSort={handleSort} /></TableHead><TableHead className="w-56"><SortHeader label={t("contractor")} field="contractor" onSort={handleSort} /></TableHead><TableHead className="w-64"><SortHeader label={t("project")} field="project" onSort={handleSort} /></TableHead><TableHead className="w-24">{t("fiscalYear")}</TableHead><TableHead className="w-72">{t("finding")}</TableHead><TableHead className="w-60 text-right">{t("actions")}</TableHead></TableRow></TableHeader>
            <TableBody>{paginatedIssues.map((issue, index) => <TableRow key={issue.id} className="transition-colors hover:bg-muted/50"><TableCell className="tabular-nums text-muted-foreground">{firstSerial + index + 1}</TableCell><TableCell>{issue.riskScore === null ? <span className="text-muted-foreground">—</span> : <span className={`inline-flex h-8 min-w-10 items-center justify-center rounded-md border px-2 text-sm font-semibold tabular-nums ${issue.severity === "High" ? "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300" : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300"}`} title="Calculated from configured rule-based Watchdog criteria and available contract data; not a probability.">{issue.riskScore}</span>}</TableCell><TableCell className="font-medium"><p className="line-clamp-2">{issue.ruleLabel ?? (issue.evaluationStatus === "NO_FINDING" ? "No finding" : "Insufficient data")}</p></TableCell><TableCell>{issue.severity ? <Badge variant={issue.evaluationStatus === "INHERITED_CONTRACTOR_RISK" ? "info" : severityConfig[issue.severity].variant}>{issue.evaluationStatus === "INHERITED_CONTRACTOR_RISK" ? `Inherited · ${issue.severity}` : issue.severity}</Badge> : <Badge variant={issue.evaluationStatus === "NO_FINDING" ? "success" : "secondary"}>{issue.evaluationStatus === "NO_FINDING" ? "Clear" : "Not evaluated"}</Badge>}</TableCell><TableCell className="font-medium text-foreground"><p className="line-clamp-2" title={issue.contractor}>{issue.contractor}</p></TableCell><TableCell className="text-muted-foreground"><p className="line-clamp-2" title={readableProjectName(issue.project)}>{readableProjectName(issue.project)}</p></TableCell><TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">{normalizeFiscalYear(issue.fiscalYear) || "—"}</TableCell><TableCell className="text-muted-foreground"><p className="line-clamp-3 leading-5" title={issue.details}>{issue.details}</p></TableCell><TableCell className="text-right"><div className="flex items-center justify-end gap-1 whitespace-nowrap"><Button variant="ghost" size="sm" className={flaggedItems.has(issue.id) ? "text-amber-700" : "text-muted-foreground"} onClick={() => toggleFlag(issue.id)}><Flag className="mr-1 h-4 w-4" />Flag</Button><Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => openFeedback(issue)}><MessageSquare className="mr-1 h-4 w-4" />Feedback</Button><Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setSelectedIssue(issue)}><Eye className="mr-1 h-4 w-4" />View</Button></div></TableCell></TableRow>)}</TableBody>
          </Table>
        </div>
        {!isLoading && paginatedIssues.length === 0 && <div className="px-6 py-12 text-center"><p className="font-medium text-foreground">{t("noProjects")}</p><p className="mt-1 text-sm text-muted-foreground">{t("noProjectsHelp")}</p></div>}
        {totalPages > 1 && <nav className="border-t p-3" aria-label={t("watchdogPages")}><div className="overflow-x-auto pb-1"><div className="flex min-w-max items-center gap-1.5"><Button variant="outline" className="h-10 px-3" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={safePage === 1}><ChevronLeft className="h-4 w-4" />{t("previous")}</Button>{paginationItems(safePage, totalPages).map((item) => typeof item === "number" ? <Button key={item} variant={item === safePage ? "default" : "outline"} className="h-10 min-w-10 px-3 tabular-nums" aria-current={item === safePage ? "page" : undefined} aria-label={`${t("page")} ${item}`} onClick={() => setCurrentPage(item)}>{item}</Button> : <span key={item} className="grid h-10 w-8 place-items-center text-muted-foreground" aria-hidden="true">…</span>)}<Button variant="outline" className="h-10 px-3" onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} disabled={safePage === totalPages}>{t("next")}<ChevronRight className="h-4 w-4" /></Button></div></div></nav>}
      </Card>

      {selectedIssue && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="finding-title"><div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-xl"><div className="flex items-start justify-between border-b px-6 py-4"><div><p className="text-sm font-medium text-muted-foreground">Watchdog project review</p><h2 id="finding-title" className="mt-1 text-xl font-semibold">{selectedIssue.ruleLabel ?? (selectedIssue.evaluationStatus === "NO_FINDING" ? "No finding" : "Insufficient data")}</h2></div><Button variant="ghost" size="icon" onClick={() => setSelectedIssue(null)} aria-label="Close finding"><X className="h-4 w-4" /></Button></div><div className="space-y-5 px-6 py-5"><div className="flex flex-wrap items-center gap-3">{selectedIssue.riskScore === null ? <span className="inline-flex h-10 items-center rounded-lg bg-slate-100 px-3 font-medium text-slate-600">Risk score unavailable</span> : <span className="inline-flex h-10 items-center rounded-lg bg-slate-100 px-3 font-semibold tabular-nums text-slate-800">Risk score {selectedIssue.riskScore}</span>}{selectedIssue.severity ? <Badge variant={severityConfig[selectedIssue.severity].variant}>{selectedIssue.severity}</Badge> : <Badge variant={selectedIssue.evaluationStatus === "NO_FINDING" ? "success" : "secondary"}>{selectedIssue.evaluationStatus === "NO_FINDING" ? "Clear" : "Not evaluated"}</Badge>}{selectedIssue.contractStatus && <Badge variant="outline">{selectedIssue.contractStatus}</Badge>}</div><p className="text-xs text-muted-foreground">A score appears only when a configured rule is triggered; it is not a probability or AI confidence measure.</p>{selectedIssue.scoreMethod && <div className="rounded-lg bg-slate-50 p-4"><p className="text-sm font-semibold text-slate-900">How this score was calculated</p><p className="mt-1 text-sm leading-6 text-slate-600">{selectedIssue.scoreMethod}</p><div className="mt-3 divide-y divide-slate-200">{selectedIssue.scoreFactors.map(factor => <div key={factor.label} className="flex items-center justify-between gap-4 py-2 text-sm"><span className="text-slate-600">{factor.label}: <strong className="font-medium text-slate-900">{factor.value}</strong></span><span className="font-semibold tabular-nums text-slate-900">+{factor.points}</span></div>)}</div></div>}{selectedIssue.dataQualityNotes.length > 0 && <div className="rounded-lg bg-amber-50 p-4 text-sm leading-6 text-amber-900"><strong>Data-quality note:</strong> {selectedIssue.dataQualityNotes.join(" ")}</div>}<div className="grid gap-4 sm:grid-cols-2"><div><p className="text-sm font-medium text-muted-foreground">Contractor</p><p className="mt-1 font-medium">{selectedIssue.contractor}</p></div><div><p className="text-sm font-medium text-muted-foreground">Project</p><p className="mt-1 font-medium">{selectedIssue.project}</p></div><div><p className="text-sm font-medium text-muted-foreground">Fiscal year</p><p className="mt-1">{normalizeFiscalYear(selectedIssue.fiscalYear) || "Not recorded"}</p></div><div><p className="text-sm font-medium text-muted-foreground">Evaluated</p><p className="mt-1">{new Date(selectedIssue.evaluatedAt).toLocaleString()}</p></div><div><p className="text-sm font-medium text-muted-foreground">Reference</p><p className="mt-1">{selectedIssue.contractCode ?? selectedIssue.id}</p></div></div><div><p className="text-sm font-medium text-muted-foreground">Assessment</p><p className="mt-2 leading-7">{selectedIssue.details}</p></div></div><div className="flex justify-end gap-2 border-t px-6 py-4"><Button variant="outline" onClick={() => setSelectedIssue(null)}>Close</Button><Button onClick={() => openFeedback(selectedIssue)}><MessageSquare className="h-4 w-4" />Add feedback</Button></div></div></div>}

      {feedbackIssue && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="feedback-title"><form onSubmit={submitFeedback} className="w-full max-w-xl rounded-xl bg-white shadow-xl"><div className="flex items-start justify-between border-b px-6 py-4"><div><p className="text-sm font-medium text-muted-foreground">Submit watchdog feedback</p><h2 id="feedback-title" className="mt-1 text-xl font-semibold">{feedbackIssue.project}</h2></div><Button variant="ghost" size="icon" type="button" onClick={() => setFeedbackIssue(null)} aria-label="Close feedback form"><X className="h-4 w-4" /></Button></div><div className="space-y-4 px-6 py-5"><div className="rounded-lg bg-muted/60 p-3 text-sm text-muted-foreground">{feedbackIssue.ruleLabel} · {feedbackIssue.contractor}</div><div className="grid gap-3 sm:grid-cols-2"><Input aria-label="Your name" placeholder="Your name" value={feedbackForm.userName} onChange={(event) => setFeedbackForm((form) => ({ ...form, userName: event.target.value }))} /><Input aria-label="Email address" type="email" placeholder="Email address" value={feedbackForm.userEmail} onChange={(event) => setFeedbackForm((form) => ({ ...form, userEmail: event.target.value }))} /></div><Select value={feedbackForm.rating} onValueChange={(rating) => setFeedbackForm((form) => ({ ...form, rating }))}><SelectTrigger aria-label="Review rating" className="bg-white"><SelectValue placeholder="Review rating" /></SelectTrigger><SelectContent><SelectItem value="5">5 - Strong supporting evidence</SelectItem><SelectItem value="4">4 - Likely relevant</SelectItem><SelectItem value="3">3 - Needs further review</SelectItem><SelectItem value="2">2 - Weak supporting evidence</SelectItem><SelectItem value="1">1 - Not relevant</SelectItem></SelectContent></Select><textarea required rows={5} aria-label="Review note" placeholder="Add evidence, a correction, or a review note" value={feedbackForm.comment} onChange={(event) => setFeedbackForm((form) => ({ ...form, comment: event.target.value }))} className="flex w-full rounded-lg border border-input bg-card px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20" />{feedbackMessage && <p className="rounded-lg bg-muted/60 px-3 py-2 text-sm">{feedbackMessage}</p>}</div><div className="flex justify-end gap-2 border-t px-6 py-4"><Button variant="outline" type="button" onClick={() => setFeedbackIssue(null)}>Cancel</Button><Button type="submit" disabled={isSubmittingFeedback || !feedbackForm.comment.trim()}>{isSubmittingFeedback && <Loader2 className="h-4 w-4 animate-spin" />}Submit feedback</Button></div></form></div>}
    </Layout>
  );
}
