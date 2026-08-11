import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Menu, X, LogIn, UserPlus, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface HeaderProps {
  onMenuToggle: () => void;
  isSidebarOpen: boolean;
}

const navItems = [
  { label: "Overview", path: "/" },
  { label: "Budget Insights", path: "/insights" },
  { label: "Watchdog", path: "/watchdog" },
  { label: "Chatbot", path: "/chatbot" },
];

export default function Header({ onMenuToggle, isSidebarOpen }: HeaderProps) {
  const location = useLocation();

  return (
    <header className="sticky top-0 z-40 w-full bg-white border-b border-border shadow-sm">
      <div className="flex h-16 items-center justify-between px-4 lg:px-8">
        {/* Left Section */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={onMenuToggle}
            aria-label="Toggle menu"
          >
            {isSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>

          <Link to="/" className="flex items-center gap-2 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-white shadow-md group-hover:shadow-lg transition-shadow">
              <Shield className="h-5 w-5" />
            </div>
            <div className="hidden sm:block">
              <span className="text-sm font-bold text-foreground leading-tight block">OPEN BUDGET</span>
              <span className="text-xs font-semibold text-primary leading-tight block">NEPAL</span>
            </div>
          </Link>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden lg:flex items-center gap-1 bg-muted/50 rounded-full p-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "relative px-4 py-2 text-sm font-medium rounded-full transition-colors",
                  isActive ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="headerNavPill"
                    className="absolute inset-0 bg-primary rounded-full"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <span className="relative z-10">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Right Section */}
        <div className="flex items-center gap-2">
          <Link to="/login">
            <Button variant="ghost" size="sm" className="hidden sm:flex gap-2 text-muted-foreground">
              <LogIn className="h-4 w-4" />
              Login
            </Button>
          </Link>
          <Link to="/signup">
            <Button size="sm" className="hidden sm:flex gap-2 bg-primary hover:bg-primary/90">
              <UserPlus className="h-4 w-4" />
              Register
            </Button>
          </Link>
          <Link to="/login" className="sm:hidden">
            <Button variant="ghost" size="icon">
              <LogIn className="h-5 w-5" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Mobile Navigation */}
      <div className="lg:hidden border-t border-border overflow-x-auto">
        <div className="flex items-center px-4 py-2 gap-1 min-w-max">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "px-4 py-1.5 text-sm font-medium rounded-full whitespace-nowrap transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </header>
  );
}
