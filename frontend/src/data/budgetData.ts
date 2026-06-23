// Nepal Federal Budget Data (FY 2061/62 - 2081/82)
// Values in NPR Billions

export interface FiscalYearData {
  year: string;
  yearLabel: string;
  revenue: number;
  expenditure: number;
  outstandingDebt: number;
  fiscalBalance: number;
}

export const fiscalTrendsData: FiscalYearData[] = [
  { year: "2061/62", yearLabel: "FY 2061/62", revenue: 78.5, expenditure: 95.2, outstandingDebt: 280.4, fiscalBalance: -16.7 },
  { year: "2062/63", yearLabel: "FY 2062/63", revenue: 85.3, expenditure: 104.8, outstandingDebt: 300.1, fiscalBalance: -19.5 },
  { year: "2063/64", yearLabel: "FY 2063/64", revenue: 99.7, expenditure: 122.5, outstandingDebt: 323.0, fiscalBalance: -22.8 },
  { year: "2064/65", yearLabel: "FY 2064/65", revenue: 115.4, expenditure: 141.2, outstandingDebt: 348.8, fiscalBalance: -25.8 },
  { year: "2065/66", yearLabel: "FY 2065/66", revenue: 132.8, expenditure: 165.3, outstandingDebt: 381.3, fiscalBalance: -32.5 },
  { year: "2066/67", yearLabel: "FY 2066/67", revenue: 148.2, expenditure: 189.7, outstandingDebt: 422.8, fiscalBalance: -41.5 },
  { year: "2067/68", yearLabel: "FY 2067/68", revenue: 165.5, expenditure: 216.4, outstandingDebt: 473.7, fiscalBalance: -50.9 },
  { year: "2068/69", yearLabel: "FY 2068/69", revenue: 187.3, expenditure: 248.1, outstandingDebt: 534.3, fiscalBalance: -60.8 },
  { year: "2069/70", yearLabel: "FY 2069/70", revenue: 210.8, expenditure: 278.5, outstandingDebt: 602.0, fiscalBalance: -67.7 },
  { year: "2070/71", yearLabel: "FY 2070/71", revenue: 239.4, expenditure: 315.2, outstandingDebt: 677.8, fiscalBalance: -75.8 },
  { year: "2071/72", yearLabel: "FY 2071/72", revenue: 265.7, expenditure: 352.8, outstandingDebt: 764.9, fiscalBalance: -87.1 },
  { year: "2072/73", yearLabel: "FY 2072/73", revenue: 298.5, expenditure: 388.4, outstandingDebt: 854.5, fiscalBalance: -89.9 },
  { year: "2073/74", yearLabel: "FY 2073/74", revenue: 335.2, expenditure: 441.7, outstandingDebt: 961.0, fiscalBalance: -106.5 },
  { year: "2074/75", yearLabel: "FY 2074/75", revenue: 374.8, expenditure: 498.2, outstandingDebt: 1084.4, fiscalBalance: -123.4 },
  { year: "2075/76", yearLabel: "FY 2075/76", revenue: 426.3, expenditure: 561.5, outstandingDebt: 1219.6, fiscalBalance: -135.2 },
  { year: "2076/77", yearLabel: "FY 2076/77", revenue: 445.7, expenditure: 618.9, outstandingDebt: 1393.0, fiscalBalance: -173.2 },
  { year: "2077/78", yearLabel: "FY 2077/78", revenue: 483.2, expenditure: 678.4, outstandingDebt: 1587.4, fiscalBalance: -195.2 },
  { year: "2078/79", yearLabel: "FY 2081/82", revenue: 621.5, expenditure: 845.3, outstandingDebt: 1811.2, fiscalBalance: -223.8 },
  { year: "2079/80", yearLabel: "FY 2079/80", revenue: 752.8, expenditure: 1014.6, outstandingDebt: 2073.0, fiscalBalance: -261.8 },
  { year: "2080/81", yearLabel: "FY 2080/81", revenue: 957.4, expenditure: 1248.2, outstandingDebt: 2364.6, fiscalBalance: -290.8 },
  { year: "2081/82", yearLabel: "FY 2081/82", revenue: 1847.2, expenditure: 3295.3, outstandingDebt: 2715.4, fiscalBalance: -1448.1 },
];

export interface DistributionItem {
  name: string;
  value: number;
  percentage: number;
  amount: string;
  color: string;
}

export const revenueDistribution: DistributionItem[] = [
  { name: "Tax", value: 58.4, percentage: 58.4, amount: "NPR 1,078.4B", color: "#F59E0B" },
  { name: "Loan", value: 32.4, percentage: 32.4, amount: "NPR 598.1B", color: "#22C55E" },
  { name: "Grant", value: 9.2, percentage: 9.2, amount: "NPR 169.8B", color: "#3B82F6" },
];

export const expenditureDistribution: DistributionItem[] = [
  { name: "Recurrent", value: 63.7, percentage: 63.7, amount: "NPR 2,099.2B", color: "#6366F1" },
  { name: "Capital", value: 24.1, percentage: 24.1, amount: "NPR 794.2B", color: "#22C55E" },
  { name: "Financial", value: 12.2, percentage: 12.2, amount: "NPR 401.9B", color: "#EC4899" },
];

export interface MetricCardData {
  title: string;
  value: string;
  change: number;
  changeLabel: string;
  iconColor: string;
  iconBgColor: string;
  utilization?: number;
}

export const dashboardMetrics: MetricCardData[] = [
  {
    title: "TOTAL BUDGETED",
    value: "NPR 3,720.6B",
    change: 8.2,
    changeLabel: "vs FY 2080/81",
    iconColor: "#2563EB",
    iconBgColor: "#EFF6FF",
  },
  {
    title: "TOTAL ACTUAL",
    value: "NPR 3,295.3B",
    change: 5.1,
    changeLabel: "vs FY 2080/81",
    iconColor: "#22C55E",
    iconBgColor: "#F0FDF4",
  },
  {
    title: "UTILIZATION RATE",
    value: "88.6%",
    change: -1.4,
    changeLabel: "vs FY 2080/81",
    iconColor: "#7C3AED",
    iconBgColor: "#F5F3FF",
    utilization: 88.6,
  },
];

export const revenueBreakdown = [
  { category: "Tax", percentage: 58.4, amount: "NPR 1,078.4B", color: "#F59E0B" },
  { category: "Loan", percentage: 32.4, amount: "NPR 598.1B", color: "#22C55E" },
  { category: "Grant", percentage: 9.2, amount: "NPR 169.8B", color: "#3B82F6" },
];

export const expenditureBreakdown = [
  { category: "Recurrent", percentage: 63.7, amount: "NPR 2,099.2B", color: "#6366F1" },
  { category: "Capital", percentage: 24.1, amount: "NPR 794.2B", color: "#22C55E" },
  { category: "Financial", percentage: 12.2, amount: "NPR 401.9B", color: "#EC4899" },
];

export interface SectorAllocation {
  sector: string;
  amount: number;
  percentage: number;
}

export const sectorAllocations: SectorAllocation[] = [
  { sector: "Education", amount: 245.3, percentage: 18.5 },
  { sector: "Health", amount: 198.7, percentage: 15.0 },
  { sector: "Infrastructure", amount: 356.2, percentage: 26.9 },
  { sector: "Agriculture", amount: 124.5, percentage: 9.4 },
  { sector: "Defense", amount: 89.3, percentage: 6.7 },
  { sector: "Energy", amount: 156.8, percentage: 11.8 },
  { sector: "Others", amount: 162.5, percentage: 12.2 },
];
