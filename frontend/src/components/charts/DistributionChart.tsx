import { useState } from "react";
import { PieChart, Pie as RePie, Cell, ResponsiveContainer, Sector } from "recharts";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { DistributionItem } from "@/data/budgetData";

interface DistributionChartProps {
  title: string;
  subtitle: string;
  data: DistributionItem[];
  badgeLabel: string;
  badgeVariant?: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info";
}

const renderActiveShape = (props: any) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
  return (
    <g>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + 6}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
    </g>
  );
};

const Pie = RePie as React.ComponentType<any>;

export default function DistributionChart({
  title,
  subtitle,
  data,
  badgeLabel,
  badgeVariant = "default",
}: DistributionChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.3 }}
    >
      <Card className="border-none shadow-md h-full">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-lg font-semibold">{title}</CardTitle>
              <CardDescription>{subtitle}</CardDescription>
            </div>
            <Badge variant={badgeVariant}>{badgeLabel}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col lg:flex-row items-center gap-6">
            {/* Chart */}
            <div className="relative h-48 w-48 flex-shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    activeIndex={activeIndex ?? undefined}
                    activeShape={renderActiveShape as any}
                    data={data}
                    cx="50%"
                    cy="50%"
                    innerRadius={58}
                    outerRadius={76}
                    paddingAngle={2}
                    dataKey="value"
                    onMouseEnter={(_: any, index: number) => setActiveIndex(index)}
                    onMouseLeave={() => setActiveIndex(null)}
                    animationBegin={0}
                    animationDuration={1200}
                  >
                    {data.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xs font-semibold text-muted-foreground uppercase">
                  {badgeLabel}
                </span>
                <span className="text-[10px] text-muted-foreground">hover slice</span>
              </div>
            </div>

            {/* Legend */}
            <div className="flex-1 w-full space-y-3">
              {data.map((item, index) => (
                <div
                  key={item.name}
                  className="flex items-center justify-between py-2 border-b border-border last:border-0"
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseLeave={() => setActiveIndex(null)}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-sm font-medium text-foreground">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-semibold text-foreground">
                      {item.percentage}%
                    </span>
                    <span className="text-sm text-muted-foreground w-24 text-right">
                      {item.amount}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
