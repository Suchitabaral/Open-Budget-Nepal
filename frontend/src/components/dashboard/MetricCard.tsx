import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, BarChart3 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { MetricCardData } from "@/data/budgetData";

interface MetricCardProps {
  data: MetricCardData;
  index: number;
}

export default function MetricCard({ data, index }: MetricCardProps) {
  const isPositive = data.change >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
    >
      <Card className="overflow-hidden border-none shadow-md hover:shadow-xl transition-shadow duration-300">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="space-y-4 flex-1">
              <p className="text-xs font-semibold text-muted-foreground tracking-wider">
                {data.title}
              </p>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl lg:text-3xl font-bold text-foreground">
                  {data.value.split(" ")[0]}
                </span>
                <span className="text-lg font-semibold text-muted-foreground">
                  {data.value.split(" ").slice(1).join(" ")}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${
                    isPositive
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {isPositive ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : (
                    <TrendingDown className="h-3 w-3" />
                  )}
                  {isPositive ? "+" : ""}
                  {data.change}%
                </span>
                <span className="text-xs text-muted-foreground">{data.changeLabel}</span>
              </div>
            </div>
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl"
              style={{ backgroundColor: data.iconBgColor }}
            >
              <BarChart3 className="h-5 w-5" style={{ color: data.iconColor }} />
            </div>
          </div>
          {data.utilization !== undefined && (
            <div className="mt-5">
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${data.utilization}%` }}
                  transition={{ duration: 1, delay: 0.5 }}
                  className="h-full rounded-full"
                  style={{ backgroundColor: data.iconColor }}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
