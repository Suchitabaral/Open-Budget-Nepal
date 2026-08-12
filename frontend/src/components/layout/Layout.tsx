import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import Header from "./Header";
import Sidebar from "./Sidebar";

export default function Layout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const reduceMotion = useReducedMotion();
  return <div className="flex min-h-screen bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-slate-50">
    <Sidebar isOpen={open} collapsed={collapsed} onClose={() => setOpen(false)} onCollapse={() => setCollapsed(v => !v)} />
    <div className="min-w-0 flex-1"><Header onMenuToggle={() => setOpen(true)} />
      <main id="main-content"><motion.div initial={reduceMotion ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .22 }} className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</motion.div></main>
    </div>
  </div>;
}
