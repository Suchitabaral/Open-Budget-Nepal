import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

const secondaryTabs = [
  { label: "Overview", path: "/" },
  { label: "Federal", path: "/federal" },
  { label: "Provincial", path: "/provincial" },
  { label: "Local", path: "/local" },
  { label: "Economic Indicators", path: "/economic-indicators" },
];

export default function SecondaryNav() {
  const location = useLocation();

  return (
    <div className="flex items-center gap-1 bg-white rounded-full p-1 shadow-sm border border-border overflow-x-auto max-w-full">
      {secondaryTabs.map((tab) => {
        const isActive = location.pathname === tab.path;
        return (
          <Link
            key={tab.path}
            to={tab.path}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-full whitespace-nowrap transition-colors",
              isActive
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
