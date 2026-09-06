import type { CellStatus } from "@/lib/queries";
import { cn } from "@/lib/utils";

export const STATUS_LABEL: Record<CellStatus, string> = {
  cited: "Cité (domaine dans les sources)",
  mentioned: "Mentionné dans le texte, sans citation",
  none: "Ni cité ni mentionné",
  error: "Erreur du moteur",
  empty: "Pas encore de donnée",
};

const STYLE: Record<CellStatus, string> = {
  cited: "bg-signal",
  mentioned: "bg-rival",
  none: "bg-muted-foreground/35",
  error: "bg-destructive",
  empty: "border border-dashed border-muted-foreground/40 bg-transparent",
};

export function StatusDot({ status, className }: { status: CellStatus; className?: string }) {
  return <span aria-hidden className={cn("inline-block size-2.5 shrink-0 rounded-full", STYLE[status], className)} />;
}

export function StatusLegend({ className }: { className?: string }) {
  const items: CellStatus[] = ["cited", "mentioned", "none", "error", "empty"];
  const short: Record<CellStatus, string> = { cited: "cité", mentioned: "mentionné", none: "rien", error: "erreur", empty: "pas de donnée" };
  return (
    <ul className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground", className)}>
      {items.map((s) => (
        <li key={s} className="flex items-center gap-1.5">
          <StatusDot status={s} />
          {short[s]}
        </li>
      ))}
    </ul>
  );
}
