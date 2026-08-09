import { Link, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Braces, Building2, ChevronLeft, Lightbulb, Map, Settings, ShieldAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const items = [
  { label: "Open Budget Map", path: "/", icon: Map },
  { label: "Budget Insights", path: "/insights", icon: Lightbulb },
  { label: "Contractors", path: "/contractors", icon: Building2 },
  { label: "Watchdog", path: "/watchdog", icon: ShieldAlert },
  { label: "API", path: "/api", icon: Braces },
  { label: "Settings", path: "/settings", icon: Settings },
];

interface SidebarProps { isOpen: boolean; collapsed: boolean; onClose: () => void; onCollapse: () => void; }

function Nav({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const { pathname } = useLocation();
  return <nav className="space-y-1 px-3 py-4" aria-label="Primary navigation">{items.map(({ label, path, icon: Icon }) => {
    const active = path === "/" ? pathname === "/" : pathname.startsWith(path);
    return <Link key={path} to={path} onClick={onNavigate} title={collapsed ? label : undefined} className={cn("group flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600", active ? "bg-emerald-50 text-emerald-800" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950")}>
      <Icon className={cn("h-[18px] w-[18px] shrink-0", active && "text-emerald-700")} />{collapsed ? null : <span>{label}</span>}{active && !collapsed ? <span className="ml-auto h-1.5 w-1.5 rounded-full bg-emerald-600" /> : null}
    </Link>;
  })}</nav>;
}

export default function Sidebar({ isOpen, collapsed, onClose, onCollapse }: SidebarProps) {
  return <>
    <aside className={cn("sticky top-0 hidden h-screen shrink-0 flex-col border-r border-slate-200 bg-white transition-[width] duration-200 lg:flex", collapsed ? "w-[72px]" : "w-64")}>
      <div className="flex h-16 items-center border-b border-slate-200 px-4">
        <Link to="/" className="flex min-w-0 items-center gap-3"><div className="relative grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-950 text-xs font-bold text-white"><span>₨</span><i className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" /></div>{collapsed ? null : <div className="min-w-0 leading-tight"><p className="truncate text-sm font-bold text-slate-950">Open Budget</p><p className="text-[11px] font-semibold uppercase tracking-[.18em] text-emerald-700">Nepal</p></div>}</Link>
      </div>
      <div className="flex-1 overflow-y-auto"><Nav collapsed={collapsed} /></div>
      <div className="border-t border-slate-200 p-3"><Button variant="ghost" className={cn("w-full text-slate-500", collapsed ? "px-0" : "justify-start")} onClick={onCollapse}><ChevronLeft className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")} />{collapsed ? null : "Collapse sidebar"}</Button></div>
    </aside>
    <AnimatePresence>{isOpen ? <><motion.button aria-label="Close navigation" className="fixed inset-0 z-40 bg-slate-950/40 lg:hidden" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={onClose}/><motion.aside className="fixed inset-y-0 left-0 z-50 w-[280px] bg-white shadow-2xl lg:hidden" initial={{x:"-100%"}} animate={{x:0}} exit={{x:"-100%"}} transition={{duration:.2}}><div className="flex h-16 items-center justify-between border-b px-4"><span className="text-sm font-bold">Open Budget <span className="text-emerald-700">Nepal</span></span><Button variant="ghost" size="icon" onClick={onClose} aria-label="Close navigation"><X className="h-5 w-5"/></Button></div><Nav collapsed={false} onNavigate={onClose}/></motion.aside></> : null}</AnimatePresence>
  </>;
}
