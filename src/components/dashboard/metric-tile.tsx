import { cn } from "@/lib/utils";

interface MetricTileProps {
  label: string;
  value: string;
  hint?: string;
  accent?: "solar" | "battery" | "grid" | "home" | "meter";
  className?: string;
}

const accents: Record<NonNullable<MetricTileProps["accent"]>, string> = {
  solar: "border-l-[var(--solar)]",
  battery: "border-l-[var(--battery)]",
  grid: "border-l-[var(--grid)]",
  home: "border-l-[var(--home)]",
  meter: "border-l-[var(--meter)]",
};

export function MetricTile({ label, value, hint, accent = "solar", className }: MetricTileProps) {
  return (
    <div
      className={cn(
        "border-border/60 bg-background/55 border-l-4 border border-solid px-4 py-3 backdrop-blur-sm",
        accents[accent],
        className,
      )}
    >
      <p className="text-muted-foreground text-xs tracking-[0.14em] uppercase">{label}</p>
      <p className="font-heading mt-1 text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl">
        {value}
      </p>
      {hint ? <p className="text-muted-foreground mt-1 text-xs">{hint}</p> : null}
    </div>
  );
}
