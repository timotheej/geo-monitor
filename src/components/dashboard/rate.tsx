import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { formatDelta, formatRate } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Taux en Geist Mono, atténué quand il n'est pas mesuré, accentué quand il est positif. */
export function RateValue({ value, accent = "signal", className }: { value: number | null; accent?: "signal" | "rival" | "none"; className?: string }) {
  return (
    <span
      className={cn(
        "font-mono tabular-nums",
        value === null ? "text-muted-foreground/60" : value > 0 && accent !== "none" ? (accent === "signal" ? "text-signal" : "text-rival") : "",
        className,
      )}
    >
      {formatRate(value)}
    </span>
  );
}

/** Variation en points vs période précédente, flèche verte ou rouge. Rien si non mesurable. */
export function RateDelta({ points, className }: { points: number | null; className?: string }) {
  const label = formatDelta(points);
  if (!label || points === null) return null;
  const up = points > 0;
  const flat = Math.round(points * 10) === 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 font-mono text-xs tabular-nums",
        flat ? "text-muted-foreground" : up ? "text-signal" : "text-destructive",
        className,
      )}
      title="Variation en points par rapport à la période précédente"
    >
      {flat ? null : up ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
      {label}
    </span>
  );
}

/** Barre horizontale proportionnelle, couleur libre. */
export function Bar({ value, max = 1, color, className, thin }: { value: number; max?: number; color: string; className?: string; thin?: boolean }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <span className={cn("block overflow-hidden rounded-full bg-muted", thin ? "h-1" : "h-1.5", className)}>
      <span className="block h-full rounded-full" style={{ width: `${value > 0 ? Math.max(2, pct) : 0}%`, backgroundColor: color }} />
    </span>
  );
}
