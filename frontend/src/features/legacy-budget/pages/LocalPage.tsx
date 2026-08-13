import { motion } from "framer-motion";
import { Calendar, Landmark } from "lucide-react";
import Layout from "@/components/layout/Layout";
import PageHeader from "@/components/layout/PageHeader";
import SecondaryNav from "@/components/dashboard/SecondaryNav";
import MetricCard from "@/components/dashboard/MetricCard";
import DistributionChart from "@/components/charts/DistributionChart";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { MetricCardData } from "@/data/budgetData";

const localMetrics: MetricCardData[] = [
  { title: "TOTAL LOCAL BUDGET", value: "NPR 624.1B", change: 11.3, changeLabel: "vs FY 2080/81", iconColor: "#2563EB", iconBgColor: "#EFF6FF" },
  { title: "TOTAL ACTUAL SPEND", value: "NPR 515.4B", change: 8.7, changeLabel: "vs FY 2080/81", iconColor: "#22C55E", iconBgColor: "#F0FDF4" },
  { title: "AVG UTILIZATION", value: "82.6%", change: -2.1, changeLabel: "vs FY 2080/81", iconColor: "#F59E0B", iconBgColor: "#FFFBEB", utilization: 82.6 },
  { title: "LOCAL UNITS", value: "753", change: 0, changeLabel: "across Nepal", iconColor: "#8B5CF6", iconBgColor: "#F5F3FF" },
];

const unitTypes = [
  { name: "Metropolitan Cities", count: 6, budget: 112.4, utilization: 87.0, iconColor: "#3B82F6", iconBg: "#EFF6FF" },
  { name: "Sub-Metropolitan", count: 11, budget: 87.6, utilization: 84.8, iconColor: "#22C55E", iconBg: "#F0FDF4" },
  { name: "Municipalities", count: 276, budget: 234.8, utilization: 82.9, iconColor: "#F59E0B", iconBg: "#FFFBEB" },
  { name: "Rural Municipalities", count: 460, budget: 189.3, utilization: 78.6, iconColor: "#8B5CF6", iconBg: "#F5F3FF" },
];

const sectorData = [
  { name: "Infrastructure", value: 38.4, percentage: 38.4, amount: "NPR 239.7B", color: "#3B82F6" },
  { name: "Education", value: 22.6, percentage: 22.6, amount: "NPR 141.0B", color: "#F59E0B" },
  { name: "Health", value: 18.2, percentage: 18.2, amount: "NPR 113.6B", color: "#22C55E" },
  { name: "Admin", value: 11.0, percentage: 11.0, amount: "NPR 68.7B", color: "#8B5CF6" },
  { name: "Agriculture", value: 9.8, percentage: 9.8, amount: "NPR 61.2B", color: "#14B8A6" },
];

const metroCities = [
  { city: "Kathmandu", province: "Bagmati", budget: 18.4, actual: 16.9, rate: 91.8 },
  { city: "Pokhara", province: "Gandaki", budget: 11.2, actual: 9.8, rate: 87.5 },
  { city: "Lalitpur", province: "Bagmati", budget: 9.6, actual: 8.7, rate: 90.6 },
  { city: "Bharatpur", province: "Bagmati", budget: 8.3, actual: 7.2, rate: 86.7 },
  { city: "Biratnagar", province: "Koshi", budget: 7.8, actual: 6.6, rate: 84.6 },
  { city: "Birgunj", province: "Madhesh", budget: 7.1, actual: 5.8, rate: 81.7 },
];

function getUtilColor(u: number) {
  if (u >= 90) return "text-emerald-600";
  if (u >= 80) return "text-orange-500";
  return "text-red-600";
}

function getUtilBg(u: number) {
  if (u >= 90) return "bg-emerald-500";
  if (u >= 80) return "bg-orange-400";
  return "bg-red-500";
}

export default function Local() {
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
        eyebrow="FY 2081/82 · LOCAL GOVERNMENTS"
        title="Local Budget"
        subtitle="Aggregated budgets of 753 local government units across Nepal"
        backgroundImage="https://images.unsplash.com/photo-1506905925346-21bda4d32df4?q=80&w=2070&auto=format&fit=crop"
        action={
          <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
            Last updated: Jun 2025
          </Badge>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
        {localMetrics.map((metric, index) => (
          <MetricCard key={metric.title} data={metric} index={index} />
        ))}
      </div>

      {/* Unit Type Breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
        {unitTypes.map((u) => (
          <Card key={u.name} className="border-none shadow-md hover:shadow-lg transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{u.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">{u.count} units</p>
                </div>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: u.iconBg }}>
                  <Landmark className="h-4 w-4" style={{ color: u.iconColor }} />
                </div>
              </div>
              <p className="text-xl font-bold text-foreground mb-2">NPR {u.budget}B</p>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div className={`h-full rounded-full ${getUtilBg(u.utilization)}`} style={{ width: `${u.utilization}%` }} />
              </div>
              <p className={`text-xs font-semibold mt-1 ${getUtilColor(u.utilization)}`}>{u.utilization}% utilization</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
        <DistributionChart
          title="Local Spending by Sector"
          subtitle="FY 2081/82 allocation"
          data={sectorData}
          badgeLabel="LOCAL"
          badgeVariant="info"
        />

        {/* Top Metropolitan Cities */}
        <Card className="border-none shadow-md">
          <CardHeader className="pb-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Top Metropolitan Cities</p>
            <CardTitle className="text-sm font-medium text-muted-foreground">FY 2081/82 · NPR Billions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2.5 px-2 font-semibold text-muted-foreground uppercase tracking-wider text-xs">City</th>
                    <th className="text-right py-2.5 px-2 font-semibold text-muted-foreground uppercase tracking-wider text-xs">Budget</th>
                    <th className="text-right py-2.5 px-2 font-semibold text-muted-foreground uppercase tracking-wider text-xs">Actual</th>
                    <th className="text-right py-2.5 px-2 font-semibold text-muted-foreground uppercase tracking-wider text-xs">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {metroCities.map((c) => (
                    <tr key={c.city} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                      <td className="py-2.5 px-2">
                        <p className="font-medium text-foreground">{c.city}</p>
                        <p className="text-xs text-muted-foreground">{c.province}</p>
                      </td>
                      <td className="py-2.5 px-2 text-right text-muted-foreground">{c.budget}B</td>
                      <td className="py-2.5 px-2 text-right text-muted-foreground">{c.actual}B</td>
                      <td className={`py-2.5 px-2 text-right font-semibold ${getUtilColor(c.rate)}`}>{c.rate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
