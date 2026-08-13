import { useState } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { fiscalTrendsData } from "@/data/budgetData";
import type { ChartTooltipProps } from "@/components/charts/chartTypes";

const tabs = [
  { label: "Overview", value: "overview" },
  { label: "Revenue Breakdown", value: "revenue" },
  { label: "Expenditure Breakdown", value: "expenditure" },
  { label: "Debt Analysis", value: "debt" },
] as const;

type TabValue = (typeof tabs)[number]["value"];

const formatYAxis = (value: number) => `${value}B`;

const CustomTooltip = ({ active, payload, label }: ChartTooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 border border-border rounded-lg shadow-lg">
        <p className="text-sm font-semibold text-foreground mb-2">FY {label}</p>
        {payload.map((entry, index) => (
          <p key={index} className="text-xs flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-muted-foreground">{entry.name}:</span>
            <span className="font-semibold text-foreground">NPR {entry.value}B</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const last20Years = fiscalTrendsData;

export default function HistoricalFiscalTrends() {
  const [activeTab, setActiveTab] = useState<TabValue>("overview");

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Card className="border-none shadow-md">
        <CardHeader className="pb-2">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-1 h-6 bg-red-500 rounded-full" />
              <div>
                <CardTitle className="text-base font-semibold">Historical Fiscal Trends</CardTitle>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="flex items-center gap-1 bg-muted/50 rounded-full p-1">
                {tabs.map((tab) => (
                  <button
                    key={tab.value}
                    onClick={() => setActiveTab(tab.value)}
                    className={cn(
                      "px-3 py-1.5 text-xs font-medium rounded-full transition-colors",
                      activeTab === tab.value
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-border shadow-sm text-xs text-muted-foreground">
                Last 20 Years
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[380px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              {activeTab === "overview" ? (
                <LineChart data={last20Years} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fill: "#64748B", fontSize: 11 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748B", fontSize: 11 }} tickFormatter={formatYAxis} dx={-10} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend verticalAlign="bottom" height={36} iconType="line" wrapperStyle={{ paddingTop: "20px" }} />
                  <Line type="monotone" dataKey="revenue" name="Total Revenue" stroke="#16A34A" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} animationDuration={1500} />
                  <Line type="monotone" dataKey="expenditure" name="Total Expenditure" stroke="#DC2626" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} animationDuration={1500} />
                  <Line type="monotone" dataKey="outstandingDebt" name="Outstanding Debt" stroke="#F97316" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} animationDuration={1500} />
                </LineChart>
              ) : activeTab === "revenue" ? (
                <BarChart data={last20Years} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fill: "#64748B", fontSize: 11 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748B", fontSize: 11 }} tickFormatter={formatYAxis} dx={-10} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend verticalAlign="bottom" height={36} wrapperStyle={{ paddingTop: "20px" }} />
                  <Bar dataKey="revenue" name="Revenue" fill="#16A34A" radius={[4, 4, 0, 0]} animationDuration={1500} />
                </BarChart>
              ) : activeTab === "expenditure" ? (
                <BarChart data={last20Years} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fill: "#64748B", fontSize: 11 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748B", fontSize: 11 }} tickFormatter={formatYAxis} dx={-10} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend verticalAlign="bottom" height={36} wrapperStyle={{ paddingTop: "20px" }} />
                  <Bar dataKey="expenditure" name="Expenditure" fill="#DC2626" radius={[4, 4, 0, 0]} animationDuration={1500} />
                </BarChart>
              ) : (
                <LineChart data={last20Years} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fill: "#64748B", fontSize: 11 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748B", fontSize: 11 }} tickFormatter={formatYAxis} dx={-10} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend verticalAlign="bottom" height={36} iconType="line" wrapperStyle={{ paddingTop: "20px" }} />
                  <Line type="monotone" dataKey="outstandingDebt" name="Outstanding Debt" stroke="#F97316" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} animationDuration={1500} />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
