import type { InspectionStatus } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const INSPECTION_STATUS_LABEL: Record<InspectionStatus, string> = {
  draft: "Brouillon",
  running: "En cours",
  done: "Terminée",
  failed: "Échec",
};

export function InspectionStatusBadge({ status }: { status: InspectionStatus }) {
  return (
    <Badge
      variant={status === "failed" ? "destructive" : status === "done" ? "outline" : status === "draft" ? "outline" : "secondary"}
      className={cn(status === "done" && "border-signal/40 text-signal", status === "draft" && "text-muted-foreground")}
    >
      {status === "running" ? (
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-signal opacity-75" />
          <span className="relative inline-flex size-2 rounded-full bg-signal" />
        </span>
      ) : null}
      {INSPECTION_STATUS_LABEL[status]}
    </Badge>
  );
}
