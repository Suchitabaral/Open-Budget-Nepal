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
  { year: "2019/20", recurrent: 680, capital: 245, financial: 125 },
  { year: "2020/21", recurrent: 790, capital: 290, financial: 148 },
  { year: "2021/22", recurrent: 950, capital: 360, financial: 172 },
  { year: "2022/23", recurrent: 1180, capital: 450, financial: 210 },
  { year: "2023/24", recurrent: 1520, capital: 580, financial: 265 },
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

export default function ExpenditureBreakdownChart() {
  const [hoveredBar, setHoveredBar] = useState<string | null>(null);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Card className="border-none shadow-md">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Expenditure Breakdown by Category</CardTitle>
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
                  dataKey="recurrent"
                  name="Recurrent"
                  fill="#6366F1"
                  radius={[4, 4, 0, 0]}
                  opacity={hoveredBar === "recurrent" || hoveredBar === null ? 1 : 0.5}
                  onMouseEnter={() => setHoveredBar("recurrent")}
                  onMouseLeave={() => setHoveredBar(null)}
                />
                <Bar
                  dataKey="capital"
                  name="Capital"
                  fill="#22C55E"
                  radius={[4, 4, 0, 0]}
                  opacity={hoveredBar === "capital" || hoveredBar === null ? 1 : 0.5}
                  onMouseEnter={() => setHoveredBar("capital")}
                  onMouseLeave={() => setHoveredBar(null)}
                />
                <Bar
                  dataKey="financial"
                  name="Financial"
                  fill="#EC4899"
                  radius={[4, 4, 0, 0]}
                  opacity={hoveredBar === "financial" || hoveredBar === null ? 1 : 0.5}
                  onMouseEnter={() => setHoveredBar("financial")}
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
