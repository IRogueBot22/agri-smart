import { Leaf } from "lucide-react";

export function Logo({ size = 40 }: { size?: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-2xl bg-gradient-primary shadow-soft"
      style={{ width: size, height: size }}
    >
      <Leaf className="text-primary-foreground" style={{ width: size * 0.55, height: size * 0.55 }} strokeWidth={2.2} />
    </div>
  );
}
