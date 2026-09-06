import { getCurrentProject, getEngines, getOverview, getPromptMatrix, getTimeSeries, getTopDomains } from "@/lib/queries";
import { firstParam, getEngineKeyStatus, parseDays } from "@/lib/ui-queries";
import { KpiStrip } from "@/components/dashboard/kpi-strip";
import { CitationChart } from "@/components/dashboard/citation-chart";
import { PromptMatrix } from "@/components/dashboard/prompt-matrix";
import { TopDomains } from "@/components/dashboard/top-domains";
import { EmptyDashboard, NoProject } from "@/components/dashboard/empty-state";
import { ResultSheet } from "@/components/result/result-sheet";
import { PageTitle } from "@/components/page-title";

export default async function DashboardPage({ searchParams }: PageProps<"/">) {
  const sp = await searchParams;
  const days = parseDays(sp.days);
  const project = await getCurrentProject();
  if (!project) return <NoProject />;

  const [overview, series, matrix, domains, engines, keys] = await Promise.all([
    getOverview(project.id, days),
    getTimeSeries(project.id, days),
    getPromptMatrix(project.id, days),
    getTopDomains(project.id, days, 10),
    getEngines(),
    getEngineKeyStatus(),
  ]);

  const hasData = overview.answers > 0 || series.length > 0;
  const activeEngines = engines.filter((e) => e.enabled);

  return (
    <div className="space-y-6">
      <PageTitle
        title="Dashboard"
        description={`Visibilité de ${project.brandName} dans les réponses IA, ${days} derniers jours.`}
      />

      <KpiStrip overview={overview} />

      {hasData ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <CitationChart series={series} engines={activeEngines.map((e) => ({ id: e.id, label: e.label }))} days={days} />
          <TopDomains rows={domains} />
        </div>
      ) : (
        <EmptyDashboard keys={keys} promptCount={matrix.filter((r) => r.prompt.active).length} />
      )}

      <PromptMatrix rows={matrix} engines={activeEngines} days={days} />

      <ResultSheet resultId={firstParam(sp.result)} />
    </div>
  );
}
