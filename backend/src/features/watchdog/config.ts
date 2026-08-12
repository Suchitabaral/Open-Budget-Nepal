export const WATCHDOG_RULES = {
  SEVERE_DELAY: {
    id: 'SEVERE_DELAY',
    label: 'Severe Delay',
    severity: 'High',
    completionThreshold: 90,
    score: { base: 40, overdueWeight: 30, completionWeight: 30, overdueHorizonDays: 1825 },
  },
  COST_OVERRUN: {
    id: 'COST_OVERRUN',
    label: 'Cost Overrun',
    severity: 'High',
    score: { base: 50, magnitudeWeight: 50, overrunHorizonPercentage: 50 },
  },
  HIGH_CONCENTRATION: {
    id: 'HIGH_CONCENTRATION',
    label: 'High Concentration',
    severity: 'Medium',
    percentageThreshold: 40,
    score: { base: 40, magnitudeWeight: 60 },
  },
} as const;

export type WatchdogRuleId = keyof typeof WATCHDOG_RULES;
export type WatchdogSeverity = (typeof WATCHDOG_RULES)[WatchdogRuleId]['severity'];
export const WATCHDOG_SEVERITY_ORDER: Record<WatchdogSeverity, number> = { High: 2, Medium: 1 };

export const WATCHDOG_SOURCE_DATASETS = [
  'PPMO contract_details.csv',
  'FY2081/82 curated project registry',
] as const;
