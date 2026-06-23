import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Search, Flag, MessageSquare, Eye, AlertTriangle, ShieldAlert, FlagIcon, ChevronLeft, ChevronRight, ArrowUpDown } from "lucide-react";
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

const severityConfig: Record<Severity, { variant: "destructive" | "warning" | "success"; color: string; bg: string }> = {
  High: { variant: "destructive", color: "text-red-700", bg: "bg-red-100" },
  Medium: { variant: "warning", color: "text-orange-700", bg: "bg-orange-100" },
  Low: { variant: "success", color: "text-green-700", bg: "bg-green-100" },
};

function getScoreColor(score: number): string {
  if (score >= 80) return "bg-red-100 text-red-700 border-red-200";
  if (score >= 50) return "bg-orange-100 text-orange-700 border-orange-200";
  return "bg-green-100 text-green-700 border-green-200";
}

export default function Watchdog() {
  const [searchQuery, setSearchQuery] = useState("");
  const [issueTypeFilter, setIssueTypeFilter] = useState("All Types");
  const [severityFilter, setSeverityFilter] = useState("All Severities");
  const [sortConfig, setSortConfig] = useState<{ key: keyof WatchdogIssue; direction: "asc" | "desc" } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [flaggedItems, setFlaggedItems] = useState<Set<string>>(new Set());
  const itemsPerPage = 8;

  const filteredIssues = useMemo(() => {
    let result = [...watchdogIssues];

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
        if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [searchQuery, issueTypeFilter, severityFilter, sortConfig]);

  const totalPages = Math.ceil(filteredIssues.length / itemsPerPage);
  const paginatedIssues = filteredIssues.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleSort = (key: keyof WatchdogIssue) => {
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
                  <p className="text-3xl font-bold text-foreground">{watchdogSummary.totalIssues.toLocaleString()}</p>
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
                  <p className="text-3xl font-bold text-red-600">{watchdogSummary.highSeverity}</p>
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
              {issueTypes.map((type) => (
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
          Showing <span className="font-semibold text-foreground">{paginatedIssues.length}</span> of{" "}
          <span className="font-semibold text-foreground">{filteredIssues.length}</span> anomalies
        </p>
      </motion.div>

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
                        <Button variant="ghost" size="sm" className="text-muted-foreground">
                          <MessageSquare className="h-4 w-4 mr-1" />
                          Feedback
                        </Button>
                        <Button variant="ghost" size="sm" className="text-muted-foreground">
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
    </Layout>
  );
}
