import { motion } from "framer-motion";

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  backgroundImage?: string;
}

const defaultBg = "https://images.unsplash.com/photo-1605732562742-62f7c360e5a4?q=80&w=2070&auto=format&fit=crop";

export default function PageHeader({ eyebrow, title, subtitle, action, backgroundImage }: PageHeaderProps) {
  const bg = backgroundImage || defaultBg;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="relative rounded-2xl overflow-hidden mb-6"
    >
      {/* Background Image */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${bg})` }}
      />
      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-slate-900/85 via-slate-800/75 to-slate-700/60" />

      {/* Content */}
      <div className="relative z-10 px-6 py-10 lg:px-10 lg:py-14 flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          {eyebrow && (
            <p className="text-sm font-semibold text-emerald-300 mb-2 tracking-wide uppercase">
              {eyebrow}
            </p>
          )}
          <h1 className="text-3xl lg:text-4xl font-bold text-white">{title}</h1>
          {subtitle && <p className="text-slate-200 mt-2 text-base lg:text-lg max-w-2xl">{subtitle}</p>}
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>
    </motion.div>
  );
}
