import { useState } from "react";
import {
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

const data = [
  { year: "2019/20", tax: 420, loan: 180, grant: 65 },
  { year: "2020/21", tax: 485, loan: 210, grant: 72 },
  { year: "2021/22", tax: 580, loan: 245, grant: 85 },
  { year: "2022/23", tax: 720, loan: 290, grant: 98 },
  { year: "2023/24", tax: 890, loan: 345, grant: 112 },
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 border border-border rounded-lg shadow-lg">
        <p className="text-sm font-semibold text-foreground mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-xs flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-muted-foreground">{entry.name}:</span>
            <span className="font-semibold text-foreground">${entry.value}B</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function RevenueBreakdownChart() {
  const [hoveredBar, setHoveredBar] = useState<string | null>(null);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Card className="border-none shadow-md">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Revenue Breakdown by Source</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fill: "#64748B", fontSize: 12 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748B", fontSize: 12 }} dx={-10} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ paddingTop: "20px" }} />
                <Bar
                  dataKey="tax"
                  name="Tax Revenue"
                  fill="#F59E0B"
                  radius={[4, 4, 0, 0]}
                  opacity={hoveredBar === "tax" || hoveredBar === null ? 1 : 0.5}
                  onMouseEnter={() => setHoveredBar("tax")}
                  onMouseLeave={() => setHoveredBar(null)}
                />
                <Bar
                  dataKey="loan"
                  name="Loan"
                  fill="#22C55E"
                  radius={[4, 4, 0, 0]}
                  opacity={hoveredBar === "loan" || hoveredBar === null ? 1 : 0.5}
                  onMouseEnter={() => setHoveredBar("loan")}
                  onMouseLeave={() => setHoveredBar(null)}
                />
                <Bar
                  dataKey="grant"
                  name="Grant"
                  fill="#3B82F6"
                  radius={[4, 4, 0, 0]}
                  opacity={hoveredBar === "grant" || hoveredBar === null ? 1 : 0.5}
                  onMouseEnter={() => setHoveredBar("grant")}
                  onMouseLeave={() => setHoveredBar(null)}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
