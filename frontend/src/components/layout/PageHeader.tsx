interface PageHeaderProps { eyebrow?: string; title: string; subtitle?: string; action?: React.ReactNode; backgroundImage?: string; }
export default function PageHeader({ eyebrow, title, subtitle, action }: PageHeaderProps) {
  return <div className="mb-6 flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
    <div className="max-w-3xl lg:pr-28">{eyebrow ? <p className="mb-2 text-[11px] font-bold uppercase tracking-[.18em] text-emerald-700">{eyebrow}</p> : null}<h1 className="text-2xl font-bold tracking-[-.025em] text-slate-950 sm:text-[28px]">{title}</h1>{subtitle ? <p className="mt-2 text-sm leading-6 text-slate-600 sm:text-[15px]">{subtitle}</p> : null}</div>{action ? <div className="shrink-0">{action}</div> : null}
  </div>;
}
