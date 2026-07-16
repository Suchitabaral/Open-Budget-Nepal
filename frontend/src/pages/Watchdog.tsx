import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { motion } from "framer-motion";
import { Search, Flag, MessageSquare, Eye, AlertTriangle, ShieldAlert, FlagIcon, ChevronLeft, ChevronRight, ArrowUpDown, X, Loader2 } from "lucide-react";
import Layout from "@/components/layout/Layout";
import PageHeader from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { watchdogIssues, issueTypes, severityOptions, watchdogSummary, type WatchdogIssue, type Severity } from "@/data/watchdogData";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001/api";

const severityConfig: Record<Severity, { variant: "destructive" | "warning" | "success"; color: string; bg: string }> = {
  High: { variant: "destructive", color: "text-red-700", bg: "bg-red-100" },
  Medium: { variant: "warning", color: "text-orange-700", bg: "bg-orange-100" },
  Low: { variant: "success", color: "text-green-700", bg: "bg-green-100" },
};

type WatchdogIssueWithLinks = WatchdogIssue & {
  contractorId?: number;
  contractId?: number;
  projectId?: number;
  contractCode?: string;
  status?: string;
  fiscalYear?: string;
  source?: "api" | "sample";
};

type BackendSuspiciousActivity = {
  id?: string;
  type?: string;
  severity?: Severity;
  entity?: string;
  contractor?: string;
  project?: string;
  issue?: string;
  score?: number;
  contractorId?: number;
  contractId?: number;
  projectId?: number;
  contractCode?: string;
  status?: string;
  fiscalYear?: string;
  createdAt?: string;
  contractors?: string[];
};

type FeedbackForm = {
  userName: string;
  userEmail: string;
  rating: string;
  comment: string;
};

function getScoreColor(score: number): string {
  if (score >= 80) return "bg-red-100 text-red-700 border-red-200";
  if (score >= 50) return "bg-orange-100 text-orange-700 border-orange-200";
  return "bg-green-100 text-green-700 border-green-200";
}

function scoreFromSeverity(severity: Severity): number {
  if (severity === "High") return 90;
  if (severity === "Medium") return 65;
  return 35;
}

function normalizeIssue(activity: BackendSuspiciousActivity, index: number): WatchdogIssueWithLinks {
  const severity = activity.severity ?? "Medium";
  return {
    id: activity.id ?? `API-${index + 1}`,
    score: activity.score ?? scoreFromSeverity(severity),
    issueType: activity.type ?? "Suspicious Activity",
    severity,
    contractor: activity.contractor ?? activity.contractors?.join(", ") ?? activity.entity ?? "Unknown contractor",
    project: activity.project ?? activity.entity ?? "Unspecified project",
    details: activity.issue ?? "Potential anomaly requires review.",
    flagged: false,
    date: activity.createdAt?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
    contractorId: activity.contractorId,
    contractId: activity.contractId,
    projectId: activity.projectId,
    contractCode: activity.contractCode,
    status: activity.status,
    fiscalYear: activity.fiscalYear,
    source: "api",
  };
}

const emptyFeedbackForm: FeedbackForm = {
  userName: "",
  userEmail: "",
  rating: "4",
  comment: "",
};

export default function Watchdog() {
  const [searchQuery, setSearchQuery] = useState("");
  const [issueTypeFilter, setIssueTypeFilter] = useState("All Types");
  const [severityFilter, setSeverityFilter] = useState("All Severities");
  const [sortConfig, setSortConfig] = useState<{ key: keyof WatchdogIssueWithLinks; direction: "asc" | "desc" } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [flaggedItems, setFlaggedItems] = useState<Set<string>>(new Set());
  const [issues, setIssues] = useState<WatchdogIssueWithLinks[]>(
    watchdogIssues.map((issue) => ({ ...issue, source: "sample" }))
  );
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<WatchdogIssueWithLinks | null>(null);
  const [feedbackIssue, setFeedbackIssue] = useState<WatchdogIssueWithLinks | null>(null);
  const [feedbackForm, setFeedbackForm] = useState<FeedbackForm>(emptyFeedbackForm);
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const itemsPerPage = 8;

  useEffect(() => {
    const controller = new AbortController();

    async function loadSuspiciousActivities() {
      try {
        setIsLoading(true);
        setLoadError(null);
        const response = await fetch(`${apiBaseUrl}/suspicious-activities`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Watchdog API returned ${response.status}`);
        }

        const data = (await response.json()) as BackendSuspiciousActivity[];
        if (data.length > 0) {
          setIssues(data.map(normalizeIssue));
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setLoadError(error instanceof Error ? error.message : "Unable to load watchdog data.");
      } finally {
        setIsLoading(false);
      }
    }

    loadSuspiciousActivities();
    return () => controller.abort();
  }, []);

  const filteredIssues = useMemo(() => {
    let result = [...issues];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (issue) =>
          issue.contractor.toLowerCase().includes(query) ||
          issue.project.toLowerCase().includes(query) ||
          issue.issueType.toLowerCase().includes(query)
      );
    }

    if (issueTypeFilter !== "All Types") {
      result = result.filter((issue) => issue.issueType === issueTypeFilter);
    }

    if (severityFilter !== "All Severities") {
      result = result.filter((issue) => issue.severity === severityFilter);
    }

    if (sortConfig) {
      result.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];
        const normalizedA = aValue ?? "";
        const normalizedB = bValue ?? "";
        if (normalizedA < normalizedB) return sortConfig.direction === "asc" ? -1 : 1;
        if (normalizedA > normalizedB) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [issues, searchQuery, issueTypeFilter, severityFilter, sortConfig]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, issueTypeFilter, severityFilter]);

  const issueTypeOptions = useMemo(() => {
    const values = new Set([...issueTypes, ...issues.map((issue) => issue.issueType)]);
    return Array.from(values);
  }, [issues]);

  const summary = useMemo(() => ({
    totalIssues: issues.length || watchdogSummary.totalIssues,
    highSeverity: issues.filter((issue) => issue.severity === "High").length || watchdogSummary.highSeverity,
  }), [issues]);

  const totalPages = Math.ceil(filteredIssues.length / itemsPerPage);
  const paginatedIssues = filteredIssues.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleSort = (key: keyof WatchdogIssueWithLinks) => {
    setSortConfig((current) => {
      if (!current || current.key !== key) {
        return { key, direction: "desc" };
      }
      return { key, direction: current.direction === "asc" ? "desc" : "asc" };
    });
  };

  const toggleFlag = (id: string) => {
    setFlaggedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openFeedback = (issue: WatchdogIssueWithLinks) => {
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
          userName: feedbackForm.userName,
          userEmail: feedbackForm.userEmail,
          rating: Number(feedbackForm.rating),
          comment: feedbackForm.comment,
          feedbackType: "watchdog",
          contractorId: feedbackIssue.contractorId,
          contractId: feedbackIssue.contractId,
          projectId: feedbackIssue.projectId,
          issue: {
            id: feedbackIssue.id,
            score: feedbackIssue.score,
            issueType: feedbackIssue.issueType,
            severity: feedbackIssue.severity,
            contractor: feedbackIssue.contractor,
            project: feedbackIssue.project,
            details: feedbackIssue.details,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.error ?? `Feedback API returned ${response.status}`);
      }

      setFlaggedItems((prev) => new Set(prev).add(feedbackIssue.id));
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
        title="Suspicious Activity Watchdog"
        subtitle="Real-time analysis of contractor patterns and project anomalies."
        action={
          <div className="flex items-center gap-2">
            <Badge variant="success" className="gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              Live Feed
            </Badge>
            <span className="text-sm text-muted-foreground hidden sm:inline">
              Updated Jun 19, 2026 · 09:14 UTC
            </span>
          </div>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <Card className="border-none shadow-md">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Total Issues
                  </p>
                  <p className="text-3xl font-bold text-foreground">{summary.totalIssues.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground mt-1">across all severities</p>
                </div>
                <div className="p-3 rounded-xl bg-muted">
                  <AlertTriangle className="h-6 w-6 text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <Card className="border-none shadow-md">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    High Severity
                  </p>
                  <p className="text-3xl font-bold text-red-600">{summary.highSeverity}</p>
                  <p className="text-sm text-muted-foreground mt-1">require immediate review</p>
                </div>
                <div className="p-3 rounded-xl bg-red-100">
                  <ShieldAlert className="h-6 w-6 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          <Card className="border-none shadow-md">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Flagged
                  </p>
                  <p className="text-3xl font-bold text-orange-600">{flaggedItems.size}</p>
                  <p className="text-sm text-muted-foreground mt-1">marked for follow-up</p>
                </div>
                <div className="p-3 rounded-xl bg-orange-100">
                  <FlagIcon className="h-6 w-6 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.4 }}
        className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 mb-4"
      >
        <div className="flex flex-col sm:flex-row gap-3 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search contractor, project..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-white"
            />
          </div>
          <Select value={issueTypeFilter} onValueChange={setIssueTypeFilter}>
            <SelectTrigger className="w-full sm:w-[180px] bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {issueTypeOptions.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={severityFilter} onValueChange={setSeverityFilter}>
            <SelectTrigger className="w-full sm:w-[180px] bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {severityOptions.map((severity) => (
                <SelectItem key={severity} value={severity}>
                  {severity}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-sm text-muted-foreground whitespace-nowrap">
          {isLoading ? "Loading anomalies..." : "Showing"} <span className="font-semibold text-foreground">{paginatedIssues.length}</span> of{" "}
          <span className="font-semibold text-foreground">{filteredIssues.length}</span> anomalies
        </p>
      </motion.div>

      {loadError && (
        <div className="mb-4 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
          Backend watchdog data could not be loaded, so sample data is being shown. {loadError}
        </div>
      )}

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.5 }}
      >
        <Card className="border-none shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="w-[80px]">
                    <button
                      className="flex items-center gap-1 font-semibold text-xs uppercase tracking-wider"
                      onClick={() => handleSort("score")}
                    >
                      Score
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider">Issue Type</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider">Severity</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider">Contractor</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider">Project</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider">Details</TableHead>
                  <TableHead className="text-right font-semibold text-xs uppercase tracking-wider">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedIssues.map((issue, index) => (
                  <motion.tr
                    key={issue.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2, delay: index * 0.05 }}
                    className="border-b transition-colors hover:bg-muted/50"
                  >
                    <TableCell>
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-bold ${getScoreColor(
                          issue.score
                        )}`}
                      >
                        {issue.score}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium text-foreground">{issue.issueType}</TableCell>
                    <TableCell>
                      <Badge variant={severityConfig[issue.severity].variant}>{issue.severity}</Badge>
                    </TableCell>
                    <TableCell>
                      <button className="text-primary hover:underline font-medium text-left">
                        {issue.contractor}
                      </button>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{issue.project}</TableCell>
                    <TableCell className="text-muted-foreground max-w-xs">{issue.details}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className={flaggedItems.has(issue.id) ? "text-orange-600" : "text-muted-foreground"}
                          onClick={() => toggleFlag(issue.id)}
                        >
                          <Flag className="h-4 w-4 mr-1" />
                          Flag
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground"
                          onClick={() => openFeedback(issue)}
                        >
                          <MessageSquare className="h-4 w-4 mr-1" />
                          Feedback
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground"
                          onClick={() => setSelectedIssue(issue)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                      </div>
                    </TableCell>
                  </motion.tr>
                ))}
              </TableBody>
            </Table>
          </div>

          {paginatedIssues.length === 0 && (
            <div className="py-12 text-center">
              <p className="text-muted-foreground">No anomalies found matching your filters.</p>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-4 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <Button
                    key={page}
                    variant={currentPage === page ? "default" : "outline"}
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </Button>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
        </Card>
      </motion.div>

      {selectedIssue && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl">
            <div className="flex items-start justify-between border-b border-border px-6 py-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Watchdog preview</p>
                <h2 className="mt-1 text-xl font-semibold text-foreground">{selectedIssue.issueType}</h2>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setSelectedIssue(null)} aria-label="Close preview">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-5 px-6 py-5">
              <div className="flex flex-wrap items-center gap-3">
                <div className={`flex h-12 w-12 items-center justify-center rounded-full border-2 text-base font-bold ${getScoreColor(selectedIssue.score)}`}>
                  {selectedIssue.score}
                </div>
                <Badge variant={severityConfig[selectedIssue.severity].variant}>{selectedIssue.severity}</Badge>
                {selectedIssue.status && <Badge variant="outline">{selectedIssue.status}</Badge>}
                {selectedIssue.source === "api" && <Badge variant="secondary">Backend data</Badge>}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contractor</p>
                  <p className="mt-1 font-medium text-foreground">{selectedIssue.contractor}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Project</p>
                  <p className="mt-1 font-medium text-foreground">{selectedIssue.project}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Detected</p>
                  <p className="mt-1 text-foreground">{selectedIssue.date}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Reference</p>
                  <p className="mt-1 text-foreground">{selectedIssue.contractCode ?? selectedIssue.id}</p>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Finding</p>
                <p className="mt-2 leading-7 text-foreground">{selectedIssue.details}</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
              <Button variant="outline" onClick={() => setSelectedIssue(null)}>Close</Button>
              <Button onClick={() => openFeedback(selectedIssue)}>
                <MessageSquare className="h-4 w-4" />
                Add feedback
              </Button>
            </div>
          </div>
        </div>
      )}

      {feedbackIssue && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <form onSubmit={submitFeedback} className="w-full max-w-xl rounded-xl bg-white shadow-xl">
            <div className="flex items-start justify-between border-b border-border px-6 py-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Submit watchdog feedback</p>
                <h2 className="mt-1 text-xl font-semibold text-foreground">{feedbackIssue.project}</h2>
              </div>
              <Button variant="ghost" size="icon" type="button" onClick={() => setFeedbackIssue(null)} aria-label="Close feedback form">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-4 px-6 py-5">
              <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
                {feedbackIssue.issueType} · {feedbackIssue.contractor}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  placeholder="Your name"
                  value={feedbackForm.userName}
                  onChange={(event) => setFeedbackForm((form) => ({ ...form, userName: event.target.value }))}
                />
                <Input
                  type="email"
                  placeholder="Email address"
                  value={feedbackForm.userEmail}
                  onChange={(event) => setFeedbackForm((form) => ({ ...form, userEmail: event.target.value }))}
                />
              </div>
              <Select
                value={feedbackForm.rating}
                onValueChange={(rating) => setFeedbackForm((form) => ({ ...form, rating }))}
              >
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Confidence rating" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 - Very confident</SelectItem>
                  <SelectItem value="4">4 - Confident</SelectItem>
                  <SelectItem value="3">3 - Needs review</SelectItem>
                  <SelectItem value="2">2 - Low confidence</SelectItem>
                  <SelectItem value="1">1 - Not relevant</SelectItem>
                </SelectContent>
              </Select>
              <textarea
                required
                rows={5}
                placeholder="Add evidence, correction, or review note..."
                value={feedbackForm.comment}
                onChange={(event) => setFeedbackForm((form) => ({ ...form, comment: event.target.value }))}
                className="flex w-full rounded-lg border border-input bg-card px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
              />
              {feedbackMessage && (
                <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">{feedbackMessage}</p>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
              <Button variant="outline" type="button" onClick={() => setFeedbackIssue(null)}>Cancel</Button>
              <Button type="submit" disabled={isSubmittingFeedback || !feedbackForm.comment.trim()}>
                {isSubmittingFeedback && <Loader2 className="h-4 w-4 animate-spin" />}
                Submit feedback
              </Button>
            </div>
          </form>
        </div>
      )}
    </Layout>
  );
}
