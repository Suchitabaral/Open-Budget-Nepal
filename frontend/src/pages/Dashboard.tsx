import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight, Bot, Calendar, TrendingUp, TrendingDown, Banknote, Scale, Wallet, Landmark, ShieldAlert } from "lucide-react";
import Layout from "@/components/layout/Layout";
import PageHeader from "@/components/layout/PageHeader";
import SecondaryNav from "@/components/dashboard/SecondaryNav";
import MetricCard from "@/components/dashboard/MetricCard";
import DistributionChart from "@/components/charts/DistributionChart";
import SegmentedProgress from "@/components/charts/SegmentedProgress";
import HistoricalFiscalTrends from "@/components/charts/HistoricalFiscalTrends";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  dashboardMetrics,
  revenueDistribution,
  expenditureDistribution,
  revenueBreakdown,
  expenditureBreakdown,
} from "@/data/budgetData";

const summaryCards = [
  { label: "Latest Revenue", value: "NPR 1,847.2B", change: "+12.4%", changePositive: true, icon: Banknote, color: "text-emerald-600", bg: "bg-emerald-50" },
  { label: "Latest Expenditure", value: "NPR 3,295.3B", change: "+10.2%", changePositive: true, icon: Wallet, color: "text-red-600", bg: "bg-red-50" },
  { label: "Outstanding Debt", value: "NPR 2,715.4B", change: "+14.8%", changePositive: true, icon: Landmark, color: "text-orange-600", bg: "bg-orange-50" },
  { label: "Fiscal Balance", value: "–NPR 1,448.1B", change: "Deficit · FY 2081/82", changePositive: false, icon: Scale, color: "text-blue-600", bg: "bg-blue-50" },
];

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
        <SecondaryNav />
        <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-border shadow-sm">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Fiscal Year</span>
          <span className="text-sm font-semibold text-foreground">2081/82</span>
        </div>
      </motion.div>

      {/* Page Header (Hero Banner) */}
      <PageHeader
        eyebrow="FY 2081/82 · MINISTRY OF FINANCE"
        title="Budget Overview"
        subtitle="Federal government consolidated budget — revenue & expenditure at a glance"
        action={
          <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
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
        transition={{ duration: 0.4, delay: 0.3 }}
        className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6"
      >
        <div className="bg-card rounded-xl p-6 shadow-md border-none">
          <h3 className="text-sm font-semibold text-foreground mb-4">Revenue Category Breakdown</h3>
          <SegmentedProgress
            segments={revenueBreakdown.map((item) => ({
              label: item.category,
              percentage: item.percentage,
              color: item.color,
              amount: item.amount,
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
              amount: item.amount,
            }))}
          />
        </div>
      </motion.div>

      {/* Historical Fiscal Trends */}
      <div className="mb-6">
        <HistoricalFiscalTrends />
      </div>

      <div className="mb-6 grid gap-6 xl:grid-cols-[1.4fr_.8fr]">
        <Card>
          <div className="flex items-center justify-between border-b px-5 py-4">
            <div><h2 className="text-sm font-semibold text-slate-950">Recent procurement activity</h2><p className="mt-1 text-xs text-slate-500">Latest high-value public records</p></div>
            <Link to="/procurement" className="flex items-center gap-1 text-xs font-semibold text-emerald-700">View all <ArrowRight className="h-3.5 w-3.5"/></Link>
          </div>
          <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-sm"><thead className="bg-slate-50 text-left text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-3">Project</th><th className="px-5 py-3">Contractor</th><th className="px-5 py-3 text-right">Value</th><th className="px-5 py-3">Status</th></tr></thead><tbody>{[["Fast Track package","Nepal Infrastructure JV","NPR 12.40B","Open"],["Muglin–Pokhara works","Annapurna Construction","NPR 7.16B","Review"],["Koshi transmission corridor","Himalayan Energy JV","NPR 5.64B","Awarded"]].map(row=><tr key={row[0]} className="border-t hover:bg-slate-50"><td className="px-5 py-3.5 font-medium text-slate-900">{row[0]}</td><td className="px-5 py-3.5 text-slate-600">{row[1]}</td><td className="px-5 py-3.5 text-right font-semibold tabular-nums">{row[2]}</td><td className="px-5 py-3.5"><Badge variant={row[3]==="Review"?"warning":row[3]==="Awarded"?"success":"secondary"}>{row[3]}</Badge></td></tr>)}</tbody></table></div>
        </Card>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
          <Link to="/watchdog" className="group rounded-xl border border-red-200 bg-red-50/60 p-5 transition hover:border-red-300"><div className="flex items-center justify-between"><div className="grid h-9 w-9 place-items-center rounded-lg bg-white text-red-700 shadow-sm"><ShieldAlert className="h-4 w-4"/></div><Badge variant="destructive">12 high risk</Badge></div><h2 className="mt-5 font-semibold text-slate-950">Watchdog needs attention</h2><p className="mt-1 text-sm leading-5 text-slate-600">Review procurement anomalies flagged in the latest scan.</p><span className="mt-4 flex items-center gap-1 text-xs font-semibold text-red-700">Open risk dashboard <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1"/></span></Link>
          <Link to="/chatbot" className="group rounded-xl border border-emerald-200 bg-emerald-50/60 p-5 transition hover:border-emerald-300"><div className="grid h-9 w-9 place-items-center rounded-lg bg-white text-emerald-700 shadow-sm"><Bot className="h-4 w-4"/></div><h2 className="mt-5 font-semibold text-slate-950">Ask the budget assistant</h2><p className="mt-1 text-sm leading-5 text-slate-600">Turn fiscal records into a plain-language answer with sources.</p><span className="mt-4 flex items-center gap-1 text-xs font-semibold text-emerald-700">Start a conversation <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1"/></span></Link>
        </div>
      </div>

      {/* Bottom Summary Cards */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.6 }}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5"
      >
        {summaryCards.map((card) => (
          <Card key={card.label} className="border-none shadow-md hover:shadow-lg transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {card.label}
                </p>
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${card.bg}`}>
                  <card.icon className={`h-4 w-4 ${card.color}`} />
                </div>
              </div>
              <p className={`text-xl font-bold ${card.color}`}>{card.value}</p>
              <div className="flex items-center gap-1 mt-2">
                {card.changePositive ? (
                  <TrendingUp className="h-3 w-3 text-emerald-600" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-red-600" />
                )}
                <span
                  className={`text-xs font-semibold ${
                    card.changePositive ? "text-emerald-600" : "text-red-600"
                  }`}
                >
                  {card.change}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </motion.div>
    </Layout>
  );
}
