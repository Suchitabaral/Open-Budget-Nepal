import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HeaderProps { onMenuToggle: () => void; }

export default function Header({ onMenuToggle }: HeaderProps) {
  return <header className="sticky top-0 z-30 flex h-14 items-center border-b border-slate-200 bg-white/95 px-4 backdrop-blur lg:hidden">
    <Button variant="ghost" size="icon" onClick={onMenuToggle} aria-label="Open navigation"><Menu className="h-5 w-5"/></Button>
  </header>;
}
