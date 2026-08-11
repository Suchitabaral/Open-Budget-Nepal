import { motion } from "framer-motion";
import { Calendar } from "lucide-react";
import Layout from "@/components/layout/Layout";
import PageHeader from "@/components/layout/PageHeader";
import MetricCard from "@/components/dashboard/MetricCard";
import DistributionChart from "@/components/charts/DistributionChart";
import SegmentedProgress from "@/components/charts/SegmentedProgress";
import { Badge } from "@/components/ui/badge";
import {
  dashboardMetrics,
  revenueDistribution,
  expenditureDistribution,
  revenueBreakdown,
  expenditureBreakdown,
} from "@/data/budgetData";

const secondaryTabs = ["Overview", "Federal", "Provincial", "Local", "Economic Indicators"];

export default function Dashboard() {
  return (
    <Layout>
      {/* Secondary Navigation */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6"
      >
        <div className="flex items-center gap-1 bg-white rounded-full p-1 shadow-sm border border-border overflow-x-auto max-w-full">
          {secondaryTabs.map((tab, index) => (
            <button
              key={tab}
              className={`px-4 py-2 text-sm font-medium rounded-full whitespace-nowrap transition-colors ${
                index === 0
                  ? "bg-white text-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-border shadow-sm">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Fiscal Year</span>
          <span className="text-sm font-semibold text-foreground">2081/82</span>
        </div>
      </motion.div>

      {/* Page Header */}
      <PageHeader
        eyebrow="FY 2081/82 · MINISTRY OF FINANCE"
        title="Budget Overview"
        subtitle="Federal government consolidated budget — revenue & expenditure at a glance"
        action={
          <Badge variant="secondary" className="text-muted-foreground">
            Last updated: Jun 2025
          </Badge>
        }
      />

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-6">
        {dashboardMetrics.map((metric, index) => (
          <MetricCard key={metric.title} data={metric} index={index} />
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
        <DistributionChart
          title="Revenue Distribution"
          subtitle="FY 2081/82 · NPR 1,847.2B total"
          data={revenueDistribution}
          badgeLabel="REVENUE"
          badgeVariant="info"
        />
        <DistributionChart
          title="Expenditure Distribution"
          subtitle="FY 2081/82 · NPR 3,295.3B total"
          data={expenditureDistribution}
          badgeLabel="EXPENDITURE"
          badgeVariant="secondary"
        />
      </div>

      {/* Bottom Progress Bars */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.5 }}
        className="grid grid-cols-1 xl:grid-cols-2 gap-6"
      >
        <div className="bg-card rounded-xl p-6 shadow-md border-none">
          <h3 className="text-sm font-semibold text-foreground mb-4">Revenue Category Breakdown</h3>
          <SegmentedProgress
            segments={revenueBreakdown.map((item) => ({
              label: item.category,
              percentage: item.percentage,
              color: item.color,
            }))}
          />
        </div>
        <div className="bg-card rounded-xl p-6 shadow-md border-none">
          <h3 className="text-sm font-semibold text-foreground mb-4">Expenditure Category Breakdown</h3>
          <SegmentedProgress
            segments={expenditureBreakdown.map((item) => ({
              label: item.category,
              percentage: item.percentage,
              color: item.color,
            }))}
          />
        </div>
      </motion.div>
    </Layout>
  );
}
