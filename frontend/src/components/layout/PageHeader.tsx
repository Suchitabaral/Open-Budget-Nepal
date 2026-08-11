import { motion } from "framer-motion";

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export default function PageHeader({ eyebrow, title, subtitle, action }: PageHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-6"
    >
      <div>
        {eyebrow && (
          <p className="text-sm font-semibold text-primary mb-1 tracking-wide uppercase">
            {eyebrow}
          </p>
        )}
        <h1 className="text-2xl lg:text-3xl font-bold text-foreground">{title}</h1>
        {subtitle && <p className="text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </motion.div>
  );
}
