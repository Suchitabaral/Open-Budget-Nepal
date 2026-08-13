import { motion } from "framer-motion";
import { Calendar } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import Layout from "@/components/layout/Layout";
import PageHeader from "@/components/layout/PageHeader";
import SecondaryNav from "@/components/dashboard/SecondaryNav";
import MetricCard from "@/components/dashboard/MetricCard";
import DistributionChart from "@/components/charts/DistributionChart";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { MetricCardData } from "@/data/budgetData";

const federalMetrics: MetricCardData[] = [
  { title: "TOTAL FEDERAL BUDGET", value: "NPR 2895.3B", change: 10.4, changeLabel: "vs FY 2080/81", iconColor: "#2563EB", iconBgColor: "#EFF6FF" },
  { title: "RECURRENT EXPENDITURE", value: "NPR 1847.2B", change: 7.2, changeLabel: "vs FY 2080/81", iconColor: "#22C55E", iconBgColor: "#F0FDF4" },
  { title: "CAPITAL EXPENDITURE", value: "NPR 714.8B", change: 14.6, changeLabel: "vs FY 2080/81", iconColor: "#F59E0B", iconBgColor: "#FFFBEB" },
  { title: "DEBT SERVICE", value: "NPR 333.3B", change: 3.1, changeLabel: "vs FY 2080/81", iconColor: "#DC2626", iconBgColor: "#FEF2F2" },
];

const budgetVsActual = [
  { year: "2077/78", budgeted: 1845, actual: 1587 },
  { year: "2078/79", budgeted: 2180, actual: 1811 },
  { year: "2079/80", budgeted: 2485, actual: 2073 },
  { year: "2080/81", budgeted: 2750, actual: 2365 },
  { year: "2081/82", budgeted: 3720, actual: 2895 },
];

const ministryBudgetShare = [
  { name: "Finance", value: 30.8, percentage: 30.8, amount: "NPR 892.4B", color: "#3B82F6" },
  { name: "Infrastructure", value: 22.3, percentage: 22.3, amount: "NPR 645.2B", color: "#22C55E" },
  { name: "Health", value: 14.6, percentage: 14.6, amount: "NPR 423.8B", color: "#14B8A6" },
  { name: "Education", value: 13.8, percentage: 13.8, amount: "NPR 398.6B", color: "#F59E0B" },
  { name: "Others", value: 18.5, percentage: 18.5, amount: "NPR 535.3B", color: "#8B5CF6" },
];

const ministryExpenditure = [
  { ministry: "Finance", budgeted: 892.4, actual: 847.2, utilization: 94.9 },
  { ministry: "Infrastructure", budgeted: 645.2, actual: 567.8, utilization: 88.0 },
  { ministry: "Health", budgeted: 423.8, actual: 398.4, utilization: 94.0 },
  { ministry: "Education", budgeted: 398.6, actual: 371.2, utilization: 93.1 },
  { ministry: "Agriculture", budgeted: 312.4, actual: 274.6, utilization: 87.9 },
  { ministry: "Defense", budgeted: 287.3, actual: 279.4, utilization: 97.2 },
  { ministry: "Home Affairs", budgeted: 234.6, actual: 218.9, utilization: 93.3 },
  { ministry: "Others", budgeted: 526.3, actual: 337.8, utilization: 64.2 },
];

function getUtilColor(u: number) {
  if (u >= 90) return "text-emerald-600 bg-emerald-500";
  if (u >= 80) return "text-orange-500 bg-orange-400";
  return "text-red-600 bg-red-500";
}

export default function Federal() {
  return (
    <Layout>
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

      <PageHeader
        eyebrow="FY 2081/82 · FEDERAL GOVERNMENT"
        title="Federal Budget"
        subtitle="Ministry-wise budget allocation and expenditure utilization"
        backgroundImage="https://images.unsplash.com/photo-1449158743715-0a90ebb6d2d8?q=80&w=2070&auto=format&fit=crop"
        action={
          <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
            Last updated: Jun 2025
          </Badge>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
        {federalMetrics.map((metric, index) => (
          <MetricCard key={metric.title} data={metric} index={index} />
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
        {/* Budget vs Actual Trend */}
        <Card className="border-none shadow-md">
          <CardHeader className="pb-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Budget vs Actual Trend</p>
            <CardTitle className="text-sm font-medium text-muted-foreground">Last 5 fiscal years</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={budgetVsActual} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fill: "#64748B", fontSize: 11 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748B", fontSize: 11 }} tickFormatter={(v) => `${v}B`} dx={-10} />
                  <Tooltip formatter={(v) => `NPR ${v}B`} />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: "16px" }} />
                  <Bar dataKey="budgeted" name="Budgeted" fill="#CBD5E1" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="actual" name="Actual" fill="#2563EB" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Ministry Budget Share */}
        <DistributionChart
          title="Ministry Budget Share"
          subtitle="FY 2081/82 allocation"
          data={ministryBudgetShare}
          badgeLabel="FEDERAL"
          badgeVariant="info"
        />
      </div>

      {/* Ministry-wise Expenditure Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.4 }}
      >
        <Card className="border-none shadow-md">
          <CardHeader className="pb-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ministry-wise Expenditure</p>
            <CardTitle className="text-sm font-medium text-muted-foreground">FY 2081/82 · NPR Billions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-2 font-semibold text-muted-foreground uppercase tracking-wider text-xs">Ministry</th>
                    <th className="text-right py-3 px-2 font-semibold text-muted-foreground uppercase tracking-wider text-xs">Budgeted</th>
                    <th className="text-right py-3 px-2 font-semibold text-muted-foreground uppercase tracking-wider text-xs">Actual</th>
                    <th className="text-right py-3 px-2 font-semibold text-muted-foreground uppercase tracking-wider text-xs">Utilization</th>
                    <th className="text-left py-3 px-4 font-semibold text-muted-foreground uppercase tracking-wider text-xs">Progress</th>
                  </tr>
                </thead>
                <tbody>
                  {ministryExpenditure.map((row) => {
                    const [textColor, barColor] = getUtilColor(row.utilization).split(" ");
                    return (
                      <tr key={row.ministry} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                        <td className="py-3 px-2 font-medium text-foreground">{row.ministry}</td>
                        <td className="py-3 px-2 text-right text-muted-foreground">NPR {row.budgeted}B</td>
                        <td className="py-3 px-2 text-right text-muted-foreground">NPR {row.actual}B</td>
                        <td className={`py-3 px-2 text-right font-semibold ${textColor}`}>{row.utilization}%</td>
                        <td className="py-3 px-4">
                          <div className="h-2 w-full max-w-[120px] rounded-full bg-muted overflow-hidden">
                            <div className={`h-full rounded-full ${barColor}`} style={{ width: `${row.utilization}%` }} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </Layout>
  );
}
