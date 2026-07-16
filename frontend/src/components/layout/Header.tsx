import { Bell, Menu, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HeaderProps {
  onMenuToggle: () => void;
}

export default function Header({ onMenuToggle }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center border-b border-slate-200 bg-white/95 px-4 backdrop-blur md:px-6">
      <Button variant="ghost" size="icon" className="mr-2 lg:hidden" onClick={onMenuToggle} aria-label="Open navigation">
        <Menu className="h-5 w-5" />
      </Button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-900">Nepal’s public finance record</p>
        <p className="hidden text-xs text-slate-500 sm:block">Ministry and public procurement data · FY 2081/82</p>
      </div>
      <button className="mr-2 hidden h-9 w-full max-w-72 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-left text-sm text-slate-500 transition hover:border-slate-300 hover:bg-white md:flex" aria-label="Search public finance data">
        <Search className="h-4 w-4" /><span className="flex-1">Search records</span><kbd className="rounded border bg-white px-1.5 py-0.5 text-[10px]">⌘ K</kbd>
      </button>
      <Button variant="ghost" size="icon" aria-label="Notifications" className="relative">
        <Bell className="h-4 w-4" /><span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-red-600" />
      </Button>
      <div className="ml-2 grid h-8 w-8 place-items-center rounded-full bg-slate-900 text-[11px] font-semibold text-white" aria-label="Guest profile">NP</div>
    </header>
  );
}
