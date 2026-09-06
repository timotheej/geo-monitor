import Link from "next/link";
import type { Run } from "@/db/schema";
import { USD_TO_EUR } from "@/lib/pricing";
import { formatDateTime, formatDuration, formatEur, runDurationMs } from "@/lib/format";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RunStatusBadge, TRIGGER_LABEL } from "./run-status";
import { cn } from "@/lib/utils";

function Progress({ run }: { run: Run }) {
  const pct = run.plannedCount ? Math.min(100, (run.doneCount / run.plannedCount) * 100) : run.status === "done" ? 100 : 0;
  return (
    <span className="flex items-center gap-2">
      <span className="h-1 w-16 overflow-hidden rounded-full bg-muted">
        <span className={cn("block h-full rounded-full", run.status === "failed" ? "bg-destructive/70" : "bg-signal")} style={{ width: `${pct}%` }} />
      </span>
      <span className="font-mono text-xs tabular-nums">
        {run.plannedCount ? `${run.doneCount} / ${run.plannedCount}` : run.doneCount}
      </span>
    </span>
  );
}

export function RunsTable({ runs }: { runs: Run[] }) {
  return (
    <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="pl-4">Date</TableHead>
            <TableHead>Déclencheur</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead>Avancement</TableHead>
            <TableHead className="text-right">Erreurs</TableHead>
            <TableHead className="text-right">Coût estimé</TableHead>
            <TableHead className="pr-4 text-right">Durée</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {runs.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                Aucun run pour l&apos;instant. Le bouton « Lancer un run » en haut à droite en démarre un immédiatement.
              </TableCell>
            </TableRow>
          ) : (
            runs.map((run) => {
              const live = run.status === "pending" || run.status === "running";
              const duration = runDurationMs(run);
              return (
                <TableRow key={run.id} className="relative">
                  <TableCell className="pl-4">
                    <Link href={`/runs/${run.id}`} className="font-medium after:absolute after:inset-0 hover:underline underline-offset-4">
                      {formatDateTime(run.startedAt)}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{TRIGGER_LABEL[run.trigger]}</TableCell>
                  <TableCell>
                    <RunStatusBadge status={run.status} />
                  </TableCell>
                  <TableCell>
                    <Progress run={run} />
                  </TableCell>
                  <TableCell className={cn("text-right font-mono text-sm tabular-nums", run.errorCount ? "text-destructive" : "text-muted-foreground")}>
                    {run.errorCount}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm tabular-nums">{formatEur(run.costEstimate * USD_TO_EUR)}</TableCell>
                  <TableCell className="pr-4 text-right font-mono text-sm text-muted-foreground tabular-nums">
                    {formatDuration(duration)}
                    {live ? <span className="ml-1 text-xs">et plus</span> : null}
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
