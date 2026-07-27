import { Logo } from "@/components/logo";

export function FullScreenLoader({ message }: { message?: string }) {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-gradient-hero text-primary-foreground">
      <div className="animate-in fade-in zoom-in duration-500">
        <Logo size={80} />
      </div>
      <h1 className="mt-5 text-2xl font-bold tracking-tight">AgriSmart AI</h1>
      {message && <p className="mt-1 text-sm opacity-90">{message}</p>}
      <div className="mt-8 h-1.5 w-32 overflow-hidden rounded-full bg-white/20">
        <div className="h-full w-1/2 animate-pulse rounded-full bg-white/80" />
      </div>
    </div>
  );
}

export function InlineLoader({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
      <p className="mt-3 text-sm">{label}</p>
    </div>
  );
}
