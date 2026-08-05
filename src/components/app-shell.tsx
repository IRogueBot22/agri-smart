import { Link, useLocation } from "@tanstack/react-router";
import { Home, Map, Sparkles, Bell, User, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { PullToRefresh } from "@/components/pull-to-refresh";
import { useI18n, type TKey } from "@/lib/i18n";

const items = [
  { to: "/home", icon: Home, key: "home" as TKey },
  { to: "/fields", icon: Map, key: "fields" as TKey },
  { to: "/advisor", icon: Sparkles, key: "advisor" as TKey },
  { to: "/notifications", icon: Bell, key: "alerts" as TKey },
  { to: "/profile", icon: User, key: "profile" as TKey },
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

export function FloatingChatButton() {
  const { pathname } = useLocation();
  if (pathname.startsWith("/advisor")) return null;
  return (
    <Link
      to="/advisor"
      aria-label="Ask AI Advisor"
      className="fixed bottom-24 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-primary text-primary-foreground shadow-soft transition-transform active:scale-95 md:right-[calc(50%-14rem+1rem)]"
    >
      <MessageCircle className="h-6 w-6" />
      <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[9px] font-bold text-accent-foreground">AI</span>
    </Link>
  );
}

export function AppShell({
  children,
  title,
  back,
  onRefresh,
}: {
  children: React.ReactNode;
  title?: string;
  back?: string;
  onRefresh?: () => void | Promise<void>;
}) {
  const content = <main className="flex-1">{children}</main>;
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
      {onRefresh ? <PullToRefresh onRefresh={onRefresh}>{content}</PullToRefresh> : content}
      <FloatingChatButton />
      <BottomNav />
    </div>
  );
}
