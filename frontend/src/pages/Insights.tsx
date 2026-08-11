import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, AlertTriangle, Scale } from "lucide-react";
import Layout from "@/components/layout/Layout";
import PageHeader from "@/components/layout/PageHeader";
import FiscalTrendsChart from "@/components/charts/FiscalTrendsChart";
import RevenueBreakdownChart from "@/components/charts/RevenueBreakdownChart";
import ExpenditureBreakdownChart from "@/components/charts/ExpenditureBreakdownChart";
import DebtAnalysisChart from "@/components/charts/DebtAnalysisChart";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fiscalTrendsData } from "@/data/budgetData";

const yearRanges = [
  { label: "Last 5 Years", value: "5" },
  { label: "Last 10 Years", value: "10" },
  { label: "Last 20 Years", value: "20" },
];

interface StatCardProps {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  colorClass: string;
  delay: number;
}

function StatCard({ title, value, subtitle, icon, colorClass, delay }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
    >
      <Card className="border-none shadow-md hover:shadow-lg transition-shadow">
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className={`text-xs font-semibold uppercase tracking-wider mb-2 ${colorClass}`}>
                {title}
              </p>
              <p className="text-2xl lg:text-3xl font-bold text-foreground">{value}</p>
              <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
            </div>
            <div className={`p-2 rounded-lg ${colorClass.replace("text-", "bg-").replace("700", "100")}`}>
              {icon}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default function Insights() {
  const [yearRange, setYearRange] = useState("20");

  const filteredData = useMemo(() => {
    const count = parseInt(yearRange, 10);
    return fiscalTrendsData.slice(-count);
  }, [yearRange]);

  const latest = filteredData[filteredData.length - 1];
  const stats = [
    {
      title: "Latest Revenue",
      value: `$${latest.revenue}B`,
      subtitle: latest.yearLabel,
      icon: <TrendingUp className="h-5 w-5 text-green-600" />,
      colorClass: "text-green-600",
    },
    {
      title: "Latest Expenditure",
      value: `$${latest.expenditure}B`,
      subtitle: latest.yearLabel,
      icon: <TrendingDown className="h-5 w-5 text-red-600" />,
      colorClass: "text-red-600",
    },
    {
      title: "Outstanding Debt",
      value: `$${latest.outstandingDebt}B`,
      subtitle: latest.yearLabel,
      icon: <AlertTriangle className="h-5 w-5 text-orange-600" />,
      colorClass: "text-orange-600",
    },
    {
      title: "Fiscal Balance",
      value: `$${latest.fiscalBalance}B`,
      subtitle: `Deficit · ${latest.yearLabel}`,
      icon: <Scale className="h-5 w-5 text-cyan-600" />,
      colorClass: "text-cyan-600",
    },
  ];

  return (
    <Layout>
      <PageHeader
        title="Historical Fiscal Trends"
        subtitle="Track Nepal's fiscal performance across revenue, expenditure, and debt over time."
      />

      <Tabs defaultValue="overview" className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <TabsList className="bg-white border border-border shadow-sm">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="revenue">Revenue Breakdown</TabsTrigger>
            <TabsTrigger value="expenditure">Expenditure Breakdown</TabsTrigger>
            <TabsTrigger value="debt">Debt Analysis</TabsTrigger>
          </TabsList>

          <Select value={yearRange} onValueChange={setYearRange}>
            <SelectTrigger className="w-[180px] bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearRanges.map((range) => (
                <SelectItem key={range.value} value={range.value}>
                  {range.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <TabsContent value="overview" className="space-y-6 mt-0">
          <FiscalTrendsChart data={filteredData} />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((stat, index) => (
              <StatCard key={stat.title} {...stat} delay={index * 0.1} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="revenue" className="mt-0">
          <RevenueBreakdownChart />
        </TabsContent>

        <TabsContent value="expenditure" className="mt-0">
          <ExpenditureBreakdownChart />
        </TabsContent>

        <TabsContent value="debt" className="mt-0">
          <DebtAnalysisChart data={filteredData} />
        </TabsContent>
      </Tabs>
    </Layout>
  );
}
