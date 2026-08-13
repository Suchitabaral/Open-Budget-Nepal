import { Link, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Braces, Building2, ChevronLeft, Lightbulb, Map, MessageSquare, Settings, ShieldAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useTranslation, type MessageKey } from "@/features/preferences/translations";

const items: { label: MessageKey; path: string; icon: typeof Map }[] = [
  { label: "openBudgetMap", path: "/", icon: Map },
  { label: "budgetInsights", path: "/insights", icon: Lightbulb },
  { label: "contractors", path: "/contractors", icon: Building2 },
  { label: "watchdog", path: "/watchdog", icon: ShieldAlert },
  { label: "chatBot", path: "/chatbot", icon: MessageSquare },
  { label: "api", path: "/api", icon: Braces },
  { label: "settings", path: "/settings", icon: Settings },
];

interface SidebarProps { isOpen: boolean; collapsed: boolean; onClose: () => void; onCollapse: () => void; }

function Brand({ compact = false }: { compact?: boolean }) {
  return <Link to="/" aria-label="Open Budget Nepal" className={cn("flex min-w-0 items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600", compact && "justify-center")}>
    <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full bg-slate-950 text-[11px] font-bold tracking-tight text-white shadow-sm dark:bg-slate-50 dark:text-slate-950">
      Rs
      <i aria-hidden="true" className="absolute right-0 top-0 h-3 w-3 rounded-full border-2 border-white bg-emerald-500 dark:border-slate-900" />
    </span>
    {compact ? null : <span className="min-w-0 leading-none">
      <span className="block truncate text-[15px] font-bold tracking-[-.01em] text-slate-950 dark:text-white">Open Budget</span>
      <span className="mt-1.5 block text-[10px] font-bold uppercase tracking-[.24em] text-emerald-700 dark:text-emerald-400">Nepal</span>
    </span>}
  </Link>;
}

function Nav({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const { pathname } = useLocation();
  const t = useTranslation();
  return <nav className="space-y-1 px-3 py-4" aria-label="Primary navigation">{items.map(({ label, path, icon: Icon }) => {
    const active = path === "/" ? pathname === "/" : pathname.startsWith(path);
    return <Link key={path} to={path} onClick={onNavigate} title={collapsed ? t(label) : undefined} className={cn("group flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600", active ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white")}>
      <Icon className={cn("h-[18px] w-[18px] shrink-0", active && "text-emerald-700 dark:text-emerald-400")} />{collapsed ? null : <span>{t(label)}</span>}{active && !collapsed ? <span className="ml-auto h-1.5 w-1.5 rounded-full bg-emerald-600" /> : null}
    </Link>;
  })}</nav>;
}

export default function Sidebar({ isOpen, collapsed, onClose, onCollapse }: SidebarProps) {
  const t = useTranslation();
  return <>
    <aside className={cn("sticky top-0 hidden h-screen shrink-0 flex-col border-r border-slate-200 bg-white transition-[width] duration-200 dark:border-slate-800 dark:bg-slate-900 lg:flex", collapsed ? "w-[72px]" : "w-64")}>
      <div className={cn("flex h-[72px] items-center border-b border-slate-200 dark:border-slate-800", collapsed ? "justify-center px-2" : "px-4")}>
        <Brand compact={collapsed} />
      </div>
      <div className="flex-1 overflow-y-auto"><Nav collapsed={collapsed} /></div>
      <div className="border-t border-slate-200 p-3 dark:border-slate-800"><Button variant="ghost" className={cn("w-full text-slate-500 dark:text-slate-400", collapsed ? "px-0" : "justify-start")} onClick={onCollapse}><ChevronLeft className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")} />{collapsed ? null : t("collapseSidebar")}</Button></div>
    </aside>
    <AnimatePresence>{isOpen ? <><motion.button aria-label={t("closeNavigation")} className="fixed inset-0 z-40 bg-slate-950/40 lg:hidden" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={onClose}/><motion.aside className="fixed inset-y-0 left-0 z-50 w-[280px] bg-white shadow-2xl dark:bg-slate-900 lg:hidden" initial={{x:"-100%"}} animate={{x:0}} exit={{x:"-100%"}} transition={{duration:.2}}><div className="flex h-[72px] items-center justify-between border-b px-4 dark:border-slate-800"><Brand /><Button variant="ghost" size="icon" onClick={onClose} aria-label={t("closeNavigation")}><X className="h-5 w-5"/></Button></div><Nav collapsed={false} onNavigate={onClose}/></motion.aside></> : null}</AnimatePresence>
  </>;
}
