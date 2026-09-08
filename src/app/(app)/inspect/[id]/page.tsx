import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { getEngineAvgCost, getInspection, getUrlHistory } from "@/lib/inspect/queries";
import { USD_TO_EUR } from "@/lib/pricing";
import { formatDateLong, formatEur } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { AutoRefresh } from "@/components/runs/auto-refresh";
import { InspectionStatusBadge } from "@/components/inspect/inspection-status";
import { AccessSection } from "@/components/inspect/access-section";
import { PageCard } from "@/components/inspect/page-card";
import { TestSection } from "@/components/inspect/test-section";
import { AnswersSection } from "@/components/inspect/answers-section";
import { HistorySection } from "@/components/inspect/history-section";
import { CitabilitySection } from "@/components/inspect/citability-section";
import { getAnalysisForInspection, judgeAvailable } from "@/lib/citability/analysis";
import { InspectionActions } from "@/components/inspect/inspection-actions";
import { shortUrl } from "@/lib/inspect/verdict";

export const metadata: Metadata = { title: "Rapport d'inspection" };

const HISTORY_DAYS = 90;

export default async function InspectionPage({ params }: PageProps<"/inspect/[id]">) {
  const { id } = await params;
  const data = await getInspection(id);
  if (!data) notFound();
  const { inspection, engines } = data;
  const live = inspection.status === "running";
  const [history, avgCost, analysis] = await Promise.all([
    getUrlHistory(inspection.projectId, inspection.url, HISTORY_DAYS),
    inspection.status === "draft" ? getEngineAvgCost() : Promise.resolve({}),
    inspection.status === "done" ? getAnalysisForInspection(id) : Promise.resolve(null),
  ]);
  const pct = inspection.plannedCount ? Math.min(100, (inspection.doneCount / inspection.plannedCount) * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" className="-ml-2 mb-2 text-muted-foreground" nativeButton={false} render={<Link href="/inspect" />}>
          <ArrowLeft data-icon="inline-start" />
          Toutes les inspections
        </Button>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="min-w-0 text-xl font-medium tracking-tight">
            <a href={inspection.url} target="_blank" rel="noopener noreferrer" className="group inline-flex max-w-full items-center gap-1.5 hover:underline underline-offset-4">
              <span className="truncate font-mono text-lg">{shortUrl(inspection.url)}</span>
              <ExternalLink className="size-4 shrink-0 text-muted-foreground" />
            </a>
          </h1>
          <InspectionStatusBadge status={inspection.status} />
        </div>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Analysée le {formatDateLong(inspection.createdAt)}
          {inspection.page?.title ? <>, « {inspection.page.title} »</> : null}. Coût <span className="font-mono tabular-nums">{formatEur(inspection.costEstimate * USD_TO_EUR, true)}</span>
          {inspection.status === "draft" ? " (analyse seule)" : ""}
        </p>
        <div className="mt-3">
          <InspectionActions inspectionId={inspection.id} projectId={inspection.projectId} url={inspection.url} hasQuestions={inspection.questions.length > 0} running={live} />
        </div>
      </div>

      {inspection.error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm">
          <p className="mb-1 font-medium text-destructive">Le test s&apos;est arrêté</p>
          <p className="text-destructive/90">{inspection.error}</p>
        </div>
      ) : null}

      {live ? (
        <section className="rounded-xl bg-card px-5 py-4 ring-1 ring-foreground/10">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium">Test en cours</p>
            <span className="font-mono text-sm tabular-nums">
              {inspection.doneCount} / {inspection.plannedCount}
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-signal transition-[width]" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Chaque question est posée à chaque moteur avec recherche web. La page se met à jour toutes les 3 secondes.</p>
        </section>
      ) : null}

      <AccessSection page={inspection.page} access={inspection.access} />
      <PageCard page={inspection.page} />

      {inspection.status === "draft" ? (
        <TestSection
          inspectionId={inspection.id}
          initialQuestions={inspection.questions}
          questionsReused={inspection.questionsReused}
          engines={engines.map((e) => ({ id: e.id, label: e.label, model: e.model, enabled: e.enabled, hasKey: e.hasKey }))}
          defaultEngineIds={inspection.engineIds}
          avgCostUsd={avgCost}
          fetchFailed={Boolean(inspection.page?.fetchError)}
        />
      ) : (
        <AnswersSection data={data} />
      )}

      {inspection.status === "done" ? <CitabilitySection inspectionId={inspection.id} questions={inspection.questions.length} analysis={analysis ?? null} judgeAvailable={judgeAvailable(engines)} /> : null}

      <HistorySection rows={history} days={HISTORY_DAYS} />
      <AutoRefresh active={live} intervalMs={3000} />
    </div>
  );
}
