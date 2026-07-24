import { Link, useLocation } from "@tanstack/react-router";
import { Home, Map, Sparkles, Bell, User } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { to: "/home", icon: Home, label: "Home" },
  { to: "/fields", icon: Map, label: "Fields" },
  { to: "/advisor", icon: Sparkles, label: "AI Advisor" },
  { to: "/notifications", icon: Bell, label: "Alerts" },
  { to: "/profile", icon: User, label: "Profile" },
] as const;

export function BottomNav() {
  const { pathname } = useLocation();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-md border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <ul className="flex items-center justify-around px-2 py-2">
        {items.map((it) => {
          const active = pathname === it.to || pathname.startsWith(it.to + "/");
          const Icon = it.icon;
          return (
            <li key={it.to}>
              <Link
                to={it.to}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-2xl px-3 py-1.5 text-[11px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <div className={cn("rounded-2xl p-1.5 transition-all", active && "bg-primary/10")}>
                  <Icon className={cn("h-5 w-5", active && "scale-110")} />
                </div>
                <span>{it.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function AppShell({ children, title, back }: { children: React.ReactNode; title?: string; back?: string }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-background pb-24">
      {title && (
        <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
          {back && (
            <Link to={back} className="rounded-full p-1 hover:bg-muted">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            </Link>
          )}
          <h1 className="text-base font-semibold">{title}</h1>
        </header>
      )}
      <main className="flex-1">{children}</main>
      <BottomNav />
    </div>
  );
}
