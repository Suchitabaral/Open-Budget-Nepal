import { Link } from "react-router-dom";

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  navLabel?: string;
  navLink?: string;
}

export default function AuthLayout({ children, title, navLabel, navLink }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md rounded-2xl shadow-xl overflow-hidden bg-card border border-border">
        {/* Header */}
        <div className="bg-card px-6 py-4 flex items-center justify-between border-b border-border">
          <Link to="/" className="text-sm font-semibold text-primary tracking-wide hover:underline">
            OPEN BUDGET NEPAL
          </Link>
          {navLabel && navLink && (
            <Link
              to={navLink}
              className="px-4 py-1.5 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              {navLabel}
            </Link>
          )}
        </div>

        {/* Title */}
        <div className="px-8 pt-8 pb-2">
          <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
        </div>

        {/* Content */}
        <div className="px-8 pb-8">
          {children}
        </div>
      </div>
    </div>
  );
}
