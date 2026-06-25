import { useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { FiscalYearData } from "@/data/budgetData";

interface DebtAnalysisChartProps {
  data: FiscalYearData[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 border border-border rounded-lg shadow-lg">
        <p className="text-sm font-semibold text-foreground mb-2">{label}</p>
        <p className="text-xs flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-orange-500" />
          <span className="text-muted-foreground">Debt-to-GDP Ratio:</span>
          <span className="font-semibold text-foreground">{payload[0].value}%</span>
        </p>
      </div>
    );
  }
  return null;
};

export default function DebtAnalysisChart({ data }: DebtAnalysisChartProps) {
  const [isHovered, setIsHovered] = useState(false);

  const chartData = data.map((item) => ({
    ...item,
    debtToGdp: Number(((item.outstandingDebt / (item.revenue * 3.5)) * 100).toFixed(1)),
  }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Card className="border-none shadow-md">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Debt-to-GDP Ratio Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                <defs>
                  <linearGradient id="debtGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F97316" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#F97316" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fill: "#64748B", fontSize: 12 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748B", fontSize: 12 }} dx={-10} unit="%" />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="debtToGdp"
                  name="Debt-to-GDP Ratio"
                  stroke="#F97316"
                  strokeWidth={isHovered ? 4 : 2.5}
                  fill="url(#debtGradient)"
                  onMouseEnter={() => setIsHovered(true)}
                  onMouseLeave={() => setIsHovered(false)}
                  animationDuration={1500}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
