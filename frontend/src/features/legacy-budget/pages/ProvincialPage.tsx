import { motion } from "framer-motion";
import { Calendar } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import Layout from "@/components/layout/Layout";
import PageHeader from "@/components/layout/PageHeader";
import SecondaryNav from "@/components/dashboard/SecondaryNav";
import MetricCard from "@/components/dashboard/MetricCard";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { MetricCardData } from "@/data/budgetData";

const provincialMetrics: MetricCardData[] = [
  { title: "TOTAL PROVINCIAL BUDGET", value: "NPR 574.1B", change: 9.2, changeLabel: "vs FY 2080/81", iconColor: "#8B5CF6", iconBgColor: "#F5F3FF" },
  { title: "TOTAL ACTUAL SPEND", value: "NPR 487.8B", change: 6.8, changeLabel: "vs FY 2080/81", iconColor: "#22C55E", iconBgColor: "#F0FDF4" },
  { title: "AVG UTILIZATION", value: "84.0%", change: -1.8, changeLabel: "vs FY 2080/81", iconColor: "#F59E0B", iconBgColor: "#FFFBEB", utilization: 84 },
  { title: "PROVINCES", value: "7", change: 0, changeLabel: "across Nepal", iconColor: "#3B82F6", iconBgColor: "#EFF6FF" },
];

const provinceBarData = [
  { province: "Koshi", budgeted: 89.4, actual: 76.8 },
  { province: "Madhesh", budgeted: 76.8, actual: 62.4 },
  { province: "Bagmati", budgeted: 142.3, actual: 128.6 },
  { province: "Gandaki", budgeted: 68.9, actual: 59.6 },
  { province: "Lumbini", budgeted: 85.6, actual: 70.2 },
  { province: "Karnali", budgeted: 52.4, actual: 41.8 },
  { province: "Sudurpashchim", budgeted: 58.7, actual: 48.3 },
];

const provinceSummary = [
  { name: "Koshi Province", capital: "Biratnagar", districts: 14, budget: 89.4, utilization: 85.9, image: "https://images.unsplash.com/photo-1605732562742-62f7c360e5a4?q=80&w=200&auto=format&fit=crop" },
  { name: "Madhesh Province", capital: "Janakpur", districts: 8, budget: 76.8, utilization: 81.2, image: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?q=80&w=200&auto=format&fit=crop" },
  { name: "Bagmati Province", capital: "Hetauda", districts: 13, budget: 142.3, utilization: 90.4, image: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?q=80&w=200&auto=format&fit=crop" },
  { name: "Gandaki Province", capital: "Pokhara", districts: 11, budget: 68.9, utilization: 86.5, image: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=200&auto=format&fit=crop" },
  { name: "Lumbini Province", capital: "Deukhuri", districts: 12, budget: 85.6, utilization: 82.0, image: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?q=80&w=200&auto=format&fit=crop" },
  { name: "Karnali Province", capital: "Birendranagar", districts: 10, budget: 52.4, utilization: 79.8, image: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=200&auto=format&fit=crop" },
  { name: "Sudurpashchim Province", capital: "Dhangadhi", districts: 9, budget: 58.7, utilization: 82.3, image: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?q=80&w=200&auto=format&fit=crop" },
];

function getUtilColor(u: number) {
  if (u >= 90) return "text-emerald-600";
  if (u >= 80) return "text-orange-500";
  return "text-red-600";
}



export default function Provincial() {
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
        eyebrow="FY 2081/82 · PROVINCIAL GOVERNMENTS"
        title="Provincial Budget"
        subtitle="Budget allocation and utilization across Nepal's 7 provinces"
        backgroundImage="https://images.unsplash.com/photo-1605732562742-62f7c360e5a4?q=80&w=2070&auto=format&fit=crop"
        action={
          <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
            Last updated: Jun 2025
          </Badge>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
        {provincialMetrics.map((metric, index) => (
          <MetricCard key={metric.title} data={metric} index={index} />
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
        {/* Budget vs Actual by Province */}
        <Card className="border-none shadow-md">
          <CardHeader className="pb-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Budget vs Actual by Province</p>
            <CardTitle className="text-sm font-medium text-muted-foreground">FY 2081/82 · NPR Billions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={provinceBarData} layout="vertical" margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: "#64748B", fontSize: 11 }} tickFormatter={(v) => `${v}B`} />
                  <YAxis type="category" dataKey="province" axisLine={false} tickLine={false} tick={{ fill: "#64748B", fontSize: 11 }} width={110} />
                  <Tooltip formatter={(v) => `NPR ${v}B`} />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: "16px" }} />
                  <Bar dataKey="budgeted" name="Budgeted" fill="#CBD5E1" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="actual" name="Actual" fill="#2563EB" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Province Summary */}
        <Card className="border-none shadow-md">
          <CardHeader className="pb-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Province Summary</p>
            <CardTitle className="text-sm font-medium text-muted-foreground">FY 2081/82</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-[320px] overflow-y-auto pr-2">
              {provinceSummary.map((p) => (
                <div key={p.name} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="h-12 w-12 rounded-lg overflow-hidden flex-shrink-0 bg-muted">
                    <img src={p.image} alt={p.name} className="h-full w-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.capital} · {p.districts} districts</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-foreground">NPR {p.budget}B</p>
                    <p className={`text-xs font-semibold ${getUtilColor(p.utilization)}`}>{p.utilization}%</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
