import { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { FiscalYearData } from "@/data/budgetData";
import type { ChartTooltipProps } from "@/components/charts/chartTypes";

interface FiscalTrendsChartProps {
  data: FiscalYearData[];
}

const formatYAxis = (value: number) => {
  return `$${value}B`;
};

const CustomTooltip = ({ active, payload, label }: ChartTooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 border border-border rounded-lg shadow-lg">
        <p className="text-sm font-semibold text-foreground mb-2">{label}</p>
        {payload.map((entry, index) => (
          <p key={index} className="text-xs flex items-center gap-2 mb-1">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-muted-foreground">{entry.name}:</span>
            <span className="font-semibold text-foreground">
              ${entry.value}B
            </span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function FiscalTrendsChart({ data }: FiscalTrendsChartProps) {
  const [hoveredLine, setHoveredLine] = useState<string | null>(null);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Card className="border-none shadow-md">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                Fiscal Overview
              </p>
              <CardTitle className="text-xl font-semibold">
                Revenue, Expenditure & Outstanding Debt
              </CardTitle>
            </div>
            <Badge variant="secondary">USD Billions</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis
                  dataKey="year"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#64748B", fontSize: 12 }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#64748B", fontSize: 12 }}
                  tickFormatter={formatYAxis}
                  dx={-10}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  iconType="line"
                  wrapperStyle={{ paddingTop: "20px" }}
                />
                <Line
                  type="monotone"
                  dataKey="outstandingDebt"
                  name="Outstanding Debt"
                  stroke="#F97316"
                  strokeWidth={hoveredLine === "outstandingDebt" ? 4 : 2.5}
                  dot={false}
                  activeDot={{ r: 5 }}
                  onMouseEnter={() => setHoveredLine("outstandingDebt")}
                  onMouseLeave={() => setHoveredLine(null)}
                  animationDuration={1500}
                />
                <Line
                  type="monotone"
                  dataKey="expenditure"
                  name="Total Expenditure"
                  stroke="#DC2626"
                  strokeWidth={hoveredLine === "expenditure" ? 4 : 2.5}
                  dot={false}
                  activeDot={{ r: 5 }}
                  onMouseEnter={() => setHoveredLine("expenditure")}
                  onMouseLeave={() => setHoveredLine(null)}
                  animationDuration={1500}
                />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  name="Total Revenue"
                  stroke="#16A34A"
                  strokeWidth={hoveredLine === "revenue" ? 4 : 2.5}
                  dot={false}
                  activeDot={{ r: 5 }}
                  onMouseEnter={() => setHoveredLine("revenue")}
                  onMouseLeave={() => setHoveredLine(null)}
                  animationDuration={1500}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
