import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getRun } from "@/lib/queries";
import { firstParam } from "@/lib/ui-queries";
import { USD_TO_EUR } from "@/lib/pricing";
import { formatDateLong, formatDateTime, formatDuration, formatEur, runDurationMs } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { RunStatusBadge, TRIGGER_LABEL } from "@/components/runs/run-status";
import { RunResultsTable } from "@/components/runs/run-results-table";
import { AutoRefresh } from "@/components/runs/auto-refresh";
import { ResultSheet } from "@/components/result/result-sheet";

export const metadata: Metadata = { title: "Détail du run" };

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 px-5 py-3 sm:border-l first:sm:border-l-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-mono text-sm tabular-nums">{value}</span>
    </div>
  );
}

export default async function RunDetailPage({ params, searchParams }: PageProps<"/runs/[id]">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const data = await getRun(id);
  if (!data) notFound();
  const { run, results } = data;
  const live = run.status === "pending" || run.status === "running";
  const duration = runDurationMs(run);
  const cited = results.filter((r) => r.cited).length;
  const ok = results.filter((r) => !r.result.error).length;

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" className="-ml-2 mb-2 text-muted-foreground" nativeButton={false} render={<Link href="/runs" />}>
          <ArrowLeft data-icon="inline-start" />
          Tous les runs
        </Button>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-medium tracking-tight">Run du {formatDateLong(run.startedAt)}</h1>
          <RunStatusBadge status={run.status} />
        </div>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Déclenché {TRIGGER_LABEL[run.trigger]}
          {run.workflowRunId ? (
            <>
              , workflow <code className="font-mono text-xs">{run.workflowRunId}</code>
            </>
          ) : null}
        </p>
      </div>

      {run.error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm">
          <p className="mb-1 font-medium text-destructive">Le run s&apos;est arrêté</p>
          <p className="text-destructive/90">{run.error}</p>
        </div>
      ) : null}

      <section className="grid grid-cols-2 divide-y rounded-xl bg-card ring-1 ring-foreground/10 sm:grid-cols-3 sm:divide-y-0 lg:grid-cols-6">
        <Stat label="Avancement" value={run.plannedCount ? `${run.doneCount} / ${run.plannedCount}` : `${run.doneCount}`} />
        <Stat label="Erreurs" value={<span className={run.errorCount ? "text-destructive" : ""}>{run.errorCount}</span>} />
        <Stat label="Réponses citées" value={ok ? `${cited} / ${ok}` : "-"} />
        <Stat label="Coût estimé" value={formatEur(run.costEstimate * USD_TO_EUR)} />
        <Stat label="Durée" value={formatDuration(duration)} />
        <Stat label="Fin" value={run.finishedAt ? formatDateTime(run.finishedAt) : live ? "en cours" : "-"} />
      </section>

      <RunResultsTable results={results} live={live} />
      <AutoRefresh active={live} />
      <ResultSheet resultId={firstParam(sp.result)} />
    </div>
  );
}
