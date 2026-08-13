import type { ReactNode } from "react";

export interface ChartTooltipEntry {
  color?: string;
  name?: ReactNode;
  value?: ReactNode;
}

export interface ChartTooltipProps {
  active?: boolean;
  payload?: readonly ChartTooltipEntry[];
  label?: ReactNode;
}
