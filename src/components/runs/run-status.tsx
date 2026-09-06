import type { RunStatus, RunTrigger } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const STATUS_LABEL: Record<RunStatus, string> = {
  pending: "En attente",
  running: "En cours",
  done: "Terminé",
  failed: "Échec",
};

export const TRIGGER_LABEL: Record<RunTrigger, string> = {
  manual: "à la main",
  cron: "par le cron",
  cli: "en ligne de commande",
};

export function RunStatusBadge({ status }: { status: RunStatus }) {
  const live = status === "pending" || status === "running";
  return (
    <Badge
      variant={status === "failed" ? "destructive" : status === "done" ? "outline" : "secondary"}
      className={cn(status === "done" && "border-signal/40 text-signal")}
    >
      {live ? (
        <span className="relative flex size-2">
          <span className={cn("absolute inline-flex size-full rounded-full bg-signal opacity-75", status === "running" && "animate-ping")} />
          <span className="relative inline-flex size-2 rounded-full bg-signal" />
        </span>
      ) : null}
      {STATUS_LABEL[status]}
    </Badge>
  );
}
