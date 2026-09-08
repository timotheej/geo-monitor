import type { Metadata } from "next";
import { getCurrentProject } from "@/lib/queries";
import { getCompetitorOverlap, getShareOfVoice, getShareOfVoiceSeries } from "@/lib/dashboard-queries";
import { firstParam, parseDays } from "@/lib/ui-queries";
import { PageTitle } from "@/components/page-title";
import { NoProject } from "@/components/dashboard/empty-state";
import { CompetitorRanking } from "@/components/competitors/ranking";
import { SovChart } from "@/components/competitors/sov-chart";
import { CompetitorOverlapList } from "@/components/competitors/overlap";
import { ResultSheet } from "@/components/result/result-sheet";

export const metadata: Metadata = { title: "Concurrents" };

export default async function CompetitorsPage({ searchParams }: PageProps<"/competitors">) {
  const sp = await searchParams;
  const days = parseDays(sp.days);
  const project = await getCurrentProject();
  if (!project) return <NoProject />;

  const [ranking, series, overlap] = await Promise.all([getShareOfVoice(project.id, days), getShareOfVoiceSeries(project.id, days), getCompetitorOverlap(project.id, days, 8)]);

  return (
    <div className="space-y-6">
      <PageTitle title="Concurrents" description={`Qui prend la place de ${project.brandName} dans les réponses IA, sur ${days} jours.`} />
      <CompetitorRanking rows={ranking} days={days} />
      <SovChart series={series} days={days} />
      <CompetitorOverlapList rows={overlap} />
      <ResultSheet resultId={firstParam(sp.result)} />
    </div>
  );
}
