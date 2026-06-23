import { motion } from "framer-motion";

interface Segment {
  label: string;
  percentage: number;
  color: string;
}

interface SegmentedProgressProps {
  segments: Segment[];
}

export default function SegmentedProgress({ segments }: SegmentedProgressProps) {
  return (
    <div className="mt-4">
      <div className="h-3 w-full rounded-full overflow-hidden flex">
        {segments.map((segment, index) => (
          <motion.div
            key={segment.label}
            initial={{ width: 0 }}
            animate={{ width: `${segment.percentage}%` }}
            transition={{ duration: 0.8, delay: index * 0.1 + 0.5 }}
            className="h-full first:rounded-l-full last:rounded-r-full"
            style={{ backgroundColor: segment.color }}
          />
        ))}
      </div>
      <div className="flex justify-between mt-2 text-xs text-muted-foreground">
        {segments.map((segment) => (
          <span key={segment.label}>{segment.label}</span>
        ))}
      </div>
    </div>
  );
}
