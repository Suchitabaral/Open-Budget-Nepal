import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/features/preferences/translations";

interface HeaderProps { onMenuToggle: () => void; }

export default function Header({ onMenuToggle }: HeaderProps) {
  const t = useTranslation();
  return <header className="sticky top-0 z-30 flex h-14 items-center border-b border-slate-200 bg-white/95 px-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 lg:hidden">
    <Button variant="ghost" size="icon" onClick={onMenuToggle} aria-label={t("openNavigation")}><Menu className="h-5 w-5"/></Button>
  </header>;
}
