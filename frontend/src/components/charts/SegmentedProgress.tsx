import { motion } from "framer-motion";

interface Segment {
  label: string;
  percentage: number;
  color: string;
  amount?: string;
}

interface SegmentedProgressProps {
  segments: Segment[];
}

export default function SegmentedProgress({ segments }: SegmentedProgressProps) {
  return (
    <div className="space-y-4">
      {/* Progress Bar - rendered from segments array */}
      <div className="h-3 w-full rounded-full overflow-hidden flex">
        {segments.map((segment, index) => (
          <motion.div
            key={`bar-${segment.label}`}
            initial={{ width: 0 }}
            animate={{ width: `${segment.percentage}%` }}
            transition={{ duration: 0.8, delay: index * 0.1 + 0.5 }}
            className="h-full first:rounded-l-full last:rounded-r-full"
            style={{ backgroundColor: segment.color }}
          />
        ))}
      </div>
      
      {/* Legend - generated from SAME segments array */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {segments.map((segment) => (
          <div
            key={`legend-${segment.label}`}
            className="flex items-center gap-2.5 p-2 rounded-lg bg-muted/30"
          >
            {/* Color indicator */}
            <div
              className="h-3 w-3 rounded-full flex-shrink-0 ring-2 ring-white shadow-sm"
              style={{ backgroundColor: segment.color }}
            />
            {/* Label and data */}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground truncate">
                {segment.label}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {segment.percentage}%{segment.amount && ` · ${segment.amount}`}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
