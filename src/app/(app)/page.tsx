import type { Metadata } from "next";
import { getCurrentProject, getEngines, getOverview, getPrompts, getTimeSeries, getTopDomains } from "@/lib/queries";
import { getEngineCards, getQuickOpportunities, getShareOfVoice } from "@/lib/dashboard-queries";
import { firstParam, getEngineKeyStatus, parseDays } from "@/lib/ui-queries";
import { KpiStrip } from "@/components/dashboard/kpi-strip";
import { EngineCards } from "@/components/dashboard/engine-cards";
import { TrendChart } from "@/components/dashboard/trend-chart";
import { ShareOfVoiceBars } from "@/components/dashboard/share-of-voice";
import { TopDomains } from "@/components/dashboard/top-domains";
import { QuickOpportunities } from "@/components/dashboard/quick-opportunities";
import { EmptyDashboard, NoProject } from "@/components/dashboard/empty-state";
import { ResultSheet } from "@/components/result/result-sheet";
import { PageTitle } from "@/components/page-title";

export const metadata: Metadata = { title: "Vue d'ensemble" };

export default async function OverviewPage({ searchParams }: PageProps<"/">) {
  const sp = await searchParams;
  const days = parseDays(sp.days);
  const project = await getCurrentProject();
  if (!project) return <NoProject />;

  const [overview, cards, series, sov, domains, opportunities, engines, keys] = await Promise.all([
    getOverview(project.id, days),
    getEngineCards(project.id, days),
    getTimeSeries(project.id, days),
    getShareOfVoice(project.id, days),
    getTopDomains(project.id, days, 10),
    getQuickOpportunities(project.id, days, 5),
    getEngines(),
    getEngineKeyStatus(),
  ]);

  const hasData = overview.answers > 0 || series.length > 0;
  const activePrompts = hasData ? 0 : (await getPrompts(project.id)).filter((p) => p.active).length;
  const activeEngines = engines.filter((e) => e.enabled).map((e) => ({ id: e.id, label: e.label, provider: e.provider }));

  return (
    <div className="space-y-6">
      <PageTitle title="Vue d'ensemble" description={`Visibilité de ${project.brandName} dans les réponses IA, ${days} derniers jours.`} />

      <KpiStrip overview={overview} />

      {hasData ? (
        <>
          <EngineCards cards={cards} keys={keys} />
          <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <TrendChart series={series} engines={activeEngines} days={days} />
            <ShareOfVoiceBars rows={sov} />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <TopDomains rows={domains} />
            <QuickOpportunities rows={opportunities} hasData={hasData} />
          </div>
        </>
      ) : (
        <EmptyDashboard keys={keys} promptCount={activePrompts} />
      )}

      <ResultSheet resultId={firstParam(sp.result)} />
    </div>
  );
}
