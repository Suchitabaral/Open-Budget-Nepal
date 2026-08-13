import { motion } from "framer-motion";
import { Calendar } from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import Layout from "@/components/layout/Layout";
import PageHeader from "@/components/layout/PageHeader";
import SecondaryNav from "@/components/dashboard/SecondaryNav";
import MetricCard from "@/components/dashboard/MetricCard";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { MetricCardData } from "@/data/budgetData";
import type { ChartTooltipProps } from "@/components/charts/chartTypes";

const indicatorMetrics: MetricCardData[] = [
  { title: "GDP (CURRENT PRICES)", value: "NPR 5423B", change: 4.2, changeLabel: "Real growth FY 2081/82", iconColor: "#2563EB", iconBgColor: "#EFF6FF" },
  { title: "INFLATION RATE", value: "5.8%", change: -0.6, changeLabel: "CPI year-on-year", iconColor: "#F59E0B", iconBgColor: "#FFFBEB" },
  { title: "FOREX RESERVES", value: "USD 12.4B", change: 8.3, changeLabel: "9.2 months import cover", iconColor: "#8B5CF6", iconBgColor: "#F5F3FF" },
  { title: "REMITTANCE", value: "NPR 1247.8B", change: 7.3, changeLabel: "vs FY 2080/81", iconColor: "#22C55E", iconBgColor: "#F0FDF4" },
];

const gdpData = [
  { year: "2076/77", gdp: 3245 },
  { year: "2077/78", gdp: 3687 },
  { year: "2078/79", gdp: 4102 },
  { year: "2079/80", gdp: 4478 },
  { year: "2080/81", gdp: 5012 },
  { year: "2081/82", gdp: 5423 },
];

const cpiData = [
  { month: "Shrawan", overall: 6.5, food: 7.2, nonFood: 5.8 },
  { month: "Bhadra", overall: 6.1, food: 6.8, nonFood: 5.4 },
  { month: "Ashwin", overall: 5.8, food: 6.4, nonFood: 5.2 },
  { month: "Kartik", overall: 5.4, food: 5.9, nonFood: 4.9 },
  { month: "Mangsir", overall: 5.6, food: 6.1, nonFood: 5.1 },
  { month: "Poush", overall: 5.9, food: 6.5, nonFood: 5.3 },
  { month: "Magh", overall: 6.2, food: 6.9, nonFood: 5.5 },
  { month: "Falgun", overall: 5.8, food: 6.3, nonFood: 5.3 },
  { month: "Chaitra", overall: 5.5, food: 5.8, nonFood: 5.2 },
  { month: "Baisakh", overall: 5.8, food: 6.2, nonFood: 5.4 },
];

const tradeData = [
  { year: "2077/78", exports: 128, imports: 1185, remittance: 987 },
  { year: "2078/79", exports: 142, imports: 1324, remittance: 1045 },
  { year: "2079/80", exports: 156, imports: 1487, remittance: 1098 },
  { year: "2080/81", exports: 168, imports: 1612, remittance: 1163 },
  { year: "2081/82", exports: 184, imports: 1756, remittance: 1248 },
];

const macroIndicators = [
  { label: "GDP Growth", value: "4.2%", change: "+0.8%", positive: true, color: "text-emerald-600" },
  { label: "Inflation", value: "5.8%", change: "–0.6%", positive: false, color: "text-orange-500" },
  { label: "Current A/C", value: "–NPR 412B", change: "–3.2%", positive: false, color: "text-red-600" },
  { label: "Forex Cover", value: "9.2 mo", change: "+1.4%", positive: true, color: "text-blue-600" },
  { label: "Interest Rate", value: "5.5%", change: "–0.5%", positive: false, color: "text-teal-600" },
  { label: "Trade Deficit", value: "NPR 1512B", change: "–2.1%", positive: false, color: "text-purple-600" },
];

const ChartTooltip = ({ active, payload, label }: ChartTooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 border border-border rounded-lg shadow-lg">
        <p className="text-sm font-semibold text-foreground mb-2">{label}</p>
        {payload.map((entry, i) => (
          <p key={i} className="text-xs flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-muted-foreground">{entry.name}:</span>
            <span className="font-semibold text-foreground">{entry.value}</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function EconomicIndicators() {
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
        eyebrow="FY 2081/82 · NEPAL RASTRA BANK / CBS"
        title="Economic Indicators"
        subtitle="Macroeconomic overview — GDP, inflation, trade, remittance and forex reserves"
        backgroundImage="https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=2070&auto=format&fit=crop"
        action={
          <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
            Last updated: Jun 2025
          </Badge>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
        {indicatorMetrics.map((metric, index) => (
          <MetricCard key={metric.title} data={metric} index={index} />
        ))}
      </div>

      {/* GDP Chart */}
      <Card className="border-none shadow-md mb-6">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">GDP at Current Prices</p>
              <CardTitle className="text-sm font-medium text-muted-foreground">FY 2076/77 to FY 2081/82 · NPR Billions</CardTitle>
            </div>
            <Badge className="bg-emerald-50 text-emerald-600 border-emerald-200">+4.2% real growth</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={gdpData} margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fill: "#64748B", fontSize: 11 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748B", fontSize: 11 }} tickFormatter={(v) => `${v}B`} dx={-10} />
                <Tooltip content={<ChartTooltip />} />
                <Line type="monotone" dataKey="gdp" name="GDP" stroke="#2563EB" strokeWidth={2.5} dot={{ fill: "#2563EB", r: 4 }} activeDot={{ r: 6 }} animationDuration={1500} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* CPI and Trade Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
        {/* CPI */}
        <Card className="border-none shadow-md">
          <CardHeader className="pb-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Consumer Price Index (CPI)</p>
            <CardTitle className="text-sm font-medium text-muted-foreground">Monthly inflation FY 2081/82</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={cpiData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#64748B", fontSize: 10 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748B", fontSize: 11 }} tickFormatter={(v) => `${v}%`} dx={-10} domain={[0, 12]} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend iconType="line" wrapperStyle={{ paddingTop: "16px" }} />
                  <Line type="monotone" dataKey="overall" name="Overall CPI" stroke="#F59E0B" strokeWidth={2.5} strokeDasharray="5 5" dot={{ r: 3 }} animationDuration={1500} />
                  <Line type="monotone" dataKey="food" name="Food" stroke="#DC2626" strokeWidth={1.5} dot={{ r: 2 }} animationDuration={1500} />
                  <Line type="monotone" dataKey="nonFood" name="Non-Food" stroke="#2563EB" strokeWidth={1.5} dot={{ r: 2 }} animationDuration={1500} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Trade & Remittance */}
        <Card className="border-none shadow-md">
          <CardHeader className="pb-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Trade & Remittance</p>
            <CardTitle className="text-sm font-medium text-muted-foreground">Exports, imports & remittance · NPR Billions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tradeData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fill: "#64748B", fontSize: 11 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748B", fontSize: 11 }} tickFormatter={(v) => `${v}B`} dx={-10} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ paddingTop: "16px" }} />
                  <Bar dataKey="exports" name="Exports" fill="#22C55E" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="remittance" name="Remittance" fill="#14B8A6" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="imports" name="Imports" fill="#DC2626" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Key Macroeconomic Indicators */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.5 }}
      >
        <Card className="border-none shadow-md">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-3">
              <div className="w-1 h-6 bg-blue-500 rounded-full" />
              <div>
                <CardTitle className="text-base font-semibold">Key Macroeconomic Indicators</CardTitle>
                <p className="text-xs text-muted-foreground">FY 2081/82</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {macroIndicators.map((item) => (
                <div key={item.label} className="p-4 rounded-lg bg-secondary border border-border flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
                    <p className={`text-lg font-bold ${item.color}`}>{item.value}</p>
                  </div>
                  <span
                    className={`text-xs font-semibold px-2 py-1 rounded-full ${
                      item.positive ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                    }`}
                  >
                    {item.change}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </Layout>
  );
}
